-- Before this, any signed-in user (and, with anonymous sign-ins on, any visitor) could upload to and
-- overwrite or delete anyone's files in these buckets. Now only members (not guests) upload, and
-- people can only replace or delete their own files. Reading stays public (public buckets).

-- food-and-activities: editor image uploads
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

-- User_videos: not used by the current app
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
