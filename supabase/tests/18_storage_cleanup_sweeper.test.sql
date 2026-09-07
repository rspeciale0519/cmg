-- CMG Property Solutions — storage cleanup is service-role-only, atomic and bounded

begin;
set local client_min_messages = warning;
create extension if not exists pgtap with schema extensions;

select plan(25);

-- Park unrelated due rows for this rollback transaction. The claim RPC is
-- intentionally global work-queue machinery; without this seam, a legitimate
-- live row could consume the bounded batch before either fixture below.
update public.storage_cleanup_queue
   set next_attempt_at = now() + interval '1 day'
 where processed_at is null
   and dead_at is null
   and object_path not like 'claims/cleanup/%';

insert into public.storage_cleanup_queue
  (bucket_id, object_path, enqueued_at, next_attempt_at)
values
  ('claim-docs', 'claims/cleanup/one.pdf', now() - interval '2 minutes', now() - interval '1 minute'),
  ('claim-docs', 'claims/cleanup/two.pdf', now() - interval '1 minute', now() - interval '1 minute'),
  ('claim-docs', 'claims/cleanup/later.pdf', now(), now() + interval '1 hour');

select ok(
  (select relrowsecurity from pg_class where oid = 'public.storage_cleanup_queue'::regclass),
  'RLS is enabled on the cleanup queue'
);

select is(
  (select count(*)::int from pg_policies
    where schemaname = 'public' and tablename = 'storage_cleanup_queue'),
  0,
  'the service-only queue has no user policies'
);

select is(
  (select count(*)::int from information_schema.role_table_grants
    where table_schema = 'public' and table_name = 'storage_cleanup_queue'
      and grantee in ('anon', 'authenticated')),
  0,
  'anon and authenticated have no queue privileges'
);

select ok(
  not (select prosecdef from pg_proc
        where oid = 'public.claim_storage_cleanup_batch(integer,integer,integer)'::regprocedure),
  'the claim function is security invoker'
);

select ok(
  not has_function_privilege('anon', 'public.claim_storage_cleanup_batch(integer,integer,integer)', 'execute'),
  'anon cannot claim cleanup work'
);

select ok(
  not has_function_privilege('authenticated', 'public.claim_storage_cleanup_batch(integer,integer,integer)', 'execute'),
  'authenticated cannot claim cleanup work'
);

select ok(
  has_function_privilege('service_role', 'public.claim_storage_cleanup_batch(integer,integer,integer)', 'execute'),
  'the service role can claim cleanup work'
);

set local role anon;
select throws_ok(
  $$ select 1 from public.storage_cleanup_queue $$,
  '42501'::char(5), null::text,
  'anon cannot read cleanup paths'
);
select throws_ok(
  $$ select * from public.claim_storage_cleanup_batch(10) $$,
  '42501'::char(5), null::text,
  'anon cannot invoke the claim function'
);
reset role;

set local request.jwt.claims = '{"sub":"00000000-0000-4000-a000-000000000004","role":"authenticated"}';
set local role authenticated;
select throws_ok(
  $$ select 1 from public.storage_cleanup_queue $$,
  '42501'::char(5), null::text,
  'a customer cannot read cleanup paths'
);
select throws_ok(
  $$ select * from public.claim_storage_cleanup_batch(10) $$,
  '42501'::char(5), null::text,
  'a customer cannot claim cleanup work'
);
select set_config('request.jwt.claims', '', true);
reset role;

create temp table claimed_cleanup as
  select * from public.claim_storage_cleanup_batch(2, 300, 5);

select is(
  (select count(*)::int from claimed_cleanup),
  2,
  'a bounded claim takes only the two due rows'
);

select is(
  (select count(*)::int from claimed_cleanup where attempts = 1),
  2,
  'claiming increments attempts before external work begins'
);

select ok(
  (select bool_and(bucket_id = 'claim-docs' and object_path like 'claims/cleanup/%')
     from claimed_cleanup),
  'the claim returns each exact bucket and object path'
);

select is(
  (select count(*)::int from public.claim_storage_cleanup_batch(10, 300, 5)),
  0,
  'a concurrent claim cannot take leased rows or a future row'
);

select ok(
  (select bool_and(next_attempt_at > now())
     from public.storage_cleanup_queue q
     join claimed_cleanup c on c.id = q.id),
  'the claim installs a crash lease'
);

select is(
  (select count(*)::int from public.storage_cleanup_queue q
    join claimed_cleanup c on c.id = q.id
   where q.processed_at is not null),
  0,
  'claiming alone never marks external deletion complete'
);

update public.storage_cleanup_queue
   set attempts = 4, next_attempt_at = now() - interval '1 minute'
 where object_path = 'claims/cleanup/later.pdf';

select is(
  (select attempts from public.claim_storage_cleanup_batch(1, 300, 5)
    where object_path = 'claims/cleanup/later.pdf'),
  5,
  'the fifth and final attempt can be claimed'
);

update public.storage_cleanup_queue
   set next_attempt_at = now() - interval '1 minute'
 where object_path = 'claims/cleanup/later.pdf';

select is(
  (select count(*)::int from public.claim_storage_cleanup_batch(1, 300, 5)),
  0,
  'an expired final lease is not claimed for a sixth attempt'
);

select ok(
  (select dead_at is not null from public.storage_cleanup_queue
    where object_path = 'claims/cleanup/later.pdf'),
  'an expired final lease is persisted as dead for monitoring'
);

insert into public.storage_cleanup_queue
  (bucket_id, object_path, attempts, last_error, next_attempt_at)
values
  ('claim-docs', 'claims/cleanup/expired-a.pdf', 5, 'attempt four failed', now() - interval '3 minutes'),
  ('claim-docs', 'claims/cleanup/expired-b.pdf', 5, 'attempt four failed', now() - interval '2 minutes'),
  ('claim-docs', 'claims/cleanup/expired-c.pdf', 5, 'attempt four failed', now() - interval '1 minute'),
  ('claim-docs', 'claims/cleanup/fresh.pdf', 0, null, now() - interval '1 minute');

select is(
  (select count(*)::int from public.claim_storage_cleanup_batch(2, 300, 5)),
  0,
  'terminalizing two expired final leases spends the entire two-row batch budget, so no fresh row is also claimed'
);

select is(
  (select count(*)::int from public.storage_cleanup_queue
    where object_path like 'claims/cleanup/expired-%' and dead_at is not null),
  2,
  'terminal crash recovery is bounded by p_limit rather than sweeping every expired row'
);

select is(
  (select count(*)::int from public.storage_cleanup_queue
    where object_path like 'claims/cleanup/expired-%'
      and dead_at is not null
      and last_error = 'Cleanup worker lease expired during the final permitted attempt.'),
  2,
  'terminal crash recovery records the lease-expiry cause instead of preserving a stale earlier error'
);

select is(
  (select count(*)::int from public.claim_storage_cleanup_batch(0, 300, 5)),
  0,
  'a zero limit never becomes an unbounded claim'
);

select is(
  (select jsonb_build_object(
    'dead', count(*) filter (where dead_at is not null),
    'attempts', sum(attempts)
  )::text from public.storage_cleanup_queue
    where object_path in ('claims/cleanup/expired-a.pdf',
                          'claims/cleanup/expired-b.pdf',
                          'claims/cleanup/expired-c.pdf',
                          'claims/cleanup/fresh.pdf')),
  '{"dead": 2, "attempts": 15}',
  'p_limit zero has no side effects: it neither terminalizes the third expired lease nor claims the fresh row'
);

select * from finish();
rollback;
