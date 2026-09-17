-- CMG Property Solutions — safe, role-scoped staff claims projection
begin;
set local client_min_messages = warning;
create extension if not exists pgtap with schema extensions;

select plan(19);

select has_function('public', 'staff_claims_projection', array[]::text[],
  'staff claims projection exists');
select function_returns('public', 'staff_claims_projection', array[]::text[], 'setof record',
  'staff claims projection returns a filterable row set');
select volatility_is('public', 'staff_claims_projection', array[]::text[], 'stable',
  'staff claims projection is read-only');
select ok((select p.prosecdef from pg_proc p join pg_namespace n on n.oid=p.pronamespace
  where n.nspname='public' and p.proname='staff_claims_projection'),
  'projection executes under its fixed safe implementation');
select is((select p.proconfig from pg_proc p join pg_namespace n on n.oid=p.pronamespace
  where n.nspname='public' and p.proname='staff_claims_projection'),
  array['search_path=""']::text[], 'projection has an empty search path');
select ok(not has_function_privilege('anon','public.staff_claims_projection()','execute'),
  'anon cannot execute the projection');
select ok(has_function_privilege('authenticated','public.staff_claims_projection()','execute'),
  'authenticated callers can reach the role-gated projection');
select ok(not exists(
  select 1 from pg_proc p join pg_namespace n on n.oid=p.pronamespace
   where n.nspname='public' and p.proname='claim_search_text'),
  'the composite claims search function the projection replaced no longer exists');
-- 20260917120000 added the vendor-link provenance columns. They are output
-- names on the function, so an accidental rename is a catalog fact this can
-- check without depending on a row being present.
select ok((select array['intake_referral_partner_id','intake_referral_partner_name']
  <@ coalesce(p.proargnames, array[]::text[])
  from pg_proc p join pg_namespace n on n.oid=p.pronamespace
  where n.nspname='public' and p.proname='staff_claims_projection'),
  'projection exposes the vendor link partner and its name');
select ok(not exists(
  select 1 from pg_proc p join pg_namespace n on n.oid=p.pronamespace,
    unnest(coalesce(p.proargnames,array[]::text[])) output_name
  where n.nspname='public' and p.proname='staff_claims_projection'
    and output_name in ('esign_dispatch_token','esign_active_attempt_token')
), 'projection return schema excludes both e-sign bearer tokens');

set local request.jwt.claims =
  '{"sub":"00000000-0000-4000-a000-000000000001","role":"authenticated","aal":"aal2"}';
set local role authenticated;
select is((select count(*)::int from public.staff_claims_projection()),2,
  'AAL2 owner sees the complete claims list');
-- The seed leaves claim_ref to public.claims_before_insert(), which stamps the
-- year the seed was loaded in. Hard-coding 2026 made these three assertions
-- expire on New Year's Day; the year is computed from the same clock the
-- trigger reads instead.
select results_eq(
  $$select claim_ref from public.staff_claims_projection()
    where search_text ilike '%Marcus Bell%' order by claim_ref$$,
  $$values ('CMG-' || to_char(now(), 'YYYY') || '-0001')$$,
  'owner search matches an exact claimant name');
select results_eq(
  $$select claim_ref from public.staff_claims_projection()
    where search_text ilike '%Universal Property%' order by claim_ref$$,
  $$values ('CMG-' || to_char(now(), 'YYYY') || '-0002')$$,
  'owner search matches an exact carrier name');
select is((select count(*)::int from public.staff_claims_projection()
  where status='settled' and assigned_adjuster_id='00000000-0000-4000-a000-000000000002'
    and partner_company_id='10000000-0000-4000-a000-000000000001'),1,
  'combined status, adjuster, and partner filters produce a stable exact count');

reset role;
set local role service_role;
update public.claims set assigned_adjuster_id=null
where id='20000000-0000-4000-a000-000000000002';
reset role;
set local request.jwt.claims =
  '{"sub":"00000000-0000-4000-a000-000000000002","role":"authenticated","aal":"aal2"}';
set local role authenticated;
select results_eq(
  $$select claim_ref from public.staff_claims_projection() order by claim_ref$$,
  $$values ('CMG-' || to_char(now(), 'YYYY') || '-0001')$$,
  'adjuster sees only claims currently assigned to that adjuster');

reset role;
set local request.jwt.claims =
  '{"sub":"00000000-0000-4000-a000-000000000004","role":"authenticated","aal":"aal2"}';
set local role authenticated;
select is_empty($$select * from public.staff_claims_projection()$$,
  'customer receives no rows from the staff projection');

reset role;
set local request.jwt.claims =
  '{"sub":"00000000-0000-4000-a000-000000000005","role":"authenticated","aal":"aal2"}';
set local role authenticated;
select is_empty($$select * from public.staff_claims_projection()$$,
  'partner receives no rows from the staff projection');

reset role;
set local request.jwt.claims =
  '{"sub":"00000000-0000-4000-a000-000000000001","role":"authenticated","aal":"aal1"}';
set local role authenticated;
select is_empty($$select * from public.staff_claims_projection()$$,
  'staff below AAL2 receives no rows');

reset role;
set local request.jwt.claims =
  '{"sub":"00000000-0000-4000-a000-000000000001","role":"authenticated","aal":"aal2"}';
set local role service_role;
update public.profiles set is_active=false
where id='00000000-0000-4000-a000-000000000003';
reset role;
set local request.jwt.claims =
  '{"sub":"00000000-0000-4000-a000-000000000003","role":"authenticated","aal":"aal2"}';
set local role authenticated;
select is_empty($$select * from public.staff_claims_projection()$$,
  'deactivated staff receives no rows');

select * from finish();
rollback;
