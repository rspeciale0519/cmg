-- ---------------------------------------------------------------------------
-- Fixtures: a third claim assigned to nobody (so "assigned only" is falsifiable),
-- and a pending invite (so "owner only" is falsifiable).
-- ---------------------------------------------------------------------------

insert into public.claims (
  id, property_street, property_city, property_zip,
  carrier, policy_number, carrier_tenure, loss_date, cause, description
) values (
  '20000000-0000-4000-a000-000000000003', '31 Unassigned Ln', 'Sanford', '32771',
  'Test Carrier', 'POL-UNASSIGNED-1', 'lt_1_year', current_date - 6, 'wind',
  'claim held in the intake queue with no adjuster and no referring company'
);

insert into public.invites (id, email, role, claim_id, token_hash, invited_by)
values (
  '70000000-0000-4000-a000-000000000001', 'invitee@example.test', 'customer', '20000000-0000-4000-a000-000000000001',
  'sha256-placeholder-hash', '00000000-0000-4000-a000-000000000001'
);

-- Sentinels deliberately outside every named fixture set below. These make a
-- global positive count fail while leaving an ID-scoped authorization assertion
-- unchanged, proving the suite tolerates legitimate shared-database rows.
insert into public.claims (
  id, property_street, property_city, property_zip, carrier, policy_number,
  carrier_tenure, loss_date, cause, description
) values (
  '29000000-0000-4000-a000-000000000001', '1 Sentinel Way', 'Orlando', '32801',
  'Sentinel Carrier', 'SENTINEL-POLICY', 'lt_1_year', current_date - 1, 'wind',
  'row outside the access-matrix fixture universe'
);
insert into public.claimants
  (id, claim_id, first_name, last_name, email, initials, is_primary)
values
  ('39000000-0000-4000-a000-000000000001','29000000-0000-4000-a000-000000000001',
   'Extra','Sentinel','extra-sentinel@example.test','ES',true);
insert into public.claim_financials (claim_id, settlement_amount, fee_percent)
values ('29000000-0000-4000-a000-000000000001', 1, 1);
insert into public.claim_events (id, claim_id, type, body, visibility)
values ('49000000-0000-4000-a000-000000000001','29000000-0000-4000-a000-000000000001',
        'note','sentinel event','internal');
insert into public.documents
  (id, claim_id, storage_path, original_name, kind, mime, size_bytes, visibility)
values ('59000000-0000-4000-a000-000000000001','29000000-0000-4000-a000-000000000001',
        'claims/29000000-0000-4000-a000-000000000001/sentinel.pdf','sentinel.pdf',
        'other','application/pdf',1,'internal');
insert into public.leads (id, name, phone, message)
values ('99000000-0000-4000-a000-000000000001','Extra Sentinel','4075550000','sentinel lead');

create temp table rls_probe (label text primary key, affected int);
grant all on table rls_probe to public;

-- ---------------------------------------------------------------------------
-- anon — the role a leaked publishable key runs as
-- ---------------------------------------------------------------------------

set local role anon;

select throws_ok(
  $$ select 1 from public.claims $$,
  '42501'::char(5), null::text,
  'an unauthenticated caller is refused at the grant layer before any policy is even consulted, so claims are not merely filtered from it — they are unreachable'
);

select throws_ok(
  $$ select 1 from public.claim_partner_summaries $$,
  '42501'::char(5), null::text,
  'the partner projection is equally unreachable without a session, so the referral view is not a public endpoint'
);

select set_config('request.jwt.claims', '', true);
reset role;
-- ---------------------------------------------------------------------------
-- customer — Marcus Bell, claimant on claim 1 only
-- ---------------------------------------------------------------------------

set local request.jwt.claims = '{"sub":"00000000-0000-4000-a000-000000000004","role":"authenticated"}';
set local role authenticated;

select results_eq(
  $$ select id::text from public.claims where id in
      ('20000000-0000-4000-a000-000000000001','20000000-0000-4000-a000-000000000002','20000000-0000-4000-a000-000000000003') order by id $$,
  $$ values ('20000000-0000-4000-a000-000000000001'::text) $$,
  'a homeowner sees the one claim they are a claimant on and no other, so the portal cannot be walked sideways into someone else''s file'
);

select is(
  (select count(*)::int from public.documents where id in
    ('50000000-0000-4000-a000-000000000001','50000000-0000-4000-a000-000000000002','50000000-0000-4000-a000-000000000003','50000000-0000-4000-a000-000000000101','50000000-0000-4000-a000-000000000102')),
  2,
  'the homeowner sees only the documents published to them, not every file on their own claim'
);

select is_empty(
  $$ select id from public.documents
      where visibility <> 'customer'
         or claim_id <> '20000000-0000-4000-a000-000000000001' $$,
  'nothing internal and nothing from another claim reaches the homeowner: internal photo sets and working notes stay internal'
);

select is(
  (select count(*)::int from public.claim_financials),
  0,
  'the homeowner cannot read the settlement record, so fee percentages and internal valuations are never exposed to the client'
);

select is(
  (select count(*)::int from public.claim_events where id in
    ('40000000-0000-4000-a000-000000000001','40000000-0000-4000-a000-000000000002','40000000-0000-4000-a000-000000000003','40000000-0000-4000-a000-000000000004','40000000-0000-4000-a000-000000000005','40000000-0000-4000-a000-000000000006','40000000-0000-4000-a000-000000000101','40000000-0000-4000-a000-000000000102','40000000-0000-4000-a000-000000000103','40000000-0000-4000-a000-000000000104')),
  5,
  'the homeowner sees the customer-facing and shared feed entries on their claim'
);

