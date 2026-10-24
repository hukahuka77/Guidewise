import { createHash } from "node:crypto";
import type { Sql } from "./db";
import { ServiceError } from "./guidebookService";
import { normalizePlan, PLAN_CONFIGS, type PlanConfig } from "./plans";
import { clientIp } from "./rateLimit";

// Plan lookups and usage counters (guest views, AI generations, guidebook creation rate).

const isUuid = (v: string) => /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(v);

/** The user's plan; no profile row, an unreadable row or an unknown plan name all mean free. */
export async function getUserPlan(sql: Sql, userId: string): Promise<PlanConfig> {
  if (!isUuid(userId)) return PLAN_CONFIGS.free;
  try {
    const rows = await sql`select plan from public.profiles where user_id = ${userId}::uuid`;
    return PLAN_CONFIGS[normalizePlan(rows[0]?.plan)];
  } catch {
    return PLAN_CONFIGS.free;
  }
}

/** First day of the current month in UTC, as YYYY-MM-DD. */
export function monthStart(now = new Date()): string {
  return `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, "0")}-01`;
}

/** Seconds until the monthly counters reset. */
export function secondsUntilMonthEnd(now = new Date()): number {
  const next = Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1);
  return Math.max(1, Math.ceil((next - now.getTime()) / 1000));
}

// ---------------------------------------------------------------------------------------------
// Guest views
// ---------------------------------------------------------------------------------------------


const BOT_PATTERN =
  /bot|crawl|spider|slurp|preview|facebookexternalhit|whatsapp|telegram|discord|slack|linkedin|pinterest|embedly|curl|wget|python-requests|httpclient|headless|lighthouse|pingdom|uptime|monitor|vercel-screenshot|google-read-aloud|bingpreview|okhttp|axios|node-fetch|go-http-client/i;

/** Requests that should neither count as views nor be blocked by the free-plan limit. */
export function isNonViewRequest(request: Request): boolean {
  if (request.method === "HEAD") return true;
  const purpose = `${request.headers.get("purpose") ?? ""} ${request.headers.get("sec-purpose") ?? ""} ${request.headers.get("x-purpose") ?? ""}`;
  if (/prefetch|prerender|preview/i.test(purpose)) return true;
  const ua = request.headers.get("user-agent") ?? "";
  return ua === "" || BOT_PATTERN.test(ua);
}

/**
 * Salted hash of (visitor IP, guidebook, UTC day): one view per visitor per guidebook per day. The user
 * agent is left out on purpose, since anyone can change it to burn through a free host's views. No raw
 * IP is stored.
 */
export function visitorKey(request: Request, guidebookId: string, now = Date.now()): string {
  const ip = clientIp(request);
  const day = new Date(now).toISOString().slice(0, 10);
  const salt = process.env.VIEW_HASH_SALT || process.env.SUPABASE_SERVICE_ROLE_KEY || "guidewise-views";
  return createHash("sha256").update(`${salt}|${guidebookId}|${ip}|${day}`).digest("hex");
}

export async function monthlyViews(sql: Sql, userId: string): Promise<number> {
  const [row] = await sql`
    select coalesce(sum(views), 0)::int as views from public.guidebook_view_daily
     where user_id = ${userId} and day >= ${monthStart()}::date`;
  return row.views as number;
}

async function purgeOldDedupeKeys(sql: Sql) {
  if (Math.random() > 0.01) return;
  await sql`delete from public.view_dedupe where created_at < now() - interval '1 day'`.catch(() => undefined);
}

/**
 * Record one view unless this visitor already counted within the last half hour.
 * Returns true when a view was added.
 */
export async function recordView(sql: Sql, guidebookId: string, ownerId: string, key: string): Promise<boolean> {
  const inserted = await sql`insert into public.view_dedupe (key) values (${key}) on conflict (key) do nothing returning key`;
  if (inserted.length === 0) return false;
  await sql`
    insert into public.guidebook_view_daily (guidebook_id, user_id, day, views)
    values (${guidebookId}, ${ownerId}, (now() at time zone 'utc')::date, 1)
    on conflict (guidebook_id, day) do update set views = public.guidebook_view_daily.views + 1`;
  void purgeOldDedupeKeys(sql);
  return true;
}

export type ViewDecision =
  | { action: "serve"; cacheable: boolean; beacon: boolean }
  | { action: "blocked"; limit: number };

/**
 * Decide how to serve a live guidebook:
 *  - free owners: every request reaches the server, is counted (deduped), and is blocked once the month's
 *    allowance is used up. Responses are not cached so the limit holds.
 *  - paid owners: unlimited; pages stay CDN-cacheable and a small beacon records the view instead.
 * Any failure serves the page normally (never take a guidebook down because of a counter problem).
 */
