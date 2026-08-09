-- CMG Property Solutions — claims platform core schema
-- Design authority: .claude/plans/feature-claims-platform.md §4 (data model), §5 (lifecycle)
-- Enums, tables, sequences, functions, triggers, indexes, grants.
-- RLS policies live in the following migration.

set check_function_bodies = off;

create extension if not exists pgcrypto with schema extensions;

create schema if not exists private;
revoke all on schema private from public;
grant usage on schema private to postgres, authenticated, service_role;

-- ---------------------------------------------------------------------------
-- "Is this the application's own server, rather than a user session?"
-- ---------------------------------------------------------------------------

-- Every guard in this file that has to let CMG's own server through used to ask
-- `auth.uid() is null` — "no JWT subject means service role". That is true of a bare
-- service-role connection, of migrations and of the seed, and it was the whole test. It
-- is not true of a service-role *JWT*, which is a signed token like any other and carries
-- whatever `sub` its issuer put in it — Supabase's own service key does, and so does any
-- token minted server-side that keeps the acting staff member's subject for attribution.
-- Such a caller has a non-null auth.uid() and was therefore judged as an ordinary user
-- session by every guard below. Each one fails closed, so nothing leaked; what they closed
-- on was the application itself. The §6 intake re-parent, the historical-import path in
-- public.claims_before_insert(), partner re-attribution on accept, out-of-band consent
-- correction and the invite flow's role assignment would each have been refused at launch
-- for a reason that has nothing to do with authority.
--
-- The `role` claim is exactly as trustworthy as `sub`, and for the same reason: both are
-- read from request.jwt.claims, which PostgREST sets from the verified JWT and which no
-- client can write. It is in fact the more load-bearing of the two — PostgREST issues its
-- `set role` from it, so a token asserting service_role has already been handed a role
-- with BYPASSRLS before any of this code runs. Trusting it here concedes nothing that was
-- not already conceded one layer up.
--
-- The coalesce is not decoration. auth.role() returns NULL when request.jwt.claims is
-- unset, so an uncoalesced `auth.role() = 'service_role'` is NULL rather than false, and a
-- NULL reaching a plpgsql `if not <guard>` makes that guard admit precisely the callers it
-- was written to refuse — the same three-valued trap the private.* helpers in the RLS
-- migration were made total to close. This function returns true or false and never NULL.
create or replace function private.is_service_context()
returns boolean
language sql
stable
set search_path = ''
as $fn$
  select coalesce((select auth.role()) = 'service_role', false)
      or (select auth.uid()) is null;
$fn$;

revoke all on function private.is_service_context() from public, anon;
grant execute on function private.is_service_context() to authenticated, service_role;

-- ---------------------------------------------------------------------------
-- Enums
-- ---------------------------------------------------------------------------

do $$
begin
  if to_regtype('public.app_role') is null then
    create type public.app_role as enum ('owner', 'adjuster', 'assistant', 'customer', 'partner');
  end if;

  if to_regtype('public.claim_status') is null then
    create type public.claim_status as enum (
      'new_intake',
      'under_review',
      'lor_sent',
      'lor_signed',
      'documenting',
      'filed',
      'negotiating',
      'settlement_offered',
      'settled',
      'closed',
      'denied',
      'reopened',
      'rejected'
    );
  end if;

  if to_regtype('public.cause_of_loss') is null then
    create type public.cause_of_loss as enum (
      'wind', 'hail', 'wind_hail', 'hurricane', 'water', 'fire_smoke', 'flood', 'mold', 'other'
    );
  end if;

  if to_regtype('public.carrier_tenure') is null then
    create type public.carrier_tenure as enum ('lt_1_year', 'one_to_two_years', 'three_plus_years');
  end if;

  if to_regtype('public.prior_claim_outcome') is null then
    create type public.prior_claim_outcome as enum (
      'paid_nothing', 'paid_no_repairs', 'paid_repaired', 'unsure'
    );
  end if;

  if to_regtype('public.document_kind') is null then
    create type public.document_kind as enum (
      'declarations', 'photo', 'contract', 'lor_unsigned', 'lor_signed',
      'estimate', 'denial', 'correspondence', 'other'
    );
  end if;

  if to_regtype('public.document_visibility') is null then
    create type public.document_visibility as enum ('internal', 'customer');
  end if;

  if to_regtype('public.claim_event_type') is null then
    create type public.claim_event_type as enum ('status', 'note', 'question', 'reply', 'document', 'system');
  end if;

  if to_regtype('public.claim_event_visibility') is null then
    create type public.claim_event_visibility as enum ('internal', 'customer', 'partner', 'shared');
  end if;

  if to_regtype('public.lead_status') is null then
    create type public.lead_status as enum ('new', 'contacted', 'converted', 'dismissed');
  end if;

  if to_regtype('public.consent_kind') is null then
    create type public.consent_kind as enum ('sms', 'email');
  end if;

  if to_regtype('public.outbox_status') is null then
    create type public.outbox_status as enum ('pending', 'sent', 'failed', 'dead');
  end if;

  if to_regtype('public.partner_company_status') is null then
    create type public.partner_company_status as enum ('active', 'inactive');
  end if;
end
$$;

-- ---------------------------------------------------------------------------
-- Shared utility functions
-- ---------------------------------------------------------------------------

create or replace function public.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $fn$
begin
  new.updated_at := now();
  return new;
end;
$fn$;

-- ---------------------------------------------------------------------------
-- Tables
-- ---------------------------------------------------------------------------

create table if not exists public.partner_companies (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  status public.partner_company_status not null default 'active',
  contact_name text,
  contact_email text,
  contact_phone text,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint partner_companies_name_not_blank check (length(btrim(name)) > 0)
);

create table if not exists public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  role public.app_role not null default 'customer',
  first_name text,
  last_name text,
  phone text,
  -- `on delete restrict`, not `set null`. `set null` collided head-on with
  -- profiles_partner_requires_company below: deleting a company that still had reps made
  -- Postgres run its own `update profiles set partner_company_id = null`, the CHECK then
  -- refused that update, and the DELETE failed for *everyone* — owner and service role
  -- alike — with "new row for relation profiles violates check constraint", naming a table
  -- the caller never mentioned and a constraint that has nothing to do with what they
  -- asked for. §9 gives owners companies CRUD, so the operation is legitimate and only the
  -- error surface was wrong. restrict states the rule structurally; the BEFORE DELETE
  -- guard public.guard_partner_company_delete() turns it into a message that says what to
  -- do about it. Ending a partner relationship is `status = 'inactive'`, which already
  -- revokes every rep through private.current_partner_company_id() — deletion is for
  -- companies that should never have existed, and those have no reps to strand.
  partner_company_id uuid references public.partner_companies (id) on delete restrict,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint profiles_partner_requires_company
    check (role <> 'partner' or partner_company_id is not null)
);

create table if not exists public.leads (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  phone text not null,
  email text,
  message text,
  status public.lead_status not null default 'new',
  ip inet,
  user_agent text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint leads_name_not_blank check (length(btrim(name)) > 0)
);

-- Per-year counter backing the human claim reference CMG-YYYY-NNNN.
create table if not exists public.claim_ref_counters (
  year integer primary key,
  last_value integer not null default 0
);

