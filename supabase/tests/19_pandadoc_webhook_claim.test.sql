-- Crash-safe PandaDoc webhook lease and service-role boundary.

begin;
set local client_min_messages = warning;
create extension if not exists pgtap with schema extensions;

select plan(15);

select function_privs_are(
  'public', 'claim_pandadoc_webhook_event', array['uuid','text','uuid','integer'],
  'service_role', array['EXECUTE'], 'service role can claim webhook deliveries'
);
select function_privs_are(
  'public', 'claim_pandadoc_webhook_event', array['uuid','text','uuid','integer'],
  'authenticated', array[]::text[], 'authenticated cannot claim webhook deliveries'
);
select function_privs_are(
  'public', 'complete_pandadoc_webhook_event', array['uuid','uuid','jsonb'],
  'service_role', array['EXECUTE'], 'service role can complete webhook deliveries'
);
select function_privs_are(
  'public', 'release_pandadoc_webhook_event', array['uuid','uuid','text'],
  'authenticated', array[]::text[], 'authenticated cannot release webhook deliveries'
);

select is(
  public.claim_pandadoc_webhook_event(
    '39000000-0000-4000-a000-000000000001', 'hash-a',
    '39000000-0000-4000-a000-000000000011', 120
  )->>'status', 'claimed', 'first delivery owns the lease'
);
select is(
  public.claim_pandadoc_webhook_event(
    '39000000-0000-4000-a000-000000000001', 'hash-a',
    '39000000-0000-4000-a000-000000000012', 120
  )->>'status', 'busy', 'concurrent delivery does not share the lease'
);
select is(
  public.claim_pandadoc_webhook_event(
    '39000000-0000-4000-a000-000000000001', 'hash-b',
    '39000000-0000-4000-a000-000000000013', 120
  )->>'status', 'conflict', 'same event id cannot change payload while busy'
);

select is(
  public.complete_pandadoc_webhook_event(
    '39000000-0000-4000-a000-000000000001',
    '39000000-0000-4000-a000-000000000012', '{"count":1}'::jsonb
  ), false, 'a non-owner token cannot complete the lease'
);
select is(
  public.complete_pandadoc_webhook_event(
    '39000000-0000-4000-a000-000000000001',
    '39000000-0000-4000-a000-000000000011', '{"count":1}'::jsonb
  ), true, 'the owner token completes the lease'
);
select is(
  public.claim_pandadoc_webhook_event(
    '39000000-0000-4000-a000-000000000001', 'hash-a',
    '39000000-0000-4000-a000-000000000014', 120
  )->>'status', 'duplicate', 'completed matching bytes are duplicates'
);
select is(
  public.claim_pandadoc_webhook_event(
    '39000000-0000-4000-a000-000000000001', 'hash-b',
    '39000000-0000-4000-a000-000000000015', 120
  )->>'status', 'conflict', 'completed event ids cannot be reused for new bytes'
);

select is(
  public.claim_pandadoc_webhook_event(
    '39000000-0000-4000-a000-000000000002', 'hash-c',
    '39000000-0000-4000-a000-000000000021', 120
  )->>'status', 'claimed', 'second delivery starts claimed'
);
update public.pandadoc_webhook_events
   set received_at = now() - interval '3 minutes'
 where event_id = '39000000-0000-4000-a000-000000000002';
select is(
  public.claim_pandadoc_webhook_event(
    '39000000-0000-4000-a000-000000000002', 'hash-c',
    '39000000-0000-4000-a000-000000000022', 120
  )->>'status', 'claimed', 'expired processing lease is reclaimed'
);
select is(
  (select payload_summary->>'_attempts' from public.pandadoc_webhook_events
    where event_id = '39000000-0000-4000-a000-000000000002'),
  '2', 'reclaim increments the persisted attempt count'
);

select is(
  public.release_pandadoc_webhook_event(
    '39000000-0000-4000-a000-000000000002',
    '39000000-0000-4000-a000-000000000022', 'injected failure'
  ), true, 'lease owner can release a failed delivery for retry'
);

select * from finish();
rollback;
