-- All fixtures and Storage metadata roll back. No object bytes or API calls exist.
-- Run on a quiet local database: the worker API has no fixture-ID filter.
begin;
set local client_min_messages = warning;
create extension if not exists pgtap with schema extensions;
set local search_path = public, extensions;
select plan(60);
\ir support/36_intake_upload_fixtures.inc

set local role service_role;

create temporary table cleanup37_sessions(number integer primary key, id uuid unique, file_count integer) on commit drop;
insert into cleanup37_sessions
select n, pg_temp.intake_id(37, n), case when n = 20 then 4 else 1 end
from unnest(array[1,2,3,4,5,6,7,8,10,11,12,20]) n;
do $collision$
declare v_paths text[];
begin
  if exists (select 1 from public.intake_upload_sessions s join cleanup37_sessions own on own.id = s.id) then
    raise exception 'suite 37 session fixture already exists';
  end if;
  select array_agg(p.path) into v_paths from cleanup37_sessions own
  cross join lateral jsonb_array_elements(pg_temp.intake_files(own.id, own.file_count)) f
  cross join lateral (values (f->>'upload_path'), (f->>'storage_path')) p(path);
  if exists (select 1 from public.storage_cleanup_queue where bucket_id = 'claim-docs' and object_path = any(v_paths))
     or exists (select 1 from public.documents where storage_path = any(v_paths))
     or exists (select 1 from storage.objects where bucket_id = 'claim-docs' and name = any(v_paths))
     or exists (select 1 from public.notifications_outbox where dedupe_key in ('intake-fixture-37-3','intake-fixture-37-4')) then
    raise exception 'suite 37 path or notification fixture already exists';
  end if;
end;
$collision$;
create temporary view cleanup37_paths as
select own.number, f.session_id, f."index", p.side, p.path
from public.intake_upload_files f join cleanup37_sessions own on own.id = f.session_id
cross join lateral (values ('upload', f.upload_path), ('storage', f.storage_path)) p(side, path);
create temporary view cleanup37_queue as
select q.*, p.number, p.side from public.storage_cleanup_queue q
join cleanup37_paths p on q.bucket_id = 'claim-docs' and q.object_path = p.path;
create temporary table cleanup37_snapshots(label text primary key, value jsonb) on commit drop;
reset role;
create function pg_temp.cleanup37_snapshot(p_number integer default null)
returns jsonb language sql stable as $test$
  select coalesce(jsonb_agg(to_jsonb(q) order by q.id), '[]'::jsonb)
  from pg_temp.cleanup37_queue q where p_number is null or q.number = p_number;
$test$;
create function pg_temp.cleanup37_expected(p_number integer)
returns text[] language sql stable as $test$
  select array(select path from pg_temp.cleanup37_paths where number = p_number order by path);
$test$;
set local role service_role;

-- Cancellation and successful attachment never shorten either path's embargo.
do $setup$
declare n integer;
begin
  for n in 1..4 loop
    perform pg_temp.seed_intake_session(37, n);
    perform pg_temp.seed_intake_objects(37, n, true, true);
  end loop;
  perform public.cancel_intake_upload_session(pg_temp.intake_id(37, 2), pg_temp.intake_hash(37, 2));
  for n in 3..4 loop
    perform pg_temp.claim_intake_copies(37, n);
    perform pg_temp.cache_intake_verifications(37, n);
    perform public.finalize_intake_upload_session(
      pg_temp.intake_id(37, n), pg_temp.intake_hash(37, n), pg_temp.intake_verified(37, n));
  end loop;
end;
$setup$;
delete from public.documents where storage_path in (select path from cleanup37_paths where number = 4 and side = 'storage');
select is(array(select status from public.intake_upload_sessions s join cleanup37_sessions own on own.id = s.id
  where own.number between 1 and 4 order by own.number), array['pending','cancelled','completed','completed'],
  'embargo fixtures cover pending, cancelled, attached, and deleted completed sessions');
select is((select count(*)::integer from cleanup37_queue where number = 4 and side = 'storage'
  and processed_at is null and dead_at is null), 1, 'deleting the attached fixture creates a new pending intent');
update public.storage_cleanup_queue q set attempts = case when own.side = 'upload' then 5 else 0 end,
  next_attempt_at = now() - interval '20 years', last_error = 'embargo fixture'
from cleanup37_queue own where q.id = own.id and own.number between 1 and 4 and own.processed_at is null;
insert into cleanup37_snapshots select 'embargo-a-' || n, pg_temp.cleanup37_snapshot(n) from generate_series(1,4) n;
select is(array(select object_path from public.claim_storage_cleanup_batch(20,300,5) order by object_path),
  array[]::text[], 'the embargo excludes fresh destinations and exhausted staging paths');
