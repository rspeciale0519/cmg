-- CMG Property Solutions — public.change_staff_privileges()
--
-- The invariant: a change made from the staff screen may not leave the workspace with
-- zero active owners. It was previously enforced only in TypeScript, across two
-- PostgREST round trips — read the roster, decide, write — with no transaction spanning
-- them, so two owners demoting each other simultaneously each saw one surviving owner
-- and each committed. The result is unrecoverable from inside the product:
-- public.guard_profile_privileges() requires an *active owner* before it will change
-- anyone's role or activation, including their own, so with none left nobody can promote
-- a replacement.
--
-- Sequential SQL cannot stage the interleaving itself, and pinning the interleaving is
-- not what makes the fix hold anyway. What makes it hold is that the check now reads the
-- table *after* the write, in the same transaction, with the rows that could hold an
-- owner account locked. So what is pinned here is the property that follows from that:
-- there is no argument to this function that leaves zero active owners and returns
-- successfully. Concurrency can only produce a state the function was already willing to
-- produce, and this suite says there is no such state.
--
-- Also pinned: that the function did not become a way *around* the three checks it sits
-- behind. It is SECURITY INVOKER, so RLS and public.guard_profile_privileges() still
-- apply; a non-owner calling it directly gains nothing.
--
--   owner      00000000-0000-4000-a000-000000000001  Austin Graham
--   adjuster   00000000-0000-4000-a000-000000000002  Dana Reyes
--   assistant  00000000-0000-4000-a000-000000000003  Priya Nolan
--   customer   00000000-0000-4000-a000-000000000004  Marcus Bell

begin;
set local client_min_messages = warning;
create extension if not exists pgtap with schema extensions;

select plan(21);

-- ---------------------------------------------------------------------------
-- Shape and grants
-- ---------------------------------------------------------------------------

select has_function(
  'public',
  'change_staff_privileges',
  array['uuid', 'public.app_role', 'boolean'],
  'the staff screen has one entry point for a privilege change, so the check and the write cannot be separated by a network hop'
);

select is(
  (select prosecdef from pg_proc p
     join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and p.proname = 'change_staff_privileges'),
  false,
  'it runs as the caller, so profiles_update_owner and guard_profile_privileges() still decide the write — this adds a layer rather than replacing three'
);

select is(
  has_function_privilege('anon', 'public.change_staff_privileges(uuid, public.app_role, boolean)', 'execute'),
  false,
  'anon cannot execute it, matching every other routine in this schema'
);

select is(
  has_function_privilege('authenticated', 'public.change_staff_privileges(uuid, public.app_role, boolean)', 'execute'),
  true,
  'an authenticated session can call it — the refusal comes from RLS and the trigger, not from the grant'
);

-- ---------------------------------------------------------------------------
-- The invariant, as the only active owner
-- ---------------------------------------------------------------------------

select set_config(
  'request.jwt.claims',
  '{"sub":"00000000-0000-4000-a000-000000000001","role":"authenticated"}',
  true
);
set local role authenticated;

select is(
  (select count(*)::int from public.profiles where role = 'owner' and is_active),
  1,
  'the seed has exactly one active owner, so every case below is the last-owner case'
);

select throws_ok(
  $$ select public.change_staff_privileges('00000000-0000-4000-a000-000000000001'::uuid, 'adjuster'::public.app_role, null) $$,
  'CMG01'::char(5), null::text,
  'the only active owner cannot demote themselves, because nobody would be left who could put it back'
);

select throws_ok(
  $$ select public.change_staff_privileges('00000000-0000-4000-a000-000000000001'::uuid, 'assistant'::public.app_role, null) $$,
  'CMG01'::char(5), null::text,
  'the refusal is about the surviving count and not about which role was asked for'
);

select throws_ok(
  $$ select public.change_staff_privileges('00000000-0000-4000-a000-000000000001'::uuid, null, false) $$,
  'CMG01'::char(5), null::text,
  'the only active owner cannot be deactivated either — the same invariant, reached by the other control'
);

select is(
  (select role::text from public.profiles where id = '00000000-0000-4000-a000-000000000001'),
  'owner',
  'a refused call leaves the row exactly as it was: the update and the check are one statement, so the raise takes the write with it'
);

