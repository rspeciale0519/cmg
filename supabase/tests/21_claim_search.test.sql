-- CMG Property Solutions — bounded admin claims search projection
begin;
set local client_min_messages = warning;
create extension if not exists pgtap with schema extensions;

select plan(4);

-- 20260917120000 dropped the composite computed field. It had been grantless
-- since 20260815210000, and a function taking public.claims as a whole row is
-- what forces PostgreSQL to materialize every column — the e-sign bearer tokens
-- included. Its absence is the assertion now.
select ok(not exists(
  select 1 from pg_proc p join pg_namespace n on n.oid = p.pronamespace
   where n.nspname = 'public' and p.proname = 'claim_search_text'
), 'the retired composite claims search function is gone from the catalog');
select ok(not exists(
  select 1 from pg_proc p join pg_namespace n on n.oid = p.pronamespace
   where n.nspname = 'public' and p.proname = 'claim_search_text'
     and (has_function_privilege('anon', p.oid, 'execute')
       or has_function_privilege('authenticated', p.oid, 'execute'))
), 'no client role holds a grant on the retired search helper');

set local request.jwt.claims = '{"sub":"00000000-0000-4000-a000-000000000001","role":"authenticated","aal":"aal2"}';
set local role authenticated;

select results_eq(
  $$ select id::text from public.staff_claims_projection()
      where search_text ilike '%Marcus Bell%'
        and id in ('20000000-0000-4000-a000-000000000001','20000000-0000-4000-a000-000000000002')
      order by id $$,
  $$ values ('20000000-0000-4000-a000-000000000001'::text) $$,
  'claimant names participate in search without a client-side ID expansion');

select results_eq(
  $$ select id::text from public.staff_claims_projection()
      where search_text ilike '%Universal Property%'
        and id in ('20000000-0000-4000-a000-000000000001','20000000-0000-4000-a000-000000000002')
      order by id $$,
  $$ values ('20000000-0000-4000-a000-000000000002'::text) $$,
  'claim scalar fields remain searchable through the same constant-shape predicate');

select * from finish();
rollback;
