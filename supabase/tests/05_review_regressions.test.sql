-- CMG Property Solutions — regressions for the findings of the schema security review.
-- Every assertion in this file fails against the code as it stood before the review
-- and passes after it. They are grouped by finding so a future change that reopens one
-- of these holes names the hole it reopened.
--
--   owner      00000000-0000-4000-a000-000000000001  Austin Graham
--   adjuster   00000000-0000-4000-a000-000000000002  Dana Reyes    (assigned claims 1 and 2)
--   assistant  00000000-0000-4000-a000-000000000003  Priya Nolan
--   customer   00000000-0000-4000-a000-000000000004  Marcus Bell   (claimant on claim 1)
--   partner    00000000-0000-4000-a000-000000000005  Tyler Boone   (Summit Exteriors LLC)

begin;
set local client_min_messages = warning;
create extension if not exists pgtap with schema extensions;

select plan(41);

-- ---------------------------------------------------------------------------
-- Fixtures: a claim nobody is assigned to, carrying a claimant and a document, so
-- "the adjuster sees only their own caseload" is falsifiable rather than vacuous.
-- A second partner company, so re-attribution has somewhere to go.
-- ---------------------------------------------------------------------------

insert into public.partner_companies (id, name, status)
values ('10000000-0000-4000-a000-000000000002', 'Rival Roofing Co', 'active');

insert into public.claims (
  id, property_street, property_city, property_zip,
  carrier, policy_number, carrier_tenure, loss_date, cause, description
) values (
  '25000000-0000-4000-a000-000000000001', '41 Unassigned Ln', 'Sanford', '32771',
  'Test Carrier', 'POL-REVIEW-1', 'lt_1_year', current_date - 6, 'wind',
  'claim in the intake queue with no adjuster assigned'
);

insert into public.claimants (id, claim_id, first_name, last_name, email, initials, is_primary)
values (
  '35000000-0000-4000-a000-000000000001', '25000000-0000-4000-a000-000000000001',
  'Nadia', 'Okonkwo', 'nadia.okonkwo@example.test', 'NO', true
);

insert into public.documents (id, claim_id, storage_path, original_name, kind, mime, size_bytes, visibility)
values (
  '55000000-0000-4000-a000-000000000001', '25000000-0000-4000-a000-000000000001',
  'claims/25000000-0000-4000-a000-000000000001/ffffffff-0000-4000-a000-000000000001.pdf',
  'unassigned-declarations.pdf', 'declarations', 'application/pdf', 12345, 'internal'
);

insert into public.consents (id, lead_id, email, phone, kind, consent_text)
values (
  '85000000-0000-4000-a000-000000000001', '90000000-0000-4000-a000-000000000001',
  'rosa.delgado@example.test', '407-555-0133', 'sms',
  'I consent to receive SMS and email communications from CMG Property Solutions.'
);

create temp table review_probe (label text primary key, affected int);
grant all on table review_probe to public;

-- ---------------------------------------------------------------------------
-- MAJOR 1 — a claim can actually be created from a user session.
-- claims_before_insert() calls next_claim_ref(), whose EXECUTE is revoked from
-- authenticated. As SECURITY INVOKER it aborted every authenticated insert with
-- "permission denied for function next_claim_ref"; the seed masked it by running
-- as postgres. Intake was broken for every real caller.
-- ---------------------------------------------------------------------------

set local request.jwt.claims = '{"sub":"00000000-0000-4000-a000-000000000001","role":"authenticated"}';
set local role authenticated;

select lives_ok(
  $$ insert into public.claims (
       id, property_street, property_city, property_zip,
       carrier, policy_number, carrier_tenure, loss_date, cause, description
     ) values (
       '25000000-0000-4000-a000-000000000002', '42 Session Insert Way', 'Orlando', '32801',
       'Test Carrier', 'POL-REVIEW-2', 'lt_1_year', current_date - 4, 'hail',
       'claim created through a signed-in session rather than by the service role'
     ) $$,
  'a signed-in owner can create a claim: the reference generator runs inside the trigger as its owner, so intake works from a session without the counter ever becoming callable from one'
);

select matches(
  (select claim_ref from public.claims where id = '25000000-0000-4000-a000-000000000002'),
  '^CMG-\d{4}-\d{4}$',
  'the claim created from a session was given a real reference, so the trigger did the work rather than the insert merely surviving with a blank field'
);

select ok(
  not has_function_privilege('authenticated', 'public.next_claim_ref()', 'EXECUTE'),
  'the counter is still unreachable as an RPC from a signed-in session, so making the trigger a definer widened the trigger and not the API'
);

