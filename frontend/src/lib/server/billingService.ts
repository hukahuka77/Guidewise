import type Stripe from "stripe";
import type { Sql } from "./db";
import { ServiceError } from "./guidebookService";
import { normalizePlan, PLAN_CONFIGS, planForPriceId, planPriceId, PURCHASABLE_PLANS } from "./plans";
import { aiUsage, monthlyViews } from "./usage";

// Billing routes (checkout, portal, summary) and the Stripe webhook.

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

/**
 * The user's Stripe customer: the one checkout recorded on their profile, else the customer with their
 * verified sign-in email. Never an email the browser sent, which would open someone else's billing.
 */
async function findCustomerId(sql: Sql, stripe: Stripe, user: BillingUser): Promise<string | null> {
  try {
    const rows = await sql`select stripe_customer_id from public.profiles where user_id = ${user.id}::uuid`;
    const stored = asString(rows[0]?.stripe_customer_id);
    if (stored) return stored;
  } catch {
    // fall back to the email lookup
  }
  if (!user.email) return null;
  const customers = await stripe.customers.list({ email: user.email, limit: 1 });
  return customers.data[0]?.id ?? null;
}

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
  const requested = body.plan === undefined ? "starter" : body.plan;
  // "growth" is the old name of the Power plan
  const plan = typeof requested === "string" ? normalizePlan(requested) : "";
  const priceId = PURCHASABLE_PLANS.includes(plan) ? planPriceId(plan) : null;
  if (typeof requested !== "string" || !PURCHASABLE_PLANS.includes(plan) || (requested.toLowerCase() !== "growth" && requested.toLowerCase() !== plan) || !priceId) {
    throw new ServiceError(400, `Invalid plan: ${String(requested)}`);
  }

  // Already subscribed according to our database?
  try {
    const rows = await sql`select plan from public.profiles where user_id = ${user.id}::uuid`;
    const current = rows[0]?.plan as string | undefined;
    if (current && PURCHASABLE_PLANS.includes(normalizePlan(current))) {
      throw new ServiceError(409, "You already have a subscription. Use the billing portal to change plans.", {
        redirect: "/dashboard/billing",
      });
    }
  } catch (error) {
    if (error instanceof ServiceError) throw error;
  }

  // ...or according to Stripe? Any subscription that hasn't ended counts (one being retried after a
  // failed payment too), so nobody ends up paying for two.
  let customerId: string | null = null;
  try {
    customerId = await findCustomerId(sql, stripe, user);
    if (customerId) {
      const subs = await stripe.subscriptions.list({ customer: customerId, status: "all", limit: 10 });
      if (subs.data.some((sub) => !ENDED_STATUSES.includes(sub.status))) {
        throw new ServiceError(409, "You already have a subscription. Use the billing portal to change plans.", { redirect: "/dashboard/billing" });
      }
    }
  } catch (error) {
    if (error instanceof ServiceError) throw error;
  }

  try {
    // A coupon left configured after its campaign ended would make Stripe reject every checkout
    let coupon = process.env.STRIPE_ACTIVE_COUPON_ID;
    if (coupon) {
      try {
        if (!(await stripe.coupons.retrieve(coupon)).valid) coupon = undefined;
      } catch {
        coupon = undefined;
      }
      if (!coupon) console.warn("STRIPE_ACTIVE_COUPON_ID is not a valid coupon; creating checkout without a discount");
    }
    const session = await stripe.checkout.sessions.create({
      mode: "subscription",
      // The existing customer keeps every subscription in one billing portal
      ...(customerId ? { customer: customerId } : { customer_email: user.email ?? undefined }),
      line_items: [{ price: priceId, quantity: 1 }],
      success_url: `${origin}/dashboard?upgraded=1`,
      cancel_url: `${origin}/pricing?canceled=1`,
      discounts: coupon ? [{ coupon }] : undefined,
      metadata: { user_id: user.id, plan },
    });
    return { url: session.url };
  } catch (error) {
    console.error("Stripe checkout failed", error);
    throw new ServiceError(500, "Couldn't start checkout. Please try again.");
  }
}

// ---------------------------------------------------------------------------------------------
// Summary
// ---------------------------------------------------------------------------------------------

