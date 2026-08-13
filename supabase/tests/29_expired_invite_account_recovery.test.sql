begin;
set local client_min_messages = warning;
create extension if not exists pgtap with schema extensions;
select plan(22);

select function_privs_are(
  'private',
  'invite_account_marker',
  array['uuid', 'text']::name[],
  'service_role',
  array['EXECUTE']::text[],
  'raw auth marker projection is service-only'
);

insert into public.invites(
  id, email, role, partner_company_id, token_hash, expires_at, invited_by
) values (
  '29000000-0000-4000-a000-000000000001',
  'expired-partner29@example.test',
  'partner',
  '10000000-0000-4000-a000-000000000001',
  'expired-partner29',
  now() + interval '1 day',
  '00000000-0000-4000-a000-000000000001'
);
set local role service_role;
select is(
  public.begin_invite_acceptance(
    'expired-partner29', '29000000-0000-4000-a000-000000000011'
  ) ->> 'attempt_id',
  '29000000-0000-4000-a000-000000000011',
  'old partner invite reserves its exact attempt'
);
reset role;

insert into auth.users(
  instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
  raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
  confirmation_token, recovery_token, email_change_token_new, email_change
) values (
  '00000000-0000-0000-0000-000000000000',
  '29000000-0000-4000-a000-000000000021',
  'authenticated', 'authenticated', 'expired-partner29@example.test',
  extensions.crypt('CmgDev!2026', extensions.gen_salt('bf')), now(),
  '{"provider":"email","providers":["email"],"cmg_invite_id":"29000000-0000-4000-a000-000000000001","cmg_attempt_id":"29000000-0000-4000-a000-000000000011"}',
  '{}', now(), now(), '', '', '', ''
);
update public.invites
set expires_at = now() - interval '1 minute'
where id = '29000000-0000-4000-a000-000000000001';

set local role service_role;
select throws_ok(
  $$select public.finalize_invite_acceptance(
    '29000000-0000-4000-a000-000000000001',
    '29000000-0000-4000-a000-000000000011',
    '29000000-0000-4000-a000-000000000021',
    'Expired', 'Partner', null
  )$$,
  '55000',
  'invitation expired',
  'the expired link cannot finalize its old reservation'
);
select lives_ok(
  $$select public.issue_invite_transaction(
    'EXPIRED-PARTNER29@example.test', 'partner', null,
    '10000000-0000-4000-a000-000000000001',
    '00000000-0000-4000-a000-000000000001',
    'replacement-partner29', now() + interval '1 day', '{}', null
  )$$,
  'a replacement invite can be issued for the same normalized subject'
);
select is(
  public.begin_invite_acceptance(
    'replacement-partner29', '29000000-0000-4000-a000-000000000012'
  ) ->> 'attempt_id',
  '29000000-0000-4000-a000-000000000012',
  'replacement partner invite reserves a fresh attempt'
);
select is(
  public.finalize_invite_acceptance(
    (select id from public.invites where token_hash = 'replacement-partner29'),
    '29000000-0000-4000-a000-000000000012',
    '29000000-0000-4000-a000-000000000021',
    'Recovered', 'Partner', null
  ) ->> 'account_origin',
  'invite_created',
  'replacement recognizes the exact prior expired account marker'
);
select is(
  (select role::text from public.profiles
   where id = '29000000-0000-4000-a000-000000000021'),
  'partner',
  'recovered account receives the invited partner role'
);
select is(
  (select partner_company_id::text from public.profiles
   where id = '29000000-0000-4000-a000-000000000021'),
  '10000000-0000-4000-a000-000000000001',
  'recovered account receives the exact invited partner company'
);
select is(
  (select accepted_at from public.invites
   where id = '29000000-0000-4000-a000-000000000001'),
  null::timestamptz,
  'old expired invite remains unaccepted'
);
select ok(
  (select accepted_at is not null from public.invites
   where token_hash = 'replacement-partner29'),
  'only the replacement invite is accepted'
);
select is(
  (select count(*)::int from public.audit_log
   where action = 'invite.accepted'
     and actor_id = '29000000-0000-4000-a000-000000000021'),
  1,
  'replacement recovery writes exactly one accepted audit'
);
reset role;

