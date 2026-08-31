-- Include only inside a rollback-only pgTAP transaction. These helpers create
-- metadata for exact synthetic paths; they never create or remove object bytes.
create function pg_temp.intake_id(p_suite integer, p_number integer)
returns uuid language sql immutable as $test$
  select (lpad(p_suite::text, 2, '0') || '000000-0000-4000-a000-' ||
          lpad(p_number::text, 12, '0'))::uuid;
$test$;

create function pg_temp.intake_hash(p_suite integer, p_number integer)
returns text language sql immutable as $test$
  select lpad(to_hex(p_suite), 2, '0') || lpad(to_hex(p_number), 62, '0');
$test$;

create function pg_temp.intake_submission(p_tag text, p_bad_outbox boolean default false)
returns jsonb language sql immutable as $test$
  select jsonb_build_object(
    'claim', jsonb_build_object('property_street', 'Intake fixture ' || p_tag,
      'property_city', 'Orlando', 'property_state', 'Florida', 'property_zip', '32801',
      'carrier', 'Fixture Carrier', 'policy_number', 'FIXTURE-' || p_tag,
      'carrier_tenure', 'lt_1_year', 'prior_roof_claim', false, 'loss_date', '2026-08-01',
      'cause', 'wind', 'description', 'Synthetic intake session ' || p_tag,
      'lor_contract_type', 'non_emergency'),
    'claimants', jsonb_build_array(jsonb_build_object('first_name', 'Synthetic',
      'last_name', 'Homeowner', 'email', 'intake-' || p_tag || '@example.test',
      'phone', '4075550100', 'initials', 'SH', 'is_primary', true)),
    'consents', jsonb_build_array(jsonb_build_object('email', 'intake-' || p_tag || '@example.test',
      'phone', '4075550100', 'kind', 'email', 'consent_text', 'Synthetic consent fixture')),
    'outbox', jsonb_build_array(jsonb_build_object(
      'recipient_email', case when p_bad_outbox then null else 'intake-' || p_tag || '@example.test' end,
      'template', 'intake_confirmation', 'payload', jsonb_build_object('claimRef', 'pending'),
      'dedupe_key', 'intake-fixture-' || p_tag)),
    'audit', jsonb_build_object('action', 'intake.fixture_committed',
      'meta', jsonb_build_object('fixture', p_tag))
  );
$test$;

create function pg_temp.intake_files(p_id uuid, p_count integer default 1)
returns jsonb language sql immutable as $test$
  select coalesce(jsonb_agg(jsonb_build_object('index', n,
    'upload_path', 'intake/' || p_id::text || '/upload-' || n::text || '.pdf',
    'storage_path', 'intake/' || p_id::text || '/document-' || n::text || '.pdf',
    'original_name', 'fixture-' || n::text || '.pdf', 'mime', 'application/pdf',
    'size_bytes', 12 + n) order by n), '[]'::jsonb)
  from generate_series(0, p_count - 1) f(n);
$test$;

-- A past creation time is test setup, not a mutable production deadline.
-- The ordinary zero-age path always exercises the public begin RPC.
create function pg_temp.seed_intake_session(
  p_suite integer, p_number integer, p_age interval default interval '0',
  p_count integer default 1, p_bad_outbox boolean default false
) returns jsonb language plpgsql security invoker as $test$
declare
  v_id uuid := pg_temp.intake_id(p_suite, p_number);
  v_hash text := pg_temp.intake_hash(p_suite, p_number);
  v_files jsonb := pg_temp.intake_files(v_id, p_count);
  v_submission jsonb := pg_temp.intake_submission(p_suite::text || '-' || p_number::text, p_bad_outbox);
  v_created timestamptz := clock_timestamp() - p_age;
  v_paths text[];
