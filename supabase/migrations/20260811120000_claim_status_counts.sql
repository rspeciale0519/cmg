-- CMG Property Solutions — claims tallied by stage, in Postgres
--
-- WHY THIS MIGRATION EXISTS
--
-- The dashboard's pipeline ladder (spec §5's ten stages) and the "N claims in view"
-- eyebrow above it were both derived in TypeScript from one query:
--
--     supabase.from("claims").select("status")      -- one row per claim
--     const total = (statuses.data ?? []).length
--
-- PostgREST caps every collection read at `db-max-rows` — 1000 in supabase/config.toml —
-- so past a thousand claims that array stops being the claims table and becomes the first
-- page of it, silently and with no error. The page had no way to know, so it kept
-- reporting a tally of the page as a tally of the business.
--
-- Seeded past the ceiling, one 1440px screen showed the nav badge "Intake 505 waiting"
-- (a real `count: exact` head request, uncapped) beside the ladder's "01 New intake 5"
-- (the capped array's share of new intakes), under the eyebrow "1000 claims in view",
-- while /admin/claims said "Showing 60 of 1022". Four numbers about one set, three of
-- them wrong, and the two that disagreed most sat 200px apart.
--
-- The comment the old query carried argued the row-per-claim shape was cheaper than a
-- count per status "at CMG's volume — hundreds of claims a year". That is a throughput
-- argument, and the defect is not throughput: a wrong number is wrong at any volume, and
-- this one arrives without a warning at precisely the point the business is doing well.
--
-- WHY A FUNCTION AND NOT A VIEW
--
-- PostgREST has no GROUP BY, so the aggregation has to live in the database either way.
-- A view would work and a function is preferred for one reason: `security_invoker` on a
-- view is a property that can be dropped by a later `create or replace view` that forgets
-- it, and dropping it would silently turn an adjuster's caseload tally into the whole
-- firm's. A function is SECURITY INVOKER unless someone writes the words SECURITY
-- DEFINER, so the safe state is the default state, and 13_claim_status_counts.test.sql
-- pins it either way.
--
-- WHY IT IS NOT OWNER-GATED
--
-- public.admin_user_directory() is the precedent for an RPC on this surface, and it is
-- gated because it reaches into `auth` through SECURITY DEFINER and therefore has to
-- carry its own authorization. This function is the opposite shape: it reads
-- public.claims as the caller, so `claims_select` is the authorization — owner and
-- assistant tally the business, an adjuster tallies the claims assigned to them, a
-- homeowner tallies their own, a partner tallies nothing. That is exactly the scoping
-- the old `.select("status")` had, which is what makes this a drop-in for it, and there
-- is no second copy of the §4 matrix here to drift from the policy.
--
-- Rows returned is bounded by the enum — thirteen at the very most — so `db-max-rows`
-- cannot reach it. That is the whole point: the cap now applies to a list of stages
-- rather than to a list of claims.

set check_function_bodies = off;

-- ---------------------------------------------------------------------------
-- public.claim_status_counts()
-- ---------------------------------------------------------------------------
--
-- One row per stage that has at least one claim the caller may see. Stages with no
-- claims are absent rather than zero: the ladder already renders a missing stage as 0
-- (`counts[status] ?? 0`), and returning thirteen rows to say "nothing here" would make
-- the function's own result larger than its answer.
--
-- `claim_count` and not `count`. The column is read by name in TypeScript and `count` is
-- also what PostgREST calls the Content-Range total, so a row property named `count`
-- beside a request option named `count` is a collision waiting for a reader to make.
create or replace function public.claim_status_counts()
returns table (status public.claim_status, claim_count bigint)
language sql
stable
security invoker
set search_path = ''
as $fn$
  select c.status, count(*)::bigint
    from public.claims c
   group by c.status;
$fn$;

-- The grant pair every routine in this schema repeats. `revoke all ... from public`
-- first: Postgres grants EXECUTE to PUBLIC on every function at creation, and the
-- schema-level USAGE revoke in the initial migration is the only thing that would
-- otherwise stand between anon and this function. 00_schema.test.sql pins both halves.
revoke all on function public.claim_status_counts() from public, anon;
grant execute on function public.claim_status_counts() to authenticated, service_role;
