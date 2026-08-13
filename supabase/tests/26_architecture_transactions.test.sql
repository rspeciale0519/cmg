begin;
set local client_min_messages=warning;
create extension if not exists pgtap with schema extensions;
select plan(23);
set local role service_role;

select throws_ok($$select public.submit_contact_transaction(
 '{"name":"Atomic Lead","phone":"4075550101","email":"atomic-lead@example.test"}',
 '{"email":"atomic-lead@example.test","phone":"4075550101","kind":"email","consent_text":"test"}',
 '[{"recipient_email":null,"template":"lead_staff_alert","payload":{}}]')$$,
 '23502',null,'contact downstream failure aborts the transaction');
select is((select count(*)::int from public.leads where email='atomic-lead@example.test'),0,
 'failed contact leaves no lead PII');
select is((select count(*)::int from public.consents where email='atomic-lead@example.test'),0,
 'failed contact leaves no consent evidence');

select throws_ok($$select public.submit_claim_transaction(
 '{"property_street":"26 Rollback Rd","property_city":"Orlando","property_zip":"32801","carrier":"Carrier","policy_number":"POL-ROLL","carrier_tenure":"lt_1_year","loss_date":"2026-08-01","cause":"wind","description":"rollback"}',
 '[{"first_name":"Rollback","last_name":"Homeowner","email":"claim-rollback@example.test","phone":"4075550102","initials":"RH","is_primary":true}]',
 '[{"email":"claim-rollback@example.test","phone":"4075550102","kind":"email","consent_text":"test"}]',
 '[]','[{"recipient_email":null,"template":"intake_confirmation","payload":{"claimRef":"pending"}}]',null,null)$$,
 '23502',null,'claim downstream failure aborts the whole transaction');
select is((select count(*)::int from public.claims where property_street='26 Rollback Rd'),0,
 'failed claim leaves no claim PII');
select is((select count(*)::int from public.claimants where email='claim-rollback@example.test'),0,
 'failed claim leaves no claimant PII');
select is((select count(*)::int from public.consents where email='claim-rollback@example.test'),0,
 'failed claim leaves no consent evidence');

reset role;
insert into auth.users(instance_id,id,aud,role,email,encrypted_password,email_confirmed_at,
 raw_app_meta_data,raw_user_meta_data,created_at,updated_at,confirmation_token,recovery_token,
 email_change_token_new,email_change) values('00000000-0000-0000-0000-000000000000',
 '26000000-0000-4000-a000-000000000001','authenticated','authenticated','inactive-owner26@example.test',
 extensions.crypt('CmgDev!2026',extensions.gen_salt('bf')),now(),'{"provider":"email","providers":["email"]}',
 '{}',now(),now(),'','','','');
set local role service_role;
update public.profiles set role='owner',is_active=false
where id='26000000-0000-4000-a000-000000000001';
insert into public.claims(id,claim_ref,status,property_street,property_city,property_zip,
 loss_date,cause,description,referrer_name,referrer_email)
values('26000000-0000-4000-a000-000000000102','CMG-2026-2612','new_intake',
 '26 Owner Guard','Orlando','32801',current_date-2,'wind','owner guard','Referrer','guard-referrer@example.test');
insert into public.claimants(claim_id,first_name,last_name,email,initials,is_primary)
values('26000000-0000-4000-a000-000000000102','Guard','Homeowner','guard@example.test','GH',true);
create temporary table owner_guard_baseline(audit_count integer) on commit drop;
insert into owner_guard_baseline
select count(*)::integer from public.audit_log
where entity_id='26000000-0000-4000-a000-000000000102';

reset role;
set local request.jwt.claims='{"sub":"00000000-0000-4000-a000-000000000001","role":"authenticated","aal":"aal1"}';
set local role authenticated;
select throws_ok($$select public.accept_intake_transaction(
 '26000000-0000-4000-a000-000000000102','00000000-0000-4000-a000-000000000002',
 'none',null,null,'Carrier','POL-GUARD','lt_1_year','aal1 denied',null)$$,
 '42501','owner required','seeded owner at AAL1 cannot accept intake');

reset role;
set local request.jwt.claims='{"sub":"26000000-0000-4000-a000-000000000001","role":"authenticated","aal":"aal2"}';
set local role authenticated;
select throws_ok($$select public.accept_intake_transaction(
 '26000000-0000-4000-a000-000000000102','00000000-0000-4000-a000-000000000002',
 'none',null,null,'Carrier','POL-GUARD','lt_1_year','inactive denied',null)$$,
 '42501','owner required','deactivated owner at AAL2 cannot accept intake');

