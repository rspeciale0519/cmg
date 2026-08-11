-- CMG Property Solutions — regressions for the THIRD review round.
--
-- Both majors in this round were reachable from a real session and neither was visible
-- to the 291 assertions that preceded this file, for two distinct reasons worth naming
-- because they are the reasons to keep this file shaped the way it is:
--
--   * every existing negative test authenticates as an ACTIVE account. Deactivation and
--     the profile-less "ghost" uid were tested only where the surface is RLS, where NULL
--     and false are indistinguishable — so the one place the difference matters, a
--     plpgsql `if not <helper>` guard, was never exercised by a caller that makes the
--     helper return NULL;
--   * the intake re-parent of §4/§6 had no test at all, so a guard that refused it for
--     every caller in the system, service role included, looked exactly like a guard that
--     worked.
--
-- Assertions here therefore run as deactivated and profile-less callers wherever the
-- finding lives in one, and the service-role paths say so and say why.
--
--   owner      00000000-0000-4000-a000-000000000001  Austin Graham
--   adjuster   00000000-0000-4000-a000-000000000002  Dana Reyes    (assigned claims 1 and 2)
--   assistant  00000000-0000-4000-a000-000000000003  Priya Nolan
--   customer   00000000-0000-4000-a000-000000000004  Marcus Bell   (claimant on claim 1)
--   partner    00000000-0000-4000-a000-000000000005  Tyler Boone   (Summit Exteriors LLC)
--   adjuster2  00000000-0000-4000-a000-000000000006  Rafael Ortiz  (fixture, for hand-off)
--   ghost      00000000-0000-4000-a000-0000000000ff  auth user with NO profiles row

begin;
set local client_min_messages = warning;
create extension if not exists pgtap with schema extensions;

select plan(64);

-- ---------------------------------------------------------------------------
-- Fixtures
-- ---------------------------------------------------------------------------

insert into auth.users (
  instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
  raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
  confirmation_token, recovery_token, email_change_token_new, email_change
)
select
  '00000000-0000-0000-0000-000000000000', u.id, 'authenticated', 'authenticated', u.email,
  extensions.crypt('CmgDev!2026', extensions.gen_salt('bf')), now(),
  '{"provider":"email","providers":["email"]}'::jsonb,
  jsonb_build_object('first_name', u.first_name, 'last_name', u.last_name),
  now(), now(), '', '', '', ''
from (values
  ('00000000-0000-4000-a000-000000000006'::uuid, 'adjuster2@cmg.test', 'Rafael', 'Ortiz'),
  ('00000000-0000-4000-a000-0000000000ff'::uuid, 'ghost@cmg.test',     'No',     'Profile')
) as u(id, email, first_name, last_name);

update public.profiles set role = 'adjuster'
 where id = '00000000-0000-4000-a000-000000000006';

-- The ghost: an account that exists to Auth and does not exist to the application. This
-- is not a contrived state — it is every account between `auth.users` insert and the
-- invite flow writing a role, and every account whose profile was removed by hand.
delete from public.profiles where id = '00000000-0000-4000-a000-0000000000ff';

-- A consent carrying BOTH subjects, for the detach assertions below.
insert into public.consents (id, claim_id, lead_id, email, phone, kind, consent_text)
values (
  '87000000-0000-4000-a000-000000000001',
  '20000000-0000-4000-a000-000000000001', '90000000-0000-4000-a000-000000000001',
  'customer@cmg.test', '407-555-0188', 'email',
  'Marcus Bell agreed to email contact when he submitted the intake form.'
);

-- A consent naming only the lead, so the lead-deletion path has evidence hanging off it
-- that no claim also holds.
insert into public.consents (id, lead_id, email, phone, kind, consent_text)
values (
  '87000000-0000-4000-a000-000000000002', '90000000-0000-4000-a000-000000000001',
  'rosa.delgado@example.test', '407-555-0133', 'sms',
  'Rosa Delgado agreed to be contacted about her roof.'
);

create temp table r3_probe (label text primary key, n int);
grant all on table r3_probe to public;

-- ===========================================================================
-- MAJOR 1 — three-valued logic in the private.* helpers let ANY deactivated or
-- profile-less caller reassign ANY claim.
--
-- private.current_app_role() filters on is_active, so it returns NULL rather than a role
-- for a deactivated account and for a uid with no profiles row. Unwrapped, every helper
-- built on it returned NULL instead of false, and public.reassign_claim()'s guard read
-- `if not private.can_manage_claim(...) then raise`. `not NULL` is NULL, which is not
-- TRUE, so the IF did not fire and control fell through to a SECURITY DEFINER UPDATE
-- owned by a BYPASSRLS role. Reproduced over real GoTrue + PostgREST before this fix:
-- deactivation does not disable the auth.users row, so the account still signs in, reads
-- zero rows from every table — RLS was never the defect — and then changes the assignment
-- of a claim it cannot see, with a 204.
--
-- The helpers are now total. Each block below asserts the whole helper set is false and
-- not NULL, because "denies in a policy" and "denies in an IF" are different properties
-- and only the first was ever true.
-- ===========================================================================

