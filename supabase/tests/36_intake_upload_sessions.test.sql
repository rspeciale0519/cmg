-- All session and Storage metadata fixtures roll back. No object bytes exist.
begin;
set local client_min_messages = warning;
create extension if not exists pgtap with schema extensions;
set local search_path = public, extensions;
select plan(115);
\ir support/36_intake_upload_fixtures.inc

select has_table('public', 'intake_upload_sessions', 'upload sessions exist');
select has_table('public', 'intake_upload_files', 'upload manifests exist');
select ok((select bool_and(relrowsecurity) from pg_class
  where oid in ('public.intake_upload_sessions'::regclass, 'public.intake_upload_files'::regclass)),
  'RLS remains active on both service-only tables');
select ok(not exists (
  select 1 from unnest(array['anon', 'authenticated']) r
  cross join unnest(array['public.intake_upload_sessions', 'public.intake_upload_files']) t
  where has_table_privilege(r, t, 'SELECT,INSERT,UPDATE,DELETE,TRUNCATE,REFERENCES,TRIGGER')
), 'anonymous and authenticated roles have no manifest or session table privileges');
select ok(has_function_privilege('service_role', signature, 'EXECUTE')
  and not has_function_privilege('anon', signature, 'EXECUTE')
  and not has_function_privilege('authenticated', signature, 'EXECUTE'), label)
from (values
  ('public.begin_intake_upload_session(uuid,text,jsonb,jsonb)', 'only the service role can begin a session'),
  ('public.claim_intake_upload_copy(uuid,text,integer)', 'only the service role can reserve a copy'),
  ('public.finalize_intake_upload_session(uuid,text,jsonb)', 'only the service role can finalize a session'),
  ('public.cancel_intake_upload_session(uuid,text)', 'only the service role can cancel a session'),
  ('public.reconcile_intake_upload_cleanup(integer)', 'only the service role can reconcile exact paths')
) rpc(signature, label);
select ok((select bool_and(not prosecdef and proconfig = array['search_path=""']::text[])
  from pg_proc where oid in (
    'public.begin_intake_upload_session(uuid,text,jsonb,jsonb)'::regprocedure,
    'public.claim_intake_upload_copy(uuid,text,integer)'::regprocedure,
    'public.finalize_intake_upload_session(uuid,text,jsonb)'::regprocedure,
    'public.cancel_intake_upload_session(uuid,text)'::regprocedure,
    'public.reconcile_intake_upload_cleanup(integer)'::regprocedure)),
  'session RPCs keep the service invoker and an empty search path');
select ok(not has_table_privilege('service_role', 'public.intake_upload_files', 'DELETE')
  and not has_table_privilege('service_role', 'public.intake_upload_sessions', 'DELETE'),
  'ordinary service calls cannot remove retained session paths');

set local role authenticated;
select throws_ok($$select * from public.intake_upload_sessions$$, '42501', null,
  'an authenticated request cannot read session payloads or capability hashes');
select throws_ok($$select public.finalize_intake_upload_session(
  '36000000-0000-4000-a000-000000000001', repeat('0', 64), '[]')$$, '42501', null,
  'an authenticated request cannot enter the finalizer');
reset role;
set local role service_role;

create temporary table intake_results(label text primary key, value jsonb) on commit drop;
insert into intake_results values ('begin', pg_temp.seed_intake_session(36, 1, interval '0', 2));
select is((select status from public.intake_upload_sessions where id = pg_temp.intake_id(36, 1)),
  'pending', 'begin creates one pending session');
select is((select submission from public.intake_upload_sessions where id = pg_temp.intake_id(36, 1)),
  pg_temp.intake_submission('36-1'), 'begin stores the validated submission unchanged');
select is((select file_count from public.intake_upload_sessions where id = pg_temp.intake_id(36, 1)),
  2, 'the immutable count fixes the number of manifest slots');
select is((select count(*)::integer from public.intake_upload_files where session_id = pg_temp.intake_id(36, 1)),
  2, 'begin stores both manifest files');
