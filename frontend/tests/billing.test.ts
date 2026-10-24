import Stripe from "stripe";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { OTHER, OWNER, setPlan, startTestDb, type TestDb } from "./helpers/testDb";

vi.mock("@/lib/server/auth", () => ({
  isAuthConfigured: () => true,
  getAuthedUser: async (request: Request) => {
    const header = request.headers.get("authorization");
    if (header === "Bearer owner") return { id: "11111111-1111-4111-8111-aaaaaaaaaaaa", email: "owner@example.com" };
    if (header === "Bearer noemail") return { id: "33333333-3333-4333-8333-cccccccccccc", email: null };
    return null;
  },
}));

import { POST as checkoutRoute } from "../src/app/api/billing/create-checkout-session/route";
import { POST as portalRoute } from "../src/app/api/billing/create-portal-session/route";
import { GET as summaryRoute } from "../src/app/api/billing/summary/route";
import { POST as webhookRoute } from "../src/app/webhooks/stripe/route";
import {
  billingSummary,
  createCheckoutSession,
  createPortalSession,
  handleStripeEvent,
  periodSeconds,
} from "../src/lib/server/billingService";
import { setSqlForTests } from "../src/lib/server/db";
import { normalizePlan, PLAN_CONFIGS, planForPriceId, planPriceId } from "../src/lib/server/plans";
import { ServiceError } from "../src/lib/server/guidebookService";
import { setStripeForTests } from "../src/lib/server/stripeClient";

const ENV_KEYS = ["STRIPE_STARTER_PRICE_ID", "STRIPE_POWER_PRICE_ID", "STRIPE_PRO_PRICE_ID", "STRIPE_ACTIVE_COUPON_ID", "STRIPE_PORTAL_CONFIGURATION_ID", "STRIPE_WEBHOOK_SECRET"];
const savedEnv: Record<string, string | undefined> = {};

let db: TestDb;
beforeAll(async () => {
  db = await startTestDb();
}, 60000);
afterAll(async () => {
  setSqlForTests(undefined);
  setStripeForTests(undefined);
  await db?.close();
});
beforeEach(async () => {
  for (const k of ENV_KEYS) savedEnv[k] = process.env[k];
  process.env.STRIPE_STARTER_PRICE_ID = "price_starter";
  process.env.STRIPE_POWER_PRICE_ID = "price_power";
  process.env.STRIPE_PRO_PRICE_ID = "price_pro";
  setSqlForTests(db.sql);
  await db.reset();
});
afterEach(() => {
  for (const k of ENV_KEYS) {
    if (savedEnv[k] === undefined) delete process.env[k];
    else process.env[k] = savedEnv[k];
  }
  setStripeForTests(undefined);
});

const user = { id: OWNER, email: "owner@example.com" };
const origin = "https://app.example.com";

/** A fake Stripe API; every method is a spy so tests can assert on the calls. */
function fakeStripe(overrides: Record<string, unknown> = {}) {
  const fake = {
    customers: { list: vi.fn(async () => ({ data: [] })) },
    subscriptions: { list: vi.fn(async () => ({ data: [] })), retrieve: vi.fn(async () => ({ id: "sub_1", items: { data: [] } })) },
    invoices: { list: vi.fn(async () => ({ data: [] })) },
    checkout: { sessions: { create: vi.fn(async () => ({ url: "https://checkout.stripe.test/s1" })) } },
    coupons: { retrieve: vi.fn(async () => ({ valid: true })) },
    billingPortal: { sessions: { create: vi.fn(async () => ({ url: "https://portal.stripe.test/p1" })) } },
    ...overrides,
  };
  return fake as unknown as Stripe & typeof fake;
}

const rejects = async (p: Promise<unknown>, status: number) => {
  try {
    await p;
  } catch (e) {
    expect(e).toBeInstanceOf(ServiceError);
    expect((e as ServiceError).status).toBe(status);
    return e as ServiceError;
  }
  throw new Error("expected ServiceError");
};

