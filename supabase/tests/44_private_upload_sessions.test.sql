-- Rollback-only metadata and Storage object rows. No Storage API bytes are used.
begin;
set local client_min_messages = warning;
create extension if not exists pgtap with schema extensions;
set local search_path = public, extensions;
select plan(28);

select has_table('public', 'private_upload_sessions', 'private upload sessions exist');
select has_table('public', 'private_upload_files', 'private upload manifests exist');
select ok((select bool_and(relrowsecurity) from pg_class where oid in
  ('public.private_upload_sessions'::regclass, 'public.private_upload_files'::regclass)),
  'RLS stays active on both service-only tables');
select ok(not has_table_privilege('anon','public.private_upload_sessions','SELECT,INSERT,UPDATE,DELETE')
  and not has_table_privilege('authenticated','public.private_upload_sessions','SELECT,INSERT,UPDATE,DELETE')
  and not has_table_privilege('anon','public.private_upload_files','SELECT,INSERT,UPDATE,DELETE')
  and not has_table_privilege('authenticated','public.private_upload_files','SELECT,INSERT,UPDATE,DELETE'),
  'anonymous and authenticated roles cannot access manifests');
select ok(not has_table_privilege('service_role','public.private_upload_sessions','DELETE')
  and not has_table_privilege('service_role','public.private_upload_files','DELETE'),
  'normal service calls cannot delete retained session paths');
select ok(has_function_privilege('service_role','public.begin_private_upload_session(uuid,text,uuid,uuid,jsonb)','EXECUTE')
  and has_function_privilege('service_role','public.claim_private_upload_copy(uuid,text,integer)','EXECUTE')
  and has_function_privilege('service_role','public.finalize_private_upload_session(uuid,text,uuid[])','EXECUTE')
  and has_function_privilege('service_role','public.cancel_private_upload_session(uuid,text)','EXECUTE')
  and has_function_privilege('service_role','public.reconcile_private_upload_cleanup(integer)','EXECUTE')
  and not has_function_privilege('anon','public.begin_private_upload_session(uuid,text,uuid,uuid,jsonb)','EXECUTE')
  and not has_function_privilege('authenticated','public.begin_private_upload_session(uuid,text,uuid,uuid,jsonb)','EXECUTE'),
  'only the service role can call the private upload RPCs');
select ok(not has_function_privilege('authenticated','public.claim_storage_cleanup_batch(integer,integer,integer)','EXECUTE'),
  'the shared Storage cleanup worker remains service-only');
select ok((select prosecdef and proconfig=array['search_path=""']::text[] from pg_proc
  where oid='private.guard_private_upload_document_insert()'::regprocedure)
  and not has_function_privilege('authenticated','private.guard_private_upload_document_insert()','EXECUTE')
  and not has_function_privilege('service_role','private.guard_private_upload_document_insert()','EXECUTE'),
  'the document guard uses a fixed-path definer and cannot be called as an RPC');

set local role service_role;
insert into public.claims(id,claim_ref,status,property_street,property_city,property_zip,carrier,policy_number,
  carrier_tenure,loss_date,cause,description)
values ('44000000-0000-4000-a000-000000000001','CMG-2026-4401','under_review','44 Upload Way','Orlando',
  '32801','Fixture Carrier','PRIVATE-UPLOAD-44','lt_1_year',current_date - 2,'wind','Private upload test fixture');

create function pg_temp.private_files(p_id uuid, p_claim uuid) returns jsonb
language sql immutable as $test$
  select jsonb_build_array(jsonb_build_object('index',0,
    'upload_path','private-upload/'||p_id::text||'/aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa.pdf',
    'storage_path','claims/'||p_claim::text||'/bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb.pdf',
    'original_name','fixture.pdf','kind','other','visibility','internal','mime','application/pdf','size_bytes',12))
