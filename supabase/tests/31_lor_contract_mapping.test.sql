begin;
select plan(8);

select has_type('public', 'lor_contract_type', 'agreement type enum exists');
select has_column('public', 'claims', 'lor_contract_type', 'claims store agreement type');
select col_is_null('public', 'claims', 'lor_contract_type', 'partner referrals may defer the answer');
select column_privs_are(
  'public', 'claims', 'lor_contract_type', 'authenticated', array['SELECT', 'INSERT', 'UPDATE'],
  'authenticated claim users keep the same column privileges'
);

set local role service_role;

create temporary table lor_result(value jsonb) on commit drop;
insert into lor_result
select public.submit_claim_transaction(
  jsonb_build_object(
    'property_street','31 Mapping Way','property_city','Orlando','property_state','Florida',
    'property_zip','32801','carrier','Citizens','policy_number','POL-31',
    'carrier_tenure','three_plus_years','prior_roof_claim',false,
    'loss_date','2026-07-14','loss_time','16:30','cause','wind_hail',
    'description','LOR mapping fixture','lor_contract_type','supplemental'
  ),
  '[{"first_name":"Rob","last_name":"Test","email":"rob@miodiollc.com","phone":"4075550100","initials":"RT","is_primary":true}]'::jsonb,
  '[]'::jsonb,'[]'::jsonb,'[]'::jsonb,null,null
);

select is(
  (select lor_contract_type::text from public.claims where id=(select (value->>'id')::uuid from lor_result)),
  'supplemental',
  'atomic intake stores the selected agreement type'
);

select throws_ok(
  $$ select public.submit_claim_transaction(
    '{"property_street":"Bad Type Way","property_city":"Orlando","property_zip":"32801","loss_date":"2026-07-14","cause":"wind","description":"invalid type","lor_contract_type":"guess"}'::jsonb,
    '[{"first_name":"Rob","last_name":"Test","email":"rob@miodiollc.com","initials":"RT","is_primary":true}]'::jsonb,
    '[]'::jsonb,'[]'::jsonb,'[]'::jsonb,null,null
  ) $$,
  '22P02',
  'invalid input value for enum public.lor_contract_type: "guess"',
  'unknown agreement types fail closed'
);

insert into public.claims(
  claim_ref,property_street,property_city,property_state,property_zip,
  loss_date,cause,description
) values (
  'CMG-2099-3131','Deferred Way','Orlando','Florida','32801',
  '2026-07-14','wind','partner-style fixture'
);

select is(
  (select lor_contract_type::text from public.claims where claim_ref='CMG-2099-3131'),
  null,
  'a claim that omits the answer stores null rather than guessing'
);

select is(
  (select string_agg(enumlabel::text, ',' order by enumsortorder)
   from pg_enum e join pg_type t on t.oid=e.enumtypid
   where t.typname='lor_contract_type'),
  'emergency,non_emergency,supplemental',
  'only the three printed agreement choices are accepted'
);

select * from finish();
rollback;
