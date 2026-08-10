-- CMG Property Solutions — public.admin_user_directory()
--
-- The one piece of database surface Phase 4's owner screens added. It exists because
-- auth.users.email and auth.mfa_factors.status are unreachable from an RLS-scoped session
-- (see 20260810120000_admin_user_directory.sql), and because the alternative was reading
-- them with the service-role client, which would move the authorization decision out of
-- Postgres.
--
-- A SECURITY DEFINER function that reads the auth schema is exactly the shape of thing
-- that is safe on the day it is written and a hole two migrations later, so the properties
-- pinned here are the ones whose loss would not otherwise be noticed:
--
--   * only an *active* owner can call it — adjuster, assistant, customer, partner and a
--     deactivated owner are all refused, by raise and not by an empty set;
--   * anon cannot execute it, and neither can it be reached before that check;
--   * the TOTP secret does not appear in the result at any width;
--   * `mfa_enrolled` follows verified factors only, so an abandoned enrolment does not
--     read as protection that is not there.

begin;
set local client_min_messages = warning;
create extension if not exists pgtap with schema extensions;

select plan(17);

-- ---------------------------------------------------------------------------
-- Shape and grants
-- ---------------------------------------------------------------------------

select has_function(
  'public'::name, 'admin_user_directory'::name,
  'the owner account directory exists in public, where PostgREST can reach it'
);

select is(
  (select p.prosecdef from pg_proc p
     join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and p.proname = 'admin_user_directory'),
  true,
  'it is SECURITY DEFINER — an RLS-scoped caller could not read auth.users at all'
);

select is(
  (select p.proconfig from pg_proc p
     join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and p.proname = 'admin_user_directory'),
  array['search_path=""'],
  'search_path is pinned empty, so no caller-controlled schema can shadow auth.users'
);

select ok(
  not has_function_privilege('anon', 'public.admin_user_directory()', 'EXECUTE'),
  'anon holds no EXECUTE on it — the revoke is explicit, not inherited from PUBLIC'
);

select ok(
  has_function_privilege('authenticated', 'public.admin_user_directory()', 'EXECUTE'),
  'a signed-in session may call it; whether it answers is decided inside'
);

select is_empty(
  $$ select a.attname::text
       from pg_proc p
       join pg_namespace n on n.oid = p.pronamespace
       cross join lateral unnest(p.proargnames) as a(attname)
      where n.nspname = 'public' and p.proname = 'admin_user_directory'
        and a.attname ilike '%secret%' $$,
  'the TOTP seed is not among the returned columns — reading it would be equivalent to holding the factor'
);

-- ---------------------------------------------------------------------------
-- An active owner is answered
-- ---------------------------------------------------------------------------

set local request.jwt.claims = '{"sub":"00000000-0000-4000-a000-000000000001","role":"authenticated"}';
set local role authenticated;

select ok(
  (select count(*) from public.admin_user_directory()) >= 5,
  'the owner sees the seeded accounts'
);

select is(
  (select email from public.admin_user_directory()
    where user_id = '00000000-0000-4000-a000-000000000002'),
  'adjuster@cmg.test',
  'the sign-in address comes back — the fact public.profiles cannot carry'
);

select is(
  (select mfa_enrolled from public.admin_user_directory()
    where user_id = '00000000-0000-4000-a000-000000000002'),
  false,
  'an account with no factor reads as not enrolled'
);

reset role;
select set_config('request.jwt.claims', '', true);

-- ---------------------------------------------------------------------------
-- mfa_enrolled counts verified factors and nothing else
-- ---------------------------------------------------------------------------

-- GoTrue writes an unverified row the moment someone opens the setup screen and abandons
-- it. If that counted, the staff screen would report a second factor that cannot be
-- challenged — the single most misleading thing this column could say.
insert into auth.mfa_factors (id, user_id, friendly_name, factor_type, status, created_at, updated_at, secret)
values (
  '30000000-0000-4000-a000-000000000001',
  '00000000-0000-4000-a000-000000000002',
  'abandoned setup', 'totp', 'unverified', now(), now(), 'NOTASECRET'
);

set local request.jwt.claims = '{"sub":"00000000-0000-4000-a000-000000000001","role":"authenticated"}';
set local role authenticated;

select is(
  (select mfa_enrolled from public.admin_user_directory()
    where user_id = '00000000-0000-4000-a000-000000000002'),
  false,
  'an abandoned, unverified enrolment does not read as protection'
);

reset role;
select set_config('request.jwt.claims', '', true);

update auth.mfa_factors set status = 'verified', updated_at = now()
 where id = '30000000-0000-4000-a000-000000000001';

set local request.jwt.claims = '{"sub":"00000000-0000-4000-a000-000000000001","role":"authenticated"}';
set local role authenticated;

select is(
  (select mfa_enrolled from public.admin_user_directory()
    where user_id = '00000000-0000-4000-a000-000000000002'),
  true,
  'verifying the same factor flips it to enrolled'
);

select isnt(
  (select mfa_confirmed_at from public.admin_user_directory()
    where user_id = '00000000-0000-4000-a000-000000000002'),
  null,
  'and the enrolment carries a date the owner can read'
);

reset role;
select set_config('request.jwt.claims', '', true);

-- ---------------------------------------------------------------------------
-- Everyone else is refused, by raise
-- ---------------------------------------------------------------------------

set local request.jwt.claims = '{"sub":"00000000-0000-4000-a000-000000000002","role":"authenticated"}';
set local role authenticated;
select throws_ok(
  $$ select 1 from public.admin_user_directory() $$, '42501'::char(5), null::text,
  'an adjuster is refused — staff is not owner'
);
reset role;
select set_config('request.jwt.claims', '', true);

set local request.jwt.claims = '{"sub":"00000000-0000-4000-a000-000000000003","role":"authenticated"}';
set local role authenticated;
select throws_ok(
  $$ select 1 from public.admin_user_directory() $$, '42501'::char(5), null::text,
  'an assistant is refused'
);
reset role;
select set_config('request.jwt.claims', '', true);

set local request.jwt.claims = '{"sub":"00000000-0000-4000-a000-000000000005","role":"authenticated"}';
set local role authenticated;
select throws_ok(
  $$ select 1 from public.admin_user_directory() $$, '42501'::char(5), null::text,
  'a partner rep is refused — the directory would hand them every staff address'
);
reset role;
select set_config('request.jwt.claims', '', true);

set local role anon;
select throws_ok(
  $$ select 1 from public.admin_user_directory() $$, '42501'::char(5), null::text,
  'anon cannot reach it at all — the schema USAGE revoke refuses before the function does'
);
reset role;

-- A deactivated owner. private.is_owner() filters on is_active, and this is the case that
-- would silently pass if a future edit swapped it for a bare role check: the highest-
-- privilege account, in exactly the offboarding scenario deactivation exists for.
update public.profiles set is_active = false
 where id = '00000000-0000-4000-a000-000000000001';

set local request.jwt.claims = '{"sub":"00000000-0000-4000-a000-000000000001","role":"authenticated"}';
set local role authenticated;
select throws_ok(
  $$ select 1 from public.admin_user_directory() $$, '42501'::char(5), null::text,
  'a deactivated owner is refused — deactivation revokes the directory with everything else'
);
reset role;
select set_config('request.jwt.claims', '', true);

select * from finish();
rollback;
