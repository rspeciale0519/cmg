-- Private direct uploads use staging paths and one server-authorized copy to
-- immutable claim paths. Retain exact paths until every signed upload URL has
-- expired and late objects have been reconciled. Recovery: stop issuing new
-- sessions; preserve these rows and cleanup intents for operator repair.
create table public.private_upload_sessions (
  id uuid primary key,
  token_hash text not null unique check (char_length(token_hash) = 64 and token_hash ~ '^[0-9a-f]{64}$'),
  claim_id uuid not null,
  uploaded_by uuid not null,
  file_count integer not null check (file_count between 1 and 10),
  status text not null default 'pending' check (status in ('pending', 'completed', 'cancelled')),
  result jsonb,
  created_at timestamptz not null,
  expires_at timestamptz not null,
  sign_until timestamptz not null,
  cleanup_after timestamptz not null,
  completed_at timestamptz,
  constraint private_upload_session_deadlines check (
    expires_at = created_at + interval '2 hours'
    and sign_until = created_at + interval '5 minutes'
    and cleanup_after = created_at + interval '2 hours 15 minutes'
  ),
  constraint private_upload_session_result check (
    (status = 'completed' and jsonb_typeof(result) = 'object' and result is not null and completed_at is not null)
    or (status <> 'completed' and result is null and completed_at is null)
  )
);

create table public.private_upload_files (
  session_id uuid not null references public.private_upload_sessions(id) on delete restrict,
  "index" integer not null check ("index" between 0 and 9),
  upload_path text not null unique,
  storage_path text not null unique,
  original_name text not null check (char_length(original_name) between 1 and 200),
  kind public.document_kind not null,
  visibility public.document_visibility not null,
  mime text not null check (mime in (
    'application/pdf', 'image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/heif',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
  )),
  size_bytes bigint not null check (size_bytes > 0 and size_bytes <= 26214400),
  copy_started_at timestamptz,
  verification jsonb,
  last_reconciled_at timestamptz,
  primary key (session_id, "index"),
  constraint private_upload_file_paths check (
    upload_path <> storage_path
    and upload_path ~ ('^private-upload/' || session_id::text || '/[0-9a-fA-F-]{36}\.[A-Za-z0-9]{1,8}$')
    and storage_path ~ ('^claims/[0-9a-fA-F-]{36}/[0-9a-fA-F-]{36}\.[A-Za-z0-9]{1,8}$')
  ),
  constraint private_upload_file_verification check (
    verification is null or (
      copy_started_at is not null
      and jsonb_typeof(verification) = 'object'
      and verification->'index' = to_jsonb("index")
      and verification->'mime' = to_jsonb(mime)
      and verification->'size_bytes' = to_jsonb(size_bytes)
      and jsonb_typeof(verification->'object_id') = 'string'
      and jsonb_typeof(verification->'version') = 'string'
      and coalesce(verification->>'object_id', '') <> ''
      and coalesce(verification->>'version', '') <> ''
    )
  )
);

create index private_upload_files_reconcile_idx
  on public.private_upload_files(last_reconciled_at nulls first, session_id, "index");

alter table public.private_upload_sessions enable row level security;
alter table public.private_upload_files enable row level security;
revoke all on public.private_upload_sessions, public.private_upload_files
  from public, anon, authenticated, service_role;
grant select, insert, update on public.private_upload_sessions, public.private_upload_files to service_role;

create function private.protect_private_upload_session()
returns trigger language plpgsql security invoker set search_path = '' as $fn$
begin
  if row(new.id, new.token_hash, new.claim_id, new.uploaded_by, new.file_count, new.created_at,
         new.expires_at, new.sign_until, new.cleanup_after)
     is distinct from row(old.id, old.token_hash, old.claim_id, old.uploaded_by, old.file_count, old.created_at,
                          old.expires_at, old.sign_until, old.cleanup_after)
     or (old.status <> 'pending' and row(new.status, new.result, new.completed_at)
         is distinct from row(old.status, old.result, old.completed_at)) then
    raise exception 'private upload session is immutable' using errcode = '55000';
  end if;
  return new;
