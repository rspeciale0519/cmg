-- Document deletion must reuse pending cleanup without changing worker state.
begin;
set local client_min_messages = warning;
create extension if not exists pgtap with schema extensions;
select plan(26);

select ok((select prosecdef from pg_proc
  where oid = 'public.tg_enqueue_storage_cleanup()'::regprocedure),
  'document deletion still queues cleanup in the trigger definer context');
select is((select proconfig from pg_proc
  where oid = 'public.tg_enqueue_storage_cleanup()'::regprocedure),
  array['search_path=""']::text[], 'the trigger keeps an empty search path');
select ok(not has_table_privilege('authenticated', 'public.storage_cleanup_queue', 'INSERT'),
  'authenticated callers still cannot write cleanup work directly');

set local role service_role;
insert into public.claims
  (id, claim_ref, status, property_street, property_city, property_zip,
   carrier, policy_number, carrier_tenure, loss_date, cause, description)
values
  ('34000000-0000-4000-a000-000000000001', 'CMG-2099-3401', 'under_review',
   '34 Fixture Way', 'Orlando', '32801', 'Carrier', 'POL-34', 'lt_1_year',
   current_date - 2, 'wind', 'cleanup enqueue regression'),
  ('34000000-0000-4000-a000-000000000002', 'CMG-2099-3402', 'under_review',
   '35 Fixture Way', 'Orlando', '32801', 'Carrier', 'POL-35', 'lt_1_year',
   current_date - 2, 'wind', 'cleanup cascade regression');

insert into public.documents
  (id, claim_id, storage_path, original_name, kind, mime, size_bytes, visibility)
values
  ('34000000-0000-4000-a000-000000000101', '34000000-0000-4000-a000-000000000001',
   'claims/34000000-0000-4000-a000-000000000001/normal.pdf', 'normal.pdf', 'other', 'application/pdf', 1, 'internal'),
  ('34000000-0000-4000-a000-000000000102', '34000000-0000-4000-a000-000000000001',
   'claims/34000000-0000-4000-a000-000000000001/pending.pdf', 'pending.pdf', 'other', 'application/pdf', 1, 'internal'),
  ('34000000-0000-4000-a000-000000000103', '34000000-0000-4000-a000-000000000001',
   'claims/34000000-0000-4000-a000-000000000001/leased.pdf', 'leased.pdf', 'other', 'application/pdf', 1, 'internal'),
  ('34000000-0000-4000-a000-000000000104', '34000000-0000-4000-a000-000000000001',
   'claims/34000000-0000-4000-a000-000000000001/history.pdf', 'history.pdf', 'other', 'application/pdf', 1, 'internal'),
  ('34000000-0000-4000-a000-000000000105', '34000000-0000-4000-a000-000000000001',
   'intake/34000000-0000-4000-a000-000000000901/pending.pdf', 'intake.pdf', 'other', 'application/pdf', 1, 'internal'),
  ('34000000-0000-4000-a000-000000000201', '34000000-0000-4000-a000-000000000002',
   'claims/34000000-0000-4000-a000-000000000002/cascade.pdf', 'cascade.pdf', 'other', 'application/pdf', 1, 'internal');

do $setup$
begin
  perform public.enqueue_storage_cleanup_exact('claim-docs', array[
    'claims/34000000-0000-4000-a000-000000000001/pending.pdf',
    'claims/34000000-0000-4000-a000-000000000001/leased.pdf'
  ], '34000000-0000-4000-a000-000000000001');
  perform public.enqueue_storage_cleanup_exact('claim-docs',
    array['claims/34000000-0000-4000-a000-000000000002/cascade.pdf'],
    '34000000-0000-4000-a000-000000000002');
  perform public.enqueue_storage_cleanup_exact('claim-docs',
    array['intake/34000000-0000-4000-a000-000000000901/pending.pdf'], null);
end;
$setup$;

update public.storage_cleanup_queue
set attempts = 3, next_attempt_at = now() + interval '1 hour', last_error = 'fixture lease retained'
where bucket_id = 'claim-docs'
  and object_path = 'claims/34000000-0000-4000-a000-000000000001/leased.pdf';
