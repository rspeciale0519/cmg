-- ---------------------------------------------------------------------------
-- Fixtures
-- ---------------------------------------------------------------------------

-- Alicia Bell already exists as the second claimant on claim 1 (seed), with user_id null.
-- Round 4's consent finding is only reachable once a co-claimant has an account, which is
-- exactly what §6's accept-and-invite flow gives every claimant on the file.
insert into auth.users (
  instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
  raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
  confirmation_token, recovery_token, email_change_token_new, email_change
)
values (
  '00000000-0000-0000-0000-000000000000', '00000000-0000-4000-a000-0000000000a1',
  'authenticated', 'authenticated', 'alicia.bell@example.test',
  extensions.crypt('CmgDev!2026', extensions.gen_salt('bf')), now(),
  '{"provider":"email","providers":["email"]}'::jsonb,
  jsonb_build_object('first_name', 'Alicia', 'last_name', 'Bell'),
  now(), now(), '', '', '', ''
);

update public.profiles set role = 'customer' where id = '00000000-0000-4000-a000-0000000000a1';
update public.claimants set user_id = '00000000-0000-4000-a000-0000000000a1'
 where id = '30000000-0000-4000-a000-000000000002';

-- A consent of Alicia's own, so the narrowing below can be shown to be party-scoped
-- rather than simply "co-claimants get nothing". Deliberately stored with different case
-- and a trailing space from the claimants row it belongs to: the intake form writes
-- consents.email verbatim while public.normalize_claimant_email() lowercases and trims
-- claimants.email, so the two are not guaranteed to agree byte for byte and the helper
-- must not depend on their doing so.
insert into public.consents (id, claim_id, email, phone, kind, consent_text)
values (
  '80000000-0000-4000-a000-0000000000a1', '20000000-0000-4000-a000-000000000001',
  ' ALICIA.BELL@example.test ', '407-555-0189', 'email',
  'Alicia Bell agreed to email contact when she was added to the claim.'
);

-- A claim still at lor_sent, carrying a signed LOR. This is the control for the
-- documents_delete rule: before the gate the document is an ordinary file and deleting it
-- is a legitimate correction; after the gate it is the evidence a completed transition
-- rests on. Seated directly at lor_sent from a service context, which is the historical
-- import path public.claims_before_insert() allows.
insert into public.claims (
  id, claim_ref, status, property_street, property_city, property_state, property_zip,
  carrier, policy_number, carrier_tenure, loss_date, cause, description,
  assigned_adjuster_id
)
values (
  '20000000-0000-4000-a000-0000000000b1', 'CMG-2026-9001', 'lor_sent',
  '5 Pregate Way', 'Oviedo', 'Florida', '32765',
  'Citizens Property Insurance', 'FL-CPI-9001', 'lt_1_year',
  date '2026-04-01', 'wind', 'Claim held at lor_sent for the documents_delete control.',
  '00000000-0000-4000-a000-000000000002'
);

insert into public.documents (id, claim_id, storage_path, original_name, kind, mime, size_bytes, visibility)
values (
  '50000000-0000-4000-a000-0000000000b1', '20000000-0000-4000-a000-0000000000b1',
  'claims/20000000-0000-4000-a000-0000000000b1/b1b1b1b1-0000-4000-a000-0000000000b1.pdf',
  'lor-signed-pregate.pdf', 'lor_signed', 'application/pdf', 400000, 'customer'
);

-- A second fixture claim, used only to prove the owner's cascade still reaches documents
-- once documents_delete has a rule on it.
insert into public.claims (
  id, claim_ref, status, property_street, property_city, property_state, property_zip,
  carrier, policy_number, carrier_tenure, loss_date, cause, description,
  assigned_adjuster_id
)
values (
  '20000000-0000-4000-a000-0000000000b2', 'CMG-2026-9002', 'settled',
  '9 Cascade Ct', 'Oviedo', 'Florida', '32765',
  'Universal Property & Casualty', 'UPC-9002', 'lt_1_year',
  date '2026-04-02', 'wind', 'Claim used for the cascade control.',
  '00000000-0000-4000-a000-000000000002'
);

insert into public.documents (id, claim_id, storage_path, original_name, kind, mime, size_bytes, visibility)
values (
  '50000000-0000-4000-a000-0000000000b2', '20000000-0000-4000-a000-0000000000b2',
  'claims/20000000-0000-4000-a000-0000000000b2/b2b2b2b2-0000-4000-a000-0000000000b2.pdf',
  'lor-signed-cascade.pdf', 'lor_signed', 'application/pdf', 400000, 'customer'
);

