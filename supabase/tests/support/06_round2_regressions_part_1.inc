-- ---------------------------------------------------------------------------
-- Fixtures
-- ---------------------------------------------------------------------------

-- A second adjuster. Reassignment cannot be tested against a single-adjuster fixture:
-- "hand the claim to someone else" and "unassign it" are different statements and only
-- the first proves the caseload boundary moves with the assignment.
insert into auth.users (
  instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
  raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
  confirmation_token, recovery_token, email_change_token_new, email_change
) values (
  '00000000-0000-0000-0000-000000000000',
  '00000000-0000-4000-a000-000000000006',
  'authenticated', 'authenticated', 'adjuster2@cmg.test',
  extensions.crypt('CmgDev!2026', extensions.gen_salt('bf')), now(),
  '{"provider":"email","providers":["email"]}'::jsonb,
  '{"first_name":"Rafael","last_name":"Ortiz"}'::jsonb,
  now(), now(), '', '', '', ''
);
update public.profiles set role = 'adjuster'
 where id = '00000000-0000-4000-a000-000000000006';

-- A consent against the seeded lead, so the lead-deletion path has evidence hanging off it.
insert into public.consents (id, lead_id, email, phone, kind, consent_text)
values (
  '86000000-0000-4000-a000-000000000001', '90000000-0000-4000-a000-000000000001',
  'rosa.delgado@example.test', '407-555-0133', 'sms',
  'Rosa Delgado agreed to be contacted about her roof.'
);

create temp table r2_probe (label text primary key, affected int);
grant all on table r2_probe to public;

-- ---------------------------------------------------------------------------
-- MAJOR 2 — a deactivated owner cannot re-enable themselves.
--
-- guard_profile_privileges() looked the actor up without an is_active filter, so it read
-- the role off the very row whose deactivation it was supposed to be enforcing. The
-- bypass landed on precisely the highest-privilege role, in precisely the offboarding or
-- account-compromise scenario deactivation exists for.
-- ---------------------------------------------------------------------------

-- Service-role deactivation, which is how offboarding actually happens.
update public.profiles set is_active = false
 where id = '00000000-0000-4000-a000-000000000001';

set local request.jwt.claims = '{"sub":"00000000-0000-4000-a000-000000000001","role":"authenticated","aal":"aal2"}';
set local role authenticated;

with u as (
  update public.profiles set is_active = true
   where id = '00000000-0000-4000-a000-000000000001'
  returning 1
)
insert into r2_probe select 'deactivated_owner_self_reactivate', count(*)::int from u;

select is(
  (select affected from r2_probe where label = 'deactivated_owner_self_reactivate'),
  0,
  'a deactivated owner cannot switch themselves back on: the one statement that undoes an offboarding, issued by the one account with nothing above it, now changes nothing'
);

with u as (
  update public.profiles set role = 'owner'
   where id = '00000000-0000-4000-a000-000000000004'
  returning 1
)
insert into r2_probe select 'deactivated_owner_promotes_other', count(*)::int from u;

select is(
  (select affected from r2_probe where label = 'deactivated_owner_promotes_other'),
  0,
  'nor can they promote somebody else to owner and re-enter through that account instead, so the refusal is about the actor being disabled rather than about the one column they first reached for'
);

select set_config('request.jwt.claims', '', true);
reset role;

select is(
  (select is_active from public.profiles where id = '00000000-0000-4000-a000-000000000001'),
  false,
  'and the owner really is still disabled afterwards, which is the control proving the two zero-row results above were refusals rather than writes that quietly succeeded'
);

-- The same attempt with RLS taken out of the picture. `postgres` bypasses row security,
-- so nothing but public.guard_profile_privileges() itself can refuse this statement --
-- auth.uid() still resolves from the request GUC regardless of the database role. This is
-- what isolates the trigger fix from the profiles_select_self_or_staff fix: each one has
-- to hold on its own, because either could be relaxed later without the other.
set local request.jwt.claims = '{"sub":"00000000-0000-4000-a000-000000000001","role":"authenticated","aal":"aal2"}';