select ok((select expires_at = created_at + interval '2 hours'
  and sign_until = created_at + interval '5 minutes'
  and cleanup_after = created_at + interval '2 hours 15 minutes'
  from public.intake_upload_sessions where id = pg_temp.intake_id(36, 1)),
  'finalization, signing, and cleanup deadlines remain separate and fixed');
select is((select count(*)::integer from public.storage_cleanup_queue
  where bucket_id = 'claim-docs' and object_path like 'intake/' || pg_temp.intake_id(36, 1)::text || '/%'
    and attempts = 0 and processed_at is null and dead_at is null),
  4, 'both exact paths have untouched cleanup intents before signing');
select is(public.begin_intake_upload_session(pg_temp.intake_id(36, 1), pg_temp.intake_hash(36, 1),
    pg_temp.intake_submission('36-1'), pg_temp.intake_files(pg_temp.intake_id(36, 1), 2)),
  (select value from intake_results where label = 'begin'), 'a begin retry returns the original deadlines');
select is((select count(*)::integer from public.storage_cleanup_queue
  where bucket_id = 'claim-docs' and object_path like 'intake/' || pg_temp.intake_id(36, 1)::text || '/%'),
  4, 'a begin retry does not add cleanup work');

-- Every rejected call rolls back its attempted session and exact intents.
select throws_ok(format('select public.begin_intake_upload_session(%L::uuid,%L,%L::jsonb,%L::jsonb)',
    pg_temp.intake_id(36, 11), pg_temp.intake_hash(36, 11), pg_temp.intake_submission('36-11'), files),
  error_code, null, label)
from (values
  ('null'::jsonb, '22023', 'a null file list is refused'),
  ('{}'::jsonb, '22023', 'a non-array file list is refused'),
  (pg_temp.intake_files(pg_temp.intake_id(36, 11), 11), '22023', 'an eleventh file is refused'),
  (jsonb_set(pg_temp.intake_files(pg_temp.intake_id(36, 11), 2), '{1,index}', '0'),
    '22023', 'duplicate file indexes are refused'),
  (jsonb_set(pg_temp.intake_files(pg_temp.intake_id(36, 11), 1), '{0,size_bytes}', '0'),
    '22023', 'empty file bytes are refused'),
  (jsonb_set(pg_temp.intake_files(pg_temp.intake_id(36, 11), 1), '{0,size_bytes}', '26214401'),
    '22023', 'a file above the existing 25 MiB limit is refused'),
  (jsonb_set(pg_temp.intake_files(pg_temp.intake_id(36, 11), 1), '{0,size_bytes}', '12.5'),
    '22023', 'a fractional byte size is refused'),
  (jsonb_set(pg_temp.intake_files(pg_temp.intake_id(36, 11), 1), '{0,mime}', '"text/html"'),
    '23514', 'a MIME type outside the document allowlist is refused'),
  (jsonb_set(pg_temp.intake_files(pg_temp.intake_id(36, 11), 1), '{0,storage_path}',
    to_jsonb('intake/' || pg_temp.intake_id(36, 12)::text || '/copy.pdf')),
    '23514', 'a destination under another session is refused'),
  (jsonb_set(pg_temp.intake_files(pg_temp.intake_id(36, 11), 1), '{0,upload_path}',
    to_jsonb('intake/' || pg_temp.intake_id(36, 11)::text || '/../copy.pdf')),
    '23514', 'a noncanonical staging path is refused'),
  (jsonb_set(pg_temp.intake_files(pg_temp.intake_id(36, 11), 2), '{1,upload_path}',
    to_jsonb('intake/' || pg_temp.intake_id(36, 11)::text || '/document-0.pdf')),
    '22023', 'one file cannot upload into another file destination'),
  (jsonb_set(pg_temp.intake_files(pg_temp.intake_id(36, 11), 1), '{0,upload_path}',
    to_jsonb('intake/' || pg_temp.intake_id(36, 11)::text || '/document-0.pdf')),
    '22023', 'staging and destination paths must differ')
) bad_manifest(files, error_code, label);
select is((select count(*)::integer from public.intake_upload_sessions where id = pg_temp.intake_id(36, 11)),
  0, 'invalid manifests leave no partial session');
