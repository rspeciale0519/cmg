-- CMG Property Solutions — the access matrix, exercised as each seeded user.
-- Every block below runs as `authenticated` with a real user's subject claim, which
-- is exactly the context PostgREST and the server actions produce. What each role
-- can see here is what it can see in production.
--
--   owner      00000000-0000-4000-a000-000000000001  Austin Graham
--   adjuster   00000000-0000-4000-a000-000000000002  Dana Reyes    (assigned claims 1 and 2)
--   assistant  00000000-0000-4000-a000-000000000003  Priya Nolan
--   customer   00000000-0000-4000-a000-000000000004  Marcus Bell   (claimant on claim 1)
--   partner    00000000-0000-4000-a000-000000000005  Tyler Boone   (Summit Exteriors LLC)

begin;
set local client_min_messages = warning;
create extension if not exists pgtap with schema extensions;

select plan(52);

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

insert into public.invites (email, role, claim_id, token_hash, invited_by)
values (
  'invitee@example.test', 'customer', '20000000-0000-4000-a000-000000000001',
  'sha256-placeholder-hash', '00000000-0000-4000-a000-000000000001'
);

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
  $$ select id::text from public.claims order by id $$,
  $$ values ('20000000-0000-4000-a000-000000000001'::text) $$,
  'a homeowner sees the one claim they are a claimant on and no other, so the portal cannot be walked sideways into someone else''s file'
);

select is(
  (select count(*)::int from public.documents),
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
  (select count(*)::int from public.claim_events),
  5,
  'the homeowner sees the customer-facing and shared feed entries on their claim'
);

select is_empty(
  $$ select id from public.claim_events where visibility = 'internal' $$,
  'internal staff notes on the homeowner''s own claim remain invisible to them'
);

select is(
  (select count(*)::int from public.claimants),
  2,
  'the homeowner sees the co-claimants on their own claim and nobody from any other claim'
);

select is(
  (select count(*)::int from public.leads),
  0,
  'the homeowner cannot read the contact-form inbox, which holds other people''s names and phone numbers'
);

