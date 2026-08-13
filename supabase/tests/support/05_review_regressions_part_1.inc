-- ---------------------------------------------------------------------------
-- Fixtures: a claim nobody is assigned to, carrying a claimant and a document, so
-- "the adjuster sees only their own caseload" is falsifiable rather than vacuous.
-- A second partner company, so re-attribution has somewhere to go.
-- ---------------------------------------------------------------------------

insert into public.partner_companies (id, name, status)
values ('10000000-0000-4000-a000-000000000002', 'Rival Roofing Co', 'active');

insert into public.claims (
  id, property_street, property_city, property_zip,
  carrier, policy_number, carrier_tenure, loss_date, cause, description
) values (
  '25000000-0000-4000-a000-000000000001', '41 Unassigned Ln', 'Sanford', '32771',
  'Test Carrier', 'POL-REVIEW-1', 'lt_1_year', current_date - 6, 'wind',
  'claim in the intake queue with no adjuster assigned'
);
insert into public.claimants (id, claim_id, first_name, last_name, email, initials, is_primary)
values (
  '35000000-0000-4000-a000-000000000001', '25000000-0000-4000-a000-000000000001',
  'Nadia', 'Okonkwo', 'nadia.okonkwo@example.test', 'NO', true
);

insert into public.documents (id, claim_id, storage_path, original_name, kind, mime, size_bytes, visibility)
values (
  '55000000-0000-4000-a000-000000000001', '25000000-0000-4000-a000-000000000001',
  'claims/25000000-0000-4000-a000-000000000001/ffffffff-0000-4000-a000-000000000001.pdf',
  'unassigned-declarations.pdf', 'declarations', 'application/pdf', 12345, 'internal'
);

insert into public.consents (id, lead_id, email, phone, kind, consent_text)
values (
  '85000000-0000-4000-a000-000000000001', '90000000-0000-4000-a000-000000000001',
  'rosa.delgado@example.test', '407-555-0133', 'sms',
  'I consent to receive SMS and email communications from CMG Property Solutions.'
);

create temp table review_probe (label text primary key, affected int);
grant all on table review_probe to public;

-- ---------------------------------------------------------------------------
-- MAJOR 1 — a claim can actually be created from a user session.
-- claims_before_insert() calls next_claim_ref(), whose EXECUTE is revoked from
-- authenticated. As SECURITY INVOKER it aborted every authenticated insert with
-- "permission denied for function next_claim_ref"; the seed masked it by running
-- as postgres. Intake was broken for every real caller.
-- ---------------------------------------------------------------------------

set local request.jwt.claims = '{"sub":"00000000-0000-4000-a000-000000000001","role":"authenticated","aal":"aal2"}';
set local role authenticated;

select lives_ok(
  $$ insert into public.claims (
       id, property_street, property_city, property_zip,
       carrier, policy_number, carrier_tenure, loss_date, cause, description
     ) values (
       '25000000-0000-4000-a000-000000000002', '42 Session Insert Way', 'Orlando', '32801',
       'Test Carrier', 'POL-REVIEW-2', 'lt_1_year', current_date - 4, 'hail',
       'claim created through a signed-in session rather than by the service role'
     ) $$,
  'a signed-in owner can create a claim: the reference generator runs inside the trigger as its owner, so intake works from a session without the counter ever becoming callable from one'
);

select matches(
  (select claim_ref from public.claims where id = '25000000-0000-4000-a000-000000000002'),
  '^CMG-\d{4}-\d{4}$',
  'the claim created from a session was given a real reference, so the trigger did the work rather than the insert merely surviving with a blank field'
);

select ok(
  not has_function_privilege('authenticated', 'public.next_claim_ref()', 'EXECUTE'),
  'the counter is still unreachable as an RPC from a signed-in session, so making the trigger a definer widened the trigger and not the API'
);

-- ---------------------------------------------------------------------------
-- M4 — the status machine only guards UPDATE, so INSERT was an open door into
-- any state, including states the machine would never let a claim reach.
-- ---------------------------------------------------------------------------

select throws_ok(
  $$ insert into public.claims (
       id, status, property_street, property_city, property_zip,
       carrier, policy_number, carrier_tenure, loss_date, cause, description
     ) values (
       '25000000-0000-4000-a000-000000000003', 'closed', '43 Born Closed Ct', 'Orlando', '32801',
       'Test Carrier', 'POL-REVIEW-3', 'lt_1_year', current_date - 4, 'hail', 'born closed'
     ) $$,
  '23514'::char(5), null::text,
  'a claim cannot be created already closed from a user session: the lifecycle is entered at the beginning, so no insert can skip the gates every update is held to'
);

select throws_ok(
  $$ insert into public.claims (
       id, status, property_street, property_city, property_zip,
       carrier, policy_number, carrier_tenure, loss_date, cause, description
     ) values (
       '25000000-0000-4000-a000-000000000004', 'lor_signed', '44 Born Signed Ct', 'Orlando', '32801',
       'Test Carrier', 'POL-REVIEW-4', 'lt_1_year', current_date - 4, 'hail', 'born represented'
     ) $$,
  '23514'::char(5), null::text,
  'nor can a claim be created already at lor_signed, which would otherwise assert representation over a homeowner with no signed letter anywhere in the system'
);

-- ---------------------------------------------------------------------------
-- M9 — loss_date is bounded at write time rather than by a CHECK containing now()
-- ---------------------------------------------------------------------------