create table if not exists public.claims (
  id uuid primary key default gen_random_uuid(),
  claim_ref text not null unique,
  status public.claim_status not null default 'new_intake',

  property_street text not null,
  property_street2 text,
  property_city text not null,
  property_state text not null default 'Florida',
  property_zip text not null,

  carrier text not null,
  policy_number text not null,
  carrier_tenure public.carrier_tenure not null,
  prior_roof_claim boolean not null default false,
  prior_outcome public.prior_claim_outcome,
  claim_number text,

  -- loss_date is bounded by public.guard_claim_dates(), not by a CHECK: a CHECK
  -- containing now() is not immutable, so it is re-evaluated by table rewrites and
  -- by dump/restore, and would retroactively invalidate rows that were legal when
  -- written. The trigger applies the same rule at write time only.
  loss_date date not null,
  loss_time time not null default '12:00:00',
  cause public.cause_of_loss not null,
  description text not null,

  assigned_adjuster_id uuid references public.profiles (id) on delete set null,
  partner_company_id uuid references public.partner_companies (id) on delete set null,
  requested_adjuster text,
  referrer_name text,
  referrer_email text,

  pandadoc_document_id text unique,
  esign_status text,

  lor_signed_at timestamptz,
  filed_at timestamptz,
  denied_at timestamptz,
  settled_at timestamptz,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint claims_prior_outcome_required check (not prior_roof_claim or prior_outcome is not null),
  -- claims_before_insert() only generates a reference when the caller leaves the column
  -- blank, so a caller who supplies one keeps it verbatim — and until now anything at all
  -- was accepted, including 'not-a-cmg-ref' from an owner session. claim_ref is the
  -- display identity of a claim in every email, portal header and partner summary (§4:
  -- "claim_ref is display-only"), so a malformed or spoofed one is a correspondence
  -- problem, not just an untidy row: two claims can be made to look like the same file, or
  -- like a file from another year. The shape is the same one public.next_claim_ref()
  -- produces, which is what makes generated and supplied references indistinguishable.
  constraint claims_claim_ref_shape check (claim_ref ~ '^CMG-\d{4}-\d{4}$')
);

-- Money lives apart from claims: RLS is row-level, not column-level, so the only
-- way to keep settlement figures away from assistants/customers/partners is a
-- separate relation with a narrower policy set (spec §4, §7).
create table if not exists public.claim_financials (
  claim_id uuid primary key references public.claims (id) on delete cascade,
  settlement_amount numeric(12, 2),
  fee_percent numeric(5, 2),
  notes text,
  updated_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint claim_financials_settlement_non_negative
    check (settlement_amount is null or settlement_amount >= 0),
  constraint claim_financials_fee_percent_range
    check (fee_percent is null or (fee_percent >= 0 and fee_percent <= 100))
);

create table if not exists public.claimants (
  id uuid primary key default gen_random_uuid(),
  claim_id uuid not null references public.claims (id) on delete cascade,
  first_name text not null,
  last_name text not null,
  email text not null,
  phone text,
  initials text not null,
  is_primary boolean not null default false,
  user_id uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint claimants_claim_id_email_key unique (claim_id, email),
  constraint claimants_email_shape check (position('@' in email) > 1)
);

create table if not exists public.claim_status_history (
  id uuid primary key default gen_random_uuid(),
  claim_id uuid not null references public.claims (id) on delete cascade,
  from_status public.claim_status,
  to_status public.claim_status not null,
  changed_by uuid references public.profiles (id) on delete set null,
  note text,
  created_at timestamptz not null default now()
);

create table if not exists public.claim_events (
  id uuid primary key default gen_random_uuid(),
  claim_id uuid not null references public.claims (id) on delete cascade,
  type public.claim_event_type not null,
  body text not null,
  author_id uuid references public.profiles (id) on delete set null,
  visibility public.claim_event_visibility not null default 'internal',
  created_at timestamptz not null default now(),
  constraint claim_events_body_not_blank check (length(btrim(body)) > 0)
);

create table if not exists public.documents (
  id uuid primary key default gen_random_uuid(),
  claim_id uuid not null references public.claims (id) on delete cascade,
  storage_path text not null unique,
  original_name text not null,
  kind public.document_kind not null default 'other',
  mime text not null,
  size_bytes bigint not null,
  uploaded_by uuid references public.profiles (id) on delete set null,
  visibility public.document_visibility not null default 'internal',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint documents_size_bytes_range check (size_bytes > 0 and size_bytes <= 26214400),
  -- The row and the object it names have to agree about which claim they belong to.
  -- Nothing else tied them: an adjuster could file a perfectly legal documents row on
  -- their own claim while pointing storage_path at another claim's prefix. No read
  -- follows storage_path today — private.can_read_claim_object() authorises by looking
  -- the path back up in this table, and §7.5 routes every download through a server-side
  -- authz check — so it is a latent hole rather than a live one. It is also exactly the
  -- kind that opens the day some future caller trusts the path instead of the row, and
  -- both of the paths §4 defines are already structured enough to state as a rule. The
  -- `intake/%` arm is the pre-accept prefix, which by definition has no claim yet; the
  -- re-parent on accept moves a row from that arm to the first one.
  --
  -- The intake arm cannot be tied to the claim, and that is a property of the flow rather
  -- than an omission here. The bytes land in the bucket during the §6 intake submission,
  -- before the service-role transaction that creates the claim runs, so the folder is
  -- named for an intake uuid minted while no claim id exists yet. Nothing on the row or in
  -- the schema relates the two: `claims` has no intake_uuid column, and a CHECK cannot
  -- consult another table even if it did. Tying them would mean carrying the intake uuid
  -- onto `claims` and matching against it — an app and schema change to close a hole that
  -- is latent in the first place, since no read follows storage_path
  -- (private.can_read_claim_object() looks the path back up in this table, and §7.5 routes
  -- every download through a server-side authz check).
  --
  -- What the arm CAN state is the shape §4 gives it, and it now does: exactly
  -- `intake/{uuid}/{one path segment}`. That does not bind the object to a claim, but it
  -- does close the arm to everything that is not a real intake path — free-form prefixes,
  -- extra nesting, and `intake/`-prefixed strings aimed at some other part of the bucket
  -- were all accepted by the bare `like 'intake/%'`, and none of them can be produced by
  -- the flow the arm exists for.
  constraint documents_storage_path_matches_claim check (
    storage_path like 'claims/' || claim_id::text || '/%'
    or storage_path ~ '^intake/[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}/[^/]+$'
  ),
  constraint documents_mime_allowlist check (
    mime in (
      'application/pdf',
      'image/jpeg',
      'image/png',
      'image/webp',
      'image/heic',
      'image/heif',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
    )
  )
);

-- Consent is TCPA/CAN-SPAM evidence and must outlive the row that occasioned it.
-- Both parents are `on delete set null`, so purging a lead or a claim detaches the
-- consent record instead of destroying it; the email/phone captured on the row keep
-- it identifying. A consent must still name a subject when it is created — that is
-- enforced at write time by public.guard_consent_subject(), not by a table CHECK,
-- because a CHECK would also forbid the detachment the FKs are there to perform.
create table if not exists public.consents (
  id uuid primary key default gen_random_uuid(),
  claim_id uuid references public.claims (id) on delete set null,
  lead_id uuid references public.leads (id) on delete set null,
  email text not null,
  phone text,
  kind public.consent_kind not null,
  consent_text text not null,
  granted_at timestamptz not null default now(),
  withdrawn_at timestamptz,
  ip inet,
  created_at timestamptz not null default now()
);

