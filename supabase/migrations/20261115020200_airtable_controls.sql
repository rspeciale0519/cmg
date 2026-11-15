create function public.configure_airtable_company(p_company_id uuid,p_expected_revision bigint,p_config jsonb) returns jsonb
language plpgsql security definer set search_path='' as $$
declare c public.airtable_connections%rowtype; m jsonb; keys text[]; chosen text[]; v_enabled boolean;
begin
 if not private.is_owner() or not exists(select 1 from public.partner_companies where id=p_company_id and status='active') then raise exception 'Not available' using errcode='42501'; end if;
 select * into c from public.airtable_connections where company_id=p_company_id for update;
 -- A waiting request must not retain authority revoked while the row was locked.
 if not private.is_owner() or not exists(select 1 from public.partner_companies where id=p_company_id and status='active') then raise exception 'Not available' using errcode='42501'; end if;
 if not found or c.config_revision is distinct from p_expected_revision then raise exception 'Reload this configuration' using errcode='40001'; end if;
 if jsonb_typeof(p_config) is distinct from 'object' or coalesce(p_config->>'baseId','') !~ '^app[a-zA-Z0-9]{14,32}$' or coalesce(p_config->>'tableId','') !~ '^tbl[a-zA-Z0-9]{14,32}$'
   or coalesce(p_config->>'mode','') not in ('automatic','manual','milestones') or jsonb_typeof(p_config->'mappings') is distinct from 'array' or jsonb_typeof(p_config->'fields') is distinct from 'array'
   or jsonb_array_length(p_config->'mappings') not between 1 and 24 then raise exception 'Invalid configuration' using errcode='22023'; end if;
 select array_agg(x->>'source') into keys from jsonb_array_elements(p_config->'mappings') x;
 select array_agg(x) into chosen from jsonb_array_elements_text(p_config->'fields') x;
 if keys is null or not keys <@ private.airtable_field_keys() or chosen is null or not chosen <@ keys or not 'claim_ref'=any(chosen)
   or cardinality(keys)<>(select count(distinct x) from unnest(keys) x)
   or (select count(distinct x->>'fieldId') from jsonb_array_elements(p_config->'mappings') x)<>cardinality(keys)
 then raise exception 'Invalid fields' using errcode='22023'; end if;
 for m in select * from jsonb_array_elements(p_config->'mappings') loop
  if coalesce(m->>'fieldId','') !~ '^fld[a-zA-Z0-9]{14,32}$' or coalesce(m->>'fieldType','') not in ('singleLineText','multilineText','email','phoneNumber','date','dateTime','number','currency','singleSelect')
   or private.airtable_field_type_allowed(m->>'source',m->>'fieldType') is not true
  then raise exception 'Invalid mapping' using errcode='22023'; end if;
 end loop;
 v_enabled:=coalesce((p_config->>'enabled')::boolean,false);
 if v_enabled and c.needs_reconnect then raise exception 'Reconnect first' using errcode='22023'; end if;
 -- In-flight writes retain their destination. Do not relabel a connection underneath one.
 if exists(select 1 from public.airtable_delivery_requests where connection_id=c.id and status in ('sending','uncertain')) then raise exception 'Resolve pending delivery first' using errcode='55000'; end if;
 update public.airtable_connections set base_id=p_config->>'baseId',table_id=p_config->>'tableId',mappings=p_config->'mappings',
   default_fields=chosen,default_mode=p_config->>'mode',enabled=v_enabled,config_revision=config_revision+1,updated_at=now()
   where id=c.id returning * into c;
 update public.airtable_claim_links set enabled=false where connection_id=c.id;
 update public.airtable_delivery_requests set status='review_required',last_error='CONFIGURATION_CHANGED'
   where connection_id=c.id and status in ('pending','held');
 insert into public.audit_log(actor_id,action,entity,entity_id,meta) values(auth.uid(),'airtable.configure','airtable_connections',c.id,jsonb_build_object('revision',c.config_revision));
 return to_jsonb(c);
end; $$;

create function public.configure_airtable_claim(p_claim_id uuid,p_expected_revision bigint,p_record_id text,p_override jsonb,p_enabled boolean) returns jsonb
language plpgsql security definer set search_path='' as $$
declare l public.airtable_claim_links%rowtype; c public.airtable_connections%rowtype; company uuid; selected text[]; mode text; allowed text[]; baseline jsonb;
begin
 if not private.can_manage_claim(p_claim_id) then raise exception 'Not available' using errcode='42501'; end if;
 select partner_company_id into company from public.claims where id=p_claim_id for update;
 if not private.can_manage_claim(p_claim_id) then raise exception 'Not available' using errcode='42501'; end if;
 if company is null then raise exception 'No referring company' using errcode='22023'; end if;
 select * into c from public.airtable_connections where company_id=company;
 if not found or not c.enabled or c.needs_reconnect then raise exception 'Connection unavailable' using errcode='22023'; end if;
 select * into l from public.airtable_claim_links where claim_id=p_claim_id for update;
 if coalesce(l.revision,0) is distinct from p_expected_revision then raise exception 'Reload the claim' using errcode='40001'; end if;
 if exists(select 1 from public.airtable_delivery_requests where claim_id=p_claim_id and status in ('sending','uncertain')) then raise exception 'Resolve pending delivery first' using errcode='55000'; end if;
 if coalesce(p_record_id,'') !~ '^rec[a-zA-Z0-9]{14,32}$' or p_enabled is null or jsonb_typeof(p_override) is distinct from 'object' then raise exception 'Invalid record' using errcode='22023'; end if;
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

