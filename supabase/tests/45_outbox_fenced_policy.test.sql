-- The test uses only its own rows and rolls back all changes.
begin;
set local client_min_messages = warning;
create extension if not exists pgtap with schema extensions;
select plan(34);

insert into public.notifications_outbox
  (id, recipient_email, template, payload, status, attempts, next_attempt_at)
values
  ('45000000-0000-4000-a000-000000000001', 'owner@example.test',
   'lead_auto_reply', '{}', 'pending', 0, now() - interval '1 minute');

create function pg_temp.take_fenced_claim() returns uuid
language plpgsql as $$
declare result uuid;
begin
  execute 'select lease_token from public.claim_outbox_batch_v2($1, $2, $3, $4)'
    into result using 1, 300, array['45000000-0000-4000-a000-000000000001']::uuid[],
      array['lead_auto_reply']::text[];
  return result;
exception when undefined_function then
  return null;
end;
$$;
create function pg_temp.finish_fenced_claim(p_token uuid, p_outcome text) returns boolean
language plpgsql as $$
declare result boolean;
begin
  execute 'select public.settle_outbox_claim_v2($1, $2, $3, $4, $5)'
    into result using '45000000-0000-4000-a000-000000000001'::uuid,
      p_token, p_outcome, 'policy unavailable'::text, null::integer;
  return result;
exception when undefined_function then
  return false;
end;
$$;
create function pg_temp.ready_fenced_claim(p_token uuid) returns boolean
language plpgsql as $$
declare result boolean;
begin
  execute 'select public.outbox_claim_ready_v2($1, $2, $3)'
    into result using '45000000-0000-4000-a000-000000000001'::uuid, p_token, 'owner@example.test'::text;
  return result;
exception when undefined_function then
  return false;
end;
$$;

set local role service_role;
create temporary table local_lease as select pg_temp.take_fenced_claim() as token;
select isnt((select token from local_lease), null::uuid, 'the allowed row receives a claim token');
select is(pg_temp.ready_fenced_claim((select token from local_lease)), true,
  'the active token and exact allowed recipient pass the final pre-send check');
select is(pg_temp.ready_fenced_claim('45000000-0000-4000-a000-000000000099'), false,
  'a stale token cannot pass the final pre-send check');
select throws_ok(
  $$ update public.notifications_outbox set recipient_email = 'changed@example.test'
     where id = '45000000-0000-4000-a000-000000000001' $$,
  'P0001', 'recipient cannot change while a claim is active',
  'recipient changes cannot race an active claim'
);
select throws_ok(
  $$ update public.email_recipient_policy set blocked_domains = array['cmgpropertysolutions.net', 'example.test'] $$,
  'P0001', 'recipient policy cannot change while a claim is active',
  'policy changes cannot race an active claim'
);
select is(pg_temp.finish_fenced_claim('45000000-0000-4000-a000-000000000099', 'held'), false,
  'an unrelated token cannot settle another worker claim');
select is(pg_temp.finish_fenced_claim((select token from local_lease), 'held'), true,
  'the owning token can hold a policy failure');
select is((select attempts from public.notifications_outbox where id = '45000000-0000-4000-a000-000000000001'),
  0, 'a held policy failure restores the reserved attempt');
select is((select to_jsonb(o)->>'hold_reason' from public.notifications_outbox o where id = '45000000-0000-4000-a000-000000000001'),
  'recipient-policy-check', 'the held row remains visible for reviewed recovery');

update public.notifications_outbox set recipient_email = 'corrected@example.test'
where id = '45000000-0000-4000-a000-000000000001';
select is((select count(*)::integer from public.claim_outbox_batch_v2(1, 300,
  array['45000000-0000-4000-a000-000000000001']::uuid[], null)),
  0, 'changing a recipient does not automatically release a held row');

insert into public.notifications_outbox
  (id, recipient_email, template, payload, status, attempts, next_attempt_at)
values
  ('45000000-0000-4000-a000-000000000002', 'next@example.test',
   'lead_auto_reply', '{}', 'pending', 0, now() - interval '1 minute'),
  ('45000000-0000-4000-a000-000000000003', 'other@example.test',
   'claim_status_update', '{}', 'pending', 0, now() - interval '3 minutes');
create temporary table local_expiring_lease as
select lease_token as token from public.claim_outbox_batch_v2(1, 1,
  array['45000000-0000-4000-a000-000000000002']::uuid[], array['lead_auto_reply']::text[]);
update public.notifications_outbox set next_attempt_at = now() - interval '1 second'
where id = '45000000-0000-4000-a000-000000000002';
select is((select count(*)::integer from public.claim_outbox_batch_v2(1, 300,
  array['45000000-0000-4000-a000-000000000002']::uuid[], null)), 0,
  'an expired uncertain claim is not automatically retried');
select is((select hold_reason from public.notifications_outbox where id = '45000000-0000-4000-a000-000000000002'),
  'expired-lease-uncertain', 'the expired claim is held for review');
select is((select attempts from public.notifications_outbox where id = '45000000-0000-4000-a000-000000000002'),
  1, 'an uncertain claim does not blindly refund a possible provider attempt');
select is(public.settle_outbox_claim_v2('45000000-0000-4000-a000-000000000002',
  (select token from local_expiring_lease), 'sent', null, null), false,
  'a stale worker cannot settle an expired held claim');

insert into public.notifications_outbox
  (id, recipient_email, template, payload, status, attempts, next_attempt_at)
values ('45000000-0000-4000-a000-000000000004', 'third@example.test',
  'lead_auto_reply', '{}', 'pending', 0, now() - interval '1 minute');
