-- Supabase security advisor follow-ups.
--
-- 1. Storage reads. Public buckets serve files by URL without any policy, so a SELECT policy on
--    storage.objects only adds the ability to LIST a bucket. These let any visitor (anon) or any
--    signed-in user list every uploaded file. Members still need to see their own files, because the
--    editor uploads with upsert, which reads the existing object first.

drop policy if exists "Public read images in food/activites" on storage.objects;

drop policy if exists "Allow authenticated users to select their uploads" on storage.objects;
drop policy if exists "food_activities_select_own" on storage.objects;
create policy "food_activities_select_own" on storage.objects for select to authenticated
  using (bucket_id = 'food-and-activities' and owner_id = auth.uid()::text);

drop policy if exists "Allow Auth users to upload/delete/select/update qcik30_0" on storage.objects;
drop policy if exists "user_videos_select_own" on storage.objects;
create policy "user_videos_select_own" on storage.objects for select to authenticated
  using (bucket_id = 'User_videos' and owner_id = auth.uid()::text);

-- 2. Fixed search_path on trigger functions, so nothing earlier on the path can shadow what they call.
--    Both bodies already use schema-qualified names (now() lives in pg_catalog, which is always searched).

alter function public.touch_updated_at() set search_path = '';
alter function public.handle_new_user() set search_path = '';
