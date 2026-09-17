-- Vendor fee rates, environment-derived portal links, and catalog cleanup.
--
-- Recovery: every change here is forward-safe and additive except the two
-- function drops at the end, which remove objects no code path calls. To roll
-- back, deploy the previous application revision and re-apply
-- 20260815160000_claim_search_computed_field.sql (for
-- public.claim_search_text) and the four-argument
-- private.invite_account_marker block in
-- 20260815190000_architecture_convergence_round1.sql. The new
-- partner_companies.default_fee_percent column is nullable, so leaving it in
-- place costs nothing: a null rate means "use CMG's standard fee", which is
-- exactly the behaviour that existed before this migration.

-- ---------------------------------------------------------------------------
-- 1. Per-vendor fee rate
-- ---------------------------------------------------------------------------
-- CMG's standard fee is FEE_PERCENT_DEFAULT (20%). A referring vendor may have
-- negotiated its own rate; null means the standard one still applies, so the
-- column is nullable rather than defaulted — a stored 20 would be a claim that
-- someone decided on 20 for this company, which is a different fact.
--
-- The range matches claim_financials_fee_percent_range, because this value is
-- copied into claim_financials.fee_percent when an intake is accepted and must
-- not be able to seed a row the financials table would refuse.
alter table public.partner_companies
  add column default_fee_percent numeric(5, 2),
  add constraint partner_companies_default_fee_percent_range
    check (default_fee_percent is null
           or (default_fee_percent >= 0 and default_fee_percent <= 100));

comment on column public.partner_companies.default_fee_percent is
  'Negotiated CMG fee for claims this vendor refers, in percent. Null means the standard fee applies. Owner-editable only; the public intake form never writes it.';

-- The table-level grant from the initial schema already covers the new column,
-- and partner_companies_insert_owner / _update_owner remain the boundary: only
-- an owner can write any column on this table.

-- ---------------------------------------------------------------------------
-- 2. Accepting an intake seeds the fee and carries the portal URL
-- ---------------------------------------------------------------------------
-- Two changes to the same function, both removing a hard-coded value.
--
--   * The outbox payload's portalUrl was a literal production URL, so a
--     preview or local acceptance queued an email pointing at production. It is
--     now an argument the application derives from NEXT_PUBLIC_SITE_URL, the
--     same helper every other notification uses.
--
--   * claim_financials.fee_percent was left null at acceptance and had to be
--     typed in later, which is how a LOR could reach the contract mapping with
--     no rate. It is now seeded here, inside the same transaction as the status
--     change, from the referring vendor's own rate when there is one and from
--     the application's standard rate otherwise. Only when no financials row
--     exists yet: a rate somebody already entered is never overwritten.
--
-- The referring vendor is the company chosen at triage when one was chosen, and
-- otherwise the vendor whose public link produced the intake. Both are read
-- after the UPDATE above has settled the attribution.
drop function if exists public.accept_intake_transaction(
  uuid,uuid,text,uuid,text,text,text,public.carrier_tenure,
  public.lor_contract_type,text,inet
);

create function public.accept_intake_transaction(
  p_claim_id uuid,p_adjuster_id uuid,p_partner_choice text,p_partner_company_id uuid,
  p_new_partner_name text,p_carrier text,p_policy_number text,
  p_carrier_tenure public.carrier_tenure,
  p_lor_contract_type public.lor_contract_type,p_note text,p_ip inet,
  p_portal_url text,p_default_fee_percent numeric
) returns jsonb language plpgsql volatile security definer set search_path = '' as $fn$
declare v_claim public.claims%rowtype; v_partner_id uuid; v_actor uuid := auth.uid();
  v_fee numeric; v_referral_partner_id uuid;
