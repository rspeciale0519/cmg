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

-- The four path helpers were never called by a policy or production code. The
-- additive retirement migration removes this misleading, test-only surface.
select hasnt_function('private', 'claim_id_from_object_name', array['text'],
  'the unused path parser stays retired');
select hasnt_function('private', 'can_read_claim_object', array['text'],
  'the unused storage read helper stays retired');
select hasnt_function('private', 'can_write_claim_object', array['text'],
  'the unused storage write helper stays retired');
select hasnt_function('private', 'can_manage_claim_object', array['text'],
  'the unused storage management helper stays retired');

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