select throws_ok($$select public.begin_intake_upload_session(pg_temp.intake_id(36, 11),
  repeat('a', 64) || chr(10), pg_temp.intake_submission('36-11'), '[]')$$,
  '22023', 'invalid intake upload session', 'capability hashes reject a trailing line terminator');
select throws_ok($$select public.begin_intake_upload_session(pg_temp.intake_id(36, 11),
  pg_temp.intake_hash(36, 11), '{}'::jsonb, '[]')$$,
  '22023', 'invalid intake upload session', 'a session requires the complete stored transaction payload');
select throws_ok($$select public.begin_intake_upload_session(pg_temp.intake_id(36, 1),
  pg_temp.intake_hash(36, 2), pg_temp.intake_submission('36-1'), pg_temp.intake_files(pg_temp.intake_id(36, 1), 2))$$,
  '55000', 'intake upload session mismatch', 'a begin retry cannot replace its capability');
select throws_ok($$select public.begin_intake_upload_session(pg_temp.intake_id(36, 1),
  pg_temp.intake_hash(36, 1), pg_temp.intake_submission('changed'), pg_temp.intake_files(pg_temp.intake_id(36, 1), 2))$$,
  '55000', 'intake upload session mismatch', 'a begin retry cannot replace its submission');
select throws_ok($$select public.begin_intake_upload_session(pg_temp.intake_id(36, 1),
  pg_temp.intake_hash(36, 1), pg_temp.intake_submission('36-1'),
  jsonb_set(pg_temp.intake_files(pg_temp.intake_id(36, 1), 2), '{0,original_name}', '"changed.pdf"'))$$,
  '55000', 'intake upload session mismatch', 'a begin retry cannot replace its manifest');
select throws_ok($$update public.intake_upload_sessions set submission = '{}' where id = pg_temp.intake_id(36, 1)$$,
  '55000', 'intake upload session is immutable', 'the stored submission cannot change directly');
select throws_ok($$update public.intake_upload_sessions set cleanup_after = cleanup_after + interval '1 hour'
  where id = pg_temp.intake_id(36, 1)$$, '55000', 'intake upload session is immutable',
  'the cleanup embargo cannot change directly');
select throws_ok($$update public.intake_upload_sessions set file_count = 3 where id = pg_temp.intake_id(36, 1)$$,
  '55000', 'intake upload session is immutable', 'the manifest cannot gain another slot');
select throws_ok($$update public.intake_upload_files set size_bytes = 20 where session_id = pg_temp.intake_id(36, 1)$$,
  '55000', 'intake upload manifest is immutable', 'manifest metadata cannot change directly');
select throws_ok($$insert into public.intake_upload_files(session_id,"index",upload_path,storage_path,original_name,mime,size_bytes)
  values(pg_temp.intake_id(36, 1),2,'intake/36000000-0000-4000-a000-000000000001/late-upload.pdf',
  'intake/36000000-0000-4000-a000-000000000001/late-copy.pdf','late.pdf','application/pdf',1)$$,
  '22023', 'invalid intake upload manifest', 'new files cannot enter a sealed manifest');

do $setup$
begin
  perform public.enqueue_storage_cleanup_exact('claim-docs', array[
    'intake/' || pg_temp.intake_id(36, 12)::text || '/document-0.pdf'], null);
  perform pg_temp.claim_intake_copies(36, 1);
  perform pg_temp.seed_intake_objects(36, 1, true, true);
  perform pg_temp.cache_intake_verifications(36, 1);
end;
$setup$;
select throws_ok($$select pg_temp.seed_intake_session(36, 12)$$,
  '55000', 'intake upload path unavailable', 'a fresh session cannot reuse an earlier cleanup path');
insert into intake_results values ('verified', pg_temp.intake_verified(36, 1));

select throws_ok(format('select public.finalize_intake_upload_session(%L::uuid,%L,%L::jsonb)',
    pg_temp.intake_id(36, 1), pg_temp.intake_hash(36, 1), bad_proof.proof), error_code, null, label)