$test$;
create function pg_temp.private_id(p_n integer) returns uuid
language sql immutable as $test$ select ('44000000-0000-4000-a000-'||lpad(p_n::text,12,'0'))::uuid $test$;
create function pg_temp.private_hash(p_n integer) returns text
language sql immutable as $test$ select lpad(to_hex(p_n),64,'0') $test$;

create temporary table private_results(label text primary key, value jsonb) on commit drop;
insert into private_results values ('begin', public.begin_private_upload_session(
  pg_temp.private_id(1),pg_temp.private_hash(1),'44000000-0000-4000-a000-000000000001',
  '00000000-0000-4000-a000-000000000001',
  pg_temp.private_files(pg_temp.private_id(1),'44000000-0000-4000-a000-000000000001')));
select is((select status from public.private_upload_sessions where id=pg_temp.private_id(1)),
  'pending','begin stores a pending private session');
select is((select value->'files' from private_results where label='begin'),
  pg_temp.private_files(pg_temp.private_id(1),'44000000-0000-4000-a000-000000000001'),
  'begin returns the exact immutable manifest');
select ok((select cleanup_after=created_at+interval '2 hours 15 minutes'
  and expires_at=created_at+interval '2 hours' and sign_until=created_at+interval '5 minutes'
  from public.private_upload_sessions where id=pg_temp.private_id(1)),
  'cleanup outlives the two-hour signed upload window');
select is(public.begin_private_upload_session(pg_temp.private_id(1),pg_temp.private_hash(1),
  '44000000-0000-4000-a000-000000000001','00000000-0000-4000-a000-000000000001',
  pg_temp.private_files(pg_temp.private_id(1),'44000000-0000-4000-a000-000000000001')),
  (select value from private_results where label='begin'),'an identical retry returns the original reservation');
select throws_ok($$select public.begin_private_upload_session(pg_temp.private_id(1),pg_temp.private_hash(1),
  '44000000-0000-4000-a000-000000000001','00000000-0000-4000-a000-000000000001',
  jsonb_set(pg_temp.private_files(pg_temp.private_id(1),'44000000-0000-4000-a000-000000000001'),'{0,original_name}','"changed.pdf"'))$$,
  '55000','private upload session mismatch','a retry cannot replace a manifest');
select throws_ok($$select public.begin_private_upload_session(pg_temp.private_id(2),pg_temp.private_hash(2),
  '44000000-0000-4000-a000-000000000001','00000000-0000-4000-a000-000000000001',
  pg_temp.private_files(pg_temp.private_id(2),'44000000-0000-4000-a000-000000000001'))$$,
  '55000','private upload path unavailable','another session cannot reuse a reserved path');
select is((select count(*)::integer from public.storage_cleanup_queue q join public.private_upload_files f
  on f.session_id=pg_temp.private_id(1) and q.bucket_id='claim-docs'
  and q.object_path in (f.upload_path,f.storage_path)),2,'both paths enter cleanup before reservation returns');

insert into private_results values ('copy',public.claim_private_upload_copy(pg_temp.private_id(1),pg_temp.private_hash(1),0));
select is((select value->>'allowed' from private_results where label='copy'),'true','first copy claim succeeds');
select is((public.claim_private_upload_copy(pg_temp.private_id(1),pg_temp.private_hash(1),0)->>'allowed'),
  'false','a retry cannot authorize another copy');
select throws_ok($$select public.claim_private_upload_copy(pg_temp.private_id(1),pg_temp.private_hash(2),0)$$,
  '42501','private upload session unavailable','a wrong token hash cannot claim a copy');
select throws_ok($$select public.claim_private_upload_copy(pg_temp.private_id(1),pg_temp.private_hash(1),1)$$,
  '22023','private upload file unavailable','a copy claim must name a manifest file');

update public.private_upload_files set verification=jsonb_build_object('index',0,'object_id',
  'cccccccc-cccc-4ccc-8ccc-cccccccccccc','version','fixture-v1','mime','application/pdf','size_bytes',12)