-- ---------------------------------------------------------------------------
-- M4 — the status machine only guards UPDATE, so INSERT was an open door into
-- any state, including states the machine would never let a claim reach.
-- ---------------------------------------------------------------------------

select throws_ok(
  $$ insert into public.claims (
       id, status, property_street, property_city, property_zip,
       carrier, policy_number, carrier_tenure, loss_date, cause, description
     ) values (
       '25000000-0000-4000-a000-000000000003', 'closed', '43 Born Closed Ct', 'Orlando', '32801',
       'Test Carrier', 'POL-REVIEW-3', 'lt_1_year', current_date - 4, 'hail', 'born closed'
     ) $$,
  '23514'::char(5), null::text,
  'a claim cannot be created already closed from a user session: the lifecycle is entered at the beginning, so no insert can skip the gates every update is held to'
);

select throws_ok(
  $$ insert into public.claims (
       id, status, property_street, property_city, property_zip,
       carrier, policy_number, carrier_tenure, loss_date, cause, description
     ) values (
       '25000000-0000-4000-a000-000000000004', 'lor_signed', '44 Born Signed Ct', 'Orlando', '32801',
       'Test Carrier', 'POL-REVIEW-4', 'lt_1_year', current_date - 4, 'hail', 'born represented'
     ) $$,
  '23514'::char(5), null::text,
  'nor can a claim be created already at lor_signed, which would otherwise assert representation over a homeowner with no signed letter anywhere in the system'
);

-- ---------------------------------------------------------------------------
-- M9 — loss_date is bounded at write time rather than by a CHECK containing now()
-- ---------------------------------------------------------------------------

select throws_ok(
  $$ insert into public.claims (
       id, property_street, property_city, property_zip,
       carrier, policy_number, carrier_tenure, loss_date, cause, description
     ) values (
       '25000000-0000-4000-a000-000000000005', '45 Future Loss Ln', 'Orlando', '32801',
       'Test Carrier', 'POL-REVIEW-5', 'lt_1_year', current_date + 30, 'hail', 'loss that has not happened'
     ) $$,
  '23514'::char(5), null::text,
  'a loss dated a month from now is still refused after the rule moved off the table and into a trigger, so relocating it did not drop it'
);

select set_config('request.jwt.claims', '', true);
reset role;

select is_empty(
  $$ select conname::text from pg_constraint
      where conrelid = 'public.claims'::regclass
        and conname = 'claims_loss_date_not_future' $$,
  'the rule is no longer a CHECK containing now(): a non-immutable CHECK is re-evaluated on table rewrites and on restore, which would retroactively reject rows that were perfectly legal when they were written'
);

-- ---------------------------------------------------------------------------
-- MAJOR 2 — pruning the rate-limit table must not touch other callers' budgets.
-- The retention interval is derived from the *calling* key's window, so an unscoped
-- delete let a one-minute limiter evict a 24-hour limiter's exhausted rows and hand
-- the budget straight back.
-- ---------------------------------------------------------------------------

insert into public.rate_limits (key, window_start, count)
values
  ('test:prune:victim', now() - interval '2 hours', 999),
  ('test:prune:caller', now() - interval '2 hours', 1);

-- Drive enough short-window calls that the 1% opportunistic prune is effectively
-- certain to fire (P(never) < 1e-8 over 2000 calls).
select count(*) from (
  select public.check_rate_limit('test:prune:caller', 100000, interval '1 second')
    from generate_series(1, 2000)
) s;

select is_empty(
  $$ select 1 from public.rate_limits
      where key = 'test:prune:caller' and window_start < now() - interval '1 hour' $$,
  'the prune really did run during those calls — the calling key''s own stale row is gone, which is the control that stops the next assertion passing merely because nothing happened'
);

select is(
  (select count::int from public.rate_limits
    where key = 'test:prune:victim' and window_start < now() - interval '1 hour'),
  999,
  'a different key''s exhausted budget survived that pruning untouched, so a short-window limiter cannot be used as a lever to reset a long-window one and unlock an address that had already been throttled'
);

-- ---------------------------------------------------------------------------
-- M3 — the throttle is not callable from a signed-in session
-- ---------------------------------------------------------------------------

select ok(
  not has_function_privilege('authenticated', 'public.check_rate_limit(text,integer,interval)', 'EXECUTE'),
  'no signed-in account can call the throttle: it counts whatever key it is handed, so reachable from a session it is a tool for spending a stranger''s intake budget and locking them out of the form'
);

