-- Additive intake metadata. These supplied details never grant partner access.
-- Existing claims and pending upload submissions can omit all four fields.
-- Recovery: deploy the previous application; retain these nullable columns.
-- Use a reviewed forward repair for any database correction; do not drop data.
alter table public.claims
  add column contractor_name text check (length(contractor_name) between 1 and 80),
  add column contractor_company text check (length(contractor_company) between 1 and 160),
  add column contractor_phone text check (length(contractor_phone) between 7 and 40 and length(regexp_replace(contractor_phone,'[^0-9]','','g')) >= 7),
  add column contractor_email text check (length(contractor_email) <= 254 and contractor_email ~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$');

comment on column public.claims.contractor_company is
  'Unverified intake contact information; not partner membership or vendor attribution.';

-- Claims RLS remains the row boundary. No new public or partner directory exists.
grant select (contractor_name,contractor_company,contractor_phone,contractor_email)
  on public.claims to authenticated;

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
    referrer_name,referrer_email,contractor_name,contractor_company,contractor_phone,contractor_email,partner_company_id)
  values('',coalesce((p_claim->>'status')::public.claim_status,'new_intake'),
    p_claim->>'property_street',p_claim->>'property_street2',p_claim->>'property_city',
    coalesce(p_claim->>'property_state','PA'),p_claim->>'property_zip',p_claim->>'carrier',
    p_claim->>'policy_number',nullif(p_claim->>'carrier_tenure','')::public.carrier_tenure,
    coalesce((p_claim->>'prior_roof_claim')::boolean,false),
    nullif(p_claim->>'prior_outcome','')::public.prior_claim_outcome,p_claim->>'claim_number',
    nullif(p_claim->>'lor_contract_type','')::public.lor_contract_type,
    (p_claim->>'loss_date')::date,nullif(p_claim->>'loss_time','')::time,
    (p_claim->>'cause')::public.cause_of_loss,p_claim->>'description',
    p_claim->>'requested_adjuster',p_claim->>'referrer_name',p_claim->>'referrer_email',
    nullif(btrim(p_claim->>'contractor_name'),''),nullif(btrim(p_claim->>'contractor_company'),''),
    nullif(btrim(p_claim->>'contractor_phone'),''),nullif(btrim(p_claim->>'contractor_email'),''),
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
