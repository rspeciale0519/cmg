-- CMG Property Solutions — deterministic development seed
-- Applied by `supabase db reset`. Every id is fixed so tests can hard-code them.
-- Password for every seeded account: CmgDev!2026
--
--   owner@cmg.test      Austin Graham        role owner
--   adjuster@cmg.test   Dana Reyes           role adjuster   (assigned both demo claims)
--   assistant@cmg.test  Priya Nolan          role assistant
--   customer@cmg.test   Marcus Bell          role customer   (primary claimant, claim 1)
--   partner@cmg.test    Tyler Boone          role partner    (Summit Exteriors LLC)
--
--   claim 1  CMG-2026-0001  settlement_offered  — financials exist, partner projection
--                                                 must still show settlement_amount NULL
--   claim 2  CMG-2026-0002  settled             — partner projection shows the figure

begin;

-- ---------------------------------------------------------------------------
-- Idempotent reset of seeded rows (db reset already starts clean; this keeps
-- the file safe to re-run against a warm database)
-- ---------------------------------------------------------------------------

delete from public.claims where id in (
  '20000000-0000-4000-a000-000000000001',
  '20000000-0000-4000-a000-000000000002'
);
delete from public.leads where id = '90000000-0000-4000-a000-000000000001';
-- Consents now survive their claim (`on delete set null`), so the reset has to name
-- them explicitly or a re-run would leave detached snapshots behind.
delete from public.consents where id in (
  '80000000-0000-4000-a000-000000000001',
  '80000000-0000-4000-a000-000000000002'
);
truncate table public.storage_cleanup_queue restart identity;
delete from auth.users where id in (
  '00000000-0000-4000-a000-000000000001',
  '00000000-0000-4000-a000-000000000002',
  '00000000-0000-4000-a000-000000000003',
  '00000000-0000-4000-a000-000000000004',
  '00000000-0000-4000-a000-000000000005'
);
delete from public.partner_companies where id = '10000000-0000-4000-a000-000000000001';
delete from public.claim_ref_counters;
truncate table public.audit_log restart identity;

-- ---------------------------------------------------------------------------
-- Partner company
-- ---------------------------------------------------------------------------

insert into public.partner_companies (id, name, status, contact_name, contact_email, contact_phone)
values (
  '10000000-0000-4000-a000-000000000001',
  'Summit Exteriors LLC',
  'active',
  'Tyler Boone',
  'partner@cmg.test',
  '407-555-0142'
);

-- ---------------------------------------------------------------------------
-- Auth users (profiles rows are created by the on_auth_user_created trigger)
-- ---------------------------------------------------------------------------

insert into auth.users (
  instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
  raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
  confirmation_token, recovery_token, email_change_token_new, email_change
)
select
  '00000000-0000-0000-0000-000000000000',
  u.id,
  'authenticated',
  'authenticated',
  u.email,
  extensions.crypt('CmgDev!2026', extensions.gen_salt('bf')),
  now(),
  '{"provider":"email","providers":["email"]}'::jsonb,
  jsonb_build_object('first_name', u.first_name, 'last_name', u.last_name),
  now(), now(), '', '', '', ''
from (values
  ('00000000-0000-4000-a000-000000000001'::uuid, 'owner@cmg.test',     'Austin', 'Graham'),
  ('00000000-0000-4000-a000-000000000002'::uuid, 'adjuster@cmg.test',  'Dana',   'Reyes'),
  ('00000000-0000-4000-a000-000000000003'::uuid, 'assistant@cmg.test', 'Priya',  'Nolan'),
  ('00000000-0000-4000-a000-000000000004'::uuid, 'customer@cmg.test',  'Marcus', 'Bell'),
  ('00000000-0000-4000-a000-000000000005'::uuid, 'partner@cmg.test',   'Tyler',  'Boone')
) as u(id, email, first_name, last_name);

insert into auth.identities (id, user_id, provider_id, provider, identity_data, last_sign_in_at, created_at, updated_at)
select
  i.identity_id,
  u.id,
  u.id::text,
  'email',
  jsonb_build_object(
    'sub', u.id::text,
    'email', u.email,
    'email_verified', true,
    'phone_verified', false
  ),
  now(), now(), now()
from auth.users u
join (values
  ('00000000-0000-4000-a000-000000000001'::uuid, '70000000-0000-4000-a000-000000000001'::uuid),
  ('00000000-0000-4000-a000-000000000002'::uuid, '70000000-0000-4000-a000-000000000002'::uuid),
  ('00000000-0000-4000-a000-000000000003'::uuid, '70000000-0000-4000-a000-000000000003'::uuid),
  ('00000000-0000-4000-a000-000000000004'::uuid, '70000000-0000-4000-a000-000000000004'::uuid),
  ('00000000-0000-4000-a000-000000000005'::uuid, '70000000-0000-4000-a000-000000000005'::uuid)
) as i(user_id, identity_id) on i.user_id = u.id;

