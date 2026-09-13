-- CMG Property Solutions — claim references and the lifecycle machine.
-- The database is the second enforcement layer behind lib/status-machine.ts. These
-- assertions prove it holds on its own, i.e. that a compromised or bypassed
-- application cannot walk a claim into a state the business never authorised.

begin;
set local client_min_messages = warning;
create extension if not exists pgtap with schema extensions;

select plan(37);

-- ---------------------------------------------------------------------------
-- claim_ref shape and per-year numbering
-- ---------------------------------------------------------------------------

select matches(
  (select claim_ref from public.claims where id = '20000000-0000-4000-a000-000000000001'),
  '^CMG-\d{4}-\d{4}$',
  'a claim is addressable by a short opaque reference rather than by its primary key'
);

select matches(
  (select claim_ref from public.claims where id = '20000000-0000-4000-a000-000000000002'),
  '^CMG-\d{4}-\d{4}$',
  'the second seeded claim carries the same reference shape, so the format is produced by the generator and not by hand'
);

select is_empty(
  $$ select claim_ref from public.claims where claim_ref !~ '^CMG-\d{4}-\d{4}$' $$,
  'no claim anywhere in the table escapes the reference format, so display code can rely on it without defensive parsing'
);

select col_is_pk('public'::name, 'claim_ref_counters'::name, 'year'::name,
  'claim numbering is keyed by year, which is what makes the sequence restart each January instead of running forever');

-- Local acceptance runs can advance the counter after seeding. Check continuity
-- from the current value without resetting it or changing unrelated claims.
create temporary table ref_counter_baseline on commit drop as
select coalesce((select last_value from public.claim_ref_counters
  where year = extract(year from (now() at time zone 'America/New_York'))::int), 0) as last_value;

insert into public.claims (
  id, property_street, property_city, property_zip,
  carrier, policy_number, carrier_tenure, loss_date, cause, description
) values (
  '21000000-0000-4000-a000-000000000001', '11 Ref Test Ln', 'Orlando', '32801',
  'Test Carrier', 'POL-REF-1', 'lt_1_year', current_date - 10, 'wind', 'reference numbering probe A'
), (
  '21000000-0000-4000-a000-000000000002', '12 Ref Test Ln', 'Orlando', '32801',
  'Test Carrier', 'POL-REF-2', 'lt_1_year', current_date - 10, 'wind', 'reference numbering probe B'
);

select is(
  (select claim_ref from public.claims where id = '21000000-0000-4000-a000-000000000001'),
  'CMG-' || extract(year from (now() at time zone 'America/New_York'))::int::text || '-' ||
    to_char((select last_value + 1 from ref_counter_baseline), 'FM0000'),
  'a new claim continues this year''s run instead of restarting, so two claims can never share a reference'
);

select is(
  (select claim_ref from public.claims where id = '21000000-0000-4000-a000-000000000002'),
  'CMG-' || extract(year from (now() at time zone 'America/New_York'))::int::text || '-' ||
    to_char((select last_value + 2 from ref_counter_baseline), 'FM0000'),
  'the very next claim takes the very next number, so the sequence is gapless and each reference is minted exactly once'
);

select is(
  (select last_value from public.claim_ref_counters
    where year = extract(year from (now() at time zone 'America/New_York'))::int),
  (select last_value + 2 from ref_counter_baseline),
  'the counter advanced by exactly one per claim, so the reference cannot be guessed forward without also guessing the claim count'
);

-- ---------------------------------------------------------------------------
-- The declared transition table
-- ---------------------------------------------------------------------------

select is(
  public.allowed_claim_transitions('closed'),
  '{}'::public.claim_status[],
  'a closed claim has nowhere left to go, which is what makes it terminal rather than merely final-looking'
);

select is(
  public.allowed_claim_transitions('rejected'),
  '{}'::public.claim_status[],
  'a rejected intake is terminal, so a declined homeowner can never be quietly revived into an active claim'
);

select is(
  public.allowed_claim_transitions('filed'),
  array['negotiating', 'denied']::public.claim_status[],
  'a filed claim can only move to negotiation or denial, so the carrier stage cannot be skipped'
);

-- ---------------------------------------------------------------------------
-- The happy path, one step at a time, with the illegal shortcut refused at each
-- ---------------------------------------------------------------------------

