create function public.save_law_firm(p_firm_id uuid,p_name text,p_contact_name text,p_contact_email text,p_contact_phone text,p_is_active boolean)
returns public.law_firms language plpgsql security definer set search_path='' as $$
declare v_row public.law_firms;
begin
 if not private.is_owner() then raise exception 'Not available' using errcode='42501'; end if;
 if p_firm_id is null then
   insert into public.law_firms(name,contact_name,contact_email,contact_phone,is_active,created_by,updated_by)
   values(btrim(p_name),btrim(p_contact_name),lower(btrim(p_contact_email)),btrim(p_contact_phone),p_is_active,auth.uid(),auth.uid()) returning * into v_row;
 else
   update public.law_firms set name=btrim(p_name),contact_name=btrim(p_contact_name),contact_email=lower(btrim(p_contact_email)),contact_phone=btrim(p_contact_phone),is_active=p_is_active,updated_at=now(),updated_by=auth.uid()
   where id=p_firm_id returning * into v_row;
   if not found then raise exception 'Not available' using errcode='42501'; end if;
 end if;
 insert into public.audit_log(actor_id,action,entity,entity_id) values(auth.uid(),'law_firm.save','law_firms',v_row.id);
 return v_row;
end;
$$;

create function public.start_legal_handoff(p_claim_id uuid,p_firm_id uuid,p_request_id uuid)
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
 insert into public.claim_legal_handoffs(claim_id,firm_id,firm_snapshot,prior_status,created_by,request_id)
 values(p_claim_id,p_firm_id,jsonb_build_object('name',v_firm.name,'contactName',v_firm.contact_name,'email',v_firm.contact_email,'phone',v_firm.contact_phone),v_claim.status,auth.uid(),p_request_id) returning * into v_row;
 insert into public.audit_log(actor_id,action,entity,entity_id,meta)
 values(auth.uid(),'legal_handoff.start','claim_legal_handoffs',v_row.id,jsonb_build_object('claim_id',p_claim_id));
 return v_row;
end;
$$;

create function public.cancel_legal_preparation(p_handoff_id uuid,p_expected_version integer,p_request_id uuid)
returns jsonb language plpgsql security definer set search_path='' as $$
declare v_h public.claim_legal_handoffs;
begin
 select * into v_h from public.claim_legal_handoffs where id=p_handoff_id;
 if not found or not private.can_manage_claim(v_h.claim_id) then raise exception 'Not available' using errcode='42501'; end if;
 perform 1 from public.claims where id=v_h.claim_id for update;
 select * into v_h from public.claim_legal_handoffs where id=p_handoff_id for update;
 if not private.can_manage_claim(v_h.claim_id) then raise exception 'Not available' using errcode='42501'; end if;
 if p_request_id is null then raise exception 'Request required' using errcode='23514'; end if;
 if v_h.cancellation_request_id=p_request_id and v_h.outcome='cancelled' then
   if p_expected_version is null or v_h.version<>p_expected_version+1 then raise exception 'Request changed' using errcode='23514'; end if;
   return jsonb_build_object('claimId',v_h.claim_id,'handoffId',v_h.id,'duplicate',true);
 end if;
 if p_expected_version is null or v_h.version<>p_expected_version or v_h.ended_at is not null or v_h.milestone is not null or
    exists(select 1 from public.claim_legal_milestones where handoff_id=v_h.id) then
   raise exception 'Preparation changed or was already sent' using errcode='23514';
 end if;
 update public.claim_legal_handoffs set ended_at=now(),outcome='cancelled',version=version+1,cancellation_request_id=p_request_id where id=v_h.id;
 insert into public.audit_log(actor_id,action,entity,entity_id,meta)
 values(auth.uid(),'legal_handoff.cancel_preparation','claim_legal_handoffs',v_h.id,jsonb_build_object('claim_id',v_h.claim_id));
 return jsonb_build_object('claimId',v_h.claim_id,'handoffId',v_h.id,'duplicate',false);
end;
$$;

create function public.prepare_legal_package(p_handoff_id uuid,p_document_ids uuid[],p_summary_fields text[],p_summary_note text,p_request_id uuid)
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

