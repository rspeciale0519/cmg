-- MINOR 2 — documents.storage_path was not tied to documents.claim_id.
--
-- An adjuster could file a wholly legal row on their own claim while pointing
-- storage_path at another claim's prefix. Signed-URL actions authorize by
-- selecting this row under caller RLS before the service role mints a URL, so
-- the mismatch was latent rather than live. It is still exactly the shape that
-- becomes live the day a caller trusts the path instead of the row.
-- ===========================================================================

set local request.jwt.claims = '{"sub":"00000000-0000-4000-a000-000000000002","role":"authenticated","aal":"aal2"}';
set local role authenticated;

-- The restrictive insert policy checks the path prefix before table CHECKs run.
select throws_ok(
  $$ insert into public.documents (claim_id, storage_path, original_name, kind, mime, size_bytes, uploaded_by, visibility)
     values ('20000000-0000-4000-a000-000000000001',
             'claims/20000000-0000-4000-a000-000000000002/b1b1b1b1-0000-4000-a000-000000000001.pdf',
             'mislabelled.pdf', 'photo', 'application/pdf', 4096,
             '00000000-0000-4000-a000-000000000002', 'internal') $$,
  '42501'::char(5), null::text,
  'a documents row and the object it names must agree about which claim they belong to, so a row on one claim can no longer carry a path under another claim''s prefix'
);

select lives_ok(
  $$ insert into public.documents (claim_id, storage_path, original_name, kind, mime, size_bytes, uploaded_by, visibility)
     values ('20000000-0000-4000-a000-000000000001',
             'claims/20000000-0000-4000-a000-000000000001/b1b1b1b1-0000-4000-a000-000000000002.pdf',
             'correctly-parented.pdf', 'photo', 'application/pdf', 4096,
             '00000000-0000-4000-a000-000000000002', 'internal') $$,
  'while the correctly parented path this rule describes is accepted, which is every upload the server actions actually produce'
);

select set_config('request.jwt.claims', '', true);
reset role;

select lives_ok(
  $$ insert into public.documents (claim_id, storage_path, original_name, kind, mime, size_bytes, visibility)
     values ('20000000-0000-4000-a000-000000000001',
             'intake/bbbbbbbb-cccc-4ddd-8eee-ffffffffffff/b1b1b1b1-0000-4000-a000-000000000003.pdf',
             'pre-accept.pdf', 'declarations', 'application/pdf', 4096, 'customer') $$,
  'and the `intake/` prefix is still accepted, because a pre-accept upload has no claim folder yet — the constraint has to describe both of the path shapes §4 defines or it would forbid the intake flow it is meant to protect'
);

select isnt_empty(
  $$ select 1 from pg_constraint
      where conrelid = 'public.documents'::regclass
        and conname = 'documents_storage_path_matches_claim'
        and contype = 'c' $$,
  'the rule is a table constraint rather than a convention in the upload code, so it also binds the service role and any future migration that writes this table directly'
);

delete from public.documents where original_name in ('correctly-parented.pdf', 'pre-accept.pdf');

-- ===========================================================================
-- MINOR 3 — claim_ref was caller-supplied when non-blank, and unconstrained.
--
-- claims_before_insert() generates a reference only when the column arrives blank, so a
-- caller supplying one kept it verbatim; an owner inserted 'not-a-cmg-ref'. claim_ref is
-- the display identity of a claim in every email, portal header and partner summary, so a
-- malformed or spoofed one is a correspondence problem rather than an untidy row.
-- ===========================================================================

set local request.jwt.claims = '{"sub":"00000000-0000-4000-a000-000000000001","role":"authenticated","aal":"aal2"}';
set local role authenticated;

select throws_ok(
  $$ insert into public.claims (claim_ref, property_street, property_city, property_zip,
                                carrier, policy_number, carrier_tenure, loss_date, cause, description)
     values ('not-a-cmg-ref', '1 Test St', 'Orlando', '32801', 'Citizens', 'POL-1',
             'lt_1_year', date '2026-01-01', 'wind', 'free-text reference') $$,
  '23514'::char(5), null::text,
  'an arbitrary string is no longer accepted as a claim reference'
);

select throws_ok(
  $$ insert into public.claims (claim_ref, property_street, property_city, property_zip,
                                carrier, policy_number, carrier_tenure, loss_date, cause, description)
     values ('CMG-26-0001', '1 Test St', 'Orlando', '32801', 'Citizens', 'POL-1',
             'lt_1_year', date '2026-01-01', 'wind', 'two-digit year') $$,
  '23514'::char(5), null::text,
  'nor a two-digit year, which would sort and read as a different decade in every list the reference appears in'
);

select throws_ok(
  $$ insert into public.claims (claim_ref, property_street, property_city, property_zip,
                                carrier, policy_number, carrier_tenure, loss_date, cause, description)
     values ('CMG-2026-041', '1 Test St', 'Orlando', '32801', 'Citizens', 'POL-1',
             'lt_1_year', date '2026-01-01', 'wind', 'three-digit sequence') $$,
  '23514'::char(5), null::text,
  'nor a short sequence, so CMG-2026-041 cannot sit alongside CMG-2026-0041 and be mistaken for it'
);

