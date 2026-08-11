-- CMG Property Solutions — regressions for the SECOND review round.
--
-- Every finding here was introduced by the remediation of the first round, and two of
-- the three were invisible to the existing suite for the same reason: they pass as the
-- service role and fail only in a JWT-bearing session. Assertions in this file are
-- therefore written in a real user session wherever the finding lives in one, and the
-- few that deliberately run as `postgres` say so and say why.
--
--   owner      00000000-0000-4000-a000-000000000001  Austin Graham
--   adjuster   00000000-0000-4000-a000-000000000002  Dana Reyes    (assigned claims 1 and 2)
--   assistant  00000000-0000-4000-a000-000000000003  Priya Nolan
--   customer   00000000-0000-4000-a000-000000000004  Marcus Bell   (claimant on claim 1)
--   partner    00000000-0000-4000-a000-000000000005  Tyler Boone   (Summit Exteriors LLC)
--   adjuster2  00000000-0000-4000-a000-000000000006  Rafael Ortiz  (fixture, for hand-off)

begin;
set local client_min_messages = warning;
create extension if not exists pgtap with schema extensions;

select plan(62);

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
  (select count(*)::int from public.claims),
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
  (select count(*)::int from public.claims),
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

-- ---------------------------------------------------------------------------
-- MINOR 1 — a homeowner uploads homeowner documents, and `lor_signed` is not one.
-- The documents insert policy constrained the customer's claim and visibility but not
-- the kind, so a homeowner could file a signed letter of representation against their
-- own claim and arm the §5 status gate themselves.
-- ---------------------------------------------------------------------------

set local request.jwt.claims = '{"sub":"00000000-0000-4000-a000-000000000004","role":"authenticated"}';
set local role authenticated;

select throws_ok(
  $$ insert into public.documents (claim_id, storage_path, original_name, kind, mime, size_bytes, uploaded_by, visibility)
     values ('20000000-0000-4000-a000-000000000001',
             'claims/20000000-0000-4000-a000-000000000001/cccccccc-0000-4000-a000-000000000001.pdf',
             'self-signed-lor.pdf', 'lor_signed', 'application/pdf', 4096,
             '00000000-0000-4000-a000-000000000004', 'customer') $$,
  '42501'::char(5), null::text,
  'a homeowner cannot file a signed letter of representation on their own claim: that document is what the lor_sent → lor_signed gate reads, so writing it is asserting that CMG holds authority to act for them'
);

select throws_ok(
  $$ insert into public.documents (claim_id, storage_path, original_name, kind, mime, size_bytes, uploaded_by, visibility)
     values ('20000000-0000-4000-a000-000000000001',
             'claims/20000000-0000-4000-a000-000000000001/cccccccc-0000-4000-a000-000000000002.pdf',
             'self-lor-draft.pdf', 'lor_unsigned', 'application/pdf', 4096,
             '00000000-0000-4000-a000-000000000004', 'customer') $$,
  '42501'::char(5), null::text,
  'nor the unsigned letter, so the representation record as a whole is produced by the firm rather than by the client'
);

select throws_ok(
  $$ insert into public.documents (claim_id, storage_path, original_name, kind, mime, size_bytes, uploaded_by, visibility)
     values ('20000000-0000-4000-a000-000000000001',
             'claims/20000000-0000-4000-a000-000000000001/cccccccc-0000-4000-a000-000000000003.pdf',
             'my-own-estimate.pdf', 'estimate', 'application/pdf', 4096,
             '00000000-0000-4000-a000-000000000004', 'customer') $$,
  '42501'::char(5), null::text,
  'and cannot label their upload an estimate or a denial either — those are the carrier-facing artefacts the file is built from, and a homeowner-supplied one would be indistinguishable from CMG''s own'
);

select lives_ok(
  $$ insert into public.documents (claim_id, storage_path, original_name, kind, mime, size_bytes, uploaded_by, visibility)
     values ('20000000-0000-4000-a000-000000000001',
             'claims/20000000-0000-4000-a000-000000000001/cccccccc-0000-4000-a000-000000000004.jpg',
             'kitchen-ceiling.jpg', 'photo', 'image/jpeg', 204800,
             '00000000-0000-4000-a000-000000000004', 'customer') $$,
  'the homeowner can still upload a photograph of the damage, which is the whole reason §4 gives them an upload right at all'
);