select throws_ok(
  $$ insert into public.claims (
       id, property_street, property_city, property_zip,
       carrier, policy_number, carrier_tenure, loss_date, cause, description
     ) values (
       '25000000-0000-4000-a000-000000000005', '45 Future Loss Ln', 'Orlando', '32801',
       'Test Carrier', 'POL-REVIEW-5', 'lt_1_year', current_date + 30, 'hail', 'loss that has not happened'
     ) $$,
  '23514'::char(5), null::text,
  'a loss dated a month from now is still refused after the rule moved off the table and into a trigger, so relocating it did not drop it'
);

select set_config('request.jwt.claims', '', true);
reset role;

select is_empty(
  $$ select conname::text from pg_constraint
      where conrelid = 'public.claims'::regclass
        and conname = 'claims_loss_date_not_future' $$,
  'the rule is no longer a CHECK containing now(): a non-immutable CHECK is re-evaluated on table rewrites and on restore, which would retroactively reject rows that were perfectly legal when they were written'
);

-- ---------------------------------------------------------------------------
-- MAJOR 2 — pruning the rate-limit table must not touch other callers' budgets.
-- The retention interval is derived from the *calling* key's window, so an unscoped
-- delete let a one-minute limiter evict a 24-hour limiter's exhausted rows and hand
-- the budget straight back.
-- ---------------------------------------------------------------------------

insert into public.rate_limits (key, window_start, count)
values
  ('test:prune:victim', now() - interval '2 hours', 999),
  ('test:prune:caller', now() - interval '2 hours', 1);

-- Drive enough short-window calls that the 1% opportunistic prune is effectively
-- certain to fire (P(never) < 1e-8 over 2000 calls).
select count(*) from (
  select public.check_rate_limit('test:prune:caller', 100000, interval '1 second')
    from generate_series(1, 2000)
) s;

select is_empty(
  $$ select 1 from public.rate_limits
      where key = 'test:prune:caller' and window_start < now() - interval '1 hour' $$,
  'the prune really did run during those calls — the calling key''s own stale row is gone, which is the control that stops the next assertion passing merely because nothing happened'
);

select is(
  (select count::int from public.rate_limits
    where key = 'test:prune:victim' and window_start < now() - interval '1 hour'),
  999,
  'a different key''s exhausted budget survived that pruning untouched, so a short-window limiter cannot be used as a lever to reset a long-window one and unlock an address that had already been throttled'
);

-- ---------------------------------------------------------------------------
-- M3 — the throttle is not callable from a signed-in session
-- ---------------------------------------------------------------------------

select ok(
  not has_function_privilege('authenticated', 'public.check_rate_limit(text,integer,interval)', 'EXECUTE'),
  'no signed-in account can call the throttle: it counts whatever key it is handed, so reachable from a session it is a tool for spending a stranger''s intake budget and locking them out of the form'
);

select ok(
  has_function_privilege('service_role', 'public.check_rate_limit(text,integer,interval)', 'EXECUTE'),
  'the service role that fronts the public forms can still call it, so the throttle was narrowed rather than switched off'
);

-- ---------------------------------------------------------------------------
-- MAJOR 3 — an adjuster reads only the claims assigned to them, and that has to
-- hold for the rows hanging off a claim as well as for the claim row itself.
-- ---------------------------------------------------------------------------

set local request.jwt.claims = '{"sub":"00000000-0000-4000-a000-000000000002","role":"authenticated","aal":"aal2"}';
set local role authenticated;

select is(
  (select count(*)::int from public.claimants
    where claim_id = '25000000-0000-4000-a000-000000000001'),
  0,
  'an adjuster reads no homeowner row from a claim they are not assigned to, so the caseload boundary that already held on public.claims is not undone by reading the people attached to it'
);

select is(
  (select count(*)::int from public.documents
    where claim_id = '25000000-0000-4000-a000-000000000001'),
  0,
  'an adjuster reads no document row from an unassigned claim either — declarations pages and photo sets belong to the file, not to the staff directory'
);

select hasnt_function('private', 'can_read_claim_object', array['text'],
  'the unused storage read helper stays retired; signed URLs authorize by selecting the documents row under caller RLS');

select is(
  (select count(*)::int from pg_policies where schemaname = 'storage' and tablename = 'objects'),
  0,
  'storage.objects remains service-role-only, so retiring the unused helper does not expose a client-direct byte path'
);

select is(
  (select count(*)::int from public.claimants
    where id in ('30000000-0000-4000-a000-000000000001','30000000-0000-4000-a000-000000000002')),
  2,
  'the same adjuster still reads the homeowners on a claim they are assigned to, which is the control proving the two zeroes above are denials and not a broken policy'
);

-- ---------------------------------------------------------------------------
-- MAJOR 7 — an adjuster may work a claim but may not re-attribute it. Changing
-- partner_company_id rewrites claim_partner_summaries, handing the homeowner's
-- name, address, status and settlement to an unrelated company.
-- ---------------------------------------------------------------------------

select throws_ok(
  $$ update public.claims
        set partner_company_id = '10000000-0000-4000-a000-000000000002'
      where id = '20000000-0000-4000-a000-000000000001' $$,
  '42501'::char(5), null::text,
  'an adjuster cannot move their own claim to another referring company: re-attribution is a disclosure to a third party, which is not the same authority as working the file'
);

select lives_ok(
  $$ update public.claims set claim_number = 'CPI-2026-114820-A'
      where id = '20000000-0000-4000-a000-000000000001' $$,
  'the same adjuster can still edit the claim they are assigned to, so the refusal above is about the one column and not about updates being broken for them'
);
