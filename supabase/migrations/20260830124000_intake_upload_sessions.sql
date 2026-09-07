-- Upload capabilities and claim commits have different lifetimes. Keep their
-- exact paths after expiry so a late Storage upload can still be reconciled.
-- Recovery: stop issuing new sessions and retain these rows and cleanup work.
-- Do not remove path records or shorten deadlines while issued links can work.
create table public.intake_upload_sessions (
  id uuid primary key,
  token_hash text not null unique check (char_length(token_hash) = 64 and token_hash ~ '^[0-9a-f]{64}$'),
  submission jsonb not null check (jsonb_typeof(submission) = 'object'),
  file_count integer not null check (file_count between 0 and 10),
  status text not null default 'pending' check (status in ('pending', 'completed', 'cancelled')),
  result jsonb,
  created_at timestamptz not null,
  expires_at timestamptz not null,
  sign_until timestamptz not null,
  cleanup_after timestamptz not null,
  completed_at timestamptz,
  constraint intake_upload_session_deadlines check (
    expires_at = created_at + interval '2 hours'
    and sign_until = created_at + interval '5 minutes'
    and cleanup_after = created_at + interval '2 hours 15 minutes'
  ),
  constraint intake_upload_session_result check (
    (status = 'completed' and jsonb_typeof(result) = 'object' and result is not null
      and completed_at is not null)
    or (status <> 'completed' and result is null and completed_at is null)
  )
);

create table public.intake_upload_files (
  session_id uuid not null references public.intake_upload_sessions(id) on delete restrict,
  "index" integer not null check ("index" between 0 and 9),
  upload_path text not null unique,
  storage_path text not null unique,
  original_name text not null check (char_length(original_name) between 1 and 200),
  mime text not null check (mime in (
    'application/pdf', 'image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/heif',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
  )),
  size_bytes bigint not null check (size_bytes > 0 and size_bytes <= 26214400),
  copy_started_at timestamptz,
  verification jsonb,
  last_reconciled_at timestamptz,
  primary key (session_id, "index"),
  constraint intake_upload_file_paths check (
    upload_path <> storage_path
    and upload_path ~ ('^intake/' || session_id::text || '/[A-Za-z0-9_-][A-Za-z0-9._:-]*$')
    and storage_path ~ ('^intake/' || session_id::text || '/[A-Za-z0-9_-][A-Za-z0-9._:-]*$')
  ),
  constraint intake_upload_file_verification check (
    verification is null or (
      copy_started_at is not null
      and jsonb_typeof(verification) is not distinct from 'object'
      and verification->'index' is not distinct from to_jsonb("index")
      and verification->'mime' is not distinct from to_jsonb(mime)
      and verification->'size_bytes' is not distinct from to_jsonb(size_bytes)
      and jsonb_typeof(verification->'object_id') is not distinct from 'string'
      and jsonb_typeof(verification->'version') is not distinct from 'string'
      and coalesce(verification->>'object_id', '') <> ''
      and coalesce(verification->>'version', '') <> ''
    )
  )
);

create index intake_upload_files_reconcile_idx
  on public.intake_upload_files(last_reconciled_at nulls first, session_id, "index");
alter table public.intake_upload_sessions enable row level security;
alter table public.intake_upload_files enable row level security;
revoke all on public.intake_upload_sessions, public.intake_upload_files
  from public, anon, authenticated, service_role;
grant select, insert, update on public.intake_upload_sessions, public.intake_upload_files to service_role;

-- A retry must not replace the payload, paths, capability, or cleanup embargo.
-- No automatic retention deletion is authorized. Keep session data until an
-- owner-approved retention process can preserve the minimal path records.
create function private.protect_intake_upload_session()
returns trigger language plpgsql security invoker set search_path = '' as $fn$
begin
  if row(new.id, new.token_hash, new.submission, new.file_count, new.created_at,
         new.expires_at, new.sign_until, new.cleanup_after)
     is distinct from row(old.id, old.token_hash, old.submission, old.file_count, old.created_at,
                          old.expires_at, old.sign_until, old.cleanup_after)
     or (old.status <> 'pending' and row(new.status, new.result, new.completed_at)
         is distinct from row(old.status, old.result, old.completed_at)) then
    raise exception 'intake upload session is immutable' using errcode = '55000';
  end if;
  return new;