create table if not exists public.invites (
  id uuid primary key default gen_random_uuid(),
  email text not null,
  role public.app_role not null,
  claim_id uuid references public.claims (id) on delete cascade,
  partner_company_id uuid references public.partner_companies (id) on delete cascade,
  token_hash text not null unique,
  expires_at timestamptz not null default (now() + interval '72 hours'),
  accepted_at timestamptz,
  accepted_by uuid references auth.users (id) on delete set null,
  -- Every invite names the staff member who issued it (spec §4). `on delete cascade`
  -- rather than `set null` because the column is required: removing a staff member
  -- withdraws the invitations they had outstanding, which is the behaviour offboarding
  -- wants anyway.
  --
  -- DELIBERATE DEVIATION, reviewed and kept: cascade does destroy the record that an
  -- invitation was issued, which is the sort of thing an audit trail exists to keep. It
  -- is acceptable here because the trail does keep it — invite issuance and acceptance
  -- are written to public.audit_log by the application (spec §7.7), and audit_log holds
  -- no foreign keys precisely so that deleting an actor cannot rewrite history. What
  -- cascades away is the live, actionable invite; what survives is the record that it
  -- happened. The alternative, `set null`, would leave an unattributed pending token
  -- outstanding against a staff member who no longer exists, which is worse on both
  -- counts. Deleting staff is in any case rare: offboarding sets is_active = false.
  invited_by uuid not null references public.profiles (id) on delete cascade,
  created_at timestamptz not null default now(),
  constraint invites_role_allowed check (role in ('adjuster', 'assistant', 'customer', 'partner')),
  constraint invites_partner_requires_company check (role <> 'partner' or partner_company_id is not null),
  constraint invites_customer_requires_claim check (role <> 'customer' or claim_id is not null)
);

-- Append-only. No UPDATE/DELETE policy is ever created on this table, and no
-- foreign keys point out of it so that actor deletion cannot rewrite history.
create table if not exists public.audit_log (
  id bigint generated always as identity primary key,
  actor_id uuid,
  action text not null,
  entity text not null,
  entity_id uuid,
  meta jsonb not null default '{}'::jsonb,
  ip inet,
  created_at timestamptz not null default now()
);

create table if not exists public.notifications_outbox (
  id uuid primary key default gen_random_uuid(),
  recipient_email text not null,
  template text not null,
  payload jsonb not null default '{}'::jsonb,
  status public.outbox_status not null default 'pending',
  attempts integer not null default 0,
  last_error text,
  next_attempt_at timestamptz not null default now(),
  sent_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint notifications_outbox_attempts_non_negative check (attempts >= 0)
);

-- Deliberate whitelist projection for the partner portal. Partners hold a policy
-- on this table and on nothing else, so a policy defect on public.claims cannot
-- leak carrier/policy/contact columns to them (spec §4, §7).
create table if not exists public.claim_partner_summaries (
  claim_id uuid primary key references public.claims (id) on delete cascade,
  partner_company_id uuid not null references public.partner_companies (id) on delete cascade,
  claim_ref text not null,
  homeowner_name text,
  property_street text,
  property_city text,
  status public.claim_status not null,
  lor_signed_at timestamptz,
  filed_at timestamptz,
  settled_at timestamptz,
  settlement_amount numeric(12, 2),
  updated_at timestamptz not null default now()
);

create table if not exists public.rate_limits (
  key text not null,
  window_start timestamptz not null,
  count integer not null default 0,
  updated_at timestamptz not null default now(),
  primary key (key, window_start)
);

create table if not exists public.pandadoc_webhook_events (
  event_id uuid primary key,
  received_at timestamptz not null default now(),
  payload_summary jsonb not null default '{}'::jsonb
);

-- Deleting a documents row would otherwise strand its bytes in the bucket forever.
-- The trigger below records the path here; `api/cron/outbox`'s sibling sweeper drains
-- it through the Storage API. Deliberately NOT a trigger that deletes from
-- storage.objects directly: that table is only the metadata side of the bucket, so
-- removing the row leaves the object's bytes in the storage backend with nothing left
-- pointing at them — an orphan that is now invisible to the API that could have swept
-- it. Recording the intent and letting the server-side sweeper issue a real
-- `storage.remove()` is the only path that actually frees the bytes.
-- No foreign keys: the rows this refers to are gone by the time it is written.
create table if not exists public.storage_cleanup_queue (
  id bigint generated always as identity primary key,
  bucket_id text not null,
  object_path text not null,
  document_id uuid,
  claim_id uuid,
  enqueued_at timestamptz not null default now(),
  processed_at timestamptz,
  attempts integer not null default 0,
  last_error text,
  constraint storage_cleanup_queue_attempts_non_negative check (attempts >= 0)
);

-- ---------------------------------------------------------------------------
-- claim_ref: CMG-YYYY-NNNN from a per-year counter
-- ---------------------------------------------------------------------------

-- Two known, deliberately unfixed properties of this function, both reviewed and kept
-- because the cure costs more than the disease at CMG's volume:
--
--   * lpad() pads, it does not truncate, so the 10,000th claim of a year produces
--     'CMG-2026-10000' — five digits — which claims_claim_ref_shape then refuses, and the
--     intake fails rather than silently colliding. CMG files on the order of hundreds of
--     claims a year; 9,999 is roughly two orders of magnitude of headroom. Widening the
--     format is a display change that reaches every email template, portal header and
--     partner summary, and the failure mode if the day ever comes is a loud refusal at
--     insert time, not a duplicate reference. Uniqueness beats throughput here, and it
--     beats elegance too.
--
--   * the `on conflict do update` takes a row lock on the year's counter and holds it to
--     the end of the calling transaction, so concurrent intakes serialise on this one row.
--     That is exactly what makes the sequence gapless and collision-free, which a real
--     Postgres sequence would not be. The window is a single UPDATE inside a transaction
--     that is already writing a claim, its claimants and its consents; at a few claims a
--     day the contention is unobservable. A gapless human reference is worth more to a
--     public-adjusting file than concurrency CMG will never generate.
create or replace function public.next_claim_ref()
returns text
language plpgsql
security definer
set search_path = ''
as $fn$
declare
  v_year integer := extract(year from (now() at time zone 'America/New_York'))::integer;
  v_seq integer;
begin
  insert into public.claim_ref_counters as c (year, last_value)
  values (v_year, 1)
  on conflict (year) do update set last_value = c.last_value + 1
  returning c.last_value into v_seq;

  return 'CMG-' || v_year::text || '-' || lpad(v_seq::text, 4, '0');
end;
$fn$;

-- SECURITY DEFINER: public.next_claim_ref() is deliberately unreachable as an RPC
-- (EXECUTE revoked from authenticated below), so a SECURITY INVOKER trigger would
-- abort every authenticated insert with "permission denied for function
-- next_claim_ref". Running the trigger as its owner is what lets a claim be created
-- through a user session while the counter stays uncallable from one.
create or replace function public.claims_before_insert()
returns trigger
language plpgsql
security definer
set search_path = ''
as $fn$
begin
  if new.claim_ref is null or length(btrim(new.claim_ref)) = 0 then
    new.claim_ref := public.next_claim_ref();
  end if;

  -- A claim may not be born mid-lifecycle. The transition trigger only fires on
  -- UPDATE, so without this an INSERT could seat a claim directly at `settled` or
  -- `closed` and skip every gate the machine exists to impose (including the signed
  -- LOR requirement). Service-role and migration contexts keep the ability to import
  -- historical records at their true stage, exactly as public.guard_profile_privileges()
  -- treats them — see private.is_service_context() for why that is asked as a question
  -- about the role claim and not about the presence of a subject.
  if not private.is_service_context() and new.status is distinct from 'new_intake' then
    raise exception 'a claim created from a user session must start at new_intake, not %', new.status
      using errcode = '23514';
  end if;

  perform public.assert_claim_loss_date(new.loss_date);

  if new.status = 'lor_signed' then new.lor_signed_at := coalesce(new.lor_signed_at, now()); end if;
  if new.status = 'filed' then new.filed_at := coalesce(new.filed_at, now()); end if;
  if new.status = 'denied' then new.denied_at := coalesce(new.denied_at, now()); end if;
  if new.status = 'settled' then new.settled_at := coalesce(new.settled_at, now()); end if;

  return new;
end;
$fn$;

