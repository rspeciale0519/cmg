-- CMG Property Solutions — the partner projection.
-- Partners hold a policy on claim_partner_summaries and on nothing else, so this
-- table is the entire partner attack surface. Two properties matter: the settlement
-- figure appears only once the claim is settled or closed, and the projection never
-- lags behind the claim it mirrors.

begin;
set local client_min_messages = warning;
create extension if not exists pgtap with schema extensions;

select plan(21);

-- ---------------------------------------------------------------------------
-- The security-relevant case: money already recorded, claim not yet settled
-- ---------------------------------------------------------------------------

select is(
  (select settlement_amount from public.claim_financials
    where claim_id = '20000000-0000-4000-a000-000000000001'),
  41250.00::numeric(12,2),
  'the unsettled claim genuinely has a settlement figure on file — this is what makes the next assertion a real test rather than a test of an empty table'
);

select is(
  (select status from public.claims where id = '20000000-0000-4000-a000-000000000001'),
  'settlement_offered'::public.claim_status,
  'that claim is still only at the offer stage, so nothing about it has been agreed'
);

select is(
  (select settlement_amount from public.claim_partner_summaries
    where claim_id = '20000000-0000-4000-a000-000000000001'),
  null::numeric(12,2),
  'the partner sees no figure while an offer is merely on the table, so a referring contractor cannot learn what the homeowner has been offered before the homeowner accepts it'
);

select is(
  (select settlement_amount from public.claim_partner_summaries
    where claim_id = '20000000-0000-4000-a000-000000000002'),
  128400.00::numeric(12,2),
  'once a claim is settled the figure is disclosed, which is what the referral commission is calculated from'
);

-- A freshly created claim that is mid-negotiation with money already recorded:
-- proves the suppression is re-derived on every write, not a one-off of the seed.

insert into public.claims (
  id, status, property_street, property_city, property_zip,
  carrier, policy_number, carrier_tenure, loss_date, cause, description, partner_company_id
) values (
  '22000000-0000-4000-a000-000000000001', 'negotiating', '21 Projection Ave', 'Winter Park', '32789',
  'Test Carrier', 'POL-PROJ-1', 'lt_1_year', current_date - 30, 'wind', 'projection probe',
  '10000000-0000-4000-a000-000000000001'
);

insert into public.claim_financials (claim_id, settlement_amount, fee_percent)
values ('22000000-0000-4000-a000-000000000001', 77000.00, 10.00);

select is(
  (select settlement_amount from public.claim_partner_summaries
    where claim_id = '22000000-0000-4000-a000-000000000001'),
  null::numeric(12,2),
  'writing a settlement figure onto an unsettled claim does not disclose it: the projection recomputes the suppression rather than copying whatever it is handed'
);

select isnt_empty(
  $$ select 1 from public.claim_partner_summaries
      where claim_id = '22000000-0000-4000-a000-000000000001' $$,
  'the partner still sees the claim itself, so suppressing the money does not cost them the progress view they are entitled to'
);

-- ---------------------------------------------------------------------------
-- The projection tracks status changes
-- ---------------------------------------------------------------------------

update public.claims set status = 'settlement_offered'
 where id = '22000000-0000-4000-a000-000000000001';

select is(
  (select settlement_amount from public.claim_partner_summaries
    where claim_id = '22000000-0000-4000-a000-000000000001'),
  null::numeric(12,2),
  'moving to the offer stage still discloses nothing, because an offer is not an agreement'
);

update public.claims set status = 'settled'
 where id = '22000000-0000-4000-a000-000000000001';

select is(
  (select settlement_amount from public.claim_partner_summaries
    where claim_id = '22000000-0000-4000-a000-000000000001'),
  77000.00::numeric(12,2),
  'the figure appears the instant the claim settles, with no separate refresh step for anyone to forget'
);

select is(
  (select status from public.claim_partner_summaries
    where claim_id = '22000000-0000-4000-a000-000000000001'),
  'settled'::public.claim_status,
  'the status the partner sees is the status the claim actually has'
);

select ok(
  (select settled_at is not null from public.claim_partner_summaries
    where claim_id = '22000000-0000-4000-a000-000000000001'),
  'the settlement date travels with the figure, so the partner can reconcile the payment against a date'
);

update public.claims set status = 'closed'
 where id = '22000000-0000-4000-a000-000000000001';

select is(
  (select settlement_amount from public.claim_partner_summaries
    where claim_id = '22000000-0000-4000-a000-000000000001'),
  77000.00::numeric(12,2),
  'closing the claim keeps the figure visible, so a partner is not cut off from a number they were already owed'
);