describe("plans and period dates", () => {
  it("maps price ids to plans and back", () => {
    expect(planPriceId("starter")).toBe("price_starter");
    expect(planPriceId("free")).toBeNull();
    expect(planPriceId("enterprise")).toBeNull();
    expect(planPriceId("nope")).toBeNull();
    expect(planForPriceId("price_power")).toBe("power");
    expect(planForPriceId("price_unknown")).toBeNull();
    expect(planForPriceId(undefined)).toBeNull();
    expect(PLAN_CONFIGS.starter.guidebookLimit).toBe(3);
    expect(PLAN_CONFIGS.power.guidebookLimit).toBe(15);
    expect(PLAN_CONFIGS.pro.guidebookLimit).toBe(50);
    expect(PLAN_CONFIGS.free.viewsPerMonth).toBe(30);
    expect(PLAN_CONFIGS.starter.viewsPerMonth).toBeNull();
    expect([5, 15, 39]).toEqual([PLAN_CONFIGS.starter.priceUsd, PLAN_CONFIGS.power.priceUsd, PLAN_CONFIGS.pro.priceUsd]);
    // old stored names keep working
    expect([normalizePlan("trial"), normalizePlan("growth"), normalizePlan("enterprise"), normalizePlan(null), normalizePlan("weird")]).toEqual(["free", "power", "pro", "free", "free"]);
  });

  it("reads billing periods from the subscription (old API) or its items (basil+)", () => {
    expect(periodSeconds({ current_period_start: 100, current_period_end: 200 })).toEqual({ start: 100, end: 200 });
    expect(periodSeconds({ items: { data: [{ current_period_start: 300, current_period_end: 400 }] } })).toEqual({ start: 300, end: 400 });
    expect(periodSeconds({})).toEqual({ start: null, end: null });
    expect(periodSeconds(null)).toEqual({ start: null, end: null });
  });
});