from (select value as proof from intake_results where label = 'verified') base
cross join lateral (values
  (base.proof - 1, '22023', 'missing verified files are refused'),
  (base.proof || jsonb_set(base.proof->0, '{index}', '2'), '22023', 'extra verified files are refused'),
  (jsonb_build_array(base.proof->0, base.proof->0), '22023', 'duplicate proofs cannot replace a missing file'),
  ('{}'::jsonb, '22023', 'a non-array proof is refused'),
  (jsonb_set(base.proof, '{0,object_id}', to_jsonb(pg_temp.intake_id(36, 99)::text)),
    '22023', 'a proof must name the stored copied object ID'),
  (jsonb_set(base.proof, '{0,object_id}', to_jsonb((select id::text from storage.objects
    where bucket_id = 'claim-docs' and name = 'intake/' || pg_temp.intake_id(36, 1)::text || '/upload-0.pdf'))),
    '22023', 'a staging object cannot stand in for the private destination'),
  (jsonb_set(base.proof, '{0,version}', '"old-version"'), '22023', 'a proof must name the stored copied version'),
  (jsonb_set(base.proof, '{0,mime}', '"image/png"'), '22023', 'proof MIME must match the immutable manifest'),
  (jsonb_set(base.proof, '{0,size_bytes}', '13'), '22023', 'proof size must match the immutable manifest'),
  (jsonb_set(base.proof, '{0,index}', '"0"'), '22023', 'a string index is not a manifest index'),
  (jsonb_set(base.proof, '{0,version}', '""'), '22023', 'an empty version cannot be verified')
) bad_proof(proof, error_code, label);
select is((select count(*)::integer from public.claims where description = 'Synthetic intake session 36-1'),
  0, 'rejected proofs create no claim');
select is((select status from public.intake_upload_sessions where id = pg_temp.intake_id(36, 1)),
  'pending', 'rejected proofs leave the session available for a valid retry');

update storage.objects set version = 'fixture-v2'
  where bucket_id = 'claim-docs' and name = 'intake/' || pg_temp.intake_id(36, 1)::text || '/document-0.pdf';
select throws_ok($$select public.finalize_intake_upload_session(pg_temp.intake_id(36, 1),
  pg_temp.intake_hash(36, 1), (select value from intake_results where label='verified'))$$,
  '55000', 'intake upload verification failed', 'a generation change after byte verification is refused');
update storage.objects set version = 'fixture-v1', metadata = jsonb_build_object('mimetype','image/png','size',12)
  where bucket_id = 'claim-docs' and name = 'intake/' || pg_temp.intake_id(36, 1)::text || '/document-0.pdf';
select throws_ok($$select public.finalize_intake_upload_session(pg_temp.intake_id(36, 1),
  pg_temp.intake_hash(36, 1), (select value from intake_results where label='verified'))$$,
  '55000', 'intake upload verification failed', 'current Storage MIME must still match the manifest');
update storage.objects set metadata = jsonb_build_object('mimetype','application/pdf','size',13)
  where bucket_id = 'claim-docs' and name = 'intake/' || pg_temp.intake_id(36, 1)::text || '/document-0.pdf';
select throws_ok($$select public.finalize_intake_upload_session(pg_temp.intake_id(36, 1),
  pg_temp.intake_hash(36, 1), (select value from intake_results where label='verified'))$$,
  '55000', 'intake upload verification failed', 'current Storage size must still match the manifest');
update storage.objects set metadata = jsonb_build_object('mimetype','application/pdf','size',12)
  where bucket_id = 'claim-docs' and name = 'intake/' || pg_temp.intake_id(36, 1)::text || '/document-0.pdf';
update storage.objects set id = pg_temp.intake_id(36, 98)
  where bucket_id = 'claim-docs' and name = 'intake/' || pg_temp.intake_id(36, 1)::text || '/document-0.pdf';
select throws_ok($$select public.finalize_intake_upload_session(pg_temp.intake_id(36, 1),
  pg_temp.intake_hash(36, 1), (select value from intake_results where label='verified'))$$,
  '55000', 'intake upload verification failed', 'an object ID change after byte verification is refused');