update public.profiles set is_active = false
 where id in ('00000000-0000-4000-a000-000000000001',
              '00000000-0000-4000-a000-000000000002',
              '00000000-0000-4000-a000-000000000003',
              '00000000-0000-4000-a000-000000000004',
              '00000000-0000-4000-a000-000000000005');

-- ---- deactivated OWNER -----------------------------------------------------
set local request.jwt.claims = '{"sub":"00000000-0000-4000-a000-000000000001","role":"authenticated","aal":"aal2"}';
set local role authenticated;

select is_empty(
  $$ select h from (values
       ('is_owner',             private.is_owner()),
       ('is_staff',             private.is_staff()),
       ('is_staff_for_claim',   private.is_staff_for_claim('20000000-0000-4000-a000-000000000001'::uuid)),
       ('is_assigned_adjuster', private.is_assigned_adjuster('20000000-0000-4000-a000-000000000001'::uuid)),
       ('is_claim_customer',    private.is_claim_customer('20000000-0000-4000-a000-000000000001'::uuid)),
       ('is_claim_partner',     private.is_claim_partner('20000000-0000-4000-a000-000000000001'::uuid)),
       ('can_manage_claim',     private.can_manage_claim('20000000-0000-4000-a000-000000000001'::uuid))
     ) as t(h, v) where v is distinct from false $$,
  'every private.* identity helper answers false — not NULL — for a deactivated owner, so a caller that reads nothing also decides nothing: NULL denied inside a policy but survived `if not …` in plpgsql, and that is the difference the whole finding turned on'
);

select ok(
  not private.can_manage_claim('20000000-0000-4000-a000-000000000001'),
  'and `not can_manage_claim(...)` is now TRUE rather than NULL for that caller, which is the exact expression public.reassign_claim() guards on — the assertion this file exists to make, because a NULL here is an IF that never fires'
);

select throws_ok(
  $$ select public.reassign_claim('20000000-0000-4000-a000-000000000001',
                                  '00000000-0000-4000-a000-000000000006') $$,
  '42501'::char(5),
  'only an owner or the assigned adjuster may change the assignment of a claim',
  'a deactivated owner is refused by the RPC: offboarding the highest-privilege account has to remove its authority, not just its visibility'
);

select set_config('request.jwt.claims', '', true);
reset role;

-- ---- deactivated ADJUSTER (the one actually assigned to this claim) --------
set local request.jwt.claims = '{"sub":"00000000-0000-4000-a000-000000000002","role":"authenticated","aal":"aal2"}';
set local role authenticated;

select is_empty(
  $$ select h from (values
       ('is_owner',             private.is_owner()),
       ('is_staff',             private.is_staff()),
       ('is_staff_for_claim',   private.is_staff_for_claim('20000000-0000-4000-a000-000000000001'::uuid)),
       ('is_assigned_adjuster', private.is_assigned_adjuster('20000000-0000-4000-a000-000000000001'::uuid)),
       ('is_claim_customer',    private.is_claim_customer('20000000-0000-4000-a000-000000000001'::uuid)),
       ('is_claim_partner',     private.is_claim_partner('20000000-0000-4000-a000-000000000001'::uuid)),
       ('can_manage_claim',     private.can_manage_claim('20000000-0000-4000-a000-000000000001'::uuid))
     ) as t(h, v) where v is distinct from false $$,
  'the same for a deactivated adjuster who is still named on the claim — the sharpest NULL of the set, because the claims row genuinely matches them and only the role lookup comes back empty'
);

select throws_ok(
  $$ select public.reassign_claim('20000000-0000-4000-a000-000000000001', null) $$,
  '42501'::char(5),
  'only an owner or the assigned adjuster may change the assignment of a claim',
  'and a deactivated adjuster cannot hand their caseload on, which is the move a terminated employee would most plausibly make on the way out'
);

select set_config('request.jwt.claims', '', true);
reset role;

-- ---- deactivated ASSISTANT -------------------------------------------------
set local request.jwt.claims = '{"sub":"00000000-0000-4000-a000-000000000003","role":"authenticated","aal":"aal2"}';
set local role authenticated;

select is_empty(
  $$ select h from (values
       ('is_owner',             private.is_owner()),
       ('is_staff',             private.is_staff()),
       ('is_staff_for_claim',   private.is_staff_for_claim('20000000-0000-4000-a000-000000000001'::uuid)),
       ('is_assigned_adjuster', private.is_assigned_adjuster('20000000-0000-4000-a000-000000000001'::uuid)),
       ('is_claim_customer',    private.is_claim_customer('20000000-0000-4000-a000-000000000001'::uuid)),
       ('is_claim_partner',     private.is_claim_partner('20000000-0000-4000-a000-000000000001'::uuid)),
       ('can_manage_claim',     private.can_manage_claim('20000000-0000-4000-a000-000000000001'::uuid))
     ) as t(h, v) where v is distinct from false $$,
  'the same for a deactivated assistant'
);

select throws_ok(
  $$ select public.reassign_claim('20000000-0000-4000-a000-000000000001',
                                  '00000000-0000-4000-a000-000000000006') $$,
  '42501'::char(5),
  'only an owner or the assigned adjuster may change the assignment of a claim',
  'and a deactivated assistant is refused — a role that is ✖ on assignment in §4 even while active'
);

select set_config('request.jwt.claims', '', true);
reset role;

