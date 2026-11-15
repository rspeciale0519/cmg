begin;
set local client_min_messages=warning;
create extension if not exists pgtap with schema extensions;
select no_plan();

-- Transactional synthetic rows only. No provider, storage, or email operation.
insert into public.partner_companies(id,name,status)
values('48000000-0000-4000-c000-000000000001','Synthetic record proof company','active');
insert into public.claims(id,status,property_street,property_city,property_zip,loss_date,cause,description,partner_company_id)
values('48000000-0000-4000-a000-000000000001','under_review','Synthetic record proof','Orlando','32801',current_date,'wind','Synthetic record confirmation','48000000-0000-4000-c000-000000000001');
insert into public.airtable_connections(id,company_id,base_id,table_id,mappings,default_fields,default_mode,enabled,config_revision,needs_reconnect)
values('48000000-0000-4000-d000-000000000001','48000000-0000-4000-c000-000000000001','app00000000000048','tbl00000000000048',
 '[{"source":"claim_ref","fieldId":"fld00000000000001","fieldType":"singleLineText"},{"source":"status","fieldId":"fld00000000000002","fieldType":"singleLineText"}]',
 array['claim_ref','status'],'manual',true,2,false);

set local request.jwt.claims='{"sub":"00000000-0000-4000-a000-000000000001","role":"authenticated","aal":"aal2"}';
set local role authenticated;
select throws_ok(format('select public.configure_airtable_claim(%L,0,%L,%L::jsonb,true)',
 '48000000-0000-4000-a000-000000000001','rec00000000000048',proof),
 '40001'::char(5),null::text,label)
from (values
 ('{}','missing proof identity cannot confirm a record'),
 ('{"expectedConnectionId":"48000000-0000-4000-d000-000000000001"}','missing proof version cannot confirm a record'),
 ('{"expectedConnectionId":"48000000-0000-4000-d000-000000000001","expectedConfigRevision":null}','null proof version cannot confirm a record'),
 ('{"expectedConnectionId":"48000000-0000-4000-d000-000000000001","expectedConfigRevision":"2"}','text proof version cannot bypass numeric validation'),
 ('{"expectedConnectionId":"48000000-0000-4000-d000-000000000099","expectedConfigRevision":2}','different connection cannot confirm this record'),
 ('{"expectedConnectionId":"48000000-0000-4000-d000-000000000001","expectedConfigRevision":1}','stale configuration cannot confirm this record')
) cases(proof,label);
select is((select count(*)::int from public.airtable_claim_links where claim_id='48000000-0000-4000-a000-000000000001'),0,'rejected proofs create no link');
select is((select count(*)::int from public.airtable_delivery_requests where claim_id='48000000-0000-4000-a000-000000000001'),0,'rejected proofs create no delivery request');

select lives_ok($$select public.configure_airtable_claim('48000000-0000-4000-a000-000000000001',0,'rec00000000000048',
 '{"expectedConnectionId":"48000000-0000-4000-d000-000000000001","expectedConfigRevision":2}',true)$$,'matching connection and version confirm the record');
select is((select config_revision from public.airtable_claim_links where claim_id='48000000-0000-4000-a000-000000000001'),2::bigint,'link retains the inspected configuration version');

-- Change defaults with the same column IDs, as can happen during the provider read.
select lives_ok($$select public.configure_airtable_company('48000000-0000-4000-c000-000000000001',2,
 '{"baseId":"app00000000000048","tableId":"tbl00000000000048","mode":"automatic","enabled":true,"fields":["claim_ref","status"],
 "mappings":[{"source":"claim_ref","fieldId":"fld00000000000001","fieldType":"singleLineText"},{"source":"status","fieldId":"fld00000000000002","fieldType":"singleLineText"}]}')$$,
 'company defaults can change without changing mapped column IDs');
select is((select revision from public.airtable_claim_links where claim_id='48000000-0000-4000-a000-000000000001'),1::bigint,'company configuration does not change the separate link revision');
select throws_ok($$select public.configure_airtable_claim('48000000-0000-4000-a000-000000000001',1,'rec00000000000048',
 '{"expectedConnectionId":"48000000-0000-4000-d000-000000000001","expectedConfigRevision":2}',true)$$,
 '40001'::char(5),null::text,'old record proof cannot re-enable a link after company configuration changes');
select is((select enabled from public.airtable_claim_links where claim_id='48000000-0000-4000-a000-000000000001'),false,'stale proof leaves the link disabled');
select is((select count(*)::int from public.airtable_delivery_requests where claim_id='48000000-0000-4000-a000-000000000001' and status='pending'),0,'stale proof does not queue automatic delivery');
select is((select count(*)::int from public.audit_log where entity_id='48000000-0000-4000-a000-000000000001' and action='airtable.link'),1,'stale proof creates no successful link audit');

select lives_ok($$select public.configure_airtable_claim('48000000-0000-4000-a000-000000000001',1,'rec00000000000048',
 '{"expectedConnectionId":"48000000-0000-4000-d000-000000000001","expectedConfigRevision":3}',true)$$,'a new record check for the current configuration succeeds');
select is((select config_revision from public.airtable_claim_links where claim_id='48000000-0000-4000-a000-000000000001'),3::bigint,'confirmed link uses the new reviewed configuration');
select is((select review_required from public.airtable_claim_links where claim_id='48000000-0000-4000-a000-000000000001'),true,'new confirmation keeps the first-update review barrier');
select is((select count(*)::int from public.airtable_delivery_requests where claim_id='48000000-0000-4000-a000-000000000001' and status='held'),1,'current confirmation prepares one held update');
reset role;
update public.partner_companies set status='inactive' where id='48000000-0000-4000-c000-000000000001';
set local role authenticated;
select throws_ok($$select public.configure_airtable_claim('48000000-0000-4000-a000-000000000001',2,'rec00000000000048',
 '{"expectedConnectionId":"48000000-0000-4000-d000-000000000001","expectedConfigRevision":3}',true)$$,
 '42501'::char(5),null::text,'a current proof does not permit linking for an inactive company');
reset role;
select * from finish();
rollback;
