begin;
set local client_min_messages = warning;
create extension if not exists pgtap with schema extensions;
select no_plan();

-- These synthetic rows are rolled back. No storage objects or emails are sent.
insert into public.claims(id,status,property_street,property_city,property_zip,carrier,policy_number,loss_date,cause,description,assigned_adjuster_id,partner_company_id)
values
 ('46000000-0000-4000-a000-000000000001','lor_sent','1 Legal Test St','Orlando','32801','Test insurer','TEST-1',current_date-3,'wind','Direct homeowner claim','00000000-0000-4000-a000-000000000002',null),
 ('46000000-0000-4000-a000-000000000002','lor_sent','2 Legal Test St','Orlando','32801','Test insurer','TEST-2',current_date-3,'wind','Referred claim',null,'10000000-0000-4000-a000-000000000001'),
 ('46000000-0000-4000-a000-000000000003','under_review','3 Legal Test St','Orlando','32801','Test insurer','TEST-3',current_date-3,'wind','Unsigned claim',null,null);
insert into public.documents(id,claim_id,storage_path,original_name,kind,mime,size_bytes,visibility)
values
 ('46000000-0000-4000-b000-000000000001','46000000-0000-4000-a000-000000000001','claims/46000000-0000-4000-a000-000000000001/legal-signed.pdf','signed.pdf','lor_signed','application/pdf',100,'internal'),
 ('46000000-0000-4000-b000-000000000002','46000000-0000-4000-a000-000000000001','claims/46000000-0000-4000-a000-000000000001/legal-photo.pdf','photo.pdf','other','application/pdf',200,'internal'),
 ('46000000-0000-4000-b000-000000000003','46000000-0000-4000-a000-000000000002','claims/46000000-0000-4000-a000-000000000002/legal-signed.pdf','foreign.pdf','lor_signed','application/pdf',100,'internal');
update public.claims set status='lor_signed',lor_signed_at=now()-interval '2 days'
where id in ('46000000-0000-4000-a000-000000000001','46000000-0000-4000-a000-000000000002');
insert into public.claimants(claim_id,user_id,first_name,last_name,email,initials,is_primary)
values ('46000000-0000-4000-a000-000000000001','00000000-0000-4000-a000-000000000004','Synthetic','Customer','legal-test@example.test','SC',true);
create temp table legal_ids(key text primary key,value uuid);
grant all on legal_ids to authenticated;

select throws_ok($$ insert into public.claims(status,property_street,property_city,property_zip,carrier,policy_number,loss_date,cause,description)
 values('with_law_firm','4 Test St','Orlando','32801','Test','TEST',current_date,'wind','Bypass') $$,
 '23514'::char(5),null::text,'direct insert cannot bypass the handoff');

set local request.jwt.claims='{"sub":"00000000-0000-4000-a000-000000000001","role":"authenticated","aal":"aal2"}';
set local role authenticated;
insert into legal_ids select 'firm',(public.save_law_firm(null,'Synthetic Firm','Test Contact','firm@example.test','4075550100',true)).id;
select throws_ok($$ insert into public.law_firms(name,contact_name,contact_email,contact_phone,created_by,updated_by)
 values('Bypass','Test','test@example.test','123','00000000-0000-4000-a000-000000000001','00000000-0000-4000-a000-000000000001') $$,
 '42501'::char(5),null::text,'even owners must use the guarded firm action');
select throws_ok($$ update public.claims set status='with_law_firm' where id='46000000-0000-4000-a000-000000000001' $$,
 '23514'::char(5),null::text,'the status picker cannot skip package and Sent confirmation');
select throws_ok($$ select public.start_legal_handoff('46000000-0000-4000-a000-000000000003',(select value from legal_ids where key='firm'),'46000000-0000-4000-c000-000000000003') $$,
 '23514'::char(5),null::text,'unsigned claims cannot enter legal preparation');