-- Roles are assigned here, never by the signup trigger (spec §4).
update public.profiles set role = 'owner', phone = '407-488-5728'
  where id = '00000000-0000-4000-a000-000000000001';
update public.profiles set role = 'adjuster', phone = '407-555-0110'
  where id = '00000000-0000-4000-a000-000000000002';
update public.profiles set role = 'assistant', phone = '407-555-0111'
  where id = '00000000-0000-4000-a000-000000000003';
update public.profiles set role = 'customer', phone = '407-555-0188'
  where id = '00000000-0000-4000-a000-000000000004';
update public.profiles
   set role = 'partner',
       partner_company_id = '10000000-0000-4000-a000-000000000001',
       phone = '407-555-0142'
  where id = '00000000-0000-4000-a000-000000000005';

-- ---------------------------------------------------------------------------
-- Demo claim 1 — CMG-2026-0001, settlement_offered
-- ---------------------------------------------------------------------------

insert into public.claims (
  id, status,
  property_street, property_street2, property_city, property_state, property_zip,
  carrier, policy_number, carrier_tenure, prior_roof_claim, prior_outcome, claim_number,
  loss_date, loss_time, cause, description,
  assigned_adjuster_id, partner_company_id,
  requested_adjuster, referrer_name, referrer_email,
  lor_signed_at, filed_at,
  created_at, updated_at
)
values (
  '20000000-0000-4000-a000-000000000001',
  'settlement_offered',
  '1420 Sandhill Crane Dr', 'Unit B', 'Winter Springs', 'Florida', '32708',
  'Citizens Property Insurance', 'FL-CPI-8841203', 'three_plus_years', false, null, 'CPI-2026-114820',
  date '2026-05-18', time '15:30', 'wind_hail',
  'Hurricane-force wind and hail stripped shingles across the south slope; active leaks in the primary bedroom and hallway ceiling.',
  '00000000-0000-4000-a000-000000000002',
  '10000000-0000-4000-a000-000000000001',
  'austin-graham', 'Summit Exteriors LLC — Tyler Boone', 'partner@cmg.test',
  timestamptz '2026-05-26 14:05:00-04', timestamptz '2026-06-09 10:20:00-04',
  timestamptz '2026-05-22 09:14:00-04', now()
);

insert into public.claimants (id, claim_id, first_name, last_name, email, phone, initials, is_primary, user_id, created_at)
values
  ('30000000-0000-4000-a000-000000000001', '20000000-0000-4000-a000-000000000001',
   'Marcus', 'Bell', 'customer@cmg.test', '407-555-0188', 'MB', true,
   '00000000-0000-4000-a000-000000000004', timestamptz '2026-05-22 09:14:00-04'),
  ('30000000-0000-4000-a000-000000000002', '20000000-0000-4000-a000-000000000001',
   'Alicia', 'Bell', 'alicia.bell@example.test', '407-555-0189', 'AB', false,
   null, timestamptz '2026-05-22 09:14:00-04');

insert into public.claim_financials (claim_id, settlement_amount, fee_percent, notes, updated_by, created_at, updated_at)
values (
  '20000000-0000-4000-a000-000000000001',
  41250.00, 10.00,
  'Carrier offer on the table; roof replacement plus interior repairs still disputed.',
  '00000000-0000-4000-a000-000000000002',
  timestamptz '2026-07-14 11:00:00-04', timestamptz '2026-07-14 11:00:00-04'
);