end;
$fn$;
create trigger intake_upload_sessions_protect_update before update on public.intake_upload_sessions
for each row execute function private.protect_intake_upload_session();
revoke all on function private.protect_intake_upload_session() from public, anon, authenticated;

create function private.protect_intake_upload_file()
returns trigger language plpgsql security invoker set search_path = '' as $fn$
declare v_session public.intake_upload_sessions%rowtype;
begin
  if tg_op = 'INSERT' then
    select * into v_session from public.intake_upload_sessions
      where id = new.session_id for update;
    if not found or v_session.status <> 'pending' or new."index" >= v_session.file_count
       or exists (select 1 from public.intake_upload_files f
                  where f.upload_path = new.storage_path or f.storage_path = new.upload_path) then
      raise exception 'invalid intake upload manifest' using errcode = '22023';
    end if;
    return new;
  end if;
  if row(new.session_id, new."index", new.upload_path, new.storage_path,
         new.original_name, new.mime, new.size_bytes)
     is distinct from row(old.session_id, old."index", old.upload_path, old.storage_path,
                          old.original_name, old.mime, old.size_bytes)
     or (old.copy_started_at is not null and new.copy_started_at is distinct from old.copy_started_at)
     or (old.verification is not null and new.verification is distinct from old.verification) then
    raise exception 'intake upload manifest is immutable' using errcode = '55000';
  end if;
  return new;
end;
$fn$;
create trigger intake_upload_files_protect_update before insert or update on public.intake_upload_files
for each row execute function private.protect_intake_upload_file();
revoke all on function private.protect_intake_upload_file() from public, anon, authenticated;

create function public.begin_intake_upload_session(
  p_id uuid, p_token_hash text, p_submission jsonb, p_files jsonb
) returns jsonb language plpgsql volatile security invoker set search_path = '' as $fn$
declare
  v_session public.intake_upload_sessions%rowtype;
  v_now timestamptz := clock_timestamp();
  v_count integer;
  v_inserted integer;
  v_paths text[];
  v_manifest jsonb;
  v_existing jsonb;