where session_id=pg_temp.private_id(1) and "index"=0;
insert into storage.objects(id,bucket_id,name,metadata,version)
values ('cccccccc-cccc-4ccc-8ccc-cccccccccccc','claim-docs',
  'claims/44000000-0000-4000-a000-000000000001/bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb.pdf',
  '{"mimetype":"application/pdf","size":12}'::jsonb,'fixture-v1');
insert into public.documents(claim_id,storage_path,original_name,kind,mime,size_bytes,uploaded_by,visibility)
values ('44000000-0000-4000-a000-000000000001',
  'claims/44000000-0000-4000-a000-000000000001/bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb.pdf',
  'fixture.pdf','other','application/pdf',12,'00000000-0000-4000-a000-000000000001','internal');
insert into private_results values ('final',public.finalize_private_upload_session(pg_temp.private_id(1),
  pg_temp.private_hash(1),array[(select id from public.documents where storage_path=
    'claims/44000000-0000-4000-a000-000000000001/bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb.pdf')]));
select is((select status from public.private_upload_sessions where id=pg_temp.private_id(1)),
  'completed','finalization completes only after verified bytes and the matching document row exist');
select is(public.finalize_private_upload_session(pg_temp.private_id(1),pg_temp.private_hash(1),
  array[(select id from public.documents where storage_path=
    'claims/44000000-0000-4000-a000-000000000001/bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb.pdf')]),
  (select value from private_results where label='final'),'finalization retries return the stored result');
select throws_ok($$update public.private_upload_files set verification=null where session_id=pg_temp.private_id(1)$$,
  '55000','private upload manifest is immutable','saved copy proof cannot be removed');

-- Expire a second session in-fixture to test the worker embargo and late-object repair.
insert into public.private_upload_sessions(id,token_hash,claim_id,uploaded_by,file_count,created_at,
  expires_at,sign_until,cleanup_after)
values (pg_temp.private_id(3),pg_temp.private_hash(3),'44000000-0000-4000-a000-000000000001',
  '00000000-0000-4000-a000-000000000001',1,now()-interval '3 hours',now()-interval '1 hour',
  now()-interval '2 hours 55 minutes',now()-interval '45 minutes');
insert into public.private_upload_files(session_id,"index",upload_path,storage_path,original_name,kind,visibility,mime,size_bytes)
select pg_temp.private_id(3),0,
  'private-upload/'||pg_temp.private_id(3)::text||'/aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa.pdf',
  'claims/44000000-0000-4000-a000-000000000001/eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee.pdf',
  'fixture.pdf','other','internal','application/pdf',12;
select public.enqueue_storage_cleanup_exact('claim-docs',array[
  'private-upload/'||pg_temp.private_id(3)::text||'/aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa.pdf',
  'claims/44000000-0000-4000-a000-000000000001/eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee.pdf'
  ],'44000000-0000-4000-a000-000000000001');
update public.storage_cleanup_queue set next_attempt_at=now()-interval '20 years'
where object_path in (select unnest(array[f.upload_path,f.storage_path])
  from public.private_upload_files f where f.session_id=pg_temp.private_id(1));
select is((select count(*)::integer from public.claim_storage_cleanup_batch(10,300,5)
  where object_path in (select unnest(array[f.upload_path,f.storage_path])
    from public.private_upload_files f where f.session_id=pg_temp.private_id(1))),
  0,'the cleanup worker keeps both private paths embargoed before expiry');
update public.storage_cleanup_queue set processed_at=now()
where object_path in (select upload_path from public.private_upload_files where session_id=pg_temp.private_id(3));
insert into storage.objects(id,bucket_id,name,metadata,version)
select 'dddddddd-dddd-4ddd-8ddd-dddddddddddd','claim-docs',upload_path,
  '{"mimetype":"application/pdf","size":12}'::jsonb,'late-v1'
