begin;
set local client_min_messages = warning;
create extension if not exists pgtap with schema extensions;

select plan(18);

insert into public.partner_companies (
  id, name, status, contact_name, contact_email, contact_phone, notes
) values (
  '10000000-0000-4000-a000-000000000002', 'Second Roofing LLC', 'active',
  'Riley Stone', 'riley@example.test', '407-555-0199', 'internal relationship note'
);

insert into auth.users (
  instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
  raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
  confirmation_token, recovery_token, email_change_token_new, email_change
) values (
  '00000000-0000-0000-0000-000000000000',
  '00000000-0000-4000-a000-000000000015', 'authenticated', 'authenticated',
  'partner.two@example.test', extensions.crypt('CmgDev!2026', extensions.gen_salt('bf')),
  now(), '{"provider":"email","providers":["email"]}',
  '{"first_name":"Riley","last_name":"Stone"}', now(), now(), '', '', '', ''
);

update public.profiles
   set role = 'partner', partner_company_id = '10000000-0000-4000-a000-000000000002'
 where id = '00000000-0000-4000-a000-000000000015';

insert into public.claims (
  id, status, property_street, property_city, property_zip, carrier,
  policy_number, carrier_tenure, loss_date, cause, description, partner_company_id
) values (
  '25000000-0000-4000-a000-000000000001', 'under_review', '25 Other Co Way',
  'Orlando', '32801', 'Test Carrier', 'SECOND-001', 'lt_1_year', current_date - 3,
  'wind', 'second company isolation claim', '10000000-0000-4000-a000-000000000002'
);

insert into public.claim_events (id, claim_id, type, body, visibility) values
  ('45000000-0000-4000-a000-000000000001', '20000000-0000-4000-a000-000000000001', 'note', 'partner one', 'partner'),
  ('45000000-0000-4000-a000-000000000002', '20000000-0000-4000-a000-000000000001', 'note', 'shared one', 'shared'),
  ('45000000-0000-4000-a000-000000000003', '20000000-0000-4000-a000-000000000001', 'note', 'customer only', 'customer'),
  ('45000000-0000-4000-a000-000000000004', '20000000-0000-4000-a000-000000000001', 'note', 'internal only', 'internal'),
  ('45000000-0000-4000-a000-000000000005', '25000000-0000-4000-a000-000000000001', 'note', 'partner two', 'partner');

select has_function('public', 'partner_company_profile', array[]::name[],
  'the partner company profile RPC exists');
select is((select prosecdef from pg_proc where oid = 'public.partner_company_profile()'::regprocedure), true,
  'the narrow profile reader is security definer');
select function_privs_are('public', 'partner_company_profile', array[]::name[], 'anon', array[]::text[],
  'anonymous callers have no profile RPC privilege');
select function_privs_are('public', 'partner_company_profile', array[]::name[], 'authenticated', array['EXECUTE']::text[],
  'authenticated sessions may call the profile RPC');

set local request.jwt.claims = '{"sub":"00000000-0000-4000-a000-000000000005","role":"authenticated"}';
set local role authenticated;

select results_eq(
  $$ select id::text, name, contact_name, contact_email, contact_phone
       from public.partner_company_profile() $$,
  $$ values ('10000000-0000-4000-a000-000000000001', 'Summit Exteriors LLC',
             'Tyler Boone', 'partner@cmg.test', '407-555-0142') $$,
  'a rep reads only their own active company display/contact profile');
select ok(
  not ((select to_jsonb(p) from public.partner_company_profile() p) ? 'notes'),
  'the profile RPC structurally excludes internal company notes');
select is((select count(*)::int from public.partner_companies), 0,
  'the profile surface does not grant partners the underlying company table');
select results_eq(
  $$ select distinct partner_company_id::text from public.claim_partner_summaries
      where claim_id in ('20000000-0000-4000-a000-000000000001',
                         '20000000-0000-4000-a000-000000000002',
                         '25000000-0000-4000-a000-000000000001') $$,
  $$ values ('10000000-0000-4000-a000-000000000001') $$,
  'the first rep sees summaries only for the first company');
select is((select settlement_amount from public.claim_partner_summaries
            where claim_id = '20000000-0000-4000-a000-000000000001'), null::numeric,
  'an offer-stage amount remains hidden from the partner detail');
select is((select settlement_amount from public.claim_partner_summaries
            where claim_id = '20000000-0000-4000-a000-000000000002'), 128400.00::numeric,
  'a settled amount is available to the partner detail');
select results_eq(
  $$ select id::text from public.claim_events
      where id between '45000000-0000-4000-a000-000000000001'
                   and '45000000-0000-4000-a000-000000000005'
      order by id $$,
  $$ values ('45000000-0000-4000-a000-000000000001'),
            ('45000000-0000-4000-a000-000000000002') $$,
  'the first rep sees partner/shared events only on their company claim');
select is((select count(*)::int from public.claims), 0,
  'partners cannot read policy-bearing claims rows');
select is((select count(*)::int from public.claimants), 0,
  'partners cannot read claimant contact rows');
select is((select count(*)::int from public.documents), 0,
  'partners cannot read any document metadata');
select is((select count(*)::int from public.claim_financials), 0,
  'partners cannot read premature or ancillary financial records');

select set_config('request.jwt.claims', '', true);
reset role;
set local request.jwt.claims = '{"sub":"00000000-0000-4000-a000-000000000015","role":"authenticated"}';
set local role authenticated;

select results_eq(
  $$ select claim_id::text from public.claim_partner_summaries
      where claim_id in ('20000000-0000-4000-a000-000000000001',
                         '25000000-0000-4000-a000-000000000001') $$,
  $$ values ('25000000-0000-4000-a000-000000000001') $$,
  'a second-company rep sees only the second-company claim');
select results_eq(
  $$ select id::text from public.claim_events
      where id between '45000000-0000-4000-a000-000000000001'
                   and '45000000-0000-4000-a000-000000000005' $$,
  $$ values ('45000000-0000-4000-a000-000000000005') $$,
  'a second-company rep sees only its partner-visible activity');

select set_config('request.jwt.claims', '', true);
reset role;
update public.partner_companies set status = 'inactive'
 where id = '10000000-0000-4000-a000-000000000002';
set local request.jwt.claims = '{"sub":"00000000-0000-4000-a000-000000000015","role":"authenticated"}';
set local role authenticated;

select is_empty($$ select * from public.partner_company_profile() $$,
  'deactivating a company removes its read-only profile immediately');

select * from finish();
rollback;
