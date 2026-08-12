-- CMG Property Solutions — the homeowner's view of who is handling their claim
--
-- WHY THIS MIGRATION EXISTS
--
-- Spec §10 opens the customer portal with "the assigned adjuster's name", and a homeowner
-- cannot read it. public.profiles is gated by profiles_select_self_or_staff, which is
-- `id = auth.uid() and is_active` or private.is_staff() — a customer is neither staff nor
-- the adjuster, so `claims -> profiles` joins to nothing for them and the overview would
-- name the person representing them as a uuid or as nothing at all.
--
-- The alternatives were:
--
--   1. Read the adjuster through the service-role client. Rejected for the reason
--      src/lib/authz.ts states at the top: a service-role read answers "does this row
--      exist", not "may this caller have it", and moving that decision into TypeScript is
--      exactly what this codebase refuses. It is also the pattern that, repeated once per
--      surface, ends with the portal rendering from an unpoliced client.
--   2. Widen profiles_select_self_or_staff with a customer branch. Rejected: it would hand
--      the homeowner the whole profiles row — role, is_active, partner_company_id, phone —
--      to answer a question about a name, and it would do so for a table whose policy is
--      already the most load-bearing one in the schema.
--   3. This: one SECURITY DEFINER function returning the two display columns for one
--      claim, gated on the caller being that claim's customer.
--
-- (3) keeps the property every other read in this codebase has — the caller's own session
-- is what is judged, the judgement happens in Postgres, and pgTAP can test it as a role.

set check_function_bodies = off;

-- ---------------------------------------------------------------------------
-- public.portal_claim_contact(p_claim_id uuid)
-- ---------------------------------------------------------------------------
--
-- The assigned adjuster's first and last name, for one claim, to that claim's homeowner.
-- Deliberately narrow:
--
--   * two columns. Not role (the homeowner has no use for it and it maps the firm), not
--     phone (§4 routes homeowner contact through CMG's published number, not an
--     individual's), not is_active, not the uuid — an id here would be a handle a portal
--     account could carry to some future endpoint.
--   * one claim per call, named by the caller and checked against them. There is no
--     "list the adjusters" shape of this function, because there is no screen that wants
--     one and an unbounded version is the one that leaks.
--
-- Empty result rather than a raise, which is the opposite of admin_user_directory() and
-- for the reason §7.9 gives: the existence of a staff directory is not a secret, but the
-- existence of a *claim* is. A raise here would separate "this claim is not yours" from
-- "there is no such claim" for any portal account willing to read the error, which is the
-- existence oracle requireClaimAccess() and the generic 404s exist to close. A homeowner
-- asking about their own claim gets the row; anyone else gets what a missing claim gets.
--
-- STABLE, so it may be called from a select list; is_claim_customer() is stable too.
create or replace function public.portal_claim_contact(p_claim_id uuid)
returns table (
  first_name text,
  last_name text
)
language sql
stable
security definer
set search_path = ''
as $fn$
  select p.first_name, p.last_name
    from public.claims c
    join public.profiles p on p.id = c.assigned_adjuster_id
   where c.id = p_claim_id
     and p.is_active
     and private.is_claim_customer(p_claim_id);
$fn$;

-- The grant pair every routine in this schema repeats. `revoke all ... from public` first:
-- Postgres grants EXECUTE to PUBLIC on every function at creation, and the schema-level
-- USAGE revoke in the initial migration is the only thing that would otherwise stand
-- between anon and this function. 00_schema.test.sql pins both halves.
revoke all on function public.portal_claim_contact(uuid) from public, anon;
grant execute on function public.portal_claim_contact(uuid) to authenticated, service_role;