-- The former claims_loss_date_not_future CHECK, relocated. Same rule, same SQLSTATE,
-- but evaluated only when a row is written rather than on every rewrite of the table.
create or replace function public.assert_claim_loss_date(p_loss_date date)
returns void
language plpgsql
stable
set search_path = ''
as $fn$
begin
  if p_loss_date is not null and p_loss_date > (now() at time zone 'utc')::date + 1 then
    raise exception 'loss_date % is in the future', p_loss_date using errcode = '23514';
  end if;
end;
$fn$;

-- Re-pointing a claim at another referring company rewrites public.claim_partner_summaries
-- for that claim, which hands the homeowner's name, address, status and settlement to a
-- company with no relationship to them. Assignment of work is an adjuster's to make;
-- disclosure to a third party is not.
create or replace function public.guard_claim_update()
returns trigger
language plpgsql
security definer
set search_path = ''
as $fn$
declare
  v_uid uuid := (select auth.uid());
  v_service boolean := private.is_service_context();
  v_actor_role public.app_role;
begin
  if new.loss_date is distinct from old.loss_date then
    perform public.assert_claim_loss_date(new.loss_date);
  end if;

  -- claims_claim_ref_shape pins the format; nothing pinned the identity. The two are not
  -- the same guarantee: 'CMG-2026-0002' is a perfectly well-formed reference, and writing
  -- it onto claim 1 makes two files answer to one name — or, one statement later, swaps
  -- the names of two claims outright. claim_ref is what §7.3 calls display-only, which is
  -- exactly why it must not move: it is the string on every email, portal header and
  -- partner summary, so it is the handle by which a homeowner, a carrier and a referring
  -- contractor each identify the file. An owner or assigned adjuster reaches this column
  -- through claims_update_manage like any other, and the reference is generated once at
  -- insert and never legitimately edited afterwards.
  --
  -- The service role is exempt, as it is from public.guard_consent_immutable(), for the
  -- same reason: it is CMG's own server, it already holds BYPASSRLS and `grant all` on
  -- every table in this schema including audit_log, and pretending to constrain it here
  -- would be theatre that costs a real data-correction path. The actors this guard is
  -- about are the ones holding a user session.
  if new.claim_ref is distinct from old.claim_ref and not v_service then
    raise exception 'claim_ref is the display identity of a claim and cannot be changed once assigned'
      using errcode = '42501';
  end if;

  if new.partner_company_id is distinct from old.partner_company_id and not v_service then
    select p.role into v_actor_role
      from public.profiles p
     where p.id = v_uid and p.is_active;

    if v_actor_role is distinct from 'owner' then
      raise exception 'only an owner may change which partner company a claim is attributed to'
        using errcode = '42501';
    end if;
  end if;

  return new;
end;
$fn$;

drop trigger if exists claims_guard_update on public.claims;
create trigger claims_guard_update
  before update on public.claims
  for each row execute function public.guard_claim_update();

drop trigger if exists claims_before_insert on public.claims;
create trigger claims_before_insert
  before insert on public.claims
  for each row execute function public.claims_before_insert();

-- ---------------------------------------------------------------------------
-- Claim status machine (second enforcement layer; lib/status-machine.ts is the first)
-- ---------------------------------------------------------------------------

create or replace function public.allowed_claim_transitions(p_from public.claim_status)
returns public.claim_status[]
language sql
immutable
set search_path = ''
as $fn$
  select case p_from
    when 'new_intake'         then array['under_review', 'rejected']
    when 'under_review'       then array['lor_sent', 'rejected']
    when 'lor_sent'           then array['lor_signed', 'rejected']
    when 'lor_signed'         then array['documenting']
    when 'documenting'        then array['filed']
    when 'filed'              then array['negotiating', 'denied']
    when 'negotiating'        then array['settlement_offered', 'denied']
    when 'settlement_offered' then array['settled', 'denied']
    when 'settled'            then array['closed']
    when 'denied'             then array['reopened']
    when 'reopened'           then array['negotiating']
    when 'closed'             then array[]::text[]
    when 'rejected'           then array[]::text[]
  end::public.claim_status[];
$fn$;

create or replace function public.enforce_claim_status_transition()
returns trigger
language plpgsql
security definer
set search_path = ''
as $fn$
declare
  v_allowed public.claim_status[];
begin
  v_allowed := public.allowed_claim_transitions(old.status);

  if v_allowed is null or array_length(v_allowed, 1) is null or not (new.status = any (v_allowed)) then
    raise exception 'illegal claim status transition: % -> % (claim %)', old.status, new.status, old.claim_ref
      using errcode = '23514';
  end if;

  -- Gate: representation is only "signed" once a signed LOR document exists (spec §5).
  if new.status = 'lor_signed'
     and not exists (
       select 1 from public.documents d
       where d.claim_id = old.id and d.kind = 'lor_signed'
     ) then
    raise exception 'claim % cannot advance to lor_signed without a document of kind lor_signed', old.claim_ref
      using errcode = '23514';
  end if;

  if new.status = 'lor_signed' then new.lor_signed_at := coalesce(new.lor_signed_at, now()); end if;
  if new.status = 'filed' then new.filed_at := coalesce(new.filed_at, now()); end if;
  if new.status = 'denied' then new.denied_at := coalesce(new.denied_at, now()); end if;
  if new.status = 'settled' then new.settled_at := coalesce(new.settled_at, now()); end if;

  return new;
end;
$fn$;

drop trigger if exists claims_enforce_status_transition on public.claims;
create trigger claims_enforce_status_transition
  before update of status on public.claims
  for each row
  when (old.status is distinct from new.status)
  execute function public.enforce_claim_status_transition();

-- ---------------------------------------------------------------------------
-- Rate limiting (SECURITY DEFINER, fixed windows)
-- ---------------------------------------------------------------------------

create or replace function public.check_rate_limit(p_key text, p_max integer, p_window interval)
returns boolean
language plpgsql
security definer
set search_path = ''
as $fn$
declare
  v_window_seconds double precision;
  v_window_start timestamptz;
  v_count integer;
begin
  if p_key is null or length(btrim(p_key)) = 0 then
    raise exception 'check_rate_limit requires a non-empty key' using errcode = '22023';
  end if;
  if p_max is null or p_max < 1 then
    raise exception 'check_rate_limit requires p_max >= 1' using errcode = '22023';
  end if;

  v_window_seconds := greatest(extract(epoch from coalesce(p_window, interval '1 minute')), 1);
  v_window_start := to_timestamp(floor(extract(epoch from now()) / v_window_seconds) * v_window_seconds);

  insert into public.rate_limits as r (key, window_start, count, updated_at)
  values (p_key, v_window_start, 1, now())
  on conflict (key, window_start)
    do update set count = r.count + 1, updated_at = now()
  returning r.count into v_count;

  -- Opportunistic pruning; cheap enough amortised across calls. Scoped to p_key,
  -- because the retention interval is derived from *this* caller's window: an
  -- unscoped delete lets a one-minute limiter evict the rows of a 24-hour limiter
  -- and hand an exhausted budget straight back to whoever spent it.
  if random() < 0.01 then
    delete from public.rate_limits
     where key = p_key
       and window_start < now() - (v_window_seconds * 10 || ' seconds')::interval;
  end if;

  return v_count <= p_max;
end;
$fn$;

-- ---------------------------------------------------------------------------
-- Audit trail (append-only), triggered on claims / documents / claim_status_history
-- ---------------------------------------------------------------------------

create or replace function public.audit_row_change()
returns trigger
language plpgsql
security definer
set search_path = ''
as $fn$
declare
  v_row jsonb;
  v_changed jsonb;
  v_meta jsonb;
  v_entity_id uuid;