insert into legal_ids select 'handoff',(public.start_legal_handoff('46000000-0000-4000-a000-000000000001',(select value from legal_ids where key='firm'),'46000000-0000-4000-c000-000000000001')).id;
select is((select status from public.claims where id='46000000-0000-4000-a000-000000000001'),'lor_signed'::public.claim_status,'preparation does not mark a claim Sent');
select is((public.start_legal_handoff('46000000-0000-4000-a000-000000000001',(select value from legal_ids where key='firm'),'46000000-0000-4000-c000-000000000001')).id,
 (select value from legal_ids where key='handoff'),'repeated start returns the original handoff');
select throws_ok($$ select public.start_legal_handoff('46000000-0000-4000-a000-000000000001',(select value from legal_ids where key='firm'),'46000000-0000-4000-c000-000000000004') $$,
 '23505'::char(5),null::text,'a claim has only one active firm');
select throws_ok($$ select public.record_legal_milestone((select value from legal_ids where key='handoff'),1,'sent',(now() at time zone 'America/New_York')::date,null,'46000000-0000-4000-d000-000000000001') $$,
 '23514'::char(5),null::text,'Sent requires a prepared package');
select throws_ok($$ select public.prepare_legal_package((select value from legal_ids where key='handoff'),array['46000000-0000-4000-b000-000000000003'::uuid],array['claim'],'','46000000-0000-4000-e000-000000000001') $$,
 '42501'::char(5),null::text,'a foreign document cannot enter a package');
select throws_ok($$ select public.prepare_legal_package((select value from legal_ids where key='handoff'),array['46000000-0000-4000-b000-000000000001'::uuid],array['financial_notes'],'','46000000-0000-4000-e000-000000000002') $$,
 '23514'::char(5),null::text,'summary fields use an explicit allowlist');
insert into legal_ids select 'package',(public.prepare_legal_package((select value from legal_ids where key='handoff'),
 array['46000000-0000-4000-b000-000000000001'::uuid],array['claim','property'],'Reviewed summary','46000000-0000-4000-e000-000000000003')->>'id')::uuid;
select ok((select snapshot->>'summaryNote'='Reviewed summary' and jsonb_array_length(snapshot->'documents')=1 and jsonb_array_length(snapshot->'summary')=2 from public.claim_legal_packages where id=(select value from legal_ids where key='package')),'package stores only reviewed summary fields and selected documents');
select ok((select snapshot::text not like '%storage_path%' and snapshot::text not like '%https://%' from public.claim_legal_packages where id=(select value from legal_ids where key='package')),'package contains no storage paths or access links');
select is((select count(*)::int from public.legal_package_document((select value from legal_ids where key='package'),'46000000-0000-4000-b000-000000000001')),1,'selected unchanged document can be downloaded through the audited action');
select throws_ok($$ select public.legal_package_document((select value from legal_ids where key='package'),'46000000-0000-4000-b000-000000000002') $$,
 '42501'::char(5),null::text,'unselected same-claim document is refused');
select throws_ok($$ update public.claim_legal_packages set snapshot='{}' where id=(select value from legal_ids where key='package') $$,
 '42501'::char(5),null::text,'package snapshots cannot be rewritten by a user');

-- Assigned adjusters can manage, but cannot change the firm directory or another claim.
set local request.jwt.claims='{"sub":"00000000-0000-4000-a000-000000000002","role":"authenticated","aal":"aal2"}';
select is((select count(*)::int from public.claim_legal_handoffs where id=(select value from legal_ids where key='handoff')),1,'assigned adjuster sees legal work');
select throws_ok($$ select public.save_law_firm(null,'Other','Other','other@example.test','123',true) $$,
 '42501'::char(5),null::text,'only the owner manages the directory');
select throws_ok($$ select public.start_legal_handoff('46000000-0000-4000-a000-000000000002',(select value from legal_ids where key='firm'),'46000000-0000-4000-c000-000000000002') $$,
 '42501'::char(5),null::text,'unassigned adjuster cannot start a handoff');