select is(pg_temp.cleanup37_snapshot(n), (select value from cleanup37_snapshots where label = 'embargo-a-' || n),
  'the worker preserves all queue fields for embargoed session ' || n) from generate_series(1,4) n;
select is(public.reconcile_intake_upload_cleanup(1000), '{"checked_files":0,"queued":0,"blocked":0}'::jsonb,
  'the reconciler cannot bypass any live embargo');
select ok((select bool_and(last_reconciled_at is null) from public.intake_upload_files f
  join cleanup37_sessions own on own.id = f.session_id), 'embargoed files do not consume reconciliation scans');
update public.storage_cleanup_queue q set attempts = case when own.side = 'storage' then 5 else 0 end
from cleanup37_queue own where q.id = own.id and own.number between 1 and 4 and own.processed_at is null;
insert into cleanup37_snapshots select 'embargo-b-' || n, pg_temp.cleanup37_snapshot(n) from generate_series(1,4) n;
select is(array(select object_path from public.claim_storage_cleanup_batch(20,300,5) order by object_path),
  array[]::text[], 'the embargo also excludes fresh staging paths and exhausted destinations');
select is(pg_temp.cleanup37_snapshot(n), (select value from cleanup37_snapshots where label = 'embargo-b-' || n),
  'reversing attempt states preserves embargoed session ' || n) from generate_series(1,4) n;

-- A successful remove of an absent object does not end exact-path observation.
do $setup$ begin perform pg_temp.seed_intake_session(37,5,interval '3 hours'); end; $setup$;
update public.storage_cleanup_queue q set next_attempt_at = now() - interval '20 years'
from cleanup37_queue own where q.id = own.id and own.number = 5;
select is(array(select object_path from public.claim_storage_cleanup_batch(2,300,5) order by object_path),
  pg_temp.cleanup37_expected(5), 'both exact paths become eligible after the immutable embargo');
select ok((select count(*) = 2 and bool_and(attempts = 1 and next_attempt_at = now() + interval '300 seconds'
  and processed_at is null and dead_at is null) from cleanup37_queue where number = 5),
  'the first post-embargo claim leases both missing-object intents once');
-- Simulate successful Storage.remove acknowledgements for these absent objects.
update public.storage_cleanup_queue q set processed_at = now(), last_error = null
from cleanup37_queue own where q.id = own.id and own.number = 5;
insert into cleanup37_snapshots values ('processed-5', pg_temp.cleanup37_snapshot(5));
select is(public.reconcile_intake_upload_cleanup(1), '{"checked_files":1,"queued":0,"blocked":0}'::jsonb,
  'a completed sweep with no object creates no replacement intent');
select is(pg_temp.cleanup37_snapshot(5), (select value from cleanup37_snapshots where label = 'processed-5'),
  'an empty scan preserves processed history');
do $setup$ begin perform pg_temp.seed_intake_objects(37,5,true,true); end; $setup$;
select is(public.reconcile_intake_upload_cleanup(1), '{"checked_files":1,"queued":2,"blocked":0}'::jsonb,
  'a late object at either retained path creates new cleanup work');
select is(array(select object_path from cleanup37_queue where number = 5 and processed_at is null order by object_path),
  pg_temp.cleanup37_expected(5), 'late staging and destination objects each receive one exact pending intent');
select is((select jsonb_agg(to_jsonb(q) order by q.id) from cleanup37_queue q where number = 5 and processed_at is not null),
  (select value from cleanup37_snapshots where label = 'processed-5'), 'replacement work never rewrites processed rows');
select ok((select count(*) = 2 and bool_and(attempts = 0 and dead_at is null and claim_id is null and document_id is null)
  from cleanup37_queue where number = 5 and processed_at is null), 'new intents start without attempts or invented ownership');
update public.storage_cleanup_queue q set attempts = 3, next_attempt_at = now() + interval '1 hour',
  last_error = 'pending lease fixture'
from cleanup37_queue own where q.id = own.id and own.number = 5 and own.processed_at is null;
insert into cleanup37_snapshots values ('leased-5', pg_temp.cleanup37_snapshot(5));
select is(public.reconcile_intake_upload_cleanup(1), '{"checked_files":1,"queued":0,"blocked":0}'::jsonb,
  'an active pending lease prevents a replacement intent');
select is(pg_temp.cleanup37_snapshot(5), (select value from cleanup37_snapshots where label = 'leased-5'),
  'reconciliation preserves attempts, lease times, errors, and history');

