create function public.claim_airtable_batch(p_limit integer default 5,p_claim_id uuid default null) returns jsonb
language plpgsql security definer set search_path='' as $$
declare r public.airtable_delivery_requests%rowtype; result jsonb:='[]'; token uuid; was_uncertain boolean;
begin
 if not private.is_service_context() then raise exception 'Not available' using errcode='42501'; end if;
 update public.airtable_delivery_requests set status='uncertain',last_error='LEASE_EXPIRED'
  where status='sending' and lease_until<now();
 for r in select q.* from public.airtable_delivery_requests q
  where q.status in ('pending','uncertain') and q.next_attempt_at<=now() and (q.lease_until is null or q.lease_until<now())
   and (p_claim_id is null or q.claim_id=p_claim_id)
   and not exists(select 1 from public.airtable_delivery_requests prior where prior.base_id=q.base_id and prior.table_id=q.table_id and prior.record_id=q.record_id
     and prior.id<>q.id and (prior.status='sending' or (prior.status='uncertain' and
       (q.status='pending' or (prior.created_at,prior.id)<(q.created_at,q.id)))))
  order by q.created_at,q.id for update skip locked limit least(greatest(p_limit,1),10)
 loop
  -- An advisory transaction lock prevents two batch callers choosing the same external row.
  if not pg_try_advisory_xact_lock(hashtextextended(r.base_id||r.table_id||r.record_id,0)) then continue; end if;
  if exists(select 1 from public.airtable_delivery_requests x where x.base_id=r.base_id and x.table_id=r.table_id and x.record_id=r.record_id and x.id<>r.id
    and (x.status='sending' or (x.status='uncertain' and
      (r.status='pending' or (x.created_at,x.id)<(r.created_at,r.id))))) then continue; end if;
  token:=gen_random_uuid(); was_uncertain:=r.status='uncertain';
  update public.airtable_delivery_requests set status='sending',lease_token=token,lease_until=now()+interval '120 seconds',attempts=attempts+1 where id=r.id;
  result:=result||jsonb_build_array(jsonb_build_object('id',r.id,'leaseToken',token,'uncertain',was_uncertain));
 end loop;
 return result;
end; $$;

create function public.airtable_request_ready(p_request_id uuid,p_lease_token uuid,p_reconcile boolean default false) returns jsonb
language plpgsql security definer set search_path='' as $$
declare r public.airtable_delivery_requests%rowtype; l public.airtable_claim_links%rowtype; c public.airtable_connections%rowtype;
begin
 if not private.is_service_context() then raise exception 'Not available' using errcode='42501'; end if;
 select * into r from public.airtable_delivery_requests where id=p_request_id;
 if not found or r.status<>'sending' or r.lease_token is distinct from p_lease_token or r.lease_until<=now() then return null; end if;
 select * into l from public.airtable_claim_links where claim_id=r.claim_id;
 select * into c from public.airtable_connections where id=r.connection_id;
 if not l.enabled or not c.enabled or c.needs_reconnect or l.connection_id<>r.connection_id or l.record_id<>r.record_id
  or l.base_id<>r.base_id or l.table_id<>r.table_id or c.base_id<>r.base_id or c.table_id<>r.table_id
  or l.revision<>r.link_revision or c.config_revision<>r.config_revision or l.config_revision<>c.config_revision
  or (not p_reconcile and l.source_revision<>r.source_revision)
  or (not p_reconcile and l.review_required)
  or (not p_reconcile and exists(select 1 from unnest(r.selected_fields) k where
    coalesce(private.airtable_source(r.claim_id,r.connection_id)->k,'null'::jsonb) is distinct from coalesce(r.source_values->k,'null'::jsonb)))
  or (not p_reconcile and not private.airtable_actor_allowed(r.authorized_by,r.claim_id))
  or not private.airtable_actor_allowed(l.authorized_by,r.claim_id)
  or not exists(select 1 from public.claims x join public.partner_companies pc on pc.id=x.partner_company_id
    where x.id=r.claim_id and x.partner_company_id=l.company_id and pc.status='active')
 then return null; end if;
 return jsonb_build_object('request',to_jsonb(r),'connection',to_jsonb(c),'lastValues',l.last_values);
end; $$;

create function public.settle_airtable_request(p_request_id uuid,p_lease_token uuid,p_outcome text,p_values jsonb default '{}',p_error text default null) returns boolean
language plpgsql security definer set search_path='' as $$
declare r public.airtable_delivery_requests%rowtype; next_status text;
begin
 if not private.is_service_context() then raise exception 'Not available' using errcode='42501'; end if;
 select * into r from public.airtable_delivery_requests where id=p_request_id;
 if not found then return false; end if;
 -- Source capture and manual review use this same claim/link/request order.
 perform 1 from public.claims where id=r.claim_id for update;
 perform 1 from public.airtable_claim_links where claim_id=r.claim_id for update;
 select * into r from public.airtable_delivery_requests where id=p_request_id for update;
 if not found or r.status<>'sending' or r.lease_token is distinct from p_lease_token then return false; end if;
 if p_outcome not in ('sent','retry','uncertain','review_required','superseded') then raise exception 'Invalid result' using errcode='22023'; end if;
 next_status:=case when p_outcome='retry' and r.attempts<5 then 'pending' when p_outcome='retry' then 'review_required' else p_outcome end;
 update public.airtable_delivery_requests set status=next_status,lease_token=null,lease_until=null,
  last_error=left(p_error,80),next_attempt_at=now()+interval '60 seconds',sent_at=case when p_outcome='sent' then now() else null end where id=r.id;
 if next_status='review_required' then
  update public.airtable_claim_links set review_required=true where claim_id=r.claim_id;
  update public.airtable_delivery_requests set status='review_required',last_error='REVIEW_BARRIER'
   where claim_id=r.claim_id and status in ('pending','held');
 end if;
 if p_outcome='sent' then
  update public.airtable_claim_links set last_values=last_values||p_values where claim_id=r.claim_id and revision=r.link_revision and connection_id=r.connection_id;
  insert into public.audit_log(actor_id,action,entity,entity_id,meta) values(r.authorized_by,'airtable.sent','claims',r.claim_id,jsonb_build_object('request_id',r.id));
 end if;
 return true;
end; $$;

create function public.reserve_airtable_rate_slot(p_base_id text) returns integer
language plpgsql security definer set search_path='' as $$
declare available timestamptz; delay integer;
begin
 if not private.is_service_context() or p_base_id !~ '^app[a-zA-Z0-9]{14,32}$' then raise exception 'Not available' using errcode='42501'; end if;
 insert into public.airtable_rate_slots(base_id,next_request_at) values(p_base_id,now()) on conflict do nothing;
 select next_request_at into available from public.airtable_rate_slots where base_id=p_base_id for update;
 delay:=greatest(0,ceil(extract(epoch from (available-now()))*1000)::integer);
 if delay>5000 then return -1; end if;
 update public.airtable_rate_slots set next_request_at=greatest(now(),available)+interval '300 milliseconds' where base_id=p_base_id;
 return delay;
end; $$;

revoke all on function public.claim_airtable_batch(integer,uuid),public.airtable_request_ready(uuid,uuid,boolean),public.settle_airtable_request(uuid,uuid,text,jsonb,text),public.reserve_airtable_rate_slot(text) from public,anon,authenticated;
grant execute on function public.claim_airtable_batch(integer,uuid),public.airtable_request_ready(uuid,uuid,boolean),public.settle_airtable_request(uuid,uuid,text,jsonb,text),public.reserve_airtable_rate_slot(text) to service_role;