update storage.objects set id = (select (value->0->>'object_id')::uuid from intake_results where label='verified')
  where bucket_id = 'claim-docs' and name = 'intake/' || pg_temp.intake_id(36, 1)::text || '/document-0.pdf';

insert into intake_results values ('committed', public.finalize_intake_upload_session(
  pg_temp.intake_id(36, 1), pg_temp.intake_hash(36, 1), (select value from intake_results where label = 'verified')));
select is((select result from public.intake_upload_sessions where id = pg_temp.intake_id(36, 1)),
  (select value from intake_results where label = 'committed'), 'the claim result and session commit together');
select is((select status from public.intake_upload_sessions where id = pg_temp.intake_id(36, 1)),
  'completed', 'valid destination proofs complete the session');
select is((select count(*)::integer from public.documents
  where claim_id = (select (value->>'id')::uuid from intake_results where label = 'committed')
    and storage_path like 'intake/' || pg_temp.intake_id(36, 1)::text || '/document-%'
    and kind = 'other' and visibility = 'customer'),
  2, 'the transaction attaches only the two manifest destinations');
select is((select count(*)::integer from public.documents
  where storage_path like 'intake/' || pg_temp.intake_id(36, 1)::text || '/upload-%'),
  0, 'signed staging paths never become attached documents');
select is((select count(*)::integer from public.storage_cleanup_queue
  where bucket_id = 'claim-docs' and object_path like 'intake/' || pg_temp.intake_id(36, 1)::text || '/document-%'
    and processed_at is not null and attempts = 0),
  2, 'document insertion settles untouched destination intents');
select is((select count(*)::integer from public.claimants
  where claim_id = (select (value->>'id')::uuid from intake_results where label = 'committed')),
  1, 'the committed claim includes its claimant');
select is((select count(*)::integer from public.consents where email = 'intake-36-1@example.test'),
  1, 'the committed claim includes its consent');
select is((select count(*)::integer from public.notifications_outbox where dedupe_key = 'intake-fixture-36-1'),
  1, 'the committed claim includes one outbox item');
select is((select count(*)::integer from public.audit_log
  where entity_id = (select (value->>'id')::uuid from intake_results where label = 'committed')
    and action = 'intake.fixture_committed'),
  1, 'the committed claim includes its requested audit');
select is(public.finalize_intake_upload_session(pg_temp.intake_id(36, 1), pg_temp.intake_hash(36, 1), '[]'),
  (select value from intake_results where label = 'committed'), 'a lost response replays the committed result before proof validation');
select is(public.cancel_intake_upload_session(pg_temp.intake_id(36, 1), pg_temp.intake_hash(36, 1)),
  jsonb_build_object('status','completed','result',(select value from intake_results where label = 'committed')),
  'cancellation cannot reverse a completed transaction');
select is((select count(*)::integer from public.claims where description = 'Synthetic intake session 36-1'),
  1, 'replay and cancellation cannot create a second claim');
select is((select count(*)::integer from public.notifications_outbox where dedupe_key = 'intake-fixture-36-1'),
  1, 'replay and cancellation cannot add another notification');

do $setup$
begin
  perform pg_temp.seed_intake_session(36, 20, interval '0', 1, true);
  perform pg_temp.claim_intake_copies(36, 20);
  perform pg_temp.seed_intake_objects(36, 20);
  perform pg_temp.cache_intake_verifications(36, 20);
  perform pg_temp.seed_intake_session(36, 21);
  perform pg_temp.claim_intake_copies(36, 21);
  perform pg_temp.seed_intake_objects(36, 21);
  perform pg_temp.cache_intake_verifications(36, 21);
  perform pg_temp.seed_intake_session(36, 22, interval '121 minutes');
  perform pg_temp.seed_intake_objects(36, 22);
  perform pg_temp.seed_intake_session(36, 23);
  perform pg_temp.seed_intake_session(36, 24);
  perform pg_temp.claim_intake_copies(36, 24);
  perform pg_temp.seed_intake_objects(36, 24);
  perform pg_temp.cache_intake_verifications(36, 24);
  perform pg_temp.seed_intake_session(36, 30, interval '3 hours', 0);
