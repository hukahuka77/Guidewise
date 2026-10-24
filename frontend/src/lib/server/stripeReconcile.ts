import type Stripe from "stripe";
import { ENDED_STATUSES, periodSeconds, planForPrice } from "./billingService";
import type { Sql } from "./db";
import { normalizePlan, PLAN_CONFIGS } from "./plans";

// Nightly safety net for the Stripe webhook: if an event never arrived (an outage, a bad deploy), a
// customer could pay and stay on Free, or cancel and keep their plan. This walks every subscription in
// Stripe and brings each linked account's plan in line with it. Stripe is the source of truth; accounts
// with a plan but no Stripe subscription (set by hand) are reported, never changed.

type Dict = Record<string, unknown>;
const asDict = (v: unknown): Dict => (typeof v === "object" && v !== null && !Array.isArray(v) ? (v as Dict) : {});
const asString = (v: unknown): string | null => (typeof v === "string" && v ? v : null);
const toDate = (seconds: number | null) => (seconds ? new Date(seconds * 1000) : null);

export interface ReconcileFix {
  user_id: string;
  subscription: string;
  from: string | null;
  to: string;
  reason: string;
}

export interface ReconcileResult {
  checked: number;
  fixed: ReconcileFix[];
  /** Paying subscriptions we couldn't tie to an account. */
  unmatched: string[];
  /** Accounts on a paid plan without a Stripe subscription (left as they are). */
  manual: number;
}

const PAGE = 100;
const MAX_PAGES = 50;

/** The plan a subscription should give right now; null when its price isn't one we sell (left alone). */
function expectedPlan(sub: Dict): string | null {
  const status = asString(sub.status) ?? "";
  if (ENDED_STATUSES.includes(status)) return "free";
  // past_due keeps the plan while Stripe retries the payment, as the webhook does
  if (!["active", "trialing", "past_due"].includes(status)) return null;
  const price = asDict(asDict((asDict(sub.items).data as unknown[] | undefined)?.[0]).price);
  return planForPrice(price);
}

/** The account a subscription belongs to: from the checkout that created it, else by its Stripe customer. */
async function ownerOf(sql: Sql, stripe: Stripe, sub: Dict): Promise<string | null> {
  const subId = asString(sub.id);
  try {
    const sessions = await stripe.checkout.sessions.list({ subscription: subId ?? undefined, limit: 1 });
    const userId = asString(asDict(sessions.data[0]?.metadata).user_id);
    if (userId) return userId;
  } catch {
    // fall through to the customer
  }
  const customer = asString(sub.customer);
  if (!customer) return null;
  const rows = await sql`select user_id::text as user_id from public.profiles where stripe_customer_id = ${customer} limit 1`;
  return (rows[0]?.user_id as string | undefined) ?? null;
}

async function setPlan(sql: Sql, userId: string, plan: string, sub: Dict) {
  const { start, end } = periodSeconds(sub);
  const paid = plan !== "free";
  await sql`
    insert into public.profiles (user_id, plan, guidebook_limit, stripe_customer_id, stripe_subscription_id, pro_starts_at, pro_expires_at)
    values (${userId}::uuid, ${plan}, ${paid ? PLAN_CONFIGS[plan].guidebookLimit : null}, ${asString(sub.customer)}, ${asString(sub.id)},
            ${paid ? toDate(start) : null}, ${paid ? toDate(end) : null})
    on conflict (user_id) do update set
      plan = excluded.plan,
      guidebook_limit = excluded.guidebook_limit,
      stripe_customer_id = coalesce(excluded.stripe_customer_id, public.profiles.stripe_customer_id),
      stripe_subscription_id = excluded.stripe_subscription_id,
      pro_starts_at = coalesce(excluded.pro_starts_at, public.profiles.pro_starts_at),
      pro_expires_at = coalesce(excluded.pro_expires_at, public.profiles.pro_expires_at)`;
}

export async function reconcileStripe(sql: Sql, stripe: Stripe): Promise<ReconcileResult> {
  const result: ReconcileResult = { checked: 0, fixed: [], unmatched: [], manual: 0 };
  const seen = new Set<string>();
  let startingAfter: string | undefined;

  for (let page = 0; page < MAX_PAGES; page++) {
    const list = await stripe.subscriptions.list({ status: "all", limit: PAGE, ...(startingAfter ? { starting_after: startingAfter } : {}) });
    for (const raw of list.data) {
      const sub = asDict(raw);
      const subId = asString(sub.id);
      if (!subId) continue;
      result.checked++;
      seen.add(subId);
      const want = expectedPlan(sub);
      if (!want) continue;

      const [linked] = await sql`select user_id::text as user_id, plan from public.profiles where stripe_subscription_id = ${subId}`;
      if (linked) {
        const have = normalizePlan(linked.plan);
        if (have !== want) {
          await setPlan(sql, linked.user_id as string, want, sub);
          result.fixed.push({
            user_id: linked.user_id as string, subscription: subId, from: have, to: want,
            reason: want === "free" ? `subscription is ${asString(sub.status)}` : "plan didn't match the subscription",
          });
        }
        continue;
      }

      // Not linked to an account: only a live subscription matters (an old ended one was replaced)
      if (want === "free") continue;
      const owner = await ownerOf(sql, stripe, sub);
      if (!owner) {
        result.unmatched.push(subId);
        continue;
      }
      const [profile] = await sql`select plan, stripe_subscription_id from public.profiles where user_id = ${owner}::uuid`;
      const currentSub = asString(profile?.stripe_subscription_id);
      // The account already runs on another live subscription: report it rather than guess which one counts
      if (currentSub && currentSub !== subId && normalizePlan(profile?.plan) !== "free") {
        result.unmatched.push(subId);
        continue;
      }
      await setPlan(sql, owner, want, sub);
      result.fixed.push({ user_id: owner, subscription: subId, from: profile ? normalizePlan(profile.plan) : null, to: want, reason: "paid but not recorded" });
    }
    if (!list.has_more || list.data.length === 0) break;
    startingAfter = asString(asDict(list.data[list.data.length - 1]).id) ?? undefined;
  }

  const paid = await sql`select stripe_subscription_id from public.profiles where plan not in ('free', 'trial')`;
  result.manual = paid.filter((p) => !p.stripe_subscription_id || !seen.has(p.stripe_subscription_id as string)).length;
  return result;
}
