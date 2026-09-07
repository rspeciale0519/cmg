-- ---------------------------------------------------------------------------
-- MINOR 1 — a homeowner uploads homeowner documents, and `lor_signed` is not one.
-- The documents insert policy constrained the customer's claim and visibility but not
-- the kind, so a homeowner could file a signed letter of representation against their
-- own claim and arm the §5 status gate themselves.
-- ---------------------------------------------------------------------------

set local request.jwt.claims = '{"sub":"00000000-0000-4000-a000-000000000004","role":"authenticated"}';
set local role authenticated;

select throws_ok(
  $$ insert into public.documents (claim_id, storage_path, original_name, kind, mime, size_bytes, uploaded_by, visibility)
     values ('20000000-0000-4000-a000-000000000001',
             'claims/20000000-0000-4000-a000-000000000001/cccccccc-0000-4000-a000-000000000001.pdf',
             'self-signed-lor.pdf', 'lor_signed', 'application/pdf', 4096,
             '00000000-0000-4000-a000-000000000004', 'customer') $$,
  '42501'::char(5), null::text,
  'a homeowner cannot file a signed letter of representation on their own claim: that document is what the lor_sent → lor_signed gate reads, so writing it is asserting that CMG holds authority to act for them'
);

select throws_ok(
  $$ insert into public.documents (claim_id, storage_path, original_name, kind, mime, size_bytes, uploaded_by, visibility)
     values ('20000000-0000-4000-a000-000000000001',
             'claims/20000000-0000-4000-a000-000000000001/cccccccc-0000-4000-a000-000000000002.pdf',
             'self-lor-draft.pdf', 'lor_unsigned', 'application/pdf', 4096,
             '00000000-0000-4000-a000-000000000004', 'customer') $$,
  '42501'::char(5), null::text,
  'nor the unsigned letter, so the representation record as a whole is produced by the firm rather than by the client'
);

select throws_ok(
  $$ insert into public.documents (claim_id, storage_path, original_name, kind, mime, size_bytes, uploaded_by, visibility)
     values ('20000000-0000-4000-a000-000000000001',
             'claims/20000000-0000-4000-a000-000000000001/cccccccc-0000-4000-a000-000000000003.pdf',
             'my-own-estimate.pdf', 'estimate', 'application/pdf', 4096,
             '00000000-0000-4000-a000-000000000004', 'customer') $$,
  '42501'::char(5), null::text,
  'and cannot label their upload an estimate or a denial either — those are the carrier-facing artefacts the file is built from, and a homeowner-supplied one would be indistinguishable from CMG''s own'
);

select lives_ok(
  $$ insert into public.documents (claim_id, storage_path, original_name, kind, mime, size_bytes, uploaded_by, visibility)
     values ('20000000-0000-4000-a000-000000000001',
             'claims/20000000-0000-4000-a000-000000000001/cccccccc-0000-4000-a000-000000000004.jpg',
             'kitchen-ceiling.jpg', 'photo', 'image/jpeg', 204800,
             '00000000-0000-4000-a000-000000000004', 'customer') $$,
  'the homeowner can still upload a photograph of the damage, which is the whole reason §4 gives them an upload right at all'
);

select lives_ok(
  $$ insert into public.documents (claim_id, storage_path, original_name, kind, mime, size_bytes, uploaded_by, visibility)
     values ('20000000-0000-4000-a000-000000000001',
             'claims/20000000-0000-4000-a000-000000000001/cccccccc-0000-4000-a000-000000000005.pdf',
             'carrier-letter-i-received.pdf', 'correspondence', 'application/pdf', 51200,
             '00000000-0000-4000-a000-000000000004', 'customer') $$,
  'and correspondence they received from their carrier, so the allowlist covers what a homeowner actually has to hand rather than reducing them to photographs'
);

select lives_ok(
  $$ insert into public.claim_events (claim_id, type, body, author_id, visibility)
     values ('20000000-0000-4000-a000-000000000001', 'question',
             'Has the carrier responded to the supplement yet?',
             '00000000-0000-4000-a000-000000000004', 'customer') $$,
  'and can still ask a question on their claim, so tightening the document policy did not touch the portal''s other write path'
);

select set_config('request.jwt.claims', '', true);
reset role;

-- ---------------------------------------------------------------------------
-- MINOR 2 — an assistant is ✖ on status, so an assistant cannot arm the status gate.
-- is_staff_for_claim() covers assistants, so both the insert policy and the update
-- policy let one create a `lor_signed` row, or relabel an existing document into one, on
-- any claim in the business.
-- ---------------------------------------------------------------------------

