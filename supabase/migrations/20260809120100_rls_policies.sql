-- CMG Property Solutions — row level security
-- Implements the access matrix in .claude/plans/feature-claims-platform.md §4 and
-- the security model in §7. Deny-by-default: RLS is enabled on every table in
-- public, and every policy is scoped `to authenticated` so anon never matches.

set check_function_bodies = off;

-- ---------------------------------------------------------------------------
-- Policy helpers. SECURITY DEFINER so a policy on public.profiles can look up
-- the caller's role without recursing through its own RLS. Each one is scoped
-- to (select auth.uid()) internally, so it can only ever answer questions about
-- the caller — which is exactly what the policy already reveals.
--
-- Every predicate below is wrapped in coalesce(..., false) so it returns a two-valued
-- answer. private.current_app_role() filters on is_active, so it returns NULL — not a
-- role — for a deactivated account and for a uid with no profiles row at all. Left
-- unwrapped, `current_app_role() = 'owner'` is then NULL rather than false, and that NULL
-- propagates: NULL or NULL is NULL, and `not NULL` is NULL. Inside an RLS policy that is
-- harmless, because Postgres admits a row only on TRUE and NULL denies exactly as false
-- does — which is why the whole helper set could carry three-valued logic unnoticed. It
-- is not harmless anywhere else. A plpgsql `if not private.can_manage_claim(...) then
-- raise` never fires on NULL, so a guard written in the obvious way admits precisely the
-- callers it was written to refuse; public.reassign_claim() was exactly that guard.
-- Making the helpers total closes the trap for every present and future non-RLS consumer
-- rather than patching the one that tripped it, and cannot loosen any policy, since the
-- only value that changes is NULL → false and both deny.
-- ---------------------------------------------------------------------------

create or replace function private.current_app_role()
returns public.app_role
language sql
stable
security definer
set search_path = ''
as $fn$
  select p.role
    from public.profiles p
   where p.id = (select auth.uid())
     and p.is_active;
$fn$;

create or replace function private.is_owner()
returns boolean
language sql
stable
security definer
set search_path = ''
as $fn$
  select coalesce(private.current_app_role() = 'owner', false);
$fn$;

create or replace function private.is_staff()
returns boolean
language sql
stable
security definer
set search_path = ''
as $fn$
  select coalesce(private.current_app_role() in ('owner', 'adjuster', 'assistant'), false);
$fn$;

-- Joined to partner_companies so that deactivating a company actually revokes its
-- reps. Without it, `status = 'inactive'` is a label with no effect and a terminated
-- contractor keeps reading referral summaries indefinitely.
create or replace function private.current_partner_company_id()
returns uuid
language sql
stable
security definer
set search_path = ''
as $fn$
  select p.partner_company_id
    from public.profiles p
    join public.partner_companies pc on pc.id = p.partner_company_id
   where p.id = (select auth.uid())
     and p.is_active
     and p.role = 'partner'
     and pc.status = 'active';
$fn$;

