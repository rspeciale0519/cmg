-- CMG Property Solutions — vendor fee rates, portal URL argument, delete guard
-- coverage, retired catalog objects, and invite reservation release.
--
-- Everything is synthetic and rolls back. The fixtures reuse the seeded owner
-- and adjuster because accept_intake_transaction is owner-gated and refuses an
-- adjuster that is not active.
begin;
set local client_min_messages = warning;
create extension if not exists pgtap with schema extensions;
set local search_path = public, extensions;

select plan(21);

-- ---------------------------------------------------------------------------
-- The fee column and its range
-- ---------------------------------------------------------------------------
select has_column('public', 'partner_companies', 'default_fee_percent',
  'vendors carry their own negotiated fee rate');
select col_is_null('public', 'partner_companies', 'default_fee_percent',
  'no rate means CMG''s standard fee, so the column is nullable rather than defaulted');

set local role service_role;

select throws_ok(
  $$insert into public.partner_companies(name, default_fee_percent)
    values ('Out Of Range Roofing', 100.01)$$,
  '23514', null, 'a fee above 100 percent is refused');
select throws_ok(
  $$insert into public.partner_companies(name, default_fee_percent)
    values ('Negative Roofing', -0.01)$$,
  '23514', null, 'a negative fee is refused');
select lives_ok(
  $$insert into public.partner_companies(id, name, status, default_fee_percent)
    values ('42000000-0000-4000-a000-000000000001', 'Fifteen Percent Exteriors',
            'active', 15.00)$$,
  'a rate inside the range is stored');
-- Three companies so each foreign key path can be exercised on its own: the
-- one above is named only by a vendor link, this one is only chosen at triage,
-- and the third carries its own rate through a triage choice.
insert into public.partner_companies(id, name, status, default_fee_percent)
values ('42000000-0000-4000-a000-000000000002', 'Standard Rate Exteriors', 'active', null),
       ('42000000-0000-4000-a000-000000000003', 'Twenty Five Percent Exteriors', 'active', 25.00);

-- ---------------------------------------------------------------------------
-- Intake fixtures
-- ---------------------------------------------------------------------------
-- Three queued intakes, one per fee path: a triage-chosen vendor with a rate, a
-- vendor link with a rate and no triage choice, and neither.
insert into public.claims(
  id, claim_ref, status, property_street, property_city, property_state, property_zip,
  loss_date, cause, description, intake_referral_partner_id)
values
  ('42000000-0000-4000-a000-000000000101', 'CMG-2042-4201', 'new_intake',
   '1 Fee Test Way', 'Oviedo', 'Florida', '32765', current_date - 10, 'wind_hail',
   'Synthetic fee fixture chosen', null),
  ('42000000-0000-4000-a000-000000000102', 'CMG-2042-4202', 'new_intake',
   '2 Fee Test Way', 'Oviedo', 'Florida', '32765', current_date - 10, 'wind_hail',
   'Synthetic fee fixture link', '42000000-0000-4000-a000-000000000001'),
  ('42000000-0000-4000-a000-000000000103', 'CMG-2042-4203', 'new_intake',
   '3 Fee Test Way', 'Oviedo', 'Florida', '32765', current_date - 10, 'wind_hail',
   'Synthetic fee fixture default', null);
insert into public.claimants(claim_id, first_name, last_name, email, initials, is_primary)
values ('42000000-0000-4000-a000-000000000101', 'Fee', 'Chosen', 'fee-chosen@example.test', 'FC', true),
       ('42000000-0000-4000-a000-000000000102', 'Fee', 'Link', 'fee-link@example.test', 'FL', true),
       ('42000000-0000-4000-a000-000000000103', 'Fee', 'Default', 'fee-default@example.test', 'FD', true);

reset role;
set local request.jwt.claims =
  '{"sub":"00000000-0000-4000-a000-000000000001","role":"authenticated","aal":"aal2"}';
set local role authenticated;

-- The vendor chosen at triage carries its own rate, and the rate wins over the
-- application's standard one.
select lives_ok(
  $$select public.accept_intake_transaction(
      '42000000-0000-4000-a000-000000000101',
      '00000000-0000-4000-a000-000000000002', 'existing',
      '42000000-0000-4000-a000-000000000003', null, 'Test Carrier', 'POL-42-1',
      'three_plus_years', 'non_emergency',
      'fee fixture', null, 'https://example.test/portal', 20)$$,
  'accepting an intake with a chosen vendor succeeds');
select is(
  (select fee_percent from public.claim_financials
    where claim_id='42000000-0000-4000-a000-000000000101'),
  25.00::numeric, 'the chosen vendor''s own rate seeds the financials row');

-- No triage choice, so the rate comes from the vendor whose public link
-- produced the intake.
select lives_ok(
  $$select public.accept_intake_transaction(
      '42000000-0000-4000-a000-000000000102',
      '00000000-0000-4000-a000-000000000002', 'none', null, null,
      'Test Carrier', 'POL-42-2', 'three_plus_years',
      'non_emergency', 'fee fixture', null,
      'https://example.test/portal', 20)$$,
  'accepting a vendor-link intake with no triage choice succeeds');
select is(
  (select fee_percent from public.claim_financials
    where claim_id='42000000-0000-4000-a000-000000000102'),
  15.00::numeric, 'the referring vendor''s rate seeds the financials row');