end;
$fn$;
create trigger private_upload_sessions_protect_update before update on public.private_upload_sessions
for each row execute function private.protect_private_upload_session();
revoke all on function private.protect_private_upload_session() from public, anon, authenticated;

create function private.protect_private_upload_file()
returns trigger language plpgsql security invoker set search_path = '' as $fn$
declare v_session public.private_upload_sessions%rowtype;
begin
  if tg_op = 'INSERT' then
    select * into v_session from public.private_upload_sessions where id = new.session_id for update;
    if not found or v_session.status <> 'pending' or new."index" >= v_session.file_count
       or exists (select 1 from public.private_upload_files f
                  where f.upload_path = new.storage_path or f.storage_path = new.upload_path) then
      raise exception 'invalid private upload manifest' using errcode = '22023';
    end if;
    return new;
  end if;
  if row(new.session_id, new."index", new.upload_path, new.storage_path, new.original_name,
         new.kind, new.visibility, new.mime, new.size_bytes)
     is distinct from row(old.session_id, old."index", old.upload_path, old.storage_path, old.original_name,
                          old.kind, old.visibility, old.mime, old.size_bytes)
     or (old.copy_started_at is not null and new.copy_started_at is distinct from old.copy_started_at)
     or (old.verification is not null and new.verification is distinct from old.verification) then
    raise exception 'private upload manifest is immutable' using errcode = '55000';
  end if;
  return new;
end;
$fn$;
create trigger private_upload_files_protect_update before insert or update on public.private_upload_files
for each row execute function private.protect_private_upload_file();
revoke all on function private.protect_private_upload_file() from public, anon, authenticated;

-- A caller-scoped documents insert still uses documents RLS. This narrow
-- definer trigger reads the service-only manifest and rejects rows after expiry.
create function private.guard_private_upload_document_insert()
returns trigger language plpgsql security definer set search_path = '' as $fn$
declare
  v_session public.private_upload_sessions%rowtype;
  v_file public.private_upload_files%rowtype;
  v_proof jsonb;
begin
  select f.* into v_file from public.private_upload_files f where f.storage_path = new.storage_path;
  if not found then return new; end if;
  select s.* into v_session from public.private_upload_sessions s where s.id = v_file.session_id for update;
  if not found then return new; end if;
  if v_session.status <> 'pending' or v_session.expires_at <= clock_timestamp() then
    raise exception 'private upload session expired or unavailable' using errcode = '55000';
  end if;
  if v_file.copy_started_at is null or v_file.verification is null
     or row(new.claim_id, new.uploaded_by, new.original_name, new.kind, new.visibility, new.mime, new.size_bytes)
        is distinct from row(v_session.claim_id, v_session.uploaded_by, v_file.original_name,
          v_file.kind, v_file.visibility, v_file.mime, v_file.size_bytes) then
    raise exception 'private upload document does not match its reservation' using errcode = '55000';
  end if;
  v_proof := v_file.verification;
  perform 1 from storage.objects o
  where o.bucket_id = 'claim-docs' and o.name = v_file.storage_path
    and o.id::text = v_proof->>'object_id' and o.version = v_proof->>'version'
    and o.metadata->>'mimetype' = v_file.mime
    and o.metadata->'size' = to_jsonb(v_file.size_bytes);
  if not found then
    raise exception 'private upload destination is not verified' using errcode = '55000';
  end if;
  return new;
end;
$fn$;
revoke all on function private.guard_private_upload_document_insert() from public, anon, authenticated, service_role;
create trigger documents_private_upload_expiry_guard before insert on public.documents
for each row execute function private.guard_private_upload_document_insert();