end;
$setup$;
select throws_ok($$select public.finalize_intake_upload_session(pg_temp.intake_id(36, 20),
  pg_temp.intake_hash(36, 20), pg_temp.intake_verified(36, 20))$$,
  '23502', null, 'a downstream outbox failure aborts finalization');
select is((select count(*)::integer from public.claims where description = 'Synthetic intake session 36-20'),
  0, 'a failed finalization leaves no partial claim');
select ok(not exists (select 1 from public.claimants where email = 'intake-36-20@example.test')
  and not exists (select 1 from public.consents where email = 'intake-36-20@example.test')
  and not exists (select 1 from public.documents where storage_path like 'intake/' || pg_temp.intake_id(36, 20)::text || '/%'),
  'a failed finalization rolls back claimants, consents, and documents');
select ok((select status = 'pending' and result is null from public.intake_upload_sessions
  where id = pg_temp.intake_id(36, 20)) and (select bool_and(processed_at is null and attempts = 0)
  from public.storage_cleanup_queue where bucket_id = 'claim-docs'
    and object_path like 'intake/' || pg_temp.intake_id(36, 20)::text || '/%'),
  'a failed finalization restores the pending session and cleanup intents');
update public.storage_cleanup_queue set attempts = 1, next_attempt_at = now() + interval '1 hour'
  where bucket_id = 'claim-docs' and object_path = 'intake/' || pg_temp.intake_id(36, 21)::text || '/document-0.pdf';
select throws_ok($$select public.finalize_intake_upload_session(pg_temp.intake_id(36, 21),
  pg_temp.intake_hash(36, 21), pg_temp.intake_verified(36, 21))$$,
  '55000', 'storage cleanup already claimed', 'a claimed cleanup path can never attach after finalization');
select is((select count(*)::integer from public.claims where description = 'Synthetic intake session 36-21'),
  0, 'losing to cleanup leaves no partial claim');
delete from public.storage_cleanup_queue where bucket_id = 'claim-docs'
  and object_path = 'intake/' || pg_temp.intake_id(36, 24)::text || '/document-0.pdf';
select throws_ok($$select public.finalize_intake_upload_session(pg_temp.intake_id(36, 24),
  pg_temp.intake_hash(36, 24), pg_temp.intake_verified(36, 24))$$,
  '55000', 'intake upload cleanup intent unavailable', 'missing cleanup history cannot weaken attachment fencing');
select throws_ok($$select public.finalize_intake_upload_session(pg_temp.intake_id(36, 22),
  pg_temp.intake_hash(36, 22), pg_temp.intake_verified(36, 22))$$,
  '55000', 'intake upload session unavailable', 'an expired pending session cannot create a claim');
select is(public.cancel_intake_upload_session(pg_temp.intake_id(36, 23), pg_temp.intake_hash(36, 23)),
  '{"status":"cancelled"}'::jsonb, 'cancellation closes an uncommitted session');
select throws_ok($$select public.finalize_intake_upload_session(pg_temp.intake_id(36, 23),
  pg_temp.intake_hash(36, 23), '[]')$$,
  '55000', 'intake upload session unavailable', 'a cancelled session cannot create a claim');
select is(public.cancel_intake_upload_session(pg_temp.intake_id(36, 23), pg_temp.intake_hash(36, 23)),
  '{"status":"cancelled"}'::jsonb, 'repeated cancellation keeps the same terminal result');
select throws_ok($$select public.finalize_intake_upload_session(pg_temp.intake_id(36, 1),
  pg_temp.intake_hash(36, 2), '[]')$$,
  '42501', 'intake upload session unavailable', 'a wrong capability cannot recover a completed result');
select throws_ok($$select public.cancel_intake_upload_session(pg_temp.intake_id(36, 99),
  pg_temp.intake_hash(36, 99))$$,
  '42501', 'intake upload session unavailable', 'an unknown capability has the same refusal');
