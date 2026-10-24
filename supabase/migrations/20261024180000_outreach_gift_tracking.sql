-- Outreach results: one row per gift guidebook an admin builds, stamped when the host opens the gift
-- link and when they claim it. Written and read only by the server (the browser has no access).

create table if not exists public.outreach_gift (
  guest_id uuid primary key,          -- the guest (anonymous) user that owns the gift until it's claimed
  guidebook_id text,
  property_name text,
  prospect_email text,
  created_at timestamptz not null default now(),
  first_opened_at timestamptz,
  last_opened_at timestamptz,
  opens integer not null default 0,
  claimed_at timestamptz,
  claimed_by uuid                     -- the account that claimed it
);

create index if not exists idx_outreach_gift_created on public.outreach_gift (created_at desc);

alter table public.outreach_gift enable row level security;
revoke all on table public.outreach_gift from anon, authenticated;