-- Contract: reserve exact staging and destination paths before returning them.
-- Result: expiry timestamps plus the canonical immutable file manifest.
-- Retries with the same ID are idempotent only when every immutable field matches.
create function public.begin_private_upload_session(
  p_id uuid, p_token_hash text, p_claim_id uuid, p_uploaded_by uuid, p_files jsonb
) returns jsonb language plpgsql volatile security invoker set search_path = '' as $fn$
declare
  v_session public.private_upload_sessions%rowtype;
  v_now timestamptz := clock_timestamp();
  v_count integer;
  v_inserted integer;
  v_paths text[];
  v_manifest jsonb;
  v_existing jsonb;
begin
  if current_user <> 'service_role' then raise exception 'service role required' using errcode = '42501'; end if;
  if p_id is null or p_claim_id is null or p_uploaded_by is null or p_token_hash is null
     or p_token_hash !~ '^[0-9a-f]{64}$' or jsonb_typeof(p_files) is distinct from 'array' then
    raise exception 'invalid private upload session' using errcode = '22023';
  end if;
  v_count := jsonb_array_length(p_files);
  if v_count < 1 or v_count > 10 or exists (
    select 1 from jsonb_array_elements(p_files) e
    where jsonb_typeof(e) is distinct from 'object'
       or jsonb_typeof(e->'index') is distinct from 'number'
       or jsonb_typeof(e->'upload_path') is distinct from 'string'
       or jsonb_typeof(e->'storage_path') is distinct from 'string'
       or jsonb_typeof(e->'original_name') is distinct from 'string'
       or jsonb_typeof(e->'kind') is distinct from 'string'
       or jsonb_typeof(e->'visibility') is distinct from 'string'
       or jsonb_typeof(e->'mime') is distinct from 'string'
       or jsonb_typeof(e->'size_bytes') is distinct from 'number'
  ) then raise exception 'invalid private upload manifest' using errcode = '22023'; end if;
  if exists (
    select 1 from jsonb_array_elements(p_files) e
    where (e->>'index')::numeric < 0 or (e->>'index')::numeric >= v_count
       or (e->>'index')::numeric <> trunc((e->>'index')::numeric)
       or (e->>'size_bytes')::numeric <= 0 or (e->>'size_bytes')::numeric > 26214400
       or (e->>'size_bytes')::numeric <> trunc((e->>'size_bytes')::numeric)
       or e->>'upload_path' !~ ('^private-upload/' || p_id::text || '/[0-9a-fA-F-]{36}\.[A-Za-z0-9]{1,8}$')
       or e->>'storage_path' !~ ('^claims/' || p_claim_id::text || '/[0-9a-fA-F-]{36}\.[A-Za-z0-9]{1,8}$')
  ) then raise exception 'invalid private upload manifest' using errcode = '22023'; end if;
  if not exists (select 1 from public.claims c where c.id = p_claim_id)
     or not exists (select 1 from public.profiles p where p.id = p_uploaded_by) then
    raise exception 'private upload target unavailable' using errcode = '55000';
  end if;
  select coalesce(jsonb_agg(jsonb_build_object(
    'index', f."index", 'upload_path', f.upload_path, 'storage_path', f.storage_path,
    'original_name', f.original_name, 'kind', f.kind, 'visibility', f.visibility,
    'mime', f.mime, 'size_bytes', f.size_bytes
  ) order by f."index"), '[]'::jsonb) into v_manifest
  from jsonb_to_recordset(p_files) f("index" integer, upload_path text, storage_path text,
    original_name text, kind public.document_kind, visibility public.document_visibility, mime text, size_bytes bigint);
  select array_agg(path order by path) into v_paths from (
    select e->>'upload_path' path from jsonb_array_elements(v_manifest) e
    union all select e->>'storage_path' from jsonb_array_elements(v_manifest) e
  ) paths;
  if (select count(distinct e->'index') from jsonb_array_elements(v_manifest) e) <> v_count
     or (select count(distinct p) from unnest(v_paths) p) <> 2 * v_count then
    raise exception 'invalid private upload manifest' using errcode = '22023';
  end if;
  insert into public.private_upload_sessions
    (id, token_hash, claim_id, uploaded_by, file_count, created_at, expires_at, sign_until, cleanup_after)
  values (p_id, p_token_hash, p_claim_id, p_uploaded_by, v_count, v_now,
    v_now + interval '2 hours', v_now + interval '5 minutes', v_now + interval '2 hours 15 minutes')
  on conflict (id) do nothing;
  get diagnostics v_inserted = row_count;
  select * into v_session from public.private_upload_sessions where id = p_id for update;
  if v_session.token_hash is distinct from p_token_hash or v_session.claim_id is distinct from p_claim_id
     or v_session.uploaded_by is distinct from p_uploaded_by then
    raise exception 'private upload session mismatch' using errcode = '55000';
  end if;
  if v_inserted = 0 then
    select coalesce(jsonb_agg(jsonb_build_object(
      'index', f."index", 'upload_path', f.upload_path, 'storage_path', f.storage_path,
      'original_name', f.original_name, 'kind', f.kind, 'visibility', f.visibility,
      'mime', f.mime, 'size_bytes', f.size_bytes
    ) order by f."index"), '[]'::jsonb) into v_existing
    from public.private_upload_files f where f.session_id = p_id;
    if v_existing is distinct from v_manifest then
      raise exception 'private upload session mismatch' using errcode = '55000';
    end if;
  else
    if exists (select 1 from public.storage_cleanup_queue where bucket_id = 'claim-docs' and object_path = any(v_paths))
       or exists (select 1 from public.documents where storage_path = any(v_paths))
       or exists (select 1 from storage.objects where bucket_id = 'claim-docs' and name = any(v_paths)) then
      raise exception 'private upload path unavailable' using errcode = '55000';
    end if;
    insert into public.private_upload_files
      (session_id, "index", upload_path, storage_path, original_name, kind, visibility, mime, size_bytes)
    select p_id, f."index", f.upload_path, f.storage_path, f.original_name, f.kind, f.visibility, f.mime, f.size_bytes
    from jsonb_to_recordset(v_manifest) f("index" integer, upload_path text, storage_path text,
      original_name text, kind public.document_kind, visibility public.document_visibility, mime text, size_bytes bigint);
    perform public.enqueue_storage_cleanup_exact('claim-docs', v_paths, p_claim_id);
  end if;
  return jsonb_build_object('expires_at', v_session.expires_at, 'sign_until', v_session.sign_until,
    'cleanup_after', v_session.cleanup_after, 'files', v_manifest);