insert into public.claim_status_history (id, claim_id, from_status, to_status, changed_by, note, created_at)
values
  ('60000000-0000-4000-a000-000000000001', '20000000-0000-4000-a000-000000000001', null, 'new_intake',
   null, 'Intake received from the public form.', timestamptz '2026-05-22 09:14:00-04'),
  ('60000000-0000-4000-a000-000000000002', '20000000-0000-4000-a000-000000000001', 'new_intake', 'under_review',
   '00000000-0000-4000-a000-000000000001', 'Accepted; assigned to Dana Reyes.', timestamptz '2026-05-23 08:40:00-04'),
  ('60000000-0000-4000-a000-000000000003', '20000000-0000-4000-a000-000000000001', 'under_review', 'lor_sent',
   '00000000-0000-4000-a000-000000000002', 'LOR sent to both homeowners for e-signature.', timestamptz '2026-05-24 16:02:00-04'),
  ('60000000-0000-4000-a000-000000000004', '20000000-0000-4000-a000-000000000001', 'lor_sent', 'lor_signed',
   '00000000-0000-4000-a000-000000000002', 'All parties signed.', timestamptz '2026-05-26 14:05:00-04'),
  ('60000000-0000-4000-a000-000000000005', '20000000-0000-4000-a000-000000000001', 'lor_signed', 'documenting',
   '00000000-0000-4000-a000-000000000002', 'Inspection booked, photo set in progress.', timestamptz '2026-05-27 09:00:00-04'),
  ('60000000-0000-4000-a000-000000000006', '20000000-0000-4000-a000-000000000001', 'documenting', 'filed',
   '00000000-0000-4000-a000-000000000002', 'Filed with Citizens.', timestamptz '2026-06-09 10:20:00-04'),
  ('60000000-0000-4000-a000-000000000007', '20000000-0000-4000-a000-000000000001', 'filed', 'negotiating',
   '00000000-0000-4000-a000-000000000002', 'Carrier assigned a field adjuster.', timestamptz '2026-06-25 13:45:00-04'),
  ('60000000-0000-4000-a000-000000000008', '20000000-0000-4000-a000-000000000001', 'negotiating', 'settlement_offered',
   '00000000-0000-4000-a000-000000000002', 'Offer received; reviewing scope shortfalls.', timestamptz '2026-07-14 11:00:00-04');

insert into public.claim_events (id, claim_id, type, body, author_id, visibility, created_at)
values
  ('40000000-0000-4000-a000-000000000001', '20000000-0000-4000-a000-000000000001', 'system',
   'Intake received and queued for review.', null, 'shared', timestamptz '2026-05-22 09:14:00-04'),
  ('40000000-0000-4000-a000-000000000002', '20000000-0000-4000-a000-000000000001', 'status',
   'Representation confirmed — all parties signed the Letter of Representation.',
   '00000000-0000-4000-a000-000000000002', 'shared', timestamptz '2026-05-26 14:06:00-04'),
  ('40000000-0000-4000-a000-000000000003', '20000000-0000-4000-a000-000000000001', 'note',
   'Interior moisture readings attached to the file; ordering a supplemental estimate.',
   '00000000-0000-4000-a000-000000000003', 'internal', timestamptz '2026-06-02 15:22:00-04'),
  ('40000000-0000-4000-a000-000000000004', '20000000-0000-4000-a000-000000000001', 'question',
   'Do we need to move furniture out of the primary bedroom before the inspection?',
   '00000000-0000-4000-a000-000000000004', 'customer', timestamptz '2026-06-03 18:40:00-04'),
  ('40000000-0000-4000-a000-000000000005', '20000000-0000-4000-a000-000000000001', 'reply',
   'No — just clear a walking path. The inspector works around furniture.',
   '00000000-0000-4000-a000-000000000002', 'customer', timestamptz '2026-06-04 08:05:00-04'),
  ('40000000-0000-4000-a000-000000000006', '20000000-0000-4000-a000-000000000001', 'status',
   'Claim filed with the carrier.', '00000000-0000-4000-a000-000000000002', 'shared',
   timestamptz '2026-06-09 10:21:00-04');

insert into public.documents (id, claim_id, storage_path, original_name, kind, mime, size_bytes, uploaded_by, visibility, created_at)
values
  ('50000000-0000-4000-a000-000000000001', '20000000-0000-4000-a000-000000000001',
   'claims/20000000-0000-4000-a000-000000000001/5e1a0c66-1f3a-4d7e-9a51-0f0b7c3d0001.pdf',
   'declarations-page.pdf', 'declarations', 'application/pdf', 284419,
   '00000000-0000-4000-a000-000000000003', 'customer', timestamptz '2026-05-22 09:15:00-04'),
  ('50000000-0000-4000-a000-000000000002', '20000000-0000-4000-a000-000000000001',
   'claims/20000000-0000-4000-a000-000000000001/5e1a0c66-1f3a-4d7e-9a51-0f0b7c3d0002.jpg',
   'south-slope-01.jpg', 'photo', 'image/jpeg', 1904332,
   '00000000-0000-4000-a000-000000000002', 'internal', timestamptz '2026-05-27 12:31:00-04'),
  ('50000000-0000-4000-a000-000000000003', '20000000-0000-4000-a000-000000000001',
   'claims/20000000-0000-4000-a000-000000000001/5e1a0c66-1f3a-4d7e-9a51-0f0b7c3d0003.pdf',
   'letter-of-representation-signed.pdf', 'lor_signed', 'application/pdf', 512044,
   '00000000-0000-4000-a000-000000000002', 'customer', timestamptz '2026-05-26 14:05:00-04');