set local request.jwt.claims = '{"sub":"00000000-0000-4000-a000-000000000003","role":"authenticated","aal":"aal2"}';
set local role authenticated;

select throws_ok(
  $$ insert into public.documents (claim_id, storage_path, original_name, kind, mime, size_bytes, uploaded_by, visibility)
     values ('20000000-0000-4000-a000-000000000001',
             'claims/20000000-0000-4000-a000-000000000001/dddddddd-0000-4000-a000-000000000001.pdf',
             'assistant-filed-lor.pdf', 'lor_signed', 'application/pdf', 4096,
             '00000000-0000-4000-a000-000000000003', 'internal') $$,
  '42501'::char(5), null::text,
  'an assistant cannot file a signed letter of representation on any claim: they are ✖ on status in §4, and this document is the only precondition the lor_signed transition checks'
);

select throws_ok(
  $$ update public.documents set kind = 'lor_signed'
      where id = '50000000-0000-4000-a000-000000000001' $$,
  '42501'::char(5), null::text,
  'nor relabel a document they legitimately uploaded into one, which would arm the same gate one statement later and leave the insert restriction achieving nothing'
);

with u as (
  update public.documents set kind = 'other'
   where id = '50000000-0000-4000-a000-000000000003'
  returning 1
)
insert into r2_probe select 'assistant_strips_lor_kind', count(*)::int from u;

select is(
  (select affected from r2_probe where label = 'assistant_strips_lor_kind'),
  0,
  'and cannot relabel an existing signed letter into something else either: stripping the kind off a claim that already passed the gate is tampering with the representation record, so the restriction binds in both directions'
);

select lives_ok(
  $$ insert into public.documents (claim_id, storage_path, original_name, kind, mime, size_bytes, uploaded_by, visibility)
     values ('20000000-0000-4000-a000-000000000001',
             'claims/20000000-0000-4000-a000-000000000001/dddddddd-0000-4000-a000-000000000002.jpg',
             'inspection-photo.jpg', 'photo', 'image/jpeg', 102400,
             '00000000-0000-4000-a000-000000000003', 'internal') $$,
  'the assistant can still upload ordinary documents, which §4 grants them explicitly — the restriction is on two kinds, not on the role''s access to the file'
);

select lives_ok(
  $$ update public.documents set original_name = 'declarations-page-v2.pdf'
      where id = '50000000-0000-4000-a000-000000000001' $$,
  'and can still edit an ordinary document''s metadata, so document administration remains office work rather than becoming adjuster-only'
);

select set_config('request.jwt.claims', '', true);
reset role;

set local request.jwt.claims = '{"sub":"00000000-0000-4000-a000-000000000002","role":"authenticated","aal":"aal2"}';
set local role authenticated;

select lives_ok(
  $$ insert into public.documents (claim_id, storage_path, original_name, kind, mime, size_bytes, uploaded_by, visibility)
     values ('20000000-0000-4000-a000-000000000001',
             'claims/20000000-0000-4000-a000-000000000001/dddddddd-0000-4000-a000-000000000003.pdf',
             'countersigned-lor.pdf', 'lor_signed', 'application/pdf', 8192,
             '00000000-0000-4000-a000-000000000002', 'internal') $$,
  'the assigned adjuster can file the signed letter on their own claim, so the capability moved to the roles that own the lifecycle rather than disappearing from the platform'
);

select lives_ok(
  $$ update public.documents set kind = 'lor_signed'
      where id = '50000000-0000-4000-a000-000000000002' $$,
  'and can relabel a document into one, which the manual-signature fallback in §6 depends on when a signed copy arrives outside the e-sign flow'
);

select set_config('request.jwt.claims', '', true);
reset role;

-- ---------------------------------------------------------------------------
-- MINOR 3 — the two profiles policies that could never fire are gone
-- ---------------------------------------------------------------------------

select is_empty(
  $$ select p.polname::text from pg_policy p
      where p.polrelid = 'public.profiles'::regclass
        and p.polcmd in ('a', 'd') $$,
  'no INSERT or DELETE policy remains on public.profiles: authenticated holds neither grant, so those policies described an owner capability that the grant layer refused one level above them'
);

select is_empty(
  $$ select t.priv from unnest(array['INSERT','DELETE','TRUNCATE']) as t(priv)
      where has_table_privilege('authenticated', 'public.profiles', t.priv) $$,
  'and the grants themselves confirm why: profile rows are created by the auth.users trigger and removed by its cascade, so no client session can add or remove one whatever the policies say'
);

