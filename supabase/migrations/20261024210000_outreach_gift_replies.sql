-- Outreach results: how a prospect answered the gift email (set from the Admin tab, or by Claude reading
-- the hello@ inbox). Null until they reply.

alter table public.outreach_gift
  add column if not exists reply_status text,
  add column if not exists replied_at timestamptz,
  add column if not exists reply_note text;

alter table public.outreach_gift drop constraint if exists outreach_gift_reply_status_check;
alter table public.outreach_gift add constraint outreach_gift_reply_status_check
  check (reply_status is null or reply_status in ('replied', 'interested', 'declined'));