select is((select id from public.claim_outbox_batch_v2(1, 300, array[
  '45000000-0000-4000-a000-000000000003', '45000000-0000-4000-a000-000000000004'
]::uuid[], array['lead_auto_reply']::text[])),
  '45000000-0000-4000-a000-000000000004'::uuid,
  'template filtering occurs before the batch limit');
select ok(not has_function_privilege('authenticated',
  'public.settle_outbox_claim_v2(uuid,uuid,text,text,integer)', 'execute'),
  'authenticated callers cannot settle delivery claims');
select ok(not has_function_privilege('service_role',
  'public.claim_outbox_batch(integer,integer,uuid[])', 'execute'),
  'legacy unfenced workers cannot claim a fenced row');
select ok(not has_function_privilege('anon',
  'public.claim_outbox_batch_v2(integer,integer,uuid[],text[])', 'execute'),
  'anonymous callers cannot claim delivery work');
select ok(has_function_privilege('service_role',
  'public.claim_outbox_batch_v2(integer,integer,uuid[],text[])', 'execute'),
  'the service role can use the fenced claim');

insert into public.notifications_outbox
  (id, recipient_email, template, payload, status, attempts, next_attempt_at)
values ('45000000-0000-4000-a000-000000000005', 'last@example.test',
  'lead_auto_reply', '{}', 'pending', 4, now() - interval '1 minute');
create temporary table local_final_lease as
select lease_token as token from public.claim_outbox_batch_v2(1, 1,
  array['45000000-0000-4000-a000-000000000005']::uuid[], null);
update public.notifications_outbox set next_attempt_at = now() - interval '1 second'
where id = '45000000-0000-4000-a000-000000000005';
select is((select count(*)::integer from public.claim_outbox_batch_v2(1, 300,
  array['45000000-0000-4000-a000-000000000005']::uuid[], null)), 0,
  'an expired fifth attempt is not returned for automatic delivery');
select is((select status::text from public.notifications_outbox where id = '45000000-0000-4000-a000-000000000005'),
  'pending', 'an uncertain fifth attempt is held, not dead-lettered');
select is((select attempts from public.notifications_outbox where id = '45000000-0000-4000-a000-000000000005'),
  5, 'an uncertain fifth attempt is not blindly refunded');

update public.notifications_outbox set lease_token = '45000000-0000-4000-a000-000000000098'
where id = '45000000-0000-4000-a000-000000000004';
select is(public.settle_outbox_claim_v2('45000000-0000-4000-a000-000000000004',
  '45000000-0000-4000-a000-000000000099', 'sent', null, null), false,
  'a stale token cannot settle a newer active claim');
select is(public.settle_outbox_claim_v2('45000000-0000-4000-a000-000000000004',
  '45000000-0000-4000-a000-000000000098', 'failed', 'confirmed failure', 60), true,
  'the active token can schedule a confirmed provider failure');

insert into public.notifications_outbox
  (id, recipient_email, template, payload, status, attempts, next_attempt_at, lease_token)
values ('45000000-0000-4000-a000-000000000007', 'unknown@example.test',
  'lead_auto_reply', '{}', 'pending', 1, now() + interval '1 minute',
  '45000000-0000-4000-a000-000000000097');
select is(public.settle_outbox_claim_v2('45000000-0000-4000-a000-000000000007',
  '45000000-0000-4000-a000-000000000097', 'uncertain', 'unknown outcome', null), true,
  'the owning token holds an uncertain provider result');
select is((select attempts from public.notifications_outbox where id = '45000000-0000-4000-a000-000000000007'),
  1, 'an uncertain provider result does not refund its attempt');
select is((select hold_reason from public.notifications_outbox where id = '45000000-0000-4000-a000-000000000007'),
  'provider-outcome-unknown', 'an uncertain provider result remains held for review');
select throws_ok($$ update public.email_recipient_policy set blocked_domains = array['example.test'] $$,
  'P0001'::char(5), null::text, 'uncertain sends block policy changes until review and sender shutdown');
select throws_ok($$ update public.notifications_outbox set recipient_email = 'new@example.test'
  where id = '45000000-0000-4000-a000-000000000007' $$,
  'P0001'::char(5), null::text, 'uncertain sends block recipient changes until review and sender shutdown');
update public.notifications_outbox set hold_reason = 'reviewed-test-only'
where id in ('45000000-0000-4000-a000-000000000002', '45000000-0000-4000-a000-000000000005', '45000000-0000-4000-a000-000000000007');

update public.email_recipient_policy set blocked_domains = array['cmgpropertysolutions.net', 'only-policy-check.invalid'];
insert into public.notifications_outbox
  (id, recipient_email, template, payload, status, attempts, next_attempt_at)
values ('45000000-0000-4000-a000-000000000006', 'person@only-policy-check.invalid',
  'lead_auto_reply', '{}', 'pending', 0, now() - interval '1 minute');
update public.email_recipient_policy set blocked_domains = array['cmgpropertysolutions.net'];
select is((select hold_reason from public.notifications_outbox where id = '45000000-0000-4000-a000-000000000006'),
  'recipient-policy', 'policy removal does not clear the durable hold');
select is((select count(*)::integer from public.claim_outbox_batch_v2(1, 300,
  array['45000000-0000-4000-a000-000000000006']::uuid[], null)), 0,
  'policy removal cannot automatically send a previously blocked row');
select is(public.email_recipient_allowed('person@NOTcmgpropertysolutions.net'), true,
  'a similar but distinct domain is not blocked by suffix matching');
select is(public.email_recipient_allowed('person..name@example.test'), false,
  'invalid repeated dots in the local part fail closed');
select is(public.email_recipient_allowed('person@example..test'), false,
  'invalid repeated dots in the domain fail closed');

select * from finish();
rollback;