begin
  if current_user <> 'service_role' then
    raise exception 'service role required' using errcode = '42501';
  end if;
  if p_id is null or p_token_hash is null or char_length(p_token_hash) <> 64
     or p_token_hash !~ '^[0-9a-f]{64}$'
     or jsonb_typeof(p_submission) is distinct from 'object'
     or jsonb_typeof(p_submission->'claim') is distinct from 'object'
     or jsonb_typeof(p_submission->'claimants') is distinct from 'array'
     or jsonb_typeof(p_submission->'consents') is distinct from 'array'
     or jsonb_typeof(p_submission->'outbox') is distinct from 'array'
     or jsonb_typeof(p_files) is distinct from 'array' then
    raise exception 'invalid intake upload session' using errcode = '22023';
  end if;
  v_count := jsonb_array_length(p_files);
  if v_count > 10 or exists (
    select 1 from jsonb_array_elements(p_files) e
    where jsonb_typeof(e) is distinct from 'object'
       or jsonb_typeof(e->'index') is distinct from 'number'
       or jsonb_typeof(e->'upload_path') is distinct from 'string'
       or jsonb_typeof(e->'storage_path') is distinct from 'string'
       or jsonb_typeof(e->'original_name') is distinct from 'string'
       or jsonb_typeof(e->'mime') is distinct from 'string'
       or jsonb_typeof(e->'size_bytes') is distinct from 'number'
  ) then
    raise exception 'invalid intake upload manifest' using errcode = '22023';
  end if;
  if exists (
    select 1 from jsonb_array_elements(p_files) e
    where (e->>'index')::numeric < 0 or (e->>'index')::numeric >= v_count
       or (e->>'index')::numeric <> trunc((e->>'index')::numeric)
       or (e->>'size_bytes')::numeric <= 0 or (e->>'size_bytes')::numeric > 26214400
       or (e->>'size_bytes')::numeric <> trunc((e->>'size_bytes')::numeric)
  ) then
    raise exception 'invalid intake upload manifest' using errcode = '22023';
  end if;
  select coalesce(jsonb_agg(jsonb_build_object(
    'index', f."index", 'upload_path', f.upload_path, 'storage_path', f.storage_path,
    'original_name', f.original_name, 'mime', f.mime, 'size_bytes', f.size_bytes
  ) order by f."index"), '[]'::jsonb) into v_manifest
  from jsonb_to_recordset(p_files) f("index" integer, upload_path text, storage_path text,
    original_name text, mime text, size_bytes bigint);
  select array_agg(path order by path) into v_paths from (
    select e->>'upload_path' as path from jsonb_array_elements(v_manifest) e
    union all select e->>'storage_path' from jsonb_array_elements(v_manifest) e
  ) paths;
  if (select count(distinct e->'index') from jsonb_array_elements(v_manifest) e) <> v_count
     or (select count(distinct p) from unnest(v_paths) p) <> 2 * v_count then
    raise exception 'invalid intake upload manifest' using errcode = '22023';
  end if;

  insert into public.intake_upload_sessions
    (id, token_hash, submission, file_count, created_at, expires_at, sign_until, cleanup_after)
  values (p_id, p_token_hash, p_submission, v_count, v_now,
    v_now + interval '2 hours', v_now + interval '5 minutes', v_now + interval '2 hours 15 minutes')
  on conflict (id) do nothing;
  get diagnostics v_inserted = row_count;
  select * into v_session from public.intake_upload_sessions where id = p_id for update;
  if v_session.token_hash is distinct from p_token_hash
     or v_session.submission is distinct from p_submission then
    raise exception 'intake upload session mismatch' using errcode = '55000';
  end if;
  if v_inserted = 0 then
    select coalesce(jsonb_agg(jsonb_build_object(
      'index', f."index", 'upload_path', f.upload_path, 'storage_path', f.storage_path,
      'original_name', f.original_name, 'mime', f.mime, 'size_bytes', f.size_bytes
    ) order by f."index"), '[]'::jsonb) into v_existing
    from public.intake_upload_files f where f.session_id = p_id;
    if v_existing is distinct from v_manifest then
      raise exception 'intake upload session mismatch' using errcode = '55000';
    end if;
  else
    -- Fresh capabilities never reuse an object name with a previous lifetime.
    if exists (select 1 from public.storage_cleanup_queue
               where bucket_id = 'claim-docs' and object_path = any(v_paths))
       or exists (select 1 from public.documents where storage_path = any(v_paths))
       or exists (select 1 from storage.objects
                  where bucket_id = 'claim-docs' and name = any(v_paths)) then
      raise exception 'intake upload path unavailable' using errcode = '55000';
    end if;
    insert into public.intake_upload_files
      (session_id, "index", upload_path, storage_path, original_name, mime, size_bytes)
    select p_id, f."index", f.upload_path, f.storage_path, f.original_name, f.mime, f.size_bytes
    from jsonb_to_recordset(v_manifest) f("index" integer, upload_path text, storage_path text,
      original_name text, mime text, size_bytes bigint);
    -- Queue rows exist before any signed link leaves the server. The worker's
    -- manifest embargo, not this helper's 15-minute default, controls deletion.
    perform public.enqueue_storage_cleanup_exact('claim-docs', coalesce(v_paths, array[]::text[]), null);
  end if;
  return jsonb_build_object('expires_at', v_session.expires_at,
    'sign_until', v_session.sign_until, 'cleanup_after', v_session.cleanup_after);
