-- ---------------------------------------------------------------------------
-- The adjuster and the assistant, same gate
-- ---------------------------------------------------------------------------

select set_config(
  'request.jwt.claims',
  '{"sub":"00000000-0000-4000-a000-000000000002","role":"authenticated","aal":"aal1"}',
  true
);
set local role authenticated;

select is(private.current_app_role(), null::public.app_role, 'an aal1 adjuster resolves to NULL as well');
select is(
  (select count(*)::int from public.claims), 0,
  'and reads none of the claims assigned to them'
);
select is(
  (select count(*)::int from public.profiles where id <> '00000000-0000-4000-a000-000000000002'), 0,
  'and none of the directory'
);
select throws_ok(
  $$ select * from public.admin_user_directory() $$,
  '42501'::char(5), null::text,
  'and is refused the directory RPC — which would have refused them at aal2 too, but for the other reason'
);

select set_config('request.jwt.claims', '', true);
reset role;
select set_config(
  'request.jwt.claims',
  '{"sub":"00000000-0000-4000-a000-000000000003","role":"authenticated","aal":"aal1"}',
  true
);
set local role authenticated;

select is(private.current_app_role(), null::public.app_role, 'an aal1 assistant resolves to NULL as well');
select is(
  (select count(*)::int from public.claims), 0,
  'and the assistant''s caseload-wide read — the broadest of the three — is closed with it'
);
select is(
  (select count(*)::int from public.leads), 0,
  'as is the intake queue the assistant owns'
);

select set_config('request.jwt.claims', '', true);
reset role;

-- ---------------------------------------------------------------------------
-- The same accounts at aal2 — the gate must be a gate, not a wall
-- ---------------------------------------------------------------------------

select set_config(
  'request.jwt.claims',
  '{"sub":"00000000-0000-4000-a000-000000000001","role":"authenticated","aal":"aal2"}',
  true
);
set local role authenticated;

select is(private.current_app_role(), 'owner'::public.app_role, 'the same owner at aal2 is an owner again');
select is(private.is_owner(), true, 'and is_owner() is true');

select cmp_ok(
  (select count(*)::int from public.claims), '>', 0,
  'and reads claims'
);
select cmp_ok(
  (select count(*)::int from public.claim_financials), '>', 0,
  'and the money'
);
select cmp_ok(
  (select count(*)::int from public.consents), '>', 0,
  'and the consent evidence'
);
select cmp_ok(
  (select count(*)::int from public.profiles), '>', 1,
  'and the staff directory'
);
select cmp_ok(
  (select count(*)::int from public.admin_user_directory()), '>', 0,
  'and the account directory RPC answers'
);

select lives_ok(
  $$ select public.change_staff_privileges(
       '00000000-0000-4000-a000-000000000002'::uuid, 'assistant'::public.app_role, null) $$,
  'and the privilege RPC that was refused a moment ago now succeeds — every refusal above was about the factor and nothing else'
);

select is(
  (select role::text from public.profiles where id = '00000000-0000-4000-a000-000000000002'),
  'assistant',
  'and the change actually landed'
);

select lives_ok(
  $$ select public.change_staff_privileges(
       '00000000-0000-4000-a000-000000000002'::uuid, 'adjuster'::public.app_role, null) $$,
  'put back'
);

select set_config('request.jwt.claims', '', true);
reset role;

select set_config(
  'request.jwt.claims',
  '{"sub":"00000000-0000-4000-a000-000000000002","role":"authenticated","aal":"aal2"}',
  true
);
set local role authenticated;

select is(private.current_app_role(), 'adjuster'::public.app_role, 'the adjuster at aal2 is an adjuster again');
select cmp_ok(
  (select count(*)::int from public.claims), '>', 0,
  'and sees the claims assigned to them'
);

select set_config('request.jwt.claims', '', true);
reset role;

-- ---------------------------------------------------------------------------
-- Customers and partners authenticate with a password and nothing else
-- ---------------------------------------------------------------------------
--
-- §7.2 asks for a second factor from staff. A homeowner and a partner rep have none to
-- present, so their sessions are aal1 for the life of the account. If the gate had been
-- written as "aal2 or nothing" rather than scoped to the three staff roles, every
-- homeowner would have been locked out of their own portal by a security fix — which is
-- the failure mode this section exists to catch, in the exact shape GoTrue produces.

select set_config(
  'request.jwt.claims',
  '{"sub":"00000000-0000-4000-a000-000000000004","role":"authenticated","aal":"aal1"}',
  true
);
set local role authenticated;

select is(
  private.current_app_role(), 'customer'::public.app_role,
  'a customer at aal1 is a customer — the gate is scoped to owner/adjuster/assistant, not applied to everyone with a session'
);

select cmp_ok(
  (select count(*)::int from public.claims), '>', 0,
  'and still reads the claim they are a claimant on'
);

select cmp_ok(
  (select count(*)::int from public.documents), '>', 0,
  'and its documents'
);

select is(
  (select count(*)::int from public.claim_financials), 0,
  'and still cannot see the money, which was never theirs to see — the gate did not disturb the matrix underneath it'
);

select set_config('request.jwt.claims', '', true);
reset role;

select set_config(
  'request.jwt.claims',
  '{"sub":"00000000-0000-4000-a000-000000000005","role":"authenticated","aal":"aal1"}',
  true
);
set local role authenticated;

select is(
  private.current_app_role(), 'partner'::public.app_role,
  'a partner rep at aal1 is a partner rep'
);

select cmp_ok(
  (select count(*)::int from public.claim_partner_summaries), '>', 0,
  'and still reads their referral projection'
);

select set_config('request.jwt.claims', '', true);
reset role;