-- ---- deactivated CUSTOMER --------------------------------------------------
set local request.jwt.claims = '{"sub":"00000000-0000-4000-a000-000000000004","role":"authenticated"}';
set local role authenticated;

select is_empty(
  $$ select h from (values
       ('is_owner',             private.is_owner()),
       ('is_staff',             private.is_staff()),
       ('is_staff_for_claim',   private.is_staff_for_claim('20000000-0000-4000-a000-000000000001'::uuid)),
       ('is_assigned_adjuster', private.is_assigned_adjuster('20000000-0000-4000-a000-000000000001'::uuid)),
       ('is_claim_customer',    private.is_claim_customer('20000000-0000-4000-a000-000000000001'::uuid)),
       ('is_claim_partner',     private.is_claim_partner('20000000-0000-4000-a000-000000000001'::uuid)),
       ('can_manage_claim',     private.can_manage_claim('20000000-0000-4000-a000-000000000001'::uuid))
     ) as t(h, v) where v is distinct from false $$,
  'the same for a deactivated homeowner'
);

select is(
  (select count(*)::int from public.claims),
  0,
  'that homeowner still reads zero claims, which is the control: RLS was sound throughout and the finding was never a read leak — it was a write path that consulted the same helpers through an operator RLS does not use'
);

select throws_ok(
  $$ select public.reassign_claim('20000000-0000-4000-a000-000000000001',
                                  '00000000-0000-4000-a000-000000000006') $$,
  '42501'::char(5),
  'only an owner or the assigned adjuster may change the assignment of a claim',
  'and is now refused by the RPC, where before this fix a homeowner with a closed account could hand any claim in the business to any adjuster in it'
);

select set_config('request.jwt.claims', '', true);
reset role;

-- ---- deactivated PARTNER ---------------------------------------------------
set local request.jwt.claims = '{"sub":"00000000-0000-4000-a000-000000000005","role":"authenticated"}';
set local role authenticated;

select is_empty(
  $$ select h from (values
       ('is_owner',             private.is_owner()),
       ('is_staff',             private.is_staff()),
       ('is_staff_for_claim',   private.is_staff_for_claim('20000000-0000-4000-a000-000000000001'::uuid)),
       ('is_assigned_adjuster', private.is_assigned_adjuster('20000000-0000-4000-a000-000000000001'::uuid)),
       ('is_claim_customer',    private.is_claim_customer('20000000-0000-4000-a000-000000000001'::uuid)),
       ('is_claim_partner',     private.is_claim_partner('20000000-0000-4000-a000-000000000001'::uuid)),
       ('can_manage_claim',     private.can_manage_claim('20000000-0000-4000-a000-000000000001'::uuid))
     ) as t(h, v) where v is distinct from false $$,
  'the same for a deactivated partner rep — a third-party contractor, holding a policy on exactly one projection table and none at all on claims'
);

select throws_ok(
  $$ select public.reassign_claim('20000000-0000-4000-a000-000000000001', null) $$,
  '42501'::char(5),
  'only an owner or the assigned adjuster may change the assignment of a claim',
  'and cannot unassign a claim, which for an outside contractor is the plainest statement of the finding: no policy anywhere granted them this and they could do it anyway'
);

select set_config('request.jwt.claims', '', true);
reset role;

-- ---- GHOST uid: authenticated, with no profiles row at all -----------------
set local request.jwt.claims = '{"sub":"00000000-0000-4000-a000-0000000000ff","role":"authenticated"}';
set local role authenticated;

select is_empty(
  $$ select h from (values
       ('is_owner',             private.is_owner()),
       ('is_staff',             private.is_staff()),
       ('is_staff_for_claim',   private.is_staff_for_claim('20000000-0000-4000-a000-000000000001'::uuid)),
       ('is_assigned_adjuster', private.is_assigned_adjuster('20000000-0000-4000-a000-000000000001'::uuid)),
       ('is_claim_customer',    private.is_claim_customer('20000000-0000-4000-a000-000000000001'::uuid)),
       ('is_claim_partner',     private.is_claim_partner('20000000-0000-4000-a000-000000000001'::uuid)),
       ('can_manage_claim',     private.can_manage_claim('20000000-0000-4000-a000-000000000001'::uuid))
     ) as t(h, v) where v is distinct from false $$,
  'and for a uid that has an Auth account but no profiles row — the state every account passes through before the invite flow assigns it a role, and the one a hand-deleted profile leaves behind'
);

select ok(
  not private.can_manage_claim('20000000-0000-4000-a000-000000000001'),
  'whose guard expression is likewise TRUE rather than NULL, so an identity the application has never heard of is refused rather than waved through'
);

select throws_ok(
  $$ select public.reassign_claim('20000000-0000-4000-a000-000000000001',
                                  '00000000-0000-4000-a000-000000000006') $$,
  '42501'::char(5),
  'only an owner or the assigned adjuster may change the assignment of a claim',
  'and the RPC refuses it'
);

select set_config('request.jwt.claims', '', true);
reset role;

select is(
  (select assigned_adjuster_id from public.claims
    where id = '20000000-0000-4000-a000-000000000001'),
  '00000000-0000-4000-a000-000000000002'::uuid,
  'after six unauthorised attempts the claim is still assigned to the adjuster it started with, so every refusal above was a write that did not happen rather than an error raised after one did'
);

