import type Stripe from "stripe";
import type { Sql } from "./db";
import { ServiceError } from "./guidebookService";
import { PLAN_CONFIGS, planForPriceId, planPriceId } from "./plans";

// Port of the billing routes and the Stripe webhook in backend/app.py.

type Dict = Record<string, unknown>;
const asDict = (v: unknown): Dict => (typeof v === "object" && v !== null && !Array.isArray(v) ? (v as Dict) : {});
const asList = (v: unknown): unknown[] => (Array.isArray(v) ? v : []);
const asNumber = (v: unknown): number | null => (typeof v === "number" && Number.isFinite(v) ? v : null);
const asString = (v: unknown): string | null => (typeof v === "string" && v ? v : null);
const message = (e: unknown) => (e instanceof Error ? e.message : String(e));

export interface BillingUser {
  id: string;
  email: string | null;
}

/**
 * Billing period of a subscription as unix seconds. Stripe API versions from "basil" on moved
 * `current_period_*` from the subscription onto its items, so read both places.
 */
export function periodSeconds(subscription: unknown): { start: number | null; end: number | null } {
  const sub = asDict(subscription);
  const item = asDict(asList(asDict(sub.items).data)[0]);
  const end = asNumber(sub.current_period_end) || asNumber(item.current_period_end) || null;
  const start = asNumber(sub.current_period_start) || asNumber(item.current_period_start) || null;
  return { start, end };
}

const toDate = (seconds: number | null) => (seconds ? new Date(seconds * 1000) : null);

// ---------------------------------------------------------------------------------------------
// Checkout
// ---------------------------------------------------------------------------------------------

export async function createCheckoutSession(
  sql: Sql,
  stripe: Stripe,
  user: BillingUser,
  body: Dict,
  origin: string,
): Promise<{ url: string | null }> {
  const plan = body.plan === undefined ? "starter" : body.plan;
  const priceId = typeof plan === "string" && plan in PLAN_CONFIGS ? planPriceId(plan) : null;
  if (typeof plan !== "string" || !(plan in PLAN_CONFIGS) || !priceId) {
    throw new ServiceError(400, `Invalid plan: ${String(plan)}`);
  }

  // Already subscribed according to our database?
  try {
    const rows = await sql`select plan from public.profiles where user_id = ${user.id}::uuid`;
    const current = rows[0]?.plan as string | undefined;
    if (current && current in PLAN_CONFIGS) {
      throw new ServiceError(409, "You already have a subscription. Use the billing portal to change plans.", {
        redirect: "/dashboard/billing",
      });
    }
  } catch (error) {
    if (error instanceof ServiceError) throw error;
  }

  // ...or according to Stripe?
  try {
    if (user.email) {
      const customers = await stripe.customers.list({ email: user.email, limit: 1 });
      if (customers.data.length > 0) {
        const subs = await stripe.subscriptions.list({ customer: customers.data[0].id, status: "active", limit: 1 });
        if (subs.data.length > 0) {
          throw new ServiceError(409, "An active subscription already exists", { redirect: "/dashboard/billing" });
        }
      }
    }
  } catch (error) {
    if (error instanceof ServiceError) throw error;
  }

  try {
    const coupon = process.env.STRIPE_ACTIVE_COUPON_ID;
    const session = await stripe.checkout.sessions.create({
      mode: "subscription",
      customer_email: user.email ?? undefined,
      line_items: [{ price: priceId, quantity: 1 }],
      success_url: `${origin}/dashboard?upgraded=1`,
      cancel_url: `${origin}/pricing?canceled=1`,
      discounts: coupon ? [{ coupon }] : undefined,
      metadata: { user_id: user.id, plan },
    });
    return { url: session.url };
  } catch (error) {
    throw new ServiceError(500, message(error));
  }
}

// ---------------------------------------------------------------------------------------------
// Summary
// ---------------------------------------------------------------------------------------------

