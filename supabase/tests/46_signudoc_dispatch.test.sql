-- Actual dispatch/filing SQL, private provider identities and fair poll leases.
begin;
set local search_path=public,extensions;
create extension if not exists pgtap with schema extensions;
select plan(38);
set local role service_role;
insert into public.claims(id,claim_ref,status,property_street,property_city,property_state,property_zip,carrier,policy_number,carrier_tenure,prior_roof_claim,loss_date,cause,description,lor_contract_type)
values
('46000000-0000-4000-8000-000000000001','CMG-2026-4601','under_review','100 Synthetic Lane','Example City','Florida','00000','Synthetic','TEST-1','lt_1_year',false,current_date,'wind','Synthetic SignuDoc fixture','non_emergency'),
('46000000-0000-4000-8000-000000000002','CMG-2026-4602','under_review','200 Synthetic Lane','Example City','Florida','00000','Synthetic','TEST-2','lt_1_year',false,current_date,'wind','Synthetic PandaDoc fixture','non_emergency');
select is(jsonb_array_length(public.claim_signudoc_poll_batch()),0,'unbound claims are not polled');
select is(public.claim_esign_dispatch('46000000-0000-4000-8000-000000000001','46000000-0000-4000-8000-000000000011','46000000-0000-4000-8000-000000000021','unknown')->>'status','invalid_mode','unknown provider modes remain closed');
select is(public.claim_esign_dispatch('46000000-0000-4000-8000-000000000001','46000000-0000-4000-8000-000000000011','46000000-0000-4000-8000-000000000021','signudoc')->>'status','claimed','SignuDoc reserves existing dispatch ownership');
select ok(not public.mark_esign_dispatch_sending('46000000-0000-4000-8000-000000000011','46000000-0000-4000-8000-000000000021','pd-wrong'),'SignuDoc refuses an unnamespaced identity');
select ok(public.mark_esign_dispatch_sending('46000000-0000-4000-8000-000000000011','46000000-0000-4000-8000-000000000021','signudoc:46000000-0000-4000-8000-000000000031'),'reviewed SignuDoc identity reaches sending');
select is(jsonb_array_length(public.claim_signudoc_poll_batch(1,600)),1,'bounded poll claims the active request');
select is(jsonb_array_length(public.claim_signudoc_poll_batch(1,600)),0,'overlapping poll cannot reuse the lease');
select is(public.claim_esign_dispatch('46000000-0000-4000-8000-000000000002','46000000-0000-4000-8000-000000000012','46000000-0000-4000-8000-000000000022','pandadoc')->>'status','claimed','PandaDoc reservation still works');
select ok(not public.mark_esign_dispatch_sending('46000000-0000-4000-8000-000000000012','46000000-0000-4000-8000-000000000022','signudoc:46000000-0000-4000-8000-000000000032'),'PandaDoc cannot claim a SignuDoc identity');
select ok(public.mark_esign_dispatch_sending('46000000-0000-4000-8000-000000000012','46000000-0000-4000-8000-000000000022','pd-synthetic-46'),'PandaDoc identity still works');
select is(jsonb_array_length(public.claim_signudoc_poll_batch(20,600)),0,'SignuDoc worker never claims PandaDoc');
select is(public.reconcile_esign_dispatch('46000000-0000-4000-8000-000000000001','signudoc:46000000-0000-4000-8000-000000000031','46000000-0000-4000-8000-000000000021','delivered'),'delivered','positive delivery proof clears uncertainty');
select is((select result->>'reconciled_by' from public.esign_dispatch_attempts where request_id='46000000-0000-4000-8000-000000000011'),'signudoc_poll','reconciliation audit names the actual source');
select ok(not has_column_privilege('authenticated','public.claims','esign_active_attempt_token','select'),'bearer attempt tokens remain server-only');
select ok(not has_column_privilege('authenticated','public.claims','esign_dispatch_token','select'),'dispatch tokens remain server-only');
select is(public.apply_esign_webhook_state('46000000-0000-4000-8000-000000000001','signudoc:46000000-0000-4000-8000-000000000031','46000000-0000-4000-8000-000000000021','document.declined'),'applied','terminal status is applied');
select is(public.apply_esign_webhook_state('46000000-0000-4000-8000-000000000001','signudoc:46000000-0000-4000-8000-000000000031','46000000-0000-4000-8000-000000000021','document.sent'),'ignored','older sent poll cannot undo a decline');
select is(public.apply_esign_webhook_state('46000000-0000-4000-8000-000000000001','signudoc:46000000-0000-4000-8000-000000000031','46000000-0000-4000-8000-000000000021','recipient.completed:1:2'),'ignored','older partial poll cannot undo a decline');
update public.claims set esign_status='document.sent' where id='46000000-0000-4000-8000-000000000001';
select public.enqueue_storage_cleanup_exact('claim-docs',array['claims/46000000-0000-4000-8000-000000000001/burned-evidence.pdf'],'46000000-0000-4000-8000-000000000001');
update public.storage_cleanup_queue set attempts=1,processed_at=now() where object_path like '%/burned-evidence.pdf';
select throws_ok($sql$insert into public.documents(claim_id,storage_path,original_name,kind,mime,size_bytes,visibility) values('46000000-0000-4000-8000-000000000001','claims/46000000-0000-4000-8000-000000000001/burned-evidence.pdf','Synthetic.pdf','other','application/pdf',100,'internal')$sql$,'55000','storage cleanup already claimed','claimed cleanup paths are permanently burned');
select public.enqueue_storage_cleanup_exact('claim-docs',array['claims/46000000-0000-4000-8000-000000000001/fresh-evidence.pdf'],'46000000-0000-4000-8000-000000000001');
select lives_ok($sql$insert into public.documents(claim_id,storage_path,original_name,kind,mime,size_bytes,visibility) values('46000000-0000-4000-8000-000000000001','claims/46000000-0000-4000-8000-000000000001/fresh-evidence.pdf','Synthetic.pdf','other','application/pdf',100,'internal')$sql$,'a new filing path works after cleanup');
delete from public.documents where storage_path like '%/fresh-evidence.pdf';
select is(public.apply_esign_webhook_state('46000000-0000-4000-8000-000000000001','signudoc:46000000-0000-4000-8000-000000000031','46000000-0000-4000-8000-000000000021','recipient.completed:2:2'),'applied','newer signing progress is applied');
select is(public.apply_esign_webhook_state('46000000-0000-4000-8000-000000000001','signudoc:46000000-0000-4000-8000-000000000031','46000000-0000-4000-8000-000000000021','recipient.completed:1:2'),'ignored','older partial count cannot regress progress');
select is((select esign_status from public.claims where id='46000000-0000-4000-8000-000000000001'),'recipient.completed:2:2','newest observed progress is retained');
select is(public.apply_esign_webhook_state('46000000-0000-4000-8000-000000000001','signudoc:46000000-0000-4000-8000-000000000031','46000000-0000-4000-8000-000000000021','document.completed'),'applied','completion status can precede private filing');
select is(public.finalize_esign_pdf('46000000-0000-4000-8000-000000000001','signudoc:46000000-0000-4000-8000-000000000031','46000000-0000-4000-8000-000000000021','signudoc:46000000-0000-4000-8000-000000000021:signed','claims/46000000-0000-4000-8000-000000000001/synthetic-signed.pdf','Synthetic signed.pdf',100)->>'status','evidence_pending','missing audit evidence prevents finalization');
select is((select status::text from public.claims where id='46000000-0000-4000-8000-000000000001'),'lor_sent','missing evidence cannot mark the claim signed');
insert into public.documents(claim_id,storage_path,original_name,kind,mime,size_bytes,visibility,external_event_key)
values('46000000-0000-4000-8000-000000000001','claims/46000000-0000-4000-8000-000000000001/synthetic-evidence.pdf','Synthetic audit.pdf','other','application/pdf',100,'internal','signudoc:46000000-0000-4000-8000-000000000021:evidence');
select is(public.finalize_esign_pdf('46000000-0000-4000-8000-000000000001','signudoc:46000000-0000-4000-8000-000000000031','46000000-0000-4000-8000-000000000021','signudoc:46000000-0000-4000-8000-000000000021:signed','claims/46000000-0000-4000-8000-000000000001/synthetic-signed.pdf','Synthetic signed.pdf',100)->>'status','recorded','both artifacts permit finalization');
select is((select status::text from public.claims where id='46000000-0000-4000-8000-000000000001'),'lor_signed','successful filing advances the claim');
select is((select count(*)::integer from public.documents where claim_id='46000000-0000-4000-8000-000000000001'),2,'signed agreement and evidence are both retained');
select is((select count(*)::integer from public.audit_log where entity_id='46000000-0000-4000-8000-000000000001' and action='esign.signudoc_artifacts_filed'),1,'atomic filing writes one explicit audit record');
select is((select count(*)::integer from public.claim_status_history where claim_id='46000000-0000-4000-8000-000000000001' and to_status='lor_signed'),1,'atomic filing records one transition');
select is((select count(*)::integer from public.claim_events where external_event_key='signudoc:46000000-0000-4000-8000-000000000021:completed'),1,'atomic filing posts one claim event');
select is(public.finalize_esign_pdf('46000000-0000-4000-8000-000000000001','signudoc:46000000-0000-4000-8000-000000000031','46000000-0000-4000-8000-000000000021','signudoc:46000000-0000-4000-8000-000000000021:signed','claims/46000000-0000-4000-8000-000000000001/synthetic-signed.pdf','Synthetic signed.pdf',100)->>'status','recorded','a repeated completion is idempotent');
select is((select count(*)::integer from public.documents where claim_id='46000000-0000-4000-8000-000000000001'),2,'replay does not duplicate files');
select is(jsonb_array_length(public.claim_signudoc_poll_batch(20,600)),0,'filed agreements leave the background batch');
select ok(not has_function_privilege('authenticated','public.claim_signudoc_poll_batch(integer,integer)','execute'),'signed-in clients cannot run the system worker');
select ok(not has_function_privilege('anon','public.claim_signudoc_poll_batch(integer,integer)','execute'),'anonymous clients cannot run the system worker');
select ok(not has_table_privilege('authenticated','public.esign_dispatch_attempts','select'),'dispatch ledger stays private');
select * from finish();
rollback;