begin
  if tg_op = 'DELETE' then
    v_row := to_jsonb(old);
  else
    v_row := to_jsonb(new);
  end if;

  -- Falls back to claim_id for the one audited relation that has no `id`:
  -- public.claim_financials is keyed on claim_id, so without this its entries landed in
  -- the trail with entity_id null and dropped straight out of audit_log_entity_idx —
  -- present in the log, invisible to the owner's audit viewer filtered by entity id. Every
  -- other audited table has a non-null id, so coalesce never reaches the second arm for
  -- them and their entries are unchanged.
  v_entity_id := coalesce(nullif(v_row ->> 'id', ''), nullif(v_row ->> 'claim_id', ''))::uuid;
  v_meta := jsonb_build_object('op', tg_op);

  if tg_op = 'UPDATE' then
    select coalesce(
             jsonb_object_agg(o.key, jsonb_build_object('old', o.value, 'new', n.value)),
             '{}'::jsonb
           )
      into v_changed
      from jsonb_each(to_jsonb(old)) o
      join jsonb_each(to_jsonb(new)) n on n.key = o.key
     where o.value is distinct from n.value;

    if v_changed = '{}'::jsonb then
      return null;
    end if;

    v_meta := v_meta || jsonb_build_object('changed', v_changed);
  else
    v_meta := v_meta || jsonb_build_object('row', v_row);
  end if;

  if v_row ? 'claim_id' then
    v_meta := v_meta || jsonb_build_object('claim_id', v_row ->> 'claim_id');
  end if;

  insert into public.audit_log (actor_id, action, entity, entity_id, meta)
  values (
    (select auth.uid()),
    tg_table_name || '.' || lower(tg_op),
    tg_table_name,
    v_entity_id,
    v_meta
  );

  return null;
end;
$fn$;

drop trigger if exists audit_claims on public.claims;
create trigger audit_claims
  after insert or update or delete on public.claims
  for each row execute function public.audit_row_change();

drop trigger if exists audit_documents on public.documents;
create trigger audit_documents
  after insert or update or delete on public.documents
  for each row execute function public.audit_row_change();

drop trigger if exists audit_claim_status_history on public.claim_status_history;
create trigger audit_claim_status_history
  after insert or update or delete on public.claim_status_history
  for each row execute function public.audit_row_change();

-- Consent is the evidence CMG would produce in a TCPA/CAN-SPAM dispute. Every change
-- to it — including a withdrawal — belongs in the append-only trail.
drop trigger if exists audit_consents on public.consents;
create trigger audit_consents
  after insert or update or delete on public.consents
  for each row execute function public.audit_row_change();

-- settlement_amount and fee_percent are the highest-value fields in this schema — the
-- number CMG pays out on and the number CMG is paid — and until now they were the only
-- ones with no record of who moved them. They appeared neither in this trigger set nor in
-- §7.7's list of app-level audit writes, so an owner or an assigned adjuster could change
-- a settlement figure and leave nothing behind: claim_financials is a separate relation
-- precisely so money is not visible through public.claims, which also means the claims
-- audit trigger never sees it. The projection trigger fires on the same events and
-- rewrites what a partner reads, so the change is not even silent downstream — only
-- unattributed. §4 puts this table in the owner/assigned-adjuster row, which is a small
-- and trusted audience; a small audience is an argument for a short suspect list, not for
-- keeping no list at all.
drop trigger if exists audit_claim_financials on public.claim_financials;
create trigger audit_claim_financials
  after insert or update or delete on public.claim_financials
  for each row execute function public.audit_row_change();

-- claimants carries an access-control edge, not just contact details: `user_id` is the
-- link private.is_claim_customer() reads to decide who may see a claim, its documents and
-- its feed, and `email` is the address the §6 invite is sent to — so writing either one
-- decides who gets into the portal for a file. That is the same class of fact as a status
-- change or a document appearing, and it was equally untracked. Added for the reason
-- claim_financials is: the trail should answer "who attached this person to this claim".
--
-- public.consents already had a trigger (immediately above) and needs no second one; that
-- gap was closed in an earlier round for the same evidentiary reason.
drop trigger if exists audit_claimants on public.claimants;
create trigger audit_claimants
  after insert or update or delete on public.claimants
  for each row execute function public.audit_row_change();

-- ---------------------------------------------------------------------------
-- Consent snapshots are evidence: append, withdraw, never rewrite
-- ---------------------------------------------------------------------------

create or replace function public.guard_consent_subject()
returns trigger
language plpgsql
set search_path = ''
as $fn$
begin
  if new.claim_id is null and new.lead_id is null then
    raise exception 'a consent record must name the claim or the lead it was collected for'
      using errcode = '23514';
  end if;
  return new;
end;
$fn$;

drop trigger if exists consents_guard_subject on public.consents;
create trigger consents_guard_subject
  before insert on public.consents
  for each row execute function public.guard_consent_subject();

-- The consents UPDATE policy has to grant the row to the homeowner so they can
-- withdraw. RLS is row-level, so the policy cannot stop them rewriting the snapshot
-- while they are there — which would destroy the only proof that consent was ever
-- given, in the one place the audit trail did not cover. withdrawn_at is the only
-- field any JWT-bearing actor may move, staff included; the service role retains the
-- ability to correct records out-of-band.
--
-- Pinned columns are refused rather than silently reset to their old values: a caller
-- who believes they rewrote a consent snapshot and did not should be told so, and a
-- refusal leaves a much clearer trace than a write that quietly did nothing.
--
-- claim_id and lead_id are pinned in one direction only: they may go to NULL, they may
-- never be re-pointed at another subject. Postgres performs the `on delete set null`
-- detachment these FKs exist for as an internal `UPDATE consents SET claim_id = NULL`,
-- which runs this trigger. Pinning that direction too made the guard veto the FK action
-- itself, so `claims_delete_owner` and `leads_delete_owner` were dead for every
-- JWT-bearing actor while still succeeding as the service role — an owner could not
-- delete any intake-born claim, because every one of them carries consents.
-- Detaching loses the link, not the evidence: email, phone, kind, consent_text,
-- granted_at and ip stay immutable and still identify whose consent it was, and every
-- detachment is written to audit_log by the consents audit trigger.
--
-- The detach is further conditioned on the subject actually being gone. Permitting it
-- unconditionally was wider than the foreign key needed: it also let an owner cut a LIVE
-- claim loose from its consent in one statement — and a customer or an assigned adjuster
-- null the lead_id on a consent carrying both — leaving the claim standing with nothing
-- on it to show consent was ever collected, which is the precise evidentiary link a TCPA
-- dispute turns on. `not exists` is what distinguishes the two: the FK's own action runs
-- after the parent row is deleted, in a later command, so by the time this trigger looks
-- the row is genuinely absent and the detachment passes; a hand-written UPDATE against a
-- claim or lead that still exists finds it and is refused. The lookup is unfiltered by
-- RLS because this function is SECURITY DEFINER, which is what the test requires: whether
-- the subject exists must not depend on whether this caller can see it.
create or replace function public.guard_consent_immutable()
returns trigger
language plpgsql
security definer
set search_path = ''
as $fn$
declare
  v_column text;
