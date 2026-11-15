-- Recheck current authority after the last explicit row-lock wait.
-- Existing RPC signatures and grants remain unchanged.

create or replace function public.save_law_firm(p_firm_id uuid,p_name text,p_contact_name text,p_contact_email text,p_contact_phone text,p_is_active boolean)
returns public.law_firms language plpgsql security definer set search_path='' as $$
declare v_row public.law_firms;
begin
 if not private.is_owner() then raise exception 'Not available' using errcode='42501'; end if;
 if p_firm_id is null then
   insert into public.law_firms(name,contact_name,contact_email,contact_phone,is_active,created_by,updated_by)
   values(btrim(p_name),btrim(p_contact_name),lower(btrim(p_contact_email)),btrim(p_contact_phone),p_is_active,auth.uid(),auth.uid()) returning * into v_row;
 else
   perform 1 from public.law_firms where id=p_firm_id for update;
   if not found or not private.is_owner() then raise exception 'Not available' using errcode='42501'; end if;
   update public.law_firms set name=btrim(p_name),contact_name=btrim(p_contact_name),contact_email=lower(btrim(p_contact_email)),contact_phone=btrim(p_contact_phone),is_active=p_is_active,updated_at=now(),updated_by=auth.uid()
   where id=p_firm_id returning * into v_row;
   if not found then raise exception 'Not available' using errcode='42501'; end if;
 end if;
 insert into public.audit_log(actor_id,action,entity,entity_id) values(auth.uid(),'law_firm.save','law_firms',v_row.id);
 return v_row;
end;
$$;

create or replace function public.start_legal_handoff(p_claim_id uuid,p_firm_id uuid,p_request_id uuid)
returns public.claim_legal_handoffs language plpgsql security definer set search_path='' as $$
declare v_claim public.claims; v_firm public.law_firms; v_row public.claim_legal_handoffs;
begin
 select * into v_claim from public.claims where id=p_claim_id for update;
 if not found or not private.can_manage_claim(p_claim_id) then raise exception 'Not available' using errcode='42501'; end if;
 select * into v_row from public.claim_legal_handoffs where request_id=p_request_id;
 if found then
   if v_row.claim_id<>p_claim_id or v_row.firm_id<>p_firm_id then raise exception 'Request changed' using errcode='23514'; end if;
   return v_row;
 end if;
 if v_claim.status not in ('lor_signed','documenting','filed','negotiating','settlement_offered','denied','reopened')
    or v_claim.lor_signed_at is null or not exists(select 1 from public.documents where claim_id=p_claim_id and kind='lor_signed') then
   raise exception 'Active signed representation required' using errcode='23514';
 end if;
 select * into v_firm from public.law_firms where id=p_firm_id and is_active for share;
 if not found then raise exception 'Active firm required' using errcode='23514'; end if;
 if not private.can_manage_claim(p_claim_id) then raise exception 'Not available' using errcode='42501'; end if;
 insert into public.claim_legal_handoffs(claim_id,firm_id,firm_snapshot,prior_status,created_by,request_id)
 values(p_claim_id,p_firm_id,jsonb_build_object('name',v_firm.name,'contactName',v_firm.contact_name,'email',v_firm.contact_email,'phone',v_firm.contact_phone),v_claim.status,auth.uid(),p_request_id) returning * into v_row;
 insert into public.audit_log(actor_id,action,entity,entity_id,meta)
 values(auth.uid(),'legal_handoff.start','claim_legal_handoffs',v_row.id,jsonb_build_object('claim_id',p_claim_id));
 return v_row;
end;
$$;

create or replace function public.prepare_legal_package(p_handoff_id uuid,p_document_ids uuid[],p_summary_fields text[],p_summary_note text,p_request_id uuid)
returns jsonb language plpgsql security definer set search_path='' as $$
declare v_h public.claim_legal_handoffs; v_c public.claims; v_existing public.claim_legal_packages;
 v_docs jsonb; v_summary jsonb='[]'; v_payload jsonb; v_snapshot jsonb; v_id uuid=gen_random_uuid(); v_amount numeric;