select lives_ok(
  $$ insert into public.documents (claim_id, storage_path, original_name, kind, mime, size_bytes, uploaded_by, visibility)
     values ('20000000-0000-4000-a000-000000000001',
             'claims/20000000-0000-4000-a000-000000000001/cccccccc-0000-4000-a000-000000000005.pdf',
             'carrier-letter-i-received.pdf', 'correspondence', 'application/pdf', 51200,
             '00000000-0000-4000-a000-000000000004', 'customer') $$,
  'and correspondence they received from their carrier, so the allowlist covers what a homeowner actually has to hand rather than reducing them to photographs'
);

select lives_ok(
  $$ insert into public.claim_events (claim_id, type, body, author_id, visibility)
     values ('20000000-0000-4000-a000-000000000001', 'question',
             'Has the carrier responded to the supplement yet?',
             '00000000-0000-4000-a000-000000000004', 'customer') $$,
  'and can still ask a question on their claim, so tightening the document policy did not touch the portal''s other write path'
);

select set_config('request.jwt.claims', '', true);
reset role;

-- ---------------------------------------------------------------------------
-- MINOR 2 — an assistant is ✖ on status, so an assistant cannot arm the status gate.
-- is_staff_for_claim() covers assistants, so both the insert policy and the update
-- policy let one create a `lor_signed` row, or relabel an existing document into one, on
-- any claim in the business.
-- ---------------------------------------------------------------------------

set local request.jwt.claims = '{"sub":"00000000-0000-4000-a000-000000000003","role":"authenticated","aal":"aal2"}';
set local role authenticated;

select throws_ok(
  $$ insert into public.documents (claim_id, storage_path, original_name, kind, mime, size_bytes, uploaded_by, visibility)
     values ('20000000-0000-4000-a000-000000000001',
             'claims/20000000-0000-4000-a000-000000000001/dddddddd-0000-4000-a000-000000000001.pdf',
             'assistant-filed-lor.pdf', 'lor_signed', 'application/pdf', 4096,
             '00000000-0000-4000-a000-000000000003', 'internal') $$,
  '42501'::char(5), null::text,
  'an assistant cannot file a signed letter of representation on any claim: they are ✖ on status in §4, and this document is the only precondition the lor_signed transition checks'
);

select throws_ok(
  $$ update public.documents set kind = 'lor_signed'
      where id = '50000000-0000-4000-a000-000000000001' $$,
  '42501'::char(5), null::text,
  'nor relabel a document they legitimately uploaded into one, which would arm the same gate one statement later and leave the insert restriction achieving nothing'
);

with u as (
  update public.documents set kind = 'other'
   where id = '50000000-0000-4000-a000-000000000003'
  returning 1
)
insert into r2_probe select 'assistant_strips_lor_kind', count(*)::int from u;

select is(
  (select affected from r2_probe where label = 'assistant_strips_lor_kind'),
  0,
  'and cannot relabel an existing signed letter into something else either: stripping the kind off a claim that already passed the gate is tampering with the representation record, so the restriction binds in both directions'
);

select lives_ok(
  $$ insert into public.documents (claim_id, storage_path, original_name, kind, mime, size_bytes, uploaded_by, visibility)
     values ('20000000-0000-4000-a000-000000000001',
             'claims/20000000-0000-4000-a000-000000000001/dddddddd-0000-4000-a000-000000000002.jpg',
             'inspection-photo.jpg', 'photo', 'image/jpeg', 102400,
             '00000000-0000-4000-a000-000000000003', 'internal') $$,
  'the assistant can still upload ordinary documents, which §4 grants them explicitly — the restriction is on two kinds, not on the role''s access to the file'
);

select lives_ok(
  $$ update public.documents set original_name = 'declarations-page-v2.pdf'
      where id = '50000000-0000-4000-a000-000000000001' $$,
  'and can still edit an ordinary document''s metadata, so document administration remains office work rather than becoming adjuster-only'
);

select set_config('request.jwt.claims', '', true);
reset role;

set local request.jwt.claims = '{"sub":"00000000-0000-4000-a000-000000000002","role":"authenticated","aal":"aal2"}';
set local role authenticated;

