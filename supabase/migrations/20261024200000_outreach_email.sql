-- Outreach emails sent to hosts (gift guidebook campaigns), so we know who was contacted, when, and
-- what came of it, and never email a bounced or opted-out address again.
-- Only the server (service role / DATABASE_URL) touches this table: RLS is on with no policies.

create table if not exists public.outreach_email (
  id               bigint generated always as identity primary key,
  batch            text not null,                 -- e.g. 'gift-batch-1'
  batch_item       integer,                       -- the email's number within its batch
  recipient_email  text not null,
  business_name    text,
  language         text not null default 'en',
  from_email       text not null,
  subject          text not null,
  body             text not null,
  gift_url         text,
  gift_guest_id    text,                          -- guest user that owns the gifted guidebook (ticket's "g")
  guidebook_id     varchar,                       -- the gifted guidebook, when known
  gift_expires_at  timestamptz,
  gmail_draft_id   text,
  gmail_message_id text,
  gmail_thread_id  text,
  status           text not null default 'drafted'
                   check (status in ('drafted', 'sent', 'bounced', 'replied', 'opted_out', 'claimed')),
  sent_at          timestamptz,
  bounced_at       timestamptz,
  replied_at       timestamptz,
  opted_out_at     timestamptz,
  claimed_at       timestamptz,
  notes            text,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now(),
  unique (batch, recipient_email)
);
create index if not exists idx_outreach_email_recipient on public.outreach_email (lower(recipient_email));
create index if not exists idx_outreach_email_status on public.outreach_email (status);
create index if not exists idx_outreach_email_guest on public.outreach_email (gift_guest_id);

alter table public.outreach_email enable row level security;
revoke all on table public.outreach_email from anon, authenticated;
