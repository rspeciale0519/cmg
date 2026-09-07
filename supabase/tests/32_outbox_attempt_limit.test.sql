-- A worker death must spend an attempt without permitting a sixth delivery.
begin;
set local client_min_messages = warning;
create extension if not exists pgtap with schema extensions;
select plan(24);

insert into public.notifications_outbox
  (id, recipient_email, template, payload, status, attempts, next_attempt_at, sent_at)
values
  ('32000000-0000-4000-a000-000000000001', 'final@example.test', 'lead_auto_reply', '{}', 'pending', 4, now() - interval '4 minutes', null),
  ('32000000-0000-4000-a000-000000000002', 'expired-pending@example.test', 'lead_auto_reply', '{}', 'pending', 5, now() - interval '3 minutes', null),
  ('32000000-0000-4000-a000-000000000003', 'expired-failed@example.test', 'lead_auto_reply', '{}', 'failed', 5, now() - interval '2 minutes', null),
  ('32000000-0000-4000-a000-000000000004', 'legacy@example.test', 'lead_auto_reply', '{}', 'failed', 8, now() - interval '1 minute', null),
  ('32000000-0000-4000-a000-000000000005', 'active-pending@example.test', 'lead_auto_reply', '{}', 'pending', 5, now() + interval '1 hour', null),
  ('32000000-0000-4000-a000-000000000006', 'active-failed@example.test', 'lead_auto_reply', '{}', 'failed', 5, now() + interval '1 hour', null),
  ('32000000-0000-4000-a000-000000000007', 'sent@example.test', 'lead_auto_reply', '{}', 'sent', 5, now() - interval '1 minute', now()),
  ('32000000-0000-4000-a000-000000000008', 'dead@example.test', 'lead_auto_reply', '{}', 'dead', 5, now() - interval '1 minute', null),
  ('32000000-0000-4000-a000-000000000009', 'outside-filter@example.test', 'lead_auto_reply', '{}', 'pending', 5, now() - interval '1 minute', null),
  ('32000000-0000-4000-a000-000000000010', 'unclaimed@example.test', 'lead_auto_reply', '{}', 'pending', 0, now() - interval '1 minute', null);

set local role service_role;

select is(
  (select count(*)::integer from public.claim_outbox_batch(10, 300, array[
    '32000000-0000-4000-a000-000000000002',
    '32000000-0000-4000-a000-000000000003',
    '32000000-0000-4000-a000-000000000004'
  ]::uuid[])),
  0,
  'expired fifth attempts and legacy over-limit attempts are never returned for delivery'
);
select is(
  (select count(*)::integer from public.notifications_outbox
   where id in ('32000000-0000-4000-a000-000000000002',
                '32000000-0000-4000-a000-000000000003',
                '32000000-0000-4000-a000-000000000004') and status = 'dead'),
  3,
  'expired pending and failed rows become dead after their last permitted attempt'
);
select is(
  (select sum(attempts)::integer from public.notifications_outbox
   where id in ('32000000-0000-4000-a000-000000000002',
                '32000000-0000-4000-a000-000000000003',
                '32000000-0000-4000-a000-000000000004')),
  18,
  'crash recovery does not spend another delivery attempt'
);
select is(
  (select count(*)::integer from public.notifications_outbox
   where id in ('32000000-0000-4000-a000-000000000002',
                '32000000-0000-4000-a000-000000000003',
                '32000000-0000-4000-a000-000000000004')
     and last_error = 'Delivery worker lease expired during the final permitted attempt.'),
  3,
  'terminal rows record the expired worker lease for operator recovery'
);
select is(
  (select status::text from public.notifications_outbox
   where id = '32000000-0000-4000-a000-000000000009'),
  'pending',
  'p_ids also limits terminal recovery, so public-only sweeps leave other rows unchanged'
);

select is(
  (select count(*)::integer from public.claim_outbox_batch(10, 300, array[
    '32000000-0000-4000-a000-000000000005',
    '32000000-0000-4000-a000-000000000006'
  ]::uuid[])),
  0,
  'a fifth attempt with an active lease cannot be claimed'
);
select is(
  (select string_agg(status::text, ',' order by id) from public.notifications_outbox
   where id in ('32000000-0000-4000-a000-000000000005',
                '32000000-0000-4000-a000-000000000006')),
  'pending,failed',
  'active leases remain available for the current worker to settle'
);

select is(
  (select attempts from public.claim_outbox_batch(1, 300,
    array['32000000-0000-4000-a000-000000000001']::uuid[])),
  5,
  'attempt four can still claim the fifth and final delivery'
);
select ok(
  (select next_attempt_at > now() and status = 'pending'
   from public.notifications_outbox where id = '32000000-0000-4000-a000-000000000001'),
  'the final attempt installs the normal lease without changing delivery status'
);
select is(
  (select count(*)::integer from public.claim_outbox_batch(1, 300,
    array['32000000-0000-4000-a000-000000000001']::uuid[])),
  0,
  'another worker cannot take the final attempt during its lease'
);
update public.notifications_outbox set next_attempt_at = now() - interval '1 second'
where id = '32000000-0000-4000-a000-000000000001';
select is(
  (select count(*)::integer from public.claim_outbox_batch(1, 300,
    array['32000000-0000-4000-a000-000000000001']::uuid[])),
  0,
  'the expired final attempt is not returned for a sixth send'
);
select ok(
  (select status = 'dead' and attempts = 5 from public.notifications_outbox
   where id = '32000000-0000-4000-a000-000000000001'),
  'the crashed final attempt remains recorded at exactly five attempts'
);