end;
$fn$;

-- Contract: return {allowed,copy_started_at}; only the first call can allow a copy.
create function public.claim_private_upload_copy(p_id uuid, p_token_hash text, p_index integer)
returns jsonb language plpgsql volatile security invoker set search_path = '' as $fn$
declare v_session public.private_upload_sessions%rowtype; v_file public.private_upload_files%rowtype; v_started timestamptz;
begin
  if current_user <> 'service_role' then raise exception 'service role required' using errcode = '42501'; end if;
  select * into v_session from public.private_upload_sessions
    where id = p_id and token_hash = p_token_hash for update;
  if not found then raise exception 'private upload session unavailable' using errcode = '42501'; end if;
  if v_session.status <> 'pending' or v_session.expires_at <= clock_timestamp() then
    raise exception 'private upload session unavailable' using errcode = '55000';
  end if;
  select * into v_file from public.private_upload_files
    where session_id = p_id and "index" = p_index for update;
  if not found then raise exception 'private upload file unavailable' using errcode = '22023'; end if;
  if v_file.copy_started_at is not null then
    return jsonb_build_object('allowed', false, 'copy_started_at', v_file.copy_started_at);
  end if;
  v_started := clock_timestamp();
  update public.private_upload_files set copy_started_at = v_started
    where session_id = p_id and "index" = p_index;
  return jsonb_build_object('allowed', true, 'copy_started_at', v_started);
