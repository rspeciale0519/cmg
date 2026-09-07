-- Minor 2 — the money table was the one thing nobody was watching
-- ===========================================================================

select has_trigger(
  'public'::name, 'claim_financials'::name, 'audit_claim_financials'::name,
  'settlement_amount and fee_percent are audited: the highest-value fields in the schema appeared in neither the DB trigger set nor §7.7''s app-level list, so changing them left no record of who did it'
);

select has_trigger(
  'public'::name, 'claimants'::name, 'audit_claimants'::name,
  'and so is claimants, which carries an access-control edge rather than mere contact details — user_id is what private.is_claim_customer() reads to decide who may see a claim, and email is where the invite is sent'
);

truncate table public.audit_log restart identity;

update public.claim_financials set settlement_amount = 41250.01
 where claim_id = '20000000-0000-4000-a000-000000000001';

select is(
  (select count(*)::int from public.audit_log where entity = 'claim_financials'),
  1,
  'moving a settlement figure writes exactly one entry to the append-only trail'
);

select is(
  (select entity_id from public.audit_log where entity = 'claim_financials'),
  '20000000-0000-4000-a000-000000000001'::uuid,
  'and it is filed under the claim id — claim_financials is keyed on claim_id and has no `id`, so without the fallback in public.audit_row_change() the entry landed with entity_id null and dropped straight out of the index the owner''s audit viewer filters on'
);

update public.claimants set phone = '407-555-0187'
 where id = '30000000-0000-4000-a000-000000000001';

select is(
  (select entity_id from public.audit_log where entity = 'claimants'),
  '30000000-0000-4000-a000-000000000001'::uuid,
  'a claimants change is recorded under its own id, so the fallback did not disturb the tables that do have one'
);

update public.claims set claim_number = 'CPI-2026-114821'
 where id = '20000000-0000-4000-a000-000000000001';

select is(
  (select entity_id from public.audit_log where entity = 'claims' limit 1),
  '20000000-0000-4000-a000-000000000001'::uuid,
  'and neither did it disturb claims, whose entries still carry the claim id they always did — coalesce never reaches its second arm for a table with a non-null id'
);

select is(
  (select count(*)::int from public.audit_log where entity = 'consents'),
  0,
  'public.consents needed no second trigger: it was given one in an earlier round for the same evidentiary reason, and nothing in this transaction has touched it since the truncate'
);

-- ===========================================================================
-- Minor 3 — DELETE was the door left open next to the one that was locked
-- ===========================================================================

set local request.jwt.claims = '{"sub":"00000000-0000-4000-a000-000000000002","role":"authenticated","aal":"aal2"}';
set local role authenticated;

select lives_ok(
  $$ delete from public.documents where id = '50000000-0000-4000-a000-000000000003' $$,
  'the assigned adjuster''s attempt to delete the signed LOR off a claim at settlement_offered is not an error — a DELETE that RLS refuses is zero rows, which is why this needed checking rather than trusting'
);

select is(
  (select count(*)::int from public.documents
    where id = '50000000-0000-4000-a000-000000000003'),
  1,
  'and zero rows is what it was: the document is still on the claim, so the file no longer stands at settlement_offered asserting a representation it cannot show'
);

select lives_ok(
  $$ delete from public.documents where id = '50000000-0000-4000-a000-000000000002' $$,
  'the same adjuster deletes an ordinary photo on the same claim, so the rule is about the evidence and not about the adjuster'
);

select is(
  (select count(*)::int from public.documents where id = '50000000-0000-4000-a000-000000000002'),
  0,
  'and that one really went, which is the control proving the refusal above was a refusal'
);

select lives_ok(
  $$ delete from public.documents where id = '50000000-0000-4000-a000-0000000000b1' $$,
  'a signed LOR on a claim still at lor_sent is deletable, because before the gate it is an ordinary file — a wrong upload or a superseded draft — and correcting it is legitimate'
);

select is(
  (select count(*)::int from public.documents where id = '50000000-0000-4000-a000-0000000000b1'),
  0,
  'and it is gone, so the block is keyed to the gate rather than to the kind, and the pre-accept correction path stays open'
);

select set_config('request.jwt.claims', '', true);
reset role;

set local request.jwt.claims = '{"sub":"00000000-0000-4000-a000-000000000003","role":"service_role"}';
set local role service_role;

select lives_ok(
  $$ delete from public.documents where id = '50000000-0000-4000-a000-000000000003' $$,
  'the service role still deletes it: this is a policy and not a trigger, so BYPASSRLS means the PandaDoc webhook and any out-of-band correction are untouched'
);

select set_config('request.jwt.claims', '', true);
reset role;

set local request.jwt.claims = '{"sub":"00000000-0000-4000-a000-000000000001","role":"authenticated","aal":"aal2"}';
set local role authenticated;

select lives_ok(
  $$ delete from public.claims where id = '20000000-0000-4000-a000-0000000000b2' $$,
  'and an owner deleting a whole claim is unaffected — Postgres runs a referential cascade with the referenced table''s rights rather than through this policy'
);

select set_config('request.jwt.claims', '', true);
reset role;

select is(
  (select count(*)::int from public.documents where id = '50000000-0000-4000-a000-0000000000b2'),
  0,
  'so the claim''s signed LOR went with it, which is the case that would have broken had this rule been written as a trigger instead'
);