select is(
  (select count(*)::int from public.claim_partner_summaries),
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
  (select count(*)::int from public.claim_partner_summaries),
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
  (select count(*)::int from public.claim_events),
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

-- ---------------------------------------------------------------------------
-- assistant — Priya Nolan, office support with no financial or status authority
-- ---------------------------------------------------------------------------

set local request.jwt.claims = '{"sub":"00000000-0000-4000-a000-000000000003","role":"authenticated"}';
set local role authenticated;

select is(
  (select count(*)::int from public.claims),
  3,
  'the assistant sees the whole caseload, which is what running the office requires'
);

select is(
  (select count(*)::int from public.claim_financials),
  0,
  'the assistant sees no settlement figures at all — the money lives in a relation they hold no policy on, so this is a structural exclusion rather than a filtered view'
);

select is(
  (select count(*)::int from public.leads),
  1,
  'the assistant can work the contact-form inbox'
);

select is(
  (select count(*)::int from public.invites),
  0,
  'the assistant cannot read invite records, so they cannot lift a pending token or enumerate who is being onboarded'
);

select is(
  (select count(*)::int from public.audit_log),
  0,
  'the assistant cannot read the audit trail that records their own actions'
);

with u as (
  update public.claims set status = 'settled'
   where id = '20000000-0000-4000-a000-000000000001'
  returning 1
)
insert into rls_probe select 'assistant_status_update', count(*)::int from u;

select is(
  (select affected from rls_probe where label = 'assistant_status_update'),
  0,
  'the assistant cannot move a claim forward, so lifecycle authority stays with the owner and the assigned adjuster'
);

with u as (
  update public.claim_financials set settlement_amount = 1.00
   where claim_id = '20000000-0000-4000-a000-000000000001'
  returning 1
)
insert into rls_probe select 'assistant_financials_update', count(*)::int from u;

select is(
  (select affected from rls_probe where label = 'assistant_financials_update'),
  0,
  'the assistant cannot rewrite a settlement figure either — invisible rows are also unwritable, so the exclusion is not read-only theatre'
);

select throws_ok(
  $$ insert into public.claim_financials (claim_id, settlement_amount, fee_percent)
     values ('20000000-0000-4000-a000-000000000003', 500000.00, 10.00) $$,
  '42501'::char(5), null::text,
  'nor can the assistant create a settlement record on a claim that has none, which would otherwise be a way to introduce a figure without ever reading one'
);

select set_config('request.jwt.claims', '', true);
reset role;

select is(
  (select status from public.claims where id = '20000000-0000-4000-a000-000000000001'),
  'settlement_offered'::public.claim_status,
  'after both the homeowner and the assistant attempted it, the claim is still exactly where it was — the refusals were real, not merely unreported'
);

-- ---------------------------------------------------------------------------
-- adjuster — Dana Reyes, assigned to claims 1 and 2 only
-- ---------------------------------------------------------------------------

set local request.jwt.claims = '{"sub":"00000000-0000-4000-a000-000000000002","role":"authenticated"}';
set local role authenticated;

select results_eq(
  $$ select id::text from public.claims order by id $$,
  $$ values ('20000000-0000-4000-a000-000000000001'::text),
            ('20000000-0000-4000-a000-000000000002'::text) $$,
  'the adjuster sees the two claims assigned to them and not the third, so caseload assignment is an access boundary and not just a filter in the UI'
);

select is(
  (select count(*)::int from public.claim_financials),
  2,
  'the adjuster can read the settlement records for their own assigned claims, which is what negotiating requires'
);

select is(
  (select count(*)::int from public.invites),
  0,
  'the adjuster cannot read invite records'
);

select is(
  (select count(*)::int from public.audit_log),
  0,
  'the adjuster cannot read the audit trail'
);

with u as (
  update public.claims set status = 'settled'
   where id = '20000000-0000-4000-a000-000000000001'
  returning 1
)
insert into rls_probe select 'adjuster_status_update', count(*)::int from u;

select is(
  (select affected from rls_probe where label = 'adjuster_status_update'),
  1,
  'the assigned adjuster can advance their own claim, so the refusals above are about authority rather than about the update path being broken for everyone'
);

select set_config('request.jwt.claims', '', true);
reset role;

select is(
  (select status from public.claims where id = '20000000-0000-4000-a000-000000000001'),
  'settled'::public.claim_status,
  'the adjuster''s transition actually took effect, which is the control proving the earlier zero-row results were denials'
);

-- ---------------------------------------------------------------------------
-- owner — Austin Graham, full authority
-- ---------------------------------------------------------------------------

set local request.jwt.claims = '{"sub":"00000000-0000-4000-a000-000000000001","role":"authenticated"}';
set local role authenticated;

select is(
  (select count(*)::int from public.claims),
  3,
  'the owner sees every claim including the one nobody is assigned to'
);

select is(
  (select count(*)::int from public.documents),
  5,
  'the owner sees every document regardless of visibility'
);

select is(
  (select count(*)::int from public.claim_financials),
  2,
  'the owner sees every settlement record'
);

select is(
  (select count(*)::int from public.claimants),
  3,
  'the owner sees every homeowner on the platform'
);

select is(
  (select count(*)::int from public.leads),
  1,
  'the owner sees the contact-form inbox'
);

select is(
  (select count(*)::int from public.invites),
  1,
  'the owner is the only role that can read invites, which is where onboarding authority lives'
);

select is(
  (select count(*)::int from public.partner_companies),
  1,
  'the owner sees every partner company'
);

select is(
  (select count(*)::int from public.claim_partner_summaries),
  2,
  'the owner can see exactly what each partner is being shown, which is what makes the disclosure auditable'
);

select is(
  (select count(*)::int from public.profiles),
  5,
  'the owner sees every user account, which is what role administration requires'
);

select isnt_empty(
  $$ select 1 from public.audit_log limit 1 $$,
  'the owner is the one role that can read the audit trail, so the record of who did what has exactly one audience'
);

select set_config('request.jwt.claims', '', true);
reset role;

select * from finish();
rollback;