begin
 select * into v_h from public.claim_legal_handoffs where id=p_handoff_id;
 if not found or not private.can_manage_claim(v_h.claim_id) then raise exception 'Not available' using errcode='42501'; end if;
 select * into v_c from public.claims where id=v_h.claim_id for update;
 select * into v_h from public.claim_legal_handoffs where id=p_handoff_id for update;
 if not private.can_manage_claim(v_h.claim_id) then raise exception 'Not available' using errcode='42501'; end if;
 if p_document_ids is null or cardinality(p_document_ids) not between 1 and 500 or
    (select count(distinct x) from unnest(p_document_ids) x)<>cardinality(p_document_ids) or
    p_summary_fields is null or cardinality(p_summary_fields) not between 1 and 7 or
    not p_summary_fields <@ array['claim','homeowners','property','loss','insurance','adjuster','settlement']::text[] or
    (select count(distinct x) from unnest(p_summary_fields) x)<>cardinality(p_summary_fields) or
    p_summary_note is null or length(p_summary_note)>10000 then raise exception 'Invalid package selection' using errcode='23514'; end if;
 v_payload=jsonb_build_object('handoff',p_handoff_id,'documents',p_document_ids,'fields',p_summary_fields,'note',p_summary_note);
 select * into v_existing from public.claim_legal_packages where request_id=p_request_id;
 if found then
   if v_existing.request_payload<>v_payload then raise exception 'Request changed' using errcode='23514'; end if;
   return v_existing.snapshot;
 end if;
 if v_h.ended_at is not null then raise exception 'Handoff has ended' using errcode='23514'; end if;
 perform 1 from public.documents where id=any(p_document_ids) and claim_id=v_c.id for share;
 if not private.can_manage_claim(v_c.id) then raise exception 'Not available' using errcode='42501'; end if;
 select jsonb_agg(jsonb_build_object('id',d.id,'name',d.original_name,'mime',d.mime,'sizeBytes',d.size_bytes,'updatedAt',d.updated_at) order by d.id)
 into v_docs from public.documents d where d.id=any(p_document_ids) and d.claim_id=v_c.id;
 if coalesce(jsonb_array_length(v_docs),0)<>cardinality(p_document_ids) then raise exception 'Selected document unavailable' using errcode='42501'; end if;
 if 'claim'=any(p_summary_fields) then v_summary=v_summary||jsonb_build_array(jsonb_build_object('label','Claim reference','value',v_c.claim_ref)); end if;
 if 'homeowners'=any(p_summary_fields) then
   v_summary=v_summary||jsonb_build_array(jsonb_build_object('label','Homeowners','value',coalesce((select string_agg(concat_ws(' ',first_name,last_name)||' | '||email||coalesce(' | '||phone,''),E'\n' order by is_primary desc,id) from public.claimants where claim_id=v_c.id),'')));
 end if;
 if 'property'=any(p_summary_fields) then v_summary=v_summary||jsonb_build_array(jsonb_build_object('label','Property','value',concat_ws(', ',v_c.property_street,nullif(v_c.property_street2,''),v_c.property_city,v_c.property_state,v_c.property_zip))); end if;
 if 'loss'=any(p_summary_fields) then v_summary=v_summary||jsonb_build_array(jsonb_build_object('label','Loss','value',v_c.loss_date::text||' | '||v_c.cause::text||E'\n'||v_c.description)); end if;
 if 'insurance'=any(p_summary_fields) then v_summary=v_summary||jsonb_build_array(jsonb_build_object('label','Insurance','value',concat_ws(' | ',v_c.carrier,'Policy: '||v_c.policy_number,'Claim: '||v_c.claim_number))); end if;
 if 'adjuster'=any(p_summary_fields) then v_summary=v_summary||jsonb_build_array(jsonb_build_object('label','CMG adjuster','value',coalesce((select concat_ws(' ',first_name,last_name) from public.profiles where id=v_c.assigned_adjuster_id),''))); end if;
 if 'settlement'=any(p_summary_fields) then
   select settlement_amount into v_amount from public.claim_financials where claim_id=v_c.id;
   v_summary=v_summary||jsonb_build_array(jsonb_build_object('label','Recorded settlement amount','value',coalesce('$'||to_char(v_amount,'FM9999999990.00'),'Not recorded')));
 end if;
 v_snapshot=jsonb_build_object('id',v_id,'claimId',v_c.id,'handoffId',v_h.id,'claimRef',v_c.claim_ref,'createdAt',now(),'firm',v_h.firm_snapshot,'summary',v_summary,'summaryNote',p_summary_note,'documents',v_docs);
 insert into public.claim_legal_packages(id,handoff_id,claim_id,snapshot,request_payload,created_by,request_id)
 values(v_id,v_h.id,v_c.id,v_snapshot,v_payload,auth.uid(),p_request_id);
 insert into public.audit_log(actor_id,action,entity,entity_id,meta) values(auth.uid(),'legal_package.prepare','claim_legal_packages',v_id,jsonb_build_object('claim_id',v_c.id,'document_count',cardinality(p_document_ids)));
 return v_snapshot;
end;
$$;
