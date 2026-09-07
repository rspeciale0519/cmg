begin;
set local client_min_messages=warning;
create extension if not exists pgtap with schema extensions;
select plan(40);

select function_privs_are('public','submit_claim_transaction',
  array['jsonb','jsonb','jsonb','jsonb','jsonb','uuid','jsonb']::name[],'anon',array[]::text[],
  'anonymous cannot submit a service claim transaction');
select function_privs_are('public','submit_contact_transaction',
  array['jsonb','jsonb','jsonb']::name[],'authenticated',array[]::text[],
  'authenticated cannot submit a service contact transaction');
select function_privs_are('public','issue_invite_transaction',
  array['text','app_role','uuid','uuid','uuid','text','timestamptz','jsonb','inet']::name[],
  'authenticated',array[]::text[],'authenticated cannot issue an invite transaction');
select function_privs_are('public','begin_invite_acceptance',array['text','uuid']::name[],
  'anon',array[]::text[],'anonymous cannot reserve invitation acceptance');
select function_privs_are('public','finalize_invite_acceptance',
  array['uuid','uuid','uuid','text','text','inet']::name[],'authenticated',array[]::text[],
  'authenticated cannot finalize invitation acceptance');

select ok(not has_column_privilege('authenticated','public.claims','esign_dispatch_token','select'),
  'authenticated cannot select dispatch bearer tokens');
select ok(not has_column_privilege('authenticated','public.claims','esign_active_attempt_token','select'),
  'authenticated cannot select active attempt bearer tokens');
select ok(has_column_privilege('service_role','public.claims','esign_dispatch_token','select'),
  'service role can reconcile dispatch bearer tokens');

set local role service_role;
insert into public.claims(id,claim_ref,status,property_street,property_city,property_zip,
  carrier,policy_number,carrier_tenure,loss_date,cause,description)
values('26000000-0000-4000-a000-000000000001','CMG-2026-2601','under_review',
  '26 Architecture Way','Orlando','32801','Carrier','POL-26','lt_1_year',current_date-2,'wind','architecture');
insert into public.claim_events(claim_id,type,body,visibility,external_event_key)
values('26000000-0000-4000-a000-000000000001','note','server key','internal','server:26');
select is((select external_event_key from public.claim_events where external_event_key='server:26'),
  'server:26','service role may set dedupe keys');

set local request.jwt.claims='{"sub":"00000000-0000-4000-a000-000000000001","role":"authenticated","aal":"aal2"}';
set local role authenticated;
select throws_ok($$insert into public.claim_events(claim_id,type,body,visibility,external_event_key)
 values('26000000-0000-4000-a000-000000000001','note','poison','internal','poison:26')$$,
 '42501','external event keys are server-managed','ordinary staff cannot poison event dedupe keys');
select throws_ok($$insert into public.documents(claim_id,storage_path,original_name,kind,mime,
 size_bytes,visibility,external_event_key) values('26000000-0000-4000-a000-000000000001',
 'claims/26000000-0000-4000-a000-000000000001/poison.pdf','poison.pdf','other',
 'application/pdf',1,'internal','poison:doc')$$,'42501','external event keys are server-managed',
 'assigned staff cannot poison document dedupe keys');
select throws_ok($$update public.documents set external_event_key='poison:changed'
 where claim_id='20000000-0000-4000-a000-000000000001'$$,
 '42501','external event keys are server-managed',
 'ordinary staff cannot change server document dedupe keys');
reset role;

set local role service_role;
select is(public.enqueue_storage_cleanup_exact('claim-docs',array['claims/intent/26.pdf'],null),1,
  'server reserves exact upload cleanup intent');
select is((select count(*)::int from public.claim_storage_cleanup_batch(10,300,5)
  where object_path='claims/intent/26.pdf'),0,'grace keeps pre-upload intent from immediate claim');
update public.storage_cleanup_queue set next_attempt_at=now()-interval '1 second'
 where object_path='claims/intent/26.pdf';
select is((select count(*)::int from public.claim_storage_cleanup_batch(10,300,5)
  where object_path='claims/intent/26.pdf'),1,'due crashed upload becomes exact cleanup work');
select throws_ok($$insert into public.documents(claim_id,storage_path,original_name,kind,mime,
 size_bytes,visibility) values('26000000-0000-4000-a000-000000000001','claims/intent/26.pdf',
 'claimed.pdf','other','application/pdf',1,'internal')$$,'55000','storage cleanup already claimed',
 'a claimed cleanup path cannot become a live document');
update public.storage_cleanup_queue set processed_at=now()
 where object_path='claims/intent/26.pdf' and attempts=1;
select throws_ok($$insert into public.documents(claim_id,storage_path,original_name,kind,mime,
 size_bytes,visibility) values('26000000-0000-4000-a000-000000000001','claims/intent/26.pdf',
 'late.pdf','other','application/pdf',1,'internal')$$,'55000','storage cleanup already claimed',
 'a completed worker attempt permanently fences a late document insert');

select is(public.enqueue_storage_cleanup_exact('claim-docs',array['claims/26000000-0000-4000-a000-000000000001/committed.pdf'],
 '26000000-0000-4000-a000-000000000001'),1,'server reserves a second exact intent');