end;
$fn$;

-- A Storage copy request can outlive its response. Never grant another copy to
-- the same destination, even after a timeout. A retry may inspect that exact
-- destination; an unresolved copy requires cancellation and a new session.
create function public.claim_intake_upload_copy(p_id uuid, p_token_hash text, p_index integer)
returns jsonb language plpgsql volatile security invoker set search_path = '' as $fn$
declare
  v_session public.intake_upload_sessions%rowtype;
  v_file public.intake_upload_files%rowtype;
  v_started timestamptz;
begin
  if current_user <> 'service_role' then
    raise exception 'service role required' using errcode = '42501';
  end if;
  select * into v_session from public.intake_upload_sessions
    where id = p_id and token_hash = p_token_hash for update;
  if not found then
    raise exception 'intake upload session unavailable' using errcode = '42501';
  end if;
  if v_session.status <> 'pending' or v_session.expires_at <= clock_timestamp() then
    raise exception 'intake upload session unavailable' using errcode = '55000';
  end if;
  select * into v_file from public.intake_upload_files
    where session_id = p_id and "index" = p_index for update;
  if not found then
    raise exception 'intake upload file unavailable' using errcode = '22023';
  end if;
  if v_session.expires_at <= clock_timestamp() then
    raise exception 'intake upload session unavailable' using errcode = '55000';
  end if;
  if v_file.copy_started_at is not null then
    return jsonb_build_object('allowed', false, 'copy_started_at', v_file.copy_started_at);
  end if;
  v_started := clock_timestamp();
  update public.intake_upload_files set copy_started_at = v_started
    where session_id = p_id and "index" = p_index;
  return jsonb_build_object('allowed', true, 'copy_started_at', v_started);
end;
$fn$;

create function public.finalize_intake_upload_session(
  p_id uuid, p_token_hash text, p_verified jsonb
) returns jsonb language plpgsql volatile security invoker set search_path = '' as $fn$
declare
  v_session public.intake_upload_sessions%rowtype;
  v_file public.intake_upload_files%rowtype;
  v_verified jsonb;
  v_documents jsonb;
  v_result jsonb;
