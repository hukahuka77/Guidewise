-- Usage tracking for the free / starter / power / pro pricing model.
-- Only the server (service role / DATABASE_URL) touches these tables: RLS is on with no policies.

-- Guest views per guidebook per day. user_id is the owner (text, like guidebook.user_id).
create table if not exists public.guidebook_view_daily (
  guidebook_id text not null,
  user_id      text not null,
  day          date not null,
  views        integer not null default 0,
  primary key (guidebook_id, day)
);
create index if not exists idx_guidebook_view_daily_user_day on public.guidebook_view_daily (user_id, day);
alter table public.guidebook_view_daily enable row level security;

-- Short-lived visitor keys so one visitor reloading a guidebook counts once per half hour.
-- Keys are salted hashes; no IP addresses are stored. Old rows are purged by the app.
create table if not exists public.view_dedupe (
  key        text primary key,
  created_at timestamptz not null default now()
);
create index if not exists idx_view_dedupe_created_at on public.view_dedupe (created_at);
alter table public.view_dedupe enable row level security;

-- AI recommendation generations per user per calendar month.
create table if not exists public.ai_usage_monthly (
  user_id text not null,
  month   date not null,
  used    integer not null default 0,
  primary key (user_id, month)
);
alter table public.ai_usage_monthly enable row level security;