describe("createCheckoutSession", () => {
  it("rejects unknown, unpriced, free and enterprise plans", async () => {
    const stripe = fakeStripe();
    for (const plan of ["nope", "enterprise", "trial", "free", 5]) {
      const err = await rejects(createCheckoutSession(db.sql, stripe, user, { plan }, origin), 400);
      expect(err.message).toBe(`Invalid plan: ${plan}`);
    }
    delete process.env.STRIPE_PRO_PRICE_ID;
    await rejects(createCheckoutSession(db.sql, stripe, user, { plan: "pro" }, origin), 400);
    expect(stripe.checkout.sessions.create).not.toHaveBeenCalled();
  });

  it("creates a subscription checkout with metadata, return urls and the coupon", async () => {
    process.env.STRIPE_ACTIVE_COUPON_ID = "coupon_sale";
    const stripe = fakeStripe();
    // "growth" is accepted as the old name of Power
    const result = await createCheckoutSession(db.sql, stripe, user, { plan: "growth" }, origin);
    expect(result).toEqual({ url: "https://checkout.stripe.test/s1" });
    expect(stripe.checkout.sessions.create).toHaveBeenCalledWith({
      mode: "subscription",
      customer_email: "owner@example.com",
      line_items: [{ price: "price_power", quantity: 1 }],
      success_url: "https://app.example.com/dashboard?upgraded=1",
      cancel_url: "https://app.example.com/pricing?canceled=1",
      discounts: [{ coupon: "coupon_sale" }],
      metadata: { user_id: OWNER, plan: "power" },
    });
  });

  it("drops a configured coupon that is expired or unknown instead of failing the checkout", async () => {
    process.env.STRIPE_ACTIVE_COUPON_ID = "coupon_old";
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const expired = fakeStripe({ coupons: { retrieve: vi.fn(async () => ({ valid: false })) } });
    await createCheckoutSession(db.sql, expired, user, { plan: "starter" }, origin);
    expect(expired.checkout.sessions.create).toHaveBeenCalledWith(expect.objectContaining({ discounts: undefined }));
    const missing = fakeStripe({ coupons: { retrieve: vi.fn(async () => { throw new Error("No such coupon"); }) } });
    await createCheckoutSession(db.sql, missing, user, { plan: "starter" }, origin);
    expect(missing.checkout.sessions.create).toHaveBeenCalledWith(expect.objectContaining({ discounts: undefined }));
    warn.mockRestore();
  });

  it("defaults to starter and omits discounts without a coupon", async () => {
    delete process.env.STRIPE_ACTIVE_COUPON_ID;
    const stripe = fakeStripe();
    await createCheckoutSession(db.sql, stripe, user, {}, origin);
    const args = (stripe.checkout.sessions.create as ReturnType<typeof vi.fn>).mock.calls[0][0];
    expect(args.line_items[0].price).toBe("price_starter");
    expect(args.discounts).toBeUndefined();
  });

  it("refuses with 409 when the profile already has a plan, or Stripe has an active subscription", async () => {
    await setPlan(db.sql, OWNER, "starter");
    const e1 = await rejects(createCheckoutSession(db.sql, fakeStripe(), user, { plan: "pro" }, origin), 409);
    expect(e1.extra).toEqual({ redirect: "/dashboard/billing" });

    await db.reset();
    await setPlan(db.sql, OWNER, "free"); // "free" is not a paid plan, so it falls through to the Stripe check
    const stripe = fakeStripe({
      customers: { list: vi.fn(async () => ({ data: [{ id: "cus_1" }] })) },
      subscriptions: { list: vi.fn(async () => ({ data: [{ id: "sub_1" }] })), retrieve: vi.fn() },
    });
    const e2 = await rejects(createCheckoutSession(db.sql, stripe, user, { plan: "pro" }, origin), 409);
    expect(e2.message).toBe("An active subscription already exists");
  });

  it("ignores failures of the pre-checks and reports Stripe errors as 500", async () => {
    const flaky = fakeStripe({ customers: { list: vi.fn(async () => { throw new Error("stripe down"); }) } });
    expect((await createCheckoutSession(db.sql, flaky, user, { plan: "pro" }, origin)).url).toBe("https://checkout.stripe.test/s1");
    const failing = fakeStripe({ checkout: { sessions: { create: vi.fn(async () => { throw new Error("card_declined_ish"); }) } } });
    const err = await rejects(createCheckoutSession(db.sql, failing, user, { plan: "pro" }, origin), 500);
    expect(err.message).toBe("card_declined_ish");
  });
});