select throws_ok(
  $$ update public.profiles set is_active = true
      where id = '00000000-0000-4000-a000-000000000001' $$,
  '42501'::char(5), null::text,
  'the privilege trigger refuses the reactivation on its own, with row security bypassed entirely, so the protection does not depend on the deactivated account also being unable to see its own row'
);

select set_config('request.jwt.claims', '', true);

update public.profiles set is_active = true
 where id = '00000000-0000-4000-a000-000000000001';

-- Control: an owner who is actually active retains the administration authority §4 gives
-- them. The fix has to disable the disabled, not the role.
set local request.jwt.claims = '{"sub":"00000000-0000-4000-a000-000000000001","role":"authenticated","aal":"aal2"}';
set local role authenticated;

select lives_ok(
  $$ update public.profiles set is_active = false
      where id = '00000000-0000-4000-a000-000000000004' $$,
  'an active owner can still deactivate an account, so the guard narrowed who may administer activation rather than removing the ability'
);

select lives_ok(
  $$ update public.profiles set is_active = true
      where id = '00000000-0000-4000-a000-000000000004' $$,
  'and can switch it back on again, which is the half of the same authority an over-tightened guard would have taken away'
);

select set_config('request.jwt.claims', '', true);
reset role;

-- ---------------------------------------------------------------------------
-- MAJOR 3 — an assigned adjuster can change assignment, through the RPC and only
-- through the RPC.
--
-- claims_select scopes an adjuster to their own caseload, and Postgres applies SELECT
-- policies to the new row of an UPDATE, so writing any other value into
-- assigned_adjuster_id moved the row out of the actor's own visibility and the statement
-- was refused. §4 grants adjusters "status / assignment | assigned ✔"; they could not
-- even unassign themselves.
-- ---------------------------------------------------------------------------

set local request.jwt.claims = '{"sub":"00000000-0000-4000-a000-000000000002","role":"authenticated","aal":"aal2"}';
set local role authenticated;

select throws_ok(
  $$ update public.claims set assigned_adjuster_id = null
      where id = '20000000-0000-4000-a000-000000000001' $$,
  '42501'::char(5), null::text,
  'a direct UPDATE of the assignment column is still refused, which is deliberate: loosening claims_select to permit it is what would have dissolved the caseload boundary for every other read'
);

select throws_ok(
  $$ select public.reassign_claim(
       '20000000-0000-4000-a000-000000000001',
       '00000000-0000-4000-a000-000000000004') $$,
  '23514'::char(5), null::text,
  'the RPC will not park a claim on a customer''s profile, so routing the write through a definer function did not turn assigned_adjuster_id into a free-text pointer at any account'
);

select set_config('request.jwt.claims', '', true);
reset role;

update public.profiles set is_active = false
 where id = '00000000-0000-4000-a000-000000000006';

set local request.jwt.claims = '{"sub":"00000000-0000-4000-a000-000000000002","role":"authenticated","aal":"aal2"}';
set local role authenticated;

select throws_ok(
  $$ select public.reassign_claim(
       '20000000-0000-4000-a000-000000000001',
       '00000000-0000-4000-a000-000000000006') $$,
  '23514'::char(5), null::text,
  'nor onto a deactivated adjuster, which would otherwise be a way to strand a live claim on an account that can no longer open it'
);

select set_config('request.jwt.claims', '', true);
reset role;

update public.profiles set is_active = true
 where id = '00000000-0000-4000-a000-000000000006';

-- An assistant is ✖ on assignment in §4, and a customer holds no claim authority at all.
set local request.jwt.claims = '{"sub":"00000000-0000-4000-a000-000000000003","role":"authenticated","aal":"aal2"}';
set local role authenticated;

select throws_ok(
  $$ select public.reassign_claim('20000000-0000-4000-a000-000000000001', null) $$,
  '42501'::char(5), null::text,
  'an assistant cannot reassign a claim through the RPC: the function authorises against the same test the policy did, so exposing it as an RPC did not widen who may act'
);

select set_config('request.jwt.claims', '', true);
reset role;

set local request.jwt.claims = '{"sub":"00000000-0000-4000-a000-000000000004","role":"authenticated"}';
set local role authenticated;