select is(
  (select is_active from public.profiles where id = '00000000-0000-4000-a000-000000000001'),
  true,
  'and the same for activation, which is the half that cannot be undone from inside the product'
);

select throws_ok(
  $$ select public.change_staff_privileges('00000000-0000-4000-a000-000000000001'::uuid, null, null) $$,
  '22023'::char(5), null::text,
  'a call that changes nothing is refused rather than silently counted as a success'
);

select throws_ok(
  $$ select public.change_staff_privileges('00000000-0000-4000-a000-000000000099'::uuid, 'adjuster'::public.app_role, null) $$,
  '42501'::char(5), null::text,
  'an id that matches no row is a refusal, not an empty success — zero rows updated is profiles_update_owner declining'
);

-- ---------------------------------------------------------------------------
-- With a second owner, the same calls succeed
-- ---------------------------------------------------------------------------

select lives_ok(
  $$ select public.change_staff_privileges('00000000-0000-4000-a000-000000000002'::uuid, 'owner'::public.app_role, null) $$,
  'promoting a second owner is allowed — the invariant is a floor, not a ceiling'
);

select is(
  (select count(*)::int from public.profiles where role = 'owner' and is_active),
  2,
  'and it took effect'
);

select lives_ok(
  $$ select public.change_staff_privileges('00000000-0000-4000-a000-000000000001'::uuid, 'adjuster'::public.app_role, null) $$,
  'the first owner may now step down, because the workspace keeps an administrator without them'
);

select is(
  (select count(*)::int from public.profiles where role = 'owner' and is_active),
  1,
  'exactly one active owner remains, which is the state the invariant protects'
);

-- The caller has just demoted themselves, so they are no longer an active owner and
-- guard_profile_privileges() would refuse them for that reason rather than for the one
-- under test. The remaining owner takes over, which is also the realistic shape: the
-- account the rule now protects is the account that would be doing the protecting.
select set_config('request.jwt.claims', '', true);
reset role;

select set_config(
  'request.jwt.claims',
  '{"sub":"00000000-0000-4000-a000-000000000002","role":"authenticated"}',
  true
);
set local role authenticated;

select throws_ok(
  $$ select public.change_staff_privileges('00000000-0000-4000-a000-000000000002'::uuid, null, false) $$,
  'CMG01'::char(5), null::text,
  'and that survivor is now the one who cannot leave — the rule follows the role, not the account'
);

-- ---------------------------------------------------------------------------
-- It is not a way around the three checks it sits behind
-- ---------------------------------------------------------------------------

select set_config('request.jwt.claims', '', true);
reset role;

-- Back to a single owner, so the non-owner probes below run against the seeded shape.
update public.profiles set role = 'owner' where id = '00000000-0000-4000-a000-000000000001';
update public.profiles set role = 'adjuster' where id = '00000000-0000-4000-a000-000000000002';

select set_config(
  'request.jwt.claims',
  '{"sub":"00000000-0000-4000-a000-000000000002","role":"authenticated"}',
  true
);
set local role authenticated;

select throws_ok(
  $$ select public.change_staff_privileges('00000000-0000-4000-a000-000000000002'::uuid, 'owner'::public.app_role, null) $$,
  '42501'::char(5), null::text,
  'an adjuster cannot promote themselves through the new function — SECURITY INVOKER means guard_profile_privileges() still sees a non-owner actor'
);

select set_config('request.jwt.claims', '', true);
reset role;

select set_config(
  'request.jwt.claims',
  '{"sub":"00000000-0000-4000-a000-000000000004","role":"authenticated"}',
  true
);
set local role authenticated;

select throws_ok(
  $$ select public.change_staff_privileges('00000000-0000-4000-a000-000000000004'::uuid, 'owner'::public.app_role, null) $$,
  '42501'::char(5), null::text,
  'and neither can a homeowner, who reaches the function through the grant and no further'
);

select set_config('request.jwt.claims', '', true);
reset role;

select is(
  (select role::text from public.profiles where id = '00000000-0000-4000-a000-000000000002'),
  'adjuster',
  'nothing the two refused callers attempted landed'
);

select is(
  (select count(*)::int from public.profiles where role = 'owner' and is_active),
  1,
  'and the workspace still has its owner'
);

select * from finish();
rollback;