select lives_ok(
  $$ insert into public.documents (claim_id, storage_path, original_name, kind, mime, size_bytes, uploaded_by, visibility)
     values ('20000000-0000-4000-a000-000000000001',
             'claims/20000000-0000-4000-a000-000000000001/dddddddd-0000-4000-a000-000000000003.pdf',
             'countersigned-lor.pdf', 'lor_signed', 'application/pdf', 8192,
             '00000000-0000-4000-a000-000000000002', 'internal') $$,
  'the assigned adjuster can file the signed letter on their own claim, so the capability moved to the roles that own the lifecycle rather than disappearing from the platform'
);

select lives_ok(
  $$ update public.documents set kind = 'lor_signed'
      where id = '50000000-0000-4000-a000-000000000002' $$,
  'and can relabel a document into one, which the manual-signature fallback in §6 depends on when a signed copy arrives outside the e-sign flow'
);

select set_config('request.jwt.claims', '', true);
reset role;

-- ---------------------------------------------------------------------------
-- MINOR 3 — the two profiles policies that could never fire are gone
-- ---------------------------------------------------------------------------

select is_empty(
  $$ select p.polname::text from pg_policy p
      where p.polrelid = 'public.profiles'::regclass
        and p.polcmd in ('a', 'd') $$,
  'no INSERT or DELETE policy remains on public.profiles: authenticated holds neither grant, so those policies described an owner capability that the grant layer refused one level above them'
);

select is_empty(
  $$ select t.priv from unnest(array['INSERT','DELETE','TRUNCATE']) as t(priv)
      where has_table_privilege('authenticated', 'public.profiles', t.priv) $$,
  'and the grants themselves confirm why: profile rows are created by the auth.users trigger and removed by its cascade, so no client session can add or remove one whatever the policies say'
);

-- ---------------------------------------------------------------------------
-- MINOR 5 — deactivation closes the customer surface as one piece.
-- claims, documents and events already went dark (round 1, MAJOR 5). The profile row and
-- the claimant row did not, and the claimant row discloses claim_id.
-- ---------------------------------------------------------------------------

update public.profiles set is_active = false
 where id = '00000000-0000-4000-a000-000000000004';

set local request.jwt.claims = '{"sub":"00000000-0000-4000-a000-000000000004","role":"authenticated"}';
set local role authenticated;

select is(
  (select count(*)::int from public.profiles),
  0,
  'a deactivated homeowner reads no profile row, not even their own, so the last relation that kept answering after the rest of the portal went dark now closes with it'
);

select is(
  (select count(*)::int from public.claimants),
  0,
  'and no claimant row, which mattered more than it looks: that row carries claim_id, so a disabled account could still learn which claim it had been attached to'
);

select set_config('request.jwt.claims', '', true);
reset role;

update public.profiles set is_active = true
 where id = '00000000-0000-4000-a000-000000000004';

set local request.jwt.claims = '{"sub":"00000000-0000-4000-a000-000000000004","role":"authenticated"}';
set local role authenticated;

select is(
  (select count(*)::int from public.profiles),
  1,
  'an active homeowner still reads their own profile, which the portal needs for the name and phone fields §10 lets them edit'
);

select is(
  (select count(*)::int from public.claimants),
  2,
  'and still sees the co-claimants on their own claim, so removing the redundant self-match branch cost an active customer nothing'
);

select set_config('request.jwt.claims', '', true);
reset role;

-- ---------------------------------------------------------------------------
-- MINOR 6 — the implicit PUBLIC grant on schema public
-- ---------------------------------------------------------------------------

select ok(
  not has_schema_privilege('anon', 'public', 'USAGE'),
  'anon holds no USAGE on schema public. Revoking it from anon by name was not enough: anon is a member of PUBLIC like every role, and the implicit PUBLIC grant was still standing underneath'
);

select ok(
  has_schema_privilege('authenticated', 'public', 'USAGE'),
  'authenticated still holds USAGE by its own explicit grant, so PostgREST continues to serve signed-in sessions — the revoke removed the implicit grant, not the real one'
);

select ok(
  has_schema_privilege('service_role', 'public', 'USAGE'),
  'and so does service_role, which is what every server action and the outbox sweeper run as'
);

