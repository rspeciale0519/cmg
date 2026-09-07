-- Keep cleanup leases intact while signed staging links can still write.
-- A time allowance alone cannot bound an upload that starts before expiry and
-- finishes later. Revisit retained exact paths after every successful sweep.
create function public.reconcile_intake_upload_cleanup(p_limit integer default 100)
returns jsonb language plpgsql volatile security invoker set search_path = '' as $fn$
declare
  v_file public.intake_upload_files%rowtype;
  v_limit integer := least(greatest(coalesce(p_limit, 100), 0), 1000);
  v_now timestamptz := clock_timestamp();
  v_checked integer := 0;
  v_queued integer := 0;
  v_blocked integer := 0;
  v_count integer;
begin
  if current_user <> 'service_role' then
    raise exception 'service role required' using errcode = '42501';
  end if;
  for v_file in
    with candidates as materialized (
      select f.* from public.intake_upload_files f
      join public.intake_upload_sessions s on s.id = f.session_id
      where s.cleanup_after <= v_now
      order by f.last_reconciled_at nulls first, f.session_id, f."index"
      limit v_limit for update of f skip locked
    ) select * from candidates
  loop
    select count(*)::integer into v_count
    from storage.objects o
    where o.bucket_id = 'claim-docs' and o.name in (v_file.upload_path, v_file.storage_path)
      and not exists (select 1 from public.documents d where d.storage_path = o.name)
      and exists (select 1 from public.storage_cleanup_queue q
                  where q.bucket_id = o.bucket_id and q.object_path = o.name and q.dead_at is not null);
    v_blocked := v_blocked + v_count;

    insert into public.storage_cleanup_queue(bucket_id, object_path, next_attempt_at)
    select o.bucket_id, o.name, v_now from storage.objects o
    where o.bucket_id = 'claim-docs' and o.name in (v_file.upload_path, v_file.storage_path)
      and not exists (select 1 from public.documents d where d.storage_path = o.name)
      and not exists (select 1 from public.storage_cleanup_queue q
        where q.bucket_id = o.bucket_id and q.object_path = o.name
          and (q.dead_at is not null or q.processed_at is null))
    on conflict (bucket_id, object_path) where processed_at is null and dead_at is null do nothing;
    get diagnostics v_count = row_count;
    v_queued := v_queued + v_count;
    update public.intake_upload_files set last_reconciled_at = v_now
      where session_id = v_file.session_id and "index" = v_file."index";
    v_checked := v_checked + 1;
  end loop;
  return jsonb_build_object('checked_files', v_checked, 'queued', v_queued, 'blocked', v_blocked);
end;
$fn$;
revoke all on function public.reconcile_intake_upload_cleanup(integer) from public, anon, authenticated;
grant execute on function public.reconcile_intake_upload_cleanup(integer) to service_role;

-- The embargo applies to all work for either path, including a new queue row
-- made by document deletion after a successful claim commit. Preserve the
-- worker's signature, ACL, owner, attempt fencing, and shared recovery budget.
create or replace function public.claim_storage_cleanup_batch(
  p_limit integer default 25, p_lease_seconds integer default 300, p_max_attempts integer default 5
) returns table(id bigint, bucket_id text, object_path text, attempts integer)
language plpgsql volatile security invoker set search_path = '' as $fn$
declare
  v_limit integer := greatest(coalesce(p_limit, 25), 0);
  v_max integer := greatest(coalesce(p_max_attempts, 5), 1);
  v_terminal integer := 0;
begin
  with terminal as materialized (
    select c.id from public.storage_cleanup_queue c
    where c.processed_at is null and c.dead_at is null and c.attempts >= v_max
      and c.next_attempt_at <= now()
      and not exists (select 1 from public.documents d
                      where c.bucket_id = 'claim-docs' and d.storage_path = c.object_path)
      and not exists (
        select 1 from public.intake_upload_files f
        join public.intake_upload_sessions s on s.id = f.session_id
        where c.bucket_id = 'claim-docs' and c.object_path in (f.upload_path, f.storage_path)
          and s.cleanup_after > now()
      )
    order by c.next_attempt_at, c.enqueued_at, c.id limit v_limit for update of c skip locked
  )
  update public.storage_cleanup_queue q set dead_at = now(),
    last_error = 'Cleanup worker lease expired during the final permitted attempt.'
  from terminal where q.id = terminal.id;
  get diagnostics v_terminal = row_count;

  return query
  with due as materialized (
    select c.id from public.storage_cleanup_queue c
    where c.processed_at is null and c.dead_at is null and c.attempts < v_max
      and c.next_attempt_at <= now()
      and not exists (select 1 from public.documents d
                      where c.bucket_id = 'claim-docs' and d.storage_path = c.object_path)
      and not exists (
        select 1 from public.intake_upload_files f
        join public.intake_upload_sessions s on s.id = f.session_id
        where c.bucket_id = 'claim-docs' and c.object_path in (f.upload_path, f.storage_path)
          and s.cleanup_after > now()
      )
    order by c.next_attempt_at, c.enqueued_at, c.id limit greatest(v_limit - v_terminal, 0)
    for update of c skip locked
  )
  update public.storage_cleanup_queue q
    set attempts = q.attempts + 1,
        next_attempt_at = now() + make_interval(secs => greatest(coalesce(p_lease_seconds, 300), 1))
    from due where q.id = due.id returning q.id, q.bucket_id, q.object_path, q.attempts;
end;
$fn$;
