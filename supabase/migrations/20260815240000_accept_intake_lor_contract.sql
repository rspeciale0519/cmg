-- Partner referrals do not ask the contractor to select CMG's agreement type.
-- The owner must collect it with the policy facts before accepting the intake.
drop function if exists public.accept_intake_transaction(
  uuid,uuid,text,uuid,text,text,text,public.carrier_tenure,text,inet
);

create function public.accept_intake_transaction(
  p_claim_id uuid,p_adjuster_id uuid,p_partner_choice text,p_partner_company_id uuid,
  p_new_partner_name text,p_carrier text,p_policy_number text,
  p_carrier_tenure public.carrier_tenure,
  p_lor_contract_type public.lor_contract_type,p_note text,p_ip inet
) returns jsonb language plpgsql volatile security definer set search_path = '' as $fn$
declare v_claim public.claims%rowtype; v_partner_id uuid; v_actor uuid := auth.uid();
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
  insert into public.notifications_outbox(recipient_email,template,payload,dedupe_key)
  select c.email,'claim_status_update',jsonb_build_object(
    'firstName',c.first_name,'claimRef',v_claim.claim_ref,'statusLabel','Under review',
    'statusMeaning','Assigned and being assessed before representation is offered.',
    'phase','Received','note',p_note,'portalUrl','https://www.cmgpropertysolutions.net/portal'),
    'intake-accepted-status:'||p_claim_id::text
  from public.claimants c where c.claim_id=p_claim_id and c.is_primary
  on conflict (dedupe_key) do nothing;
  return jsonb_build_object('claim_ref',v_claim.claim_ref,'partner_company_id',v_partner_id);
end;
$fn$;

revoke all on function public.accept_intake_transaction(
  uuid,uuid,text,uuid,text,text,text,public.carrier_tenure,
  public.lor_contract_type,text,inet
) from public,anon;
grant execute on function public.accept_intake_transaction(
  uuid,uuid,text,uuid,text,text,text,public.carrier_tenure,
  public.lor_contract_type,text,inet
) to authenticated;
