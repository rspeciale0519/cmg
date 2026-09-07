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

set local request.jwt.claims = '{"sub":"00000000-0000-4000-a000-000000000003","role":"authenticated","aal":"aal2"}';
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

set local request.jwt.claims = '{"sub":"00000000-0000-4000-a000-000000000001","role":"authenticated","aal":"aal2"}';
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