-- ---------------------------------------------------------------------------
-- The projection tracks the money itself
-- ---------------------------------------------------------------------------

update public.claim_financials set settlement_amount = 90000.00
 where claim_id = '22000000-0000-4000-a000-000000000001';

select is(
  (select settlement_amount from public.claim_partner_summaries
    where claim_id = '22000000-0000-4000-a000-000000000001'),
  90000.00::numeric(12,2),
  'correcting the settlement figure reaches the partner view, so a partner is never reconciling against a stale number'
);

delete from public.claim_financials where claim_id = '22000000-0000-4000-a000-000000000001';

select is(
  (select settlement_amount from public.claim_partner_summaries
    where claim_id = '22000000-0000-4000-a000-000000000001'),
  null::numeric(12,2),
  'withdrawing the financial record withdraws it from the partner view too, rather than leaving an orphaned figure behind'
);

-- ---------------------------------------------------------------------------
-- The projection tracks the claimants
-- ---------------------------------------------------------------------------

select is(
  (select homeowner_name from public.claim_partner_summaries
    where claim_id = '20000000-0000-4000-a000-000000000001'),
  'Marcus Bell',
  'the partner sees the primary homeowner by name, which is how they recognise their own referral'
);

update public.claimants set last_name = 'Bellweather'
 where id = '30000000-0000-4000-a000-000000000001';

select is(
  (select homeowner_name from public.claim_partner_summaries
    where claim_id = '20000000-0000-4000-a000-000000000001'),
  'Marcus Bellweather',
  'renaming a homeowner reaches the partner view, so a correction made in the office is not invisible to the referrer'
);

insert into public.claims (
  id, property_street, property_city, property_zip,
  carrier, policy_number, carrier_tenure, loss_date, cause, description, partner_company_id
) values (
  '22000000-0000-4000-a000-000000000002', '22 Late Claimant St', 'Apopka', '32703',
  'Test Carrier', 'POL-PROJ-2', 'lt_1_year', current_date - 2, 'wind', 'late claimant probe',
  '10000000-0000-4000-a000-000000000001'
);

select is(
  (select homeowner_name from public.claim_partner_summaries
    where claim_id = '22000000-0000-4000-a000-000000000002'),
  null::text,
  'a claim created before its homeowner rows exist simply has no name yet, rather than failing to project at all'
);

insert into public.claimants (claim_id, first_name, last_name, email, initials, is_primary)
values ('22000000-0000-4000-a000-000000000002', 'Renata', 'Cole', 'renata.cole@example.test', 'RC', true);

select is(
  (select homeowner_name from public.claim_partner_summaries
    where claim_id = '22000000-0000-4000-a000-000000000002'),
  'Renata Cole',
  'adding the homeowner afterwards fills the name in, which is what intake actually does: claim first, claimants second'
);

-- ---------------------------------------------------------------------------
-- Membership: only partner-linked claims are projected at all
-- ---------------------------------------------------------------------------

insert into public.claims (
  id, property_street, property_city, property_zip,
  carrier, policy_number, carrier_tenure, loss_date, cause, description
) values (
  '22000000-0000-4000-a000-000000000003', '23 No Partner Way', 'Maitland', '32751',
  'Test Carrier', 'POL-PROJ-3', 'lt_1_year', current_date - 1, 'wind', 'unlinked claim probe'
);

select is_empty(
  $$ select 1 from public.claim_partner_summaries
      where claim_id = '22000000-0000-4000-a000-000000000003' $$,
  'a claim with no referring company is never projected, so a direct homeowner is not exposed to a contractor who had nothing to do with them'
);

update public.claims set partner_company_id = '10000000-0000-4000-a000-000000000001'
 where id = '22000000-0000-4000-a000-000000000003';

select isnt_empty(
  $$ select 1 from public.claim_partner_summaries
      where claim_id = '22000000-0000-4000-a000-000000000003' $$,
  'attributing a claim to a referring company projects it, so a referral recorded late still reaches the partner portal'
);

update public.claims set partner_company_id = null
 where id = '22000000-0000-4000-a000-000000000003';

select is_empty(
  $$ select 1 from public.claim_partner_summaries
      where claim_id = '22000000-0000-4000-a000-000000000003' $$,
  'removing the attribution removes the projection row entirely, so revoking a partner''s interest actually revokes their access rather than merely hiding a link'
);

select is(
  (select partner_company_id from public.claim_partner_summaries
    where claim_id = '20000000-0000-4000-a000-000000000002'),
  '10000000-0000-4000-a000-000000000001'::uuid,
  'each projected row names the company it belongs to, which is the single column the partner read policy filters on'
);

select * from finish();
rollback;
