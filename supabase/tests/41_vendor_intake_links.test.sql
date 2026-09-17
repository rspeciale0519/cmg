begin;
set local client_min_messages = warning;
create extension if not exists pgtap with schema extensions;
set local search_path = public, extensions;
-- Exact, not no_plan(): three of the assertions below run once per row of
-- `vendor_intakes` and therefore count twice each, which is the arithmetic a
-- no_plan() suite silently stops checking. A fixture loop that stopped looping
-- would leave every remaining assertion passing and the suite green.
select plan(14);
\ir support/36_intake_upload_fixtures.inc

select ok((select count(*) = count(distinct intake_referral_code) from public.partner_companies),
  'each existing vendor has a distinct public link code');
select ok((select bool_and(intake_referral_code is not null) from public.partner_companies),
  'existing vendors receive a code');
select ok((select relrowsecurity from pg_class where oid='public.partner_companies'::regclass),
  'vendor directory RLS remains active');

set local role service_role;
create temporary table vendor_intakes(n integer, value jsonb) on commit drop;
do $test$
declare n integer; submission jsonb;
begin
  for n in 0..1 loop
    submission := pg_temp.intake_submission('41-' || n);
    submission := jsonb_set(submission, '{claim,intake_referral_partner_id}',
      '"10000000-0000-4000-a000-000000000001"');
    perform public.begin_intake_upload_session(pg_temp.intake_id(41,n), pg_temp.intake_hash(41,n),
      submission, pg_temp.intake_files(pg_temp.intake_id(41,n), n));
    perform pg_temp.claim_intake_copies(41,n);
    perform pg_temp.seed_intake_objects(41,n);
    perform pg_temp.cache_intake_verifications(41,n);
    insert into vendor_intakes values (n, public.finalize_intake_upload_session(
      pg_temp.intake_id(41,n), pg_temp.intake_hash(41,n), pg_temp.intake_verified(41,n)));
  end loop;
end;
$test$;
select is(c.intake_referral_partner_id, '10000000-0000-4000-a000-000000000001'::uuid,
  'trusted source persists with file count ' || r.n)
from vendor_intakes r join public.claims c on c.id=(r.value->>'id')::uuid;
select ok(c.partner_company_id is null, 'intake attribution does not assign partner access')
from vendor_intakes r join public.claims c on c.id=(r.value->>'id')::uuid;
select is((select count(*)::int from public.claim_partner_summaries p
  where p.claim_id=(r.value->>'id')::uuid),0,'public referral creates no partner projection')
from vendor_intakes r;
reset role;

select ok(not has_schema_privilege('anon','public','USAGE'),
  'anonymous visitors cannot query the vendor directory or link codes');
set local role authenticated;
set local request.jwt.claims = '{"sub":"00000000-0000-4000-a000-000000000005","role":"authenticated"}';
select is((select count(*)::int from public.partner_companies),0,
  'partner accounts cannot enumerate the vendor directory');
select is((select count(*)::int from public.claims where policy_number like 'FIXTURE-41-%'),0,
  'vendor link attribution grants no direct claim visibility');
set local request.jwt.claims = '{"sub":"00000000-0000-4000-a000-000000000001","role":"authenticated","aal":"aal1"}';
select is((select count(*)::int from public.partner_companies),0,
  'owner without MFA cannot read vendor link codes');
set local request.jwt.claims = '{"sub":"00000000-0000-4000-a000-000000000001","role":"authenticated","aal":"aal2"}';
select ok((select count(intake_referral_code)>0 from public.partner_companies),
  'owner with MFA can read the generated vendor links');
reset role;
select * from finish();
rollback;