insert into public.claims (
  id, property_street, property_city, property_zip,
  carrier, policy_number, carrier_tenure, loss_date, cause, description
) values (
  '21000000-0000-4000-a000-000000000003', '13 Lifecycle Way', 'Oviedo', '32765',
  'Test Carrier', 'POL-LIFE-1', 'three_plus_years', current_date - 20, 'hail', 'lifecycle probe'
);

select throws_ok(
  $$ update public.claims set status = 'settled'
      where id = '21000000-0000-4000-a000-000000000003' $$,
  '23514'::char(5), null::text,
  'a brand new intake cannot be jumped straight to settled, so no single compromised write can fabricate a payout'
);

select lives_ok(
  $$ update public.claims set status = 'under_review'
      where id = '21000000-0000-4000-a000-000000000003' $$,
  'staff can take a new intake into review, the one move the machine allows from there'
);

select lives_ok(
  $$ update public.claims set status = 'lor_sent'
      where id = '21000000-0000-4000-a000-000000000003' $$,
  'a reviewed intake can have its letter of representation sent'
);

select throws_ok(
  $$ update public.claims set status = 'lor_signed'
      where id = '21000000-0000-4000-a000-000000000003' $$,
  '23514'::char(5), null::text,
  'representation cannot be declared signed while no signed letter exists, so CMG can never appear to represent a homeowner it has no authority for'
);

insert into public.documents (claim_id, storage_path, original_name, kind, mime, size_bytes)
values (
  '21000000-0000-4000-a000-000000000003',
  'claims/21000000-0000-4000-a000-000000000003/aaaaaaaa-0000-4000-a000-000000000001.jpg',
  'roof.jpg', 'photo', 'image/jpeg', 4096
);

select throws_ok(
  $$ update public.claims set status = 'lor_signed'
      where id = '21000000-0000-4000-a000-000000000003' $$,
  '23514'::char(5), null::text,
  'uploading any other document does not satisfy the gate: the check is for a signed letter specifically, not for file activity on the claim'
);

insert into public.documents (claim_id, storage_path, original_name, kind, mime, size_bytes)
values (
  '21000000-0000-4000-a000-000000000003',
  'claims/21000000-0000-4000-a000-000000000003/aaaaaaaa-0000-4000-a000-000000000002.pdf',
  'lor-signed.pdf', 'lor_signed', 'application/pdf', 8192
);

select lives_ok(
  $$ update public.claims set status = 'lor_signed'
      where id = '21000000-0000-4000-a000-000000000003' $$,
  'once the signed letter is on file the same transition is permitted, so the gate blocks the claim rather than the workflow'
);

select ok(
  (select lor_signed_at is not null from public.claims where id = '21000000-0000-4000-a000-000000000003'),
  'the moment representation began is stamped by the database, so the retainer date cannot be backdated by the application'
);

select throws_ok(
  $$ update public.claims set status = 'filed'
      where id = '21000000-0000-4000-a000-000000000003' $$,
  '23514'::char(5), null::text,
  'a claim cannot be filed with the carrier straight from signature: the documenting stage cannot be skipped'
);

select lives_ok(
  $$ update public.claims set status = 'documenting'
      where id = '21000000-0000-4000-a000-000000000003' $$,
  'evidence gathering follows signature'
);

select lives_ok(
  $$ update public.claims set status = 'filed'
      where id = '21000000-0000-4000-a000-000000000003' $$,
  'a documented claim can be filed with the carrier'
);

select ok(
  (select filed_at is not null from public.claims where id = '21000000-0000-4000-a000-000000000003'),
  'the filing date is stamped by the database, which is the date statutory deadlines are counted from'
);

select throws_ok(
  $$ update public.claims set status = 'settled'
      where id = '21000000-0000-4000-a000-000000000003' $$,
  '23514'::char(5), null::text,
  'a filed claim cannot be marked settled without an offer ever having been recorded'
);

select lives_ok(
  $$ update public.claims set status = 'negotiating'
      where id = '21000000-0000-4000-a000-000000000003' $$,
  'a filed claim moves into negotiation'
);

select lives_ok(
  $$ update public.claims set status = 'settlement_offered'
      where id = '21000000-0000-4000-a000-000000000003' $$,
  'negotiation produces a recorded offer'
);