begin
  if private.current_app_role() is distinct from 'owner'::public.app_role then
    raise exception 'owner required' using errcode='42501';
  end if;
  select * into v_claim from public.claims where id=p_claim_id for update;
  if not found or v_claim.status <> 'new_intake' then raise exception 'intake unavailable' using errcode='P0002'; end if;
  if not exists(select 1 from public.profiles where id=p_adjuster_id and role='adjuster' and is_active) then
    raise exception 'inactive adjuster' using errcode='23514';
  end if;
  if p_partner_choice='existing' then
    if not exists(select 1 from public.partner_companies where id=p_partner_company_id and status='active') then
      raise exception 'invalid partner' using errcode='23503';
    end if; v_partner_id:=p_partner_company_id;
  elsif p_partner_choice='new' then
    if nullif(btrim(p_new_partner_name),'') is null then raise exception 'partner name required' using errcode='23514'; end if;
    insert into public.partner_companies(name,contact_name,contact_email)
    values(btrim(p_new_partner_name),v_claim.referrer_name,v_claim.referrer_email) returning id into v_partner_id;
  elsif p_partner_choice <> 'none' then raise exception 'invalid partner choice' using errcode='22023'; end if;
  update public.claims set assigned_adjuster_id=p_adjuster_id,partner_company_id=v_partner_id,
    carrier=coalesce(p_carrier,carrier),policy_number=coalesce(p_policy_number,policy_number),
    carrier_tenure=coalesce(p_carrier_tenure,carrier_tenure),
    lor_contract_type=coalesce(p_lor_contract_type,lor_contract_type),status='under_review'
  where id=p_claim_id;
  insert into public.claim_status_history(claim_id,from_status,to_status,note,changed_by)
  values(p_claim_id,'new_intake','under_review',p_note,v_actor);
  insert into public.claim_events(claim_id,type,body,author_id,visibility)
  values(p_claim_id,'status',coalesce(p_note,'Claim moved to Under review.'),v_actor,'customer');
  insert into public.audit_log(actor_id,action,entity,entity_id,meta,ip)
  values(v_actor,'claim.intake_accepted','claims',p_claim_id,
    jsonb_build_object('claim_ref',v_claim.claim_ref,'assigned_adjuster_id',p_adjuster_id,
      'partner_company_id',v_partner_id,'lor_contract_type',p_lor_contract_type),p_ip);

  -- The chosen company first, then the vendor whose public link produced the
  -- intake. A triage choice is a person stating who referred this claim, which
  -- outranks the link the homeowner happened to arrive through.
  v_referral_partner_id := coalesce(v_partner_id, v_claim.intake_referral_partner_id);
  if v_referral_partner_id is not null then
    select pc.default_fee_percent into v_fee
      from public.partner_companies pc where pc.id=v_referral_partner_id;
  end if;
  v_fee := coalesce(v_fee, p_default_fee_percent);
  if v_fee is not null and not exists(
    select 1 from public.claim_financials f where f.claim_id=p_claim_id
  ) then
    insert into public.claim_financials(claim_id,fee_percent,updated_by)
    values(p_claim_id,v_fee,v_actor)
    on conflict (claim_id) do nothing;
  end if;

  insert into public.notifications_outbox(recipient_email,template,payload,dedupe_key)
  select c.email,'claim_status_update',jsonb_build_object(
    'firstName',c.first_name,'claimRef',v_claim.claim_ref,'statusLabel','Under review',
    'statusMeaning','Assigned and being assessed before representation is offered.',
    'phase','Received','note',p_note,'portalUrl',p_portal_url),
    'intake-accepted-status:'||p_claim_id::text
  from public.claimants c where c.claim_id=p_claim_id and c.is_primary
  on conflict (dedupe_key) do nothing;
  return jsonb_build_object('claim_ref',v_claim.claim_ref,'partner_company_id',v_partner_id,
    'fee_percent',v_fee);
end;
$fn$;

revoke all on function public.accept_intake_transaction(
  uuid,uuid,text,uuid,text,text,text,public.carrier_tenure,
  public.lor_contract_type,text,inet,text,numeric
) from public,anon;
grant execute on function public.accept_intake_transaction(
  uuid,uuid,text,uuid,text,text,text,public.carrier_tenure,
  public.lor_contract_type,text,inet,text,numeric
) to authenticated;