select ok(
  has_function_privilege('service_role', 'public.check_rate_limit(text,integer,interval)', 'EXECUTE'),
  'the service role that fronts the public forms can still call it, so the throttle was narrowed rather than switched off'
);

-- ---------------------------------------------------------------------------
-- MAJOR 3 — an adjuster reads only the claims assigned to them, and that has to
-- hold for the rows hanging off a claim as well as for the claim row itself.
-- ---------------------------------------------------------------------------

set local request.jwt.claims = '{"sub":"00000000-0000-4000-a000-000000000002","role":"authenticated"}';
set local role authenticated;

select is(
  (select count(*)::int from public.claimants
    where claim_id = '25000000-0000-4000-a000-000000000001'),
  0,
  'an adjuster reads no homeowner row from a claim they are not assigned to, so the caseload boundary that already held on public.claims is not undone by reading the people attached to it'
);

select is(
  (select count(*)::int from public.documents
    where claim_id = '25000000-0000-4000-a000-000000000001'),
  0,
  'an adjuster reads no document row from an unassigned claim either — declarations pages and photo sets belong to the file, not to the staff directory'
);

select ok(
  not private.can_read_claim_object(
    'claims/25000000-0000-4000-a000-000000000001/ffffffff-0000-4000-a000-000000000001.pdf'
  ),
  'and the storage authorisation the server actions consult before issuing a signed URL agrees with the table: the bytes of an unassigned claim''s document are not fetchable by that adjuster'
);

select ok(
  private.can_read_claim_object(
    'claims/20000000-0000-4000-a000-000000000001/5e1a0c66-1f3a-4d7e-9a51-0f0b7c3d0002.pdf'
  ) is not true,
  'a path that names an assigned claim but no real document is still refused, so the check is anchored on the documents row rather than on the shape of the path'
);

select is(
  (select count(*)::int from public.claimants
    where claim_id = '20000000-0000-4000-a000-000000000001'),
  2,
  'the same adjuster still reads the homeowners on a claim they are assigned to, which is the control proving the two zeroes above are denials and not a broken policy'
);

-- ---------------------------------------------------------------------------
-- MAJOR 7 — an adjuster may work a claim but may not re-attribute it. Changing
-- partner_company_id rewrites claim_partner_summaries, handing the homeowner's
-- name, address, status and settlement to an unrelated company.
-- ---------------------------------------------------------------------------

select throws_ok(
  $$ update public.claims
        set partner_company_id = '10000000-0000-4000-a000-000000000002'
      where id = '20000000-0000-4000-a000-000000000001' $$,
  '42501'::char(5), null::text,
  'an adjuster cannot move their own claim to another referring company: re-attribution is a disclosure to a third party, which is not the same authority as working the file'
);

select lives_ok(
  $$ update public.claims set claim_number = 'CPI-2026-114820-A'
      where id = '20000000-0000-4000-a000-000000000001' $$,
  'the same adjuster can still edit the claim they are assigned to, so the refusal above is about the one column and not about updates being broken for them'
);

-- ---------------------------------------------------------------------------
-- MAJOR 8 — documents cannot be filed against, or moved onto, an unassigned claim.
-- The lor_signed document is what opens the representation gate, so this is the
-- difference between a claim being represented and merely appearing to be.
-- ---------------------------------------------------------------------------

select throws_ok(
  $$ insert into public.documents (claim_id, storage_path, original_name, kind, mime, size_bytes, uploaded_by, visibility)
     values (
       '25000000-0000-4000-a000-000000000001',
       'claims/25000000-0000-4000-a000-000000000001/ffffffff-0000-4000-a000-000000000009.pdf',
       'planted-lor.pdf', 'lor_signed', 'application/pdf', 4096,
       '00000000-0000-4000-a000-000000000002', 'internal'
     ) $$,
  '42501'::char(5), null::text,
  'an adjuster cannot file a signed letter of representation against a claim they are not assigned to, which would otherwise unlock the lor_signed transition on somebody else''s file'
);

select throws_ok(
  $$ update public.documents
        set claim_id = '20000000-0000-4000-a000-000000000002'
      where id = '50000000-0000-4000-a000-000000000001' $$,
  '42501'::char(5), null::text,
  'nor can an existing document be re-parented onto another claim: an update only ever has to satisfy the policy on the claim the row is on today, so immutability of claim_id is what closes the back door the insert policy just closed at the front'
);

select set_config('request.jwt.claims', '', true);
reset role;

