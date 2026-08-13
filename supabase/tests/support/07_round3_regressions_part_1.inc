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
