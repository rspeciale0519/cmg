begin;
set local client_min_messages = warning;
create extension if not exists pgtap with schema extensions;
select plan(4);

-- The transaction restores the original counter after this boundary probe.
insert into public.claim_ref_counters as c (year, last_value)
values (extract(year from (now() at time zone 'America/New_York'))::int, 9998)
on conflict (year) do update set last_value = excluded.last_value;

select is(
  public.next_claim_ref(),
  'CMG-' || extract(year from (now() at time zone 'America/New_York'))::int::text || '-9999',
  'the last supported annual reference retains all four digits'
);

select throws_ok(
  $$select public.next_claim_ref()$$,
  '23514',
  'Annual claim reference capacity exceeded.',
  'annual exhaustion cannot truncate the reference to an earlier number'
);

select is(
  (select last_value from public.claim_ref_counters
   where year = extract(year from (now() at time zone 'America/New_York'))::int),
  9999,
  'the rejected allocation does not advance the annual counter'
);

select ok(
  not has_function_privilege('anon', 'public.next_claim_ref()', 'execute')
  and not has_function_privilege('authenticated', 'public.next_claim_ref()', 'execute'),
  'the replacement reference generator remains unavailable to public RPC callers'
);

select * from finish();
rollback;
