-- Bind record confirmation to the connection configuration inspected by the user.
-- The existing JSON argument carries the expected identity; RPC signatures stay fixed.
create or replace function public.configure_airtable_claim(p_claim_id uuid,p_expected_revision bigint,p_record_id text,p_override jsonb,p_enabled boolean) returns jsonb
language plpgsql security definer set search_path='' as $$
declare l public.airtable_claim_links%rowtype; c public.airtable_connections%rowtype; company uuid; selected text[]; mode text; allowed text[]; baseline jsonb;
begin
 if not private.can_manage_claim(p_claim_id) then raise exception 'Not available' using errcode='42501'; end if;
 select partner_company_id into company from public.claims where id=p_claim_id for update;
 if not private.can_manage_claim(p_claim_id) then raise exception 'Not available' using errcode='42501'; end if;
 if company is null then raise exception 'No referring company' using errcode='22023'; end if;
 -- Company configuration and pause use connection before link. Preserve that order.
 select * into c from public.airtable_connections where company_id=company for update;
 if not found or not c.enabled or c.needs_reconnect then raise exception 'Connection unavailable' using errcode='22023'; end if;
 select * into l from public.airtable_claim_links where claim_id=p_claim_id for update;
 -- A connection or link lock can wait while the caller or company loses access.
 if not private.can_manage_claim(p_claim_id) or not exists(
   select 1 from public.claims x join public.partner_companies pc on pc.id=x.partner_company_id
   where x.id=p_claim_id and x.partner_company_id=company and pc.status='active'
 ) then raise exception 'Not available' using errcode='42501'; end if;
 if coalesce(l.revision,0) is distinct from p_expected_revision then raise exception 'Reload the claim' using errcode='40001'; end if;
 if coalesce(p_record_id,'') !~ '^rec[a-zA-Z0-9]{14,32}$' or p_enabled is null or jsonb_typeof(p_override) is distinct from 'object' then raise exception 'Invalid record' using errcode='22023'; end if;
 -- Compare canonical strings as well as JSON types: missing, null, malformed,
 -- different, and stale proof identities all fail without unsafe input casts.
 if jsonb_typeof(p_override->'expectedConnectionId') is distinct from 'string'
   or jsonb_typeof(p_override->'expectedConfigRevision') is distinct from 'number'
   or c.id::text is distinct from p_override->>'expectedConnectionId'
   or c.config_revision::text is distinct from p_override->>'expectedConfigRevision'
 then raise exception 'Check the current Airtable record again' using errcode='40001'; end if;
 if exists(select 1 from public.airtable_delivery_requests where claim_id=p_claim_id and status in ('sending','uncertain')) then raise exception 'Resolve pending delivery first' using errcode='55000'; end if;
 mode:=nullif(p_override->>'mode','');
 if mode is not null and mode not in ('automatic','manual','milestones') then raise exception 'Invalid mode' using errcode='22023'; end if;
 if p_override ? 'fields' then select array_agg(x) into selected from jsonb_array_elements_text(p_override->'fields') x; end if;
 select array_agg(x->>'source') into allowed from jsonb_array_elements(c.mappings) x;
 if selected is not null and (not selected <@ allowed or not 'claim_ref'=any(selected)) then raise exception 'Invalid fields' using errcode='22023'; end if;
 baseline:=coalesce(p_override->'baseline','{}');
 if jsonb_typeof(baseline)<>'object' or exists(select 1 from jsonb_each(baseline) b where jsonb_typeof(b.value) not in ('string','number','boolean','null') or not exists(select 1 from jsonb_array_elements(c.mappings) m where m->>'fieldId'=b.key)) then raise exception 'Invalid baseline' using errcode='22023'; end if;
 insert into public.airtable_claim_links(claim_id,connection_id,company_id,record_id,base_id,table_id,mode_override,fields_override,enabled,config_revision,authorized_by,last_values)
 values(p_claim_id,c.id,company,p_record_id,c.base_id,c.table_id,mode,selected,p_enabled,c.config_revision,auth.uid(),baseline)
 on conflict(claim_id) do update set connection_id=excluded.connection_id,company_id=excluded.company_id,record_id=excluded.record_id,
 base_id=excluded.base_id,table_id=excluded.table_id,mode_override=excluded.mode_override,fields_override=excluded.fields_override,enabled=excluded.enabled,config_revision=excluded.config_revision,
 revision=public.airtable_claim_links.revision+1,authorized_by=auth.uid(),last_source='{}',review_required=true,
 last_values=excluded.last_values,updated_at=now();
 update public.airtable_delivery_requests set status='review_required',last_error='LINK_CHANGED' where claim_id=p_claim_id and status in ('pending','held');
 perform private.capture_airtable_update(p_claim_id,true);
 insert into public.audit_log(actor_id,action,entity,entity_id) values(auth.uid(),'airtable.link','claims',p_claim_id);
 return (select to_jsonb(x) from public.airtable_claim_links x where x.claim_id=p_claim_id);
end; $$;