select throws_ok(
  $$ insert into public.claims (claim_ref, property_street, property_city, property_zip,
                                carrier, policy_number, carrier_tenure, loss_date, cause, description)
     values ('cmg-2026-0001', '1 Test St', 'Orlando', '32801', 'Citizens', 'POL-1',
             'lt_1_year', date '2026-01-01', 'wind', 'lowercase prefix') $$,
  '23514'::char(5), null::text,
  'and case is part of the shape, so a lowercase near-duplicate of an existing reference cannot be created alongside it'
);

select lives_ok(
  $$ insert into public.claims (id, property_street, property_city, property_zip,
                                carrier, policy_number, carrier_tenure, loss_date, cause, description)
     values ('22000000-0000-4000-a000-000000000001', '2 Test St', 'Orlando', '32801', 'Citizens', 'POL-2',
             'lt_1_year', date '2026-01-01', 'wind', 'generated reference') $$,
  'a claim inserted without a reference still gets one from the per-year counter, so the constraint binds the caller-supplied path without touching the generated one'
);

select matches(
  (select claim_ref from public.claims where id = '22000000-0000-4000-a000-000000000001'),
  '^CMG-\d{4}-\d{4}$',
  'and what public.next_claim_ref() produces satisfies the same rule — the constraint is the shape the generator already emits, which is what keeps generated and supplied references indistinguishable'
);

select lives_ok(
  $$ insert into public.claims (id, claim_ref, property_street, property_city, property_zip,
                                carrier, policy_number, carrier_tenure, loss_date, cause, description)
     values ('22000000-0000-4000-a000-000000000002', 'CMG-2019-0007', '3 Test St', 'Orlando', '32801',
             'Citizens', 'POL-3', 'lt_1_year', date '2019-03-04', 'wind', 'historical import') $$,
  'and a well-formed reference supplied by the caller is still accepted, which is what an import of historical files needs in order to keep the references those files already carry'
);

select set_config('request.jwt.claims', '', true);
reset role;

delete from public.claims where id in ('22000000-0000-4000-a000-000000000001',
                                       '22000000-0000-4000-a000-000000000002');

-- ===========================================================================
-- COVERAGE GAP — claimants_one_primary_per_claim_idx was asserted nowhere.
--
-- Dropping the index left all 291 assertions green. It is not cosmetic:
-- refresh_claim_partner_summary() picks homeowner_name with
-- `order by is_primary desc, created_at asc limit 1`, so two primary claimants make the
-- name a partner reads off their portal depend on row order.
-- ===========================================================================

select has_index(
  'public'::name, 'claimants'::name, 'claimants_one_primary_per_claim_idx'::name,
  'the one-primary-claimant index exists — it is load-bearing for the partner projection, and nothing in the suite noticed when it was removed'
);

select index_is_unique(
  'public'::name, 'claimants'::name, 'claimants_one_primary_per_claim_idx'::name,
  'and it is unique, which is what makes it a constraint rather than an access path'
);

-- to_regclass, not a ::regclass cast: a cast raises when the index is absent, which
-- aborts the transaction and takes the four assertions below down with it — so removing
-- the index would have hidden the very behaviour they exist to pin. to_regclass returns
-- null instead, and this assertion simply fails.
select matches(
  (select pg_get_indexdef(i.indexrelid)
     from pg_index i
    where i.indexrelid = to_regclass('public.claimants_one_primary_per_claim_idx')),
  'WHERE is_primary',
  'and partial on is_primary, so it bounds primaries to one per claim while leaving any number of additional claimants on the same file — §4 has second homeowners, and a plain unique index on claim_id would have forbidden them'
);

select throws_ok(
  $$ insert into public.claimants (claim_id, first_name, last_name, email, initials, is_primary)
     values ('20000000-0000-4000-a000-000000000001', 'Second', 'Primary',
             'second.primary@example.test', 'SP', true) $$,
  '23505'::char(5), null::text,
  'a second primary claimant on a claim that already has one is refused'
);

select lives_ok(
  $$ insert into public.claimants (claim_id, first_name, last_name, email, initials, is_primary)
     values ('20000000-0000-4000-a000-000000000001', 'Third', 'Party',
             'third.party@example.test', 'TP', false) $$,
  'while a further non-primary claimant is accepted, which is the ordinary case of a co-owner or a spouse on the policy'
);

select throws_ok(
  $$ update public.claimants set is_primary = true
      where id = '30000000-0000-4000-a000-000000000002' $$,
  '23505'::char(5), null::text,
  'and promoting an existing non-primary while a primary stands is refused too, so the invariant cannot be broken one statement after it was satisfied'
);

select is(
  (select homeowner_name from public.claim_partner_summaries
    where claim_id = '20000000-0000-4000-a000-000000000001'),
  'Marcus Bell',
  'which is why it matters: the name a partner reads is chosen by `order by is_primary desc, created_at asc limit 1`, so with two primaries on the file it would depend on row order rather than on who the homeowner is'
);

delete from public.claimants where email = 'third.party@example.test';