create function public.legal_package_document(p_package_id uuid,p_document_id uuid)
returns table(id uuid,claim_id uuid,original_name text,mime text,size_bytes bigint,updated_at timestamptz)
language plpgsql security definer set search_path='' as $$
declare v_p public.claim_legal_packages; v_d public.documents; v_item jsonb;
begin
 select * into v_p from public.claim_legal_packages where claim_legal_packages.id=p_package_id;
 if not found or not private.can_manage_claim(v_p.claim_id) then raise exception 'Not available' using errcode='42501'; end if;
 select * into v_d from public.documents where documents.id=p_document_id and documents.claim_id=v_p.claim_id;
 if not found then raise exception 'Not available' using errcode='42501'; end if;
 select x into v_item from jsonb_array_elements(v_p.snapshot->'documents') x where x->>'id'=p_document_id::text;
 if v_item is null or v_item->>'name'<>v_d.original_name or v_item->>'mime'<>v_d.mime
    or (v_item->>'sizeBytes')::bigint<>v_d.size_bytes or (v_item->>'updatedAt')::timestamptz<>v_d.updated_at then
   raise exception 'Not available' using errcode='42501';
 end if;
 return query select v_d.id,v_d.claim_id,v_d.original_name,v_d.mime,v_d.size_bytes,v_d.updated_at;
end;
$$;

create function public.record_legal_milestone(p_handoff_id uuid,p_expected_version integer,p_milestone text,p_occurred_on date,p_return_status public.claim_status,p_request_id uuid)
returns jsonb language plpgsql security definer set search_path='' as $$
declare v_h public.claim_legal_handoffs; v_c public.claims; v_m public.claim_legal_milestones; v_payload jsonb;
 v_target public.claim_status; v_label text; v_meaning text; v_id uuid=gen_random_uuid(); v_last date;
begin
 select * into v_h from public.claim_legal_handoffs where id=p_handoff_id;
 if not found or not private.can_manage_claim(v_h.claim_id) then raise exception 'Not available' using errcode='42501'; end if;
 select * into v_c from public.claims where id=v_h.claim_id for update;
 select * into v_h from public.claim_legal_handoffs where id=p_handoff_id for update;
 if not private.can_manage_claim(v_h.claim_id) then raise exception 'Not available' using errcode='42501'; end if;
 v_payload=jsonb_build_object('handoff',p_handoff_id,'milestone',p_milestone,'date',p_occurred_on,'return',p_return_status,'version',p_expected_version);
 select * into v_m from public.claim_legal_milestones where request_id=p_request_id;
 if found then
   if v_m.request_payload<>v_payload then raise exception 'Request changed' using errcode='23514'; end if;
   return jsonb_build_object('claimId',v_c.id,'handoffId',v_h.id,'milestoneId',v_m.id,'claimStatus',v_c.status,'version',v_h.version,'duplicate',true);
 end if;
 if p_expected_version is null or v_h.version<>p_expected_version or v_h.ended_at is not null or
    v_c.status in ('new_intake','under_review','lor_sent','settled','closed','rejected') or
    v_c.lor_signed_at is null or not exists(select 1 from public.documents where claim_id=v_c.id and kind='lor_signed') then
   raise exception 'Handoff changed or is not active' using errcode='23514';
 end if;
 if p_milestone is null or not (coalesce((v_h.milestone is null and p_milestone='sent')
   or (v_h.milestone='sent' and p_milestone in ('accepted','declined','returned'))
   or (v_h.milestone='accepted' and p_milestone in ('lawsuit_filed','returned'))
   or (v_h.milestone='lawsuit_filed' and p_milestone='returned'),false)) then
   raise exception 'Invalid legal milestone' using errcode='23514';
 end if;
 select max(occurred_on) into v_last from public.claim_legal_milestones where handoff_id=v_h.id;
 if p_occurred_on is null or p_occurred_on>(now() at time zone 'America/New_York')::date or
    p_occurred_on<(v_c.lor_signed_at at time zone 'America/New_York')::date or (v_last is not null and p_occurred_on<v_last) then
   raise exception 'Invalid milestone date' using errcode='23514';
 end if;
 if p_milestone='sent' and not exists(select 1 from public.claim_legal_packages where handoff_id=v_h.id) then
   raise exception 'Prepare the reviewed package first' using errcode='23514';
 end if;
 v_target=v_c.status;
 if p_milestone='sent' then v_target='with_law_firm'; end if;
 if p_milestone in ('declined','returned') then
   if p_return_status is null or p_return_status not in ('lor_signed','documenting','filed','negotiating','settlement_offered','denied','reopened') then raise exception 'Choose the current stage' using errcode='23514'; end if;
   v_target=p_return_status;
 elsif p_return_status is not null then raise exception 'Unexpected return stage' using errcode='23514'; end if;
 v_label=case p_milestone when 'sent' then 'Sent to law firm' when 'accepted' then 'Accepted by law firm' when 'lawsuit_filed' then 'Lawsuit filed' when 'declined' then 'Declined by law firm' else 'Returned to CMG' end;
 v_meaning=case p_milestone when 'sent' then 'CMG sent your claim to a law firm for review.' when 'accepted' then 'The law firm accepted your claim. Its contact details are in your portal.' when 'lawsuit_filed' then 'CMG recorded that the law firm filed a lawsuit.' when 'declined' then 'The law firm declined the handoff. CMG is handling the next step.' else 'The law firm returned the claim to CMG for the next step.' end;
 insert into public.claim_legal_milestones(id,handoff_id,claim_id,milestone,occurred_on,recorded_by,from_status,to_status,request_id,request_payload)
 values(v_id,v_h.id,v_c.id,p_milestone,p_occurred_on,auth.uid(),v_c.status,v_target,p_request_id,v_payload);
 update public.claim_legal_handoffs set milestone=p_milestone,version=version+1,
   prior_status=case when p_milestone='sent' then v_c.status else prior_status end,
   ended_at=case when p_milestone in ('declined','returned') then now() else null end,
   outcome=case when p_milestone in ('declined','returned') then p_milestone else null end
 where id=v_h.id;
 if v_target<>v_c.status then
   update public.claims set status=v_target where claims.id=v_c.id;
   insert into public.claim_status_history(claim_id,from_status,to_status,note,changed_by) values(v_c.id,v_c.status,v_target,v_label,auth.uid());
 end if;
 insert into public.claim_events(claim_id,type,body,author_id,visibility) values(v_c.id,'status',v_meaning,auth.uid(),'customer');
 insert into public.notifications_outbox(recipient_email,template,payload,dedupe_key)
 select email,'claim_status_update',jsonb_build_object('firstName',first_name,'claimRef',v_c.claim_ref,'statusLabel',v_label,'statusMeaning',v_meaning,'portalUrl','https://app.cmgpropertysolutions.net/portal/claims/'||v_c.id::text),'legal:'||v_id::text
 from public.claimants where claim_id=v_c.id and is_primary;
 insert into public.audit_log(actor_id,action,entity,entity_id,meta) values(auth.uid(),'legal_handoff.milestone','claim_legal_handoffs',v_h.id,jsonb_build_object('claim_id',v_c.id,'milestone',p_milestone,'milestone_id',v_id));
 return jsonb_build_object('claimId',v_c.id,'handoffId',v_h.id,'milestoneId',v_id,'claimStatus',v_target,'version',v_h.version+1,'duplicate',false);
