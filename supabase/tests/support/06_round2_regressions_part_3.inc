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
  (select count(*)::int from public.claim_partner_summaries where claim_id in
    ('20000000-0000-4000-a000-000000000001','20000000-0000-4000-a000-000000000002','26000000-0000-4000-a000-000000000001')),
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