describe("billingSummary", () => {
  it("defaults to the free plan for users without a profile", async () => {
    const out = await billingSummary(db.sql, null, user);
    expect(out).toMatchObject({
      plan: "free", plan_display: "Free", guidebook_limit: null, guidebook_count: 0,
      can_create_more: true, views_used: 0, views_limit: 30, ai_used: 0, ai_limit: 3,
      features: { all_pdf_templates: false, print_pdf: false, analytics: false },
      stripe: { customer_id: null, subscription: null, invoices: [] },
    });
  });

  it("reports limits, usage and Stripe details (including basil-style period dates)", async () => {
    await setPlan(db.sql, OWNER, "power");
    const [{ id: propertyId }] = await db.sql`insert into property (name, user_id) values ('P', ${OWNER}) returning id`;
    await db.sql`insert into guidebook (id, property_id, user_id, template_key) values ('g1', ${propertyId}, ${OWNER}, 'template_original'), ('g2', ${propertyId}, ${OWNER}, 'template_original')`;
    const stripe = fakeStripe({
      customers: { list: vi.fn(async () => ({ data: [{ id: "cus_9" }] })) },
      subscriptions: { list: vi.fn(async () => ({ data: [{ id: "sub_9", status: "active", items: { data: [{ current_period_end: 1900000000 }] } }] })), retrieve: vi.fn() },
      invoices: { list: vi.fn(async () => ({ data: [{ id: "in_1", status: "paid", amount_paid: 1999, created: 1700000000, hosted_invoice_url: "https://inv" }] })) },
    });
    const out = await billingSummary(db.sql, stripe, user);
    expect(out).toMatchObject({
      plan: "power", guidebook_limit: 15, guidebook_count: 2, can_create_more: true, plan_display: "Power",
      price_usd: 15, views_limit: null, ai_limit: 50, features: { all_pdf_templates: true, print_pdf: true, analytics: true },
    });
    expect(out.stripe).toEqual({
      customer_id: "cus_9",
      subscription: { id: "sub_9", status: "active", current_period_end: 1900000000 },
      invoices: [{ id: "in_1", status: "paid", amount_paid: 1999, created: 1700000000, hosted_invoice_url: "https://inv" }],
    });
  });

  it("maps old plan names, reports caps and usage, and survives Stripe failures", async () => {
    await setPlan(db.sql, OWNER, "enterprise");
    expect(await billingSummary(db.sql, null, user)).toMatchObject({ plan: "pro", guidebook_limit: 50, can_create_more: true });
    await setPlan(db.sql, OWNER, "growth");
    expect(await billingSummary(db.sql, null, user)).toMatchObject({ plan: "power", guidebook_limit: 15 });
    await setPlan(db.sql, OWNER, "starter");
    const [{ id: propertyId }] = await db.sql`insert into property (name, user_id) values ('P', ${OWNER}) returning id`;
    for (let i = 0; i < 3; i++) await db.sql`insert into guidebook (id, property_id, user_id, template_key) values (${`c${i}`}, ${propertyId}, ${OWNER}, 'template_original')`;
    await db.sql`insert into guidebook_view_daily (guidebook_id, user_id, day, views) values ('c0', ${OWNER}, (now() at time zone 'utc')::date, 7)`;
    await db.sql`insert into ai_usage_monthly (user_id, month, used) values (${OWNER}, date_trunc('month', now() at time zone 'utc')::date, 4)`;
    expect(await billingSummary(db.sql, null, user)).toMatchObject({
      plan: "starter", guidebook_limit: 3, guidebook_count: 3, can_create_more: false, views_used: 7, views_limit: null, ai_used: 4, ai_limit: 15,
    });
    await setPlan(db.sql, OWNER, "trial", 7);
    expect(await billingSummary(db.sql, null, user)).toMatchObject({ plan: "free", plan_display: "Free" });
    const broken = fakeStripe({ customers: { list: vi.fn(async () => { throw new Error("nope"); }) } });
    const out = await billingSummary(db.sql, broken, user);
    expect(out.plan).toBe("free");
    expect(out.stripe).toEqual({ customer_id: null, subscription: null, invoices: [] });
  });
});

describe("createPortalSession", () => {
  it("never trusts an email from the request, and never picks an arbitrary customer", async () => {
    const stripe = fakeStripe();
    await rejects(createPortalSession(db.sql, stripe, { id: OWNER, email: null }, origin), 404);
    expect(stripe.customers.list).not.toHaveBeenCalled();
    // the route ignores an email in the body
    setStripeForTests(stripe);
    const res = await portalRoute(new Request("http://x/api/billing/create-portal-session", {
      method: "POST", headers: { Authorization: "Bearer noemail", "Content-Type": "application/json" }, body: JSON.stringify({ email: "victim@example.com" }),
    }));
    expect(res.status).toBe(404);
    expect(stripe.customers.list).not.toHaveBeenCalled();
  });

  it("prefers the customer checkout stored on the profile", async () => {
    await db.sql`insert into public.profiles (user_id, plan, stripe_customer_id) values (${OWNER}::uuid, 'pro', 'cus_stored')`;
    const stripe = fakeStripe({ customers: { list: vi.fn(async () => ({ data: [{ id: "cus_email" }] })) } });
    await createPortalSession(db.sql, stripe, user, origin);
    expect(stripe.customers.list).not.toHaveBeenCalled();
    expect(stripe.billingPortal.sessions.create).toHaveBeenCalledWith(expect.objectContaining({ customer: "cus_stored" }));
  });

  it("404s without a customer, otherwise opens the portal with the configuration and return url", async () => {
    await rejects(createPortalSession(db.sql, fakeStripe(), user, origin), 404);
    process.env.STRIPE_PORTAL_CONFIGURATION_ID = "bpc_1";
    const stripe = fakeStripe({ customers: { list: vi.fn(async () => ({ data: [{ id: "cus_1" }] })) } });
    expect(await createPortalSession(db.sql, stripe, user, origin)).toEqual({ url: "https://portal.stripe.test/p1" });
    expect(stripe.billingPortal.sessions.create).toHaveBeenCalledWith({
      customer: "cus_1", return_url: "https://app.example.com/dashboard/billing?updated=1", configuration: "bpc_1",
    });
  });
});

