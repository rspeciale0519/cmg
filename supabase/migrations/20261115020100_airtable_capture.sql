create function private.airtable_source(p_claim uuid,p_connection uuid) returns jsonb
language sql stable security definer set search_path='' as $$
select jsonb_strip_nulls(jsonb_build_object(
 'claim_ref',c.claim_ref,'status',c.status::text,'lor_signed_at',c.lor_signed_at,'filed_at',c.filed_at,
 'denied_at',c.denied_at,'settled_at',c.settled_at,'homeowner_name',nullif(concat_ws(' ',cl.first_name,cl.last_name),''),
 'homeowner_email',cl.email,'homeowner_phone',cl.phone,
 'property_address',concat_ws(', ',c.property_street,nullif(c.property_street2,''),c.property_city,c.property_state,c.property_zip),
 'carrier',c.carrier,'claim_number',c.claim_number,'loss_date',c.loss_date,'cause',c.cause::text,
 'adjuster_name',nullif(concat_ws(' ',p.first_name,p.last_name),''),'adjuster_email',u.email,
 'settlement_amount',case when c.status in ('settled','closed') then f.settlement_amount else null end,
 'law_firm_name',case when h.milestone in ('accepted','lawsuit_filed') then h.firm_snapshot->>'name' end,
 'law_firm_email',case when h.milestone in ('accepted','lawsuit_filed') then h.firm_snapshot->>'email' end,
 'law_firm_phone',case when h.milestone in ('accepted','lawsuit_filed') then h.firm_snapshot->>'phone' end,
 'legal_milestone',h.milestone,'legal_date',lm.occurred_on,
 'messages',(select string_agg(to_char(m.created_at at time zone 'UTC','YYYY-MM-DD HH24:MI')||' UTC'||E'\n'||m.body,E'\n\n' order by m.created_at,m.id)
   from public.airtable_shared_messages m where m.claim_id=c.id and m.connection_id=p_connection)
)) from public.claims c
left join lateral (select * from public.claimants x where x.claim_id=c.id and x.is_primary order by x.id limit 1) cl on true
left join public.profiles p on p.id=c.assigned_adjuster_id
left join auth.users u on u.id=p.id
left join public.claim_financials f on f.claim_id=c.id
left join lateral (select * from public.claim_legal_handoffs x where x.claim_id=c.id order by x.created_at desc,x.id limit 1) h on true
left join lateral (select * from public.claim_legal_milestones x where x.handoff_id=h.id order by x.recorded_at desc,x.id limit 1) lm on true
where c.id=p_claim;
$$;

create function private.capture_airtable_update(p_claim uuid,p_force_review boolean default false) returns void
language plpgsql security definer set search_path='' as $$
declare l public.airtable_claim_links%rowtype; c public.airtable_connections%rowtype; s jsonb; chosen text[];
 auto_keys text[]; held_keys text[]; selected text[]; changed text[]; mode text; vstatus text; payload jsonb;