begin
  -- The "service role retains the ability to correct records out-of-band" exemption
  -- promised in the comment above. It asks private.is_service_context() rather than
  -- `auth.uid() is null` so that it actually holds for a service-role JWT, which carries
  -- a subject and was therefore being judged as a user session — see that function.
  if private.is_service_context() then
    return new;
  end if;

  v_column := case
    when new.id           is distinct from old.id           then 'id'
    when new.claim_id is distinct from old.claim_id
         and (new.claim_id is not null
              or exists (select 1 from public.claims c where c.id = old.claim_id)) then 'claim_id'
    when new.lead_id is distinct from old.lead_id
         and (new.lead_id is not null
              or exists (select 1 from public.leads l where l.id = old.lead_id)) then 'lead_id'
    when new.email        is distinct from old.email        then 'email'
    when new.phone        is distinct from old.phone        then 'phone'
    when new.kind         is distinct from old.kind         then 'kind'
    when new.consent_text is distinct from old.consent_text then 'consent_text'
    when new.granted_at   is distinct from old.granted_at   then 'granted_at'
    when new.ip           is distinct from old.ip           then 'ip'
    when new.created_at   is distinct from old.created_at   then 'created_at'
  end;

  if v_column is not null then
    raise exception 'consent records are evidence: % cannot be changed; only withdrawn_at may be set, and claim_id/lead_id may only be detached to null', v_column
      using errcode = '42501';
  end if;

  return new;
end;
$fn$;

drop trigger if exists consents_guard_immutable on public.consents;
create trigger consents_guard_immutable
  before update on public.consents
  for each row execute function public.guard_consent_immutable();

-- ---------------------------------------------------------------------------
-- Documents stay attached to the claim they were filed against
-- ---------------------------------------------------------------------------

-- Without this, an UPDATE that passes the documents policy on the row's *current*
-- claim can move that row onto any other claim — which is how a signed LOR gets
-- planted on a file that never had one, satisfying the lor_signed gate.
create or replace function public.guard_document_claim_immutable()
returns trigger
language plpgsql
set search_path = ''
as $fn$
begin
  if new.claim_id is distinct from old.claim_id then
    raise exception 'a document cannot be moved between claims; delete it and upload it against the correct claim'
      using errcode = '42501';
  end if;

  -- storage_path is pinned for every JWT-bearing caller, and pinned for the service role
  -- too except for the one move §4 and §6 require: an intake upload landing at
  -- `intake/{intake_uuid}/…` before the claim is accepted, then re-parented to
  -- `claims/{claim_id}/…` on accept. Refusing that unconditionally left the flow with no
  -- legal implementation at all — not even for the service role that owns it. The only
  -- alternative was delete + re-insert, which fires tg_enqueue_storage_cleanup and queues
  -- the OLD intake path for deletion in a race with the bucket move, loses the
  -- documents.id every claim_events/audit reference is keyed on, and records a delete
  -- followed by a create where the trail should show one re-parent.
  --
  -- The escape is as narrow as the flow: service context only, only out of `intake/`, and
  -- only into this row's own claim prefix — old.claim_id, which the branch above has
  -- already pinned, so the destination cannot name another claim. Arbitrary re-pointing
  -- therefore stays shut for everyone, and so does the hole this guard exists for: a
  -- signed LOR cannot be moved onto a claim that never had one.
  --
  -- The service-context test is private.is_service_context(), not `auth.uid() is null`.
  -- The latter recognised a bare service-role connection and nothing else, so the moment
  -- the accept flow ran under a service-role JWT — which carries a `sub` like any signed
  -- token — this escape closed and the §6 re-parent had no legal implementation again, in
  -- production only, for a reason invisible to a test suite that connects without a JWT.
  -- That test is total (never NULL), so the `not (...)` below stays two-valued and this
  -- guard cannot fall through the way a three-valued predicate would.
  if new.storage_path is distinct from old.storage_path
     and not (
       private.is_service_context()
       and old.storage_path like 'intake/%'
       and new.storage_path like 'claims/' || old.claim_id::text || '/%'
     ) then
    raise exception 'a document cannot be repointed at a different stored object'
      using errcode = '42501';
  end if;

  return new;
end;
$fn$;

drop trigger if exists documents_guard_claim_immutable on public.documents;
create trigger documents_guard_claim_immutable
  before update on public.documents
  for each row execute function public.guard_document_claim_immutable();

create or replace function public.tg_enqueue_storage_cleanup()
returns trigger
language plpgsql
security definer
set search_path = ''
as $fn$
begin
  insert into public.storage_cleanup_queue (bucket_id, object_path, document_id, claim_id)
  values ('claim-docs', old.storage_path, old.id, old.claim_id);
  return null;
end;
$fn$;

drop trigger if exists documents_enqueue_storage_cleanup on public.documents;
create trigger documents_enqueue_storage_cleanup
  after delete on public.documents
  for each row execute function public.tg_enqueue_storage_cleanup();

-- ---------------------------------------------------------------------------
-- Partner projection maintenance
-- ---------------------------------------------------------------------------