export async function billingSummary(sql: Sql, stripe: Stripe | null, user: BillingUser): Promise<Dict> {
  let plan = "trial";
  let limit: number | null = 0;
  try {
    const rows = await sql`select plan, guidebook_limit from public.profiles where user_id = ${user.id}::uuid`;
    const row = rows[0];
    plan = (row?.plan as string | undefined) || "trial";
    limit = plan in PLAN_CONFIGS ? PLAN_CONFIGS[plan].guidebookLimit : (row?.guidebook_limit ?? 0);
  } catch {
    plan = "trial";
    limit = 0;
  }

  const [{ count }] = await sql`select count(*)::int as count from guidebook where user_id = ${user.id} and active = true`;
  const activeCount = (count as number) || 0;

  const stripeInfo: { customer_id: string | null; subscription: Dict | null; invoices: Dict[] } = {
    customer_id: null,
    subscription: null,
    invoices: [],
  };

  if (stripe && user.email) {
    try {
      const customers = await stripe.customers.list({ email: user.email, limit: 1 });
      if (customers.data.length > 0) {
        const customer = customers.data[0];
        stripeInfo.customer_id = customer.id;

        const subs = await stripe.subscriptions.list({ customer: customer.id, status: "active", limit: 1 });
        if (subs.data.length > 0) {
          const sub = subs.data[0];
          stripeInfo.subscription = { id: sub.id, status: sub.status, current_period_end: periodSeconds(sub).end };
        }

        const invoices = await stripe.invoices.list({ customer: customer.id, limit: 10 });
        stripeInfo.invoices = invoices.data.map((inv) => ({
          id: inv.id,
          status: inv.status,
          amount_paid: inv.amount_paid,
          created: inv.created,
          hosted_invoice_url: inv.hosted_invoice_url,
        }));
      }
    } catch {
      // Stripe details are optional; the plan summary still works without them.
    }
  }

  return {
    plan,
    guidebook_limit: limit,
    active_guidebooks: activeCount,
    can_activate_more: limit === null || activeCount < limit,
    plan_display: PLAN_CONFIGS[plan]?.name ?? "Trial",
    stripe: stripeInfo,
  };
}

// ---------------------------------------------------------------------------------------------
// Customer portal
// ---------------------------------------------------------------------------------------------

export async function createPortalSession(
  stripe: Stripe,
  user: BillingUser,
  body: Dict,
  origin: string,
): Promise<{ url: string }> {
  const email = user.email || asString(body.email);
  // Without an email, customers.list would return an arbitrary customer from the account.
  if (!email) throw new ServiceError(400, "No email available for this account");
  try {
    const customers = await stripe.customers.list({ email, limit: 1 });
    if (customers.data.length === 0) throw new ServiceError(404, "No Stripe customer found");
    const portal = await stripe.billingPortal.sessions.create({
      customer: customers.data[0].id,
      return_url: `${origin}/dashboard/billing?updated=1`,
      ...(process.env.STRIPE_PORTAL_CONFIGURATION_ID ? { configuration: process.env.STRIPE_PORTAL_CONFIGURATION_ID } : {}),
    });
    return { url: portal.url };
  } catch (error) {
    if (error instanceof ServiceError) throw error;
    throw new ServiceError(500, message(error));
  }
}

// ---------------------------------------------------------------------------------------------
// Webhook events
// ---------------------------------------------------------------------------------------------

/** Subscription id on an invoice: top-level on older API versions, under `parent` from "basil" on. */
function invoiceSubscriptionId(invoice: Dict): string | null {
  return (
    asString(invoice.subscription) ||
    asString(asDict(asDict(invoice.parent).subscription_details).subscription) ||
    null
  );
}

async function fetchSubscriptionDates(stripe: Stripe, subscriptionId: string) {
  try {
    const subscription = await stripe.subscriptions.retrieve(subscriptionId);
    const { start, end } = periodSeconds(subscription);
    return { starts: toDate(start), expires: toDate(end) };
  } catch (error) {
    // Not created yet, or a transient failure: later events fill the dates in.
    console.warn(`could not fetch subscription ${subscriptionId}: ${message(error)}`);
    return { starts: null, expires: null };
  }
}

