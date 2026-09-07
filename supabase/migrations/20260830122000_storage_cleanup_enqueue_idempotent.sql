-- A lost write response can leave an exact cleanup intent for a live document.
-- Deleting that document must reuse the pending work instead of failing on the
-- pending-object unique index. Keep every field of the existing row unchanged;
-- in particular, deletion must not renew a lease or restore spent attempts.
-- Terminal rows remain history and do not conflict with a new pending row.
-- Recovery is a reviewed forward migration. No queue history is removed here.

create or replace function public.tg_enqueue_storage_cleanup()
returns trigger
language plpgsql
security definer
set search_path = ''
as $fn$
begin
  insert into public.storage_cleanup_queue (bucket_id, object_path, document_id, claim_id)
  values ('claim-docs', old.storage_path, old.id, old.claim_id)
  on conflict (bucket_id, object_path)
    where processed_at is null and dead_at is null
  do nothing;
  return null;
end;
$fn$;