do $setup$ begin
  perform pg_temp.seed_intake_session(37,6,interval '3 hours');
  perform pg_temp.seed_intake_objects(37,6,true,true);
end; $setup$;
update public.storage_cleanup_queue q set attempts = 5, dead_at = now(), last_error = 'dead fixture'
from cleanup37_queue own where q.id = own.id and own.number = 6;
insert into cleanup37_snapshots values ('dead-6', pg_temp.cleanup37_snapshot(6));
select is(public.reconcile_intake_upload_cleanup(1), '{"checked_files":1,"queued":0,"blocked":2}'::jsonb,
  'dead history blocks replacement work independently for both exact paths');
select is(pg_temp.cleanup37_snapshot(6), (select value from cleanup37_snapshots where label = 'dead-6'),
  'reconciliation never resets dead rows or their attempts');
select is((select count(*)::integer from storage.objects where bucket_id = 'claim-docs'
  and name = any(pg_temp.cleanup37_expected(6))), 2, 'dead history keeps both object metadata rows for owner review');

-- An attached destination remains protected after its session's embargo ends.
do $setup$ begin
  perform pg_temp.seed_intake_session(37,7,interval '3 hours');
  perform pg_temp.seed_intake_objects(37,7,true,true);
end; $setup$;
insert into public.documents(id,claim_id,storage_path,original_name,mime,size_bytes,kind,visibility)
select pg_temp.intake_id(37,701), (s.result->>'id')::uuid, f.storage_path, f.original_name, f.mime, f.size_bytes,
  'other', 'customer' from public.intake_upload_files f
join public.intake_upload_sessions s on s.id = pg_temp.intake_id(37,3)
where f.session_id = pg_temp.intake_id(37,7);
update public.storage_cleanup_queue q set attempts = 1, processed_at = now()
from cleanup37_queue own where q.id = own.id and own.number = 7 and own.side = 'upload';
insert into cleanup37_snapshots select 'referenced-7', jsonb_agg(to_jsonb(q) order by id)
from cleanup37_queue q where number = 7 and side = 'storage';
select is(public.reconcile_intake_upload_cleanup(1), '{"checked_files":1,"queued":1,"blocked":0}'::jsonb,
  'a live destination reference excludes only that path from reconciliation');
select is(array(select object_path from cleanup37_queue where number = 7 and processed_at is null order by object_path),
  array(select path from cleanup37_paths where number = 7 and side = 'upload'),
  'the unreferenced staging object still receives cleanup work');
select is((select jsonb_agg(to_jsonb(q) order by id) from cleanup37_queue q where number = 7 and side = 'storage'),
  (select value from cleanup37_snapshots where label = 'referenced-7'), 'the referenced destination keeps its settled history');
-- Reconciler timestamps use clock_timestamp(); now() stays fixed in this test.
-- Park replacement rows explicitly instead of depending on that clock difference.
update public.storage_cleanup_queue q set next_attempt_at = now() + interval '1 day'
from cleanup37_queue own where q.id = own.id and own.number = 7 and own.processed_at is null;
insert into public.storage_cleanup_queue(bucket_id,object_path,next_attempt_at)
select 'claim-docs', path, now() - interval '20 years' from cleanup37_paths where number = 7 and side = 'storage';
insert into cleanup37_snapshots values ('referenced-fresh', pg_temp.cleanup37_snapshot(7));
select is(array(select object_path from public.claim_storage_cleanup_batch(1,300,5) order by object_path),
  array[]::text[], 'a live document reference excludes fresh work after the embargo');
select is(pg_temp.cleanup37_snapshot(7), (select value from cleanup37_snapshots where label = 'referenced-fresh'),
  'the worker preserves the complete pending row for a referenced destination');
update public.storage_cleanup_queue q set attempts = 5
from cleanup37_queue own where q.id = own.id and own.number = 7 and own.side = 'storage' and own.processed_at is null;
insert into cleanup37_snapshots values ('referenced-exhausted', pg_temp.cleanup37_snapshot(7));
select is(array(select object_path from public.claim_storage_cleanup_batch(1,300,5) order by object_path),
  array[]::text[], 'a live document reference also excludes exhausted work after the embargo');
select is(pg_temp.cleanup37_snapshot(7), (select value from cleanup37_snapshots where label = 'referenced-exhausted'),
  'a referenced destination cannot become dead during terminal recovery');