export async function billingSummary(sql: Sql, stripe: Stripe | null, user: BillingUser): Promise<Dict> {
  let planKey = "free";
  try {
    const rows = await sql`select plan from public.profiles where user_id = ${user.id}::uuid`;
    planKey = normalizePlan(rows[0]?.plan);
  } catch {
    planKey = "free";
  }
  const plan = PLAN_CONFIGS[planKey];

  const [counts] = await sql`
    select count(*)::int as total from guidebook where user_id = ${user.id}`;
  const viewsUsed = await monthlyViews(sql, user.id).catch(() => 0);
  const aiUsed = await aiUsage(sql, user.id).catch(() => 0);

  const stripeInfo: { customer_id: string | null; subscription: Dict | null; invoices: Dict[] } = {
    customer_id: null,
    subscription: null,
    invoices: [],
  };

  if (stripe) {
    try {
      const customerId = await findCustomerId(sql, stripe, user);
      if (customerId) {
        stripeInfo.customer_id = customerId;

        const subs = await stripe.subscriptions.list({ customer: customerId, status: "active", limit: 1 });
        if (subs.data.length > 0) {
          const sub = subs.data[0];
          stripeInfo.subscription = { id: sub.id, status: sub.status, current_period_end: periodSeconds(sub).end };
        }

        const invoices = await stripe.invoices.list({ customer: customerId, limit: 10 });
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
    plan: planKey,
    plan_display: plan.name,
    price_usd: plan.priceUsd,
    guidebook_limit: plan.guidebookLimit,
    guidebook_count: counts.total,
    can_create_more: plan.guidebookLimit === null || counts.total < plan.guidebookLimit,
    views_used: viewsUsed,
    views_limit: plan.viewsPerMonth,
    ai_used: aiUsed,
    ai_limit: plan.aiPerMonth,
    features: {
      all_pdf_templates: plan.pdfTemplates === null,
      print_pdf: plan.printPdf,
      analytics: plan.analytics,
      premium_styles: plan.premiumStyles,
    },
    stripe: stripeInfo,
  };
}

// ---------------------------------------------------------------------------------------------
// Customer portal
// ---------------------------------------------------------------------------------------------

export async function createPortalSession(sql: Sql, stripe: Stripe, user: BillingUser, origin: string): Promise<{ url: string }> {
  try {
    const customerId = await findCustomerId(sql, stripe, user);
    if (!customerId) throw new ServiceError(404, "No Stripe customer found");
    const portal = await stripe.billingPortal.sessions.create({
      customer: customerId,
      return_url: `${origin}/dashboard/billing?updated=1`,
      ...(process.env.STRIPE_PORTAL_CONFIGURATION_ID ? { configuration: process.env.STRIPE_PORTAL_CONFIGURATION_ID } : {}),
    });
    return { url: portal.url };
  } catch (error) {
    if (error instanceof ServiceError) throw error;
    console.error("Stripe billing portal failed", error);
    throw new ServiceError(500, "Couldn't open the billing portal. Please try again.");
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

/** Subscription statuses that mean it is over: the account goes back to Free. */
export const ENDED_STATUSES: string[] = ["canceled", "unpaid", "incomplete_expired", "paused"];

/** The plan a subscription item's price sells: current prices by env, older ones by the plan in their metadata. */
export function planForPrice(price: Dict): string | null {
  const byEnv = planForPriceId(asString(price.id));
  if (byEnv) return byEnv;
  const tagged = normalizePlan(asDict(price.metadata).plan);
  return PURCHASABLE_PLANS.includes(tagged) ? tagged : null;
}

async function fetchSubscriptionDates(stripe: Stripe, subscriptionId: string) {
  try {
    const subscription = await stripe.subscriptions.retrieve(subscriptionId);
    const { start, end } = periodSeconds(subscription);
    return { starts: toDate(start), expires: toDate(end), status: subscription.status as string };
  } catch (error) {
    // Not created yet, or a transient failure: later events fill the dates in.
    console.warn(`could not fetch subscription ${subscriptionId}: ${message(error)}`);
    return { starts: null, expires: null, status: null };
  }
}

/** Apply one verified Stripe event to the database. Throws on database errors. */
export async function handleStripeEvent(sql: Sql, stripe: Stripe | null, event: { type: string; data: { object: unknown } }) {
  const obj = asDict(event.data.object);

  switch (event.type) {
    case "checkout.session.completed":
    case "checkout.session.async_payment_succeeded": {
      const metadata = asDict(obj.metadata);
      const userId = asString(metadata.user_id);
      const plan = normalizePlan(asString(metadata.plan) || "starter");
      const subscriptionId = asString(obj.subscription);
      const customerId = asString(obj.customer);
      if (!userId || !PURCHASABLE_PLANS.includes(plan)) return;
      // Delayed payment methods complete the session before the money arrives
      if (obj.payment_status === "unpaid") return;

      const limit = PLAN_CONFIGS[plan].guidebookLimit;
      const dates = subscriptionId && stripe ? await fetchSubscriptionDates(stripe, subscriptionId) : { starts: null, expires: null, status: null };
      // A late retry of this event must not bring back a subscription that has since ended
      if (dates.status && ENDED_STATUSES.includes(dates.status)) return;
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
      if (!subscriptionId) return;
      // Events can arrive out of order or late, so act on the subscription as it is now
      let sub = obj;
      if (event.type === "customer.subscription.updated" && stripe) {
        try {
          sub = asDict(await stripe.subscriptions.retrieve(subscriptionId));
        } catch (error) {
          console.warn(`could not fetch subscription ${subscriptionId}; using the event: ${message(error)}`);
        }
      }
      const status = asString(sub.status);

      if (event.type === "customer.subscription.deleted" || (status && ENDED_STATUSES.includes(status))) {
        // Back to the free plan. Guidebooks stay (beyond Free's one, they're paused for guests).
        await sql`update public.profiles set plan = 'free', guidebook_limit = null where stripe_subscription_id = ${subscriptionId}`;
        return;
      }

      // past_due: Stripe is retrying the payment, and the customer keeps their plan meanwhile
      if (status === "active" || status === "trialing") {
        // Plan change (upgrade/downgrade): map the price back to a plan
        const item = asDict(asList(asDict(sub.items).data)[0]);
        const price = asDict(item.price);
        if (!asString(price.id)) return;
        const newPlan = planForPrice(price);
        if (!newPlan) {
          console.warn(`Could not map price ${asString(price.id)} to a plan`);
          return;
        }
        const { start, end } = periodSeconds(sub);
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