select lives_ok($$ select public.record_legal_milestone((select value from legal_ids where key='handoff'),1,'sent',(now() at time zone 'America/New_York')::date,null,'46000000-0000-4000-d000-000000000001') $$,'assigned adjuster records the actual sent milestone');
select is((select status from public.claims where id='46000000-0000-4000-a000-000000000001'),'with_law_firm'::public.claim_status,'Sent sets the optional stage');
select throws_ok($$ update public.claims set carrier=null where id='46000000-0000-4000-a000-000000000001' $$,
 '23514'::char(5),null::text,'the legal stage retains insurer identity');
select throws_ok($$ update public.claims set carrier=E' \t ' where id='46000000-0000-4000-a000-000000000001' $$,
 '23514'::char(5),null::text,'the legal stage refuses a blank insurer');
select throws_ok($$ update public.claims set policy_number=null where id='46000000-0000-4000-a000-000000000001' $$,
 '23514'::char(5),null::text,'the legal stage retains policy identity');
select throws_ok($$ update public.claims set policy_number=E' \t ' where id='46000000-0000-4000-a000-000000000001' $$,
 '23514'::char(5),null::text,'the legal stage refuses a blank policy number');
delete from public.documents where id='46000000-0000-4000-b000-000000000001';
select is((select count(*)::int from public.documents where id='46000000-0000-4000-b000-000000000001'),1,'signed representation cannot be removed while the legal stage is active');
select throws_ok($$ update public.documents set kind='other' where id='46000000-0000-4000-b000-000000000001' $$,
 '42501'::char(5),null::text,'signed representation cannot be relabelled to evade retention');
select throws_ok($$ select public.cancel_legal_preparation((select value from legal_ids where key='handoff'),2,'46000000-0000-4000-f000-000000000001') $$,
 '23514'::char(5),null::text,'a sent handoff cannot be cancelled as unsent preparation');
select ok((public.record_legal_milestone((select value from legal_ids where key='handoff'),1,'sent',(now() at time zone 'America/New_York')::date,null,'46000000-0000-4000-d000-000000000001')->>'duplicate')::boolean,'duplicate milestone request returns the first result');
select throws_ok($$ select public.record_legal_milestone((select value from legal_ids where key='handoff'),1,'accepted',(now() at time zone 'America/New_York')::date,null,'46000000-0000-4000-d000-000000000002') $$,
 '23514'::char(5),null::text,'stale handoff version cannot overwrite a later milestone');
select throws_ok($$ select public.record_legal_milestone((select value from legal_ids where key='handoff'),2,'lawsuit_filed',(now() at time zone 'America/New_York')::date,null,'46000000-0000-4000-d000-000000000003') $$,
 '23514'::char(5),null::text,'a lawsuit cannot skip firm acceptance');
select throws_ok($$ select public.record_legal_milestone((select value from legal_ids where key='handoff'),2,'accepted',(now() at time zone 'America/New_York')::date+1,null,'46000000-0000-4000-d000-000000000003') $$,
 '23514'::char(5),null::text,'future milestones cannot be recorded as actual events');
select throws_ok($$ update public.claims set status='documenting' where id='46000000-0000-4000-a000-000000000001' $$,
 '23514'::char(5),null::text,'direct status change cannot skip the return confirmation');

set local request.jwt.claims='{"sub":"00000000-0000-4000-a000-000000000003","role":"authenticated","aal":"aal2"}';
select is((select count(*)::int from public.claim_legal_handoffs),0,'Assistant cannot read private legal records');
select throws_ok($$ select public.record_legal_milestone((select value from legal_ids where key='handoff'),2,'accepted',(now() at time zone 'America/New_York')::date,null,'46000000-0000-4000-d000-000000000004') $$,
 '42501'::char(5),null::text,'Assistant cannot record legal milestones');
