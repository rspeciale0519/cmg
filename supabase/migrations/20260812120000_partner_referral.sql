-- CMG Property Solutions — what a referring contractor may create
--
-- Spec §6 gives the partner surface one write: `/partner/refer`, where a rep sends CMG the
-- homeowner and the loss and nothing else — "staff completes details on accept". Two things
-- in the schema stood between that sentence and a row.
--
-- ---------------------------------------------------------------------------
-- 1. claims.carrier / policy_number / carrier_tenure / loss_time were NOT NULL
-- ---------------------------------------------------------------------------
--
-- Those NOT NULLs were true statements about the only claim source that existed when they
-- were written: a homeowner filing on their own roof knows their own carrier, and
-- intakeSchema requires all of them before the public form will submit. A contractor
-- standing on somebody else's roof does not know any of them, and §6 says they are not
-- asked.
--
-- The alternatives were both worse than relaxing the column:
--
--   * Write a sentinel. `carrier = 'Unknown'` reads acceptably; carrier_tenure cannot be
--     faked at all, because its three labels are lengths of time and every one of them
--     would assert, on the homeowner's behalf, a fact nobody collected. The same objection
--     the intake form records against defaulting its yes/no radios to "No".
--   * Ask the rep. That is the question §6 deliberately does not put to them — a
--     contractor guessing at a policy number produces a claim file that has to be
--     corrected before it can be used, which is worse than one that is honestly blank.
--
-- So the columns now carry an absence, and every screen that prints them says "Not
-- provided" rather than showing an empty cell. The requirement itself has not gone
-- anywhere: `intakeSchema` still refuses a public submission without all three, and
-- `acceptIntake` now asks the operator for them when the claim it is accepting has none —
-- which is the point in the lifecycle §6 nominates.
--
-- No CHECK re-states the rule for later statuses (e.g. "not null from lor_sent onwards").
-- It was drafted and dropped: the only writer that could hit it is the LOR dispatch, and a
-- constraint violation there is a raw 23514 on a screen with no field to fix it in. The
-- gap is closed at accept, where there is a form, rather than guarded at a wall with no
-- door.

-- loss_time is the fourth, and it is the one that was already fabricating. It is NOT NULL
-- `default '12:00:00'`, so a referral that simply omitted the column would have the
-- database write noon — and the intake queue's triage card prints "· 12:00 PM" beside the
-- date, an assertion about when a storm hit that nobody made. The default stays, because
-- the seed and half the pgTAP suite insert without the column and are entitled to it; the
-- referral passes an explicit null instead, and every screen drops the time when it is
-- absent rather than printing a dash beside the date.
alter table public.claims alter column carrier drop not null;
alter table public.claims alter column policy_number drop not null;
alter table public.claims alter column carrier_tenure drop not null;
alter table public.claims alter column loss_time drop not null;

comment on column public.claims.loss_time is
  'Null when the source did not collect a time — a partner referral asks for the date only. The default remains 12:00 for callers that omit the column entirely.';
comment on column public.claims.carrier is
  'Null only while a partner referral sits in the intake queue: the referring rep is not asked for it (§6) and staff supply it on accept.';
comment on column public.claims.policy_number is
  'Null only while a partner referral sits in the intake queue — see claims.carrier.';
comment on column public.claims.carrier_tenure is
  'Null only while a partner referral sits in the intake queue — see claims.carrier. There is no "unknown" label on purpose: each label is a length of time, and picking one would assert something nobody was asked.';

-- ---------------------------------------------------------------------------
-- 2. public.partner_referral_company() — which company a rep may refer for
-- ---------------------------------------------------------------------------
--
-- The referral action has to answer "which company is this rep acting for, and is that
-- relationship still live", and it must answer it from the caller's own session rather than
-- from a predicate written in TypeScript — the rule src/lib/authz.ts states at the top.
--
-- private.current_partner_company_id() already decides exactly this, joined to
-- partner_companies so a company set `inactive` really does revoke its reps. It is not
-- reachable from the app: PostgREST exposes `public`, and a partner holds no select policy
-- on partner_companies either (partner_companies_select is staff-only), so a rep cannot
-- read their own company's row to check its status.
--
-- This is the one-line public door onto that decision. It delegates rather than repeats —
-- there is one definition of "may this rep act for this company", and a policy change to
-- the private helper moves this function with it. The company name comes back because the
-- claim's referrer_name is written as "Company — Rep" (the shape the seed and the admin
-- intake card already use), and the rep cannot read the name any other way.
--
-- Empty result rather than a raise, for anyone who is not an active rep of an active
-- company: a customer, a staff member and a terminated contractor all get the same nothing,
-- and the action turns it into one sentence.
create or replace function public.partner_referral_company()
returns table (
  id uuid,
  name text
)
language sql
stable
security definer
set search_path = ''
as $fn$
  select pc.id, pc.name
    from public.partner_companies pc
   where pc.id = private.current_partner_company_id();
$fn$;

-- The grant pair every routine in this schema repeats. `revoke all ... from public` first:
-- Postgres grants EXECUTE to PUBLIC on every function at creation.
revoke all on function public.partner_referral_company() from public, anon;
grant execute on function public.partner_referral_company() to authenticated, service_role;
