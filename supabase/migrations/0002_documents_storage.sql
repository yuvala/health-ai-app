-- Create the storage bucket used by frontend document uploads.
insert into storage.buckets (id, name, public)
values ('documents', 'documents', false)
on conflict (id) do nothing;

-- Restrict object access to each authenticated user's own folder.
-- File paths are written as: {auth.uid()}/timestamp-filename.ext
drop policy if exists "documents_objects_select_own" on storage.objects;
create policy "documents_objects_select_own" on storage.objects
  for select to authenticated
  using (
    bucket_id = 'documents'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

drop policy if exists "documents_objects_insert_own" on storage.objects;
create policy "documents_objects_insert_own" on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'documents'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

drop policy if exists "documents_objects_update_own" on storage.objects;
create policy "documents_objects_update_own" on storage.objects
  for update to authenticated
  using (
    bucket_id = 'documents'
    and (storage.foldername(name))[1] = auth.uid()::text
  )
  with check (
    bucket_id = 'documents'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

drop policy if exists "documents_objects_delete_own" on storage.objects;
create policy "documents_objects_delete_own" on storage.objects
  for delete to authenticated
  using (
    bucket_id = 'documents'
    and (storage.foldername(name))[1] = auth.uid()::text
  );