set local request.jwt.claims='{"sub":"00000000-0000-4000-a000-000000000004","role":"authenticated"}';
select is((select count(*)::int from public.claim_legal_packages),0,'customer cannot read the document package');
select is(public.claim_legal_progress('46000000-0000-4000-a000-000000000001')->'contact','null'::jsonb,'firm contact stays private until acceptance');
select is(jsonb_array_length(public.claim_legal_progress('46000000-0000-4000-a000-000000000001')->'milestones'),1,'customer receives only the safe milestone projection');
select throws_ok($$ select public.claim_legal_progress('46000000-0000-4000-a000-000000000002') $$,
 '42501'::char(5),null::text,'customer cannot read another claim legal progress');
select throws_ok($$ select public.legal_package_document((select value from legal_ids where key='package'),'46000000-0000-4000-b000-000000000001') $$,
 '42501'::char(5),null::text,'customer cannot obtain a private package file');
set local request.jwt.claims='{"sub":"00000000-0000-4000-a000-000000000005","role":"authenticated"}';
select throws_ok($$ select public.claim_legal_progress('46000000-0000-4000-a000-000000000002') $$,
 '42501'::char(5),null::text,'referring company cannot read private legal progress');
set local request.jwt.claims='{"sub":"00000000-0000-4000-a000-000000000001","role":"authenticated","aal":"aal1"}';
select throws_ok($$ select public.claim_legal_progress('46000000-0000-4000-a000-000000000001') $$,
 '42501'::char(5),null::text,'Owner without the second factor cannot read legal work');

set local request.jwt.claims='{"sub":"00000000-0000-4000-a000-000000000001","role":"authenticated","aal":"aal2"}';
select lives_ok($$ select public.record_legal_milestone((select value from legal_ids where key='handoff'),2,'accepted',(now() at time zone 'America/New_York')::date,null,'46000000-0000-4000-d000-000000000005') $$,'owner records acceptance');
select is(public.claim_legal_progress('46000000-0000-4000-a000-000000000001')->'contact'->>'name','Synthetic Firm','accepted firm contact becomes available');
select lives_ok($$ select public.record_legal_milestone((select value from legal_ids where key='handoff'),3,'lawsuit_filed',(now() at time zone 'America/New_York')::date,null,'46000000-0000-4000-d000-000000000006') $$,'accepted claim can record a lawsuit');
select throws_ok($$ select public.record_legal_milestone((select value from legal_ids where key='handoff'),4,'returned',(now() at time zone 'America/New_York')::date,null,'46000000-0000-4000-d000-000000000007') $$,
 '23514'::char(5),null::text,'return requires an explicit current stage');
select lives_ok($$ select public.record_legal_milestone((select value from legal_ids where key='handoff'),4,'returned',(now() at time zone 'America/New_York')::date,'documenting','46000000-0000-4000-d000-000000000007') $$,'return records the manager-confirmed stage');
select is((select status from public.claims where id='46000000-0000-4000-a000-000000000001'),'documenting'::public.claim_status,'return uses the confirmed stage, not the old suggested stage');
select is(public.claim_legal_progress('46000000-0000-4000-a000-000000000001')->'contact','null'::jsonb,'ended handoff no longer presents an active firm contact');
select lives_ok($$ select public.start_legal_handoff('46000000-0000-4000-a000-000000000001',(select value from legal_ids where key='firm'),'46000000-0000-4000-c000-000000000005') $$,'a later handoff preserves the earlier history');
insert into legal_ids select 'unsent',id from public.claim_legal_handoffs where claim_id='46000000-0000-4000-a000-000000000001' and ended_at is null;
select throws_ok($$ select public.cancel_legal_preparation((select value from legal_ids where key='unsent'),2,'46000000-0000-4000-f000-000000000002') $$,
 '23514'::char(5),null::text,'cancellation refuses a stale expected version');
set local request.jwt.claims='{"sub":"00000000-0000-4000-a000-000000000003","role":"authenticated","aal":"aal2"}';
select throws_ok($$ select public.cancel_legal_preparation((select value from legal_ids where key='unsent'),1,'46000000-0000-4000-f000-000000000002') $$,
 '42501'::char(5),null::text,'Assistant cannot cancel preparation');