create or replace function public.refresh_claim_partner_summary(p_claim_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $fn$
declare
  v_claim public.claims%rowtype;
  v_homeowner text;
  v_settlement numeric(12, 2);
begin
  if p_claim_id is null then
    return;
  end if;

  select * into v_claim from public.claims where id = p_claim_id;

  if not found or v_claim.partner_company_id is null then
    delete from public.claim_partner_summaries where claim_id = p_claim_id;
    return;
  end if;

  select btrim(coalesce(c.first_name, '') || ' ' || coalesce(c.last_name, ''))
    into v_homeowner
    from public.claimants c
   where c.claim_id = p_claim_id
   order by c.is_primary desc, c.created_at asc
   limit 1;

  -- Settlement figures reach partners only after the claim is settled or closed.
  if v_claim.status in ('settled', 'closed') then
    select f.settlement_amount into v_settlement
      from public.claim_financials f
     where f.claim_id = p_claim_id;
  else
    v_settlement := null;
  end if;

  insert into public.claim_partner_summaries as s (
    claim_id, partner_company_id, claim_ref, homeowner_name,
    property_street, property_city, status,
    lor_signed_at, filed_at, settled_at, settlement_amount, updated_at
  )
  values (
    v_claim.id, v_claim.partner_company_id, v_claim.claim_ref, nullif(v_homeowner, ''),
    v_claim.property_street, v_claim.property_city, v_claim.status,
    v_claim.lor_signed_at, v_claim.filed_at, v_claim.settled_at, v_settlement, now()
  )
  on conflict (claim_id) do update set
    partner_company_id = excluded.partner_company_id,
    claim_ref          = excluded.claim_ref,
    homeowner_name     = excluded.homeowner_name,
    property_street    = excluded.property_street,
    property_city      = excluded.property_city,
    status             = excluded.status,
    lor_signed_at      = excluded.lor_signed_at,
    filed_at           = excluded.filed_at,
    settled_at         = excluded.settled_at,
    settlement_amount  = excluded.settlement_amount,
    updated_at         = now();
end;
$fn$;

create or replace function public.tg_refresh_partner_summary()
returns trigger
language plpgsql
security definer
set search_path = ''
as $fn$
declare
  v_row jsonb;
  v_claim_id uuid;
begin
  if tg_op = 'DELETE' then
    v_row := to_jsonb(old);
  else
    v_row := to_jsonb(new);
  end if;

  if tg_table_name = 'claims' then
    v_claim_id := nullif(v_row ->> 'id', '')::uuid;
  else
    v_claim_id := nullif(v_row ->> 'claim_id', '')::uuid;
  end if;

  perform public.refresh_claim_partner_summary(v_claim_id);

  if tg_op = 'UPDATE' and tg_table_name <> 'claims' then
    perform public.refresh_claim_partner_summary(nullif(to_jsonb(old) ->> 'claim_id', '')::uuid);
  end if;

  return null;
end;
$fn$;

drop trigger if exists claims_refresh_partner_summary on public.claims;
create trigger claims_refresh_partner_summary
  after insert or update on public.claims
  for each row execute function public.tg_refresh_partner_summary();

drop trigger if exists claim_financials_refresh_partner_summary on public.claim_financials;
create trigger claim_financials_refresh_partner_summary
  after insert or update or delete on public.claim_financials
  for each row execute function public.tg_refresh_partner_summary();

-- Not named in spec §4 but required for correctness: homeowner_name is sourced
-- from claimants, which are written after the claim row in the intake transaction.
drop trigger if exists claimants_refresh_partner_summary on public.claimants;
create trigger claimants_refresh_partner_summary
  after insert or update or delete on public.claimants
  for each row execute function public.tg_refresh_partner_summary();

-- ---------------------------------------------------------------------------
-- Profile provisioning and role protection
-- ---------------------------------------------------------------------------

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $fn$
begin
  -- Role is never read from user-supplied metadata; it is assigned by the
  -- invite flow / service role afterwards (spec §4, §7).
  insert into public.profiles (id, first_name, last_name, phone)
  values (
    new.id,
    nullif(btrim(coalesce(new.raw_user_meta_data ->> 'first_name', '')), ''),
    nullif(btrim(coalesce(new.raw_user_meta_data ->> 'last_name', '')), ''),
    nullif(btrim(coalesce(new.raw_user_meta_data ->> 'phone', '')), '')
  )
  on conflict (id) do nothing;

  return new;
end;
$fn$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

create or replace function public.guard_profile_privileges()
returns trigger
language plpgsql
security definer
set search_path = ''
as $fn$
declare
  v_uid uuid := (select auth.uid());
  v_actor_role public.app_role;
begin
  if new.role is not distinct from old.role
     and new.partner_company_id is not distinct from old.partner_company_id
     and new.is_active is not distinct from old.is_active then
    return new;
  end if;

  -- Service role / migration / seed context. This is the invite flow's own path — §4 says
  -- role "is written only by service-role/invite flow" — so asking `auth.uid() is null`
  -- here meant that the instant that flow ran under a service-role JWT it could no longer
  -- assign the role it exists to assign. See private.is_service_context().
  if private.is_service_context() then
    return new;
  end if;

  -- `and p.is_active`, as in public.guard_claim_update() and every private.* identity
  -- helper. Without it the actor's own deactivation was invisible to the check that is
  -- supposed to enforce it: profiles_update_self lets a user through RLS onto their own
  -- row, and this lookup then read the role off the very row whose is_active = false it
  -- had just ignored. A deactivated owner could re-enable themselves in one statement —
  -- precisely the highest-privilege account, in precisely the offboarding or
  -- account-compromise scenario deactivation exists for. A deactivated actor now finds
  -- no row, v_actor_role is null, and null is distinct from 'owner', so they fall
  -- through to the refusal.
  select p.role into v_actor_role
    from public.profiles p
   where p.id = v_uid and p.is_active;

  if v_actor_role is distinct from 'owner' then
    raise exception 'role, partner assignment and activation may only be changed by an active owner or the service role'
      using errcode = '42501';
  end if;

  return new;
end;
$fn$;

drop trigger if exists profiles_guard_privileges on public.profiles;
create trigger profiles_guard_privileges
  before update on public.profiles
  for each row execute function public.guard_profile_privileges();

create or replace function public.normalize_claimant_email()
returns trigger
language plpgsql
set search_path = ''
as $fn$
begin
  new.email := lower(btrim(new.email));
  return new;
end;
$fn$;

drop trigger if exists claimants_normalize_email on public.claimants;
create trigger claimants_normalize_email
  before insert or update on public.claimants
  for each row execute function public.normalize_claimant_email();

-- ---------------------------------------------------------------------------
-- Deleting a partner company says what is in the way
-- ---------------------------------------------------------------------------

-- §9 gives owners CRUD over companies, and DELETE was the one letter of it that did not
-- work whenever the company had reps. profiles.partner_company_id is now `on delete
-- restrict` (see the column), which stops the corrupt state structurally but reports it as
-- a foreign-key violation naming a constraint the caller never heard of. This runs first,
-- as a BEFORE DELETE row trigger, so the message the owner actually gets names the company,
-- counts what is blocking the delete, and says what to do instead — which for an ended
-- relationship is `status = 'inactive'`, already enough to revoke every rep through
-- private.current_partner_company_id().
--
-- This cannot block a flow that works today: before restrict, this same delete failed for
-- every caller including the service role, on the profiles_partner_requires_company CHECK.
-- A company with no reps deletes exactly as it always did.
--
-- SECURITY DEFINER so the count is the true one. A caller who cannot see a rep's profiles
-- row must still be told it is there — otherwise the guard's answer depends on the
-- caller's visibility and the delete would proceed straight into the FK's refusal, which
-- is the confusing error this exists to replace.
create or replace function public.guard_partner_company_delete()
returns trigger
language plpgsql
security definer
set search_path = ''
as $fn$
declare
  v_reps integer;
begin
  select count(*) into v_reps
    from public.profiles p
   where p.partner_company_id = old.id;

  if v_reps > 0 then
    raise exception
      'partner company "%" still has % linked rep profile(s) and cannot be deleted; re-point or remove them first, or set the company inactive to end the relationship',
      old.name, v_reps
      using errcode = '23503';
  end if;

  return old;
end;
$fn$;

drop trigger if exists partner_companies_guard_delete on public.partner_companies;
create trigger partner_companies_guard_delete
  before delete on public.partner_companies
  for each row execute function public.guard_partner_company_delete();

-- updated_at maintenance
drop trigger if exists partner_companies_set_updated_at on public.partner_companies;
create trigger partner_companies_set_updated_at before update on public.partner_companies
  for each row execute function public.set_updated_at();

drop trigger if exists profiles_set_updated_at on public.profiles;
create trigger profiles_set_updated_at before update on public.profiles
  for each row execute function public.set_updated_at();

drop trigger if exists leads_set_updated_at on public.leads;
create trigger leads_set_updated_at before update on public.leads
  for each row execute function public.set_updated_at();

drop trigger if exists claims_set_updated_at on public.claims;
create trigger claims_set_updated_at before update on public.claims
  for each row execute function public.set_updated_at();

drop trigger if exists claim_financials_set_updated_at on public.claim_financials;
create trigger claim_financials_set_updated_at before update on public.claim_financials
  for each row execute function public.set_updated_at();

drop trigger if exists claimants_set_updated_at on public.claimants;
create trigger claimants_set_updated_at before update on public.claimants
  for each row execute function public.set_updated_at();

drop trigger if exists documents_set_updated_at on public.documents;
create trigger documents_set_updated_at before update on public.documents
  for each row execute function public.set_updated_at();

drop trigger if exists notifications_outbox_set_updated_at on public.notifications_outbox;
create trigger notifications_outbox_set_updated_at before update on public.notifications_outbox
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- Indexes: every foreign key, plus the columns the app filters and orders by
-- ---------------------------------------------------------------------------

create index if not exists profiles_role_idx on public.profiles (role);
create index if not exists profiles_partner_company_id_idx on public.profiles (partner_company_id);

create index if not exists partner_companies_status_idx on public.partner_companies (status);

create index if not exists leads_status_created_at_idx on public.leads (status, created_at desc);
create index if not exists leads_created_at_idx on public.leads (created_at desc);
create index if not exists leads_email_idx on public.leads (lower(email)) where email is not null;

create index if not exists claims_status_created_at_idx on public.claims (status, created_at desc);
create index if not exists claims_created_at_idx on public.claims (created_at desc);
create index if not exists claims_assigned_adjuster_id_idx on public.claims (assigned_adjuster_id);
create index if not exists claims_assigned_adjuster_status_idx
  on public.claims (assigned_adjuster_id, status) where assigned_adjuster_id is not null;
create index if not exists claims_partner_company_id_idx
  on public.claims (partner_company_id) where partner_company_id is not null;
create index if not exists claims_claim_number_idx on public.claims (claim_number) where claim_number is not null;

create index if not exists claim_financials_updated_by_idx on public.claim_financials (updated_by);

create index if not exists claimants_claim_id_idx on public.claimants (claim_id);
create index if not exists claimants_user_id_idx on public.claimants (user_id) where user_id is not null;
create index if not exists claimants_email_idx on public.claimants (email);
create unique index if not exists claimants_one_primary_per_claim_idx
  on public.claimants (claim_id) where is_primary;

create index if not exists claim_status_history_claim_id_created_at_idx
  on public.claim_status_history (claim_id, created_at desc);
create index if not exists claim_status_history_changed_by_idx on public.claim_status_history (changed_by);

create index if not exists claim_events_claim_id_created_at_idx
  on public.claim_events (claim_id, created_at desc);
create index if not exists claim_events_claim_id_visibility_idx on public.claim_events (claim_id, visibility);
create index if not exists claim_events_author_id_idx on public.claim_events (author_id);

create index if not exists documents_claim_id_created_at_idx on public.documents (claim_id, created_at desc);
create index if not exists documents_claim_id_kind_idx on public.documents (claim_id, kind);
create index if not exists documents_uploaded_by_idx on public.documents (uploaded_by);
create index if not exists documents_lor_signed_idx on public.documents (claim_id) where kind = 'lor_signed';

create index if not exists consents_claim_id_idx on public.consents (claim_id);
create index if not exists consents_lead_id_idx on public.consents (lead_id);
create index if not exists consents_email_idx on public.consents (lower(email));

create index if not exists invites_email_idx on public.invites (lower(email));
create index if not exists invites_claim_id_idx on public.invites (claim_id);
create index if not exists invites_partner_company_id_idx on public.invites (partner_company_id);
create index if not exists invites_invited_by_idx on public.invites (invited_by);
create index if not exists invites_accepted_by_idx on public.invites (accepted_by);
create index if not exists invites_pending_idx on public.invites (expires_at) where accepted_at is null;

create index if not exists audit_log_created_at_idx on public.audit_log (created_at desc);
create index if not exists audit_log_entity_idx on public.audit_log (entity, entity_id, created_at desc);
create index if not exists audit_log_actor_id_idx on public.audit_log (actor_id);

create index if not exists notifications_outbox_due_idx
  on public.notifications_outbox (next_attempt_at)
  where status in ('pending', 'failed');
create index if not exists notifications_outbox_status_idx on public.notifications_outbox (status, created_at desc);

create index if not exists claim_partner_summaries_company_idx
  on public.claim_partner_summaries (partner_company_id, updated_at desc);
create index if not exists claim_partner_summaries_status_idx on public.claim_partner_summaries (status);

create index if not exists rate_limits_window_start_idx on public.rate_limits (window_start);

create index if not exists storage_cleanup_queue_pending_idx
  on public.storage_cleanup_queue (enqueued_at)
  where processed_at is null;

create index if not exists pandadoc_webhook_events_received_at_idx
  on public.pandadoc_webhook_events (received_at desc);

-- ---------------------------------------------------------------------------
-- Privileges: anon gets nothing in public; authenticated gets the minimum the
-- access matrix (spec §4) needs, with RLS deciding rows underneath.
-- ---------------------------------------------------------------------------

revoke all on all tables in schema public from anon, authenticated, public;
revoke all on all sequences in schema public from anon, authenticated, public;
revoke all on all routines in schema public from anon, authenticated, public;

alter default privileges in schema public revoke all on tables from anon;
alter default privileges in schema public revoke all on sequences from anon;
alter default privileges in schema public revoke all on functions from anon;
revoke usage on schema public from anon;

-- Revoking from `anon` by name left the implicit PUBLIC grant standing, and anon is a
-- member of PUBLIC like every other role, so it still held USAGE on the schema. Nothing
-- in this migration is reachable through it — every table and routine is revoked from
-- PUBLIC above — but USAGE is the standing half of the pair, and Postgres grants EXECUTE
-- to PUBLIC by default on every function created. One future migration that forgets an
-- explicit revoke would otherwise be immediately callable by anon.
--
-- The schema revoke is the load-bearing line, and it is what the regression test pins:
-- a function created in public after this point does still arrive with EXECUTE granted to
-- PUBLIC, but anon cannot reach it, because entering the schema fails first with
-- "permission denied for schema public". Verified on this stack (Postgres 17.6): a role
-- with no memberships at all holds EXECUTE on a freshly created function and still cannot
-- call it.
--
-- The default-privileges line below is defence in depth and is deliberately NOT relied
-- on. It is recorded in pg_default_acl as expected ({postgres=X/postgres}, PUBLIC absent)
-- yet newly created functions in this database are still born with proacl null, i.e. the
-- built-in default including PUBLIC EXECUTE — reproduced in a scratch schema too, so it
-- is not something about `public`. It costs nothing and is correct on any build where it
-- does take effect, but no security property here depends on it: what actually keeps a
-- forgotten revoke from becoming a hole is the schema USAGE revoke above plus the
-- explicit `revoke all on all routines ... from public` earlier in this file, which every
-- future migration must repeat for its own functions.
--
-- `authenticated` and `service_role` hold USAGE on public by their own explicit grants
-- (Supabase's bootstrap), so PostgREST is unaffected — confirmed against the running REST
-- endpoint for both an anon key (401, schema denied) and a signed-in session (200).
revoke usage on schema public from public;
alter default privileges in schema public revoke execute on functions from public;

-- profiles: UPDATE is granted on all columns because a column grant cannot tell
-- an owner from a customer. Privilege escalation is blocked one level down by
-- public.guard_profile_privileges(), which rejects any change to role /
-- partner_company_id / is_active unless the actor is an owner or the service role.
grant select, update on public.profiles to authenticated;
grant select, insert, update, delete on public.partner_companies to authenticated;
grant select, insert, update, delete on public.leads to authenticated;
grant select, insert, update, delete on public.claims to authenticated;
grant select, insert, update, delete on public.claim_financials to authenticated;
grant select, insert, update, delete on public.claimants to authenticated;
grant select, insert on public.claim_status_history to authenticated;
grant select, insert on public.claim_events to authenticated;
grant select, insert, update, delete on public.documents to authenticated;
grant select, insert, update on public.consents to authenticated;
grant select, insert, update, delete on public.invites to authenticated;
grant select on public.audit_log to authenticated;
grant select on public.claim_partner_summaries to authenticated;
-- notifications_outbox, rate_limits, pandadoc_webhook_events, claim_ref_counters,
-- storage_cleanup_queue: service role only; no grants, no policies.

grant all on all tables in schema public to service_role;
grant all on all sequences in schema public to service_role;

-- The throttle keys on whatever string it is handed, and it counts every call whether
-- or not the call is allowed. Reachable from a user session, it is a weapon: any
-- signed-in account can spend a stranger's per-email or per-IP budget and lock them
-- out of the intake form. The only callers that legitimately supply a key are the
-- server actions fronting the public forms, and those run as the service role.
revoke all on function public.check_rate_limit(text, integer, interval) from public, anon, authenticated;
grant execute on function public.check_rate_limit(text, integer, interval) to service_role;

revoke all on function public.next_claim_ref() from public, anon, authenticated;
grant execute on function public.next_claim_ref() to service_role;

revoke all on function public.assert_claim_loss_date(date) from public, anon, authenticated;
grant execute on function public.assert_claim_loss_date(date) to service_role;

revoke all on function public.refresh_claim_partner_summary(uuid) from public, anon, authenticated;
grant execute on function public.refresh_claim_partner_summary(uuid) to service_role;

revoke all on function public.allowed_claim_transitions(public.claim_status) from public, anon;
grant execute on function public.allowed_claim_transitions(public.claim_status) to authenticated, service_role;
