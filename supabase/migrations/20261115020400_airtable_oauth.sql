create function public.begin_airtable_oauth(p_company_id uuid,p_state_hash text,p_ciphertext text) returns void
language plpgsql security definer set search_path='' as $$
begin
 if not private.is_owner() or not exists(select 1 from public.partner_companies where id=p_company_id and status='active') then raise exception 'Not available' using errcode='42501'; end if;
 if p_state_hash !~ '^[a-f0-9]{64}$' or length(p_ciphertext)>6000 then raise exception 'Invalid state' using errcode='22023'; end if;
 insert into public.airtable_oauth_states(state_hash,owner_id,company_id,ciphertext,expires_at) values(p_state_hash,auth.uid(),p_company_id,p_ciphertext,now()+interval '10 minutes');
end; $$;
create function public.consume_airtable_oauth(p_state_hash text) returns jsonb
language plpgsql security definer set search_path='' as $$
declare s public.airtable_oauth_states%rowtype;
begin
 if not private.is_owner() then raise exception 'Not available' using errcode='42501'; end if;
 update public.airtable_oauth_states set consumed_at=now() where state_hash=p_state_hash and owner_id=auth.uid() and consumed_at is null and expires_at>now() returning * into s;
 if not found then return null; end if;
 return jsonb_build_object('companyId',s.company_id,'ciphertext',s.ciphertext);
end; $$;
create function public.store_airtable_tokens(p_company_id uuid,p_ciphertext text,p_expires_at timestamptz) returns uuid
language plpgsql security definer set search_path='' as $$
declare cid uuid;
begin
 if not private.is_service_context() or not exists(select 1 from public.partner_companies where id=p_company_id and status='active') then raise exception 'Not available' using errcode='42501'; end if;
 if length(p_ciphertext)>16000 or p_expires_at<=now() then raise exception 'Invalid tokens' using errcode='22023'; end if;
 select id into cid from public.airtable_connections where company_id=p_company_id;
 if cid is not null then
  -- Refresh takes the credential lock before it can pause the connection.
  perform 1 from public.airtable_credentials where connection_id=cid for update;
 end if;
 insert into public.airtable_connections(company_id,needs_reconnect) values(p_company_id,false)
 -- Renew credentials without changing the reviewed destination or ambiguous work.
 on conflict(company_id) do update set needs_reconnect=false,updated_at=now()
 returning id into cid;
 insert into public.airtable_credentials(connection_id,ciphertext,expires_at) values(cid,p_ciphertext,p_expires_at)
 on conflict(connection_id) do update set ciphertext=excluded.ciphertext,expires_at=excluded.expires_at,token_version=public.airtable_credentials.token_version+1,refresh_lease=null,refresh_started_at=null;
 return cid;
end; $$;
create function public.claim_airtable_refresh(p_connection_id uuid) returns jsonb
language plpgsql security definer set search_path='' as $$
declare c public.airtable_credentials%rowtype; token uuid;
begin
 if not private.is_service_context() then raise exception 'Not available' using errcode='42501'; end if;
 select * into c from public.airtable_credentials where connection_id=p_connection_id for update;
 if not found or exists(select 1 from public.airtable_connections where id=p_connection_id and needs_reconnect) then return null; end if;
 if c.refresh_lease is not null then
  if c.refresh_started_at<now()-interval '90 seconds' then update public.airtable_connections set needs_reconnect=true where id=p_connection_id; end if;
  return null;
 end if;
 if c.expires_at>now()+interval '2 minutes' then return jsonb_build_object('ciphertext',c.ciphertext,'refresh',false); end if;
 token:=gen_random_uuid(); update public.airtable_credentials set refresh_lease=token,refresh_started_at=now() where connection_id=p_connection_id;
 return jsonb_build_object('ciphertext',c.ciphertext,'refresh',true,'leaseToken',token,'version',c.token_version);
end; $$;
create function public.settle_airtable_refresh(p_connection_id uuid,p_lease_token uuid,p_version bigint,p_ciphertext text,p_expires_at timestamptz,p_ok boolean) returns boolean
language plpgsql security definer set search_path='' as $$
declare n integer;
begin
 if not private.is_service_context() then raise exception 'Not available' using errcode='42501'; end if;
 if p_ok then
  update public.airtable_credentials set ciphertext=p_ciphertext,expires_at=p_expires_at,token_version=token_version+1,refresh_lease=null,refresh_started_at=null
   where connection_id=p_connection_id and refresh_lease=p_lease_token and token_version=p_version;
  get diagnostics n=row_count; return n=1;
 end if;
 perform 1 from public.airtable_credentials where connection_id=p_connection_id and refresh_lease=p_lease_token and token_version=p_version for update;
 if found then
  update public.airtable_connections set needs_reconnect=true where id=p_connection_id; return true;
 end if; return false;
end; $$;
revoke all on function public.begin_airtable_oauth(uuid,text,text),public.consume_airtable_oauth(text) from public,anon;
grant execute on function public.begin_airtable_oauth(uuid,text,text),public.consume_airtable_oauth(text) to authenticated;
revoke all on function public.store_airtable_tokens(uuid,text,timestamptz),public.claim_airtable_refresh(uuid),public.settle_airtable_refresh(uuid,uuid,bigint,text,timestamptz,boolean) from public,anon,authenticated;
grant execute on function public.store_airtable_tokens(uuid,text,timestamptz),public.claim_airtable_refresh(uuid),public.settle_airtable_refresh(uuid,uuid,bigint,text,timestamptz,boolean) to service_role;