do $setup$ begin perform pg_temp.seed_intake_session(37,8,interval '3 hours'); end; $setup$;
update public.storage_cleanup_queue q set attempts = 1, processed_at = now()
from cleanup37_queue own where q.id = own.id and own.number = 8;
insert into cleanup37_snapshots values ('excluded-8', pg_temp.cleanup37_snapshot(8));
-- This synthetic bucket row and its objects have no backing bytes.
insert into storage.buckets(id,name,public) values ('intake-cleanup-fixture-37','intake-cleanup-fixture-37',false);
insert into storage.objects(id,bucket_id,name,metadata,version)
select gen_random_uuid(), 'intake-cleanup-fixture-37', path,
  '{"mimetype":"application/pdf","size":12}'::jsonb, 'fixture-v1'
from cleanup37_paths where number = 8;
insert into storage.objects(id,bucket_id,name,metadata,version)
values (pg_temp.intake_id(37,900),'claim-docs','intake/' || pg_temp.intake_id(37,900)::text || '/unregistered.pdf',
  '{"mimetype":"application/pdf","size":12}'::jsonb,'fixture-v1');
select is(public.reconcile_intake_upload_cleanup(1), '{"checked_files":1,"queued":0,"blocked":0}'::jsonb,
  'same-name objects in another bucket and unregistered paths create no cleanup work');
select is(pg_temp.cleanup37_snapshot(8), (select value from cleanup37_snapshots where label = 'excluded-8'),
  'wrong-bucket objects cannot change claim-docs history');
select ok(not exists (select 1 from public.storage_cleanup_queue
  where bucket_id = 'intake-cleanup-fixture-37'
     or (bucket_id = 'claim-docs' and object_path = 'intake/' || pg_temp.intake_id(37,900)::text || '/unregistered.pdf')),
  'reconciliation never broadens its registered bucket and path scope');

-- Empty files move behind unvisited files under repeated bounded scans.
do $setup$ declare n integer; begin
  for n in 10..12 loop perform pg_temp.seed_intake_session(37,n,interval '3 hours'); end loop;
  perform pg_temp.seed_intake_objects(37,12,true,true);
end; $setup$;
update public.storage_cleanup_queue q set attempts = 1, processed_at = now()
from cleanup37_queue own where q.id = own.id and own.number between 10 and 12;
insert into cleanup37_snapshots select 'objects', jsonb_agg(to_jsonb(o) order by o.id) from storage.objects o
where o.bucket_id = 'intake-cleanup-fixture-37' or (o.bucket_id = 'claim-docs'
  and (o.name in (select path from cleanup37_paths) or o.id = pg_temp.intake_id(37,900)));
select is(public.reconcile_intake_upload_cleanup(1), '{"checked_files":1,"queued":0,"blocked":0}'::jsonb,
  'a scan of one empty file respects the file limit');
select is(array(select own.number from public.intake_upload_files f join cleanup37_sessions own on own.id = f.session_id
  where own.number between 10 and 12 and f.last_reconciled_at is not null order by own.number),
  array[10], 'the first scan advances only the first unvisited file');
select is(public.reconcile_intake_upload_cleanup(1), '{"checked_files":1,"queued":0,"blocked":0}'::jsonb,
  'the next scan progresses past the first empty file');
select is(array(select own.number from public.intake_upload_files f join cleanup37_sessions own on own.id = f.session_id
  where own.number between 10 and 12 and f.last_reconciled_at is not null order by own.number),
  array[10,11], 'the second scan advances only the next unvisited file');
select is(public.reconcile_intake_upload_cleanup(1), '{"checked_files":1,"queued":2,"blocked":0}'::jsonb,
  'a later bounded scan reaches both objects beyond empty files');
select is(array(select object_path from cleanup37_queue where number = 12 and processed_at is null order by object_path),
  pg_temp.cleanup37_expected(12), 'bounded progress discovers both retained paths');
update public.storage_cleanup_queue q set next_attempt_at = now() + interval '1 day'
from cleanup37_queue own where q.id = own.id and own.number = 12 and own.processed_at is null;
insert into cleanup37_snapshots values ('zero-queue', pg_temp.cleanup37_snapshot());
insert into cleanup37_snapshots select 'zero-files', jsonb_agg(to_jsonb(f) order by f.session_id,f."index")
from public.intake_upload_files f join cleanup37_sessions own on own.id = f.session_id;
select is(public.reconcile_intake_upload_cleanup(0), '{"checked_files":0,"queued":0,"blocked":0}'::jsonb,
  'a zero reconciliation limit scans no files');
select is(array(select object_path from public.claim_storage_cleanup_batch(0,300,5) order by object_path),
  array[]::text[], 'a zero worker limit leases and terminalizes no rows');