end;
$fn$;

-- Contract: the caller inserts documents through its user-scoped client first.
-- Input IDs must identify exactly one row per manifest file, with all metadata equal.
-- Result: {documents:[{id,storage_path}]}; completed retries return the saved result.
-- A pending session may settle after expiry when those exact rows already exist;
-- copy claims and new document inserts remain unavailable after expiry.
create function public.finalize_private_upload_session(p_id uuid, p_token_hash text, p_document_ids uuid[])
returns jsonb language plpgsql volatile security invoker set search_path = '' as $fn$
declare v_session public.private_upload_sessions%rowtype; v_file public.private_upload_files%rowtype; v_proof jsonb; v_result jsonb;
begin
  if current_user <> 'service_role' then raise exception 'service role required' using errcode = '42501'; end if;
  select * into v_session from public.private_upload_sessions
    where id = p_id and token_hash = p_token_hash for update;
  if not found then raise exception 'private upload session unavailable' using errcode = '42501'; end if;
  if v_session.status = 'completed' then return v_session.result; end if;
  if v_session.status <> 'pending' then
    raise exception 'private upload session unavailable' using errcode = '55000';
  end if;
  if p_document_ids is null or cardinality(p_document_ids) <> v_session.file_count
     or cardinality(p_document_ids) <> (select count(distinct x) from unnest(p_document_ids) x)
     or v_session.file_count <> (select count(*) from public.private_upload_files where session_id = p_id) then
    raise exception 'private upload finalization mismatch' using errcode = '22023';
  end if;
  perform 1 from public.storage_cleanup_queue q
    join public.private_upload_files f on f.session_id = p_id and f.storage_path = q.object_path
    where q.bucket_id = 'claim-docs' order by q.id for update of q;
  if exists (select 1 from public.private_upload_files f where f.session_id = p_id
      and not exists (select 1 from public.storage_cleanup_queue q
        where q.bucket_id = 'claim-docs' and q.object_path = f.storage_path)) then
    raise exception 'private upload cleanup intent unavailable' using errcode = '55000';
  end if;
  if exists (
    select 1 from public.private_upload_files f
    left join public.documents d on d.id = any(p_document_ids) and d.storage_path = f.storage_path
    where f.session_id = p_id and (f.copy_started_at is null or f.verification is null or d.id is null
      or d.claim_id is distinct from v_session.claim_id
      or d.uploaded_by is distinct from v_session.uploaded_by
      or d.original_name is distinct from f.original_name or d.kind is distinct from f.kind
      or d.visibility is distinct from f.visibility or d.mime is distinct from f.mime
      or d.size_bytes is distinct from f.size_bytes)
  ) then raise exception 'private upload finalization mismatch' using errcode = '22023'; end if;
  if (select count(*) from public.documents d where d.id = any(p_document_ids)) <> v_session.file_count then
    raise exception 'private upload finalization mismatch' using errcode = '22023';
  end if;
  for v_file in select * from public.private_upload_files where session_id = p_id order by "index"
  loop
    if v_file.copy_started_at is null or v_file.verification is null
       or (v_file.verification->>'mime') is distinct from v_file.mime
       or (v_file.verification->'size_bytes') is distinct from to_jsonb(v_file.size_bytes) then
      raise exception 'private upload verification failed' using errcode = '22023';
    end if;
    v_proof := v_file.verification;
    perform 1 from storage.objects o
      where o.bucket_id = 'claim-docs' and o.name = v_file.storage_path
        and o.id::text = v_proof->>'object_id' and o.version = v_proof->>'version'
        and o.metadata->>'mimetype' = v_file.mime
        and o.metadata->'size' = to_jsonb(v_file.size_bytes)
      for share;
    if not found then raise exception 'private upload verification failed' using errcode = '55000'; end if;
  end loop;
  select jsonb_build_object('documents', coalesce(jsonb_agg(jsonb_build_object(
    'id', d.id, 'storage_path', d.storage_path) order by f."index"), '[]'::jsonb)) into v_result
  from public.private_upload_files f join public.documents d on d.id = any(p_document_ids)
    and d.storage_path = f.storage_path where f.session_id = p_id;
  update public.private_upload_sessions set status = 'completed', result = v_result, completed_at = clock_timestamp()
    where id = p_id;
  return v_result;