export async function decideView(sql: Sql, request: Request, guidebookId: string, ownerId: string | null): Promise<ViewDecision> {
  try {
    if (!ownerId) return { action: "serve", cacheable: true, beacon: false };
    const plan = await getUserPlan(sql, ownerId);
    if (plan.viewsPerMonth === null) return { action: "serve", cacheable: true, beacon: true };

    if (isNonViewRequest(request)) {
      // Not counted, but a guidebook that is over its limit stays unavailable to everyone
      return (await monthlyViews(sql, ownerId)) >= plan.viewsPerMonth
        ? { action: "blocked", limit: plan.viewsPerMonth }
        : { action: "serve", cacheable: false, beacon: false };
    }

    const key = visitorKey(request, guidebookId);
    const seen = await sql`select 1 from public.view_dedupe where key = ${key}`;
    if (seen.length > 0) return { action: "serve", cacheable: false, beacon: false };

    if ((await monthlyViews(sql, ownerId)) >= plan.viewsPerMonth) return { action: "blocked", limit: plan.viewsPerMonth };
    await recordView(sql, guidebookId, ownerId, key);
    return { action: "serve", cacheable: false, beacon: false };
  } catch (error) {
    console.error("view accounting failed; serving the guidebook anyway", error);
    return { action: "serve", cacheable: true, beacon: false };
  }
}

export interface ViewSeriesPoint {
  day: string;
  views: number;
}

/** Views per guidebook this month, plus a daily series for the last 30 days when the plan has analytics. */
export async function viewStats(sql: Sql, userId: string, plan: PlanConfig) {
  const books = await sql`
    select g.id, p.name as property_name,
           coalesce((select sum(v.views) from public.guidebook_view_daily v
                      where v.guidebook_id = g.id and v.day >= ${monthStart()}::date), 0)::int as views_month
      from guidebook g left join property p on p.id = g.property_id
     where g.user_id = ${userId}
     order by views_month desc, g.created_time desc`;
  const used = await monthlyViews(sql, userId);

  let daily: Record<string, ViewSeriesPoint[]> | undefined;
  if (plan.analytics) {
    const rows = await sql`
      select guidebook_id, to_char(day, 'YYYY-MM-DD') as day, views
        from public.guidebook_view_daily
       where user_id = ${userId} and day >= (now() at time zone 'utc')::date - 29
       order by day`;
    daily = {};
    for (const r of rows) (daily[r.guidebook_id] ??= []).push({ day: r.day, views: r.views });
  }

  return {
    plan: plan.key,
    month_start: monthStart(),
    views_used: used,
    views_limit: plan.viewsPerMonth,
    analytics: plan.analytics,
    guidebooks: books.map((b) => ({
      id: b.id as string,
      property_name: (b.property_name as string | null) ?? null,
      views_month: b.views_month as number,
      ...(daily ? { daily: daily[b.id as string] ?? [] } : {}),
    })),
  };
}

// ---------------------------------------------------------------------------------------------
// AI generations
// ---------------------------------------------------------------------------------------------

export async function aiUsage(sql: Sql, userId: string): Promise<number> {
  const [row] = await sql`select coalesce(sum(used), 0)::int as used from public.ai_usage_monthly where user_id = ${userId} and month = ${monthStart()}::date`;
  return row.used as number;
}

/** Take one AI generation from the monthly allowance; throws a 403 (with upgrade hint) when it is used up. */
export async function consumeAiQuota(sql: Sql, userId: string): Promise<void> {
  const plan = await getUserPlan(sql, userId);
  if (plan.aiPerMonth === null) return;
  const rows = await sql`
    insert into public.ai_usage_monthly (user_id, month, used) values (${userId}, ${monthStart()}::date, 1)
    on conflict (user_id, month) do update set used = public.ai_usage_monthly.used + 1
      where public.ai_usage_monthly.used < ${plan.aiPerMonth}
    returning used`;
  if (rows.length === 0) {
    throw new ServiceError(
      403,
      `You've used all ${plan.aiPerMonth} AI recommendations included in your ${plan.name} plan this month.`,
      { upgrade: true, quota: "ai" },
    );
  }
}

/** Give back an AI generation that produced nothing. */
export async function refundAiQuota(sql: Sql, userId: string): Promise<void> {
  await sql`update public.ai_usage_monthly set used = greatest(used - 1, 0) where user_id = ${userId} and month = ${monthStart()}::date`.catch(
    () => undefined,
  );
}

// ---------------------------------------------------------------------------------------------
// Guidebook creation: caps and bot protection
// ---------------------------------------------------------------------------------------------

const MAX_CREATED_PER_HOUR = 20;
const MAX_CREATED_PER_DAY = 100;

/**
 * Guidebooks are free, so creation is rate limited (shared across instances because it counts rows)
 * to stop scripts, and capped per plan (the cap is fine print, not advertised).
 */
export async function assertCanCreateGuidebook(sql: Sql, userId: string): Promise<void> {
  const [recent] = await sql`
    select count(*) filter (where created_time > now() - interval '1 hour')::int as hour,
           count(*) filter (where created_time > now() - interval '1 day')::int as day,
           count(*)::int as total
      from guidebook where user_id = ${userId}`;
  if (recent.hour >= MAX_CREATED_PER_HOUR || recent.day >= MAX_CREATED_PER_DAY) {
    throw new ServiceError(429, "You're creating guidebooks very quickly. Please wait a while and try again.");
  }
  const plan = await getUserPlan(sql, userId);
  if (plan.guidebookLimit !== null && recent.total >= plan.guidebookLimit) {
    throw new ServiceError(
      403,
      `Your ${plan.name} plan includes up to ${plan.guidebookLimit} guidebooks. Upgrade your plan to create more.`,
      { upgrade: true, quota: "guidebooks" },
    );
  }
}
