begin;
set local client_min_messages=warning;
create extension if not exists pgtap with schema extensions;
select no_plan();
select is(private.airtable_field_type_allowed('homeowner_name','date'),false,'a name cannot map to a date column');
select is(private.airtable_field_type_allowed('carrier','email'),false,'an insurer name cannot map to an email column');
select is(private.airtable_field_type_allowed('adjuster_name','singleSelect'),false,'free-text names cannot map to fixed choices');
select is(private.airtable_field_type_allowed('homeowner_email','email'),true,'email source can use an email column');
select is(private.airtable_field_type_allowed('loss_date','singleLineText'),true,'dates may use a reviewed plain-text column');

-- Synthetic SQL fixtures only. No Airtable request, email, or stored file exists.
insert into public.partner_companies(id,name,status) values('47000000-0000-4000-f000-000000000001','Other synthetic company','active');
insert into public.claims(id,status,property_street,property_city,property_zip,carrier,policy_number,loss_date,cause,description,assigned_adjuster_id,partner_company_id)
values
 ('47000000-0000-4000-a000-000000000001','under_review','1 Airtable Test St','Orlando','32801','Test','AT-1',current_date,'wind','Synthetic referred claim','00000000-0000-4000-a000-000000000002','10000000-0000-4000-a000-000000000001'),
 ('47000000-0000-4000-a000-000000000002','under_review','2 Airtable Test St','Orlando','32801','Test','AT-2',current_date,'wind','Synthetic direct claim',null,null),
 ('47000000-0000-4000-a000-000000000003','under_review','3 Airtable Test St','Orlando','32801','Test','AT-3',current_date,'wind','Other company claim',null,'47000000-0000-4000-f000-000000000001'),
 ('47000000-0000-4000-a000-000000000004','under_review','4 Airtable Test St','Orlando','32801','Test','AT-4',current_date,'wind','Automatic review barrier',null,'10000000-0000-4000-a000-000000000001');
insert into public.claimants(id,claim_id,first_name,last_name,email,phone,initials,is_primary)
values('47000000-0000-4000-b000-000000000001','47000000-0000-4000-a000-000000000001','Synthetic','Customer','airtable@example.test','4075550100','SC',true);
insert into public.airtable_connections(id,company_id,needs_reconnect)
values('47000000-0000-4000-c000-000000000001','10000000-0000-4000-a000-000000000001',false);
create temp table airtable_test_values(key text primary key,value jsonb);
grant all on airtable_test_values to authenticated,service_role;

