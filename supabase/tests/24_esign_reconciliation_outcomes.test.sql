-- Webhook evidence controls reconciliation: non-proving events retain the
-- ambiguity lock, creation failures release it without claiming delivery.

begin;
select plan(12);
set local role service_role;

insert into public.claims (
  id, claim_ref, status, property_street, property_city, property_state,
  property_zip, carrier, policy_number, carrier_tenure, prior_roof_claim,
  loss_date, cause, description
) values
  ('24000000-0000-4000-8000-000000000001', 'CMG-2026-2401', 'under_review',
   '24 Pending Lane', 'Orlando', 'Florida', '32801', 'Citizens', 'POL-24A',
   'lt_1_year', false, '2026-08-01', 'wind', 'non-proving reconciliation'),
  ('24000000-0000-4000-8000-000000000002', 'CMG-2026-2402', 'under_review',
   '25 Failure Lane', 'Orlando', 'Florida', '32801', 'Citizens', 'POL-24B',
   'lt_1_year', false, '2026-08-01', 'wind', 'creation failure reconciliation');

select is(public.claim_esign_dispatch(
  '24000000-0000-4000-8000-000000000001', '24000000-0000-4000-8000-000000000011',
  '24000000-0000-4000-8000-000000000021', 'pandadoc', null, 120
)->>'status', 'claimed', 'pending fixture owns dispatch');
select ok(public.mark_esign_dispatch_sending(
  '24000000-0000-4000-8000-000000000011', '24000000-0000-4000-8000-000000000021',
  'pd-pending-24'), 'pending fixture reaches sending');
select is(public.reconcile_esign_dispatch(
  '24000000-0000-4000-8000-000000000001', 'pd-pending-24',
  '24000000-0000-4000-8000-000000000021', 'non_proving'
), 'retained', 'non-proving event retains ambiguity');
select is((select state from public.esign_dispatch_attempts where request_id =
  '24000000-0000-4000-8000-000000000011'), 'processing',
  'non-proving event does not falsely complete');
select is(public.reconcile_esign_dispatch(
  '24000000-0000-4000-8000-000000000001', 'pd-pending-24',
  '24000000-0000-4000-8000-000000000022', 'delivered'
), 'mismatch', 'mismatched token is rejected');
select is(public.reconcile_esign_dispatch(
  '24000000-0000-4000-8000-000000000001', 'pd-pending-24',
  '24000000-0000-4000-8000-000000000021', 'delivered'
), 'delivered', 'subsequent delivery proof reconciles');

select is(public.claim_esign_dispatch(
  '24000000-0000-4000-8000-000000000002', '24000000-0000-4000-8000-000000000012',
  '24000000-0000-4000-8000-000000000022', 'pandadoc', null, 120
)->>'status', 'claimed', 'failure fixture owns dispatch');
select ok(public.mark_esign_dispatch_sending(
  '24000000-0000-4000-8000-000000000012', '24000000-0000-4000-8000-000000000022',
  'pd-failed-24'), 'failure fixture reaches sending');
select is(public.reconcile_esign_dispatch(
  '24000000-0000-4000-8000-000000000002', 'pd-failed-24',
  '24000000-0000-4000-8000-000000000022', 'creation_failed'
), 'failed', 'creation failure settles failed');
select is((select status::text from public.claims where id =
  '24000000-0000-4000-8000-000000000002'), 'under_review',
  'creation failure does not advance to sent');
select is((select esign_dispatch_token::text from public.claims where id =
  '24000000-0000-4000-8000-000000000002'), null,
  'creation failure releases ownership');
select is((select count(*)::integer from public.claim_status_history where claim_id =
  '24000000-0000-4000-8000-000000000002' and to_status = 'lor_sent'), 0,
  'creation failure writes no sent history');

select * from finish();
rollback;