insert into public.consents (id, claim_id, lead_id, email, phone, kind, consent_text, granted_at, ip, created_at)
values
  ('80000000-0000-4000-a000-000000000001', '20000000-0000-4000-a000-000000000001', null,
   'customer@cmg.test', '407-555-0188', 'sms',
   'I consent to receive SMS and email communications from CMG Property Solutions at the phone number and email address I provided. Message frequency varies; message & data rates may apply. Reply STOP to unsubscribe, HELP for help. I can unsubscribe from email at any time.',
   timestamptz '2026-05-22 09:14:00-04', '203.0.113.24', timestamptz '2026-05-22 09:14:00-04'),
  ('80000000-0000-4000-a000-000000000002', '20000000-0000-4000-a000-000000000001', null,
   'customer@cmg.test', '407-555-0188', 'email',
   'I consent to receive SMS and email communications from CMG Property Solutions at the phone number and email address I provided. Message frequency varies; message & data rates may apply. Reply STOP to unsubscribe, HELP for help. I can unsubscribe from email at any time.',
   timestamptz '2026-05-22 09:14:00-04', '203.0.113.24', timestamptz '2026-05-22 09:14:00-04');

-- ---------------------------------------------------------------------------
-- Demo claim 2 — CMG-2026-0002, settled
-- ---------------------------------------------------------------------------

insert into public.claims (
  id, status,
  property_street, property_city, property_state, property_zip,
  carrier, policy_number, carrier_tenure, prior_roof_claim, prior_outcome, claim_number,
  loss_date, loss_time, cause, description,
  assigned_adjuster_id, partner_company_id,
  requested_adjuster, referrer_name, referrer_email,
  lor_signed_at, filed_at, settled_at,
  created_at, updated_at
)
values (
  '20000000-0000-4000-a000-000000000002',
  'settled',
  '87 Palmetto Ridge Ct', 'Oviedo', 'Florida', '32765',
  'Universal Property & Casualty', 'UPC-5520914', 'one_to_two_years', true, 'paid_no_repairs', 'UPC-2026-77410',
  date '2026-02-11', time '07:45', 'hurricane',
  'Hurricane band tore the ridge cap and lifted decking on the rear elevation; water intrusion through the kitchen ceiling.',
  '00000000-0000-4000-a000-000000000002',
  '10000000-0000-4000-a000-000000000001',
  'austin-graham', 'Summit Exteriors LLC — Tyler Boone', 'partner@cmg.test',
  -- settled_at is passed explicitly: the insert trigger would otherwise stamp it
  -- now(), leaving the claim's own settlement date years adrift from the history row
  -- and the financials record that both put it at 2026-06-18.
  timestamptz '2026-02-19 11:30:00-05', timestamptz '2026-03-04 09:10:00-05',
  timestamptz '2026-06-18 16:40:00-04',
  timestamptz '2026-02-14 13:02:00-05', now()
);

insert into public.claimants (id, claim_id, first_name, last_name, email, phone, initials, is_primary, user_id, created_at)
values (
  '30000000-0000-4000-a000-000000000003', '20000000-0000-4000-a000-000000000002',
  'Elena', 'Whitfield', 'elena.whitfield@example.test', '407-555-0170', 'EW', true,
  null, timestamptz '2026-02-14 13:02:00-05'
);

insert into public.claim_financials (claim_id, settlement_amount, fee_percent, notes, updated_by, created_at, updated_at)
values (
  '20000000-0000-4000-a000-000000000002',
  128400.00, 10.00,
  'Full roof replacement plus interior scope agreed after supplemental estimate.',
  '00000000-0000-4000-a000-000000000001',
  timestamptz '2026-06-18 16:40:00-04', timestamptz '2026-06-18 16:40:00-04'
);

