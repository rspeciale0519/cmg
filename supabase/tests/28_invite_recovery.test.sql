begin;
set local client_min_messages=warning;
create extension if not exists pgtap with schema extensions;
select plan(13);

insert into public.invites(id,email,role,token_hash,expires_at,invited_by)
values('28000000-0000-4000-a000-000000000001','fault28@example.test','adjuster','old28',
 now()+interval '1 day','00000000-0000-4000-a000-000000000001');
create function pg_temp.reject_invite_audit() returns trigger language plpgsql as $$begin
 if new.action='invite.issued' then raise exception 'fault audit'; end if; return new; end$$;
create trigger invite_audit_fault before insert on public.audit_log
for each row execute function pg_temp.reject_invite_audit();
set local role service_role;
select throws_ok($$select public.issue_invite_transaction('fault28@example.test','adjuster',null,null,
 '00000000-0000-4000-a000-000000000001','new28',now()+interval '1 day','{}',null)$$,
 'P0001','fault audit','required audit failure aborts issuance');
reset role;
drop trigger invite_audit_fault on public.audit_log;
set local role service_role;
select is((select count(*)::int from public.invites where email='fault28@example.test'),1,
 'failed issuance creates no second invite');
select is((select token_hash from public.invites where email='fault28@example.test'),'old28',
 'failed issuance preserves prior live invitation');
select is((select count(*)::int from public.notifications_outbox where recipient_email='fault28@example.test'),0,
 'failed issuance leaves no correspondence');

insert into public.invites(id,email,role,partner_company_id,token_hash,expires_at,invited_by)
values('28000000-0000-4000-a000-000000000002','recover28@example.test','partner',
 '10000000-0000-4000-a000-000000000001','recover28',
 now()+interval '1 day','00000000-0000-4000-a000-000000000001');
select is((public.begin_invite_acceptance('recover28','28000000-0000-4000-a000-000000000010')->>'attempt_id'),
 '28000000-0000-4000-a000-000000000010','first acceptance reserves its attempt');
select is((public.begin_invite_acceptance('recover28','28000000-0000-4000-a000-000000000011')->>'attempt_id'),
 '28000000-0000-4000-a000-000000000010','retry reuses the exact reserved attempt');
reset role;
insert into auth.users(instance_id,id,aud,role,email,encrypted_password,email_confirmed_at,
 raw_app_meta_data,raw_user_meta_data,created_at,updated_at,confirmation_token,recovery_token,
 email_change_token_new,email_change) values('00000000-0000-0000-0000-000000000000',
 '28000000-0000-4000-a000-000000000020','authenticated','authenticated','recover28@example.test',
 extensions.crypt('CmgDev!2026',extensions.gen_salt('bf')),now(),
 '{"provider":"email","providers":["email"],"cmg_invite_id":"28000000-0000-4000-a000-000000000002","cmg_attempt_id":"28000000-0000-4000-a000-000000000010"}',
 '{}',now(),now(),'','','','');
set local role service_role;
select is((public.finalize_invite_acceptance('28000000-0000-4000-a000-000000000002',
 '28000000-0000-4000-a000-000000000010','28000000-0000-4000-a000-000000000020',
 'Recovered','Partner',null)->>'account_origin'),'invite_created',
 'exact auth marker recovers the newly-created account');
select is((select role::text from public.profiles where id='28000000-0000-4000-a000-000000000020'),
 'partner','recovery applies the invited role');
select is((select partner_company_id::text from public.profiles where id='28000000-0000-4000-a000-000000000020'),
 '10000000-0000-4000-a000-000000000001','recovery applies the exact invited partner company');
select ok((select accepted_at is not null from public.invites where id='28000000-0000-4000-a000-000000000002'),
 'recovery atomically accepts the invite');
select is((select count(*)::int from public.audit_log where action='invite.accepted'
 and entity_id='28000000-0000-4000-a000-000000000002'),1,'recovery atomically writes required audit');

insert into public.invites(id,email,role,claim_id,token_hash,expires_at,invited_by,acceptance_attempt_id)
values('28000000-0000-4000-a000-000000000003','missing28@example.test','customer',
 '20000000-0000-4000-a000-000000000001','missing28',now()+interval '1 day',
 '00000000-0000-4000-a000-000000000001','28000000-0000-4000-a000-000000000030');
reset role;
insert into auth.users(instance_id,id,aud,role,email,encrypted_password,email_confirmed_at,
 raw_app_meta_data,raw_user_meta_data,created_at,updated_at,confirmation_token,recovery_token,
 email_change_token_new,email_change) values('00000000-0000-0000-0000-000000000000',
 '28000000-0000-4000-a000-000000000031','authenticated','authenticated','missing28@example.test',
 extensions.crypt('CmgDev!2026',extensions.gen_salt('bf')),now(),
 '{"provider":"email","providers":["email"],"cmg_invite_id":"28000000-0000-4000-a000-000000000003","cmg_attempt_id":"28000000-0000-4000-a000-000000000030"}',
 '{}',now(),now(),'','','','');
set local role service_role;
select throws_ok($$select public.finalize_invite_acceptance('28000000-0000-4000-a000-000000000003',
 '28000000-0000-4000-a000-000000000030','28000000-0000-4000-a000-000000000031',
 'Missing','Claimant',null)$$,'P0002','claimant link missing or ambiguous',
 'zero-row claimant link aborts finalization');
select is((select accepted_at from public.invites where id='28000000-0000-4000-a000-000000000003'),
 null::timestamptz,'failed claimant finalization leaves invite honest and retryable');
select * from finish();
rollback;