-- ---------------------------------------------------------------------------
-- M7 — an assistant writes notes, not disclosures to a referring contractor
-- ---------------------------------------------------------------------------

set local request.jwt.claims = '{"sub":"00000000-0000-4000-a000-000000000003","role":"authenticated"}';
set local role authenticated;

select throws_ok(
  $$ insert into public.claim_events (claim_id, type, body, author_id, visibility)
     values ('20000000-0000-4000-a000-000000000001', 'note', 'partner-visible note from an assistant',
             '00000000-0000-4000-a000-000000000003', 'partner') $$,
  '42501'::char(5), null::text,
  'an assistant cannot publish a feed entry to a referring contractor: choosing to tell a third party something about a claim is the owner''s and the assigned adjuster''s decision'
);

select lives_ok(
  $$ insert into public.claim_events (claim_id, type, body, author_id, visibility)
     values ('20000000-0000-4000-a000-000000000001', 'note', 'internal note from an assistant',
             '00000000-0000-4000-a000-000000000003', 'internal') $$,
  'the assistant can still post the internal note the office actually needs, so the constraint narrows the audience rather than removing the ability'
);

select set_config('request.jwt.claims', '', true);
reset role;

-- ---------------------------------------------------------------------------
-- MAJOR 4 — a homeowner may withdraw consent; they may not rewrite the snapshot
-- that proves consent was given. This is the record CMG would produce in a TCPA
-- or CAN-SPAM dispute, and until now it was outside the audit trail entirely.
-- ---------------------------------------------------------------------------

set local request.jwt.claims = '{"sub":"00000000-0000-4000-a000-000000000004","role":"authenticated"}';
set local role authenticated;

select throws_ok(
  $$ update public.consents set consent_text = 'I never agreed to anything.'
      where id = '80000000-0000-4000-a000-000000000001' $$,
  '42501'::char(5), null::text,
  'a homeowner cannot rewrite the wording of the consent they gave, which is the whole evidentiary value of keeping a snapshot rather than a boolean'
);

select throws_ok(
  $$ update public.consents set granted_at = now() - interval '10 years'
      where id = '80000000-0000-4000-a000-000000000001' $$,
  '42501'::char(5), null::text,
  'nor can they backdate when it was given, which would put the consent outside any window a regulator or a court would look at'
);

select throws_ok(
  $$ update public.consents set email = 'someone.else@example.test'
      where id = '80000000-0000-4000-a000-000000000001' $$,
  '42501'::char(5), null::text,
  'nor can they reassign it to a different address, which would move the proof onto a person who never consented'
);

select lives_ok(
  $$ update public.consents set withdrawn_at = now()
      where id = '80000000-0000-4000-a000-000000000001' $$,
  'withdrawal itself still works, so the record is append-and-withdraw rather than frozen: the homeowner keeps the one right the policy exists to give them'
);

select set_config('request.jwt.claims', '', true);
reset role;

select is(
  (select consent_text from public.consents where id = '80000000-0000-4000-a000-000000000001'),
  'I consent to receive SMS and email communications from CMG Property Solutions at the phone number and email address I provided. Message frequency varies; message & data rates may apply. Reply STOP to unsubscribe, HELP for help. I can unsubscribe from email at any time.',
  'after all of that the stored wording is byte-for-byte what was captured at intake, so the refusals were real and not merely unreported'
);

select isnt_empty(
  $$ select 1 from public.audit_log
      where entity = 'consents'
        and entity_id = '80000000-0000-4000-a000-000000000001' $$,
  'the withdrawal reached the audit trail: consent changes are now recorded like every other claim mutation, rather than being the one evidentiary record no trigger watched'
);

-- ---------------------------------------------------------------------------
-- MAJOR 5 — deactivating a customer actually revokes them. claimants.user_id
-- outlives the account, so matching on it alone left a disabled homeowner with
-- full portal access.
-- ---------------------------------------------------------------------------

update public.profiles set is_active = false
 where id = '00000000-0000-4000-a000-000000000004';

set local request.jwt.claims = '{"sub":"00000000-0000-4000-a000-000000000004","role":"authenticated"}';
set local role authenticated;

select is(
  (select count(*)::int from public.claims),
  0,
  'a deactivated homeowner reads no claim at all, so is_active is an access control rather than a label the portal happens to check'
);

select is(
  (select count(*)::int from public.documents),
  0,
  'and no document either — deactivation reaches the files on the claim, not just the claim row'
);