select is_empty(
  $$ select p.oid::regprocedure::text
       from pg_proc p
       join pg_namespace n on n.oid = p.pronamespace
       cross join lateral aclexplode(coalesce(p.proacl, acldefault('f', p.proowner))) a
      where n.nspname = 'public'
        and p.prokind in ('f', 'p')
        and a.grantee = 0
        and a.privilege_type = 'EXECUTE' $$,
  'no routine in public grants EXECUTE to PUBLIC, so no function is reachable by a role merely because nobody remembered to revoke the default'
);

-- The case the schema revoke exists for: a function added by some later migration whose
-- author forgets to revoke EXECUTE from PUBLIC. It really does arrive PUBLIC-executable —
-- `alter default privileges ... revoke execute on functions from public` is recorded in
-- pg_default_acl but does not take effect on this build, so the migration comment marks
-- it as defence in depth and this pair of assertions pins what actually protects the
-- schema. The grant is real; reaching it is what fails.
create function public.zz_default_privilege_probe() returns integer
  language sql immutable as $probe$ select 1 $probe$;

select ok(
  has_function_privilege('anon', 'public.zz_default_privilege_probe()', 'EXECUTE'),
  'a function created in public without an explicit revoke is still granted EXECUTE to PUBLIC, and therefore to anon — this assertion documents the exposure rather than a protection, and is the reason the schema-level revoke has to carry the weight'
);

set local role anon;

select throws_ok(
  $$ select public.zz_default_privilege_probe() $$,
  '42501'::char(5), null::text,
  'and anon still cannot call it: entering the schema fails before the function''s own privileges are ever consulted, so revoking USAGE from PUBLIC closes the whole class of forgotten-revoke mistakes and not merely the routines that exist today'
);

reset role;

drop function public.zz_default_privilege_probe();

-- ---------------------------------------------------------------------------
-- Nothing over-tightened: the intake → accept flow still runs end to end, and the
-- partner still reads exactly the one projection they are entitled to.
-- ---------------------------------------------------------------------------

set local request.jwt.claims = '{"sub":"00000000-0000-4000-a000-000000000001","role":"authenticated","aal":"aal2"}';
set local role authenticated;

select lives_ok(
  $$ insert into public.claims (
       id, property_street, property_city, property_zip,
       carrier, policy_number, carrier_tenure, loss_date, cause, description
     ) values (
       '26000000-0000-4000-a000-000000000001', '9 Acceptance Way', 'Longwood', '32750',
       'Test Carrier', 'POL-R2-ACCEPT', 'lt_1_year', current_date - 3, 'wind',
       'intake accepted end to end in an owner session'
     ) $$,
  'an owner can still create a claim from a real session, which is the first step of the accept flow and the finding round 1 was opened by'
);

select lives_ok(
  $$ update public.claims set status = 'under_review'
      where id = '26000000-0000-4000-a000-000000000001' $$,
  'and take it into review, so the status half of §4''s "status / assignment" row still works for them'
);

select lives_ok(
  $$ select public.reassign_claim(
       '26000000-0000-4000-a000-000000000001',
       '00000000-0000-4000-a000-000000000002') $$,
  'and assign it to an adjuster, completing the accept flow: create, review, assign, all in one owner session with no service-role step in the middle'
);

select lives_ok(
  $$ insert into public.claimants (claim_id, first_name, last_name, email, initials, is_primary)
     values ('26000000-0000-4000-a000-000000000001', 'Tomas', 'Iverson',
             'tomas.iverson@example.test', 'TI', true) $$,
  'and record the homeowner against it, which is what the invite in §6 is later issued from'
);

select set_config('request.jwt.claims', '', true);
reset role;

set local request.jwt.claims = '{"sub":"00000000-0000-4000-a000-000000000005","role":"authenticated"}';
set local role authenticated;

select is(
  (select count(*)::int from public.claim_partner_summaries),
  2,
  'the referring contractor still reads the two summaries for the claims their company referred, so none of this round''s tightening reached the partner portal'
);

select is(
  (select count(*)::int from public.claims) + (select count(*)::int from public.documents)
    + (select count(*)::int from public.claimants) + (select count(*)::int from public.claim_financials),
  0,
  'and still reads nothing from the claim record, its documents, its homeowners or its money — the projection remains their entire surface'
);