insert into public.documents(claim_id,storage_path,original_name,kind,mime,size_bytes,visibility)
values('26000000-0000-4000-a000-000000000001','claims/26000000-0000-4000-a000-000000000001/committed.pdf','committed.pdf',
 'other','application/pdf',1,'internal');
select ok((select processed_at is not null from public.storage_cleanup_queue
 where object_path='claims/26000000-0000-4000-a000-000000000001/committed.pdf'),'document commit cancels its cleanup intent');
update public.storage_cleanup_queue set next_attempt_at=now()-interval '1 second'
 where object_path='claims/26000000-0000-4000-a000-000000000001/committed.pdf';
select is((select count(*)::int from public.claim_storage_cleanup_batch(10,300,5)
 where object_path='claims/26000000-0000-4000-a000-000000000001/committed.pdf'),0,'live document is never claimed for cleanup');

insert into public.invites(id,email,role,token_hash,expires_at,invited_by)
values('26000000-0000-4000-a000-000000000010','reserved@example.test','adjuster','reserved-hash',
 now()+interval '1 day','00000000-0000-4000-a000-000000000001');
select is((public.begin_invite_acceptance('reserved-hash','26000000-0000-4000-a000-000000000011')->>'attempt_id'),
 '26000000-0000-4000-a000-000000000011','acceptance reserves the sole live token');
select throws_ok($$select public.issue_invite_transaction('bad-shape@example.test','customer',
 '20000000-0000-4000-a000-000000000001','10000000-0000-4000-a000-000000000001',
 '00000000-0000-4000-a000-000000000001','bad-shape-hash',now()+interval '1 day','{}',null)$$,
 '22023','invalid invite target','customer invite rejects mixed claim/company target');

select ok((public.issue_invite_transaction('atomic@example.test','adjuster',null,null,
 '00000000-0000-4000-a000-000000000001','atomic-hash',now()+interval '1 day',
 '{"firstName":"Atomic","inviteUrl":"https://example.test/i","audience":"staff","expiresInHours":72}',null)
 ->>'invite_id') is not null,'invite transaction commits successfully');
select is((select count(*)::int from public.invites where email='atomic@example.test'),1,
 'atomic issuance creates one invite');
select is((select count(*)::int from public.notifications_outbox where recipient_email='atomic@example.test'),1,
 'atomic issuance creates required outbox row');
select is((select count(*)::int from public.audit_log where action='invite.issued'
 and meta->>'email'='atomic@example.test'),1,'atomic issuance creates required audit row');

select throws_ok($$select public.issue_invite_transaction('reserved@example.test','adjuster',null,null,
 '00000000-0000-4000-a000-000000000001','reserved-reissue-hash',now()+interval '1 day',
 '{"firstName":"Reserved","inviteUrl":"https://example.test/reserved","audience":"staff","expiresInHours":72}',null)$$,
 '55000','invite acceptance is in progress','reissue refuses a live reserved invite');
select is((select count(*)::int from public.invites where email='reserved@example.test'),1,
 'reserved reissue creates no second invite');
select is((select count(*)::int from public.invites where email='reserved@example.test'
 and accepted_at is null and expires_at>now()),1,'the reserved invite remains the sole live token');
select is((select count(*)::int from public.notifications_outbox where recipient_email='reserved@example.test'),0,
 'reserved reissue creates no outbox row');
select is((select count(*)::int from public.audit_log where action='invite.issued'
 and meta->>'email'='reserved@example.test'),0,'reserved reissue creates no audit row');
update public.invites set expires_at=now()-interval '1 second'
 where id='26000000-0000-4000-a000-000000000010';
select ok((public.issue_invite_transaction('reserved@example.test','adjuster',null,null,
 '00000000-0000-4000-a000-000000000001','reserved-replacement-hash',now()+interval '1 day',
 '{"firstName":"Replacement","inviteUrl":"https://example.test/replacement","audience":"staff","expiresInHours":72}',null)
 ->>'invite_id') is not null,'an expired reservation permits one replacement');
select is((select count(*)::int from public.invites where email='reserved@example.test'
 and accepted_at is null and expires_at>now()),1,'replacement is the only live token');
select throws_ok($$select public.finalize_invite_acceptance(
 '26000000-0000-4000-a000-000000000010','26000000-0000-4000-a000-000000000011',
 '00000000-0000-4000-a000-000000000002','Late','User',null)$$,
 '55000','invitation expired','an expired reserved invite cannot finalize');
select is((select accepted_at from public.invites where id='26000000-0000-4000-a000-000000000010'),
 null::timestamptz,'refused late finalization leaves the expired invite unaccepted');
select is(public.begin_invite_acceptance('reserved-hash','26000000-0000-4000-a000-000000000012'),
 null::jsonb,'issuance-first expiration prevents the old token from reserving afterward');

select ok(not has_function_privilege('authenticated',
 'public.complete_pandadoc_webhook_event(uuid,uuid,jsonb)','execute'),
 'authenticated cannot complete PandaDoc ledger events');
select ok(has_function_privilege('service_role',
 'public.complete_pandadoc_webhook_event(uuid,uuid,jsonb)','execute'),
 'service role owns PandaDoc completion');
select ok(not has_table_privilege('authenticated','public.esign_dispatch_attempts','select'),
 'authenticated cannot read dispatch ledger');
select ok(not has_table_privilege('authenticated','public.esign_recipient_completions','select'),
 'authenticated cannot read recipient completion ledger');

select * from finish();
rollback;