begin
  if current_user <> 'service_role' then
    raise exception 'service role required' using errcode = '42501';
  end if;
  select * into v_session from public.intake_upload_sessions
    where id = p_id and token_hash = p_token_hash for update;
  if not found then
    raise exception 'intake upload session unavailable' using errcode = '42501';
  end if;
  -- A lost commit response remains recoverable after expiry or object removal.
  if v_session.status = 'completed' then return v_session.result; end if;
  if v_session.status <> 'pending' or v_session.expires_at <= clock_timestamp() then
    raise exception 'intake upload session unavailable' using errcode = '55000';
  end if;
  if jsonb_typeof(p_verified) is distinct from 'array' then
    raise exception 'intake upload verification failed' using errcode = '22023';
  end if;
  if jsonb_array_length(p_verified) <> v_session.file_count or v_session.file_count <>
     (select count(*) from public.intake_upload_files where session_id = p_id) then
    raise exception 'intake upload verification failed' using errcode = '22023';
  end if;

  -- Keep the same queue-first order as document attachment. These existing
  -- intents serialize attachment with cleanup; missing rows would not do so.
  perform 1 from public.storage_cleanup_queue q
    join public.intake_upload_files f on f.session_id = p_id and f.storage_path = q.object_path
    where q.bucket_id = 'claim-docs' order by q.id for update of q;
  if exists (
    select 1 from public.intake_upload_files f where f.session_id = p_id
      and not exists (select 1 from public.storage_cleanup_queue q
                      where q.bucket_id = 'claim-docs' and q.object_path = f.storage_path)
  ) then
    raise exception 'intake upload cleanup intent unavailable' using errcode = '55000';
  end if;
  for v_file in select * from public.intake_upload_files where session_id = p_id order by "index"
  loop
    if v_file.copy_started_at is null then
      raise exception 'intake upload copy unavailable' using errcode = '55000';
    end if;
    select e into v_verified from jsonb_array_elements(p_verified) e
      where e->'index' = to_jsonb(v_file."index");
    if not found or v_file.verification is null or v_verified is distinct from v_file.verification
       or jsonb_typeof(v_verified->'object_id') is distinct from 'string'
       or jsonb_typeof(v_verified->'version') is distinct from 'string'
       or coalesce(v_verified->>'version', '') = ''
       or (v_verified->>'mime') is distinct from v_file.mime
       or (v_verified->'size_bytes') is distinct from to_jsonb(v_file.size_bytes) then
      raise exception 'intake upload verification failed' using errcode = '22023';
    end if;
    -- Only the server can write the copy destination. The caller verifies its
    -- bytes first; this read lock preserves that exact generation until commit.
    perform 1 from storage.objects o
      where o.bucket_id = 'claim-docs' and o.name = v_file.storage_path
        and o.id::text = v_verified->>'object_id' and o.version = v_verified->>'version'
        and o.metadata->>'mimetype' = v_file.mime
        and o.metadata->'size' = to_jsonb(v_file.size_bytes)
      for share;
    if not found then
      raise exception 'intake upload verification failed' using errcode = '55000';
    end if;
  end loop;
  -- Include time spent waiting for row locks in the finalization deadline.
  if v_session.expires_at <= clock_timestamp() then
    raise exception 'intake upload session unavailable' using errcode = '55000';
  end if;
  select coalesce(jsonb_agg(jsonb_build_object(
    'storage_path', f.storage_path, 'original_name', f.original_name,
    'kind', 'other', 'mime', f.mime, 'size_bytes', f.size_bytes, 'visibility', 'customer'
  ) order by f."index"), '[]'::jsonb) into v_documents
  from public.intake_upload_files f where f.session_id = p_id;
  v_result := public.submit_claim_transaction(
    v_session.submission->'claim', v_session.submission->'claimants',
    v_session.submission->'consents', v_documents, v_session.submission->'outbox',
    null, v_session.submission->'audit'
  );
  update public.intake_upload_sessions
    set status = 'completed', result = v_result, completed_at = clock_timestamp() where id = p_id;
  return v_result;
end;
$fn$;

create function public.cancel_intake_upload_session(p_id uuid, p_token_hash text)
returns jsonb language plpgsql volatile security invoker set search_path = '' as $fn$
declare v_session public.intake_upload_sessions%rowtype;
begin
  if current_user <> 'service_role' then
    raise exception 'service role required' using errcode = '42501';
  end if;
  select * into v_session from public.intake_upload_sessions
    where id = p_id and token_hash = p_token_hash for update;
  if not found then
    raise exception 'intake upload session unavailable' using errcode = '42501';
  end if;
  if v_session.status = 'completed' then
    return jsonb_build_object('status', 'completed', 'result', v_session.result);
  end if;
  update public.intake_upload_sessions set status = 'cancelled' where id = p_id;
  return jsonb_build_object('status', 'cancelled');
end;
$fn$;

revoke all on function public.begin_intake_upload_session(uuid, text, jsonb, jsonb),
  public.claim_intake_upload_copy(uuid, text, integer),
  public.finalize_intake_upload_session(uuid, text, jsonb),
  public.cancel_intake_upload_session(uuid, text) from public, anon, authenticated;
grant execute on function public.begin_intake_upload_session(uuid, text, jsonb, jsonb),
  public.claim_intake_upload_copy(uuid, text, integer),
  public.finalize_intake_upload_session(uuid, text, jsonb),
  public.cancel_intake_upload_session(uuid, text) to service_role;
