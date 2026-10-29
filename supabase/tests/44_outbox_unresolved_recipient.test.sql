-- The reserved recipient marks a staff alert that needs operator review.
-- The transaction retains no fixture rows.
begin;
set local client_min_messages = warning;
create extension if not exists pgtap with schema extensions;
select plan(13);

insert into public.notifications_outbox
  (id, recipient_email, template, payload, status, attempts, next_attempt_at)
values
  ('44000000-0000-4000-a000-000000000001', 'unresolved-staff@invalid',
   'lead_staff_alert', '{}', 'pending', 0, now() - interval '2 minutes'),
  ('44000000-0000-4000-a000-000000000002', 'UNRESOLVED-STAFF@INVALID',
   'intake_staff_alert', '{}', 'failed', 5, now() - interval '3 minutes'),
  ('44000000-0000-4000-a000-000000000003', 'customer@example.test',
   'lead_auto_reply', '{}', 'pending', 0, now() - interval '1 minute'),
  ('44000000-0000-4000-a000-000000000004', 'person@CMGPROPERTYsolutions.net',
   'lead_auto_reply', '{}', 'pending', 0, now() - interval '3 minutes'),
  ('44000000-0000-4000-a000-000000000005', 'person@sub.cmgpropertysolutions.net',
   'lead_auto_reply', '{}', 'pending', 5, now() - interval '3 minutes');

set local role service_role;
select is(
  (select id from public.claim_outbox_batch_v2(1, 300, array[
    '44000000-0000-4000-a000-000000000001',
    '44000000-0000-4000-a000-000000000002',
    '44000000-0000-4000-a000-000000000004',
    '44000000-0000-4000-a000-000000000005',
    '44000000-0000-4000-a000-000000000003'
  ]::uuid[])),
  '44000000-0000-4000-a000-000000000003'::uuid,
  'unresolved rows cannot consume the batch or starve an allowed message'
);
select is(
  (select attempts from public.notifications_outbox where id = '44000000-0000-4000-a000-000000000001'),
  0, 'a held new alert does not spend an attempt'
);
select is(
  (select status::text from public.notifications_outbox where id = '44000000-0000-4000-a000-000000000002'),
  'failed', 'a held exhausted alert is not terminalized'
);
select is(
  (select attempts from public.notifications_outbox where id = '44000000-0000-4000-a000-000000000002'),
  5, 'a held exhausted alert retains its attempts'
);
select is(
  (select count(*)::integer from public.claim_outbox_batch_v2(10, 300, array[
    '44000000-0000-4000-a000-000000000001',
    '44000000-0000-4000-a000-000000000002'
  ]::uuid[])),
  0, 'an explicit ID list cannot claim a held alert'
);
select is(
  (select attempts from public.notifications_outbox where id = '44000000-0000-4000-a000-000000000003'),
  1, 'the allowed message still receives a lease'
);
select is(
  (select count(*)::integer from public.claim_outbox_batch_v2(10, 300, array[
    '44000000-0000-4000-a000-000000000004',
    '44000000-0000-4000-a000-000000000005'
  ]::uuid[])),
  0, 'the prohibited domain and its subdomains cannot be claimed'
);
select is(
  (select attempts from public.notifications_outbox where id = '44000000-0000-4000-a000-000000000004'),
  0, 'the prohibited address does not consume a delivery attempt'
);
select is(
  (select status::text from public.notifications_outbox where id = '44000000-0000-4000-a000-000000000005'),
  'pending', 'an exhausted prohibited address is held rather than terminalized'
);

create temporary table local_contact_result as
select public.submit_contact_transaction(
  '{"name":"Synthetic Hold Test","phone":"4075550100","email":"hold-test@example.test","message":"local fixture"}'::jsonb,
  '{"email":"hold-test@example.test","phone":"4075550100","kind":"email","consent_text":"local consent"}'::jsonb,
  '[{"recipient_email":"unresolved-staff@invalid","template":"lead_staff_alert","payload":{}},
    {"recipient_email":"hold-test@example.test","template":"lead_auto_reply","payload":{}}]'::jsonb
) as result;
select is(
  (select count(*)::integer from public.leads
   where id = ((select result->>'lead_id' from local_contact_result)::uuid)),
  1, 'the lead persists with an unresolved staff alert'
);
select is(
  (select count(*)::integer from public.consents
   where lead_id = ((select result->>'lead_id' from local_contact_result)::uuid)),
  1, 'the consent persists in the same contact submission'
);
select is(
  (select count(*)::integer from public.notifications_outbox
   where id in (
     select jsonb_array_elements_text(result->'outbox_ids')::uuid from local_contact_result
   ) and recipient_email = 'unresolved-staff@invalid'),
  1, 'the unresolved staff alert persists for review'
);
select is(
  (select count(*)::integer from public.claim_outbox_batch_v2(
     2, 300, array(select jsonb_array_elements_text(result->'outbox_ids')::uuid from local_contact_result)
   )),
  1, 'the customer reply can be claimed while the staff alert remains held'
);

select * from finish();
rollback;