const sub = (over: Record<string, unknown> = {}) => ({ id: "sub_1", status: "active", items: { data: [{ current_period_start: 1700000000, current_period_end: 1702592000, price: { id: "price_pro" } }] }, ...over });
const ev = (type: string, object: unknown) => ({ type, data: { object } });

describe("handleStripeEvent", () => {
  it("checkout.session.completed creates the profile with plan, limit, ids and dates", async () => {
    const stripe = fakeStripe({ subscriptions: { retrieve: vi.fn(async () => sub()), list: vi.fn() } });
    await handleStripeEvent(db.sql, stripe, ev("checkout.session.completed", { metadata: { user_id: OWNER, plan: "pro" }, subscription: "sub_1", customer: "cus_1" }));
    const [p] = await db.sql`select * from profiles where user_id = ${OWNER}::uuid`;
    expect(p).toMatchObject({ plan: "pro", guidebook_limit: 50, stripe_customer_id: "cus_1", stripe_subscription_id: "sub_1" });
    expect(p.pro_starts_at.toISOString()).toBe("2023-11-14T22:13:20.000Z");
    expect(p.pro_expires_at.toISOString()).toBe("2023-12-14T22:13:20.000Z");
  });

  it("checkout.session.completed upgrades an existing profile and tolerates a missing subscription", async () => {
    await setPlan(db.sql, OWNER, "free");
    const stripe = fakeStripe({ subscriptions: { retrieve: vi.fn(async () => { throw new Error("No such subscription"); }), list: vi.fn() } });
    await handleStripeEvent(db.sql, stripe, ev("checkout.session.completed", { metadata: { user_id: OWNER, plan: "starter" }, subscription: "sub_x", customer: "cus_x" }));
    const [p] = await db.sql`select * from profiles where user_id = ${OWNER}::uuid`;
    expect(p).toMatchObject({ plan: "starter", guidebook_limit: 3, stripe_subscription_id: "sub_x", pro_starts_at: null });
    expect((await db.sql`select count(*)::int as n from profiles`)[0].n).toBe(1);
  });

  it("checkout.session.completed waits for the payment when it is still unpaid", async () => {
    await handleStripeEvent(db.sql, fakeStripe(), ev("checkout.session.completed", { metadata: { user_id: OWNER, plan: "pro" }, payment_status: "unpaid", subscription: "s", customer: "c" }));
    expect(await db.sql`select * from public.profiles where user_id = ${OWNER}::uuid`).toHaveLength(0);
  });

  it("checkout.session.completed ignores events without a user or with an unknown plan", async () => {
    const stripe = fakeStripe();
    await handleStripeEvent(db.sql, stripe, ev("checkout.session.completed", { metadata: {}, subscription: "s", customer: "c" }));
    await handleStripeEvent(db.sql, stripe, ev("checkout.session.completed", { metadata: { user_id: OWNER, plan: "platinum" }, subscription: "s", customer: "c" }));
    expect((await db.sql`select count(*)::int as n from profiles`)[0].n).toBe(0);
  });

  it("customer.subscription.created only fills in missing dates", async () => {
    await db.sql`insert into profiles (user_id, plan, stripe_subscription_id) values (${OWNER}::uuid, 'starter', 'sub_1')`;
    await handleStripeEvent(db.sql, null, ev("customer.subscription.created", sub()));
    let [p] = await db.sql`select pro_starts_at, pro_expires_at from profiles`;
    expect(p.pro_starts_at.toISOString()).toBe("2023-11-14T22:13:20.000Z");
    // a later event must not overwrite dates that are already set
    await handleStripeEvent(db.sql, null, ev("customer.subscription.created", sub({ items: { data: [{ current_period_start: 1800000000, current_period_end: 1802592000 }] } })));
    [p] = await db.sql`select pro_starts_at from profiles`;
    expect(p.pro_starts_at.toISOString()).toBe("2023-11-14T22:13:20.000Z");
  });

  it("invoice.payment_succeeded refreshes the dates (subscription id on the invoice or under parent)", async () => {
    await db.sql`insert into profiles (user_id, plan, stripe_subscription_id) values (${OWNER}::uuid, 'pro', 'sub_1')`;
    const stripe = fakeStripe({ subscriptions: { retrieve: vi.fn(async () => sub()), list: vi.fn() } });
    await handleStripeEvent(db.sql, stripe, ev("invoice.payment_succeeded", { subscription: "sub_1" }));
    expect((await db.sql`select pro_expires_at from profiles`)[0].pro_expires_at.toISOString()).toBe("2023-12-14T22:13:20.000Z");

    await db.sql`update profiles set pro_expires_at = null, pro_starts_at = null`;
    await handleStripeEvent(db.sql, stripe, ev("invoice.payment_succeeded", { parent: { subscription_details: { subscription: "sub_1" } } }));
    expect((await db.sql`select pro_expires_at from profiles`)[0].pro_expires_at).not.toBeNull();
    expect(stripe.subscriptions.retrieve).toHaveBeenCalledTimes(2);
  });

  it("invoice.payment_failed changes nothing (the customer keeps access while Stripe retries)", async () => {
    await setPlan(db.sql, OWNER, "pro");
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    await handleStripeEvent(db.sql, fakeStripe(), ev("invoice.payment_failed", { subscription: "sub_1" }));
    warn.mockRestore();
    expect((await db.sql`select plan from profiles`)[0].plan).toBe("pro");
  });

  it("subscription deleted, or canceled/unpaid/past_due, returns to the free plan and leaves guidebooks untouched", async () => {
    for (const [type, status] of [["customer.subscription.deleted", "canceled"], ["customer.subscription.updated", "past_due"], ["customer.subscription.updated", "unpaid"], ["customer.subscription.updated", "canceled"]]) {
      await db.reset();
      await db.sql`insert into profiles (user_id, plan, guidebook_limit, stripe_subscription_id) values (${OWNER}::uuid, 'pro', 10, 'sub_1'), (${OTHER}::uuid, 'pro', 10, 'sub_other')`;
      const [{ id: pid }] = await db.sql`insert into property (name, user_id) values ('P', ${OWNER}) returning id`;
      await db.sql`insert into guidebook (id, property_id, user_id, template_key) values ('mine1', ${pid}, ${OWNER}, 'template_original'), ('mine2', ${pid}, ${OWNER}, 'template_original'), ('theirs', ${pid}, ${OTHER}, 'template_original')`;
      await handleStripeEvent(db.sql, null, ev(type, sub({ status })));
      expect((await db.sql`select plan, guidebook_limit from profiles where user_id = ${OWNER}::uuid`)[0]).toEqual({ plan: "free", guidebook_limit: null });
      expect((await db.sql`select plan from profiles where user_id = ${OTHER}::uuid`)[0].plan).toBe("pro");
      expect((await db.sql`select id from guidebook order by id`).map((r) => r.id)).toEqual(["mine1", "mine2", "theirs"]);
    }
  });

  it("an unknown subscription id changes nothing on cancellation", async () => {
    await setPlan(db.sql, OWNER, "pro");
    await handleStripeEvent(db.sql, null, ev("customer.subscription.deleted", sub({ id: "sub_unknown" })));
    expect((await db.sql`select plan from profiles`)[0].plan).toBe("pro");
  });

  it("subscription.updated (active) switches the plan by price id and keeps existing dates when none are sent", async () => {
    await db.sql`insert into profiles (user_id, plan, guidebook_limit, stripe_subscription_id, pro_starts_at, pro_expires_at)
                 values (${OWNER}::uuid, 'starter', 5, 'sub_1', '2023-01-01T00:00:00Z', '2023-02-01T00:00:00Z')`;
    await handleStripeEvent(db.sql, null, ev("customer.subscription.updated", sub({ items: { data: [{ price: { id: "price_power" } }] } })));
    let [p] = await db.sql`select * from profiles`;
    expect(p).toMatchObject({ plan: "power", guidebook_limit: 15 });
    expect(p.pro_expires_at.toISOString()).toBe("2023-02-01T00:00:00.000Z"); // no dates in the event: kept
    await handleStripeEvent(db.sql, null, ev("customer.subscription.updated", sub()));
    [p] = await db.sql`select * from profiles`;
    expect(p).toMatchObject({ plan: "pro", guidebook_limit: 50 });
    expect(p.pro_expires_at.toISOString()).toBe("2023-12-14T22:13:20.000Z");
  });

  it("subscription.updated with an unknown price or no items changes nothing", async () => {
    await db.sql`insert into profiles (user_id, plan, guidebook_limit, stripe_subscription_id) values (${OWNER}::uuid, 'starter', 1, 'sub_1')`;
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    await handleStripeEvent(db.sql, null, ev("customer.subscription.updated", sub({ items: { data: [{ price: { id: "price_mystery" } }] } })));
    await handleStripeEvent(db.sql, null, ev("customer.subscription.updated", sub({ items: { data: [] } })));
    await handleStripeEvent(db.sql, null, ev("customer.created", {}));
    warn.mockRestore();
    expect((await db.sql`select plan from profiles`)[0].plan).toBe("starter");
  });
});