insert into public.storage_cleanup_queue
  (bucket_id, object_path, claim_id, attempts, enqueued_at, next_attempt_at, processed_at, dead_at, last_error)
values
  ('claim-docs', 'claims/34000000-0000-4000-a000-000000000001/history.pdf',
   '34000000-0000-4000-a000-000000000001', 2, now() - interval '2 hours', now() - interval '1 hour', now() - interval '1 hour', null, null),
  ('claim-docs', 'claims/34000000-0000-4000-a000-000000000001/history.pdf',
   '34000000-0000-4000-a000-000000000001', 5, now() - interval '2 hours', now() - interval '1 hour', null, now() - interval '1 hour', 'fixture terminal failure'),
  ('other-fixture-bucket', 'claims/34000000-0000-4000-a000-000000000001/normal.pdf',
   '34000000-0000-4000-a000-000000000001', 4, now() - interval '2 hours', now() + interval '1 hour', null, null, 'other bucket retained');

create temporary table cleanup_before as
select id, bucket_id, object_path, to_jsonb(q) as saved
from public.storage_cleanup_queue q
where claim_id in ('34000000-0000-4000-a000-000000000001', '34000000-0000-4000-a000-000000000002')
  or object_path = 'intake/34000000-0000-4000-a000-000000000901/pending.pdf';

reset role;
set local request.jwt.claims = '{"sub":"00000000-0000-4000-a000-000000000001","role":"authenticated","aal":"aal2"}';
set local role authenticated;
select results_eq(
  $$delete from public.documents where id = '34000000-0000-4000-a000-000000000102' returning id$$,
  $$values ('34000000-0000-4000-a000-000000000102'::uuid)$$,
  'an authorized document delete succeeds when exact cleanup is already pending');

reset role;
set local request.jwt.claims = '{}';
set local role service_role;
select is((select to_jsonb(q) from public.storage_cleanup_queue q
  where q.id = (select id from cleanup_before
    where object_path = 'claims/34000000-0000-4000-a000-000000000001/pending.pdf')),
  (select saved from cleanup_before where object_path = 'claims/34000000-0000-4000-a000-000000000001/pending.pdf'),
  'the existing pending row remains unchanged');
select is((select count(*)::integer from public.storage_cleanup_queue
  where bucket_id = 'claim-docs' and object_path = 'claims/34000000-0000-4000-a000-000000000001/pending.pdf'),
  1, 'document deletion does not add duplicate pending work');

select results_eq(
  $$delete from public.documents where id = '34000000-0000-4000-a000-000000000101' returning id$$,
  $$values ('34000000-0000-4000-a000-000000000101'::uuid)$$,
  'normal document deletion still succeeds');
select ok(exists(select 1 from public.storage_cleanup_queue
  where bucket_id = 'claim-docs' and object_path = 'claims/34000000-0000-4000-a000-000000000001/normal.pdf'
    and document_id = '34000000-0000-4000-a000-000000000101'
    and claim_id = '34000000-0000-4000-a000-000000000001' and attempts = 0
    and processed_at is null and dead_at is null and next_attempt_at <= now()),
  'a new cleanup row keeps the exact object and is immediately due');
select is((select to_jsonb(q) from public.storage_cleanup_queue q
  where q.id = (select id from cleanup_before where bucket_id = 'other-fixture-bucket')),
  (select saved from cleanup_before where bucket_id = 'other-fixture-bucket'),
  'the same object name in another bucket does not conflict or change');

select results_eq(
  $$delete from public.documents where id = '34000000-0000-4000-a000-000000000103' returning id$$,
  $$values ('34000000-0000-4000-a000-000000000103'::uuid)$$,
  'a document delete also tolerates an existing cleanup lease');
select is((select to_jsonb(q) from public.storage_cleanup_queue q
  where q.id = (select id from cleanup_before where object_path like '%/leased.pdf')),
  (select saved from cleanup_before where object_path like '%/leased.pdf'),
  'attempts, lease, timestamps, last error, and metadata remain unchanged');