-- ---------------------------------------------------------------------------
-- The existence oracle in the same RPC.
--
-- A missing claim raised 23503 "claim % does not exist" while a permitted one returned
-- quietly, so anyone who could reach the RPC could probe the claims id namespace and
-- learn which ids are real — §7.9 requires the opposite ("generic 404s for unauthorized
-- ids; no existence oracle"). Both outcomes are now the same refusal, byte for byte.
-- ---------------------------------------------------------------------------

update public.profiles set is_active = true
 where id in ('00000000-0000-4000-a000-000000000001',
              '00000000-0000-4000-a000-000000000002',
              '00000000-0000-4000-a000-000000000003',
              '00000000-0000-4000-a000-000000000004',
              '00000000-0000-4000-a000-000000000005');

set local request.jwt.claims = '{"sub":"00000000-0000-4000-a000-000000000001","role":"authenticated","aal":"aal2"}';
set local role authenticated;

select throws_ok(
  $$ select public.reassign_claim('20000000-0000-4000-a000-0000000000aa', null) $$,
  '42501'::char(5),
  'only an owner or the assigned adjuster may change the assignment of a claim',
  'a claim id that does not exist draws the same refusal as one the caller may not touch, so the RPC no longer answers "is this a real claim?" for free'
);

select set_config('request.jwt.claims', '', true);
reset role;

update public.profiles set is_active = false
 where id = '00000000-0000-4000-a000-000000000004';

set local request.jwt.claims = '{"sub":"00000000-0000-4000-a000-000000000004","role":"authenticated"}';
set local role authenticated;

select throws_ok(
  $$ select public.reassign_claim('20000000-0000-4000-a000-0000000000aa', null) $$,
  '42501'::char(5),
  'only an owner or the assigned adjuster may change the assignment of a claim',
  'and an unauthorised caller gets that same refusal for a nonexistent id'
);

select throws_ok(
  $$ select public.reassign_claim('20000000-0000-4000-a000-000000000001', null) $$,
  '42501'::char(5),
  'only an owner or the assigned adjuster may change the assignment of a claim',
  'as for a real one — identical SQLSTATE and identical message, which is what makes the two indistinguishable from outside rather than merely differently worded'
);

select set_config('request.jwt.claims', '', true);
reset role;

update public.profiles set is_active = true
 where id = '00000000-0000-4000-a000-000000000004';

-- ---------------------------------------------------------------------------
-- …and the legitimate assignment paths still work. A guard that refuses everything
-- passes every negative test in this file, which is precisely how MAJOR 2 survived.
-- ---------------------------------------------------------------------------

set local request.jwt.claims = '{"sub":"00000000-0000-4000-a000-000000000002","role":"authenticated","aal":"aal2"}';
set local role authenticated;

select lives_ok(
  $$ select public.reassign_claim('20000000-0000-4000-a000-000000000001',
                                  '00000000-0000-4000-a000-000000000006') $$,
  'the assigned adjuster can still hand their claim to another adjuster, which is the capability §4 grants them ("status / assignment | assigned ✔") and the reason this RPC exists at all'
);

select set_config('request.jwt.claims', '', true);
reset role;

select is(
  (select assigned_adjuster_id from public.claims
    where id = '20000000-0000-4000-a000-000000000001'),
  '00000000-0000-4000-a000-000000000006'::uuid,
  'and the hand-off actually landed, so the lives_ok above is a write that happened rather than a statement that matched nothing'
);

set local request.jwt.claims = '{"sub":"00000000-0000-4000-a000-000000000006","role":"authenticated","aal":"aal2"}';
set local role authenticated;

select throws_ok(
  $$ select public.reassign_claim('20000000-0000-4000-a000-000000000002', null) $$,
  '42501'::char(5),
  'only an owner or the assigned adjuster may change the assignment of a claim',
  'an ACTIVE adjuster is still confined to their own caseload: the coalesce made the helpers total, it did not make them permissive'
);

select lives_ok(
  $$ select public.reassign_claim('20000000-0000-4000-a000-000000000001',
                                  '00000000-0000-4000-a000-000000000002') $$,
  'and the adjuster now holding the claim can hand it back'
);

select set_config('request.jwt.claims', '', true);
reset role;

set local request.jwt.claims = '{"sub":"00000000-0000-4000-a000-000000000001","role":"authenticated","aal":"aal2"}';
set local role authenticated;

select lives_ok(
  $$ select public.reassign_claim('20000000-0000-4000-a000-000000000001', null) $$,
  'an active owner can unassign a claim, returning it to the intake queue'
);

select ok(
  (select assigned_adjuster_id is null from public.claims
    where id = '20000000-0000-4000-a000-000000000001'),
  'and the claim really is unassigned afterwards'
);

select throws_ok(
  $$ select public.reassign_claim('20000000-0000-4000-a000-000000000001',
                                  '00000000-0000-4000-a000-000000000004') $$,
  '23514'::char(5), null::text,
  'assignment to a non-adjuster is still refused, so making the authorisation check total did not disturb the check on the destination'
);

select throws_ok(
  $$ select public.reassign_claim(null, null) $$,
  '22023'::char(5), null::text,
  'and a null claim id is still a bad-argument error rather than an authorisation one, which keeps a caller mistake distinguishable from a caller being refused'
);

select lives_ok(
  $$ select public.reassign_claim('20000000-0000-4000-a000-000000000001',
                                  '00000000-0000-4000-a000-000000000002') $$,
  'the owner reassigns the claim back to Dana Reyes, restoring the fixture for everything below'
);

select set_config('request.jwt.claims', '', true);
reset role;

-- ===========================================================================
-- MAJOR 2 — guard_document_claim_immutable() refused the §4/§6 intake re-parent
-- for every caller in the system, including the service role that performs it.
--
-- §4 defines both `claims/{claim_id}/…` and `intake/{intake_uuid}/…` "(re-parented on
-- accept)", and §6's public intake writes files to `intake/…` with documents rows against
-- them. Accept moves the object and updates storage_path — which this guard refused
-- unconditionally, with no `auth.uid() is null` escape of the kind its sibling
-- guard_consent_immutable() already carried. The only remaining implementation was delete
-- + re-insert, which enqueues the OLD intake path for deletion (racing the bucket move),
-- discards the documents.id, and writes a delete and a create into audit_log where a
-- re-parent belongs.
-- ===========================================================================