select throws_ok(
  $$ select public.reassign_claim('20000000-0000-4000-a000-000000000001', null) $$,
  '42501'::char(5), null::text,
  'and neither can the homeowner whose claim it is, so a SECURITY DEFINER function reachable by every signed-in session is still closed to the roles that were never meant to reach it'
);

select set_config('request.jwt.claims', '', true);
reset role;

-- The capability itself: the assigned adjuster hands the file to another adjuster.
set local request.jwt.claims = '{"sub":"00000000-0000-4000-a000-000000000002","role":"authenticated","aal":"aal2"}';
set local role authenticated;

select lives_ok(
  $$ select public.reassign_claim(
       '20000000-0000-4000-a000-000000000001',
       '00000000-0000-4000-a000-000000000006') $$,
  'the assigned adjuster can hand their own claim to another adjuster, which is the authority §4 grants them and which no route in the schema previously provided'
);

select is(
  (select count(*)::int from public.claims where id in
    ('20000000-0000-4000-a000-000000000001','20000000-0000-4000-a000-000000000002','25000000-0000-4000-a000-000000000001')),
  1,
  'and immediately loses it: the adjuster who gave the claim away now sees only the one claim still assigned to them, so the caseload boundary follows the assignment instead of being a one-time grant'
);

select set_config('request.jwt.claims', '', true);
reset role;

select is(
  (select assigned_adjuster_id from public.claims where id = '20000000-0000-4000-a000-000000000001'),
  '00000000-0000-4000-a000-000000000006'::uuid,
  'the reassignment actually landed on the claim row, which is the control proving the refusals around it are about authority rather than about the write path being broken'
);

select isnt_empty(
  $$ select 1 from public.audit_log
      where entity = 'claims'
        and entity_id = '20000000-0000-4000-a000-000000000001'
        and action = 'claims.update'
        and (meta -> 'changed') ? 'assigned_adjuster_id'
        and actor_id = '00000000-0000-4000-a000-000000000002' $$,
  'the hand-off is in the audit trail and is attributed to the adjuster who performed it, not to the function''s owner: running the write as definer moved the privilege, not the responsibility'
);

set local request.jwt.claims = '{"sub":"00000000-0000-4000-a000-000000000006","role":"authenticated","aal":"aal2"}';
set local role authenticated;

select is(
  (select count(*)::int from public.claims where id in
    ('20000000-0000-4000-a000-000000000001','20000000-0000-4000-a000-000000000002','25000000-0000-4000-a000-000000000001')),
  1,
  'the receiving adjuster now reads the claim they were given, so the hand-off transferred access rather than merely clearing it from the sender'
);

select lives_ok(
  $$ select public.reassign_claim('20000000-0000-4000-a000-000000000001', null) $$,
  'and can unassign themselves, returning the claim to the intake queue — the plainest case in §4''s assignment row and the one that was previously impossible for every adjuster'
);

select set_config('request.jwt.claims', '', true);
reset role;

select is(
  (select assigned_adjuster_id from public.claims where id = '20000000-0000-4000-a000-000000000001'),
  null::uuid,
  'the claim really is unassigned afterwards, rather than the call having been accepted and discarded'
);

-- The owner picks an unassigned claim back up, which is the other half of the queue.
set local request.jwt.claims = '{"sub":"00000000-0000-4000-a000-000000000001","role":"authenticated","aal":"aal2"}';
set local role authenticated;

select lives_ok(
  $$ select public.reassign_claim(
       '20000000-0000-4000-a000-000000000001',
       '00000000-0000-4000-a000-000000000002') $$,
  'the owner can assign an unassigned claim to an adjuster, so the RPC serves the intake-acceptance flow and not only adjuster-to-adjuster hand-off'
);

select set_config('request.jwt.claims', '', true);
reset role;

select ok(
  has_function_privilege('authenticated', 'public.reassign_claim(uuid,uuid)', 'EXECUTE'),
  'the RPC is callable by a signed-in session, which is the point of it existing'
);

select ok(
  not has_function_privilege('anon', 'public.reassign_claim(uuid,uuid)', 'EXECUTE'),
  'and is not callable without one: a SECURITY DEFINER function that writes to claims must never be reachable by the role a leaked publishable key runs as'
);