set local request.jwt.claims='{"sub":"00000000-0000-4000-a000-000000000001","role":"authenticated","aal":"aal2"}';
set local role authenticated;
select throws_ok($$select ciphertext from public.airtable_credentials$$,'42501'::char(5),null::text,'Owners cannot read token ciphertext directly');
select throws_ok($$select public.claim_airtable_batch(1,null)$$,'42501'::char(5),null::text,'Owners cannot claim system delivery leases');
select throws_ok($$select public.configure_airtable_company('10000000-0000-4000-a000-000000000001',null,'{}')$$,'40001'::char(5),null::text,'NULL company revision cannot bypass concurrency guard');
select lives_ok($$select public.configure_airtable_company('10000000-0000-4000-a000-000000000001',1,'{
 "baseId":"app00000000000001","tableId":"tbl00000000000001","mode":"milestones","enabled":true,
 "fields":["claim_ref","status","filed_at","homeowner_phone","messages"],
 "mappings":[
  {"source":"claim_ref","fieldId":"fld00000000000001","fieldType":"singleLineText"},
  {"source":"status","fieldId":"fld00000000000002","fieldType":"singleLineText"},
  {"source":"filed_at","fieldId":"fld00000000000003","fieldType":"dateTime"},
  {"source":"homeowner_phone","fieldId":"fld00000000000004","fieldType":"phoneNumber"},
  {"source":"messages","fieldId":"fld00000000000005","fieldType":"multilineText"}]
}')$$,'Owner can save the explicit company mapping');
select throws_ok($$select public.configure_airtable_claim('47000000-0000-4000-a000-000000000002',0,'rec00000000000002','{"expectedConnectionId":"47000000-0000-4000-c000-000000000001","expectedConfigRevision":2}',true)$$,
 '22023'::char(5),null::text,'direct claims do not require or receive a company connection');
select throws_ok($$select public.configure_airtable_claim('47000000-0000-4000-a000-000000000001',null,'rec00000000000001','{"expectedConnectionId":"47000000-0000-4000-c000-000000000001","expectedConfigRevision":2}',true)$$,
 '40001'::char(5),null::text,'NULL claim revision cannot bypass concurrency guard');
select lives_ok($$select public.configure_airtable_claim('47000000-0000-4000-a000-000000000001',0,'rec00000000000001','{"expectedConnectionId":"47000000-0000-4000-c000-000000000001","expectedConfigRevision":2}',true)$$,'Owner confirms an existing record');
select is((select count(*)::int from public.airtable_delivery_requests where claim_id='47000000-0000-4000-a000-000000000001' and status='held'),1,'first update is held even in automatic milestone mode');
select is((select count(*)::int from public.airtable_delivery_requests where claim_id='47000000-0000-4000-a000-000000000001' and status='pending'),0,'initial link cannot send without review');
select lives_ok($$select public.configure_airtable_claim('47000000-0000-4000-a000-000000000004',0,'rec00000000000004','{"mode":"automatic","fields":["claim_ref","status","filed_at"],"expectedConnectionId":"47000000-0000-4000-c000-000000000001","expectedConfigRevision":2}',true)$$,'automatic claim still starts with a review barrier');
reset role;
update public.claims set filed_at=now() where id='47000000-0000-4000-a000-000000000004';
select is((select count(*)::int from public.airtable_delivery_requests where claim_id='47000000-0000-4000-a000-000000000004' and status='pending'),0,'source change cannot release an unapproved first automatic update');
select is((select count(*)::int from public.airtable_delivery_requests where claim_id='47000000-0000-4000-a000-000000000004' and status='held'),1,'first review is rebuilt with current source values');
set local role authenticated;
select lives_ok($$select public.approve_airtable_update(id,digest) from public.airtable_delivery_requests where claim_id='47000000-0000-4000-a000-000000000004' and status='held'$$,'explicit first approval removes the initial review barrier');
reset role;
update public.airtable_delivery_requests set status='sent' where claim_id='47000000-0000-4000-a000-000000000004' and status='pending';
set local role authenticated;
select lives_ok($$select public.configure_airtable_claim('47000000-0000-4000-a000-000000000004',1,'rec00000000000004','{"mode":"manual","fields":["claim_ref","status","filed_at"],"expectedConnectionId":"47000000-0000-4000-c000-000000000001","expectedConfigRevision":2}',true)$$,'manual mode creates a held current review');
select lives_ok($$select public.configure_airtable_claim('47000000-0000-4000-a000-000000000004',2,'rec00000000000004','{"mode":"automatic","fields":["claim_ref","status","filed_at"],"expectedConnectionId":"47000000-0000-4000-c000-000000000001","expectedConfigRevision":2}',true)$$,'changing to automatic preserves explicit review');
reset role;
update public.claims set filed_at=now()+interval '2 minutes' where id='47000000-0000-4000-a000-000000000004';
select is((select count(*)::int from public.airtable_delivery_requests where claim_id='47000000-0000-4000-a000-000000000004' and status='pending'),0,'automatic mode plus a source edit cannot release previously held work');
reset role;
insert into public.airtable_connections(id,company_id,base_id,table_id,mappings,default_fields,default_mode,enabled,needs_reconnect)
select '47000000-0000-4000-c000-000000000002','47000000-0000-4000-f000-000000000001',base_id,table_id,mappings,default_fields,default_mode,true,false
from public.airtable_connections where id='47000000-0000-4000-c000-000000000001';
set local role authenticated;
select throws_ok($$select public.configure_airtable_claim('47000000-0000-4000-a000-000000000003',0,'rec00000000000001','{"expectedConnectionId":"47000000-0000-4000-c000-000000000002","expectedConfigRevision":1}',true)$$,
 '23505'::char(5),null::text,'two company connections cannot bind the same external record');
select throws_ok($$select public.approve_airtable_update((select id from public.airtable_delivery_requests where claim_id='47000000-0000-4000-a000-000000000001' and status='held'),null)$$,
 '40001'::char(5),null::text,'NULL digest cannot approve a snapshot');
select lives_ok($$select public.approve_airtable_update(id,digest) from public.airtable_delivery_requests where claim_id='47000000-0000-4000-a000-000000000001' and status='held'$$,'Owner approves the exact first snapshot');
select throws_ok($$select public.retry_airtable_update((select id from public.airtable_delivery_requests where claim_id='47000000-0000-4000-a000-000000000001' and status='pending'),null)$$,
 '22023'::char(5),null::text,'NULL digest cannot authorize a retry');

-- Simulate completed initial delivery without running a provider or worker.
reset role;
update public.airtable_delivery_requests set status='sent' where claim_id='47000000-0000-4000-a000-000000000001';
update public.claims set filed_at=now() where id='47000000-0000-4000-a000-000000000001';
select is((select count(*)::int from public.airtable_delivery_requests where claim_id='47000000-0000-4000-a000-000000000001' and status='pending'),1,'stage/date change queues automatic work');
update public.claimants set phone='4075550101' where id='47000000-0000-4000-b000-000000000001';
select is((select count(*)::int from public.airtable_delivery_requests where claim_id='47000000-0000-4000-a000-000000000001' and status='pending'),1,'contact change preserves the unsent automatic partition');
select is((select count(*)::int from public.airtable_delivery_requests where claim_id='47000000-0000-4000-a000-000000000001' and status='held'),1,'contact change creates its review partition');
update public.claims set filed_at=now()+interval '1 minute' where id='47000000-0000-4000-a000-000000000001';
select is((select count(*)::int from public.airtable_delivery_requests where claim_id='47000000-0000-4000-a000-000000000001' and status='held'),1,'later date change preserves unsent contact review');
select is((select source_values->>'homeowner_phone' from public.airtable_delivery_requests where claim_id='47000000-0000-4000-a000-000000000001' and status='held'),'4075550101','rebuilt review uses current source values');
select ok(not exists(select 1 from public.airtable_delivery_requests r join public.airtable_claim_links l on l.claim_id=r.claim_id where r.status in ('pending','held') and r.source_revision<>l.source_revision),'rebuilt partitions share the current source version');

set local role authenticated;
set local request.jwt.claims='{"sub":"00000000-0000-4000-a000-000000000002","role":"authenticated","aal":"aal2"}';
select lives_ok($$select public.post_airtable_message('47000000-0000-4000-a000-000000000001','First shared message','47000000-0000-4000-d000-000000000001')$$,'assigned adjuster can add an explicitly shared message');
select lives_ok($$select public.post_airtable_message('47000000-0000-4000-a000-000000000001','First shared message','47000000-0000-4000-d000-000000000001')$$,'same message request is idempotent');
select is((select count(*)::int from public.airtable_shared_messages where claim_id='47000000-0000-4000-a000-000000000001'),1,'retry does not duplicate message history');
select throws_ok($$select public.post_airtable_message('47000000-0000-4000-a000-000000000001','Different text','47000000-0000-4000-d000-000000000001')$$,
 '22023'::char(5),null::text,'request ID cannot conceal changed message content');
select throws_ok($$select public.configure_airtable_company('10000000-0000-4000-a000-000000000001',2,'{}')$$,
 '42501'::char(5),null::text,'assigned adjuster cannot expand company mappings');
set local request.jwt.claims='{"sub":"00000000-0000-4000-a000-000000000003","role":"authenticated","aal":"aal2"}';
select is((select count(*)::int from public.airtable_claim_links),0,'Assistant cannot read private claim sharing');
select throws_ok($$select public.post_airtable_message('47000000-0000-4000-a000-000000000001','No access','47000000-0000-4000-d000-000000000002')$$,
 '42501'::char(5),null::text,'Assistant cannot send company messages');
select throws_ok($$select public.set_airtable_company_paused('10000000-0000-4000-a000-000000000001',true)$$,
 '42501'::char(5),null::text,'Assistant cannot pause a company connection');
select throws_ok($$select public.set_airtable_claim_paused('47000000-0000-4000-a000-000000000001',true)$$,
 '42501'::char(5),null::text,'Assistant cannot change a claim sharing pause');
set local request.jwt.claims='{"sub":"00000000-0000-4000-a000-000000000004","role":"authenticated"}';
select is((select count(*)::int from public.airtable_delivery_requests),0,'homeowner cannot read integration payloads');
set local request.jwt.claims='{"sub":"00000000-0000-4000-a000-000000000005","role":"authenticated"}';
select is((select count(*)::int from public.airtable_connections),0,'referring company cannot read integration settings');
set local request.jwt.claims='{"sub":"00000000-0000-4000-a000-000000000001","role":"authenticated","aal":"aal1"}';
select is((select count(*)::int from public.airtable_claim_links),0,'Owner without the second factor cannot read claim sharing');

set local request.jwt.claims='{"sub":"00000000-0000-4000-a000-000000000001","role":"authenticated","aal":"aal2"}';
select lives_ok($$select public.begin_airtable_oauth('10000000-0000-4000-a000-000000000001',repeat('a',64),'synthetic encrypted state')$$,'Owner can begin one scoped authorization');
select ok(public.consume_airtable_oauth(repeat('a',64)) is not null,'state can be consumed by its Owner once');
select is(public.consume_airtable_oauth(repeat('a',64)),null::jsonb,'reused state is refused');

reset role;
set local request.jwt.claims='{"role":"service_role"}';
set local role service_role;
insert into airtable_test_values values('batch',public.claim_airtable_batch(5,'47000000-0000-4000-a000-000000000001'));
select is(jsonb_array_length((select value from airtable_test_values where key='batch')),1,'only one delivery owns a record at a time');
select is(jsonb_array_length(public.claim_airtable_batch(5,'47000000-0000-4000-a000-000000000001')),0,'concurrent worker cannot lease the same record');
select ok(public.airtable_request_ready(((select value from airtable_test_values where key='batch')->0->>'id')::uuid,((select value from airtable_test_values where key='batch')->0->>'leaseToken')::uuid,false) is not null,'current lease can prepare its exact snapshot');
select is(public.settle_airtable_request(((select value from airtable_test_values where key='batch')->0->>'id')::uuid,'47000000-0000-4000-e000-000000000001','sent','{}'),false,'stale worker cannot settle another lease');
select is(public.settle_airtable_request(((select value from airtable_test_values where key='batch')->0->>'id')::uuid,((select value from airtable_test_values where key='batch')->0->>'leaseToken')::uuid,'uncertain','{}'),true,'lost result remains uncertain');
select throws_ok($$select public.configure_airtable_company('10000000-0000-4000-a000-000000000001',2,'{}')$$,'42501'::char(5),null::text,'system worker cannot use Owner configuration action');

-- An older held partition can be approved after a newer send becomes uncertain.
-- Creation order must never let that approval pass the same-record barrier.
reset role;
update public.airtable_delivery_requests set created_at='2000-01-01T00:00:00Z' where claim_id='47000000-0000-4000-a000-000000000001' and status='held';
update public.airtable_delivery_requests set created_at='2100-01-01T00:00:00Z',next_attempt_at=now()+interval '1 minute' where claim_id='47000000-0000-4000-a000-000000000001' and status='uncertain';
set local request.jwt.claims='{"sub":"00000000-0000-4000-a000-000000000001","role":"authenticated","aal":"aal2"}';
set local role authenticated;
select lives_ok($$select public.approve_airtable_update(id,digest) from public.airtable_delivery_requests where claim_id='47000000-0000-4000-a000-000000000001' and status='held'$$,'older held partition can receive explicit approval');
reset role;
set local request.jwt.claims='{"role":"service_role"}';
set local role service_role;
select is(jsonb_array_length(public.claim_airtable_batch(5,'47000000-0000-4000-a000-000000000001')),0,'any uncertain peer blocks an older newly approved pending update');
update public.airtable_delivery_requests set next_attempt_at=now() where claim_id='47000000-0000-4000-a000-000000000001' and status='uncertain';
insert into airtable_test_values values('reversed-order',public.claim_airtable_batch(5,'47000000-0000-4000-a000-000000000001'));
select is(jsonb_array_length((select value from airtable_test_values where key='reversed-order')),1,'only one uncertain reconciliation receives the record lease');
select is(((select value from airtable_test_values where key='reversed-order')->0->>'uncertain')::boolean,true,'newer uncertain result runs before older pending work');
select is(public.settle_airtable_request(((select value from airtable_test_values where key='reversed-order')->0->>'id')::uuid,((select value from airtable_test_values where key='reversed-order')->0->>'leaseToken')::uuid,'uncertain','{}'),true,'reconciliation retains the barrier until its actual result is known');

reset role;
set local request.jwt.claims='{"sub":"00000000-0000-4000-a000-000000000001","role":"authenticated","aal":"aal2"}';
set local role authenticated;
select lives_ok($$select public.set_airtable_company_paused('10000000-0000-4000-a000-000000000001',true)$$,'Owner can pause while an outcome is uncertain');
select is((select enabled from public.airtable_connections where id='47000000-0000-4000-c000-000000000001'),false,'pause disables future company attempts');
select is((select config_revision from public.airtable_connections where id='47000000-0000-4000-c000-000000000001'),2::bigint,'pause preserves target configuration revision');
select is((select count(*)::int from public.airtable_delivery_requests where claim_id='47000000-0000-4000-a000-000000000001' and status='uncertain'),1,'pause preserves the uncertain result');
select lives_ok($$select public.set_airtable_company_paused('10000000-0000-4000-a000-000000000001',false)$$,'Owner can resume checking the unchanged destination');
select is((select count(*)::int from public.airtable_delivery_requests where claim_id='47000000-0000-4000-a000-000000000001' and status in ('pending','held')),0,'resume does not release old pending or held snapshots');
select is((select review_required from public.airtable_claim_links where claim_id='47000000-0000-4000-a000-000000000001'),true,'resume requires a new full review');
reset role;
set local request.jwt.claims='{"role":"service_role"}';
set local role service_role;
update public.airtable_delivery_requests set next_attempt_at=now() where claim_id='47000000-0000-4000-a000-000000000001' and status='uncertain';
insert into airtable_test_values values('resumed',public.claim_airtable_batch(1,'47000000-0000-4000-a000-000000000001'));
select ok(public.airtable_request_ready(((select value from airtable_test_values where key='resumed')->0->>'id')::uuid,((select value from airtable_test_values where key='resumed')->0->>'leaseToken')::uuid,true) is not null,'resumed uncertainty can read back the original destination');
select is(public.airtable_request_ready(((select value from airtable_test_values where key='resumed')->0->>'id')::uuid,((select value from airtable_test_values where key='resumed')->0->>'leaseToken')::uuid,false),null::jsonb,'resumed uncertainty cannot write past the review barrier');
select is(public.settle_airtable_request(((select value from airtable_test_values where key='resumed')->0->>'id')::uuid,((select value from airtable_test_values where key='resumed')->0->>'leaseToken')::uuid,'uncertain','{}'),true,'readback without a known result retains uncertainty');
reset role;
set local request.jwt.claims='{"sub":"00000000-0000-4000-a000-000000000002","role":"authenticated","aal":"aal2"}';
set local role authenticated;
select lives_ok($$select public.set_airtable_claim_paused('47000000-0000-4000-a000-000000000001',true)$$,'assigned adjuster can pause their own claim');
select lives_ok($$select public.set_airtable_claim_paused('47000000-0000-4000-a000-000000000001',false)$$,'assigned adjuster can resume their claim with review required');
select is((select review_required from public.airtable_claim_links where claim_id='47000000-0000-4000-a000-000000000001'),true,'claim resume keeps the full-review barrier');
select lives_ok($$select public.preview_airtable_update('47000000-0000-4000-a000-000000000001')$$,'resumed manager prepares current values for full review');
select lives_ok($$select public.approve_airtable_update(id,digest) from public.airtable_delivery_requests where claim_id='47000000-0000-4000-a000-000000000001' and status='held'$$,'explicit current approval can remove the review barrier');
select is((select review_required from public.airtable_claim_links where claim_id='47000000-0000-4000-a000-000000000001'),false,'only the reviewed update clears the barrier');
select is((select count(*)::int from public.airtable_delivery_requests where claim_id='47000000-0000-4000-a000-000000000001' and status='uncertain'),1,'full review still cannot erase an uncertain peer');
reset role;
set local request.jwt.claims='{"role":"service_role"}';
set local role service_role;

insert into public.airtable_credentials(connection_id,ciphertext,expires_at) values('47000000-0000-4000-c000-000000000001','synthetic pair',now());
insert into airtable_test_values values('refresh',public.claim_airtable_refresh('47000000-0000-4000-c000-000000000001'));
select ok(((select value from airtable_test_values where key='refresh')->>'refresh')::boolean,'expired access token grants one refresh lease');
select is(public.claim_airtable_refresh('47000000-0000-4000-c000-000000000001'),null::jsonb,'second worker cannot refresh the same rotating token');
select is(public.settle_airtable_refresh('47000000-0000-4000-c000-000000000001','47000000-0000-4000-e000-000000000001',1,'synthetic next',now()+interval '1 hour',true),false,'wrong refresh lease cannot store tokens');
select is(public.settle_airtable_refresh('47000000-0000-4000-c000-000000000001',((select value from airtable_test_values where key='refresh')->>'leaseToken')::uuid,1,'',now(),false),true,'unknown refresh result requires reconnection');
select is((select needs_reconnect from public.airtable_connections where id='47000000-0000-4000-c000-000000000001'),true,'connection pauses after uncertain refresh');
select is(public.claim_airtable_refresh('47000000-0000-4000-c000-000000000001'),null::jsonb,'old refresh token is never automatically reused');
select is(public.store_airtable_tokens('10000000-0000-4000-a000-000000000001','synthetic renewed pair',now()+interval '1 hour'),'47000000-0000-4000-c000-000000000001'::uuid,'approved reconnect renews the same connection');
select is((select config_revision from public.airtable_connections where id='47000000-0000-4000-c000-000000000001'),2::bigint,'renewed credentials preserve the reviewed destination revision');
select is((select count(*)::int from public.airtable_delivery_requests where claim_id='47000000-0000-4000-a000-000000000001' and status='uncertain'),1,'reconnect cannot remove an uncertain delivery barrier');
reset role;
update public.partner_companies set status='inactive' where id='10000000-0000-4000-a000-000000000001';
set local request.jwt.claims='{"sub":"00000000-0000-4000-a000-000000000001","role":"authenticated","aal":"aal2"}';
set local role authenticated;
select throws_ok($$select public.configure_airtable_company('10000000-0000-4000-a000-000000000001',2,'{}')$$,
 '42501'::char(5),null::text,'company deactivation prevents an Owner from changing its connection');
reset role;
select * from finish();
rollback;