set local request.jwt.claims='{"sub":"00000000-0000-4000-a000-000000000001","role":"authenticated","aal":"aal2"}';
select lives_ok($$ select public.cancel_legal_preparation((select value from legal_ids where key='unsent'),1,'46000000-0000-4000-f000-000000000002') $$,'manager can cancel a mistaken unsent preparation');
select ok((public.cancel_legal_preparation((select value from legal_ids where key='unsent'),1,'46000000-0000-4000-f000-000000000002')->>'duplicate')::boolean,'duplicate cancellation returns the original result');
select is((select count(*)::int from public.claim_legal_milestones where handoff_id=(select value from legal_ids where key='unsent')),0,'cancellation creates no invented homeowner milestone');
select is((select status from public.claims where id='46000000-0000-4000-a000-000000000001'),'documenting'::public.claim_status,'cancellation leaves the claim stage unchanged');
select lives_ok($$ select public.start_legal_handoff('46000000-0000-4000-a000-000000000001',(select value from legal_ids where key='firm'),'46000000-0000-4000-c000-000000000006') $$,'cancellation frees the active preparation slot');
select lives_ok($$ select public.start_legal_handoff('46000000-0000-4000-a000-000000000002',(select value from legal_ids where key='firm'),'46000000-0000-4000-c000-000000000002') $$,'referred claims use the same legal workflow');
insert into legal_ids select 'referred',id from public.claim_legal_handoffs where claim_id='46000000-0000-4000-a000-000000000002' and ended_at is null;
select public.prepare_legal_package((select value from legal_ids where key='referred'),array['46000000-0000-4000-b000-000000000003'::uuid],array['claim'],'','46000000-0000-4000-e000-000000000004');
select public.record_legal_milestone((select value from legal_ids where key='referred'),1,'sent',(now() at time zone 'America/New_York')::date,null,'46000000-0000-4000-d000-000000000008');
select lives_ok($$ update public.claims set status='settlement_offered' where id='46000000-0000-4000-a000-000000000002' $$,'an offer can be recorded while the firm still handles the claim');
select ok((select ended_at is null from public.claim_legal_handoffs where id=(select value from legal_ids where key='referred')),'an offer retains the active handoff');
select lives_ok($$ update public.claims set status='settled' where id='46000000-0000-4000-a000-000000000002' $$,'existing settlement is available after the offer');
select ok((select ended_at is not null and outcome='settled' from public.claim_legal_handoffs where id=(select value from legal_ids where key='referred')),'settlement closes the active handoff');
select lives_ok($$ update public.claims set status='closed' where id='46000000-0000-4000-a000-000000000002' $$,'normal closure remains available after settlement');
update public.documents set original_name='changed.pdf' where id='46000000-0000-4000-b000-000000000001';
select throws_ok($$ select public.legal_package_document((select value from legal_ids where key='package'),'46000000-0000-4000-b000-000000000001') $$,
 '42501'::char(5),null::text,'changed document metadata invalidates the old package download');

reset role;
select is((select count(*)::int from public.notifications_outbox where dedupe_key in (select 'legal:'||id::text from public.claim_legal_milestones where claim_id='46000000-0000-4000-a000-000000000001')),4,'one notice exists per milestone despite the duplicate request');
select ok((select bool_and(payload->>'portalUrl'='https://app.cmgpropertysolutions.net/portal/claims/46000000-0000-4000-a000-000000000001') from public.notifications_outbox where dedupe_key in (select 'legal:'||id::text from public.claim_legal_milestones where claim_id='46000000-0000-4000-a000-000000000001')),'notice destination is fixed by the server');
select throws_ok($$ update public.claim_legal_milestones set occurred_on=current_date where claim_id='46000000-0000-4000-a000-000000000001' $$,
 '23514'::char(5),null::text,'immutable milestones reject even a privileged rewrite');
select is((select count(*)::int from public.claim_legal_handoffs where claim_id='46000000-0000-4000-a000-000000000001'),3,'returned, cancelled, and current handoff history are all retained');

select * from finish();
rollback;