update public.intake_upload_sessions set status = 'completed',
  result = (select value from intake_results where label = 'committed'),
  completed_at = created_at + interval '1 hour'
  where id = pg_temp.intake_id(36, 30);
select is(public.finalize_intake_upload_session(pg_temp.intake_id(36, 30), pg_temp.intake_hash(36, 30), null),
  (select value from intake_results where label = 'committed'),
  'a saved completed result remains recoverable after expiry without any Storage objects');
select throws_ok($$update public.intake_upload_sessions set status='cancelled', result=null, completed_at=null
  where id = pg_temp.intake_id(36, 1)$$, '55000', 'intake upload session is immutable',
  'a terminal session cannot change through a direct service update');

do $setup$
begin
  perform pg_temp.seed_intake_session(36, 40);
  perform pg_temp.seed_intake_session(36, 41, interval '1 hour');
  perform pg_temp.seed_intake_session(36, 42);
  perform pg_temp.seed_intake_objects(36, 42);
  perform pg_temp.seed_intake_session(36, 43);
  perform pg_temp.claim_intake_copies(36, 43);
  perform pg_temp.seed_intake_objects(36, 43);
  perform pg_temp.seed_intake_session(36, 44);
  perform pg_temp.seed_intake_objects(36, 44);
  perform pg_temp.seed_intake_session(36, 45);
  perform pg_temp.claim_intake_copies(36, 45);
end;
$setup$;
insert into intake_results values ('copy', public.claim_intake_upload_copy(
  pg_temp.intake_id(36, 40), pg_temp.intake_hash(36, 40), 0));
select ok((select (value->>'allowed')::boolean and value->>'copy_started_at' is not null
  from intake_results where label='copy'), 'the first copy reservation grants one dispatch');
select is(public.claim_intake_upload_copy(pg_temp.intake_id(36, 40), pg_temp.intake_hash(36, 40), 0),
  jsonb_set((select value from intake_results where label='copy'), '{allowed}', 'false'),
  'a repeated copy reservation returns the original timestamp without another dispatch');
select throws_ok($$update public.intake_upload_files set copy_started_at=null
  where session_id=pg_temp.intake_id(36, 40)$$, '55000', 'intake upload manifest is immutable',
  'a service update cannot reset a reserved copy');
select throws_ok($$update public.intake_upload_files set copy_started_at=copy_started_at+interval '1 second'
  where session_id=pg_temp.intake_id(36, 40)$$, '55000', 'intake upload manifest is immutable',
  'a service update cannot overwrite the copy reservation time');
update public.intake_upload_files f set copy_started_at=s.created_at+interval '1 minute'
  from public.intake_upload_sessions s where s.id=f.session_id and s.id=pg_temp.intake_id(36, 41);
select is(public.claim_intake_upload_copy(pg_temp.intake_id(36, 41), pg_temp.intake_hash(36, 41), 0),
  (select jsonb_build_object('allowed',false,'copy_started_at',copy_started_at)
   from public.intake_upload_files where session_id=pg_temp.intake_id(36, 41)),
  'an old reservation never becomes a reclaimable copy lease');
select throws_ok(format('select public.claim_intake_upload_copy(%L::uuid,%L,0)',
  pg_temp.intake_id(36, n), pg_temp.intake_hash(36, n)),
  '55000', 'intake upload session unavailable', label)
from (values (1,'a completed session refuses another copy'), (22,'an expired session refuses a copy'),
  (23,'a cancelled session refuses a copy')) closed(n,label);
select throws_ok($$select public.claim_intake_upload_copy(pg_temp.intake_id(36,40),pg_temp.intake_hash(36,41),0)$$,
  '42501', 'intake upload session unavailable', 'a copy reservation requires the correct capability');
select throws_ok($$select public.claim_intake_upload_copy(pg_temp.intake_id(36,40),pg_temp.intake_hash(36,40),9)$$,
  '22023', 'intake upload file unavailable', 'a copy reservation requires an exact manifest index');
