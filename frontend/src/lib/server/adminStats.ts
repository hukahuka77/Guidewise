import type { Sql } from "./db";
import { normalizePlan, PLAN_CONFIGS } from "./plans";
import { outreachResults } from "./gifts";
import { monthStart } from "./usage";

// Numbers for the admin dashboard tab. Reads Supabase's auth.users directly (server only).

const SOURCE = `coalesce(
  nullif(u.raw_user_meta_data->'signup_source'->>'source', ''),
  'referral: ' || nullif(u.raw_user_meta_data->'signup_source'->>'referrer', ''),
  'direct / unknown')`;

export async function adminStats(sql: Sql) {
  const month = monthStart();
  const [users] = await sql`
    select count(*) filter (where not is_anonymous)::int as members,
           count(*) filter (where not is_anonymous and created_at > now() - interval '7 days')::int as new_7d,
           count(*) filter (where not is_anonymous and created_at > now() - interval '30 days')::int as new_30d,
           count(*) filter (where is_anonymous)::int as guests
      from auth.users`;

  const [books] = await sql`
    select count(*)::int as total,
           count(*) filter (where g.created_time > now() - interval '7 days')::int as new_7d,
           count(*) filter (where u.is_anonymous)::int as unclaimed
      from guidebook g left join auth.users u on u.id::text = g.user_id`;

  const planRows = await sql`select plan, count(*)::int as n from public.profiles where plan is not null and plan <> 'free' group by plan`;
  const plans: Record<string, number> = {};
  for (const r of planRows) {
    const key = normalizePlan(r.plan);
    if (key !== "free") plans[key] = (plans[key] ?? 0) + (r.n as number);
  }
  const mrr = Object.entries(plans).reduce((sum, [key, n]) => sum + (PLAN_CONFIGS[key]?.priceUsd ?? 0) * n, 0);

  const [views] = await sql`select coalesce(sum(views), 0)::int as month from public.guidebook_view_daily where day >= ${month}::date`;
  const topGuidebooks = await sql`
    select v.guidebook_id as id, p.name as property_name, sum(v.views)::int as views
      from public.guidebook_view_daily v
      left join guidebook g on g.id = v.guidebook_id
      left join property p on p.id = g.property_id
     where v.day >= ${month}::date
     group by v.guidebook_id, p.name
     order by views desc
     limit 5`;

  const [ai] = await sql`select coalesce(sum(used), 0)::int as month from public.ai_usage_monthly where month = ${month}::date`;

  const sources = await sql.unsafe(`
    select ${SOURCE} as source, count(*)::int as signups
      from auth.users u
     where not u.is_anonymous and u.created_at > now() - interval '30 days'
     group by 1 order by signups desc limit 10`);
  const heard = await sql`
    select raw_user_meta_data->>'heard_about' as answer, count(*)::int as signups
      from auth.users
     where not is_anonymous and created_at > now() - interval '30 days' and raw_user_meta_data->>'heard_about' is not null
     group by 1 order by signups desc limit 10`;

  const recent = await sql.unsafe(`
    select u.email, u.created_at, ${SOURCE} as source, u.raw_user_meta_data->>'heard_about' as heard_about,
           coalesce(pr.plan, 'free') as plan,
           (select count(*)::int from guidebook g where g.user_id = u.id::text) as guidebooks
      from auth.users u left join public.profiles pr on pr.user_id = u.id
     where not u.is_anonymous
     order by u.created_at desc nulls last
     limit 15`);

  const outreach = await outreachResults(sql);

  return {
    outreach,
    users,
    guidebooks: books,
    plans,
    mrr_usd: mrr,
    views_month: views.month as number,
    ai_runs_month: ai.month as number,
    top_guidebooks: topGuidebooks.map((r) => ({ id: r.id, property_name: r.property_name ?? null, views: r.views })),
    sources: sources.map((r) => ({ source: r.source as string, signups: r.signups as number })),
    heard_about: heard.map((r) => ({ answer: r.answer as string, signups: r.signups as number })),
    recent_signups: recent.map((r) => ({
      email: r.email ?? null,
      created_at: r.created_at ? new Date(r.created_at).toISOString() : null,
      source: r.source as string,
      heard_about: r.heard_about ?? null,
      plan: normalizePlan(r.plan),
      guidebooks: r.guidebooks as number,
    })),
  };
}