from public.private_upload_files where session_id=pg_temp.private_id(3);
select throws_ok($$insert into public.documents(claim_id,storage_path,original_name,kind,mime,size_bytes,uploaded_by,visibility)
values ('44000000-0000-4000-a000-000000000001',
  'claims/44000000-0000-4000-a000-000000000001/eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee.pdf',
  'fixture.pdf','other','application/pdf',12,'00000000-0000-4000-a000-000000000001','internal')$$,
  '55000','private upload session expired or unavailable',
  'the database rejects a new document row after its upload session expires');
select is(public.reconcile_private_upload_cleanup(10),'{"checked_files":1,"queued":1,"blocked":0}'::jsonb,
  'reconciliation queues an unreferenced late staging object');
select is((select count(*)::integer from public.storage_cleanup_queue q join public.private_upload_files f
  on f.session_id=pg_temp.private_id(3) and q.object_path=f.upload_path and q.processed_at is null and q.dead_at is null),
  1,'late upload cleanup remains durable');

-- A lost response can leave matching rows committed before expiry. Exact proof
-- permits settlement later, while the trigger still rejects any new late row.
insert into storage.objects(id,bucket_id,name,metadata,version)
values ('ffffffff-ffff-4fff-8fff-ffffffffffff','claim-docs',
  'claims/44000000-0000-4000-a000-000000000001/99999999-9999-4999-8999-999999999999.pdf',
  '{"mimetype":"application/pdf","size":12}'::jsonb,'settled-v1');
insert into public.documents(claim_id,storage_path,original_name,kind,mime,size_bytes,uploaded_by,visibility)
values ('44000000-0000-4000-a000-000000000001',
  'claims/44000000-0000-4000-a000-000000000001/99999999-9999-4999-8999-999999999999.pdf',
  'settled.pdf','other','application/pdf',12,'00000000-0000-4000-a000-000000000001','internal');
insert into public.private_upload_sessions(id,token_hash,claim_id,uploaded_by,file_count,created_at,
  expires_at,sign_until,cleanup_after)
values (pg_temp.private_id(4),pg_temp.private_hash(4),'44000000-0000-4000-a000-000000000001',
  '00000000-0000-4000-a000-000000000001',1,now()-interval '3 hours',now()-interval '1 hour',
  now()-interval '2 hours 55 minutes',now()-interval '45 minutes');
insert into public.private_upload_files(session_id,"index",upload_path,storage_path,original_name,kind,visibility,
  mime,size_bytes,copy_started_at,verification)
values (pg_temp.private_id(4),0,
  'private-upload/'||pg_temp.private_id(4)::text||'/99999999-aaaa-4aaa-8aaa-aaaaaaaaaaaa.pdf',
  'claims/44000000-0000-4000-a000-000000000001/99999999-9999-4999-8999-999999999999.pdf',
  'settled.pdf','other','internal','application/pdf',12,now()-interval '2 hours 30 minutes',
  jsonb_build_object('index',0,'object_id','ffffffff-ffff-4fff-8fff-ffffffffffff','version','settled-v1',
    'mime','application/pdf','size_bytes',12));
select public.enqueue_storage_cleanup_exact('claim-docs',array[
  'private-upload/'||pg_temp.private_id(4)::text||'/99999999-aaaa-4aaa-8aaa-aaaaaaaaaaaa.pdf',
  'claims/44000000-0000-4000-a000-000000000001/99999999-9999-4999-8999-999999999999.pdf'
  ],'44000000-0000-4000-a000-000000000001');
select is((public.finalize_private_upload_session(pg_temp.private_id(4),pg_temp.private_hash(4),
  array[(select id from public.documents where storage_path=
    'claims/44000000-0000-4000-a000-000000000001/99999999-9999-4999-8999-999999999999.pdf')])->>'documents') is not null,
  true,'finalization settles exact document rows after expiry');
select is((select status from public.private_upload_sessions where id=pg_temp.private_id(4)),
  'completed','the lost-response session becomes completed after expiry');

select * from finish();
rollback;