-- ---------------------------------------------------------------------------
-- 3. Public submission defaults to the state the table defaults to
-- ---------------------------------------------------------------------------
-- 'PA' predates the move to Florida and disagreed with public.claims'
-- property_state default, so a submission that omitted the field recorded a
-- state CMG does not operate in.
create or replace function public.submit_claim_transaction(
  p_claim jsonb, p_claimants jsonb, p_consents jsonb, p_documents jsonb,
  p_outbox jsonb, p_partner_company_id uuid default null, p_audit jsonb default null
) returns jsonb language plpgsql volatile security invoker set search_path = '' as $fn$
declare v_claim public.claims%rowtype; v_outbox_ids uuid[];
begin
  if current_user <> 'service_role' then
    raise exception 'service role required' using errcode='42501';
  end if;
  insert into public.claims(
    claim_ref,status,property_street,property_street2,property_city,property_state,
    property_zip,carrier,policy_number,carrier_tenure,prior_roof_claim,prior_outcome,
    claim_number,lor_contract_type,loss_date,loss_time,cause,description,requested_adjuster,
    referrer_name,referrer_email,contractor_name,contractor_company,contractor_phone,contractor_email,intake_referral_partner_id,partner_company_id)
  values('',coalesce((p_claim->>'status')::public.claim_status,'new_intake'),
    p_claim->>'property_street',p_claim->>'property_street2',p_claim->>'property_city',
    coalesce(p_claim->>'property_state','Florida'),p_claim->>'property_zip',p_claim->>'carrier',
    p_claim->>'policy_number',nullif(p_claim->>'carrier_tenure','')::public.carrier_tenure,
    coalesce((p_claim->>'prior_roof_claim')::boolean,false),
    nullif(p_claim->>'prior_outcome','')::public.prior_claim_outcome,p_claim->>'claim_number',
    nullif(p_claim->>'lor_contract_type','')::public.lor_contract_type,
    (p_claim->>'loss_date')::date,nullif(p_claim->>'loss_time','')::time,
    (p_claim->>'cause')::public.cause_of_loss,p_claim->>'description',
    p_claim->>'requested_adjuster',p_claim->>'referrer_name',p_claim->>'referrer_email',
    nullif(btrim(p_claim->>'contractor_name'),''),nullif(btrim(p_claim->>'contractor_company'),''),
    nullif(btrim(p_claim->>'contractor_phone'),''),nullif(btrim(p_claim->>'contractor_email'),''),
    nullif(p_claim->>'intake_referral_partner_id','')::uuid,
    p_partner_company_id) returning * into v_claim;
  insert into public.claimants(claim_id,first_name,last_name,email,phone,initials,is_primary)
  select v_claim.id,x.first_name,x.last_name,x.email,x.phone,x.initials,x.is_primary
  from jsonb_to_recordset(p_claimants) x(first_name text,last_name text,email text,phone text,initials text,is_primary boolean);
  if jsonb_array_length(coalesce(p_consents,'[]'::jsonb)) > 0 then
    insert into public.consents(claim_id,email,phone,kind,consent_text,ip)
    select v_claim.id,x.email,x.phone,x.kind::public.consent_kind,x.consent_text,nullif(x.ip,'')::inet
    from jsonb_to_recordset(p_consents) x(email text,phone text,kind text,consent_text text,ip text);
  end if;
  if jsonb_array_length(coalesce(p_documents,'[]'::jsonb)) > 0 then
    insert into public.documents(claim_id,storage_path,original_name,kind,mime,size_bytes,visibility)
    select v_claim.id,x.storage_path,x.original_name,x.kind::public.document_kind,x.mime,x.size_bytes,x.visibility::public.document_visibility
    from jsonb_to_recordset(p_documents) x(storage_path text,original_name text,kind text,mime text,size_bytes bigint,visibility text);
  end if;
  if jsonb_array_length(coalesce(p_outbox,'[]'::jsonb)) > 0 then
    with queued as (
      insert into public.notifications_outbox(recipient_email,template,payload,dedupe_key)
      select x.recipient_email,x.template,
        case when x.payload ? 'claimRef' then jsonb_set(x.payload,'{claimRef}',to_jsonb(v_claim.claim_ref)) else x.payload end,
        x.dedupe_key
      from jsonb_to_recordset(p_outbox) x(recipient_email text,template text,payload jsonb,dedupe_key text)
      returning id
    ) select array_agg(id) into v_outbox_ids from queued;
  end if;
  if p_audit is not null and p_audit <> 'null'::jsonb then
    insert into public.audit_log(actor_id,action,entity,entity_id,meta,ip)
    values((p_audit->>'actor_id')::uuid,p_audit->>'action','claims',v_claim.id,
      coalesce(p_audit->'meta','{}'::jsonb) || jsonb_build_object('claim_ref',v_claim.claim_ref),
      nullif(p_audit->>'ip','')::inet);
  end if;
  return jsonb_build_object('id',v_claim.id,'claim_ref',v_claim.claim_ref,
    'outbox_ids',coalesce(to_jsonb(v_outbox_ids),'[]'::jsonb));
end;
$fn$;

revoke all on function public.submit_claim_transaction(jsonb,jsonb,jsonb,jsonb,jsonb,uuid,jsonb)
  from public,anon,authenticated;
grant execute on function public.submit_claim_transaction(jsonb,jsonb,jsonb,jsonb,jsonb,uuid,jsonb)
  to service_role;

-- ---------------------------------------------------------------------------
-- 4. The delete guard covers every foreign key into partner_companies
-- ---------------------------------------------------------------------------
-- The guard counted rep profiles only, so deleting a company that had referred
-- a claim fell through to the raw ON DELETE RESTRICT violation — which
-- src/lib/actions/partners.ts passes through to the owner verbatim, because a
-- 23503 from this table is supposed to be the guard's own sentence. Both claim
-- paths are counted now: the company chosen at triage, and the vendor whose
-- public link produced the intake.
create or replace function public.guard_partner_company_delete()
returns trigger
language plpgsql
security definer
set search_path = ''
as $fn$
declare
  v_reps integer;
  v_claims integer;
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

  select count(*) into v_claims
    from public.claims c
   where c.partner_company_id = old.id
      or c.intake_referral_partner_id = old.id;

  if v_claims > 0 then
    raise exception
      'partner company "%" is still attributed to % claim(s) and cannot be deleted; set the company inactive to end the relationship and keep the attribution',
      old.name, v_claims
      using errcode = '23503';
  end if;

  return old;
