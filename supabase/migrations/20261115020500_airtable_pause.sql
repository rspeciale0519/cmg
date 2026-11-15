create function public.set_airtable_company_paused(p_company_id uuid,p_paused boolean) returns void
language plpgsql security definer set search_path='' as $$
declare c public.airtable_connections%rowtype;
begin
 if not private.is_owner() then raise exception 'Not available' using errcode='42501'; end if;
 select * into c from public.airtable_connections where company_id=p_company_id for update;
 if not found or not private.is_owner() then raise exception 'Not available' using errcode='42501'; end if;
 if p_paused is null then raise exception 'Invalid setting' using errcode='22023'; end if;
 if not p_paused and (c.needs_reconnect or c.base_id is null or c.table_id is null or jsonb_array_length(c.mappings)=0
   or not exists(select 1 from public.partner_companies where id=p_company_id and status='active')) then
   raise exception 'Reconnect and review settings first' using errcode='22023';
 end if;
 update public.airtable_connections set enabled=not p_paused,updated_at=now() where id=c.id;
 if not p_paused then
  update public.airtable_claim_links set review_required=true,authorized_by=auth.uid() where connection_id=c.id;
  update public.airtable_delivery_requests set status='review_required',last_error='RESUMED_REVIEW_REQUIRED'
   where connection_id=c.id and status in ('pending','held');
 end if;
 insert into public.audit_log(actor_id,action,entity,entity_id) values(auth.uid(),case when p_paused then 'airtable.pause' else 'airtable.resume' end,'airtable_connections',c.id);
end; $$;

create function public.set_airtable_claim_paused(p_claim_id uuid,p_paused boolean) returns void
language plpgsql security definer set search_path='' as $$
declare l public.airtable_claim_links%rowtype; c public.airtable_connections%rowtype;
begin
 if not private.can_manage_claim(p_claim_id) then raise exception 'Not available' using errcode='42501'; end if;
 perform 1 from public.claims where id=p_claim_id for update;
 if not private.can_manage_claim(p_claim_id) then raise exception 'Not available' using errcode='42501'; end if;
 select * into l from public.airtable_claim_links where claim_id=p_claim_id for update;
 if not found then raise exception 'Not available' using errcode='42501'; end if;
 if p_paused is null then raise exception 'Invalid setting' using errcode='22023'; end if;
 select * into c from public.airtable_connections where id=l.connection_id;
 if not p_paused and (not c.enabled or c.needs_reconnect or l.config_revision<>c.config_revision
   or not exists(select 1 from public.claims x join public.partner_companies pc on pc.id=x.partner_company_id
    where x.id=p_claim_id and x.partner_company_id=l.company_id and pc.status='active')) then
   raise exception 'Review the company connection first' using errcode='22023';
 end if;
 update public.airtable_claim_links set enabled=not p_paused,review_required=review_required or not p_paused,
   authorized_by=case when p_paused then authorized_by else auth.uid() end,updated_at=now() where claim_id=p_claim_id;
 if not p_paused then
  update public.airtable_delivery_requests set status='review_required',last_error='RESUMED_REVIEW_REQUIRED'
   where claim_id=p_claim_id and status in ('pending','held');
 end if;
 insert into public.audit_log(actor_id,action,entity,entity_id) values(auth.uid(),case when p_paused then 'airtable.pause' else 'airtable.resume' end,'claims',p_claim_id);
end; $$;
revoke all on function public.set_airtable_company_paused(uuid,boolean),public.set_airtable_claim_paused(uuid,boolean) from public,anon;
grant execute on function public.set_airtable_company_paused(uuid,boolean),public.set_airtable_claim_paused(uuid,boolean) to authenticated;
