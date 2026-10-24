import type Stripe from "stripe";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { OTHER, OWNER, startTestDb, type TestDb } from "./helpers/testDb";
import { reconcileStripe } from "../src/lib/server/stripeReconcile";
import { GET as cronRoute } from "../src/app/api/cron/stripe/route";
import { setSqlForTests } from "../src/lib/server/db";
import { setStripeForTests } from "../src/lib/server/stripeClient";

const THIRD = "33333333-3333-4333-8333-cccccccccccc";
const ENV = ["STRIPE_STARTER_PRICE_ID", "STRIPE_POWER_PRICE_ID", "STRIPE_PRO_PRICE_ID", "CRON_SECRET"];
const saved: Record<string, string | undefined> = {};

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
  for (const k of ENV) saved[k] = process.env[k];
  process.env.STRIPE_STARTER_PRICE_ID = "price_starter";
  process.env.STRIPE_POWER_PRICE_ID = "price_power";
  process.env.STRIPE_PRO_PRICE_ID = "price_pro";
  setSqlForTests(db.sql);
  await db.reset();
});
afterEach(() => {
  for (const k of ENV) {
    if (saved[k] === undefined) delete process.env[k];
    else process.env[k] = saved[k];
  }
  setStripeForTests(undefined);
});

const NOW = Math.floor(Date.now() / 1000);
const sub = (id: string, status: string, price: string, customer = `cus_${id}`) => ({
  id, status, customer,
  items: { data: [{ price: { id: price, metadata: {} }, current_period_start: NOW - 86400, current_period_end: NOW + 29 * 86400 }] },
});

function fakeStripe(pages: unknown[][], sessions: Record<string, string> = {}) {
  let call = 0;
  return {
    subscriptions: {
      list: vi.fn(async () => {
        const data = pages[call] ?? [];
        call++;
        return { data, has_more: call < pages.length };
      }),
    },
    checkout: {
      sessions: {
        list: vi.fn(async ({ subscription }: { subscription: string }) => ({
          data: sessions[subscription] ? [{ metadata: { user_id: sessions[subscription] } }] : [],
        })),
      },
    },
  } as unknown as Stripe;
}

const profile = async (userId: string) => (await db.sql`select plan, guidebook_limit, stripe_subscription_id, pro_expires_at from profiles where user_id = ${userId}::uuid`)[0];

describe("nightly Stripe check", () => {
  it("brings every linked account in line with Stripe and reports what it changed", async () => {
    await db.sql`insert into auth.users (id) values (${OWNER}::uuid), (${OTHER}::uuid), (${THIRD}::uuid)`;
    await db.sql`insert into profiles (user_id, plan, stripe_subscription_id, stripe_customer_id) values
      (${OWNER}::uuid, 'pro', 'sub_canceled', 'cus_a'),
      (${OTHER}::uuid, 'starter', 'sub_upgraded', 'cus_b'),
      (${THIRD}::uuid, 'pro', null, null)`; // a plan set by hand: never touched
    const stripe = fakeStripe(
      [
        [sub("sub_canceled", "canceled", "price_pro"), sub("sub_upgraded", "active", "price_power")],
        [sub("sub_retrying", "past_due", "price_starter"), sub("sub_old", "canceled", "price_starter")],
      ],
    );
    const result = await reconcileStripe(db.sql, stripe);
    expect(result.checked).toBe(4);
    expect(result.fixed).toEqual([
      { user_id: OWNER, subscription: "sub_canceled", from: "pro", to: "free", reason: "subscription is canceled" },
      { user_id: OTHER, subscription: "sub_upgraded", from: "starter", to: "power", reason: "plan didn't match the subscription" },
    ]);
    expect(result.unmatched).toEqual(["sub_retrying"]); // live but nobody to give it to
    expect(result.manual).toBe(1);
    expect(await profile(OWNER)).toMatchObject({ plan: "free", guidebook_limit: null });
    expect(await profile(OTHER)).toMatchObject({ plan: "power", guidebook_limit: 15 });
    expect((await profile(OTHER)).pro_expires_at).not.toBeNull();
    expect(await profile(THIRD)).toMatchObject({ plan: "pro" });
    // nothing left to fix on a second run
    expect((await reconcileStripe(db.sql, fakeStripe([[sub("sub_canceled", "canceled", "price_pro"), sub("sub_upgraded", "active", "price_power")]]))).fixed).toEqual([]);
  });

  it("gives a customer who paid but stayed on Free their plan, found through their checkout", async () => {
    await db.sql`insert into auth.users (id) values (${OWNER}::uuid)`;
    const result = await reconcileStripe(db.sql, fakeStripe([[sub("sub_new", "active", "price_starter")]], { sub_new: OWNER }));
    expect(result.fixed).toEqual([{ user_id: OWNER, subscription: "sub_new", from: null, to: "starter", reason: "paid but not recorded" }]);
    expect(await profile(OWNER)).toMatchObject({ plan: "starter", guidebook_limit: 3, stripe_subscription_id: "sub_new" });
  });

  it("doesn't guess when an account already runs on another live subscription", async () => {
    await db.sql`insert into auth.users (id) values (${OWNER}::uuid)`;
    await db.sql`insert into profiles (user_id, plan, stripe_subscription_id) values (${OWNER}::uuid, 'pro', 'sub_main')`;
    const result = await reconcileStripe(db.sql, fakeStripe([[sub("sub_main", "active", "price_pro"), sub("sub_extra", "active", "price_starter")]], { sub_extra: OWNER }));
    expect(result.fixed).toEqual([]);
    expect(result.unmatched).toEqual(["sub_extra"]);
    expect(await profile(OWNER)).toMatchObject({ plan: "pro", stripe_subscription_id: "sub_main" });
  });

  it("the cron route only runs with the cron secret", async () => {
    process.env.CRON_SECRET = "s3cret";
    setStripeForTests(fakeStripe([[]]));
    expect((await cronRoute(new Request("http://x/api/cron/stripe"))).status).toBe(404);
    const ok = await cronRoute(new Request("http://x/api/cron/stripe", { headers: { authorization: "Bearer s3cret" } }));
    expect(ok.status).toBe(200);
    expect(await ok.json()).toEqual({ checked: 0, fixed: [], unmatched: [], manual: 0 });
  });
});