select is(
  (select count(*)::integer from public.claim_outbox_batch(10, 300, array[
    '32000000-0000-4000-a000-000000000007',
    '32000000-0000-4000-a000-000000000008'
  ]::uuid[])),
  0,
  'sent and dead rows remain terminal even with expired timestamps'
);
select is(
  (select string_agg(status::text, ',' order by id) from public.notifications_outbox
   where id in ('32000000-0000-4000-a000-000000000007',
                '32000000-0000-4000-a000-000000000008')),
  'sent,dead',
  'terminal recovery never changes a completed delivery outcome'
);
select is(
  (select count(*)::integer from public.claim_outbox_batch(10, 300, array[]::uuid[])),
  0,
  'an empty p_ids array performs no delivery work'
);
select is(
  (select string_agg(status::text || ':' || attempts::text, ',' order by id)
   from public.notifications_outbox where id in (
     '32000000-0000-4000-a000-000000000009', '32000000-0000-4000-a000-000000000010')),
  'pending:5,pending:0',
  'an empty p_ids array also performs no terminal recovery'
);

select is(
  (select count(*)::integer from public.claim_outbox_batch(0, 300, array[
    '32000000-0000-4000-a000-000000000009',
    '32000000-0000-4000-a000-000000000010'
  ]::uuid[])),
  0,
  'a zero limit returns no deliveries'
);
select is(
  (select string_agg(status::text || ':' || attempts::text, ',' order by id)
   from public.notifications_outbox where id in (
     '32000000-0000-4000-a000-000000000009', '32000000-0000-4000-a000-000000000010')),
  'pending:5,pending:0',
  'a zero limit changes neither an exhausted row nor a fresh row'
);

insert into public.notifications_outbox
  (id, recipient_email, template, payload, status, attempts, next_attempt_at)
values
  ('32000000-0000-4000-a000-000000000013', 'budget-a@example.test', 'lead_auto_reply', '{}', 'pending', 5, now() - interval '4 minutes'),
  ('32000000-0000-4000-a000-000000000014', 'budget-b@example.test', 'lead_auto_reply', '{}', 'failed', 5, now() - interval '3 minutes'),
  ('32000000-0000-4000-a000-000000000015', 'budget-c@example.test', 'lead_auto_reply', '{}', 'pending', 5, now() - interval '2 minutes'),
  ('32000000-0000-4000-a000-000000000016', 'budget-fresh@example.test', 'lead_auto_reply', '{}', 'pending', 0, now() - interval '1 minute');

select is(
  (select count(*)::integer from public.claim_outbox_batch(2, 300, array[
    '32000000-0000-4000-a000-000000000013', '32000000-0000-4000-a000-000000000014',
    '32000000-0000-4000-a000-000000000015', '32000000-0000-4000-a000-000000000016'
  ]::uuid[])),
  0,
  'terminal recovery consumes the same two-row batch budget as delivery claims'
);
select is(
  (select count(*)::integer from public.notifications_outbox where id in (
    '32000000-0000-4000-a000-000000000013', '32000000-0000-4000-a000-000000000014',
    '32000000-0000-4000-a000-000000000015') and status = 'dead'),
  2,
  'one call cannot terminalize more rows than its batch limit'
);
select is(
  (select attempts from public.notifications_outbox
   where id = '32000000-0000-4000-a000-000000000016'),
  0,
  'a full recovery batch leaves fresh mail for the next worker'
);
select is(
  (select count(*)::integer from public.claim_outbox_batch(2, 300, array[
    '32000000-0000-4000-a000-000000000013', '32000000-0000-4000-a000-000000000014',
    '32000000-0000-4000-a000-000000000015', '32000000-0000-4000-a000-000000000016'
  ]::uuid[])),
  1,
  'unused recovery capacity claims fresh mail in the same call'
);
select is(
  (select string_agg(status::text || ':' || attempts::text, ',' order by id)
   from public.notifications_outbox where id in (
     '32000000-0000-4000-a000-000000000015', '32000000-0000-4000-a000-000000000016')),
  'dead:5,pending:1',
  'only fresh mail spends a delivery attempt in the mixed batch'
);
select is(
  (select count(*)::integer from public.claim_outbox_batch(2, 300, array[
    '32000000-0000-4000-a000-000000000013', '32000000-0000-4000-a000-000000000014',
    '32000000-0000-4000-a000-000000000015', '32000000-0000-4000-a000-000000000016'
  ]::uuid[])),
  0,
  'a following worker cannot repeat terminal recovery or take an active delivery lease'
);

reset role;
select * from finish();
rollback;