select is(pg_temp.cleanup37_snapshot(), (select value from cleanup37_snapshots where label = 'zero-queue'),
  'zero limits preserve all fixture queue fields');
select is((select jsonb_agg(to_jsonb(f) order by f.session_id,f."index") from public.intake_upload_files f
  join cleanup37_sessions own on own.id = f.session_id), (select value from cleanup37_snapshots where label = 'zero-files'),
  'zero limits preserve reconciliation timestamps and immutable manifest fields');

-- Shared recovery and fresh-work budgets are behavioral checks, independent
-- of a particular query plan. RETURNING sets are always explicitly ordered.
do $setup$ begin perform pg_temp.seed_intake_session(37,20,interval '3 hours',4); end; $setup$;
create temporary table cleanup37_budget on commit drop as
select id, object_path, row_number() over (order by object_path)::integer as ordinal
from cleanup37_queue where number = 20;
update public.storage_cleanup_queue q set attempts = case when b.ordinal <= 3 then 5 else 0 end,
  next_attempt_at = now() - interval '20 years' + b.ordinal * interval '1 second'
from cleanup37_budget b where q.id = b.id;
select is(array(select object_path from public.claim_storage_cleanup_batch(2,300,5) order by object_path),
  array[]::text[], 'two exhausted rows consume the complete worker budget');
select is(array(select b.ordinal from cleanup37_budget b join public.storage_cleanup_queue q on q.id = b.id
  where q.dead_at is not null order by b.ordinal), array[1,2], 'terminal recovery cannot exceed its candidate limit');
select ok((select count(*) = 5 and bool_and(attempts = 0) from cleanup37_queue q
  join cleanup37_budget b on b.id = q.id where b.ordinal > 3), 'a full recovery budget leaves fresh attempts untouched');
select is(array(select object_path from public.claim_storage_cleanup_batch(2,300,5) order by object_path),
  array(select object_path from cleanup37_budget where ordinal = 4),
  'one remaining exhausted row leaves exactly one fresh lease in the shared budget');
select is(array(select b.ordinal from cleanup37_budget b join public.storage_cleanup_queue q on q.id = b.id
  where q.dead_at is not null order by b.ordinal), array[1,2,3], 'the following call recovers the exhausted remainder');
select ok((select count(*) = 3 and bool_and(q.attempts = 5 and q.processed_at is null and q.dead_at is not null)
  from cleanup37_queue q join cleanup37_budget b on b.id = q.id where b.ordinal <= 3),
  'terminal recovery does not add another attempt or mark the row processed');
select is(array(select object_path from public.claim_storage_cleanup_batch(2,300,5) order by object_path),
  array(select object_path from cleanup37_budget where ordinal in (5,6) order by object_path),
  'a fresh-only batch cannot exceed two leases');
select ok((select count(*) = 2 and bool_and(attempts = 0 and dead_at is null and processed_at is null)
  from cleanup37_queue q join cleanup37_budget b on b.id = q.id where b.ordinal in (7,8)),
  'fresh rows beyond the batch limit remain untouched');
select is(array(select object_path from public.claim_storage_cleanup_batch(2,300,5) order by object_path),
  array(select object_path from cleanup37_budget where ordinal in (7,8) order by object_path),
  'the following call leases the exact fresh remainder');
select ok((select count(*) = 5 and bool_and(q.attempts = 1 and q.next_attempt_at = now() + interval '300 seconds'
  and q.dead_at is null and q.processed_at is null) from cleanup37_queue q
  join cleanup37_budget b on b.id = q.id where b.ordinal > 3), 'all five fresh rows receive one active lease');
insert into cleanup37_snapshots values ('budget-active', pg_temp.cleanup37_snapshot(20));
select is(array(select object_path from public.claim_storage_cleanup_batch(2,300,5) order by object_path),
  array[]::text[], 'active leases and dead history cannot replay on another worker call');
select is(pg_temp.cleanup37_snapshot(20), (select value from cleanup37_snapshots where label = 'budget-active'),
  'a replay attempt preserves complete lease and terminal rows');
select is((select jsonb_agg(to_jsonb(o) order by o.id) from storage.objects o
  where o.bucket_id = 'intake-cleanup-fixture-37' or (o.bucket_id = 'claim-docs'
    and (o.name in (select path from cleanup37_paths) or o.id = pg_temp.intake_id(37,900)))),
  (select value from cleanup37_snapshots where label = 'objects'),
  'bounded reconciliation and worker claims never change or delete Storage metadata');

reset role;
select * from finish();
rollback;