/** Apply one verified Stripe event to the database. Throws on database errors. */
export async function handleStripeEvent(sql: Sql, stripe: Stripe | null, event: { type: string; data: { object: unknown } }) {
  const obj = asDict(event.data.object);

  switch (event.type) {
    case "checkout.session.completed": {
      const metadata = asDict(obj.metadata);
      const userId = asString(metadata.user_id);
      const plan = asString(metadata.plan) || "starter";
      const subscriptionId = asString(obj.subscription);
      const customerId = asString(obj.customer);
      if (!userId || !(plan in PLAN_CONFIGS)) return;

      const limit = PLAN_CONFIGS[plan].guidebookLimit;
      const dates = subscriptionId && stripe ? await fetchSubscriptionDates(stripe, subscriptionId) : { starts: null, expires: null };
      await sql`
        insert into public.profiles (user_id, plan, guidebook_limit, stripe_customer_id, stripe_subscription_id, pro_starts_at, pro_expires_at)
        values (${userId}::uuid, ${plan}, ${limit}, ${customerId}, ${subscriptionId}, ${dates.starts}, ${dates.expires})
        on conflict (user_id) do update set
          plan = excluded.plan,
          guidebook_limit = excluded.guidebook_limit,
          stripe_customer_id = excluded.stripe_customer_id,
          stripe_subscription_id = excluded.stripe_subscription_id,
          pro_starts_at = excluded.pro_starts_at,
          pro_expires_at = excluded.pro_expires_at`;
      return;
    }

    case "customer.subscription.created": {
      const subscriptionId = asString(obj.id);
      const { start, end } = periodSeconds(obj);
      if (subscriptionId && start && end) {
        await sql`
          update public.profiles set pro_expires_at = ${toDate(end)}, pro_starts_at = ${toDate(start)}
           where stripe_subscription_id = ${subscriptionId} and (pro_starts_at is null or pro_expires_at is null)`;
      }
      return;
    }

    case "invoice.payment_succeeded": {
      const subscriptionId = invoiceSubscriptionId(obj);
      if (!subscriptionId || !stripe) return;
      const dates = await fetchSubscriptionDates(stripe, subscriptionId);
      if (dates.starts && dates.expires) {
        await sql`
          update public.profiles
             set pro_expires_at = ${dates.expires}, pro_starts_at = ${dates.starts}, stripe_subscription_id = ${subscriptionId}
           where stripe_subscription_id = ${subscriptionId}`;
      }
      return;
    }

    case "invoice.payment_failed": {
      // Stripe retries; the customer keeps access until it sends subscription.deleted.
      const subscriptionId = invoiceSubscriptionId(obj);
      if (subscriptionId) console.warn(`Payment failed for subscription ${subscriptionId}. Stripe will retry automatically.`);
      return;
    }

    case "customer.subscription.updated":
    case "customer.subscription.deleted": {
      const subscriptionId = asString(obj.id);
      const status = asString(obj.status);
      if (!subscriptionId) return;

      if (event.type === "customer.subscription.deleted" || (status && ["canceled", "unpaid", "past_due"].includes(status))) {
        // Downgrade to trial and unpublish everything
        await sql.begin(async (tx) => {
          const rows = await tx`select user_id from public.profiles where stripe_subscription_id = ${subscriptionId}`;
          if (rows.length === 0) return;
          const userId = rows[0].user_id as string;
          await tx`update public.profiles set plan = 'trial', guidebook_limit = 0 where user_id = ${userId}::uuid`;
          await tx`update guidebook set active = false where user_id = ${userId}`;
        });
        return;
      }

      if (event.type === "customer.subscription.updated" && status === "active") {
        // Plan change (upgrade/downgrade): map the price back to a plan
        const item = asDict(asList(asDict(obj.items).data)[0]);
        const priceId = asString(asDict(item.price).id);
        if (!priceId) return;
        const newPlan = planForPriceId(priceId);
        if (!newPlan) {
          console.warn(`Could not map price ${priceId} to a plan`);
          return;
        }
        const { start, end } = periodSeconds(obj);
        await sql`
          update public.profiles
             set plan = ${newPlan},
                 guidebook_limit = ${PLAN_CONFIGS[newPlan].guidebookLimit},
                 pro_starts_at = coalesce(${toDate(start)}, pro_starts_at),
                 pro_expires_at = coalesce(${toDate(end)}, pro_expires_at),
                 stripe_subscription_id = ${subscriptionId}
           where stripe_subscription_id = ${subscriptionId}`;
      }
      return;
    }

    default:
      return;
  }
}