select is(
  (select count(*)::int from public.claim_events),
  0,
  'and no feed entry, so the whole customer surface closes together rather than leaving one relation still answering'
);

select set_config('request.jwt.claims', '', true);
reset role;

update public.profiles set is_active = true
 where id = '00000000-0000-4000-a000-000000000004';

-- ---------------------------------------------------------------------------
-- M5 — deactivating a partner company revokes its reps for the same reason
-- ---------------------------------------------------------------------------

update public.partner_companies set status = 'inactive'
 where id = '10000000-0000-4000-a000-000000000001';

set local request.jwt.claims = '{"sub":"00000000-0000-4000-a000-000000000005","role":"authenticated"}';
set local role authenticated;

select is(
  (select count(*)::int from public.claim_partner_summaries),
  0,
  'a rep of a deactivated contractor reads no referral summaries, so ending a partnership ends the data access instead of leaving a status column nothing consults'
);

select set_config('request.jwt.claims', '', true);
reset role;

update public.partner_companies set status = 'active'
 where id = '10000000-0000-4000-a000-000000000001';

-- ---------------------------------------------------------------------------
-- MAJOR 6 — the bucket has no client-direct path at all (spec §4, §7.5)
-- ---------------------------------------------------------------------------

select is_empty(
  $$ select polname::text from pg_policy where polrelid = 'storage.objects'::regclass $$,
  'no policy on storage.objects exists for any client role, so document bytes cannot be read or written except through the server actions that issue five-minute signed URLs and audit every issuance — the client-direct path spec §7.5 forbids is structurally absent rather than merely unused'
);

select is(
  (select public from storage.buckets where id = 'claim-docs'),
  false,
  'the bucket is private, so the absence of policies is a closed door rather than an irrelevance'
);

-- ---------------------------------------------------------------------------
-- MAJOR 9 — consent outlives the lead or claim it was collected against.
--
-- This deletion is issued in an owner session on purpose. It used to run here as
-- `postgres`, after a `reset role`, where public.guard_consent_immutable() early-returns
-- on a null auth.uid() — so it proved the foreign key detaches without ever proving that
-- a real user can perform the delete that triggers it. That blind spot is what let the
-- round-2 MAJOR 1 through: for every JWT-bearing actor this statement raised 42501.
-- ---------------------------------------------------------------------------

set local request.jwt.claims = '{"sub":"00000000-0000-4000-a000-000000000001","role":"authenticated"}';
set local role authenticated;

select lives_ok(
  $$ delete from public.leads where id = '90000000-0000-4000-a000-000000000001' $$,
  'an owner working in a real session can delete a lead that carries consent records, rather than being blocked by the evidence guard reacting to the foreign key''s own detachment'
);

select set_config('request.jwt.claims', '', true);
reset role;

select is(
  (select count(*)::int from public.consents where id = '85000000-0000-4000-a000-000000000001'),
  1,
  'deleting a lead leaves its consent record standing: routine cleanup of a contact-form submission must not destroy the proof that the person agreed to be contacted, because that proof is what CMG would have to produce if they later denied it'
);

select ok(
  (select lead_id is null from public.consents where id = '85000000-0000-4000-a000-000000000001'),
  'and the surviving record really was detached rather than merely spared, so the foreign key performed the `set null` it exists for instead of being vetoed by the immutability guard'
);

select is(
  (select email from public.consents where id = '85000000-0000-4000-a000-000000000001'),
  'rosa.delgado@example.test',
  'and the surviving record still identifies whose consent it was, so a detached consent is evidence rather than an orphan nobody can attribute'
);

-- ---------------------------------------------------------------------------
-- M8 / M11 — required columns are required; deleted documents do not strand bytes
-- ---------------------------------------------------------------------------

select col_not_null('public'::name, 'claimants'::name, 'initials'::name,
  'every homeowner row carries the initials the letter of representation is signed with, as spec §4 lists them: a required field that is nullable is a field the application will eventually find empty');

select col_not_null('public'::name, 'invites'::name, 'invited_by'::name,
  'every invite names who issued it, so an account created from one can always be traced back to the staff member who authorised it');

delete from public.documents where id = '55000000-0000-4000-a000-000000000001';

select is(
  (select count(*)::int from public.storage_cleanup_queue
    where object_path = 'claims/25000000-0000-4000-a000-000000000001/ffffffff-0000-4000-a000-000000000001.pdf'
      and processed_at is null),
  1,
  'deleting a document leaves its stored object queued for the sweeper rather than stranded: the bytes outlive the row, so something has to remember they are there'
);

select * from finish();
rollback;
