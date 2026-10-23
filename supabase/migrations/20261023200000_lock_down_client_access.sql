-- Lock down what browsers can do with the public anon key and a user's own token.
--
-- Guidewise reads and writes its tables only from the server (DATABASE_URL / service role), so the
-- anon and authenticated roles need no table access at all. Before this migration:
--   * any signed-in user (and, since anonymous sign-ins are on, any visitor) could set their own
--     profiles.plan to 'pro' through the REST API;
--   * vw_users / vw_guidebook (owned by postgres, so they skip RLS) exposed every user's email, plan
--     and Stripe ids to anyone holding the public anon key;
--   * guests could insert guidebooks directly, around the app's caps and rate limits;
--   * any signed-in user or guest could overwrite or delete anyone's uploaded images.

-- App tables: server only
revoke all on table public.guidebook, public.host, public.property, public.profiles,
  public.ai_usage_monthly, public.guidebook_view_daily, public.view_dedupe
  from anon, authenticated;
revoke all on all sequences in schema public from anon, authenticated;

-- Admin views: server only, and evaluated with the caller's rights if ever exposed again
revoke all on table public.vw_users, public.vw_guidebook from anon, authenticated;
alter view public.vw_users set (security_invoker = true);
alter view public.vw_guidebook set (security_invoker = true);

-- The signup trigger runs as its owner; nobody needs to call it directly
revoke execute on function public.handle_new_user() from public, anon, authenticated;

-- Storage, food-and-activities (editor image uploads): only signed-in members (not guests) upload,
-- and people can only replace or delete their own files. Reading stays public (public bucket).
drop policy if exists "Insert images to prefixes (auth)" on storage.objects;
drop policy if exists "Update images in prefixes (auth)" on storage.objects;
drop policy if exists "Allow authenticated users to delete their uploads" on storage.objects;

create policy "food_activities_insert_members" on storage.objects for insert to authenticated
  with check (bucket_id = 'food-and-activities' and coalesce((auth.jwt() ->> 'is_anonymous')::boolean, false) = false);
create policy "food_activities_update_own" on storage.objects for update to authenticated
  using (bucket_id = 'food-and-activities' and owner_id = auth.uid()::text)
  with check (bucket_id = 'food-and-activities' and owner_id = auth.uid()::text);
create policy "food_activities_delete_own" on storage.objects for delete to authenticated
  using (bucket_id = 'food-and-activities' and owner_id = auth.uid()::text);

-- Storage, User_videos (not used by the current app): same rules, so it can't be emptied or filled by strangers
drop policy if exists "Allow Auth users to upload/delete/select/update qcik30_1" on storage.objects;
drop policy if exists "Allow Auth users to upload/delete/select/update qcik30_2" on storage.objects;
drop policy if exists "Allow Auth users to upload/delete/select/update qcik30_3" on storage.objects;

create policy "user_videos_insert_members" on storage.objects for insert to authenticated
  with check (bucket_id = 'User_videos' and coalesce((auth.jwt() ->> 'is_anonymous')::boolean, false) = false);
create policy "user_videos_update_own" on storage.objects for update to authenticated
  using (bucket_id = 'User_videos' and owner_id = auth.uid()::text)
  with check (bucket_id = 'User_videos' and owner_id = auth.uid()::text);
create policy "user_videos_delete_own" on storage.objects for delete to authenticated
  using (bucket_id = 'User_videos' and owner_id = auth.uid()::text);
