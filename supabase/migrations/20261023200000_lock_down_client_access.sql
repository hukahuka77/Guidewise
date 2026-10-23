-- Lock down what browsers can do with the public anon key and a user's own token.
--
-- Guidewise reads and writes its tables only from the server (DATABASE_URL / service role), so the
-- anon and authenticated roles need no table access at all. Before this migration:
--   * any signed-in user (and, since anonymous sign-ins are on, any visitor) could set their own
--     profiles.plan to 'pro' through the REST API;
--   * vw_users / vw_guidebook (owned by postgres, so they skip RLS) exposed every user's email, plan
--     and Stripe ids to anyone holding the public anon key;
--   * guests could insert guidebooks directly, around the app's caps and rate limits.
-- Applied to production on 2026-10-23.

-- App tables: server only
revoke all on table public.guidebook, public.host, public.property, public.profiles,
  public.ai_usage_monthly, public.guidebook_view_daily, public.view_dedupe, public.guidebook_pdf_plan
  from anon, authenticated;
revoke all on all sequences in schema public from anon, authenticated;

-- Admin views: server only, and evaluated with the caller's rights if ever exposed again
revoke all on table public.vw_users, public.vw_guidebook from anon, authenticated;
alter view public.vw_users set (security_invoker = true);
alter view public.vw_guidebook set (security_invoker = true);

-- The signup trigger runs as its owner; nobody needs to call it directly
revoke execute on function public.handle_new_user() from public, anon, authenticated;
