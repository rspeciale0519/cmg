-- CMG Property Solutions — owner-only account directory
--
-- WHY THIS MIGRATION EXISTS
--
-- Spec §9 gives the owner a staff-management surface that lists staff with their role,
-- their active state and whether they have enrolled a second factor, and a partner surface
-- that lists a company's reps. Two of those facts are not in `public` and cannot be reached
-- from an RLS-scoped session at all:
--
--   * the sign-in address lives in auth.users.email
--   * TOTP enrolment lives in auth.mfa_factors.status
--
-- PostgREST exposes `public` (plus whatever `db.schemas` names) and nothing else, so no
-- policy on any table in `public` can make those columns readable — there is no row to
-- write a policy against. public.profiles carries name, role, phone, partner_company_id
-- and is_active, and stops there.
--
-- The alternatives were:
--
--   1. `auth.admin.listUsers()` through the service-role client. Rejected: it moves the
--      authorization decision out of Postgres and into whatever predicate the calling
--      TypeScript happens to write, which is the thing src/lib/authz.ts exists to refuse.
--      It also reads every user in the project to answer a question about a handful.
--   2. Exposing the `auth` schema to PostgREST. Rejected outright — it would publish
--      auth.users, auth.sessions and auth.mfa_factors (which stores TOTP secrets) to the
--      REST surface and let RLS decide, for tables Supabase does not own policies on.
--   3. This: one SECURITY DEFINER function, owner-gated inside the database, returning the
--      two facts and nothing else.
--
-- (3) keeps the property every other admin read in this codebase has: the caller's own
-- session is what is judged, the judgement happens in Postgres, and the check is testable
-- from pgTAP as a role rather than as a mock.

set check_function_bodies = off;

-- ---------------------------------------------------------------------------
-- public.admin_user_directory()
-- ---------------------------------------------------------------------------
--
-- Returns one row per account: sign-in address, last sign-in, and whether a *verified*
-- TOTP factor exists. Deliberately narrow:
--
--   * `secret` is never selected. auth.mfa_factors.secret is the TOTP seed — reading it
--     is equivalent to holding the second factor, so it does not leave this function even
--     to an owner.
--   * only `status = 'verified'` counts as enrolled. GoTrue writes an unverified row the
--     moment someone opens the setup screen (see src/lib/actions/mfa.ts, which sweeps
--     those away on each visit), so counting rows rather than verified rows would report
--     an abandoned enrolment as protection that is not there — the single most misleading
--     thing this screen could say.
--   * auth.mfa_factors has no `confirmed_at` column on this build (Postgres 17.6 /
--     current GoTrue), so the enrolment date is read from updated_at, which the
--     verification bumps. It is display-only; nothing branches on it.
--
-- Owner-gated with a raise rather than an empty result. A non-owner reaching this has
-- bypassed both proxy.ts and requireRole(), so there is nothing left to conceal and a
-- silent empty set would look to the caller like "no accounts exist" — an audit-relevant
-- refusal should say it refused. The generic-404 rule in §7.9 is about resources whose
-- existence is the secret; the existence of a staff directory is not.
create or replace function public.admin_user_directory()
returns table (
  user_id uuid,
  email text,
  last_sign_in_at timestamptz,
  mfa_enrolled boolean,
  mfa_confirmed_at timestamptz
)
language plpgsql
stable
security definer
set search_path = ''
as $fn$
begin
  -- Asked before private.is_owner(), and separately from it, only so the refusal names the
  -- real reason. is_owner() already goes false at aal1 — the second factor is folded into
  -- private.current_app_role() — so this branch changes no access decision; without it an
  -- owner one step short of their own desk would be told they are not an owner.
  --
  -- This is the RPC the reviewer's aal1 token used to enumerate every account's sign-in
  -- address and MFA state, which is a map of exactly which colleague to attack next. It
  -- returns auth.users data through SECURITY DEFINER, so it is the one function here whose
  -- gate cannot be delegated to a policy.
  if not private.has_aal2() then
    raise exception 'the account directory requires a session that has completed two-step verification'
      using errcode = '42501';
  end if;

  if not (select private.is_owner()) then
    raise exception 'account directory is readable by an active owner only'
      using errcode = '42501';
  end if;

  return query
    select
      u.id,
      u.email::text,
      u.last_sign_in_at,
      (f.user_id is not null) as mfa_enrolled,
      f.confirmed_at
    from auth.users u
    left join lateral (
      select mf.user_id, max(mf.updated_at) as confirmed_at
        from auth.mfa_factors mf
       where mf.user_id = u.id
         and mf.status = 'verified'
       group by mf.user_id
    ) f on true
    where u.deleted_at is null;
end;
$fn$;

-- The grant pair every routine in this schema repeats. `revoke all ... from public` first:
-- Postgres grants EXECUTE to PUBLIC on every function at creation, and the schema-level
-- USAGE revoke in the initial migration is the only thing that would otherwise stand
-- between anon and this function. 00_schema.test.sql pins both halves — that no routine in
-- public is executable by anon, and that anon holds nothing anywhere.
revoke all on function public.admin_user_directory() from public, anon;
grant execute on function public.admin_user_directory() to authenticated, service_role;