insert into public.invites(
  id, email, role, token_hash, expires_at, invited_by
) values (
  '29000000-0000-4000-a000-000000000002',
  'expired-staff29@example.test',
  'adjuster',
  'expired-staff29',
  now() + interval '1 day',
  '00000000-0000-4000-a000-000000000001'
);
set local role service_role;
select is(
  public.begin_invite_acceptance(
    'expired-staff29', '29000000-0000-4000-a000-000000000031'
  ) ->> 'attempt_id',
  '29000000-0000-4000-a000-000000000031',
  'old staff invite reserves its exact attempt'
);
reset role;
insert into auth.users(
  instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
  raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
  confirmation_token, recovery_token, email_change_token_new, email_change
) values (
  '00000000-0000-0000-0000-000000000000',
  '29000000-0000-4000-a000-000000000041',
  'authenticated', 'authenticated', 'expired-staff29@example.test',
  extensions.crypt('CmgDev!2026', extensions.gen_salt('bf')), now(),
  '{"provider":"email","providers":["email"],"cmg_invite_id":"29000000-0000-4000-a000-000000000002","cmg_attempt_id":"29000000-0000-4000-a000-000000000031"}',
  '{}', now(), now(), '', '', '', ''
);
update public.invites set expires_at = now() - interval '1 minute'
where id = '29000000-0000-4000-a000-000000000002';
set local role service_role;
select lives_ok(
  $$select public.issue_invite_transaction(
    'expired-staff29@example.test', 'adjuster', null, null,
    '00000000-0000-4000-a000-000000000001',
    'replacement-staff29', now() + interval '1 day', '{}', null
  )$$,
  'replacement staff invite can be issued'
);
select is(
  public.begin_invite_acceptance(
    'replacement-staff29', '29000000-0000-4000-a000-000000000032'
  ) ->> 'attempt_id',
  '29000000-0000-4000-a000-000000000032',
  'replacement staff invite reserves a fresh attempt'
);
select is(
  public.finalize_invite_acceptance(
    (select id from public.invites where token_hash = 'replacement-staff29'),
    '29000000-0000-4000-a000-000000000032',
    '29000000-0000-4000-a000-000000000041',
    'Recovered', 'Adjuster', null
  ) ->> 'effective_role',
  'adjuster',
  'prior expired marker recovers a staff account with no company target'
);
select is(
  (select partner_company_id from public.profiles
   where id = '29000000-0000-4000-a000-000000000041'),
  null::uuid,
  'staff recovery preserves the exact null company target'
);
select is(
  (select count(*)::int from public.audit_log
   where action = 'invite.accepted'
     and actor_id = '29000000-0000-4000-a000-000000000041'),
  1,
  'staff recovery writes exactly one accepted audit'
);
reset role;

insert into public.invites(
  id, email, role, partner_company_id, token_hash, expires_at, invited_by,
  acceptance_attempt_id
) values (
  '29000000-0000-4000-a000-000000000003',
  'mismatch29@example.test', 'partner',
  '10000000-0000-4000-a000-000000000001',
  'mismatch-old29', now() - interval '1 minute',
  '00000000-0000-4000-a000-000000000001',
  '29000000-0000-4000-a000-000000000051'
), (
  '29000000-0000-4000-a000-000000000004',
  'mismatch29@example.test', 'adjuster', null,
  'mismatch-new29', now() + interval '1 day',
  '00000000-0000-4000-a000-000000000001',
  '29000000-0000-4000-a000-000000000052'
);
insert into auth.users(
  instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
  raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
  confirmation_token, recovery_token, email_change_token_new, email_change
) values (
  '00000000-0000-0000-0000-000000000000',
  '29000000-0000-4000-a000-000000000061',
  'authenticated', 'authenticated', 'mismatch29@example.test',
  extensions.crypt('CmgDev!2026', extensions.gen_salt('bf')), now(),
  '{"provider":"email","providers":["email"],"cmg_invite_id":"29000000-0000-4000-a000-000000000003","cmg_attempt_id":"29000000-0000-4000-a000-000000000051"}',
  '{}', now(), now(), '', '', '', ''
);
set local role service_role;
select is(
  public.finalize_invite_acceptance(
    '29000000-0000-4000-a000-000000000004',
    '29000000-0000-4000-a000-000000000052',
    '29000000-0000-4000-a000-000000000061',
    'Wrong', 'Target', null
  ) ->> 'state',
  'blocked_existing',
  'marker for a different role and company cannot recover the account'
);
select is(
  (select role::text from public.profiles
   where id = '29000000-0000-4000-a000-000000000061'),
  'customer',
  'mismatched marker leaves the profile role unchanged'
);
select is(
  (select partner_company_id from public.profiles
   where id = '29000000-0000-4000-a000-000000000061'),
  null::uuid,
  'mismatched marker leaves the profile company unchanged'
);
select is(
  (select accepted_at from public.invites
   where id = '29000000-0000-4000-a000-000000000004'),
  null::timestamptz,
  'mismatched marker leaves the new invite unaccepted'
);
select is(
  (select count(*)::int from public.audit_log
   where action = 'invite.accepted'
     and actor_id = '29000000-0000-4000-a000-000000000061'),
  0,
  'mismatched marker writes no accepted audit'
);

select * from finish();
rollback;