end;
$fn$;

-- ---------------------------------------------------------------------------
-- 5. Staff claims projection surfaces the vendor link
-- ---------------------------------------------------------------------------
-- Two output columns, so the admin claims list can show and filter on the
-- vendor whose public link produced an intake. The return type changes, so the
-- function is dropped rather than replaced; the grants are restated below
-- exactly as 20260815210000 set them.
drop function if exists public.staff_claims_projection();

create function public.staff_claims_projection()
returns table (
  id uuid,
  claim_ref text,
  status public.claim_status,
  loss_date date,
  updated_at timestamptz,
  property_street text,
  property_city text,
  property_state text,
  property_zip text,
  assigned_adjuster_id uuid,
  partner_company_id uuid,
  adjuster_name text,
  partner_name text,
  intake_referral_partner_id uuid,
  intake_referral_partner_name text,
  search_text text
)
language sql
stable
security definer
set search_path = ''
as $fn$
  with caller as (
    select private.current_app_role() as app_role, auth.uid() as user_id
  )
  select
    c.id,
    c.claim_ref,
    c.status,
    c.loss_date,
    c.updated_at,
    c.property_street,
    c.property_city,
    c.property_state,
    c.property_zip,
    c.assigned_adjuster_id,
    c.partner_company_id,
    nullif(btrim(concat_ws(' ', adjuster.first_name, adjuster.last_name)), ''),
    partner.name,
    c.intake_referral_partner_id,
    vendor.name,
    concat_ws(
      ' ',
      c.claim_ref,
      c.property_street,
      c.property_city,
      c.carrier,
      (
        select string_agg(
          concat_ws(' ', claimant.first_name, claimant.last_name, claimant.email),
          ' ' order by claimant.is_primary desc, claimant.created_at, claimant.id
        )
        from public.claimants claimant
        where claimant.claim_id = c.id
      )
    )
  from public.claims c
  cross join caller
  left join public.profiles adjuster on adjuster.id = c.assigned_adjuster_id
  left join public.partner_companies partner on partner.id = c.partner_company_id
  left join public.partner_companies vendor on vendor.id = c.intake_referral_partner_id
  where caller.app_role in ('owner', 'assistant')
     or (
       caller.app_role = 'adjuster'
       and c.assigned_adjuster_id = caller.user_id
     );
$fn$;

revoke all on function public.staff_claims_projection() from public, anon;
grant execute on function public.staff_claims_projection() to authenticated, service_role;

-- ---------------------------------------------------------------------------
-- 6. Releasing an abandoned invite reservation
-- ---------------------------------------------------------------------------
-- public.begin_invite_acceptance() reserves an invite by stamping
-- acceptance_attempt_id, and public.issue_invite_transaction() refuses to
-- resend while that stamp is present. When acceptance then failed — account
-- creation error, no resolvable user — nothing cleared the stamp, so the
-- invitation was neither usable nor re-issuable until it expired.
--
-- The release is deliberately narrow: it clears the stamp only on the attempt
-- that set it, and only while the invite is still unaccepted. A completed
-- acceptance is never disturbed, so a late failure path cannot reopen an invite
-- that another request has already redeemed.
create or replace function public.abandon_invite_acceptance(
  p_invite_id uuid, p_attempt_id uuid
) returns boolean language plpgsql volatile security invoker set search_path = '' as $fn$
declare n integer;
begin
  if current_user <> 'service_role' then
    raise exception 'service role required' using errcode='42501';
  end if;
  update public.invites set acceptance_attempt_id = null
   where id = p_invite_id
     and acceptance_attempt_id = p_attempt_id
     and accepted_at is null;
  get diagnostics n = row_count;
  return n = 1;
end;
$fn$;

revoke all on function public.abandon_invite_acceptance(uuid,uuid) from public,anon,authenticated;
grant execute on function public.abandon_invite_acceptance(uuid,uuid) to service_role;

-- ---------------------------------------------------------------------------
-- 7. Retired catalog objects
-- ---------------------------------------------------------------------------
-- public.claim_search_text(public.claims) was the composite computed field the
-- admin list used before public.staff_claims_projection() replaced it.
-- 20260815210000 revoked every grant on it and left the definition in the
-- catalog; it has had no caller since, and a composite-argument function on
-- public.claims is a standing invitation for PostgREST to materialize the whole
-- row including the e-sign bearer tokens. It goes.
drop function if exists public.claim_search_text(public.claims);

-- The four-argument marker was superseded by the two-argument overload in
-- 20260815200000, which public.finalize_invite_acceptance() calls. Keeping the
-- old overload leaves an ambiguous name in a private schema with a live
-- service_role grant.
drop function if exists private.invite_account_marker(uuid,text,uuid,uuid);
