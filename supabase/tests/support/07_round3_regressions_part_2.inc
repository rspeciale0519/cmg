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