create function public.post_airtable_message(p_claim_id uuid,p_body text,p_request_id uuid) returns uuid
language plpgsql security definer set search_path='' as $$
declare l public.airtable_claim_links%rowtype; existing public.airtable_shared_messages%rowtype; mid uuid;
begin
 if not private.can_manage_claim(p_claim_id) then raise exception 'Not available' using errcode='42501'; end if;
 perform 1 from public.claims where id=p_claim_id for update;
 if not private.can_manage_claim(p_claim_id) then raise exception 'Not available' using errcode='42501'; end if;
 select * into l from public.airtable_claim_links where claim_id=p_claim_id for update;
 if not found or not l.enabled then raise exception 'Sharing is paused' using errcode='22023'; end if;
 select * into existing from public.airtable_shared_messages where request_id=p_request_id;
 if found then
  if existing.claim_id<>p_claim_id or existing.body<>btrim(p_body) or existing.author_id<>auth.uid() then raise exception 'Request already used' using errcode='22023'; end if;
  return existing.id;
 end if;
 insert into public.airtable_shared_messages(claim_id,connection_id,body,author_id,request_id)
 values(p_claim_id,l.connection_id,btrim(p_body),auth.uid(),p_request_id) returning id into mid;
 insert into public.audit_log(actor_id,action,entity,entity_id) values(auth.uid(),'airtable.message','claims',p_claim_id);
 return mid;
end; $$;

create function public.approve_airtable_update(p_request_id uuid,p_digest text) returns void
language plpgsql security definer set search_path='' as $$
declare r public.airtable_delivery_requests%rowtype; l public.airtable_claim_links%rowtype; c public.airtable_connections%rowtype;
begin
 select * into r from public.airtable_delivery_requests where id=p_request_id;
 if not found or not private.can_manage_claim(r.claim_id) then raise exception 'Not available' using errcode='42501'; end if;
 perform 1 from public.claims where id=r.claim_id for update;
 if not private.can_manage_claim(r.claim_id) then raise exception 'Not available' using errcode='42501'; end if;
 select * into l from public.airtable_claim_links where claim_id=r.claim_id for update;
 select * into c from public.airtable_connections where id=l.connection_id;
 select * into r from public.airtable_delivery_requests where id=p_request_id for update;
 if r.status<>'held' or r.digest is distinct from p_digest or not l.enabled or not c.enabled or c.needs_reconnect
  or (l.review_required and not coalesce(l.fields_override,c.default_fields)<@r.selected_fields)
  or r.source_revision<>l.source_revision or r.link_revision<>l.revision or r.config_revision<>c.config_revision
  or not exists(select 1 from public.claims where id=r.claim_id and partner_company_id=l.company_id)
 then raise exception 'Review the current update' using errcode='40001'; end if;
 update public.airtable_delivery_requests set status='pending',reviewed=true,authorized_by=auth.uid(),next_attempt_at=now() where id=r.id;
 update public.airtable_claim_links set review_required=false where claim_id=r.claim_id;
 insert into public.audit_log(actor_id,action,entity,entity_id) values(auth.uid(),'airtable.approve','airtable_delivery_requests',r.id);
end; $$;

create function public.retry_airtable_update(p_request_id uuid,p_digest text) returns void
language plpgsql security definer set search_path='' as $$
declare r public.airtable_delivery_requests%rowtype;
begin
 select * into r from public.airtable_delivery_requests where id=p_request_id;
 if not found or not private.can_manage_claim(r.claim_id) then raise exception 'Not available' using errcode='42501'; end if;
 perform 1 from public.claims where id=r.claim_id for update;
 if not private.can_manage_claim(r.claim_id) then raise exception 'Not available' using errcode='42501'; end if;
 select * into r from public.airtable_delivery_requests where id=p_request_id for update;
 if r.digest is distinct from p_digest or r.status not in ('pending','uncertain') then raise exception 'Review required' using errcode='22023'; end if;
 update public.airtable_delivery_requests set next_attempt_at=now() where id=r.id;
end; $$;
revoke all on function public.configure_airtable_company(uuid,bigint,jsonb),public.configure_airtable_claim(uuid,bigint,text,jsonb,boolean),public.post_airtable_message(uuid,text,uuid),public.approve_airtable_update(uuid,text),public.retry_airtable_update(uuid,text) from public,anon;
grant execute on function public.configure_airtable_company(uuid,bigint,jsonb),public.configure_airtable_claim(uuid,bigint,text,jsonb,boolean),public.post_airtable_message(uuid,text,uuid),public.approve_airtable_update(uuid,text),public.retry_airtable_update(uuid,text) to authenticated;

create function public.preview_airtable_update(p_claim_id uuid) returns void
language plpgsql security definer set search_path='' as $$
begin
 if not private.can_manage_claim(p_claim_id) or not exists(select 1 from public.claims where id=p_claim_id) then raise exception 'Not available' using errcode='42501'; end if;
 perform 1 from public.claims where id=p_claim_id for update;
 if not private.can_manage_claim(p_claim_id) then raise exception 'Not available' using errcode='42501'; end if;
 perform private.capture_airtable_update(p_claim_id,true);
end; $$;
revoke all on function public.preview_airtable_update(uuid) from public,anon;
grant execute on function public.preview_airtable_update(uuid) to authenticated;
