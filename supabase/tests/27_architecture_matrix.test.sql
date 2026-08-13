begin;
set local client_min_messages=warning;
create extension if not exists pgtap with schema extensions;
select plan(12);

select is((select count(*)::int from pg_proc p join pg_namespace n on n.oid=p.pronamespace
 where n.nspname='public' and p.proname in ('claim_esign_dispatch','mark_esign_dispatch_sending',
 'reconcile_esign_dispatch','record_esign_recipient_completion','esign_attempt_is_active',
 'finalize_esign_pdf','settle_esign_dispatch','claim_pandadoc_webhook_event',
 'complete_pandadoc_webhook_event','release_pandadoc_webhook_event')),10,
 'all ten e-sign ledger RPCs are present');
select ok(not exists(select 1 from pg_proc p join pg_namespace n on n.oid=p.pronamespace
 where n.nspname='public' and p.proname in ('claim_esign_dispatch','mark_esign_dispatch_sending',
 'reconcile_esign_dispatch','record_esign_recipient_completion','esign_attempt_is_active',
 'finalize_esign_pdf','settle_esign_dispatch','claim_pandadoc_webhook_event',
 'complete_pandadoc_webhook_event','release_pandadoc_webhook_event')
 and has_function_privilege('anon',p.oid,'execute')),'anon has zero e-sign RPC grants');
select ok(not exists(select 1 from pg_proc p join pg_namespace n on n.oid=p.pronamespace
 where n.nspname='public' and p.proname in ('claim_esign_dispatch','mark_esign_dispatch_sending',
 'reconcile_esign_dispatch','record_esign_recipient_completion','esign_attempt_is_active',
 'finalize_esign_pdf','settle_esign_dispatch','claim_pandadoc_webhook_event',
 'complete_pandadoc_webhook_event','release_pandadoc_webhook_event')
 and has_function_privilege('authenticated',p.oid,'execute')),'authenticated has zero e-sign RPC grants');
select ok(not exists(select 1 from pg_proc p join pg_namespace n on n.oid=p.pronamespace
 where n.nspname='public' and p.proname in ('claim_esign_dispatch','mark_esign_dispatch_sending',
 'reconcile_esign_dispatch','record_esign_recipient_completion','esign_attempt_is_active',
 'finalize_esign_pdf','settle_esign_dispatch','claim_pandadoc_webhook_event',
 'complete_pandadoc_webhook_event','release_pandadoc_webhook_event')
 and not has_function_privilege('service_role',p.oid,'execute')),'service role owns every e-sign RPC');
select ok(not has_table_privilege('authenticated','public.esign_dispatch_attempts','select')
 and not has_table_privilege('authenticated','public.esign_recipient_completions','select'),
 'authenticated cannot read either e-sign ledger table');
select ok(not has_function_privilege('anon','private.invite_account_marker(uuid,text,uuid,uuid)','execute')
 and not has_function_privilege('authenticated','private.invite_account_marker(uuid,text,uuid,uuid)','execute'),
 'client roles cannot call the auth marker projection');
select ok(has_function_privilege('service_role','private.invite_account_marker(uuid,text,uuid,uuid)','execute'),
 'service role alone can call the auth marker projection');

insert into auth.users(instance_id,id,aud,role,email,encrypted_password,email_confirmed_at,
 raw_app_meta_data,raw_user_meta_data,created_at,updated_at,confirmation_token,recovery_token,
 email_change_token_new,email_change) values('00000000-0000-0000-0000-000000000000',
 '27000000-0000-4000-a000-000000000001','authenticated','authenticated','inactive27@example.test',
 extensions.crypt('CmgDev!2026',extensions.gen_salt('bf')),now(),'{"provider":"email","providers":["email"]}',
 '{}',now(),now(),'','','','');
set local role service_role;
update public.profiles set role='assistant',is_active=false where id='27000000-0000-4000-a000-000000000001';
reset role;
set local request.jwt.claims='{"sub":"27000000-0000-4000-a000-000000000001","role":"authenticated","aal":"aal2"}';
set local role authenticated;
select is(private.current_app_role(),null::public.app_role,'deactivated staff has no current app role');
select is((select count(*)::int from public.claims),0,'deactivated staff sees zero claims');
select is((select count(*)::int from public.invites),0,'deactivated staff sees zero invites');
select is((select count(*)::int from public.audit_log),0,'deactivated staff sees zero audit rows');
select is_empty($$select * from public.partner_company_profile()$$,
 'deactivated staff gets an empty partner profile projection');
select * from finish();
rollback;