-- ---------------------------------------------------------------------------
-- MINOR 5 — deactivation closes the customer surface as one piece.
-- claims, documents and events already went dark (round 1, MAJOR 5). The profile row and
-- the claimant row did not, and the claimant row discloses claim_id.
-- ---------------------------------------------------------------------------

update public.profiles set is_active = false
 where id = '00000000-0000-4000-a000-000000000004';

set local request.jwt.claims = '{"sub":"00000000-0000-4000-a000-000000000004","role":"authenticated"}';
set local role authenticated;

select is(
  (select count(*)::int from public.profiles where id = '00000000-0000-4000-a000-000000000004'),
  0,
  'a deactivated homeowner reads no profile row, not even their own, so the last relation that kept answering after the rest of the portal went dark now closes with it'
);

select is(
  (select count(*)::int from public.claimants where id in
    ('30000000-0000-4000-a000-000000000001','30000000-0000-4000-a000-000000000002')),
  0,
  'and no claimant row, which mattered more than it looks: that row carries claim_id, so a disabled account could still learn which claim it had been attached to'
);

select set_config('request.jwt.claims', '', true);
reset role;

update public.profiles set is_active = true
 where id = '00000000-0000-4000-a000-000000000004';

set local request.jwt.claims = '{"sub":"00000000-0000-4000-a000-000000000004","role":"authenticated"}';
set local role authenticated;

select is(
  (select count(*)::int from public.profiles where id = '00000000-0000-4000-a000-000000000004'),
  1,
  'an active homeowner still reads their own profile, which the portal needs for the name and phone fields §10 lets them edit'
);

select is(
  (select count(*)::int from public.claimants where id in
    ('30000000-0000-4000-a000-000000000001','30000000-0000-4000-a000-000000000002')),
  2,
  'and still sees the co-claimants on their own claim, so removing the redundant self-match branch cost an active customer nothing'
);

select set_config('request.jwt.claims', '', true);
reset role;

-- ---------------------------------------------------------------------------
-- MINOR 6 — the implicit PUBLIC grant on schema public
-- ---------------------------------------------------------------------------

select ok(
  not has_schema_privilege('anon', 'public', 'USAGE'),
  'anon holds no USAGE on schema public. Revoking it from anon by name was not enough: anon is a member of PUBLIC like every role, and the implicit PUBLIC grant was still standing underneath'
);

select ok(
  has_schema_privilege('authenticated', 'public', 'USAGE'),
  'authenticated still holds USAGE by its own explicit grant, so PostgREST continues to serve signed-in sessions — the revoke removed the implicit grant, not the real one'
);

select ok(
  has_schema_privilege('service_role', 'public', 'USAGE'),
  'and so does service_role, which is what every server action and the outbox sweeper run as'
);

select is_empty(
  $$ select p.oid::regprocedure::text
       from pg_proc p
       join pg_namespace n on n.oid = p.pronamespace
       cross join lateral aclexplode(coalesce(p.proacl, acldefault('f', p.proowner))) a
      where n.nspname = 'public'
        and p.prokind in ('f', 'p')
        and a.grantee = 0
        and a.privilege_type = 'EXECUTE' $$,
  'no routine in public grants EXECUTE to PUBLIC, so no function is reachable by a role merely because nobody remembered to revoke the default'
);

-- The case the schema revoke exists for: a function added by some later migration whose
-- author forgets to revoke EXECUTE from PUBLIC. It really does arrive PUBLIC-executable —
-- `alter default privileges ... revoke execute on functions from public` is recorded in
-- pg_default_acl but does not take effect on this build, so the migration comment marks
-- it as defence in depth and this pair of assertions pins what actually protects the
-- schema. The grant is real; reaching it is what fails.
create function public.zz_default_privilege_probe() returns integer
  language sql immutable as $probe$ select 1 $probe$;

select ok(
  has_function_privilege('anon', 'public.zz_default_privilege_probe()', 'EXECUTE'),
  'a function created in public without an explicit revoke is still granted EXECUTE to PUBLIC, and therefore to anon — this assertion documents the exposure rather than a protection, and is the reason the schema-level revoke has to carry the weight'
);

set local role anon;

select throws_ok(
  $$ select public.zz_default_privilege_probe() $$,
  '42501'::char(5), null::text,
  'and anon still cannot call it: entering the schema fails before the function''s own privileges are ever consulted, so revoking USAGE from PUBLIC closes the whole class of forgotten-revoke mistakes and not merely the routines that exist today'
);

reset role;

drop function public.zz_default_privilege_probe();