-- Pre-accept intake uploads, one per re-parent assertion, so no assertion depends on the
-- path another one left behind.
insert into public.documents (id, claim_id, storage_path, original_name, kind, mime, size_bytes, visibility)
values
  ('50000000-0000-4000-a000-0000000000c1', '20000000-0000-4000-a000-000000000001',
   'intake/cccccccc-1111-4111-8111-111111111111/c1c1c1c1-0000-4000-a000-0000000000c1.pdf',
   'intake-c1.pdf', 'other', 'application/pdf', 1000, 'internal'),
  ('50000000-0000-4000-a000-0000000000c2', '20000000-0000-4000-a000-000000000001',
   'intake/cccccccc-2222-4222-8222-222222222222/c2c2c2c2-0000-4000-a000-0000000000c2.pdf',
   'intake-c2.pdf', 'other', 'application/pdf', 1000, 'internal'),
  ('50000000-0000-4000-a000-0000000000c3', '20000000-0000-4000-a000-000000000001',
   'intake/cccccccc-3333-4333-8333-333333333333/c3c3c3c3-0000-4000-a000-0000000000c3.pdf',
   'intake-c3.pdf', 'other', 'application/pdf', 1000, 'internal'),
  ('50000000-0000-4000-a000-0000000000c4', '20000000-0000-4000-a000-000000000001',
   'intake/cccccccc-4444-4444-8444-444444444444/c4c4c4c4-0000-4000-a000-0000000000c4.pdf',
   'intake-c4.pdf', 'other', 'application/pdf', 1000, 'internal');

-- A staff account to be promoted by the invite flow, and a company with no reps.
insert into auth.users (
  instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
  raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
  confirmation_token, recovery_token, email_change_token_new, email_change
)
values (
  '00000000-0000-0000-0000-000000000000', '00000000-0000-4000-a000-0000000000d1',
  'authenticated', 'authenticated', 'invitee@cmg.test',
  extensions.crypt('CmgDev!2026', extensions.gen_salt('bf')), now(),
  '{"provider":"email","providers":["email"]}'::jsonb, '{}'::jsonb,
  now(), now(), '', '', '', ''
);

insert into public.partner_companies (id, name)
values ('10000000-0000-4000-a000-0000000000e1', 'Repless Roofing LLC');

create temp table r4_probe (label text primary key, v boolean);
grant all on table r4_probe to public;

-- ===========================================================================
-- Minor 1 — "is this CMG's own server?" is a question about the role claim
--
-- The old test, `auth.uid() is null`, is true of a bare connection and false of a
-- service-role JWT, and only the second is what runs in production. Every assertion in
-- this section that says "service" therefore sets a JWT that carries BOTH a sub and
-- role=service_role — the shape Supabase's own service key has — because a test that
-- connects without a JWT cannot tell the old predicate from the new one.
--
-- The subject on every one of those tokens is the ASSISTANT, deliberately, and this is
-- not cosmetic. Two of the guards below fall through to `select role from profiles where
-- id = auth.uid()` when the service test fails, and an owner's subject passes that lookup
-- on its own merits — so a service-role token carrying the OWNER's sub is admitted by the
-- broken predicate and the fixed one alike, and an assertion written that way proves
-- nothing. Mutation-testing caught exactly that: reverting
-- public.guard_profile_privileges() to `auth.uid() is null` was survived by an
-- owner-subject token and is killed by this one. A non-owner subject is also the honest
-- case — the invite flow runs as the service role on behalf of whoever is accepting, and
-- that person is by definition not yet staff.
-- ===========================================================================

select is(
  private.is_service_context(), true,
  'a bare connection with no request.jwt.claims at all is a service context — migrations and the seed run here, and this is the only case the old auth.uid()-is-null test got right'
);

set local request.jwt.claims = '{"sub":"00000000-0000-4000-a000-000000000003","role":"service_role"}';
set local role service_role;

select is(
  private.is_service_context(), true,
  'and so is a service-role JWT that carries a subject, which is the case the old test called an ordinary user session — this single assertion is the one that separates the two predicates'
);

select set_config('request.jwt.claims', '', true);
reset role;

set local request.jwt.claims = '{"sub":"00000000-0000-4000-a000-000000000001","role":"authenticated","aal":"aal2"}';
set local role authenticated;

select is(
  private.is_service_context(), false,
  'an owner session is not a service context, so widening the test to read the role claim conceded nothing: the highest-privilege user session still fails it'
);

