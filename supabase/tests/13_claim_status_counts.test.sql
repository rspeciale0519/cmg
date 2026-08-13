-- CMG Property Solutions — public.claim_status_counts()
--
-- The dashboard's ten stage numbers and its "N claims in view" eyebrow are this
-- function's output. Before it they were derived in TypeScript from
-- `select status from claims`, which PostgREST caps at db-max-rows (1000), so past a
-- thousand claims the ladder tallied the first page and called it the business — while
-- the nav badge beside it, a real `count: exact` head request, told the truth. The two
-- numbers sat 200px apart on the same screen and disagreed by 100×.
--
-- So the property this file exists to pin is not "the function returns numbers". It is
-- that the numbers are the same numbers a caller's own SELECT would produce — for every
-- role, and at a row count past the cap that broke the old one:
--
--   * the tally is RLS-scoped, and scoped the same way `claims_select` is (spec §4):
--     owner and assistant the business, an adjuster their caseload, a homeowner their
--     own claims, a partner nothing at all;
--   * the sum of the tally equals the number of rows that caller can select, so the
--     ladder and the list can never disagree about the same set;
--   * that equality still holds above 1000 rows — the case the old code got wrong;
--   * it is SECURITY INVOKER, because the moment it is not, an adjuster's caseload
--     tally silently becomes the whole firm's;
--   * anon cannot execute it.
--
--   owner      00000000-0000-4000-a000-000000000001  Austin Graham
--   adjuster   00000000-0000-4000-a000-000000000002  Dana Reyes    (assigned claims 1 and 2)
--   assistant  00000000-0000-4000-a000-000000000003  Priya Nolan
--   customer   00000000-0000-4000-a000-000000000004  Marcus Bell   (claimant on claim 1)
--   partner    00000000-0000-4000-a000-000000000005  Tyler Boone   (Summit Exteriors LLC)

begin;
set local client_min_messages = warning;
create extension if not exists pgtap with schema extensions;

select plan(21);

-- ---------------------------------------------------------------------------
-- Shape and grants
-- ---------------------------------------------------------------------------

select has_function(
  'public'::name, 'claim_status_counts'::name,
  'the stage tally exists in public, where PostgREST can reach it as an RPC'
);

select is(
  (select p.prosecdef from pg_proc p
     join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and p.proname = 'claim_status_counts'),
  false,
  'it is SECURITY INVOKER — claims_select is the authorization, and a definer here would hand an adjuster the whole firm''s tally'
);

select is(
  (select p.provolatile from pg_proc p
     join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and p.proname = 'claim_status_counts'),
  's'::"char",
  'and STABLE, so it may be inlined and cannot be treated as constant across statements'
);

select is(
  (select p.proconfig from pg_proc p
     join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and p.proname = 'claim_status_counts'),
  array['search_path=""'],
  'search_path is pinned empty, so no caller-controlled schema can shadow public.claims'
);

select ok(
  not has_function_privilege('anon', 'public.claim_status_counts()', 'EXECUTE'),
  'anon holds no EXECUTE on it — the revoke is explicit, not inherited from PUBLIC'
);

select ok(
  has_function_privilege('authenticated', 'public.claim_status_counts()', 'EXECUTE'),
  'any signed-in session may call it; claims_select decides what it answers'
);

-- ---------------------------------------------------------------------------
-- Fixtures
--
-- A third claim assigned to nobody, so "an adjuster tallies only their caseload" is
-- falsifiable rather than accidentally true, and a fourth at a different stage so the
-- tally has more than one row to get wrong.
-- ---------------------------------------------------------------------------

create temp table status_count_baseline as
select status, count(*)::bigint as claim_count
  from public.claims
 group by status;
grant select on status_count_baseline to authenticated;

insert into public.claims (
  id, status, property_street, property_city, property_zip,
  carrier, policy_number, carrier_tenure, loss_date, cause, description
) values (
  '20000000-0000-4000-a000-000000000003', 'new_intake',
  '31 Unassigned Ln', 'Sanford', '32771',
  'Test Carrier', 'POL-UNASSIGNED-1', 'lt_1_year', current_date - 6, 'wind',
  'claim held in the intake queue with no adjuster and no referring company'
),
(
  '20000000-0000-4000-a000-000000000004', 'new_intake',
  '9 Second Intake Way', 'Sanford', '32771',
  'Test Carrier', 'POL-UNASSIGNED-2', 'lt_1_year', current_date - 5, 'wind',
  'a second unassigned intake, so new_intake tallies 2 and a stray 1 would show'
);

-- ---------------------------------------------------------------------------
-- The owner: the business
-- ---------------------------------------------------------------------------

set local request.jwt.claims = '{"sub":"00000000-0000-4000-a000-000000000001","role":"authenticated","aal":"aal2"}';
set local role authenticated;

select is(
  (select claim_count from public.claim_status_counts() where status = 'new_intake'),
  coalesce((select claim_count from status_count_baseline where status = 'new_intake'), 0) + 2,
  'the owner tallies both unassigned intakes'
);

select is(
  (select sum(claim_count)::bigint from public.claim_status_counts()),
  (select count(*) from public.claims),
  'and the tally sums to every claim the owner can select — the ladder and the list are one set'
);

-- The defect in one assertion. `settlement_offered` and `settled` each hold exactly one
-- seeded claim; a tally derived from a capped page would under-report whichever fell
-- outside the window.
select results_eq(
  $$ select status::text, claim_count from public.claim_status_counts() order by status::text $$,
  $$ select status::text, count(*)::bigint from public.claims group by status order by status::text $$,
  'every stage matches a direct group-by over the same rows'
);