reset role;
set local request.jwt.claims='{"sub":"26000000-0000-4000-a000-000000000099","role":"authenticated","aal":"aal2"}';
set local role authenticated;
select throws_ok($$select public.accept_intake_transaction(
 '26000000-0000-4000-a000-000000000102','00000000-0000-4000-a000-000000000002',
 'none',null,null,'Carrier','POL-GUARD','lt_1_year','missing profile denied',null)$$,
 '42501','owner required','authenticated caller without a profile cannot accept intake');

reset role;
set local role service_role;
select is((select jsonb_build_object(
 'status',status,'assigned_adjuster_id',assigned_adjuster_id,'partner_company_id',partner_company_id,
 'carrier',carrier,'policy_number',policy_number,'carrier_tenure',carrier_tenure)
 from public.claims where id='26000000-0000-4000-a000-000000000102'),
 '{"status":"new_intake","assigned_adjuster_id":null,"partner_company_id":null,"carrier":null,"policy_number":null,"carrier_tenure":null}'::jsonb,
 'denied owner-guard calls leave all intake-owned claim fields unchanged');
select is((select count(*)::int from public.audit_log
 where entity_id='26000000-0000-4000-a000-000000000102'),
 (select audit_count from owner_guard_baseline),'denied owner-guard calls add no audit rows');

reset role;
set local request.jwt.claims='{"sub":"00000000-0000-4000-a000-000000000001","role":"authenticated","aal":"aal2"}';
set local role authenticated;
select is((public.accept_intake_transaction('26000000-0000-4000-a000-000000000102',
 '00000000-0000-4000-a000-000000000002','none',null,null,
 'Carrier','POL-GUARD','lt_1_year','aal2 accepted',null)->>'claim_ref'),
 'CMG-2026-2612','active owner at AAL2 accepts the same intake');
reset role;
set local role service_role;
select is((select count(*)::int from public.audit_log where entity_id='26000000-0000-4000-a000-000000000102'
 and action='claim.intake_accepted'),1,'AAL2 owner positive control records one acceptance audit');

insert into public.claims(id,claim_ref,status,property_street,property_city,property_zip,
 loss_date,cause,description,referrer_name,referrer_email)
values('26000000-0000-4000-a000-000000000101','CMG-2026-2611','new_intake',
 '26 Accept Lock','Orlando','32801',current_date-2,'wind','accept lock','Referrer','referrer@example.test');
insert into public.claimants(claim_id,first_name,last_name,email,initials,is_primary)
values('26000000-0000-4000-a000-000000000101','Accept','Homeowner','accept@example.test','AH',true);
reset role;
set local request.jwt.claims='{"sub":"00000000-0000-4000-a000-000000000001","role":"authenticated","aal":"aal2"}';
set local role authenticated;

select is((public.accept_intake_transaction('26000000-0000-4000-a000-000000000101',
 '00000000-0000-4000-a000-000000000002','new',null,'Atomic Partner 26',
 'Carrier','POL-26','lt_1_year','accepted atomically',null)->>'claim_ref'),
 'CMG-2026-2611','owner atomically accepts the queued claim');
select throws_ok($$select public.accept_intake_transaction(
 '26000000-0000-4000-a000-000000000101','00000000-0000-4000-a000-000000000003',
 'new',null,'Loser Orphan Partner','Carrier','POL-LOSER','lt_1_year','loser',null)$$,
 'P0002','intake unavailable','the losing accept is refused at the locked status');
reset role;
set local role service_role;
select is((select assigned_adjuster_id::text from public.claims where id='26000000-0000-4000-a000-000000000101'),
 '00000000-0000-4000-a000-000000000002','winning assignment is the final assignment');
select is((select count(*)::int from public.partner_companies where name='Atomic Partner 26'),1,
 'winner creates exactly one partner');
select is((select count(*)::int from public.partner_companies where name='Loser Orphan Partner'),0,
 'loser creates no orphan partner');
select is((select count(*)::int from public.claim_status_history where claim_id='26000000-0000-4000-a000-000000000101'
 and from_status='new_intake' and to_status='under_review'),1,'winner records one history row');
select is((select count(*)::int from public.claim_events where claim_id='26000000-0000-4000-a000-000000000101'
 and type='status'),1,'winner records one customer feed event');
select is((select count(*)::int from public.audit_log where entity_id='26000000-0000-4000-a000-000000000101'
 and action='claim.intake_accepted'),1,'winner audit agrees with committed claim');
select is((select count(*)::int from public.notifications_outbox where dedupe_key=
 'intake-accepted-status:26000000-0000-4000-a000-000000000101'),1,
 'winner queues one deduplicated homeowner status notification');
select * from finish();
rollback;