create or replace function private.is_assigned_adjuster(p_claim_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $fn$
  select coalesce(
    exists (
      select 1
        from public.claims c
       where c.id = p_claim_id
         and c.assigned_adjuster_id = (select auth.uid())
    ) and private.current_app_role() = 'adjuster',
    false
  );
$fn$;

-- Staff *with a reason to be on this claim*: the owner and the assistant carry the
-- whole caseload by role (spec §4), an adjuster carries only what is assigned to
-- them. `private.is_staff()` answers a different question — "is this person staff at
-- all" — and using it to guard claim-scoped rows silently promotes every adjuster to
-- caseload-wide read. Anything keyed to a claim_id uses this instead.
create or replace function private.is_staff_for_claim(p_claim_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $fn$
  select coalesce(
    private.is_owner()
      or private.current_app_role() = 'assistant'
      or private.is_assigned_adjuster(p_claim_id),
    false
  );
$fn$;

-- Owner, or the adjuster this claim is assigned to: the only roles that may
-- change status/assignment and see money (spec §4 access matrix).
create or replace function private.can_manage_claim(p_claim_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $fn$
  select coalesce(private.is_owner() or private.is_assigned_adjuster(p_claim_id), false);
$fn$;

-- Joined to profiles for is_active, as every other identity helper here is. Matching
-- on claimants.user_id alone made deactivation cosmetic: the row linking a homeowner
-- to their claim outlives the account, so a disabled customer kept full portal read
-- access to the claim, its documents and its feed.
create or replace function private.is_claim_customer(p_claim_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $fn$
  select coalesce(
    exists (
      select 1
        from public.claimants cl
        join public.profiles p on p.id = cl.user_id
       where cl.claim_id = p_claim_id
         and cl.user_id = (select auth.uid())
         and p.is_active
    ),
    false
  );
$fn$;

-- "Has this claim already been through the lor_sent → lor_signed gate?" Asked by
-- documents_delete, which has to distinguish a signed LOR that is still just a file on an
-- unstarted claim from one that is the evidence a completed transition rests on.
--
-- Stated as an explicit status list rather than `status > 'lor_sent'` on the enum. The
-- ordinal comparison reads well and is wrong twice over: it sweeps in `rejected`, which
-- sorts last but is reachable only from new_intake/under_review/lor_sent and so names a
-- claim that never passed the gate, and it silently changes meaning the day anyone adds a
-- value to public.claim_status. `lor_signed_at is not null` is wrong differently — a
-- historical record imported by the service role directly at `filed` never had it stamped.
create or replace function private.claim_past_lor_gate(p_claim_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $fn$
  select coalesce(
    exists (
      select 1
        from public.claims c
       where c.id = p_claim_id
         and c.status in (
           'lor_signed', 'documenting', 'filed', 'negotiating',
           'settlement_offered', 'settled', 'closed', 'denied', 'reopened'
         )
    ),
    false
  );
$fn$;

-- "Is this consent row about the caller?" — as opposed to merely about a claim the caller
-- is on. A consent snapshot carries the subject's own email, phone and originating IP, and
-- withdrawn_at on it is a statement made in that person's name.
--
-- Two ways to own an address, because a homeowner has two and they need not be the same
-- string: the one on their auth account, and the one on the claimants row that links them
-- to the claim (which is what the §6 intake collected the consent under, and what the
-- invite was sent to). Matching on only one of them would lock a real homeowner out of the
-- consent view/withdraw §10 promises them, which is a worse failure than the one being
-- fixed. Compared case-insensitively and trimmed: claimants.email is normalised by
-- public.normalize_claimant_email() but consents.email is not, so they are not guaranteed
-- to agree byte for byte.
--
-- SECURITY DEFINER because it must answer about auth.users and about claimants rows the
-- caller may not be able to select; scoped internally to (select auth.uid()), so it can
-- only ever answer about the caller. coalesce for the reason the whole helper set has it.
create or replace function private.is_consent_subject(p_email text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $fn$
  select coalesce(
    exists (
      select 1
        from auth.users u
        join public.profiles p on p.id = u.id
       where u.id = (select auth.uid())
         and p.is_active
         and lower(btrim(u.email)) = lower(btrim(p_email))
    )
    or exists (
      select 1
        from public.claimants cl
        join public.profiles p on p.id = cl.user_id
       where cl.user_id = (select auth.uid())
         and p.is_active
         and lower(btrim(cl.email)) = lower(btrim(p_email))
    ),
    false
  );
$fn$;

create or replace function private.is_claim_partner(p_claim_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $fn$
  select coalesce(
    exists (
      select 1
        from public.claims c
       where c.id = p_claim_id
         and c.partner_company_id is not null
         and c.partner_company_id = private.current_partner_company_id()
    ),
    false
  );
$fn$;

revoke all on all routines in schema private from public, anon;
grant execute on all routines in schema private to authenticated, service_role;

-- ---------------------------------------------------------------------------
-- Enable RLS everywhere (deny-by-default)
-- ---------------------------------------------------------------------------

alter table public.profiles                enable row level security;
alter table public.partner_companies       enable row level security;
alter table public.leads                   enable row level security;
alter table public.claims                  enable row level security;
alter table public.claim_financials        enable row level security;
alter table public.claimants               enable row level security;
alter table public.claim_status_history    enable row level security;
alter table public.claim_events            enable row level security;
alter table public.documents               enable row level security;
alter table public.consents                enable row level security;
alter table public.invites                 enable row level security;
alter table public.audit_log               enable row level security;
alter table public.notifications_outbox    enable row level security;
alter table public.claim_partner_summaries enable row level security;
alter table public.rate_limits             enable row level security;
alter table public.pandadoc_webhook_events enable row level security;
alter table public.claim_ref_counters      enable row level security;
alter table public.storage_cleanup_queue   enable row level security;

-- ---------------------------------------------------------------------------
-- profiles — self read/edit; staff read; owner administers
-- ---------------------------------------------------------------------------

-- The self branch carries `and is_active` so that deactivation closes the customer
-- surface as one piece. Without it a disabled account still read its own profile row,
-- which is the last relation that kept answering after claims, documents, events and
-- claimants had all gone dark. Staff keep an unconditional read: administering a
-- deactivated account requires being able to see it.
--
-- DELIBERATE DEVIATION FROM §4, reviewed and kept — the same shape as the one recorded on
-- partner_companies_select below. The staff branch is private.is_staff(), so an adjuster
-- and an assistant read every profiles row in the business, not only those on claims they
-- are assigned. §4's matrix puts profile administration in the owner-only row, and
-- "assigned only" is the rule everywhere else an adjuster touches claim-scoped data.
--
-- It is kept because assignment is displayed, not just enforced. Every staff surface that
-- names a person — the claims table's adjuster column, the claim detail header, the
-- assignee picker public.reassign_claim() is driven from, the author of a feed entry, the
-- uploader of a document — resolves a uuid to a name through this table, and an adjuster
-- handing a claim off has to see the colleague they are handing it to, who by definition
-- is not on the claim yet. Narrowing to assigned-only would leave those names to be
-- fetched by a service-role call on pages the caller is already authorised to see, which
-- trades a real read boundary for a decorative one.
--
-- What the deviation exposes is bounded: profiles holds name, phone, role,
-- partner_company_id and is_active — the staff directory — and no claim data, no financial
-- data and no consent evidence. Writes are unaffected and stay where §4 puts them:
-- profiles_update_self for a caller's own row, profiles_update_owner for anyone else's,
-- with public.guard_profile_privileges() refusing role / partner_company_id / is_active
-- changes underneath both.
drop policy if exists profiles_select_self_or_staff on public.profiles;
create policy profiles_select_self_or_staff on public.profiles
  for select to authenticated
  using (
    (id = (select auth.uid()) and is_active)
    or (select private.is_staff())
  );

drop policy if exists profiles_update_self on public.profiles;
create policy profiles_update_self on public.profiles
  for update to authenticated
  using (id = (select auth.uid()))
  with check (id = (select auth.uid()));

drop policy if exists profiles_update_owner on public.profiles;
create policy profiles_update_owner on public.profiles
  for update to authenticated
  using ((select private.is_owner()))
  with check ((select private.is_owner()));

-- profiles_insert_owner and profiles_delete_owner used to live here and were dead code:
-- `authenticated` holds only SELECT and UPDATE on public.profiles, so the grant layer
-- refuses an INSERT or DELETE before any policy is consulted. They read as an owner
-- capability that does not exist. Profile rows are created by the on_auth_user_created
-- trigger on auth.users and removed by the cascade from auth.users; anything else is the
-- service role's job. Dropped explicitly so a database that ever had them loses them.
drop policy if exists profiles_insert_owner on public.profiles;
drop policy if exists profiles_delete_owner on public.profiles;

-- ---------------------------------------------------------------------------
-- partner_companies — staff read, owner writes. The access matrix (spec §4) puts
-- this table in the owner-only row alongside invites and profile administration;
-- partners hold no policy on it. Everything a rep needs about their own company is
-- either already in their session or reachable through claim_partner_summaries, so
-- the read they had here bought nothing and exposed the internal contact and notes
-- columns CMG keeps about them.
--
-- DELIBERATE DEVIATION FROM §4, reviewed and kept: the SELECT policy is `is_staff()`,
-- not `is_owner()`. §4's matrix puts this table in the owner-only row, but claims carry
-- partner_company_id and every staff-facing surface that lists or filters a claim has to
-- render that company as a name rather than a uuid — the claims table, the claim detail
-- header, the intake queue and the projection viewer all do. Owner-only read would leave
-- adjusters and assistants resolving company names through a service-role call on a page
-- they are already authorised to see, which trades a real read boundary for a fake one.
-- Writes stay owner-only, which is where the authority in that matrix row actually sits,
-- and partners still hold no policy on this table at all.
-- ---------------------------------------------------------------------------

drop policy if exists partner_companies_select on public.partner_companies;
create policy partner_companies_select on public.partner_companies
  for select to authenticated
  using ((select private.is_staff()));

drop policy if exists partner_companies_insert_owner on public.partner_companies;
create policy partner_companies_insert_owner on public.partner_companies
  for insert to authenticated
  with check ((select private.is_owner()));

drop policy if exists partner_companies_update_owner on public.partner_companies;
create policy partner_companies_update_owner on public.partner_companies
  for update to authenticated
  using ((select private.is_owner()))
  with check ((select private.is_owner()));

drop policy if exists partner_companies_delete_owner on public.partner_companies;
create policy partner_companies_delete_owner on public.partner_companies
  for delete to authenticated
  using ((select private.is_owner()));

-- ---------------------------------------------------------------------------
-- leads — staff read; owner and assistant manage
-- ---------------------------------------------------------------------------

drop policy if exists leads_select_staff on public.leads;
create policy leads_select_staff on public.leads
  for select to authenticated
  using ((select private.is_staff()));

drop policy if exists leads_insert_staff on public.leads;
create policy leads_insert_staff on public.leads
  for insert to authenticated
  with check ((select private.current_app_role()) in ('owner', 'assistant'));

drop policy if exists leads_update_staff on public.leads;
create policy leads_update_staff on public.leads
  for update to authenticated
  using ((select private.current_app_role()) in ('owner', 'assistant'))
  with check ((select private.current_app_role()) in ('owner', 'assistant'));

drop policy if exists leads_delete_owner on public.leads;
create policy leads_delete_owner on public.leads
  for delete to authenticated
  using ((select private.is_owner()));

-- ---------------------------------------------------------------------------
-- claims — owner CRUD, assigned adjuster read/update, assistant read-only,
--          customer reads their own. Partners have NO policy here at all.
-- ---------------------------------------------------------------------------

drop policy if exists claims_select on public.claims;
create policy claims_select on public.claims
  for select to authenticated
  using (
    (select private.is_owner())
    or (select private.current_app_role()) = 'assistant'
    or ((select private.current_app_role()) = 'adjuster' and assigned_adjuster_id = (select auth.uid()))
    or private.is_claim_customer(id)
  );

drop policy if exists claims_insert_owner on public.claims;
create policy claims_insert_owner on public.claims
  for insert to authenticated
  with check ((select private.is_owner()));

-- USING is the test that actually decides this policy. WITH CHECK repeats it for
-- symmetry and for the reader, but it is not a second, independent gate:
-- private.can_manage_claim() is SECURITY DEFINER and answers by querying public.claims,
-- and a query inside the statement that is doing the UPDATE runs under that statement's
-- snapshot — which still shows the PRE-update row. So the WITH CHECK here evaluates
-- against the same row USING did, and for this policy WITH CHECK is identical to USING.
-- Anything that must be judged on the *post*-update row cannot be expressed this way and
-- has to be written as a column reference (which does resolve to the new value) or moved
-- into a trigger. Attribution to a partner company is exactly such a rule, which is why
-- it lives in public.guard_claim_update() rather than here.
--
-- What does constrain the new row is public.claims' own SELECT policy: Postgres applies
-- SELECT policies to the new row of an UPDATE, so a write that moves a row outside
-- claims_select is rejected with "new row violates row-level security policy". That is
-- deliberate for every column except assignment — see public.reassign_claim() below.
drop policy if exists claims_update_manage on public.claims;
create policy claims_update_manage on public.claims
  for update to authenticated
  using (private.can_manage_claim(id))
  with check (private.can_manage_claim(id));

drop policy if exists claims_delete_owner on public.claims;
create policy claims_delete_owner on public.claims
  for delete to authenticated
  using ((select private.is_owner()));

-- Reassignment is the one update an adjuster is granted by spec §4 ("status /
-- assignment | assigned ✔") that they cannot perform as a direct UPDATE. claims_select
-- scopes an adjuster to `assigned_adjuster_id = auth.uid()`, and Postgres applies SELECT
-- policies to the new row of an UPDATE, so the instant the new value is anyone other
-- than themselves the row is outside their visibility and the statement is refused. An
-- assigned adjuster could not even unassign themselves; every hand-off had to route
-- through the owner.
--
-- Loosening claims_select is the wrong repair — that boundary is the whole reason an
-- adjuster sees a caseload rather than the business. Instead the authorisation is made
-- explicit here: judge the caller against the PRE-update row, then perform the write as
-- the function owner, where RLS no longer applies. The claim's audit trigger is an AFTER
-- trigger on the table and fires regardless of who issues the UPDATE, and auth.uid()
-- still resolves to the real caller inside a SECURITY DEFINER body (it reads the request
-- GUC, which definer rights do not change), so the reassignment is attributed to the
-- adjuster who made it and not to the function's owner.
create or replace function public.reassign_claim(p_claim_id uuid, p_new_adjuster uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $fn$
begin
  if p_claim_id is null then
    raise exception 'reassign_claim requires a claim id' using errcode = '22023';
  end if;

  -- Evaluated before the write, so it is the current assignment that decides.
  --
  -- coalesce, even though private.can_manage_claim() is now total: this guard is the
  -- only thing standing between an arbitrary caller and a SECURITY DEFINER UPDATE that
  -- runs with BYPASSRLS, and `not NULL` is NULL, which is not TRUE, so an IF written
  -- without it does not fire and control simply falls through to the write. That is how
  -- every deactivated account — customer, partner, assistant, owner — and every uid with
  -- no profiles row could reassign any claim in the business while reading zero rows from
  -- every table in it. The helper is fixed at source; this stays as the local invariant,
  -- so the property does not depend on a function three files away keeping it.
  if not coalesce(private.can_manage_claim(p_claim_id), false) then
    raise exception 'only an owner or the assigned adjuster may change the assignment of a claim'
      using errcode = '42501';
  end if;

  -- A null new adjuster means "unassign", which is a legitimate move: it returns the
  -- claim to the intake queue. Any non-null value must name an account that is actually
  -- an adjuster and actually still active, so assignment cannot be parked on a
  -- deactivated account or handed to a customer or partner profile.
  if p_new_adjuster is not null
     and not exists (
       select 1 from public.profiles p
        where p.id = p_new_adjuster and p.is_active and p.role = 'adjuster'
     ) then
    raise exception 'a claim can only be assigned to an active adjuster'
      using errcode = '23514';
  end if;

  update public.claims
     set assigned_adjuster_id = p_new_adjuster
   where id = p_claim_id;

  -- Same refusal as the authorisation branch, deliberately. A distinct "claim % does not
  -- exist" / 23503 told the caller which of the two it was, and that is an existence
  -- oracle over the whole claims table (spec §7.9: "generic 404s for unauthorized ids —
  -- no existence oracle"). It leaked the claim id namespace to anyone who could reach the
  -- RPC, and the id is not the secret — the difference between "there is no such claim"
  -- and "there is one and it is not yours" is. Collapsing both onto 42501 with one message
  -- makes the two indistinguishable from outside. Nothing legitimate depended on telling
  -- them apart: an owner sees every claim through claims_select and an adjuster sees the
  -- ones they can act on, so a caller entitled to know a claim exists already knows.
  if not found then
    raise exception 'only an owner or the assigned adjuster may change the assignment of a claim'
      using errcode = '42501';
  end if;
end;
$fn$;

revoke all on function public.reassign_claim(uuid, uuid) from public, anon;
grant execute on function public.reassign_claim(uuid, uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- claim_financials — owner + assigned adjuster only. No policy exists for
-- assistants, customers or partners, so RLS denies them outright.
-- ---------------------------------------------------------------------------

drop policy if exists claim_financials_select on public.claim_financials;
create policy claim_financials_select on public.claim_financials
  for select to authenticated
  using (private.can_manage_claim(claim_id));

drop policy if exists claim_financials_insert on public.claim_financials;
create policy claim_financials_insert on public.claim_financials
  for insert to authenticated
  with check (private.can_manage_claim(claim_id));

drop policy if exists claim_financials_update on public.claim_financials;
create policy claim_financials_update on public.claim_financials
  for update to authenticated
  using (private.can_manage_claim(claim_id))
  with check (private.can_manage_claim(claim_id));

drop policy if exists claim_financials_delete_owner on public.claim_financials;
create policy claim_financials_delete_owner on public.claim_financials
  for delete to authenticated
  using ((select private.is_owner()));

-- ---------------------------------------------------------------------------
-- claimants — staff read, owner/assigned adjuster write, customer reads own claim
-- ---------------------------------------------------------------------------

-- The bare `user_id = auth.uid()` branch that used to sit in the middle here has been
-- removed. For an active homeowner it granted nothing that private.is_claim_customer()
-- does not already grant — that helper matches on exactly the same claimants.user_id, one
-- claim wider. What it did add was a read that skipped the is_active join, so a
-- deactivated customer kept a row disclosing the claim_id they were attached to, which is
-- the same leak private.is_claim_customer() was rewritten to close.
drop policy if exists claimants_select on public.claimants;
create policy claimants_select on public.claimants
  for select to authenticated
  using (
    private.is_staff_for_claim(claim_id)
    or private.is_claim_customer(claim_id)
  );

drop policy if exists claimants_insert on public.claimants;
create policy claimants_insert on public.claimants
  for insert to authenticated
  with check (private.can_manage_claim(claim_id));

drop policy if exists claimants_update on public.claimants;
create policy claimants_update on public.claimants
  for update to authenticated
  using (private.can_manage_claim(claim_id))
  with check (private.can_manage_claim(claim_id));

drop policy if exists claimants_delete on public.claimants;
create policy claimants_delete on public.claimants
  for delete to authenticated
  using (private.can_manage_claim(claim_id));

-- ---------------------------------------------------------------------------
-- claim_status_history — immutable log; staff + the claim's customer may read,
-- only owner/assigned adjuster may append.
-- ---------------------------------------------------------------------------

drop policy if exists claim_status_history_select on public.claim_status_history;
create policy claim_status_history_select on public.claim_status_history
  for select to authenticated
  using (
    (select private.is_owner())
    or (select private.current_app_role()) = 'assistant'
    or private.is_assigned_adjuster(claim_id)
    or private.is_claim_customer(claim_id)
  );

drop policy if exists claim_status_history_insert on public.claim_status_history;
create policy claim_status_history_insert on public.claim_status_history
  for insert to authenticated
  with check (private.can_manage_claim(claim_id) and changed_by = (select auth.uid()));

-- ---------------------------------------------------------------------------
-- claim_events — visibility-scoped activity feed
-- ---------------------------------------------------------------------------

drop policy if exists claim_events_select on public.claim_events;
create policy claim_events_select on public.claim_events
  for select to authenticated
  using (
    (select private.is_owner())
    or (select private.current_app_role()) = 'assistant'
    or private.is_assigned_adjuster(claim_id)
    or (visibility in ('customer', 'shared') and private.is_claim_customer(claim_id))
    or (visibility in ('partner', 'shared') and private.is_claim_partner(claim_id))
  );

-- The assistant branch is bounded on audience as well as on type: spec §4 grants
-- assistants notes, and an entry marked `partner` or `shared` is not a note — it is a
-- disclosure to a referring contractor, which is the owner's and the assigned
-- adjuster's call to make.
drop policy if exists claim_events_insert_staff on public.claim_events;
create policy claim_events_insert_staff on public.claim_events
  for insert to authenticated
  with check (
    author_id = (select auth.uid())
    and (
      private.can_manage_claim(claim_id)
      or (
        (select private.current_app_role()) = 'assistant'
        and type in ('note', 'reply')
        and visibility in ('internal', 'customer')
      )
    )
  );

drop policy if exists claim_events_insert_customer on public.claim_events;
create policy claim_events_insert_customer on public.claim_events
  for insert to authenticated
  with check (
    (select private.current_app_role()) = 'customer'
    and private.is_claim_customer(claim_id)
    and author_id = (select auth.uid())
    and type = 'question'
    and visibility = 'customer'
  );

-- ---------------------------------------------------------------------------
-- documents — staff full, customer sees/uploads only visibility='customer' on
-- their own claim. Partners get no policy (spec §4: documents ✖ for partners).
-- ---------------------------------------------------------------------------

drop policy if exists documents_select on public.documents;
create policy documents_select on public.documents
  for select to authenticated
  using (
    private.is_staff_for_claim(claim_id)
    or (visibility = 'customer' and private.is_claim_customer(claim_id))
  );

-- INSERT and UPDATE are claim-scoped for the same reason SELECT is, and for one
-- more: a document of kind `lor_signed` is what opens the lor_sent → lor_signed
-- gate. Left at `is_staff()`, any adjuster could file that document against any
-- claim in the business and unlock a transition on a file they have no part in.
-- Re-parenting is closed separately by public.guard_document_claim_immutable(),
-- since an UPDATE only has to satisfy the policy on the claim the row is on now.
-- `kind` is not a label, it is the key to the lor_sent → lor_signed gate: the transition
-- trigger asks only whether a documents row of kind 'lor_signed' exists on the claim. So
-- whoever can write that value can assert that CMG holds a signed letter of
-- representation over a homeowner. Two branches previously left that open:
--
--   * the customer branch constrained visibility and claim but not kind, so a homeowner
--     could upload their own 'lor_signed' row and arm the gate on their own file;
--   * the staff branch used is_staff_for_claim(), which includes assistants — who are ✖
--     on status in spec §4 — so an assistant could arm the gate on any claim.
--
-- Customers are therefore held to the kinds a homeowner legitimately supplies, and the
-- representation kinds are restricted to the roles that own the lifecycle: the owner and
-- the assigned adjuster. 'contract', 'estimate' and 'denial' are staff artefacts and are
-- deliberately absent from the customer list.
drop policy if exists documents_insert on public.documents;
create policy documents_insert on public.documents
  for insert to authenticated
  with check (
    (
      private.is_staff_for_claim(claim_id)
      and uploaded_by = (select auth.uid())
      and (kind not in ('lor_unsigned', 'lor_signed') or private.can_manage_claim(claim_id))
    )
    or (
      visibility = 'customer'
      and private.is_claim_customer(claim_id)
      and uploaded_by = (select auth.uid())
      and kind in ('photo', 'declarations', 'correspondence', 'other')
    )
  );

-- Constraining INSERT alone would only move the assistant one statement along: upload an
-- 'other' and relabel it 'lor_signed'. The same test is therefore applied to both ends of
-- the update. In USING, `kind` is the row's existing value, so an assistant cannot touch a
-- representation document at all; in WITH CHECK it is the new value, so they cannot turn
-- an ordinary document into one. Together those close relabelling in both directions —
-- arming the gate, and stripping the evidence off a claim that has already passed it.
-- (Unlike private.can_manage_claim(), a bare column reference in WITH CHECK does resolve
-- to the post-update value; see the note on claims_update_manage above.)
drop policy if exists documents_update_staff on public.documents;
create policy documents_update_staff on public.documents
  for update to authenticated
  using (
    private.is_staff_for_claim(claim_id)
    and (kind not in ('lor_unsigned', 'lor_signed') or private.can_manage_claim(claim_id))
  )
  with check (
    private.is_staff_for_claim(claim_id)
    and (kind not in ('lor_unsigned', 'lor_signed') or private.can_manage_claim(claim_id))
  );

-- documents_update_staff (above) stops an assistant stripping the evidence off a claim
-- that has already passed the lor_signed gate. DELETE reached the same end by a shorter
-- route and nothing stood in the way: private.can_manage_claim() is exactly the assigned
-- adjuster and the owner, so the adjuster on a claim sitting at settlement_offered could
-- delete its lor_signed document and leave the file with zero — the claim still asserting
-- that CMG holds a signed letter of representation over the homeowner, with nothing behind
-- the assertion. public.enforce_claim_status_transition() only consults that document on
-- the way through the gate, so nothing downstream ever notices it has gone.
--
-- Deletion of a signed LOR is therefore refused once the claim has advanced past lor_sent.
-- Before that point it is still an ordinary file on an unstarted claim — a wrong upload,
-- a superseded draft — and deleting it is a legitimate correction, so the block is keyed
-- to the gate rather than to the kind alone. `kind` is NOT NULL and
-- private.claim_past_lor_gate() never returns NULL, so this predicate is two-valued.
--
-- Only JWT-bearing callers are affected: this is a policy, not a trigger, and service_role
-- holds BYPASSRLS, so the §6 accept, the PandaDoc webhook and any out-of-band correction
-- run exactly as before. The cascade from claims_delete_owner is likewise unaffected —
-- Postgres runs referential actions with the referenced table's rights, not through this
-- policy — so an owner deleting a whole claim still takes its documents with it.
drop policy if exists documents_delete on public.documents;
create policy documents_delete on public.documents
  for delete to authenticated
  using (
    private.can_manage_claim(claim_id)
    and (kind <> 'lor_signed' or not private.claim_past_lor_gate(claim_id))
  );

-- ---------------------------------------------------------------------------
-- consents — staff read; the claim's customer may read and withdraw their own.
-- UPDATE is granted at row level because RLS cannot grant a single column, so the
-- column-level rule ("withdrawn_at and nothing else") is enforced one level down by
-- public.guard_consent_immutable(), and every change is written to audit_log.
--
-- The customer branches are scoped to the party, not merely to the claim. They used to
-- ask only private.is_claim_customer(claim_id), and a claim routinely has more than one
-- claimant — §4 provides for a second homeowner and the intake form collects one. Every
-- co-claimant with a portal account therefore read every consent snapshot on the file:
-- the other party's email, phone and the IP address they submitted from, none of which is
-- theirs. Worse on the UPDATE side, where the same branch let them set withdrawn_at on
-- somebody else's consent — revoking a stranger's permission to be contacted, in the one
-- table that exists to prove what that person actually agreed to. `and
-- private.is_consent_subject(email)` narrows both branches to rows carrying an address the
-- caller owns; staff branches are untouched, since reading consent across a claim is
-- exactly the evidentiary job §7.7 gives them.
-- ---------------------------------------------------------------------------

drop policy if exists consents_select on public.consents;
create policy consents_select on public.consents
  for select to authenticated
  using (
    (select private.is_owner())
    or (select private.current_app_role()) = 'assistant'
    or (claim_id is not null and private.is_assigned_adjuster(claim_id))
    or (
      claim_id is not null
      and private.is_claim_customer(claim_id)
      and private.is_consent_subject(email)
    )
  );

drop policy if exists consents_insert_staff on public.consents;
create policy consents_insert_staff on public.consents
  for insert to authenticated
  with check ((select private.is_owner()) or (claim_id is not null and private.can_manage_claim(claim_id)));

-- `email` in WITH CHECK resolves to the post-update value, but that is the same value
-- USING saw: public.guard_consent_immutable() is a BEFORE trigger and pins email for every
-- JWT-bearing caller, so a row whose subject changed never reaches this test.
drop policy if exists consents_update on public.consents;
create policy consents_update on public.consents
  for update to authenticated
  using (
    (select private.is_owner())
    or (claim_id is not null and private.can_manage_claim(claim_id))
    or (
      claim_id is not null
      and private.is_claim_customer(claim_id)
      and private.is_consent_subject(email)
    )
  )
  with check (
    (select private.is_owner())
    or (claim_id is not null and private.can_manage_claim(claim_id))
    or (
      claim_id is not null
      and private.is_claim_customer(claim_id)
      and private.is_consent_subject(email)
    )
  );

-- ---------------------------------------------------------------------------
-- invites — owner only (spec §4 access matrix)
-- ---------------------------------------------------------------------------

drop policy if exists invites_all_owner on public.invites;
create policy invites_all_owner on public.invites
  for all to authenticated
  using ((select private.is_owner()))
  with check ((select private.is_owner()));

-- ---------------------------------------------------------------------------
-- audit_log — append-only. SELECT for owner and nothing else: deliberately no
-- INSERT policy (rows arrive via SECURITY DEFINER triggers / service role) and
-- deliberately no UPDATE or DELETE policy, ever (spec §4, §7.7).
-- ---------------------------------------------------------------------------

drop policy if exists audit_log_select_owner on public.audit_log;
create policy audit_log_select_owner on public.audit_log
  for select to authenticated
  using ((select private.is_owner()));

-- ---------------------------------------------------------------------------
-- claim_partner_summaries — the ONLY claim-shaped table a partner can read.
-- Maintained by SECURITY DEFINER triggers, so no write policy is needed.
-- ---------------------------------------------------------------------------

drop policy if exists claim_partner_summaries_select on public.claim_partner_summaries;
create policy claim_partner_summaries_select on public.claim_partner_summaries
  for select to authenticated
  using (
    (select private.is_staff())
    or partner_company_id = (select private.current_partner_company_id())
  );

-- ---------------------------------------------------------------------------
-- Service-role-only tables: RLS enabled, zero policies => no client access.
--   notifications_outbox, rate_limits, pandadoc_webhook_events, claim_ref_counters
-- ---------------------------------------------------------------------------
