-- Sweep follow-ups.
--
-- 1. The plan check predates the Power plan, so a Power checkout failed in the Stripe webhook (the
--    customer was charged but stayed on Free). Old names stay allowed for rows written by earlier versions.

alter table public.profiles drop constraint if exists profiles_plan_check;
alter table public.profiles add constraint profiles_plan_check
  check (plan in ('free', 'starter', 'power', 'pro', 'trial', 'growth', 'enterprise'));

-- 2. Short varchar limits the app never enforced: a longer door-code note or "3pm, flexible" failed the
--    whole save or import with a 500. text has no limit; the app's own caps (property name 120, etc.) apply.
--    vw_guidebook reads two of these columns, so it is dropped and recreated exactly as it was.

drop view if exists public.vw_guidebook;

alter table public.guidebook
  alter column check_in_time type text,
  alter column check_out_time type text,
  alter column access_info type text;

alter table public.property
  alter column name type text,
  alter column address_street type text,
  alter column address_city_state type text,
  alter column address_zip type text;

alter table public.host alter column name type text;

create view public.vw_guidebook with (security_invoker = true) as
  select g.id, pr.name, pr.address_street, u.email, p.plan, g.created_time
    from public.guidebook g
    join public.profiles p on g.user_id::uuid = p.user_id
    join auth.users u on g.user_id::uuid = u.id
    join public.property pr on g.property_id = pr.id;
revoke all on table public.vw_guidebook from anon, authenticated;

-- 3. Upload limits enforced by Storage itself, not only by the browser. Images (covers, host photos,
--    places) go to food-and-activities; house-manual media (images and videos) to User_videos.
--    my_images is no longer used by the app.

update storage.buckets set file_size_limit = 52428800, allowed_mime_types = array['image/*']
 where id = 'food-and-activities';
update storage.buckets set file_size_limit = 262144000, allowed_mime_types = array['image/*', 'video/*']
 where id = 'User_videos';
update storage.buckets set file_size_limit = 10485760, allowed_mime_types = array['image/*']
 where id = 'my_images';

-- 4. Supabase's default privileges grant anon and authenticated full access to every new table, sequence
--    and function in public. The app reaches the database only from the server, so new objects start closed.

alter default privileges for role postgres in schema public revoke all on tables from anon, authenticated;
alter default privileges for role postgres in schema public revoke all on sequences from anon, authenticated;
alter default privileges for role postgres in schema public revoke all on functions from anon, authenticated;