insert into public.claim_status_history (id, claim_id, from_status, to_status, changed_by, note, created_at)
values
  ('60000000-0000-4000-a000-000000000101', '20000000-0000-4000-a000-000000000002', null, 'new_intake',
   null, 'Referred by Summit Exteriors.', timestamptz '2026-02-14 13:02:00-05'),
  ('60000000-0000-4000-a000-000000000102', '20000000-0000-4000-a000-000000000002', 'new_intake', 'under_review',
   '00000000-0000-4000-a000-000000000001', 'Accepted.', timestamptz '2026-02-15 09:00:00-05'),
  ('60000000-0000-4000-a000-000000000103', '20000000-0000-4000-a000-000000000002', 'under_review', 'lor_sent',
   '00000000-0000-4000-a000-000000000002', 'LOR sent.', timestamptz '2026-02-17 10:15:00-05'),
  ('60000000-0000-4000-a000-000000000104', '20000000-0000-4000-a000-000000000002', 'lor_sent', 'lor_signed',
   '00000000-0000-4000-a000-000000000002', 'Signed and countersigned.', timestamptz '2026-02-19 11:30:00-05'),
  ('60000000-0000-4000-a000-000000000105', '20000000-0000-4000-a000-000000000002', 'lor_signed', 'documenting',
   '00000000-0000-4000-a000-000000000002', 'Scope and photo set assembled.', timestamptz '2026-02-20 08:30:00-05'),
  ('60000000-0000-4000-a000-000000000106', '20000000-0000-4000-a000-000000000002', 'documenting', 'filed',
   '00000000-0000-4000-a000-000000000002', 'Filed with UPC.', timestamptz '2026-03-04 09:10:00-05'),
  ('60000000-0000-4000-a000-000000000107', '20000000-0000-4000-a000-000000000002', 'filed', 'negotiating',
   '00000000-0000-4000-a000-000000000002', 'Desk review opened.', timestamptz '2026-03-25 14:00:00-04'),
  ('60000000-0000-4000-a000-000000000108', '20000000-0000-4000-a000-000000000002', 'negotiating', 'settlement_offered',
   '00000000-0000-4000-a000-000000000002', 'Offer received.', timestamptz '2026-05-30 15:20:00-04'),
  ('60000000-0000-4000-a000-000000000109', '20000000-0000-4000-a000-000000000002', 'settlement_offered', 'settled',
   '00000000-0000-4000-a000-000000000001', 'Settlement accepted by the homeowner.', timestamptz '2026-06-18 16:40:00-04');

insert into public.claim_events (id, claim_id, type, body, author_id, visibility, created_at)
values
  ('40000000-0000-4000-a000-000000000101', '20000000-0000-4000-a000-000000000002', 'system',
   'Referral received from Summit Exteriors LLC.', null, 'partner', timestamptz '2026-02-14 13:02:00-05'),
  ('40000000-0000-4000-a000-000000000102', '20000000-0000-4000-a000-000000000002', 'status',
   'Representation confirmed — Letter of Representation fully executed.',
   '00000000-0000-4000-a000-000000000002', 'shared', timestamptz '2026-02-19 11:31:00-05'),
  ('40000000-0000-4000-a000-000000000103', '20000000-0000-4000-a000-000000000002', 'note',
   'Prior claim history pulled; carrier paid in 2024 with no repairs completed.',
   '00000000-0000-4000-a000-000000000002', 'internal', timestamptz '2026-02-21 10:05:00-05'),
  ('40000000-0000-4000-a000-000000000104', '20000000-0000-4000-a000-000000000002', 'status',
   'Claim settled.', '00000000-0000-4000-a000-000000000001', 'shared', timestamptz '2026-06-18 16:41:00-04');

insert into public.documents (id, claim_id, storage_path, original_name, kind, mime, size_bytes, uploaded_by, visibility, created_at)
values
  ('50000000-0000-4000-a000-000000000101', '20000000-0000-4000-a000-000000000002',
   'claims/20000000-0000-4000-a000-000000000002/9c2f5b10-77aa-4c0e-8f2b-1a4d6e8f0101.pdf',
   'letter-of-representation-signed.pdf', 'lor_signed', 'application/pdf', 498210,
   '00000000-0000-4000-a000-000000000002', 'customer', timestamptz '2026-02-19 11:30:00-05'),
  ('50000000-0000-4000-a000-000000000102', '20000000-0000-4000-a000-000000000002',
   'claims/20000000-0000-4000-a000-000000000002/9c2f5b10-77aa-4c0e-8f2b-1a4d6e8f0102.pdf',
   'final-estimate.pdf', 'estimate', 'application/pdf', 1330855,
   '00000000-0000-4000-a000-000000000002', 'internal', timestamptz '2026-05-29 09:12:00-04');

-- ---------------------------------------------------------------------------
-- One contact-form lead for the admin inbox
-- ---------------------------------------------------------------------------

insert into public.leads (id, name, phone, email, message, status, ip, created_at, updated_at)
values (
  '90000000-0000-4000-a000-000000000001',
  'Rosa Delgado', '407-555-0133', 'rosa.delgado@example.test',
  'My roof started leaking after last week''s storm and the carrier has not called back. Can someone look at it?',
  'new', '198.51.100.77', timestamptz '2026-08-05 19:22:00-04', timestamptz '2026-08-05 19:22:00-04'
);

commit;