select is_empty(
  $$ select id from public.claim_events where visibility = 'internal' $$,
  'internal staff notes on the homeowner''s own claim remain invisible to them'
);

select is(
  (select count(*)::int from public.claimants where id in
    ('30000000-0000-4000-a000-000000000001','30000000-0000-4000-a000-000000000002','30000000-0000-4000-a000-000000000003')),
  2,
  'the homeowner sees the co-claimants on their own claim and nobody from any other claim'
);

select is(
  (select count(*)::int from public.leads),
  0,
  'the homeowner cannot read the contact-form inbox, which holds other people''s names and phone numbers'
);

select is(
  (select count(*)::int from public.claim_partner_summaries where claim_id in
    ('20000000-0000-4000-a000-000000000001','20000000-0000-4000-a000-000000000002','20000000-0000-4000-a000-000000000003')),
  0,
  'the homeowner cannot read the partner projection, so referral relationships are not disclosed to them'
);

select is(
  (select count(*)::int from public.audit_log),
  0,
  'the homeowner cannot read the audit trail'
);

with u as (
  update public.claims set status = 'settled'
   where id = '20000000-0000-4000-a000-000000000001'
  returning 1
)
insert into rls_probe select 'customer_status_update', count(*)::int from u;

select is(
  (select affected from rls_probe where label = 'customer_status_update'),
  0,
  'a homeowner cannot advance their own claim, so nobody can self-declare a settlement from the portal'
);

select throws_ok(
  $$ insert into public.claim_events (claim_id, type, body, author_id, visibility)
     values ('20000000-0000-4000-a000-000000000001', 'note', 'planted internal note',
             '00000000-0000-4000-a000-000000000004', 'internal') $$,
  '42501'::char(5), null::text,
  'a homeowner cannot post into the internal feed, so the staff-only channel cannot be reached by writing directly to the table'
);

select lives_ok(
  $$ insert into public.claim_events (claim_id, type, body, author_id, visibility)
     values ('20000000-0000-4000-a000-000000000001', 'question', 'When is the inspection?',
             '00000000-0000-4000-a000-000000000004', 'customer') $$,
  'a homeowner can still ask a question on their own claim, so the restriction shapes the channel rather than closing it'
);

select set_config('request.jwt.claims', '', true);
reset role;

-- ---------------------------------------------------------------------------
-- partner — Tyler Boone, Summit Exteriors LLC
-- ---------------------------------------------------------------------------

set local request.jwt.claims = '{"sub":"00000000-0000-4000-a000-000000000005","role":"authenticated"}';
set local role authenticated;

select is(
  (select count(*)::int from public.claims),
  0,
  'a referring contractor gets nothing at all from the claim record, so carrier, policy number and the homeowner''s account of the loss are structurally out of reach'
);

select is(
  (select count(*)::int from public.documents),
  0,
  'a referring contractor cannot see a single document on a claim they referred'
);

select is(
  (select count(*)::int from public.claimants),
  0,
  'a referring contractor cannot read homeowner contact rows, so the referral relationship does not hand them a marketing list'
);

select is(
  (select count(*)::int from public.claim_financials),
  0,
  'a referring contractor cannot read the financial record directly; the projection is their only route to a settlement figure'
);

select is(
  (select count(*)::int from public.claim_partner_summaries where claim_id in
    ('20000000-0000-4000-a000-000000000001','20000000-0000-4000-a000-000000000002','20000000-0000-4000-a000-000000000003')),
  2,
  'the referring contractor sees the two claims their company referred'
);

select is_empty(
  $$ select claim_id from public.claim_partner_summaries
      where partner_company_id <> '10000000-0000-4000-a000-000000000001' $$,
  'every projected row a contractor sees belongs to their own company, so one contractor cannot see another''s referrals'
);

select is(
  (select settlement_amount from public.claim_partner_summaries
    where claim_id = '20000000-0000-4000-a000-000000000001'),
  null::numeric(12,2),
  'reading through their own session, the contractor still sees no figure on the unsettled claim, even though one is recorded against it'
);

select is(
  (select settlement_amount from public.claim_partner_summaries
    where claim_id = '20000000-0000-4000-a000-000000000002'),
  128400.00::numeric(12,2),
  'the settled claim does disclose its figure, which is what the contractor''s commission is reconciled against'
);

select is(
  (select count(*)::int from public.claim_events where id in
    ('40000000-0000-4000-a000-000000000001','40000000-0000-4000-a000-000000000002','40000000-0000-4000-a000-000000000003','40000000-0000-4000-a000-000000000004','40000000-0000-4000-a000-000000000005','40000000-0000-4000-a000-000000000006','40000000-0000-4000-a000-000000000101','40000000-0000-4000-a000-000000000102','40000000-0000-4000-a000-000000000103','40000000-0000-4000-a000-000000000104')),
  6,
  'the contractor sees the partner-facing and shared feed entries on their own referrals'
);

select is_empty(
  $$ select id from public.claim_events where visibility in ('internal', 'customer') $$,
  'internal notes and private homeowner correspondence never reach the referring contractor'
);

-- Revised from the original "sees their own company record": §4's access matrix puts
-- partner_companies in the owner-only row, and the read a rep had here exposed the
-- internal contact and notes columns CMG keeps about them while buying the portal
-- nothing it cannot get from claim_partner_summaries.
select is(
  (select count(*)::int from public.partner_companies),
  0,
  'a referring contractor reads no partner_companies row at all, not even their own, so the internal record CMG keeps about a contractor is not readable by that contractor'
);

select is(
  (select count(*)::int from public.audit_log),
  0,
  'the contractor cannot read the audit trail'
);

select set_config('request.jwt.claims', '', true);
reset role;