begin
  if exists (select 1 from public.intake_upload_sessions where id = v_id or token_hash = v_hash) then
    raise exception 'intake session fixture already exists';
  end if;
  if p_age = interval '0' then
    return public.begin_intake_upload_session(v_id, v_hash, v_submission, v_files);
  end if;
  select array_agg(p) into v_paths from jsonb_array_elements(v_files) e
    cross join lateral unnest(array[e->>'upload_path', e->>'storage_path']) p;
  if exists (select 1 from public.storage_cleanup_queue where bucket_id='claim-docs' and object_path=any(v_paths))
     or exists (select 1 from public.documents where storage_path=any(v_paths))
     or exists (select 1 from storage.objects where bucket_id='claim-docs' and name=any(v_paths)) then
    raise exception 'intake path fixture already exists';
  end if;
  insert into public.intake_upload_sessions
    (id, token_hash, submission, file_count, created_at, expires_at, sign_until, cleanup_after)
  values (v_id, v_hash, v_submission, p_count, v_created, v_created + interval '2 hours',
    v_created + interval '5 minutes', v_created + interval '2 hours 15 minutes');
  insert into public.intake_upload_files
    (session_id, "index", upload_path, storage_path, original_name, mime, size_bytes)
  select v_id, f."index", f.upload_path, f.storage_path, f.original_name, f.mime, f.size_bytes
  from jsonb_to_recordset(v_files) f("index" integer, upload_path text, storage_path text,
    original_name text, mime text, size_bytes bigint);
  perform public.enqueue_storage_cleanup_exact('claim-docs', array(
    select p from public.intake_upload_files f
      cross join lateral unnest(array[f.upload_path, f.storage_path]) p
    where f.session_id = v_id
  ), null);
  return jsonb_build_object('expires_at', v_created + interval '2 hours',
    'sign_until', v_created + interval '5 minutes', 'cleanup_after', v_created + interval '2 hours 15 minutes');
end;
$test$;

create function pg_temp.claim_intake_copies(p_suite integer, p_number integer)
returns void language plpgsql volatile security invoker as $test$
declare v_index integer;
begin
  for v_index in select "index" from public.intake_upload_files
    where session_id = pg_temp.intake_id(p_suite, p_number) order by "index"
  loop
    perform public.claim_intake_upload_copy(pg_temp.intake_id(p_suite, p_number),
      pg_temp.intake_hash(p_suite, p_number), v_index);
  end loop;
end;
$test$;

create function pg_temp.seed_intake_objects(
  p_suite integer, p_number integer, p_upload boolean default false, p_storage boolean default true,
  p_version text default 'fixture-v1'
) returns void language sql volatile security invoker as $test$
  insert into storage.objects(id, bucket_id, name, metadata, version)
  select gen_random_uuid(), 'claim-docs', p.path,
    jsonb_build_object('mimetype', f.mime, 'size', f.size_bytes), p_version
  from public.intake_upload_files f
  cross join lateral (
    select f.upload_path as path where p_upload
    union all select f.storage_path where p_storage
  ) p
  where f.session_id = pg_temp.intake_id(p_suite, p_number);
$test$;

create function pg_temp.intake_verified(p_suite integer, p_number integer)
returns jsonb language sql stable security invoker as $test$
  select coalesce(jsonb_agg(jsonb_build_object('index', f."index", 'object_id', o.id,
    'version', o.version, 'mime', f.mime, 'size_bytes', f.size_bytes) order by f."index"), '[]'::jsonb)
  from public.intake_upload_files f join storage.objects o
    on o.bucket_id = 'claim-docs' and o.name = f.storage_path
  where f.session_id = pg_temp.intake_id(p_suite, p_number);
$test$;

create function pg_temp.cache_intake_verifications(p_suite integer, p_number integer)
returns void language sql volatile security invoker as $test$
  update public.intake_upload_files f
  set verification = jsonb_build_object('index', f."index", 'object_id', o.id,
    'version', o.version, 'mime', f.mime, 'size_bytes', f.size_bytes)
  from storage.objects o
  where f.session_id = pg_temp.intake_id(p_suite, p_number)
    and o.bucket_id = 'claim-docs' and o.name = f.storage_path;
$test$;