select set_config('request.jwt.claims', '', true);
reset role;

-- ---------------------------------------------------------------------------
-- MAJOR 1 — an owner can delete a claim or a lead that carries consents.
--
-- Both consent parents are `on delete set null`, and Postgres performs that detachment
-- as an internal `UPDATE consents SET claim_id = NULL`, which ran straight into
-- guard_consent_immutable(). Because the guard early-returns when auth.uid() is null, it
-- succeeded as the service role and failed for every real user — so claims_delete_owner
-- and leads_delete_owner were dead policies for the only callers that hold them, and
-- every intake-born claim carries consents.
--
-- Destructive, so it runs last.
-- ---------------------------------------------------------------------------

set local request.jwt.claims = '{"sub":"00000000-0000-4000-a000-000000000001","role":"authenticated","aal":"aal2"}';
set local role authenticated;

select throws_ok(
  $$ update public.consents set claim_id = '20000000-0000-4000-a000-000000000002'
      where id = '80000000-0000-4000-a000-000000000001' $$,
  '42501'::char(5), null::text,
  'a consent still cannot be re-pointed at a different claim: the guard was narrowed to the one transition the foreign key performs, not switched off, so consent given for one file cannot be made to read as consent for another'
);

select throws_ok(
  $$ update public.consents set lead_id = '90000000-0000-4000-a000-000000000001'
      where id = '80000000-0000-4000-a000-000000000001' $$,
  '42501'::char(5), null::text,
  'and cannot be attached to a subject it was never collected against, which is the same rule seen from the other end'
);

select lives_ok(
  $$ delete from public.claims where id = '20000000-0000-4000-a000-000000000001' $$,
  'an owner can delete a claim that carries consent records — §4 gives them "all CRUD" on claims, and every claim born from the intake form has consents, so this was previously refused for the entire table'
);

select lives_ok(
  $$ delete from public.leads where id = '90000000-0000-4000-a000-000000000001' $$,
  'and a lead that carries one, which is the same defect on the other parent: routine cleanup of the contact-form inbox was impossible for any real user'
);

select set_config('request.jwt.claims', '', true);
reset role;

select is(
  (select count(*)::int from public.consents
    where id in ('80000000-0000-4000-a000-000000000001',
                 '80000000-0000-4000-a000-000000000002',
                 '86000000-0000-4000-a000-000000000001')),
  3,
  'all three consent records survived the deletion of their subjects, so permitting the detachment did not turn a claim delete into a way of destroying TCPA evidence'
);

select is_empty(
  $$ select id from public.consents
      where id in ('80000000-0000-4000-a000-000000000001',
                   '80000000-0000-4000-a000-000000000002',
                   '86000000-0000-4000-a000-000000000001')
        and (claim_id is not null or lead_id is not null) $$,
  'and every one of them is genuinely detached rather than dangling, so the foreign key performed the `set null` it was written for instead of being vetoed by the trigger above it'
);

select is(
  (select consent_text from public.consents where id = '86000000-0000-4000-a000-000000000001'),
  'Rosa Delgado agreed to be contacted about her roof.',
  'the surviving snapshot is byte-for-byte what was captured, so what the detachment removed is the link to a deleted row and not one character of the evidence itself'
);

select is(
  (select email from public.consents where id = '80000000-0000-4000-a000-000000000001'),
  'customer@cmg.test',
  'and still names the person who gave it, which is what makes a detached consent evidence rather than an orphan nobody can attribute'
);

select is_empty(
  $$ select id from public.claims where id = '20000000-0000-4000-a000-000000000001' $$,
  'the claim itself really is gone, which is the control proving the lives_ok above was a delete that happened rather than a statement that matched nothing'
);

select isnt_empty(
  $$ select 1 from public.audit_log
      where entity = 'claims'
        and entity_id = '20000000-0000-4000-a000-000000000001'
        and action = 'claims.delete'
        and actor_id = '00000000-0000-4000-a000-000000000001' $$,
  'and the deletion is recorded against the owner who performed it, so a claim leaving the system is as traceable as every change made while it was in it'
);

select * from finish();
rollback;
