-- ---------------------------------------------------------------------------
-- private.has_aal2() — shape, grants, and what it does with a missing claim
-- ---------------------------------------------------------------------------

select has_function(
  'private',
  'has_aal2',
  'the factor test is a named helper rather than an expression repeated in each policy, so there is one place to read it and one place to change it'
);
select is(
  has_function_privilege('anon', 'private.has_aal2()', 'execute'),
  false,
  'anon cannot execute it, matching every other routine in the private schema'
);

select set_config('request.jwt.claims', '', true);

select is(
  private.has_aal2(), false,
  'THE MISSING-CLAIM DECISION: no request.jwt.claims at all reads as aal1, not as aal2 — the predicate fails closed, so a GoTrue that renamed the field or a proxy that dropped it costs staff their access (an outage someone reports) rather than costing the workspace its MFA enforcement (a breach nobody sees)'
);

select set_config(
  'request.jwt.claims',
  '{"sub":"00000000-0000-4000-a000-000000000001","role":"authenticated"}',
  true
);

select is(
  private.has_aal2(), false,
  'a claims blob carrying a subject but no aal is aal1 too — this is the shape every pgTAP fixture in this repo used before this round, which is why they now say aal2 explicitly'
);

select set_config(
  'request.jwt.claims',
  '{"sub":"00000000-0000-4000-a000-000000000001","role":"authenticated","aal":"aal1"}',
  true
);

select is(
  private.has_aal2(), false,
  'and the token GoTrue actually issues after a password-only sign-in — the one the reviewer held — is refused'
);

select set_config(
  'request.jwt.claims',
  '{"sub":"00000000-0000-4000-a000-000000000001","role":"authenticated","aal":"aal2"}',
  true
);

select is(
  private.has_aal2(), true,
  'aal2 is the only value that passes'
);

-- ---------------------------------------------------------------------------
-- A staff role at aal1 is not a lesser role — it is no role
-- ---------------------------------------------------------------------------

select set_config(
  'request.jwt.claims',
  '{"sub":"00000000-0000-4000-a000-000000000001","role":"authenticated","aal":"aal1"}',
  true
);
set local role authenticated;

select is(
  private.current_app_role(), null::public.app_role,
  'an owner one factor short resolves to NULL, the same answer a deactivated account gets — §7.2 makes "staff" and "staff with a second factor" one category, so there is no reduced tier to fall back to'
);

select is(private.is_owner(), false, 'so is_owner() is false');
select is(private.is_staff(), false, 'and is_staff() is false');
select is(
  private.can_manage_claim('20000000-0000-4000-a000-000000000001'), false,
  'and the claim-scoped helper the money policies are written against is false'
);

select is(
  (select count(*)::int from public.claims), 0,
  'GET /rest/v1/claims — 200 with the caseload before, zero rows now'
);

select is(
  (select count(*)::int from public.claim_financials), 0,
  'GET /rest/v1/claim_financials — settlement amounts and fee notes, zero rows now'
);

select is(
  (select count(*)::int from public.consents), 0,
  'GET /rest/v1/consents — the signed consent evidence, with the subject email, phone and originating IP, zero rows now'
);

select is(
  (select count(*)::int from public.leads), 0,
  'and the intake queue, which is the same is_staff() read wearing a different name'
);

select is(
  (select count(*)::int from public.audit_log), 0,
  'and the audit trail, so an aal1 session cannot read what it failed to do either'
);

select is(
  (select count(*)::int from public.profiles where id <> '00000000-0000-4000-a000-000000000001'), 0,
  'GET /rest/v1/profiles — the staff directory is gone: zero rows about anyone else'
);

select is(
  (select count(*)::int from public.profiles), 1,
  'and exactly one row survives, the caller''s own, because getSession() and the proxy read the role through that self branch to decide the caller belongs on /mfa — see the note at the top of this file for why zero here would make MFA unreachable rather than mandatory'
);

select throws_ok(
  $$ select * from public.admin_user_directory() $$,
  '42501'::char(5), null::text,
  'POST /rest/v1/rpc/admin_user_directory — refused, and it is the worst of the six: it answered with every account''s sign-in address and MFA state, which is a list of exactly which colleague to attack next'
);

select throws_ok(
  $$ select public.change_staff_privileges(
       '00000000-0000-4000-a000-000000000002'::uuid, 'owner'::public.app_role, null) $$,
  '42501'::char(5), null::text,
  'and the RPC that hands out roles is refused with a sentence about the session rather than about the target'
);

-- The escalation itself. RLS declines the write, and PostgREST reports a zero-row PATCH as
-- a success, so the assertion has to be about the table rather than about the error.
select lives_ok(
  $$ update public.profiles set role = 'owner'
      where id = '00000000-0000-4000-a000-000000000002' $$,
  'PATCH /rest/v1/profiles?id=eq.<adjuster> {"role":"owner"} raises nothing — profiles_update_owner simply matches no rows, which is what a 200 with an empty body looked like'
);

-- The one row an aal1 caller *can* reach is their own, and profiles_update_self admits
-- them onto it on identity alone. That is the path the RLS gate cannot close, so
-- guard_profile_privileges() asks the question itself.
select throws_ok(
  $$ update public.profiles set is_active = false
      where id = '00000000-0000-4000-a000-000000000001' $$,
  '42501'::char(5), null::text,
  'and self-deactivation — the one privilege write that reaches the trigger through profiles_update_self rather than profiles_update_owner — is refused there, so an aal1 owner cannot strand the workspace with a password alone'
);

select throws_ok(
  $$ update public.profiles set role = 'adjuster'
      where id = '00000000-0000-4000-a000-000000000001' $$,
  '42501'::char(5), null::text,
  'as is self-demotion, for the same reason and at the same layer'
);

-- An ordinary edit to one's own row is untouched: the gate is on privilege columns.
select lives_ok(
  $$ update public.profiles set phone = '407-555-0101'
      where id = '00000000-0000-4000-a000-000000000001' $$,
  'while changing one''s own phone number still works at aal1 — guard_profile_privileges() returns early when role, partner_company_id and is_active are all untouched, so the gate did not become a general write lock'
);

select set_config('request.jwt.claims', '', true);
reset role;

select is(
  (select role::text from public.profiles where id = '00000000-0000-4000-a000-000000000002'),
  'adjuster',
  'and checked from outside the session: the adjuster is still an adjuster, so the escalation that returned 200 before now changes nothing'
);

select is(
  (select is_active from public.profiles where id = '00000000-0000-4000-a000-000000000001'),
  true,
  'and the owner is still active'
);