describe("webhook route (real Stripe signature verification)", () => {
  const SECRET = "whsec_test_secret";
  const stripeForSigning = new Stripe("sk_test_unused");
  const body = JSON.stringify({
    id: "evt_1", object: "event", type: "checkout.session.completed",
    data: { object: { metadata: { user_id: OWNER, plan: "starter" }, subscription: null, customer: "cus_route" } },
  });
  const signed = (payload: string, secret = SECRET) => stripeForSigning.webhooks.generateTestHeaderString({ payload, secret });
  const post = (payload: string, headers: Record<string, string> = {}) =>
    webhookRoute(new Request("http://localhost/webhooks/stripe", { method: "POST", body: payload, headers }));

  it("accepts a correctly signed event and applies it", async () => {
    process.env.STRIPE_WEBHOOK_SECRET = SECRET;
    const res = await post(body, { "stripe-signature": signed(body) });
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ok: true });
    expect((await db.sql`select plan, stripe_customer_id from profiles where user_id = ${OWNER}::uuid`)[0]).toEqual({ plan: "starter", stripe_customer_id: "cus_route" });
  });

  it("rejects missing, tampered and wrongly signed payloads with 400 and changes nothing", async () => {
    process.env.STRIPE_WEBHOOK_SECRET = SECRET;
    const badHeaders: Record<string, string>[] = [{}, { "stripe-signature": signed(body, "whsec_other") }, { "stripe-signature": "t=1,v1=deadbeef" }];
    for (const headers of badHeaders) {
      const res = await post(body, headers);
      expect(res.status).toBe(400);
      expect(((await res.json()) as { error: string }).error).toMatch(/^Webhook error:/);
    }
    const tampered = await post(body.replace("starter", "pro"), { "stripe-signature": signed(body) });
    expect(tampered.status).toBe(400);
    expect((await db.sql`select count(*)::int as n from profiles`)[0].n).toBe(0);
  });

  it("answers 503 when no secret or database is configured", async () => {
    delete process.env.STRIPE_WEBHOOK_SECRET;
    expect((await post(body, { "stripe-signature": signed(body) })).status).toBe(503);
    process.env.STRIPE_WEBHOOK_SECRET = SECRET;
    setSqlForTests(null);
    expect((await post(body, { "stripe-signature": signed(body) })).status).toBe(503);
  });

  it("answers 500 (so Stripe retries) when processing fails after a valid signature", async () => {
    process.env.STRIPE_WEBHOOK_SECRET = SECRET;
    await db.sql.unsafe(`create or replace function boom() returns trigger language plpgsql as $$ begin raise exception 'boom'; end $$;
                         create trigger profiles_boom before insert on profiles for each row execute function boom();`);
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    try {
      const res = await post(body, { "stripe-signature": signed(body) });
      expect(res.status).toBe(500);
    } finally {
      spy.mockRestore();
      await db.sql.unsafe("drop trigger profiles_boom on profiles; drop function boom();");
    }
  });
});

