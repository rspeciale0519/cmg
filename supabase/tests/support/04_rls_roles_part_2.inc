-- ---------------------------------------------------------------------------
-- assistant — Priya Nolan, office support with no financial or status authority
-- ---------------------------------------------------------------------------

set local request.jwt.claims = '{"sub":"00000000-0000-4000-a000-000000000003","role":"authenticated","aal":"aal2"}';
set local role authenticated;

select is(
  (select count(*)::int from public.claims where id in
    ('20000000-0000-4000-a000-000000000001','20000000-0000-4000-a000-000000000002','20000000-0000-4000-a000-000000000003')),
  3,
  'the assistant sees the whole caseload, which is what running the office requires'
);

select is(
  (select count(*)::int from public.claim_financials),
  0,
  'the assistant sees no settlement figures at all — the money lives in a relation they hold no policy on, so this is a structural exclusion rather than a filtered view'
);

select is(
  (select count(*)::int from public.leads where id = '90000000-0000-4000-a000-000000000001'),
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

set local request.jwt.claims = '{"sub":"00000000-0000-4000-a000-000000000002","role":"authenticated","aal":"aal2"}';
set local role authenticated;

select results_eq(
  $$ select id::text from public.claims where id in
      ('20000000-0000-4000-a000-000000000001','20000000-0000-4000-a000-000000000002','20000000-0000-4000-a000-000000000003') order by id $$,
  $$ values ('20000000-0000-4000-a000-000000000001'::text),
            ('20000000-0000-4000-a000-000000000002'::text) $$,
  'the adjuster sees the two claims assigned to them and not the third, so caseload assignment is an access boundary and not just a filter in the UI'
);

select is(
  (select count(*)::int from public.claim_financials where claim_id in
    ('20000000-0000-4000-a000-000000000001','20000000-0000-4000-a000-000000000002')),
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

set local request.jwt.claims = '{"sub":"00000000-0000-4000-a000-000000000001","role":"authenticated","aal":"aal2"}';
set local role authenticated;

select is(
  (select count(*)::int from public.claims where id in
    ('20000000-0000-4000-a000-000000000001','20000000-0000-4000-a000-000000000002','20000000-0000-4000-a000-000000000003')),
  3,
  'the owner sees every claim including the one nobody is assigned to'
);

select is(
  (select count(*)::int from public.documents where id in
    ('50000000-0000-4000-a000-000000000001','50000000-0000-4000-a000-000000000002','50000000-0000-4000-a000-000000000003','50000000-0000-4000-a000-000000000101','50000000-0000-4000-a000-000000000102')),
  5,
  'the owner sees every document regardless of visibility'
);

select is(
  (select count(*)::int from public.claim_financials where claim_id in
    ('20000000-0000-4000-a000-000000000001','20000000-0000-4000-a000-000000000002')),
  2,
  'the owner sees every settlement record'
);

select is(
  (select count(*)::int from public.claimants where id in
    ('30000000-0000-4000-a000-000000000001','30000000-0000-4000-a000-000000000002','30000000-0000-4000-a000-000000000003')),
  3,
  'the owner sees every homeowner on the platform'
);

select is(
  (select count(*)::int from public.leads where id = '90000000-0000-4000-a000-000000000001'),
  1,
  'the owner sees the contact-form inbox'
);

select is(
  (select count(*)::int from public.invites where id = '70000000-0000-4000-a000-000000000001'),
  1,
  'the owner is the only role that can read invites, which is where onboarding authority lives'
);

select is(
  (select count(*)::int from public.partner_companies where id = '10000000-0000-4000-a000-000000000001'),
  1,
  'the owner sees every partner company'
);

select is(
  (select count(*)::int from public.claim_partner_summaries where claim_id in
    ('20000000-0000-4000-a000-000000000001','20000000-0000-4000-a000-000000000002')),
  2,
  'the owner can see exactly what each partner is being shown, which is what makes the disclosure auditable'
);

select is(
  (select count(*)::int from public.profiles where id in
    ('00000000-0000-4000-a000-000000000001','00000000-0000-4000-a000-000000000002','00000000-0000-4000-a000-000000000003','00000000-0000-4000-a000-000000000004','00000000-0000-4000-a000-000000000005')),
  5,
  'the owner sees every user account, which is what role administration requires'
);

select isnt_empty(
  $$ select 1 from public.audit_log limit 1 $$,
  'the owner is the one role that can read the audit trail, so the record of who did what has exactly one audience'
);

select set_config('request.jwt.claims', '', true);
reset role;