select set_config('request.jwt.claims', '', true);
reset role;

-- The degenerate token that makes the coalesce load-bearing, and the only one that does.
-- With a role claim present the comparison is already two-valued; with no claims at all
-- the `auth.uid() is null` arm is TRUE and short-circuits the OR. It is exactly a token
-- carrying a subject and NO role claim that leaves auth.role() NULL while auth.uid() is
-- non-null — and then an uncoalesced `auth.role() = 'service_role'` yields `NULL or FALSE`
-- = NULL, which every `if not <guard>` below treats as "do not raise" and lets the caller
-- straight through. Asserting this under an ordinary authenticated token would have proved
-- nothing: it returns false either way.
set local request.jwt.claims = '{"sub":"00000000-0000-4000-a000-000000000001"}';

select isnt(
  private.is_service_context(), null,
  'a token carrying a subject but no role claim gets a real answer rather than NULL — this is the one input that distinguishes the coalesced predicate from the bare comparison, and a NULL here is the exact three-valued failure that has produced a major in three consecutive rounds'
);

select is(
  private.is_service_context(), false,
  'and the answer is false: no role claim is not a service role, so the degenerate token is denied rather than admitted'
);

select set_config('request.jwt.claims', '', true);

set local request.jwt.claims = '{"sub":"00000000-0000-4000-a000-00000000dead","role":"authenticated"}';
set local role authenticated;

select is(
  private.is_service_context(), false,
  'a subject with no profiles row at all — the state every account occupies between the auth insert and the invite writing a role — is false too, not NULL: this is the caller shape that turned the private.* helpers three-valued in round 3'
);

select set_config('request.jwt.claims', '', true);
reset role;

-- ===========================================================================
-- Minor 1 (cont.) — the §6 intake re-parent, which is the live tripwire
-- ===========================================================================

set local request.jwt.claims = '{"sub":"00000000-0000-4000-a000-000000000003","role":"service_role"}';
set local role service_role;

select lives_ok(
  $$ update public.documents
        set storage_path = 'claims/20000000-0000-4000-a000-000000000001/c1c1c1c1-0000-4000-a000-0000000000c1.pdf'
      where id = '50000000-0000-4000-a000-0000000000c1' $$,
  'the §6 accept re-parents an intake upload onto its claim under a service-role JWT — refused before this round, so the launch flow had no legal implementation in production while passing every test that connected without one'
);

select is(
  (select storage_path from public.documents where id = '50000000-0000-4000-a000-0000000000c1'),
  'claims/20000000-0000-4000-a000-000000000001/c1c1c1c1-0000-4000-a000-0000000000c1.pdf',
  'and the move actually landed, so the lives_ok above is not a statement that silently did nothing'
);

select throws_ok(
  $$ update public.documents
        set storage_path = 'claims/20000000-0000-4000-a000-000000000002/x.pdf'
      where id = '50000000-0000-4000-a000-0000000000c2' $$,
  '42501'::char(5), null::text,
  'the escape is still only into the row''s OWN claim prefix: even the service role cannot re-parent an intake upload onto a different claim, which is the route by which a signed LOR would be planted on a file that never had one'
);

select throws_ok(
  $$ update public.documents
        set storage_path = 'claims/20000000-0000-4000-a000-000000000001/moved.pdf'
      where id = '50000000-0000-4000-a000-000000000002' $$,
  '42501'::char(5), null::text,
  'and it is still only OUT of intake/: a document already accepted onto a claim stays pinned to its object for the service role too'
);

select set_config('request.jwt.claims', '', true);
reset role;

set local request.jwt.claims = '{"sub":"00000000-0000-4000-a000-000000000001","role":"authenticated","aal":"aal2"}';
set local role authenticated;

select throws_ok(
  $$ update public.documents
        set storage_path = 'claims/20000000-0000-4000-a000-000000000001/c3.pdf'
      where id = '50000000-0000-4000-a000-0000000000c3' $$,
  '42501'::char(5), null::text,
  'an owner session cannot take the intake escape — reading the role claim widened the guard to the service role and to nobody else'
);

select set_config('request.jwt.claims', '', true);
reset role;

set local request.jwt.claims = '{"sub":"00000000-0000-4000-a000-000000000002","role":"authenticated","aal":"aal2"}';
set local role authenticated;

select throws_ok(
  $$ update public.documents
        set storage_path = 'claims/20000000-0000-4000-a000-000000000001/c4.pdf'
      where id = '50000000-0000-4000-a000-0000000000c4' $$,
  '42501'::char(5), null::text,
  'nor can the assigned adjuster, who passes the documents policy on the row and is refused one level down by the guard'
);