-- Neither path names a vendor with a rate, so the application's standard fee is
-- what lands on the claim.
select lives_ok(
  $$select public.accept_intake_transaction(
      '42000000-0000-4000-a000-000000000103',
      '00000000-0000-4000-a000-000000000002', 'existing',
      '42000000-0000-4000-a000-000000000002', null, 'Test Carrier', 'POL-42-3',
      'three_plus_years', 'non_emergency',
      'fee fixture', null, 'https://example.test/portal', 20)$$,
  'accepting an intake for a vendor with no rate succeeds');
select is(
  (select fee_percent from public.claim_financials
    where claim_id='42000000-0000-4000-a000-000000000103'),
  20::numeric, 'the supplied standard fee seeds the financials row');

reset role;
set local role service_role;

-- The portal link is the argument the application passed, not a baked-in
-- production URL. `notifications_outbox` is service-role only, so this is read
-- back out of the caller's session.
select is(
  (select o.payload->>'portalUrl' from public.notifications_outbox o
    where o.dedupe_key =
      'intake-accepted-status:42000000-0000-4000-a000-000000000101'),
  'https://example.test/portal',
  'the outbox payload carries the caller''s portal URL');

-- ---------------------------------------------------------------------------
-- The submission fallback state
-- ---------------------------------------------------------------------------
-- A submission that omits property_state now records the state the column
-- defaults to, rather than the Pennsylvania this predates.
-- The submission runs into its own table first. Calling a volatile function
-- inside a WHERE predicate would re-evaluate it per candidate row, which
-- submits a fresh claim each time.
create temporary table state_fallback(value jsonb) on commit drop;
insert into state_fallback
select public.submit_claim_transaction(
  jsonb_build_object('property_street','2 Fallback Way','property_city','Oviedo',
    'property_zip','32765','loss_date',(current_date - 5)::text,'cause','wind_hail',
    'description','Synthetic state fallback fixture'),
  jsonb_build_array(jsonb_build_object('first_name','State','last_name','Fallback',
    'email','state-fallback@example.test','initials','SF','is_primary',true)),
  '[]'::jsonb, '[]'::jsonb, '[]'::jsonb);

select is(
  (select c.property_state from public.claims c
    join state_fallback s on c.id = (s.value->>'id')::uuid),
  'Florida', 'an omitted property state falls back to the table default');

-- ---------------------------------------------------------------------------
-- The delete guard covers both claim foreign keys
-- ---------------------------------------------------------------------------
-- Both raise 23503 with the guard's own sentence, which
-- src/lib/actions/partners.ts shows to the owner verbatim. Without the guard
-- these are the raw ON DELETE RESTRICT text naming a constraint.
select throws_like(
  $$delete from public.partner_companies where id='42000000-0000-4000-a000-000000000002'$$,
  '%cannot be deleted%',
  'a company attributed to a claim at triage refuses deletion with the friendly sentence');
select throws_ok(
  $$delete from public.partner_companies where id='42000000-0000-4000-a000-000000000001'$$,
  '23503', null,
  'a company named by a claim''s vendor link refuses deletion under the same code');

-- ---------------------------------------------------------------------------
-- Retired catalog objects
-- ---------------------------------------------------------------------------
select ok(not exists(
  select 1 from pg_proc p join pg_namespace n on n.oid=p.pronamespace
   where n.nspname='public' and p.proname='claim_search_text'),
  'the composite claims search computed field is gone');
select ok(not exists(
  select 1 from pg_proc p join pg_namespace n on n.oid=p.pronamespace
   where n.nspname='private' and p.proname='invite_account_marker' and p.pronargs=4),
  'the superseded four-argument invite account marker is gone');

-- ---------------------------------------------------------------------------
-- Invite reservation release
-- ---------------------------------------------------------------------------
-- begin_invite_acceptance() stamps the attempt and issue_invite_transaction()
-- refuses a resend while the stamp is present, so a failed acceptance has to be
-- able to hand the reservation back.
insert into public.invites(id, email, role, token_hash, expires_at, invited_by,
  acceptance_attempt_id)
values ('42000000-0000-4000-a000-000000000010', 'release42@example.test', 'assistant',
  'hash-42-release', now() + interval '72 hours', '00000000-0000-4000-a000-000000000001',
  '42000000-0000-4000-a000-000000000011');

select is(
  public.abandon_invite_acceptance('42000000-0000-4000-a000-000000000010',
    '42000000-0000-4000-a000-000000000011'),
  true, 'the attempt that reserved the invite can release it');
select is(
  (select acceptance_attempt_id from public.invites
    where id='42000000-0000-4000-a000-000000000010'),
  null::uuid, 'releasing clears the reservation stamp');

-- An accepted invitation is never reopened: a late failure path in one request
-- must not undo a redemption another request has already completed.
update public.invites
   set acceptance_attempt_id='42000000-0000-4000-a000-000000000011',
       accepted_at=now(), accepted_by='00000000-0000-4000-a000-000000000001'
 where id='42000000-0000-4000-a000-000000000010';
select is(
  public.abandon_invite_acceptance('42000000-0000-4000-a000-000000000010',
    '42000000-0000-4000-a000-000000000011'),
  false, 'an accepted invitation refuses the release');
select is(
  (select acceptance_attempt_id from public.invites
    where id='42000000-0000-4000-a000-000000000010'),
  '42000000-0000-4000-a000-000000000011'::uuid,
  'the refused release leaves the accepted invitation untouched');

reset role;
select * from finish();
rollback;