end;
$fn$;

-- Contract: cancel pending sessions without changing either path's cleanup deadline.
-- Result: {status:'cancelled'}; completed sessions return their stored result.
create function public.cancel_private_upload_session(p_id uuid, p_token_hash text)
returns jsonb language plpgsql volatile security invoker set search_path = '' as $fn$
declare v_session public.private_upload_sessions%rowtype;
begin
  if current_user <> 'service_role' then raise exception 'service role required' using errcode = '42501'; end if;
  select * into v_session from public.private_upload_sessions
    where id = p_id and token_hash = p_token_hash for update;
  if not found then raise exception 'private upload session unavailable' using errcode = '42501'; end if;
  if v_session.status = 'completed' then return v_session.result; end if;
  update public.private_upload_sessions set status = 'cancelled' where id = p_id;
  return jsonb_build_object('status', 'cancelled');
end;
$fn$;

-- Contract: reconcile late unreferenced objects after cleanup_after.
-- Result: {checked_files,queued,blocked}; dead cleanup rows remain for operator recovery.
create function public.reconcile_private_upload_cleanup(p_limit integer default 100)
returns jsonb language plpgsql volatile security invoker set search_path = '' as $fn$
declare
  v_file public.private_upload_files%rowtype;
  v_limit integer := least(greatest(coalesce(p_limit, 100), 0), 1000);
  v_now timestamptz := clock_timestamp();
  v_checked integer := 0; v_queued integer := 0; v_blocked integer := 0; v_count integer;
begin
  if current_user <> 'service_role' then raise exception 'service role required' using errcode = '42501'; end if;
  for v_file in
    with candidates as materialized (
      select f.* from public.private_upload_files f
      join public.private_upload_sessions s on s.id = f.session_id
      where s.cleanup_after <= v_now
      order by f.last_reconciled_at nulls first, f.session_id, f."index"
      limit v_limit for update of f skip locked
    ) select * from candidates
  loop
    select count(*)::integer into v_count from storage.objects o
    where o.bucket_id = 'claim-docs' and o.name in (v_file.upload_path, v_file.storage_path)
      and not exists (select 1 from public.documents d where d.storage_path = o.name)
      and exists (select 1 from public.storage_cleanup_queue q
        where q.bucket_id = o.bucket_id and q.object_path = o.name and q.dead_at is not null);
    v_blocked := v_blocked + v_count;
    insert into public.storage_cleanup_queue(bucket_id, object_path, claim_id, next_attempt_at)
    select o.bucket_id, o.name, (select s.claim_id from public.private_upload_sessions s where s.id = v_file.session_id), v_now
    from storage.objects o where o.bucket_id = 'claim-docs' and o.name in (v_file.upload_path, v_file.storage_path)
      and not exists (select 1 from public.documents d where d.storage_path = o.name)
      and not exists (select 1 from public.storage_cleanup_queue q
        where q.bucket_id = o.bucket_id and q.object_path = o.name
          and (q.dead_at is not null or q.processed_at is null))
    on conflict (bucket_id, object_path) where processed_at is null and dead_at is null do nothing;
    get diagnostics v_count = row_count;
    v_queued := v_queued + v_count;
    update public.private_upload_files set last_reconciled_at = v_now
      where session_id = v_file.session_id and "index" = v_file."index";
    v_checked := v_checked + 1;
  end loop;
  return jsonb_build_object('checked_files', v_checked, 'queued', v_queued, 'blocked', v_blocked);