-- ===========================================================================
-- Minor 5 — claims_claim_ref_shape pinned the format, not the identity
-- ===========================================================================

set local request.jwt.claims = '{"sub":"00000000-0000-4000-a000-000000000001","role":"authenticated","aal":"aal2"}';
set local role authenticated;

select throws_ok(
  $$ update public.claims set claim_ref = 'CMG-2026-0002'
      where id = '20000000-0000-4000-a000-000000000001' $$,
  '42501'::char(5), null::text,
  'an owner cannot rename a claim onto another claim''s reference — the shape CHECK accepted this happily, because CMG-2026-0002 is perfectly well formed and simply belongs to a different file'
);

select set_config('request.jwt.claims', '', true);
reset role;

set local request.jwt.claims = '{"sub":"00000000-0000-4000-a000-000000000002","role":"authenticated","aal":"aal2"}';
set local role authenticated;

select throws_ok(
  $$ update public.claims set claim_ref = 'CMG-2026-4444'
      where id = '20000000-0000-4000-a000-000000000001' $$,
  '42501'::char(5), null::text,
  'and neither can the assigned adjuster, who reaches the column through claims_update_manage like any other'
);

select set_config('request.jwt.claims', '', true);
reset role;

select is(
  (select claim_ref from public.claims where id = '20000000-0000-4000-a000-000000000001'),
  'CMG-2026-0001',
  'the reference on the file is the one it was born with — it is the string every email, portal header and partner summary identifies the claim by, so two files answering to one name is a correspondence problem, not an untidy row'
);

set local request.jwt.claims = '{"sub":"00000000-0000-4000-a000-000000000003","role":"service_role"}';
set local role service_role;

select lives_ok(
  $$ update public.claims set claim_ref = 'CMG-2026-0009'
      where id = '20000000-0000-4000-a000-0000000000b1' $$,
  'the service role keeps the correction path, as it does for consent snapshots: it already holds BYPASSRLS and grant all on audit_log itself, so constraining it here would be theatre that costs a real repair route'
);

select set_config('request.jwt.claims', '', true);
reset role;

-- ===========================================================================
-- Minor 6 — a claim has more than one claimant, so "the customer on this claim"
--           is not "the subject of this consent"
-- ===========================================================================

set local request.jwt.claims = '{"sub":"00000000-0000-4000-a000-0000000000a1","role":"authenticated"}';
set local role authenticated;

select results_eq(
  $$ select id::text from public.consents
      where id in ('80000000-0000-4000-a000-000000000001','80000000-0000-4000-a000-000000000002','80000000-0000-4000-a000-0000000000a1')
      order by id $$,
  $$ values ('80000000-0000-4000-a000-0000000000a1'::text) $$,
  'the co-claimant reads her own consent and nothing else — she used to read every snapshot on the file, which meant the other homeowner''s email, phone and the IP address they submitted from'
);

select lives_ok(
  $$ update public.consents set withdrawn_at = now()
      where id = '80000000-0000-4000-a000-000000000001' $$,
  'her attempt to withdraw the OTHER party''s consent is silent, as an RLS-refused UPDATE always is'
);

select is(
  (select withdrawn_at from public.consents where id = '80000000-0000-4000-a000-000000000001'),
  null::timestamptz,
  'and silent is all it was: the other homeowner''s consent still stands, which matters because withdrawing it in their name destroys the permission CMG would have to produce in a TCPA dispute'
);

select lives_ok(
  $$ update public.consents set withdrawn_at = now()
      where id = '80000000-0000-4000-a000-0000000000a1' $$,
  'while she withdraws her own, matched across a case and whitespace difference between consents.email and the claimants row it belongs to'
);

select isnt(
  (select withdrawn_at from public.consents where id = '80000000-0000-4000-a000-0000000000a1'),
  null::timestamptz,
  'and that one took effect, so the §10 consent view-and-withdraw a homeowner is promised is narrowed to her own row rather than closed'
);

select set_config('request.jwt.claims', '', true);
reset role;

set local request.jwt.claims = '{"sub":"00000000-0000-4000-a000-000000000004","role":"authenticated"}';
set local role authenticated;

select is(
  (select count(*)::int from public.consents where id in
    ('80000000-0000-4000-a000-000000000001','80000000-0000-4000-a000-000000000002','80000000-0000-4000-a000-0000000000a1')),
  2,
  'the primary homeowner still reads both of the consents he gave, and only those — his sms and his email snapshot, not the co-claimant''s'
);

select set_config('request.jwt.claims', '', true);
reset role;

set local request.jwt.claims = '{"sub":"00000000-0000-4000-a000-000000000003","role":"authenticated","aal":"aal2"}';
set local role authenticated;

select is(
  (select count(*)::int from public.consents where id in
    ('80000000-0000-4000-a000-000000000001','80000000-0000-4000-a000-000000000002','80000000-0000-4000-a000-0000000000a1')),
  3,
  'and staff still read every snapshot on the claim, because producing consent across a file is the evidentiary job §7.7 gives them — the narrowing is on the customer branches alone'
);

select set_config('request.jwt.claims', '', true);
reset role;

-- ===========================================================================
