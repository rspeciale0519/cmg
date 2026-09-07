-- ---------------------------------------------------------------------------
-- The service role has no second factor to present
-- ---------------------------------------------------------------------------

select is(
  private.is_service_context(), true,
  'a bare connection is a service context, which is how the seed, the migrations and every suite in this directory run'
);

select set_config(
  'request.jwt.claims',
  '{"sub":"00000000-0000-4000-a000-000000000003","role":"service_role"}',
  true
);

select is(
  private.current_app_role(), 'assistant'::public.app_role,
  'and a service-role JWT keeps its staff role with no aal claim at all: PostgREST has already handed that token a BYPASSRLS database role before any of this runs, and a server-side key is not a person with an authenticator app — gating it would break the §6 intake re-parent and the invite flow for a rule that cannot apply to them'
);

select set_config('request.jwt.claims', '', true);
reset role;

-- Establish the one-owner premise independently of mutable shared data.
update public.profiles
   set is_active = false
 where role = 'owner'
   and is_active
   and id <> '00000000-0000-4000-a000-000000000001';

-- ---------------------------------------------------------------------------
-- The floor is serialised — pg_advisory_xact_lock() on the trigger path
-- ---------------------------------------------------------------------------
--
-- BACKEND MAJOR 1. public.guard_profile_privileges() checked "would this leave zero active
-- owners?" with a bare `not exists` and no lock. In READ COMMITTED two transactions
-- demoting two *different* owners each take a snapshot predating the other's write, each
-- see the other still active, and both commit. Reproduced over real HTTP on the first
-- attempt: two parallel PATCHes returned 204/204 and left zero active owners with no audit
-- row — and from zero the workspace cannot be repaired from inside the product, because
-- this same trigger requires an active owner before it will change any privilege.
--
-- public.change_staff_privileges() already held `select … for update`, but the REST path
-- never calls it, and that lock could not simply be moved into the trigger: the trigger is
-- already inside an UPDATE of one candidate row, so row-locking the other candidates makes
-- two concurrent callers each hold what the other wants. An advisory lock is attached to no
-- row and has no such interaction.
--
-- A single pgTAP session cannot stage the interleaving, so what is pinned here is the
-- property the fix rests on: the lock is taken, it is taken on the trigger path rather than
-- only in the RPC, and it is taken only by an update that can actually lower the count. The
-- interleaving itself is demonstrated with two psql sessions and recorded in the round
-- report.

select is(
  (select count(*)::int from pg_locks
    where locktype = 'advisory' and pid = pg_backend_pid()),
  0,
  'no advisory lock is held yet, so the two assertions below are about this transaction and not about a leftover'
);

select set_config(
  'request.jwt.claims',
  '{"sub":"00000000-0000-4000-a000-000000000001","role":"authenticated","aal":"aal2"}',
  true
);
set local role authenticated;

select lives_ok(
  $$ update public.profiles set role = 'assistant'
      where id = '00000000-0000-4000-a000-000000000002' $$,
  'demoting an adjuster is a privilege change that cannot lower the owner count'
);

select is(
  (select count(*)::int from pg_locks
    where locktype = 'advisory' and pid = pg_backend_pid()),
  0,
  'and it takes no advisory lock — the guard is scoped to updates that stop a row being an active owner, so ordinary staff edits do not queue behind each other'
);

select set_config('request.jwt.claims', '', true);
reset role;

-- A second active owner, so the demotion below is allowed to succeed and the lock can be
-- observed on the success path rather than only on the raise.
update public.profiles set role = 'owner', is_active = true
 where id = '00000000-0000-4000-a000-000000000003';

select set_config(
  'request.jwt.claims',
  '{"sub":"00000000-0000-4000-a000-000000000001","role":"authenticated","aal":"aal2"}',
  true
);
set local role authenticated;

select lives_ok(
  $$ update public.profiles set is_active = false
      where id = '00000000-0000-4000-a000-000000000003' $$,
  'with two active owners, demoting one is permitted'
);

select is(
  (select count(*)::int from pg_locks
    where locktype = 'advisory' and pid = pg_backend_pid()),
  1,
  'and this time the trigger took pg_advisory_xact_lock() before reading the roster — the serialisation point the concurrent PATCH pair went through unguarded, now on the path every writer uses rather than only on the RPC nobody is obliged to call'
);

select is(
  (select count(*)::int from public.profiles where role = 'owner' and is_active),
  1,
  'one active owner remains, which is the floor holding on the ordinary path'
);

select throws_ok(
  $$ update public.profiles set is_active = false
      where id = '00000000-0000-4000-a000-000000000001' $$,
  'CMG01'::char(5), null::text,
  'and taking the last one is still refused, with the floor''s own SQLSTATE rather than the authority one'
);

select set_config('request.jwt.claims', '', true);
reset role;