insert into public.documents (id, claim_id, storage_path, original_name, kind, mime, size_bytes, visibility)
values (
  '51000000-0000-4000-a000-000000000001', '20000000-0000-4000-a000-000000000001',
  'intake/aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee/6f2b1c40-0000-4000-a000-000000000001.pdf',
  'intake-declarations.pdf', 'declarations', 'application/pdf', 284419, 'customer'
);

insert into r3_probe values
  ('cleanup_queue_before', (select count(*)::int from public.storage_cleanup_queue));

-- Runs as `postgres` with no request.jwt.claims set, i.e. auth.uid() is null — the
-- service-role context the accept flow executes in.
select lives_ok(
  $$ update public.documents
        set storage_path = 'claims/20000000-0000-4000-a000-000000000001/6f2b1c40-0000-4000-a000-000000000001.pdf'
      where id = '51000000-0000-4000-a000-000000000001' $$,
  'the service role can re-parent an intake upload onto its claim, which §4 and §6 both require on accept and which was impossible for every caller before this fix'
);

select is(
  (select storage_path from public.documents where id = '51000000-0000-4000-a000-000000000001'),
  'claims/20000000-0000-4000-a000-000000000001/6f2b1c40-0000-4000-a000-000000000001.pdf',
  'the row kept its id and simply changed path, so every claim_events and audit_log reference keyed on documents.id still resolves — which delete-and-recreate would have broken'
);

select is(
  (select count(*)::int from public.storage_cleanup_queue),
  (select n from r3_probe where label = 'cleanup_queue_before'),
  'and nothing was queued for storage cleanup, so the old intake object is not scheduled for deletion in a race with the move that is currently relying on it'
);

select isnt_empty(
  $$ select 1 from public.audit_log
      where entity = 'documents'
        and entity_id = '51000000-0000-4000-a000-000000000001'
        and action = 'documents.update' $$,
  'the trail records one update to one document rather than a deletion followed by an unrelated creation, which is what an auditor reading the accept step needs it to say'
);

select throws_ok(
  $$ update public.documents
        set storage_path = 'claims/20000000-0000-4000-a000-000000000001/deadbeef-0000-4000-a000-000000000001.pdf'
      where id = '51000000-0000-4000-a000-000000000001' $$,
  '42501'::char(5), null::text,
  'arbitrary re-pointing is still refused even for the service role: the escape is out of `intake/` only, so a document that has been accepted onto a claim is pinned to its object exactly as before'
);

insert into public.documents (id, claim_id, storage_path, original_name, kind, mime, size_bytes, visibility)
values (
  '51000000-0000-4000-a000-000000000002', '20000000-0000-4000-a000-000000000001',
  'intake/aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee/6f2b1c40-0000-4000-a000-000000000002.pdf',
  'intake-lor.pdf', 'lor_signed', 'application/pdf', 512044, 'customer'
);

select throws_ok(
  $$ update public.documents
        set storage_path = 'claims/20000000-0000-4000-a000-000000000002/6f2b1c40-0000-4000-a000-000000000002.pdf'
      where id = '51000000-0000-4000-a000-000000000002' $$,
  '42501'::char(5), null::text,
  'and an intake document can only be re-parented onto ITS OWN claim: the destination is checked against old.claim_id, so the escape cannot be used to walk a signed letter of representation onto a file that never had one'
);

select throws_ok(
  $$ update public.documents set claim_id = '20000000-0000-4000-a000-000000000002'
      where id = '51000000-0000-4000-a000-000000000002' $$,
  '42501'::char(5), null::text,
  'claim_id itself remains immutable for the service role too — the LOR-planting hole this guard exists for stays shut for every caller without exception'
);

set local request.jwt.claims = '{"sub":"00000000-0000-4000-a000-000000000001","role":"authenticated","aal":"aal2"}';
set local role authenticated;

select throws_ok(
  $$ update public.documents
        set storage_path = 'claims/20000000-0000-4000-a000-000000000001/6f2b1c40-0000-4000-a000-000000000002.pdf'
      where id = '51000000-0000-4000-a000-000000000002' $$,
  '42501'::char(5), null::text,
  'an owner in a real session cannot perform the re-parent: the accept flow runs server-side as the service role, so the escape is scoped to a caller with no JWT rather than to a privileged role'
);

