-- CMG Property Solutions — bounded admin claims search projection
begin;
set local client_min_messages = warning;
create extension if not exists pgtap with schema extensions;

select plan(6);

select has_function('public', 'claim_search_text', array['public.claims'],
  'claim search is exposed to PostgREST as a claims computed field');
select function_lang_is('public', 'claim_search_text', array['public.claims'], 'sql',
  'the computed field is a small stable SQL projection');
select volatility_is('public', 'claim_search_text', array['public.claims'], 'stable',
  'claim search does not mutate rows');
select ok(
  not has_function_privilege('anon', 'public.claim_search_text(public.claims)', 'execute'),
  'anon cannot execute the retired composite search helper');

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
