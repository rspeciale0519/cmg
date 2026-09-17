-- Exact synthetic fixtures and all changes roll back. No object bytes exist.
begin;
set local client_min_messages = warning;
create extension if not exists pgtap with schema extensions;
set local search_path = public, extensions;
select no_plan();
\ir support/36_intake_upload_fixtures.inc

select ok((select relrowsecurity from pg_class where oid = 'public.claims'::regclass),
  'claims retain their RLS boundary');
select ok(not has_function_privilege('anon', signature, 'EXECUTE')
  and not has_function_privilege('authenticated', signature, 'EXECUTE'),
  'public callers cannot directly submit claims')
from (values ('public.submit_claim_transaction(jsonb,jsonb,jsonb,jsonb,jsonb,uuid,jsonb)')) rpc(signature);

set local role service_role;
create temporary table contractor_results(n integer, value jsonb) on commit drop;
-- Exercise the same finalizer with no file and one verified file.
do $test$
declare n integer; submission jsonb;
begin
  for n in 0..1 loop
    submission := pg_temp.intake_submission('40-' || n);
    submission := jsonb_set(submission, '{claim}', submission->'claim' ||
      jsonb_build_object('contractor_name', 'Test Contractor', 'contractor_company', 'Test Roofing',
        'contractor_phone', '4075550101', 'contractor_email', 'contractor@example.test'));
    perform public.begin_intake_upload_session(pg_temp.intake_id(40,n), pg_temp.intake_hash(40,n),
      submission, pg_temp.intake_files(pg_temp.intake_id(40,n), n));
    perform pg_temp.claim_intake_copies(40,n);
    perform pg_temp.seed_intake_objects(40,n);
    perform pg_temp.cache_intake_verifications(40,n);
    insert into contractor_results values (n, public.finalize_intake_upload_session(
      pg_temp.intake_id(40,n), pg_temp.intake_hash(40,n), pg_temp.intake_verified(40,n)));
  end loop;
end;
$test$;

select is(c.contractor_name, 'Test Contractor', 'contractor name persists for file count ' || r.n)
from contractor_results r join public.claims c on c.id = (r.value->>'id')::uuid;
select ok(c.contractor_company = 'Test Roofing' and c.contractor_phone = '4075550101'
  and c.contractor_email = 'contractor@example.test', 'all contractor details persist for file count ' || r.n)
from contractor_results r join public.claims c on c.id = (r.value->>'id')::uuid;
select ok(c.loss_time is null and c.partner_company_id is null,
  'no invented time or partner assignment for file count ' || r.n)
from contractor_results r join public.claims c on c.id = (r.value->>'id')::uuid;
select is((select count(*)::integer from public.documents d where d.claim_id = (r.value->>'id')::uuid),
  r.n, 'document count remains correct for file count ' || r.n) from contractor_results r;
select is(c.email, 'intake-40-' || r.n || '@example.test', 'homeowner remains claimant')
from contractor_results r join public.claimants c on c.claim_id = (r.value->>'id')::uuid;
select is(c.email, 'intake-40-' || r.n || '@example.test', 'homeowner remains consent contact')
from contractor_results r join public.consents c on c.claim_id = (r.value->>'id')::uuid;

select throws_ok($$update public.claims set contractor_phone = 'abcdefg'
  where id = (select (value->>'id')::uuid from contractor_results where n=0)$$,
  '23514', null, 'database rejects a phone without digits');
select throws_ok($$update public.claims set contractor_email = 'not-an-email'
  where id = (select (value->>'id')::uuid from contractor_results where n=0)$$,
  '23514', null, 'database rejects malformed contractor email');
select throws_ok($$update public.claims set contractor_name = repeat('x',81)
  where id = (select (value->>'id')::uuid from contractor_results where n=0)$$,
  '23514', null, 'database rejects an overlong name');

-- An older client and pending upload session can omit all new fields.
select lives_ok($$select pg_temp.seed_intake_session(40,2,interval '0',0)$$,
  'older submissions remain accepted');
insert into contractor_results values (2, public.finalize_intake_upload_session(
  pg_temp.intake_id(40,2), pg_temp.intake_hash(40,2), '[]'));
select ok(c.contractor_name is null and c.contractor_company is null
  and c.contractor_phone is null and c.contractor_email is null,
  'older submissions store null contractor metadata')
from public.claims c where c.id = (select (value->>'id')::uuid from contractor_results where n=2);
reset role;
select * from finish();
rollback;