select throws_ok(
  $$ update public.documents set claim_id = '20000000-0000-4000-a000-000000000002'
      where id = '51000000-0000-4000-a000-000000000001' $$,
  '42501'::char(5), null::text,
  'nor move a document between claims'
);

select set_config('request.jwt.claims', '', true);
reset role;

set local request.jwt.claims = '{"sub":"00000000-0000-4000-a000-000000000002","role":"authenticated","aal":"aal2"}';
set local role authenticated;

select throws_ok(
  $$ update public.documents
        set storage_path = 'claims/20000000-0000-4000-a000-000000000001/6f2b1c40-0000-4000-a000-000000000003.pdf'
      where id = '50000000-0000-4000-a000-000000000002' $$,
  '42501'::char(5), null::text,
  'and neither can the assigned adjuster re-point an ordinary document at another object, which is the rule the guard originally stated and which the narrowing left untouched'
);

select set_config('request.jwt.claims', '', true);
reset role;

delete from public.documents
 where id in ('51000000-0000-4000-a000-000000000001', '51000000-0000-4000-a000-000000000002');

-- ===========================================================================
-- MINOR 1 — a LIVE consent could be cut loose from its subject.
--
-- Round 2 opened claim_id/lead_id to NULL so the foreign keys' own `on delete set null`
-- could run. That was wider than the foreign key needed: an owner could detach a consent
-- from a claim that still exists, and a customer or assigned adjuster could null the
-- lead_id on a consent carrying both — leaving a live claim with nothing on it to show
-- consent was collected, which is the precise link a TCPA dispute turns on. The detach is
-- now conditioned on the subject genuinely being gone.
-- ===========================================================================

set local request.jwt.claims = '{"sub":"00000000-0000-4000-a000-000000000001","role":"authenticated","aal":"aal2"}';
set local role authenticated;

select throws_ok(
  $$ update public.consents set claim_id = null
      where id = '80000000-0000-4000-a000-000000000001' $$,
  '42501'::char(5), null::text,
  'an owner cannot detach a consent from a claim that still exists: the evidence is only evidence while it names the file it was collected for, and nothing in §4 gives anyone a reason to sever that by hand'
);

select throws_ok(
  $$ update public.consents set claim_id = '20000000-0000-4000-a000-000000000002'
      where id = '80000000-0000-4000-a000-000000000001' $$,
  '42501'::char(5), null::text,
  'and still cannot re-point it at another claim, so narrowing the detach did not disturb the rule round 2 established'
);

select set_config('request.jwt.claims', '', true);
reset role;

set local request.jwt.claims = '{"sub":"00000000-0000-4000-a000-000000000002","role":"authenticated","aal":"aal2"}';
set local role authenticated;

-- Deliberately lead_id and not claim_id. Nulling claim_id is already refused for an
-- adjuster by the consents UPDATE policy's WITH CHECK — the post-update row has
-- claim_id null, so none of that policy's branches match them — which means asserting it
-- here would pass with or without this fix and prove nothing about the guard. Nulling
-- lead_id leaves claim_id in place, so the row still satisfies the policy and the trigger
-- is the only thing that can refuse it.
select throws_ok(
  $$ update public.consents set lead_id = null
      where id = '87000000-0000-4000-a000-000000000001' $$,
  '42501'::char(5), null::text,
  'the assigned adjuster is refused the same detach on the other subject — this is a property of the record, not a question of rank'
);

select set_config('request.jwt.claims', '', true);
reset role;

set local request.jwt.claims = '{"sub":"00000000-0000-4000-a000-000000000004","role":"authenticated"}';
set local role authenticated;

select throws_ok(
  $$ update public.consents set lead_id = null
      where id = '87000000-0000-4000-a000-000000000001' $$,
  '42501'::char(5), null::text,
  'and the homeowner cannot quietly strip the lead half of a consent that carries both subjects, which would have left the record naming only one of the two things it was collected against'
);

select lives_ok(
  $$ update public.consents set withdrawn_at = now()
      where id = '87000000-0000-4000-a000-000000000001' $$,
  'while the one change a homeowner is actually entitled to make — withdrawing — still works, so the tightening closed a detach rather than the portal''s consent controls'
);

select set_config('request.jwt.claims', '', true);
reset role;

set local request.jwt.claims = '{"sub":"00000000-0000-4000-a000-000000000001","role":"authenticated","aal":"aal2"}';
set local role authenticated;

select lives_ok(
  $$ delete from public.leads where id = '90000000-0000-4000-a000-000000000001' $$,
  'an owner can still delete a lead carrying consents: the foreign key performs its `set null` in a later command than the delete, so by the time the guard looks the subject is genuinely gone and the `not exists` condition holds'
);

select set_config('request.jwt.claims', '', true);
reset role;

select is(
  (select count(*)::int from public.consents
    where id in ('87000000-0000-4000-a000-000000000001', '87000000-0000-4000-a000-000000000002')
      and lead_id is null),
  2,
  'both consents that named that lead survived it, detached rather than destroyed — the behaviour round 2 introduced and the reason the condition is "subject is gone" rather than "detaching is forbidden"'
);