select throws_ok(
  $$insert into public.documents (claim_id, storage_path, original_name, kind, mime, size_bytes)
    values ('34000000-0000-4000-a000-000000000001',
      'claims/34000000-0000-4000-a000-000000000001/leased.pdf', 'late.pdf', 'other', 'application/pdf', 1)$$,
  '55000', 'storage cleanup already claimed', 'a spent cleanup attempt still fences a late attachment');

select results_eq(
  $$delete from public.documents where id = '34000000-0000-4000-a000-000000000105' returning id$$,
  $$values ('34000000-0000-4000-a000-000000000105'::uuid)$$,
  'an intake document can be deleted when its pending intent has no claim metadata');
select is((select to_jsonb(q) from public.storage_cleanup_queue q
  where q.id = (select id from cleanup_before where object_path like 'intake/%')),
  (select saved from cleanup_before where object_path like 'intake/%'),
  'null intake metadata is preserved with the exact pending object key');
select is((select count(*)::integer from public.storage_cleanup_queue
  where bucket_id = 'claim-docs' and object_path = 'intake/34000000-0000-4000-a000-000000000901/pending.pdf'),
  1, 'the intake path retains one pending cleanup row');

select results_eq(
  $$delete from public.claims where id = '34000000-0000-4000-a000-000000000002' returning id$$,
  $$values ('34000000-0000-4000-a000-000000000002'::uuid)$$,
  'claim cascade deletion succeeds when a child document already has pending cleanup');
select is((select count(*)::integer from public.documents
  where claim_id = '34000000-0000-4000-a000-000000000002'), 0,
  'the cascade removes its document row');
select is((select to_jsonb(q) from public.storage_cleanup_queue q
  where q.id = (select id from cleanup_before where object_path like '%/cascade.pdf')),
  (select saved from cleanup_before where object_path like '%/cascade.pdf'),
  'claim deletion preserves its existing exact cleanup row');

select results_eq(
  $$delete from public.documents where id = '34000000-0000-4000-a000-000000000104' returning id$$,
  $$values ('34000000-0000-4000-a000-000000000104'::uuid)$$,
  'terminal cleanup history does not prevent a new deletion intent');
select is((select to_jsonb(q) from public.storage_cleanup_queue q
  where q.id = (select id from cleanup_before where saved->>'processed_at' is not null)),
  (select saved from cleanup_before where saved->>'processed_at' is not null),
  'processed cleanup history remains unchanged');
select is((select to_jsonb(q) from public.storage_cleanup_queue q
  where q.id = (select id from cleanup_before where saved->>'dead_at' is not null)),
  (select saved from cleanup_before where saved->>'dead_at' is not null),
  'dead cleanup history remains unchanged');
select is((select count(*)::integer from public.storage_cleanup_queue
  where bucket_id = 'claim-docs' and object_path = 'claims/34000000-0000-4000-a000-000000000001/history.pdf'),
  3, 'one new pending row exists alongside both terminal history rows');
select ok(exists(select 1 from public.storage_cleanup_queue
  where bucket_id = 'claim-docs' and object_path = 'claims/34000000-0000-4000-a000-000000000001/history.pdf'
    and processed_at is null and dead_at is null and attempts = 0
    and document_id = '34000000-0000-4000-a000-000000000104' and next_attempt_at <= now()),
  'the new intent does not reuse a terminal row or its attempts');
select throws_ok(
  $$insert into public.documents (claim_id, storage_path, original_name, kind, mime, size_bytes)
    values ('34000000-0000-4000-a000-000000000001',
      'claims/34000000-0000-4000-a000-000000000001/history.pdf', 'late.pdf', 'other', 'application/pdf', 1)$$,
  '55000', 'storage cleanup already claimed', 'terminal history still fences a late attachment');
select is_empty(
  $$delete from public.documents where id = '34000000-0000-4000-a000-000000000104' returning id$$,
  'repeating an already completed delete removes no second document');
select is((select count(*)::integer from public.storage_cleanup_queue
  where bucket_id = 'claim-docs' and object_path = 'claims/34000000-0000-4000-a000-000000000001/history.pdf'
    and processed_at is null and dead_at is null), 1,
  'repeating deletion does not create another pending intent');

reset role;
select * from finish();
rollback;