end;
$fn$;

-- Add this session family to the shared queue embargo without changing the worker contract.
create or replace function public.claim_storage_cleanup_batch(
  p_limit integer default 25, p_lease_seconds integer default 300, p_max_attempts integer default 5
) returns table(id bigint, bucket_id text, object_path text, attempts integer)
language plpgsql volatile security invoker set search_path = '' as $fn$
declare v_limit integer := greatest(coalesce(p_limit, 25), 0); v_max integer := greatest(coalesce(p_max_attempts, 5), 1); v_terminal integer := 0;
begin
  with terminal as materialized (
    select c.id from public.storage_cleanup_queue c
    where c.processed_at is null and c.dead_at is null and c.attempts >= v_max and c.next_attempt_at <= now()
      and not exists (select 1 from public.documents d where c.bucket_id = 'claim-docs' and d.storage_path = c.object_path)
      and not exists (select 1 from public.intake_upload_files f join public.intake_upload_sessions s on s.id=f.session_id
        where c.bucket_id='claim-docs' and c.object_path in (f.upload_path,f.storage_path) and s.cleanup_after > now())
      and not exists (select 1 from public.private_upload_files f join public.private_upload_sessions s on s.id=f.session_id
        where c.bucket_id='claim-docs' and c.object_path in (f.upload_path,f.storage_path) and s.cleanup_after > now())
    order by c.next_attempt_at,c.enqueued_at,c.id limit v_limit for update of c skip locked
  )
  update public.storage_cleanup_queue q set dead_at=now(), last_error='Cleanup worker lease expired during the final permitted attempt.'
    from terminal where q.id=terminal.id;
  get diagnostics v_terminal = row_count;
  return query
  with due as materialized (
    select c.id from public.storage_cleanup_queue c
    where c.processed_at is null and c.dead_at is null and c.attempts < v_max and c.next_attempt_at <= now()
      and not exists (select 1 from public.documents d where c.bucket_id='claim-docs' and d.storage_path=c.object_path)
      and not exists (select 1 from public.intake_upload_files f join public.intake_upload_sessions s on s.id=f.session_id
        where c.bucket_id='claim-docs' and c.object_path in (f.upload_path,f.storage_path) and s.cleanup_after > now())
      and not exists (select 1 from public.private_upload_files f join public.private_upload_sessions s on s.id=f.session_id
        where c.bucket_id='claim-docs' and c.object_path in (f.upload_path,f.storage_path) and s.cleanup_after > now())
    order by c.next_attempt_at,c.enqueued_at,c.id limit greatest(v_limit-v_terminal,0) for update of c skip locked
  )
  update public.storage_cleanup_queue q set attempts=q.attempts+1,
    next_attempt_at=now()+make_interval(secs=>greatest(coalesce(p_lease_seconds,300),1))
  from due where q.id=due.id returning q.id,q.bucket_id,q.object_path,q.attempts;
end;
$fn$;

revoke all on function public.begin_private_upload_session(uuid,text,uuid,uuid,jsonb),
  public.claim_private_upload_copy(uuid,text,integer),
  public.finalize_private_upload_session(uuid,text,uuid[]),
  public.cancel_private_upload_session(uuid,text),
  public.reconcile_private_upload_cleanup(integer) from public, anon, authenticated;
grant execute on function public.begin_private_upload_session(uuid,text,uuid,uuid,jsonb),
  public.claim_private_upload_copy(uuid,text,integer),
  public.finalize_private_upload_session(uuid,text,uuid[]),
  public.cancel_private_upload_session(uuid,text),
  public.reconcile_private_upload_cleanup(integer) to service_role;