select is(
  (select consent_text from public.consents where id = '87000000-0000-4000-a000-000000000002'),
  'Rosa Delgado agreed to be contacted about her roof.',
  'and the snapshot is byte-for-byte intact, so what the detachment removed is a link to a deleted row and not one character of the evidence'
);

-- ===========================================================================
-- MINOR 2 — documents.storage_path was not tied to documents.claim_id.
--
-- An adjuster could file a wholly legal row on their own claim while pointing
-- storage_path at another claim's prefix. No read follows the path today —
-- private.can_read_claim_object() authorises by looking the path back up in this table —
-- so it was latent rather than live. It is also exactly the shape that becomes live the
-- day a caller trusts the path instead of the row.
-- ===========================================================================

set local request.jwt.claims = '{"sub":"00000000-0000-4000-a000-000000000002","role":"authenticated","aal":"aal2"}';
set local role authenticated;

select throws_ok(
  $$ insert into public.documents (claim_id, storage_path, original_name, kind, mime, size_bytes, uploaded_by, visibility)
     values ('20000000-0000-4000-a000-000000000001',
             'claims/20000000-0000-4000-a000-000000000002/b1b1b1b1-0000-4000-a000-000000000001.pdf',
             'mislabelled.pdf', 'photo', 'application/pdf', 4096,
             '00000000-0000-4000-a000-000000000002', 'internal') $$,
  '23514'::char(5), null::text,
  'a documents row and the object it names must agree about which claim they belong to, so a row on one claim can no longer carry a path under another claim''s prefix'
);

select lives_ok(
  $$ insert into public.documents (claim_id, storage_path, original_name, kind, mime, size_bytes, uploaded_by, visibility)
     values ('20000000-0000-4000-a000-000000000001',
             'claims/20000000-0000-4000-a000-000000000001/b1b1b1b1-0000-4000-a000-000000000002.pdf',
             'correctly-parented.pdf', 'photo', 'application/pdf', 4096,
             '00000000-0000-4000-a000-000000000002', 'internal') $$,
  'while the correctly parented path this rule describes is accepted, which is every upload the server actions actually produce'
);

select set_config('request.jwt.claims', '', true);
reset role;

select lives_ok(
  $$ insert into public.documents (claim_id, storage_path, original_name, kind, mime, size_bytes, visibility)
     values ('20000000-0000-4000-a000-000000000001',
             'intake/bbbbbbbb-cccc-4ddd-8eee-ffffffffffff/b1b1b1b1-0000-4000-a000-000000000003.pdf',
             'pre-accept.pdf', 'declarations', 'application/pdf', 4096, 'customer') $$,
  'and the `intake/` prefix is still accepted, because a pre-accept upload has no claim folder yet — the constraint has to describe both of the path shapes §4 defines or it would forbid the intake flow it is meant to protect'
);

select isnt_empty(
  $$ select 1 from pg_constraint
      where conrelid = 'public.documents'::regclass
        and conname = 'documents_storage_path_matches_claim'
        and contype = 'c' $$,
  'the rule is a table constraint rather than a convention in the upload code, so it also binds the service role and any future migration that writes this table directly'
);

delete from public.documents where original_name in ('correctly-parented.pdf', 'pre-accept.pdf');

-- ===========================================================================
-- MINOR 3 — claim_ref was caller-supplied when non-blank, and unconstrained.
--
-- claims_before_insert() generates a reference only when the column arrives blank, so a
-- caller supplying one kept it verbatim; an owner inserted 'not-a-cmg-ref'. claim_ref is
-- the display identity of a claim in every email, portal header and partner summary, so a
-- malformed or spoofed one is a correspondence problem rather than an untidy row.
-- ===========================================================================

set local request.jwt.claims = '{"sub":"00000000-0000-4000-a000-000000000001","role":"authenticated","aal":"aal2"}';
set local role authenticated;

select throws_ok(
  $$ insert into public.claims (claim_ref, property_street, property_city, property_zip,
                                carrier, policy_number, carrier_tenure, loss_date, cause, description)
     values ('not-a-cmg-ref', '1 Test St', 'Orlando', '32801', 'Citizens', 'POL-1',
             'lt_1_year', date '2026-01-01', 'wind', 'free-text reference') $$,
  '23514'::char(5), null::text,
  'an arbitrary string is no longer accepted as a claim reference'
);

select throws_ok(
  $$ insert into public.claims (claim_ref, property_street, property_city, property_zip,
                                carrier, policy_number, carrier_tenure, loss_date, cause, description)
     values ('CMG-26-0001', '1 Test St', 'Orlando', '32801', 'Citizens', 'POL-1',
             'lt_1_year', date '2026-01-01', 'wind', 'two-digit year') $$,
  '23514'::char(5), null::text,
  'nor a two-digit year, which would sort and read as a different decade in every list the reference appears in'
);

select throws_ok(
  $$ insert into public.claims (claim_ref, property_street, property_city, property_zip,
                                carrier, policy_number, carrier_tenure, loss_date, cause, description)
     values ('CMG-2026-041', '1 Test St', 'Orlando', '32801', 'Citizens', 'POL-1',
             'lt_1_year', date '2026-01-01', 'wind', 'three-digit sequence') $$,
  '23514'::char(5), null::text,
  'nor a short sequence, so CMG-2026-041 cannot sit alongside CMG-2026-0041 and be mistaken for it'
);

