-- CMG Property Solutions — regressions for the FOURTH review round.
--
-- Round 4 returned no majors. What it returned was a set of minors that share one shape,
-- and the shape is the reason this file exists rather than a scattering of assertions
-- across the earlier ones: every finding here is a guard that is *right about authority*
-- and wrong about who is asking, or a rule that is enforced on one verb and not on its
-- neighbour. Neither kind shows up in a suite that only ever asks "is this refused?".
--
--   * five guards asked `auth.uid() is null` to mean "this is CMG's own server". A
--     service-role JWT carries a subject, so in production that test says "ordinary user
--     session" about the application itself. Every previous test connected without a JWT,
--     which is the one configuration in which the old test and the right test agree — so
--     the whole class was invisible. The assertions below therefore run the service-role
--     paths BOTH ways: with a bare connection and with a service-role JWT that carries a
--     sub, because only the second distinguishes the two.
--
--   * documents_update_staff refused to strip a signed LOR off a claim that had passed
--     the gate, and documents_delete did not. Same evidence, same claim, different verb.
--     So the fixtures here delete as well as update, and check the row afterwards rather
--     than trusting the statement's silence: a DELETE that RLS refuses is not an error,
--     it is zero rows, which reads exactly like success.
--
--   * consents was scoped to the claim when the thing it protects is a person. A claim
--     has more than one claimant by design (§4's second homeowner), so "the customer on
--     this claim" is not "the subject of this consent". That needs a second linked
--     claimant to see at all, and no earlier fixture had one.
--
-- Also closed here: the mutation the round-3 suite could not kill (forging
-- claim_status_history.changed_by), and the three verified-but-untested functions the
-- upload path authorises on — private.can_write_claim_object(),
-- private.can_manage_claim_object() and public.guard_consent_subject().
--
--   owner      00000000-0000-4000-a000-000000000001  Austin Graham
--   adjuster   00000000-0000-4000-a000-000000000002  Dana Reyes    (assigned claims 1 and 2)
--   assistant  00000000-0000-4000-a000-000000000003  Priya Nolan
--   customer   00000000-0000-4000-a000-000000000004  Marcus Bell   (primary claimant, claim 1)
--   partner    00000000-0000-4000-a000-000000000005  Tyler Boone   (Summit Exteriors LLC)
--   co-claimant 00000000-0000-4000-a000-0000000000a1 Alicia Bell   (fixture: SECOND claimant
--                                                                   on claim 1, with a portal
--                                                                   account of her own)

begin;
set local client_min_messages = warning;
create extension if not exists pgtap with schema extensions;

select plan(74);

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
-- Minor 2 — the money table was the one thing nobody was watching
-- ===========================================================================

select has_trigger(
  'public'::name, 'claim_financials'::name, 'audit_claim_financials'::name,
  'settlement_amount and fee_percent are audited: the highest-value fields in the schema appeared in neither the DB trigger set nor §7.7''s app-level list, so changing them left no record of who did it'
);

select has_trigger(
  'public'::name, 'claimants'::name, 'audit_claimants'::name,
  'and so is claimants, which carries an access-control edge rather than mere contact details — user_id is what private.is_claim_customer() reads to decide who may see a claim, and email is where the invite is sent'
);

truncate table public.audit_log restart identity;

update public.claim_financials set settlement_amount = 41250.01
 where claim_id = '20000000-0000-4000-a000-000000000001';

select is(
  (select count(*)::int from public.audit_log where entity = 'claim_financials'),
  1,
  'moving a settlement figure writes exactly one entry to the append-only trail'
);

select is(
  (select entity_id from public.audit_log where entity = 'claim_financials'),
  '20000000-0000-4000-a000-000000000001'::uuid,
  'and it is filed under the claim id — claim_financials is keyed on claim_id and has no `id`, so without the fallback in public.audit_row_change() the entry landed with entity_id null and dropped straight out of the index the owner''s audit viewer filters on'
);

update public.claimants set phone = '407-555-0187'
 where id = '30000000-0000-4000-a000-000000000001';

select is(
  (select entity_id from public.audit_log where entity = 'claimants'),
  '30000000-0000-4000-a000-000000000001'::uuid,
  'a claimants change is recorded under its own id, so the fallback did not disturb the tables that do have one'
);

update public.claims set claim_number = 'CPI-2026-114821'
 where id = '20000000-0000-4000-a000-000000000001';

select is(
  (select entity_id from public.audit_log where entity = 'claims' limit 1),
  '20000000-0000-4000-a000-000000000001'::uuid,
  'and neither did it disturb claims, whose entries still carry the claim id they always did — coalesce never reaches its second arm for a table with a non-null id'
);

select is(
  (select count(*)::int from public.audit_log where entity = 'consents'),
  0,
  'public.consents needed no second trigger: it was given one in an earlier round for the same evidentiary reason, and nothing in this transaction has touched it since the truncate'
);

-- ===========================================================================
-- Minor 3 — DELETE was the door left open next to the one that was locked
-- ===========================================================================

set local request.jwt.claims = '{"sub":"00000000-0000-4000-a000-000000000002","role":"authenticated","aal":"aal2"}';
set local role authenticated;

select lives_ok(
  $$ delete from public.documents where id = '50000000-0000-4000-a000-000000000003' $$,
  'the assigned adjuster''s attempt to delete the signed LOR off a claim at settlement_offered is not an error — a DELETE that RLS refuses is zero rows, which is why this needed checking rather than trusting'
);

select is(
  (select count(*)::int from public.documents
    where claim_id = '20000000-0000-4000-a000-000000000001' and kind = 'lor_signed'),
  1,
  'and zero rows is what it was: the document is still on the claim, so the file no longer stands at settlement_offered asserting a representation it cannot show'
);

select lives_ok(
  $$ delete from public.documents where id = '50000000-0000-4000-a000-000000000002' $$,
  'the same adjuster deletes an ordinary photo on the same claim, so the rule is about the evidence and not about the adjuster'
);

select is(
  (select count(*)::int from public.documents where id = '50000000-0000-4000-a000-000000000002'),
  0,
  'and that one really went, which is the control proving the refusal above was a refusal'
);

select lives_ok(
  $$ delete from public.documents where id = '50000000-0000-4000-a000-0000000000b1' $$,
  'a signed LOR on a claim still at lor_sent is deletable, because before the gate it is an ordinary file — a wrong upload or a superseded draft — and correcting it is legitimate'
);

select is(
  (select count(*)::int from public.documents where id = '50000000-0000-4000-a000-0000000000b1'),
  0,
  'and it is gone, so the block is keyed to the gate rather than to the kind, and the pre-accept correction path stays open'
);

select set_config('request.jwt.claims', '', true);
reset role;

set local request.jwt.claims = '{"sub":"00000000-0000-4000-a000-000000000003","role":"service_role"}';
set local role service_role;

select lives_ok(
  $$ delete from public.documents where id = '50000000-0000-4000-a000-000000000003' $$,
  'the service role still deletes it: this is a policy and not a trigger, so BYPASSRLS means the PandaDoc webhook and any out-of-band correction are untouched'
);

select set_config('request.jwt.claims', '', true);
reset role;

set local request.jwt.claims = '{"sub":"00000000-0000-4000-a000-000000000001","role":"authenticated","aal":"aal2"}';
set local role authenticated;

select lives_ok(
  $$ delete from public.claims where id = '20000000-0000-4000-a000-0000000000b2' $$,
  'and an owner deleting a whole claim is unaffected — Postgres runs a referential cascade with the referenced table''s rights rather than through this policy'
);

select set_config('request.jwt.claims', '', true);
reset role;

select is(
  (select count(*)::int from public.documents where id = '50000000-0000-4000-a000-0000000000b2'),
  0,
  'so the claim''s signed LOR went with it, which is the case that would have broken had this rule been written as a trigger instead'
);

-- ===========================================================================
-- Minor 5 — claims_claim_ref_shape pinned the format, not the identity
-- ===========================================================================

set local request.jwt.claims = '{"sub":"00000000-0000-4000-a000-000000000001","role":"authenticated","aal":"aal2"}';
set local role authenticated;

select throws_ok(
  $$ update public.claims set claim_ref = 'CMG-2026-0002'
      where id = '20000000-0000-4000-a000-000000000001' $$,
  '42501'::char(5), null::text,
  'an owner cannot rename a claim onto another claim''s reference — the shape CHECK accepted this happily, because CMG-2026-0002 is perfectly well formed and simply belongs to a different file'
);

select set_config('request.jwt.claims', '', true);
reset role;

set local request.jwt.claims = '{"sub":"00000000-0000-4000-a000-000000000002","role":"authenticated","aal":"aal2"}';
set local role authenticated;

select throws_ok(
  $$ update public.claims set claim_ref = 'CMG-2026-4444'
      where id = '20000000-0000-4000-a000-000000000001' $$,
  '42501'::char(5), null::text,
  'and neither can the assigned adjuster, who reaches the column through claims_update_manage like any other'
);

select set_config('request.jwt.claims', '', true);
reset role;

select is(
  (select claim_ref from public.claims where id = '20000000-0000-4000-a000-000000000001'),
  'CMG-2026-0001',
  'the reference on the file is the one it was born with — it is the string every email, portal header and partner summary identifies the claim by, so two files answering to one name is a correspondence problem, not an untidy row'
);

set local request.jwt.claims = '{"sub":"00000000-0000-4000-a000-000000000003","role":"service_role"}';
set local role service_role;

select lives_ok(
  $$ update public.claims set claim_ref = 'CMG-2026-0009'
      where id = '20000000-0000-4000-a000-0000000000b1' $$,
  'the service role keeps the correction path, as it does for consent snapshots: it already holds BYPASSRLS and grant all on audit_log itself, so constraining it here would be theatre that costs a real repair route'
);

select set_config('request.jwt.claims', '', true);
reset role;

-- ===========================================================================
-- Minor 6 — a claim has more than one claimant, so "the customer on this claim"
--           is not "the subject of this consent"
-- ===========================================================================

set local request.jwt.claims = '{"sub":"00000000-0000-4000-a000-0000000000a1","role":"authenticated"}';
set local role authenticated;

select results_eq(
  $$ select id::text from public.consents order by id $$,
  $$ values ('80000000-0000-4000-a000-0000000000a1'::text) $$,
  'the co-claimant reads her own consent and nothing else — she used to read every snapshot on the file, which meant the other homeowner''s email, phone and the IP address they submitted from'
);

select lives_ok(
  $$ update public.consents set withdrawn_at = now()
      where id = '80000000-0000-4000-a000-000000000001' $$,
  'her attempt to withdraw the OTHER party''s consent is silent, as an RLS-refused UPDATE always is'
);

select is(
  (select withdrawn_at from public.consents where id = '80000000-0000-4000-a000-000000000001'),
  null::timestamptz,
  'and silent is all it was: the other homeowner''s consent still stands, which matters because withdrawing it in their name destroys the permission CMG would have to produce in a TCPA dispute'
);

select lives_ok(
  $$ update public.consents set withdrawn_at = now()
      where id = '80000000-0000-4000-a000-0000000000a1' $$,
  'while she withdraws her own, matched across a case and whitespace difference between consents.email and the claimants row it belongs to'
);

select isnt(
  (select withdrawn_at from public.consents where id = '80000000-0000-4000-a000-0000000000a1'),
  null::timestamptz,
  'and that one took effect, so the §10 consent view-and-withdraw a homeowner is promised is narrowed to her own row rather than closed'
);

select set_config('request.jwt.claims', '', true);
reset role;

set local request.jwt.claims = '{"sub":"00000000-0000-4000-a000-000000000004","role":"authenticated"}';
set local role authenticated;

select is(
  (select count(*)::int from public.consents),
  2,
  'the primary homeowner still reads both of the consents he gave, and only those — his sms and his email snapshot, not the co-claimant''s'
);

select set_config('request.jwt.claims', '', true);
reset role;

set local request.jwt.claims = '{"sub":"00000000-0000-4000-a000-000000000003","role":"authenticated","aal":"aal2"}';
set local role authenticated;

select is(
  (select count(*)::int from public.consents),
  3,
  'and staff still read every snapshot on the claim, because producing consent across a file is the evidentiary job §7.7 gives them — the narrowing is on the customer branches alone'
);

select set_config('request.jwt.claims', '', true);
reset role;

-- ===========================================================================
-- Minor 7 — the intake arm of documents_storage_path_matches_claim
--
-- It still cannot be tied to a claim: the intake uuid is minted while no claim id exists
-- (see the constraint's comment). What it can state is the shape §4 gives it, which is
-- what the arm now does.
-- ===========================================================================

select throws_ok(
  $$ insert into public.documents (claim_id, storage_path, original_name, kind, mime, size_bytes)
     values ('20000000-0000-4000-a000-000000000001', 'intake/anything-at-all/x.pdf',
             'x.pdf', 'other', 'application/pdf', 10) $$,
  '23514'::char(5), null::text,
  'the intake arm no longer accepts a free-form prefix: `like ''intake/%''` admitted any string beginning with those seven characters, none of which the intake flow can produce'
);

select throws_ok(
  $$ insert into public.documents (claim_id, storage_path, original_name, kind, mime, size_bytes)
     values ('20000000-0000-4000-a000-000000000001',
             'intake/cccccccc-1111-4111-8111-111111111111/nested/x.pdf',
             'x.pdf', 'other', 'application/pdf', 10) $$,
  '23514'::char(5), null::text,
  'nor extra nesting below the intake folder, which §4''s intake/{intake_uuid}/{uuid}.{ext} does not have'
);

select lives_ok(
  $$ insert into public.documents (claim_id, storage_path, original_name, kind, mime, size_bytes)
     values ('20000000-0000-4000-a000-000000000001',
             'intake/cccccccc-5555-4555-8555-555555555555/c5.pdf',
             'c5.pdf', 'other', 'application/pdf', 10) $$,
  'while a well-formed pre-accept path is accepted exactly as before, so the arm still describes the flow it exists to permit'
);

-- ===========================================================================
-- Minor 10 — §9 gives owners companies CRUD, and D did not work
-- ===========================================================================

select throws_ok(
  $$ delete from public.partner_companies where id = '10000000-0000-4000-a000-000000000001' $$,
  '23503'::char(5), null::text,
  'deleting a company that still has reps is refused as a foreign-key problem, which is what it is — it used to surface as a CHECK violation on public.profiles, a table the caller never mentioned, because `on delete set null` walked straight into profiles_partner_requires_company'
);

set local request.jwt.claims = '{"sub":"00000000-0000-4000-a000-000000000001","role":"authenticated","aal":"aal2"}';
set local role authenticated;

-- throws_like, not throws_ok: with profiles.partner_company_id at `on delete restrict` the
-- foreign key raises 23503 on its own, so pinning the SQLSTATE alone would still pass with
-- public.guard_partner_company_delete() removed and would say nothing about the finding,
-- which is entirely about what the owner is told. The message is the fix.
select throws_like(
  $$ delete from public.partner_companies where id = '10000000-0000-4000-a000-000000000001' $$,
  '%still has 1 linked rep profile(s) and cannot be deleted%inactive%',
  'an owner session is told which company, how many reps are in the way and that `status = ''inactive''` is how a relationship ends — instead of a check-constraint violation on public.profiles, a table they never mentioned'
);

select is(
  (select confdeltype from pg_constraint
    where conrelid = 'public.profiles'::regclass
      and conname = 'profiles_partner_company_id_fkey'),
  'r'::"char",
  'and the structural half is there too: the FK is `on delete restrict`, so the corrupt state stays impossible even if the guard above is ever dropped — `set null` is what walked into profiles_partner_requires_company and made the delete fail for everyone including the service role'
);

select lives_ok(
  $$ delete from public.partner_companies where id = '10000000-0000-4000-a000-0000000000e1' $$,
  'a company with no reps deletes cleanly, so the D in §9''s CRUD is real and only the blocked case was ever at issue'
);

select set_config('request.jwt.claims', '', true);
reset role;

select is(
  (select count(*)::int from public.partner_companies where id = '10000000-0000-4000-a000-000000000001'),
  1,
  'and Summit Exteriors is still there after both refusals, with its rep still attached — the guard refuses the delete rather than half-performing it'
);

-- ===========================================================================
-- M14 — the mutation round 3 could not kill: forging changed_by
--
-- Dropping `changed_by = (select auth.uid())` from claim_status_history_insert was
-- detected by nothing in 355 assertions. The history row is who-did-what for the whole
-- lifecycle, so an attributable one that names somebody else is worse than none.
-- ===========================================================================

set local request.jwt.claims = '{"sub":"00000000-0000-4000-a000-000000000001","role":"authenticated","aal":"aal2"}';
set local role authenticated;

select throws_ok(
  $$ insert into public.claim_status_history (claim_id, from_status, to_status, changed_by, note)
     values ('20000000-0000-4000-a000-000000000001', 'settlement_offered', 'settled',
             '00000000-0000-4000-a000-000000000002', 'Attributed to the adjuster.') $$,
  '42501'::char(5), null::text,
  'an owner cannot write a history row attributing the change to the adjuster — the one mutation the previous suite could not kill, and the one that turns the trail from a record into a forgery'
);

select throws_ok(
  $$ insert into public.claim_status_history (claim_id, from_status, to_status, changed_by, note)
     values ('20000000-0000-4000-a000-000000000001', 'settlement_offered', 'settled',
             null, 'Anonymous.') $$,
  '42501'::char(5), null::text,
  'nor an unattributed one: `null = auth.uid()` is NULL, which is not TRUE, so the WITH CHECK denies it — the three-valued behaviour works in the right direction here and this pins it'
);

select lives_ok(
  $$ insert into public.claim_status_history (claim_id, from_status, to_status, changed_by, note)
     values ('20000000-0000-4000-a000-000000000001', 'settlement_offered', 'settled',
             '00000000-0000-4000-a000-000000000001', 'Attributed to the owner who made it.') $$,
  'while a row attributed to the caller who wrote it is accepted, so the rule shapes attribution rather than closing the log'
);

select set_config('request.jwt.claims', '', true);
reset role;

set local request.jwt.claims = '{"sub":"00000000-0000-4000-a000-000000000002","role":"authenticated","aal":"aal2"}';
set local role authenticated;

select throws_ok(
  $$ insert into public.claim_status_history (claim_id, from_status, to_status, changed_by, note)
     values ('20000000-0000-4000-a000-000000000001', 'settlement_offered', 'settled',
             '00000000-0000-4000-a000-000000000001', 'Attributed to the owner.') $$,
  '42501'::char(5), null::text,
  'and it runs in both directions: the assigned adjuster cannot sign the owner''s name to a transition either'
);

select set_config('request.jwt.claims', '', true);
reset role;

-- ===========================================================================
-- Zero-coverage functions: the ones the upload server action authorises on
--
-- §7.5 has no client-direct upload path, so these are never reached through a policy —
-- storage.objects deliberately has none. They are called by the server action itself to
-- decide whether to issue a URL at all, which means they are load-bearing and were
-- verified only by reading them.
-- ===========================================================================

set local request.jwt.claims = '{"sub":"00000000-0000-4000-a000-000000000004","role":"authenticated"}';
set local role authenticated;
insert into r4_probe values
  ('cust_write_own',    private.can_write_claim_object('claims/20000000-0000-4000-a000-000000000001/a.pdf')),
  ('cust_write_other',  private.can_write_claim_object('claims/20000000-0000-4000-a000-000000000002/a.pdf')),
  ('cust_write_intake', private.can_write_claim_object('intake/cccccccc-1111-4111-8111-111111111111/a.pdf')),
  ('cust_manage_own',   private.can_manage_claim_object('claims/20000000-0000-4000-a000-000000000001/a.pdf'));
select set_config('request.jwt.claims', '', true);
reset role;

set local request.jwt.claims = '{"sub":"00000000-0000-4000-a000-000000000002","role":"authenticated","aal":"aal2"}';
set local role authenticated;
insert into r4_probe values
  ('adj_write_assigned',   private.can_write_claim_object('claims/20000000-0000-4000-a000-000000000001/a.pdf')),
  ('adj_write_unassigned', private.can_write_claim_object('claims/20000000-0000-4000-a000-0000000000cc/a.pdf')),
  ('adj_manage_assigned',  private.can_manage_claim_object('claims/20000000-0000-4000-a000-000000000001/a.pdf')),
  ('adj_manage_garbage',   private.can_manage_claim_object('not-a-claim-path'));
select set_config('request.jwt.claims', '', true);
reset role;

set local request.jwt.claims = '{"sub":"00000000-0000-4000-a000-000000000005","role":"authenticated"}';
set local role authenticated;
insert into r4_probe values
  ('partner_write',  private.can_write_claim_object('claims/20000000-0000-4000-a000-000000000001/a.pdf')),
  ('partner_manage', private.can_manage_claim_object('claims/20000000-0000-4000-a000-000000000001/a.pdf'));
select set_config('request.jwt.claims', '', true);
reset role;

set local request.jwt.claims = '{"sub":"00000000-0000-4000-a000-000000000003","role":"authenticated","aal":"aal2"}';
set local role authenticated;
insert into r4_probe values
  ('assist_write',  private.can_write_claim_object('claims/20000000-0000-4000-a000-000000000002/a.pdf')),
  ('assist_manage', private.can_manage_claim_object('claims/20000000-0000-4000-a000-000000000002/a.pdf'));
select set_config('request.jwt.claims', '', true);
reset role;

select is((select v from r4_probe where label = 'cust_write_own'), true,
  'a homeowner may write an object under their own claim''s prefix, which is the §10 portal upload');

select is((select v from r4_probe where label = 'cust_write_other'), false,
  'and not under another claim''s, which is the whole reason the server action asks this function rather than trusting the path it was handed');

select is((select v from r4_probe where label = 'cust_write_intake'), false,
  'and not into intake/ at all — that prefix is pre-accept and service-role only, and the function returns false rather than NULL for a path it cannot parse a claim out of');

select is((select v from r4_probe where label = 'cust_manage_own'), false,
  'a homeowner does not MANAGE objects on their own claim: can_manage_claim_object is owner-and-assigned-adjuster, which is what separates uploading a photo from deleting a document');

select is((select v from r4_probe where label = 'adj_write_assigned'), true,
  'the assigned adjuster may write under the claim they carry');

select is((select v from r4_probe where label = 'adj_write_unassigned'), false,
  'and not under a claim id that names nothing — the existence check inside the staff branch is what stops an object being planted at a prefix no claim will ever own');

select is((select v from r4_probe where label = 'adj_manage_assigned'), true,
  'and they manage it too, which is the authority §4 gives them over their own caseload');

select is((select v from r4_probe where label = 'adj_manage_garbage'), false,
  'a path with no claim uuid in it is false, not NULL: private.claim_id_from_object_name() returns NULL and the coalesce turns that into a refusal rather than a three-valued answer the caller''s `if not` would skip');

select is((select v from r4_probe where label = 'partner_write'), false,
  'a partner rep cannot write an object even on a claim their own company referred — §4 is ✖ on documents for partners, and claim_partner_summaries is the only claim-shaped thing they touch');

select is((select v from r4_probe where label = 'partner_manage'), false,
  'and cannot manage one either');

select is((select v from r4_probe where label = 'assist_write'), true,
  'an assistant may write on any claim, matching §4''s documents ✔ (upload/read) for the role that carries the whole caseload');

select is((select v from r4_probe where label = 'assist_manage'), false,
  'but manages none, which is the same boundary documents_update_staff draws around representation documents');

-- ===========================================================================
-- public.guard_consent_subject() — never asserted anywhere
-- ===========================================================================

select throws_ok(
  $$ insert into public.consents (email, kind, consent_text)
     values ('nobody@example.test', 'sms', 'Consent with no subject at all.') $$,
  '23514'::char(5), null::text,
  'a consent must name the claim or the lead it was collected for — the rule lives in a trigger rather than a table CHECK precisely so it applies at write time only, and nothing had ever exercised it'
);

select lives_ok(
  $$ insert into public.consents (claim_id, email, kind, consent_text)
     values ('20000000-0000-4000-a000-000000000001', 'claimonly@example.test', 'sms',
             'Collected against a claim.') $$,
  'a claim alone satisfies it'
);

select lives_ok(
  $$ insert into public.consents (lead_id, email, kind, consent_text)
     values ('90000000-0000-4000-a000-000000000001', 'leadonly@example.test', 'sms',
             'Collected against a lead.') $$,
  'and so does a lead alone — which is what makes the CHECK-shaped version wrong: the `on delete set null` detachment these FKs exist for would have violated it'
);

select * from finish();
rollback;