select throws_ok($$select public.finalize_intake_upload_session(pg_temp.intake_id(36,42),
  pg_temp.intake_hash(36,42),pg_temp.intake_verified(36,42))$$,
  '55000', 'intake upload copy unavailable', 'unreserved destination metadata cannot bypass the copy gate');
select throws_ok($$select public.finalize_intake_upload_session(pg_temp.intake_id(36,43),
  pg_temp.intake_hash(36,43),pg_temp.intake_verified(36,43))$$,
  '22023', 'intake upload verification failed', 'a proof without stored byte verification cannot finalize');
select throws_ok($$select pg_temp.cache_intake_verifications(36,44)$$,
  '23514', null, 'byte verification requires an earlier copy reservation');
do $setup$ begin perform pg_temp.claim_intake_copies(36,44); end; $setup$;
select throws_ok(format('update public.intake_upload_files set verification=%L::jsonb where session_id=%L::uuid',
  proof, pg_temp.intake_id(36,44)), '23514', null, label)
from (values
  (jsonb_set(pg_temp.intake_verified(36,44)->0,'{index}','1'), 'cached verification cannot change the file index'),
  (jsonb_set(pg_temp.intake_verified(36,44)->0,'{mime}','"image/png"'), 'cached verification cannot change the MIME type'),
  (jsonb_set(pg_temp.intake_verified(36,44)->0,'{size_bytes}','13'), 'cached verification cannot change the byte size'),
  (jsonb_set(pg_temp.intake_verified(36,44)->0,'{version}','""'), 'cached verification requires a nonempty version'),
  ('null'::jsonb, 'JSON null is not a verified proof')
) bad_cache(proof,label);
do $setup$ begin perform pg_temp.cache_intake_verifications(36,44); end; $setup$;
select lives_ok($$select pg_temp.cache_intake_verifications(36,44)$$,
  'an identical cached proof can be saved again after an uncertain response');
select throws_ok($$update public.intake_upload_files set verification=null where session_id=pg_temp.intake_id(36,44)$$,
  '55000', 'intake upload manifest is immutable', 'stored byte verification cannot be cleared');
select throws_ok($$update public.intake_upload_files set verification=jsonb_set(verification,'{version}','"replacement"')
  where session_id=pg_temp.intake_id(36,44)$$,
  '55000', 'intake upload manifest is immutable', 'stored byte verification cannot be replaced');
update public.intake_upload_files set verification=jsonb_build_object('index',0,
  'object_id',pg_temp.intake_id(36,99),'version','fixture-v1','mime','application/pdf','size_bytes',12)
  where session_id=pg_temp.intake_id(36,45);
select throws_ok($$select public.finalize_intake_upload_session(pg_temp.intake_id(36,45),pg_temp.intake_hash(36,45),
  (select jsonb_build_array(verification) from public.intake_upload_files where session_id=pg_temp.intake_id(36,45)))$$,
  '55000', 'intake upload verification failed', 'a saved proof cannot substitute for a missing current Storage object');

insert into intake_results values ('empty_begin',pg_temp.seed_intake_session(36,50,interval '0',0));
insert into intake_results values ('empty_commit',public.finalize_intake_upload_session(
  pg_temp.intake_id(36,50),pg_temp.intake_hash(36,50),'[]'));
select ok((select value->>'id' is not null from intake_results where label='empty_commit'),
  'an intake with no optional files can commit');
select is((select count(*)::integer from public.documents where claim_id=
  (select (value->>'id')::uuid from intake_results where label='empty_commit')),
  0, 'an intake with no files creates no document placeholder');
insert into intake_results values ('maximum_begin',public.begin_intake_upload_session(
  pg_temp.intake_id(36,51),pg_temp.intake_hash(36,51),pg_temp.intake_submission('36-51'),
  (select jsonb_agg(jsonb_set(e,'{size_bytes}','26214400'))
   from jsonb_array_elements(pg_temp.intake_files(pg_temp.intake_id(36,51),10)) e)));
select is((select count(*)::integer from public.intake_upload_files
  where session_id=pg_temp.intake_id(36,51) and size_bytes=26214400),
  10, 'the existing ten-file and 25 MiB boundaries remain valid');

select * from finish();
rollback;
