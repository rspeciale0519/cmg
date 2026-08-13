-- An external send has no idempotency key. Once sending begins, ownership is
-- deliberately non-expiring until a human/provider event reconciles it.

begin;
select plan(18);

set local role service_role;

insert into public.claims (
  id, claim_ref, status, property_street, property_city, property_state,
  property_zip, carrier, policy_number, carrier_tenure, prior_roof_claim,
  loss_date, cause, description
) values (
  '23000000-0000-4000-8000-000000000001', 'CMG-2026-2301', 'under_review',
  '23 Lease Lane', 'Orlando', 'Florida', '32801', 'Citizens', 'POL-23',
  'lt_1_year', false, '2026-08-01', 'wind', 'dispatch lease regression'
);

select is(
  public.claim_esign_dispatch(
    '23000000-0000-4000-8000-000000000001',
    '23000000-0000-4000-8000-000000000011',
    '23000000-0000-4000-8000-000000000021',
    'pandadoc', null, 120
  )->>'status',
  'claimed',
  'first request owns the preparing lease'
);

select ok(
  public.mark_esign_dispatch_sending(
    '23000000-0000-4000-8000-000000000011',
    '23000000-0000-4000-8000-000000000021',
    'pd-provider-document-23'
  ),
  'the provider document is durably recorded before send'
);

select is(
  (select phase from public.esign_dispatch_attempts
    where request_id = '23000000-0000-4000-8000-000000000011'),
  'sending',
  'the irreversible provider phase is visible'
);

select is(
  (select provider_document_id from public.esign_dispatch_attempts
    where request_id = '23000000-0000-4000-8000-000000000011'),
  'pd-provider-document-23',
  'the possibly-sent document is traceable'
);

select is(
  (select pandadoc_document_id from public.claims
    where id = '23000000-0000-4000-8000-000000000001'),
  'pd-provider-document-23',
  'provider identity is current on the claim before external send'
);

select is(
  (select esign_active_attempt_token::text from public.claims
    where id = '23000000-0000-4000-8000-000000000001'),
  '23000000-0000-4000-8000-000000000021',
  'the active attempt token is current before external send'
);

select is(
  (select esign_status from public.claims
    where id = '23000000-0000-4000-8000-000000000001'),
  'document.sending',
  'staff see the truthful in-flight provider state'
);

update public.claims
   set esign_dispatch_started_at = now() - interval '121 seconds'
 where id = '23000000-0000-4000-8000-000000000001';

select is(
  public.claim_esign_dispatch(
    '23000000-0000-4000-8000-000000000001',
    '23000000-0000-4000-8000-000000000012',
    '23000000-0000-4000-8000-000000000022',
    'pandadoc', null, 120
  )->>'status',
  'busy',
  'a second request cannot take over after the old 120 second lease'
);

select is(
  (select count(*)::integer from public.esign_dispatch_attempts
    where claim_id = '23000000-0000-4000-8000-000000000001'),
  1,
  'no duplicate dispatch attempt is created'
);

select is(
  (select state from public.esign_dispatch_attempts
    where request_id = '23000000-0000-4000-8000-000000000011'),
  'processing',
  'the possibly-sent attempt is not falsely abandoned'
);

select is(
  (select esign_dispatch_token::text from public.claims
    where id = '23000000-0000-4000-8000-000000000001'),
  '23000000-0000-4000-8000-000000000021',
  'the original owner remains current for webhook reconciliation'
);

select ok(
  public.reconcile_esign_dispatch(
    '23000000-0000-4000-8000-000000000001',
    'pd-provider-document-23',
    '23000000-0000-4000-8000-000000000021',
    'delivered'
  ) = 'delivered',
  'a matching delivery proof reconciles the ambiguous send'
);

select is(
  (select status::text from public.claims
    where id = '23000000-0000-4000-8000-000000000001'),
  'lor_sent',
  'webhook reconciliation advances the workflow safely'
);

select is(
  (select esign_dispatch_token::text from public.claims
    where id = '23000000-0000-4000-8000-000000000001'),
  null,
  'webhook reconciliation releases dispatch ownership'
);

select is(
  (select state from public.esign_dispatch_attempts
    where request_id = '23000000-0000-4000-8000-000000000011'),
  'completed',
  'the reconciled attempt is durably completed'
);

select is(
  (select result->>'reconciled_by' from public.esign_dispatch_attempts
    where request_id = '23000000-0000-4000-8000-000000000011'),
  'pandadoc_webhook',
  'the reconciliation source remains auditable'
);

select is(
  (select count(*)::integer from public.claim_status_history
    where claim_id = '23000000-0000-4000-8000-000000000001'
      and from_status = 'under_review' and to_status = 'lor_sent'),
  1,
  'reconciliation records the workflow transition once'
);

select is(
  public.reconcile_esign_dispatch(
    '23000000-0000-4000-8000-000000000001',
    'wrong-document',
    '23000000-0000-4000-8000-000000000021',
    'delivered'
  ),
  'mismatch',
  'a mismatched completed replay cannot change the claim'
);

select * from finish();
rollback;