end;
$$;

create function public.claim_legal_progress(p_claim_id uuid) returns jsonb
language plpgsql stable security definer set search_path='' as $$
declare v_contact jsonb; v_milestones jsonb;
begin
 if not (private.is_claim_customer(p_claim_id) or private.can_manage_claim(p_claim_id)) then raise exception 'Not available' using errcode='42501'; end if;
 select firm_snapshot into v_contact from public.claim_legal_handoffs
 where claim_id=p_claim_id and milestone in ('accepted','lawsuit_filed') and (ended_at is null or outcome='settled')
 order by created_at desc,id desc limit 1;
 select coalesce(jsonb_agg(jsonb_build_object('id',id,'handoff_id',handoff_id,'milestone',milestone,'occurred_on',occurred_on,'recorded_at',recorded_at) order by recorded_at,id),'[]')
 into v_milestones from public.claim_legal_milestones where claim_id=p_claim_id;
 return jsonb_build_object('contact',v_contact,'milestones',v_milestones);
end;
$$;

revoke all on function public.save_law_firm(uuid,text,text,text,text,boolean),public.start_legal_handoff(uuid,uuid,uuid),public.prepare_legal_package(uuid,uuid[],text[],text,uuid),public.legal_package_document(uuid,uuid),public.record_legal_milestone(uuid,integer,text,date,public.claim_status,uuid),public.claim_legal_progress(uuid) from public,anon;
grant execute on function public.save_law_firm(uuid,text,text,text,text,boolean),public.start_legal_handoff(uuid,uuid,uuid),public.prepare_legal_package(uuid,uuid[],text[],text,uuid),public.legal_package_document(uuid,uuid),public.record_legal_milestone(uuid,integer,text,date,public.claim_status,uuid),public.claim_legal_progress(uuid) to authenticated;
revoke all on function public.cancel_legal_preparation(uuid,integer,uuid) from public,anon;
grant execute on function public.cancel_legal_preparation(uuid,integer,uuid) to authenticated;