begin
 select * into l from public.airtable_claim_links where claim_id=p_claim for update;
 if not found then return; end if;
 select * into c from public.airtable_connections where id=l.connection_id;
 if not l.enabled or not c.enabled or c.needs_reconnect or l.config_revision<>c.config_revision
   or not exists(select 1 from public.claims x join public.partner_companies pc on pc.id=x.partner_company_id
     where x.id=p_claim and x.partner_company_id=l.company_id and pc.status='active')
   or not private.airtable_actor_allowed(l.authorized_by,p_claim) then
   update public.airtable_delivery_requests set status='review_required',last_error='CONFIGURATION_CHANGED'
    where claim_id=p_claim and status in ('pending','held'); return;
 end if;
 s:=private.airtable_source(p_claim,c.id); chosen:=coalesce(l.fields_override,c.default_fields);
 select coalesce(array_agg(k),'{}') into changed from unnest(chosen) k where (s->k) is distinct from (l.last_source->k);
 if cardinality(changed)=0 and not p_force_review then return; end if;
 p_force_review:=p_force_review or l.review_required;
 if p_force_review then changed:=chosen; end if;
 -- A change in one partition must not discard another partition's unsent work.
 select array_agg(distinct key) into changed from (
   select unnest(changed) as key union all
   select unnest(q.selected_fields) from public.airtable_delivery_requests q
    where q.claim_id=p_claim and q.status in ('pending','held','sending','uncertain','review_required')
 ) carried;
 -- Missing values never silently clear an already shared value.
 if exists(select 1 from unnest(changed) k where s->k is null and l.last_source->k is not null) then p_force_review:=true; end if;
 update public.airtable_claim_links set source_revision=source_revision+1,last_source=s,review_required=review_required or p_force_review,updated_at=now()
  where claim_id=p_claim returning source_revision into l.source_revision;
 -- Never replace an in-flight or ambiguous request. It must reconcile first.
 update public.airtable_delivery_requests set status='superseded' where claim_id=p_claim and status in ('pending','held','review_required');
 mode:=coalesce(l.mode_override,c.default_mode);
 select coalesce(array_agg(k),'{}') into auto_keys from unnest(chosen) k
  where mode='automatic' or (mode='milestones' and k=any(private.airtable_milestone_keys()));
 if p_force_review then auto_keys:='{}'; end if;
 select coalesce(array_agg(k),'{}') into held_keys from unnest(chosen) k where not k=any(auto_keys);
 foreach vstatus in array array['pending','held'] loop
  selected:=case when vstatus='pending' then auto_keys else held_keys end;
  if cardinality(selected)=0 or not (selected && changed) then continue; end if;
  if not 'claim_ref'=any(selected) then selected:=array_prepend('claim_ref',selected); end if;
  select coalesce(jsonb_object_agg(k,coalesce(s->k,'null'::jsonb)),'{}') into payload from unnest(selected) k;
  insert into public.airtable_delivery_requests(claim_id,connection_id,record_id,base_id,table_id,source_revision,config_revision,link_revision,
    selected_fields,source_values,expected_values,digest,authorized_by,status)
  values(p_claim,c.id,l.record_id,c.base_id,c.table_id,l.source_revision,c.config_revision,l.revision,selected,payload,l.last_values,
    encode(extensions.digest(payload::text||selected::text||l.source_revision::text||c.config_revision::text||l.revision::text,'sha256'),'hex'),l.authorized_by,vstatus);
 end loop;
end; $$;

create function private.airtable_source_changed() returns trigger language plpgsql security definer set search_path='' as $$
declare cid uuid;
begin
 if tg_table_name='claims' then cid:=coalesce(new.id,old.id); else cid:=coalesce(new.claim_id,old.claim_id); end if;
 perform private.capture_airtable_update(cid); return coalesce(new,old);
end; $$;
create trigger airtable_claim_changed after update on public.claims for each row execute function private.airtable_source_changed();
create trigger airtable_claimant_changed after insert or update or delete on public.claimants for each row execute function private.airtable_source_changed();
create trigger airtable_financial_changed after insert or update or delete on public.claim_financials for each row execute function private.airtable_source_changed();
create trigger airtable_legal_changed after insert on public.claim_legal_milestones for each row execute function private.airtable_source_changed();
create trigger airtable_handoff_changed after update on public.claim_legal_handoffs for each row execute function private.airtable_source_changed();
create trigger airtable_message_changed after insert on public.airtable_shared_messages for each row execute function private.airtable_source_changed();
revoke all on function private.airtable_source(uuid,uuid),private.capture_airtable_update(uuid,boolean),private.airtable_source_changed() from public,anon,authenticated;

create function private.airtable_adjuster_changed() returns trigger language plpgsql security definer set search_path='' as $$
declare cid uuid;
begin
 for cid in select c.id from public.claims c where c.assigned_adjuster_id=new.id order by c.id loop
  perform private.capture_airtable_update(cid);
 end loop;
 return new;
end; $$;
create trigger airtable_adjuster_profile_changed after update of first_name,last_name,is_active,role on public.profiles for each row execute function private.airtable_adjuster_changed();
create trigger airtable_adjuster_email_changed after update of email on auth.users for each row execute function private.airtable_adjuster_changed();
revoke all on function private.airtable_adjuster_changed() from public,anon,authenticated;