describe("billing routes", () => {
  const call = (route: (r: Request) => Promise<Response>, method: string, path: string, who: string | null = "owner", body?: unknown) =>
    route(new Request(`http://localhost${path}`, {
      method,
      headers: { ...(who ? { Authorization: `Bearer ${who}` } : {}), "Content-Type": "application/json" },
      body: body === undefined ? undefined : JSON.stringify(body),
    }));

  it("answer 503 for checkout and portal until Stripe is configured", async () => {
    setStripeForTests(null);
    for (const [route, method, path] of [[checkoutRoute, "POST", "/api/billing/create-checkout-session"], [portalRoute, "POST", "/api/billing/create-portal-session"]] as const) {
      expect((await call(route, method, path)).status).toBe(503);
    }
  });

  it("serves the billing summary without Stripe, minus subscription and invoices", async () => {
    setStripeForTests(null);
    const res = await call(summaryRoute, "GET", "/api/billing/summary");
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.plan).toBe("free");
    expect(json.stripe.invoices).toEqual([]);
  });

  it("require authentication", async () => {
    setStripeForTests(fakeStripe());
    for (const [route, method, path] of [[checkoutRoute, "POST", "/api/billing/create-checkout-session"], [portalRoute, "POST", "/api/billing/create-portal-session"], [summaryRoute, "GET", "/api/billing/summary"]] as const) {
      const res = await call(route, method, path, null);
      expect(res.status).toBe(401);
    }
  });

  it("checkout: returns the session url, and the 400/409 errors with their payloads", async () => {
    setStripeForTests(fakeStripe());
    const ok = await call(checkoutRoute, "POST", "/api/billing/create-checkout-session", "owner", { plan: "pro" });
    expect(ok.status).toBe(200);
    expect(await ok.json()).toEqual({ url: "https://checkout.stripe.test/s1" });
    const bad = await call(checkoutRoute, "POST", "/api/billing/create-checkout-session", "owner", { plan: "enterprise" });
    expect(bad.status).toBe(400);
    expect(await bad.json()).toEqual({ error: "Invalid plan: enterprise" });
    await setPlan(db.sql, OWNER, "pro");
    const dup = await call(checkoutRoute, "POST", "/api/billing/create-checkout-session", "owner", { plan: "growth" });
    expect(dup.status).toBe(409);
    expect(await dup.json()).toEqual({ error: "You already have a subscription. Use the billing portal to change plans.", redirect: "/dashboard/billing" });
  });

  it("summary and portal respond with the service results", async () => {
    setStripeForTests(fakeStripe({ customers: { list: vi.fn(async () => ({ data: [{ id: "cus_1" }] })) } }));
    const summary = await (await call(summaryRoute, "GET", "/api/billing/summary")).json() as Record<string, unknown>;
    expect(summary).toMatchObject({ plan: "free", guidebook_limit: null, views_limit: 30, stripe: { customer_id: "cus_1" } });
    const portal = await call(portalRoute, "POST", "/api/billing/create-portal-session");
    expect(await portal.json()).toEqual({ url: "https://portal.stripe.test/p1" });
    const noEmail = await call(portalRoute, "POST", "/api/billing/create-portal-session", "noemail");
    expect(noEmail.status).toBe(404);
  });
});
