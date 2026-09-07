-- CMG Property Solutions — a claim cannot say it has sent a letter it could not address
--
-- Phase 6 made `carrier` and `policy_number` nullable so a partner referral could state
-- that nobody was asked, and closed the gap at accept. Accept is not the only door out of
-- `new_intake`: the status picker takes a claim to `under_review` on its own, and from
-- there `lor_sent` is one legal move — at which point the Letter of Representation is
-- drafted from `claims.carrier`. This file pins the gate that closes that route, in the
-- same trigger function that already refuses `lor_signed` without a signed letter.
--
-- Every assertion here is about the DATABASE's refusal, under the service role, with RLS
-- and the whole application out of the picture. That is the point: the application refuses
-- it first, in a sentence, and the trigger is what still refuses a writer that has none of
-- the application's checks — the LOR dispatch holds a service-role client and bypasses
-- every policy in this schema.
--
-- Rows added here live inside the file's own transaction and are rolled back with it, so
-- the absolute counts other files assert are untouched.
--
--   referral   24000000-0000-4000-a000-000000000001  no carrier, no policy number
--   complete   24000000-0000-4000-a000-000000000002  both present, the control

begin;
set local client_min_messages = warning;
create extension if not exists pgtap with schema extensions;

select plan(12);

-- ---------------------------------------------------------------------------
-- Two claims: one as a referral writes it, one as the public intake writes it
-- ---------------------------------------------------------------------------

insert into public.claims (
  id, status, property_street, property_city, property_zip,
  carrier, policy_number, carrier_tenure, loss_date, loss_time, cause, description
) values (
  '24000000-0000-4000-a000-000000000001', 'new_intake', '4 Referral Row', 'Sanford', '32771',
  null, null, null, current_date - 6, null, 'wind',
  'Referred from site: ridge cap gone, water in the hallway.'
), (
  '24000000-0000-4000-a000-000000000002', 'new_intake', '5 Complete Ct', 'Sanford', '32771',
  'Citizens Property Insurance', 'FL-CPI-4410', 'three_plus_years', current_date - 6, time '09:15', 'wind',
  'Filed by the homeowner with the policy in hand.'
);

-- ---------------------------------------------------------------------------
-- The route the application takes, and where it stops
-- ---------------------------------------------------------------------------

select lives_ok(
  $$ update public.claims set status = 'under_review'
      where id = '24000000-0000-4000-a000-000000000001' $$,
  'a referral can still be taken into review with no policy side: review is when CMG works out whether it wants the claim, and refusing that would be refusing the triage the referral exists for'
);

select throws_ok(
  $$ update public.claims set status = 'lor_sent'
      where id = '24000000-0000-4000-a000-000000000001' $$,
  '23514'::char(5), null::text,
  'but it cannot say a letter of representation has been sent: the letter is addressed to the carrier and cites the policy, and this claim names neither'
);

select is(
  (select status from public.claims where id = '24000000-0000-4000-a000-000000000001'),
  'under_review'::public.claim_status,
  'and the refusal leaves the claim where it was, so a blocked move is not a half-made one'
);

-- Half the answer is still no. The letter names both, and a policy number without an
-- insurer to send it to is the failure that would read as success on the screen.
update public.claims set carrier = 'Citizens Property Insurance'
 where id = '24000000-0000-4000-a000-000000000001';

select throws_ok(
  $$ update public.claims set status = 'lor_sent'
      where id = '24000000-0000-4000-a000-000000000001' $$,
  '23514'::char(5), null::text,
  'a carrier on its own does not open the gate — the letter cites a policy number and there is not one'
);

update public.claims set policy_number = '   '
 where id = '24000000-0000-4000-a000-000000000001';

select throws_ok(
  $$ update public.claims set status = 'lor_sent'
      where id = '24000000-0000-4000-a000-000000000001' $$,
  '23514'::char(5), null::text,
  'nor does whitespace: no CHECK constrains these columns to be non-blank, so a gate that only asked `is not null` could be opened by pressing the space bar'
);

update public.claims set policy_number = 'FL-CPI-9902'
 where id = '24000000-0000-4000-a000-000000000001';

select lives_ok(
  $$ update public.claims set status = 'lor_sent'
      where id = '24000000-0000-4000-a000-000000000001' $$,
  'and once both are recorded the move goes through, so the gate is a condition to satisfy rather than a status a referral can never reach'
);

-- ---------------------------------------------------------------------------
-- The control: nothing changed for a claim that arrived complete
-- ---------------------------------------------------------------------------

select lives_ok(
  $$ update public.claims set status = 'under_review'
      where id = '24000000-0000-4000-a000-000000000002' $$,
  'a claim filed on /file-a-claim carries all of this from the homeowner and moves as it always did'
);

select lives_ok(
  $$ update public.claims set status = 'lor_sent'
      where id = '24000000-0000-4000-a000-000000000002' $$,
  'including to lor_sent, which is the assertion that this gate costs the ordinary path nothing'
);

-- ---------------------------------------------------------------------------
-- What is NOT gated, and the reasons are not symmetry
-- ---------------------------------------------------------------------------

select is(
  (select carrier_tenure from public.claims where id = '24000000-0000-4000-a000-000000000001'),
  null::public.carrier_tenure,
  'the letter went out on a claim with no carrier tenure: how long the homeowner has held the policy is a triage fact CMG asks after, and the letter asserts nothing about it'
);

select is(
  (select loss_time from public.claims where id = '24000000-0000-4000-a000-000000000001'),
  null::time,
  'and with no time of loss: the letter carries the date, which is NOT NULL, and a referral that was never asked for a time must not have one invented to satisfy a gate'
);

-- ---------------------------------------------------------------------------
-- The gate this one was modelled on is still there
-- ---------------------------------------------------------------------------

select throws_ok(
  $$ update public.claims set status = 'lor_signed'
      where id = '24000000-0000-4000-a000-000000000001' $$,
  '23514'::char(5), null::text,
  'representation still cannot be declared signed while no signed letter is on the file — the new gate was added beside §5''s, not in place of it'
);

select throws_ok(
  $$ update public.claims set status = 'settled'
      where id = '24000000-0000-4000-a000-000000000002' $$,
  '23514'::char(5), null::text,
  'and the transition table itself is unchanged: lor_sent still cannot jump to settled'
);

select * from finish();
rollback;