select set_config('request.jwt.claims', '', true);
reset role;

-- ===========================================================================
-- Minor 1 (cont.) — the other four guards that shared the fragile test
-- ===========================================================================

set local request.jwt.claims = '{"sub":"00000000-0000-4000-a000-000000000003","role":"service_role"}';
set local role service_role;

select lives_ok(
  $$ update public.consents set consent_text = 'Corrected snapshot text.'
      where id = '80000000-0000-4000-a000-000000000001' $$,
  'the out-of-band consent correction public.guard_consent_immutable() promises the service role actually works under a service-role JWT'
);

select lives_ok(
  $$ update public.profiles set role = 'adjuster'
      where id = '00000000-0000-4000-a000-0000000000d1' $$,
  'and the invite flow can assign the role §4 says only it may assign — public.guard_profile_privileges() had the same fragile test, so accepting an invite would have been refused at launch'
);

select lives_ok(
  $$ insert into public.claims (
       claim_ref, status, property_street, property_city, property_state, property_zip,
       carrier, policy_number, carrier_tenure, loss_date, cause, description)
     values ('CMG-2026-9003', 'filed', '11 Import Rd', 'Oviedo', 'Florida', '32765',
             'Citizens Property Insurance', 'FL-CPI-9003', 'lt_1_year',
             date '2026-01-05', 'wind', 'Historical record imported at its true stage.') $$,
  'and a historical claim can still be imported at its true stage rather than being forced to start at new_intake — the exemption public.claims_before_insert() documents, now reachable by the caller that needs it'
);

select lives_ok(
  $$ update public.claims set partner_company_id = '10000000-0000-4000-a000-000000000001'
      where id = '20000000-0000-4000-a000-0000000000b1' $$,
  'and §6''s accept can link a claim to the referring company it names — public.guard_claim_update() restricts re-attribution to an owner, and with the old test a service-role token carrying a non-owner subject was judged as that subject and refused'
);

select set_config('request.jwt.claims', '', true);
reset role;

set local request.jwt.claims = '{"sub":"00000000-0000-4000-a000-000000000002","role":"authenticated","aal":"aal2"}';
set local role authenticated;

select throws_ok(
  $$ update public.claims set partner_company_id = null
      where id = '20000000-0000-4000-a000-0000000000b1' $$,
  '42501'::char(5), null::text,
  'while the assigned adjuster still cannot re-attribute it: assignment of work is theirs to make, disclosure of a homeowner to a third party is not, and widening the service test did not widen that'
);

select set_config('request.jwt.claims', '', true);
reset role;

set local request.jwt.claims = '{"sub":"00000000-0000-4000-a000-000000000001","role":"authenticated","aal":"aal2"}';
set local role authenticated;

select throws_ok(
  $$ update public.consents set consent_text = 'Rewritten by the owner.'
      where id = '80000000-0000-4000-a000-000000000002' $$,
  '42501'::char(5), null::text,
  'while an owner session still cannot rewrite a consent snapshot: the exemption is for the server, not for the most privileged human'
);

select throws_ok(
  $$ insert into public.claims (
       claim_ref, status, property_street, property_city, property_state, property_zip,
       carrier, policy_number, carrier_tenure, loss_date, cause, description)
     values ('CMG-2026-9004', 'settled', '12 Skip Ln', 'Oviedo', 'Florida', '32765',
             'Citizens Property Insurance', 'FL-CPI-9004', 'lt_1_year',
             date '2026-01-06', 'wind', 'Attempt to be born mid-lifecycle.') $$,
  '23514'::char(5), null::text,
  'and an owner still cannot seat a claim mid-lifecycle at insert, which is the gate-skipping route the status machine only closes on UPDATE'
);

select set_config('request.jwt.claims', '', true);
reset role;

set local request.jwt.claims = '{"sub":"00000000-0000-4000-a000-000000000003","role":"authenticated","aal":"aal2"}';
set local role authenticated;

select throws_ok(
  $$ update public.profiles set role = 'owner'
      where id = '00000000-0000-4000-a000-000000000003' $$,
  '42501'::char(5), null::text,
  'and an assistant still cannot promote themselves — profiles_update_self lets them onto their own row and public.guard_profile_privileges() refuses the escalation underneath, exactly as before'
);

select set_config('request.jwt.claims', '', true);
reset role;

-- ===========================================================================