select is_empty(
  $$ select status::text from public.claim_status_counts() where claim_count = 0 $$,
  'a stage with no claims is absent rather than zero — the ladder renders the gap itself'
);

reset role;
select set_config('request.jwt.claims', '', true);

-- ---------------------------------------------------------------------------
-- The adjuster: their caseload, and not the intake queue
-- ---------------------------------------------------------------------------

set local request.jwt.claims = '{"sub":"00000000-0000-4000-a000-000000000002","role":"authenticated","aal":"aal2"}';
set local role authenticated;

select results_eq(
  $$ select status::text, claim_count from public.claim_status_counts() order by status::text $$,
  $$ select status::text, count(*)::bigint from public.claims group by status order by status::text $$,
  'every adjuster stage tally matches a direct group-by over only the claims their RLS can select'
);

select is(
  (select sum(claim_count)::bigint from public.claim_status_counts()),
  (select count(*) from public.claims),
  'their tally sums to their own selectable rows, which is the scoping the old .select("status") had'
);

reset role;
select set_config('request.jwt.claims', '', true);

-- ---------------------------------------------------------------------------
-- The assistant: the business, read-only
-- ---------------------------------------------------------------------------

set local request.jwt.claims = '{"sub":"00000000-0000-4000-a000-000000000003","role":"authenticated","aal":"aal2"}';
set local role authenticated;

select is(
  (select sum(claim_count)::bigint from public.claim_status_counts()),
  (select count(*) from public.claims),
  'an assistant tallies every claim, matching what their claims list shows them'
);

reset role;
select set_config('request.jwt.claims', '', true);

-- ---------------------------------------------------------------------------
-- Staff one factor short, a homeowner, a partner, anon
-- ---------------------------------------------------------------------------

-- aal1 is folded into private.current_app_role(), so an owner who has not finished
-- two-step verification is not an owner to any policy. The tally must not be the one
-- surface that answers them anyway.
set local request.jwt.claims = '{"sub":"00000000-0000-4000-a000-000000000001","role":"authenticated","aal":"aal1"}';
set local role authenticated;

select is(
  (select coalesce(sum(claim_count), 0)::bigint from public.claim_status_counts()),
  0::bigint,
  'an owner at aal1 tallies nothing — the second factor gates the count as it gates the rows'
);

reset role;
select set_config('request.jwt.claims', '', true);

set local request.jwt.claims = '{"sub":"00000000-0000-4000-a000-000000000004","role":"authenticated"}';
set local role authenticated;

select is(
  (select sum(claim_count)::bigint from public.claim_status_counts()),
  (select count(*) from public.claims),
  'a homeowner tally sums to exactly the claims their RLS can select'
);

select results_eq(
  $$ select status::text, claim_count from public.claim_status_counts() order by status::text $$,
  $$ select status::text, count(*)::bigint from public.claims group by status order by status::text $$,
  'every homeowner stage tally matches a direct group-by over only their own RLS-visible claims'
);

reset role;
select set_config('request.jwt.claims', '', true);

set local request.jwt.claims = '{"sub":"00000000-0000-4000-a000-000000000005","role":"authenticated"}';
set local role authenticated;

select is_empty(
  $$ select status::text from public.claim_status_counts() $$,
  'a partner rep tallies nothing — claims_select gives them no claim rows, so there is nothing to group'
);

reset role;
select set_config('request.jwt.claims', '', true);

set local role anon;
select throws_ok(
  $$ select 1 from public.claim_status_counts() $$, '42501'::char(5), null::text,
  'anon cannot reach it at all — the schema USAGE revoke refuses before the function''s own privileges are consulted'
);
reset role;

-- ---------------------------------------------------------------------------
-- Past the PostgREST ceiling
--
-- The regression itself. db-max-rows is 1000, so 1200 claims at one stage is the exact
-- condition under which the old TypeScript tally reported 1000 and the nav badge beside
-- it reported 1200. A function that aggregates in Postgres returns one row for the
-- stage, and the cap has nothing to bite on.
-- ---------------------------------------------------------------------------

insert into public.claims (
  status, property_street, property_city, property_zip,
  carrier, policy_number, carrier_tenure, loss_date, cause, description
)
select
  'documenting',
  n || ' Ceiling Test Rd', 'Sanford', '32771',
  'Test Carrier', 'POL-CEILING-' || n, 'lt_1_year', current_date - 4, 'wind',
  'bulk fixture proving the tally does not clamp at db-max-rows'
from generate_series(1, 1200) as n;

set local request.jwt.claims = '{"sub":"00000000-0000-4000-a000-000000000001","role":"authenticated","aal":"aal2"}';
set local role authenticated;

select is(
  (select claim_count from public.claim_status_counts() where status = 'documenting'),
  coalesce((select claim_count from status_count_baseline where status = 'documenting'), 0) + 1200,
  'twelve hundred claims at one stage tally as 1200 and not as 1000 — the defect, stated as a number'
);

select is(
  (select sum(claim_count)::bigint from public.claim_status_counts()),
  (select count(*) from public.claims),
  'and the whole tally still sums to the whole table above the ceiling'
);

select cmp_ok(
  (select count(*) from public.claim_status_counts()),
  '<=',
  (select count(*) from pg_enum e
     join pg_type t on t.oid = e.enumtypid
    where t.typname = 'claim_status')::bigint,
  'the result is bounded by the status enum however many claims exist, so db-max-rows can never apply to it'
);

reset role;
select set_config('request.jwt.claims', '', true);

select * from finish();
rollback;