select lives_ok(
  $$ update public.claims set status = 'settled'
      where id = '21000000-0000-4000-a000-000000000003' $$,
  'an offer can be accepted, and only from the state where an offer exists'
);

select ok(
  (select settled_at is not null from public.claims where id = '21000000-0000-4000-a000-000000000003'),
  'the settlement date is stamped by the database, which is what the partner projection and the fee calculation key off'
);

select lives_ok(
  $$ update public.claims set status = 'closed'
      where id = '21000000-0000-4000-a000-000000000003' $$,
  'a settled claim can be closed out'
);

select throws_ok(
  $$ update public.claims set status = 'reopened'
      where id = '21000000-0000-4000-a000-000000000003' $$,
  '23514'::char(5), null::text,
  'a closed claim is genuinely closed: no state, not even reopened, is reachable from it'
);

-- ---------------------------------------------------------------------------
-- The denial branch, and insert-time milestone stamping
-- ---------------------------------------------------------------------------

insert into public.claims (
  id, status, property_street, property_city, property_zip,
  carrier, policy_number, carrier_tenure, loss_date, cause, description
) values (
  '21000000-0000-4000-a000-000000000004', 'filed', '14 Denial Rd', 'Sanford', '32771',
  'Test Carrier', 'POL-DENY-1', 'one_to_two_years', current_date - 40, 'water', 'denial branch probe'
);

select ok(
  (select filed_at is not null from public.claims where id = '21000000-0000-4000-a000-000000000004'),
  'a claim imported directly at the filed stage still has its filing date stamped, so migrated records are not left without a deadline anchor'
);

select lives_ok(
  $$ update public.claims set status = 'denied'
      where id = '21000000-0000-4000-a000-000000000004' $$,
  'a carrier denial is a recognised outcome of a filed claim'
);

select ok(
  (select denied_at is not null from public.claims where id = '21000000-0000-4000-a000-000000000004'),
  'the denial date is stamped by the database, which starts the clock on the homeowner''s appeal rights'
);

select lives_ok(
  $$ update public.claims set status = 'reopened'
      where id = '21000000-0000-4000-a000-000000000004' $$,
  'a denied claim can be reopened rather than being a dead end'
);

select lives_ok(
  $$ update public.claims set status = 'negotiating'
      where id = '21000000-0000-4000-a000-000000000004' $$,
  'a reopened claim rejoins the process at negotiation'
);

select throws_ok(
  $$ update public.claims set status = 'settled'
      where id = '21000000-0000-4000-a000-000000000004' $$,
  '23514'::char(5), null::text,
  'the reopened path is held to the same rule as the first pass: settlement still requires a recorded offer first'
);

insert into public.claims (
  id, status, property_street, property_city, property_zip,
  carrier, policy_number, carrier_tenure, loss_date, cause, description
) values (
  '21000000-0000-4000-a000-000000000005', 'settled', '15 Import Ct', 'Longwood', '32750',
  'Test Carrier', 'POL-IMPORT-1', 'three_plus_years', current_date - 90, 'hurricane', 'import stamping probe'
);

select ok(
  (select settled_at is not null from public.claims where id = '21000000-0000-4000-a000-000000000005'),
  'a claim imported directly as settled still has its settlement date stamped rather than being left null'
);

-- ---------------------------------------------------------------------------
-- The rejection branch
-- ---------------------------------------------------------------------------

insert into public.claims (
  id, property_street, property_city, property_zip,
  carrier, policy_number, carrier_tenure, loss_date, cause, description
) values (
  '21000000-0000-4000-a000-000000000006', '16 Decline Dr', 'Casselberry', '32707',
  'Test Carrier', 'POL-REJECT-1', 'lt_1_year', current_date - 3, 'mold', 'rejection branch probe'
);

select lives_ok(
  $$ update public.claims set status = 'rejected'
      where id = '21000000-0000-4000-a000-000000000006' $$,
  'staff can decline an intake outright'
);

select throws_ok(
  $$ update public.claims set status = 'under_review'
      where id = '21000000-0000-4000-a000-000000000006' $$,
  '23514'::char(5), null::text,
  'a declined intake cannot be revived, so a rejected homeowner is never silently taken on without a fresh submission'
);

select * from finish();
rollback;