select throws_ok(
  $$ insert into public.claims (claim_ref, property_street, property_city, property_zip,
                                carrier, policy_number, carrier_tenure, loss_date, cause, description)
     values ('cmg-2026-0001', '1 Test St', 'Orlando', '32801', 'Citizens', 'POL-1',
             'lt_1_year', date '2026-01-01', 'wind', 'lowercase prefix') $$,
  '23514'::char(5), null::text,
  'and case is part of the shape, so a lowercase near-duplicate of an existing reference cannot be created alongside it'
);

select lives_ok(
  $$ insert into public.claims (id, property_street, property_city, property_zip,
                                carrier, policy_number, carrier_tenure, loss_date, cause, description)
     values ('22000000-0000-4000-a000-000000000001', '2 Test St', 'Orlando', '32801', 'Citizens', 'POL-2',
             'lt_1_year', date '2026-01-01', 'wind', 'generated reference') $$,
  'a claim inserted without a reference still gets one from the per-year counter, so the constraint binds the caller-supplied path without touching the generated one'
);

select matches(
  (select claim_ref from public.claims where id = '22000000-0000-4000-a000-000000000001'),
  '^CMG-\d{4}-\d{4}$',
  'and what public.next_claim_ref() produces satisfies the same rule — the constraint is the shape the generator already emits, which is what keeps generated and supplied references indistinguishable'
);

select lives_ok(
  $$ insert into public.claims (id, claim_ref, property_street, property_city, property_zip,
                                carrier, policy_number, carrier_tenure, loss_date, cause, description)
     values ('22000000-0000-4000-a000-000000000002', 'CMG-2019-0007', '3 Test St', 'Orlando', '32801',
             'Citizens', 'POL-3', 'lt_1_year', date '2019-03-04', 'wind', 'historical import') $$,
  'and a well-formed reference supplied by the caller is still accepted, which is what an import of historical files needs in order to keep the references those files already carry'
);

select set_config('request.jwt.claims', '', true);
reset role;

delete from public.claims where id in ('22000000-0000-4000-a000-000000000001',
                                       '22000000-0000-4000-a000-000000000002');

-- ===========================================================================
-- COVERAGE GAP — claimants_one_primary_per_claim_idx was asserted nowhere.
--
-- Dropping the index left all 291 assertions green. It is not cosmetic:
-- refresh_claim_partner_summary() picks homeowner_name with
-- `order by is_primary desc, created_at asc limit 1`, so two primary claimants make the
-- name a partner reads off their portal depend on row order.
-- ===========================================================================

select has_index(
  'public'::name, 'claimants'::name, 'claimants_one_primary_per_claim_idx'::name,
  'the one-primary-claimant index exists — it is load-bearing for the partner projection, and nothing in the suite noticed when it was removed'
);

select index_is_unique(
  'public'::name, 'claimants'::name, 'claimants_one_primary_per_claim_idx'::name,
  'and it is unique, which is what makes it a constraint rather than an access path'
);

-- to_regclass, not a ::regclass cast: a cast raises when the index is absent, which
-- aborts the transaction and takes the four assertions below down with it — so removing
-- the index would have hidden the very behaviour they exist to pin. to_regclass returns
-- null instead, and this assertion simply fails.
select matches(
  (select pg_get_indexdef(i.indexrelid)
     from pg_index i
    where i.indexrelid = to_regclass('public.claimants_one_primary_per_claim_idx')),
  'WHERE is_primary',
  'and partial on is_primary, so it bounds primaries to one per claim while leaving any number of additional claimants on the same file — §4 has second homeowners, and a plain unique index on claim_id would have forbidden them'
);

select throws_ok(
  $$ insert into public.claimants (claim_id, first_name, last_name, email, initials, is_primary)
     values ('20000000-0000-4000-a000-000000000001', 'Second', 'Primary',
             'second.primary@example.test', 'SP', true) $$,
  '23505'::char(5), null::text,
  'a second primary claimant on a claim that already has one is refused'
);

select lives_ok(
  $$ insert into public.claimants (claim_id, first_name, last_name, email, initials, is_primary)
     values ('20000000-0000-4000-a000-000000000001', 'Third', 'Party',
             'third.party@example.test', 'TP', false) $$,
  'while a further non-primary claimant is accepted, which is the ordinary case of a co-owner or a spouse on the policy'
);

select throws_ok(
  $$ update public.claimants set is_primary = true
      where id = '30000000-0000-4000-a000-000000000002' $$,
  '23505'::char(5), null::text,
  'and promoting an existing non-primary while a primary stands is refused too, so the invariant cannot be broken one statement after it was satisfied'
);

select is(
  (select homeowner_name from public.claim_partner_summaries
    where claim_id = '20000000-0000-4000-a000-000000000001'),
  'Marcus Bell',
  'which is why it matters: the name a partner reads is chosen by `order by is_primary desc, created_at asc limit 1`, so with two primaries on the file it would depend on row order rather than on who the homeowner is'
);

delete from public.claimants where email = 'third.party@example.test';

select * from finish();
rollback;
