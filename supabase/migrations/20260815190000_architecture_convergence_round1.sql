-- Stage 2 architecture convergence: atomic submission/acceptance boundaries and
-- server-owned capability/deduplication columns.
set check_function_bodies = off;

create or replace function public.protect_external_event_keys()
returns trigger language plpgsql set search_path = '' as $fn$
begin
  if current_user <> 'service_role'
     and new.external_event_key is distinct from old.external_event_key then
    raise exception 'external event keys are server-managed' using errcode = '42501';
  end if;
  return new;
end;
$fn$;

create or replace function public.protect_external_event_key_insert()
returns trigger language plpgsql set search_path = '' as $fn$
begin
  if current_user <> 'service_role' and new.external_event_key is not null then
    raise exception 'external event keys are server-managed' using errcode = '42501';
  end if;
  return new;
end;
$fn$;

drop trigger if exists claim_events_protect_external_key_insert on public.claim_events;
create trigger claim_events_protect_external_key_insert before insert on public.claim_events
for each row execute function public.protect_external_event_key_insert();
drop trigger if exists claim_events_protect_external_key_update on public.claim_events;
create trigger claim_events_protect_external_key_update before update on public.claim_events
for each row execute function public.protect_external_event_keys();
drop trigger if exists documents_protect_external_key_insert on public.documents;
create trigger documents_protect_external_key_insert before insert on public.documents
for each row execute function public.protect_external_event_key_insert();
drop trigger if exists documents_protect_external_key_update on public.documents;
create trigger documents_protect_external_key_update before update on public.documents
for each row execute function public.protect_external_event_keys();
revoke all on function public.protect_external_event_keys() from public, anon, authenticated;
revoke all on function public.protect_external_event_key_insert() from public, anon, authenticated;

-- Table-level SELECT would expose the dispatch bearer tokens despite RLS.
revoke select on public.claims from authenticated;
grant select (
  id, claim_ref, status, property_street, property_street2, property_city,
  property_state, property_zip, carrier, policy_number, carrier_tenure,
  prior_roof_claim, prior_outcome, claim_number, loss_date, loss_time, cause,
  description, requested_adjuster, referrer_name, referrer_email,
  assigned_adjuster_id, partner_company_id, esign_status,
  pandadoc_document_id, lor_signed_at, filed_at, denied_at, settled_at,
  created_at, updated_at
) on public.claims to authenticated;

create or replace function public.enqueue_storage_cleanup_exact(
  p_bucket_id text, p_object_paths text[], p_claim_id uuid default null
) returns integer language plpgsql volatile security invoker set search_path = '' as $fn$
declare inserted_count integer;
begin
  if current_user <> 'service_role' then
    raise exception 'service role required' using errcode = '42501';
  end if;
  if p_bucket_id is null or btrim(p_bucket_id) = ''
     or exists (select 1 from unnest(p_object_paths) p where p is null or btrim(p) = '') then
    raise exception 'exact bucket and paths are required' using errcode = '22023';
  end if;
  insert into public.storage_cleanup_queue(bucket_id, object_path, claim_id, next_attempt_at)
  select p_bucket_id, p, p_claim_id, now() + interval '15 minutes' from unnest(p_object_paths) p
  on conflict (bucket_id, object_path) where processed_at is null and dead_at is null
  do update set claim_id=coalesce(excluded.claim_id,public.storage_cleanup_queue.claim_id);
  get diagnostics inserted_count = row_count;
  return inserted_count;
end;
$fn$;
revoke all on function public.enqueue_storage_cleanup_exact(text, text[], uuid)
from public, anon, authenticated;
grant execute on function public.enqueue_storage_cleanup_exact(text, text[], uuid) to service_role;

create unique index if not exists storage_cleanup_queue_pending_object_uidx
on public.storage_cleanup_queue(bucket_id,object_path)
where processed_at is null and dead_at is null;

create or replace function public.settle_storage_cleanup_intent()
returns trigger language plpgsql security definer set search_path='' as $fn$
declare intent public.storage_cleanup_queue%rowtype;
begin
  -- Lock the complete history, not only the currently pending row. Once a
  -- worker has claimed a path it is permanently burned: a later processed row
  -- must not make the same object name look safe again.
  perform 1 from public.storage_cleanup_queue
  where bucket_id='claim-docs' and object_path=new.storage_path
  order by id for update;
  if exists (
    select 1 from public.storage_cleanup_queue
    where bucket_id='claim-docs' and object_path=new.storage_path
      and (attempts>0 or dead_at is not null)
  ) then
    raise exception 'storage cleanup already claimed' using errcode='55000';
  end if;
  select * into intent from public.storage_cleanup_queue
  where bucket_id='claim-docs' and object_path=new.storage_path
    and processed_at is null and dead_at is null
  order by id desc limit 1;
  if found then
    update public.storage_cleanup_queue set processed_at=now(),last_error=null
    where id=intent.id;
  end if;
  return new;
end;
$fn$;
drop trigger if exists documents_settle_storage_cleanup_intent on public.documents;
create trigger documents_settle_storage_cleanup_intent before insert on public.documents
for each row execute function public.settle_storage_cleanup_intent();
revoke all on function public.settle_storage_cleanup_intent() from public,anon,authenticated;

create or replace function public.claim_storage_cleanup_batch(
  p_limit integer default 25,p_lease_seconds integer default 300,p_max_attempts integer default 5
) returns table(id bigint,bucket_id text,object_path text,attempts integer)
language plpgsql volatile security invoker set search_path='' as $fn$
declare v_limit integer:=greatest(coalesce(p_limit,25),0);
  v_max integer:=greatest(coalesce(p_max_attempts,5),1); v_terminal integer:=0;
begin
  update public.storage_cleanup_queue q set dead_at=now(),
    last_error='Cleanup worker lease expired during the final permitted attempt.'
  from (select c.id from public.storage_cleanup_queue c
    where c.processed_at is null and c.dead_at is null and c.attempts>=v_max
      and c.next_attempt_at<=now()
      and not exists(select 1 from public.documents d where c.bucket_id='claim-docs' and d.storage_path=c.object_path)
    order by c.next_attempt_at,c.enqueued_at,c.id limit v_limit for update skip locked) terminal
  where q.id=terminal.id;
  get diagnostics v_terminal=row_count;
  return query update public.storage_cleanup_queue q
  set attempts=q.attempts+1,next_attempt_at=now()+make_interval(secs=>greatest(coalesce(p_lease_seconds,300),1))
  from (select c.id from public.storage_cleanup_queue c
    where c.processed_at is null and c.dead_at is null and c.attempts<v_max
      and c.next_attempt_at<=now()
      and not exists(select 1 from public.documents d where c.bucket_id='claim-docs' and d.storage_path=c.object_path)
    order by c.next_attempt_at,c.enqueued_at,c.id limit greatest(v_limit-v_terminal,0)
    for update skip locked) due
  where q.id=due.id returning q.id,q.bucket_id,q.object_path,q.attempts;
end;
$fn$;
revoke all on function public.claim_storage_cleanup_batch(integer,integer,integer) from public,anon,authenticated;
grant execute on function public.claim_storage_cleanup_batch(integer,integer,integer) to service_role;

create or replace function public.submit_contact_transaction(
  p_lead jsonb, p_consent jsonb, p_outbox jsonb
) returns jsonb language plpgsql volatile security invoker set search_path = '' as $fn$
declare v_lead_id uuid; v_outbox_ids uuid[];
begin
  if current_user <> 'service_role' then raise exception 'service role required' using errcode='42501'; end if;
  insert into public.leads(name, phone, email, message, ip, user_agent)
  values (p_lead->>'name', p_lead->>'phone', p_lead->>'email', p_lead->>'message',
          nullif(p_lead->>'ip','')::inet, p_lead->>'user_agent') returning id into v_lead_id;
  if p_consent is not null and p_consent <> 'null'::jsonb then
    insert into public.consents(lead_id,email,phone,kind,consent_text,ip)
    values(v_lead_id,p_consent->>'email',p_consent->>'phone',
      (p_consent->>'kind')::public.consent_kind,p_consent->>'consent_text',
      nullif(p_consent->>'ip','')::inet);
  end if;
  with queued as (
    insert into public.notifications_outbox(recipient_email,template,payload,dedupe_key)
    select x.recipient_email,x.template,x.payload,x.dedupe_key
    from jsonb_to_recordset(p_outbox) x(recipient_email text,template text,payload jsonb,dedupe_key text)
    returning id
  ) select array_agg(id) into v_outbox_ids from queued;
  return jsonb_build_object('lead_id',v_lead_id,'outbox_ids',coalesce(to_jsonb(v_outbox_ids),'[]'::jsonb));
end;
$fn$;
revoke all on function public.submit_contact_transaction(jsonb,jsonb,jsonb) from public,anon,authenticated;
grant execute on function public.submit_contact_transaction(jsonb,jsonb,jsonb) to service_role;

create or replace function public.submit_claim_transaction(
  p_claim jsonb, p_claimants jsonb, p_consents jsonb, p_documents jsonb,
  p_outbox jsonb, p_partner_company_id uuid default null, p_audit jsonb default null
) returns jsonb language plpgsql volatile security invoker set search_path = '' as $fn$
declare v_claim public.claims%rowtype; v_outbox_ids uuid[];
begin
  if current_user <> 'service_role' then raise exception 'service role required' using errcode='42501'; end if;
  insert into public.claims(
    claim_ref,status,property_street,property_street2,property_city,property_state,
    property_zip,carrier,policy_number,carrier_tenure,prior_roof_claim,prior_outcome,
    claim_number,loss_date,loss_time,cause,description,requested_adjuster,
    referrer_name,referrer_email,partner_company_id)
  values('',coalesce((p_claim->>'status')::public.claim_status,'new_intake'),
    p_claim->>'property_street',p_claim->>'property_street2',p_claim->>'property_city',
    coalesce(p_claim->>'property_state','PA'),p_claim->>'property_zip',p_claim->>'carrier',
    p_claim->>'policy_number',nullif(p_claim->>'carrier_tenure','')::public.carrier_tenure,
    coalesce((p_claim->>'prior_roof_claim')::boolean,false),
    nullif(p_claim->>'prior_outcome','')::public.prior_claim_outcome,p_claim->>'claim_number',
    (p_claim->>'loss_date')::date,nullif(p_claim->>'loss_time','')::time,
    (p_claim->>'cause')::public.cause_of_loss,p_claim->>'description',
    p_claim->>'requested_adjuster',p_claim->>'referrer_name',p_claim->>'referrer_email',
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
revoke all on function public.submit_claim_transaction(jsonb,jsonb,jsonb,jsonb,jsonb,uuid,jsonb) from public,anon,authenticated;
grant execute on function public.submit_claim_transaction(jsonb,jsonb,jsonb,jsonb,jsonb,uuid,jsonb) to service_role;

create or replace function public.accept_intake_transaction(
  p_claim_id uuid,p_adjuster_id uuid,p_partner_choice text,p_partner_company_id uuid,
  p_new_partner_name text,p_carrier text,p_policy_number text,
  p_carrier_tenure public.carrier_tenure,p_note text,p_ip inet
) returns jsonb language plpgsql volatile security definer set search_path = '' as $fn$
declare v_claim public.claims%rowtype; v_partner_id uuid; v_actor uuid := auth.uid();
begin
  if private.current_app_role() <> 'owner' then raise exception 'owner required' using errcode='42501'; end if;
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
    carrier_tenure=coalesce(p_carrier_tenure,carrier_tenure),status='under_review'
  where id=p_claim_id;
  insert into public.claim_status_history(claim_id,from_status,to_status,note,changed_by)
  values(p_claim_id,'new_intake','under_review',p_note,v_actor);
  insert into public.claim_events(claim_id,type,body,author_id,visibility)
  values(p_claim_id,'status',coalesce(p_note,'Claim moved to Under review.'),v_actor,'customer');
  insert into public.audit_log(actor_id,action,entity,entity_id,meta,ip)
  values(v_actor,'claim.intake_accepted','claims',p_claim_id,
    jsonb_build_object('claim_ref',v_claim.claim_ref,'assigned_adjuster_id',p_adjuster_id,'partner_company_id',v_partner_id),p_ip);
  insert into public.notifications_outbox(recipient_email,template,payload,dedupe_key)
  select c.email,'claim_status_update',jsonb_build_object(
    'firstName',c.first_name,'claimRef',v_claim.claim_ref,'statusLabel','Under review',
    'statusMeaning','Assigned and being assessed before representation is offered.',
    'phase','Received','note',p_note,
    'portalUrl','https://www.cmgpropertysolutions.net/portal'),
    'intake-accepted-status:'||p_claim_id::text
  from public.claimants c where c.claim_id=p_claim_id and c.is_primary
  on conflict (dedupe_key) do nothing;
  return jsonb_build_object('claim_ref',v_claim.claim_ref,'partner_company_id',v_partner_id);
end;
$fn$;
revoke all on function public.accept_intake_transaction(uuid,uuid,text,uuid,text,text,text,public.carrier_tenure,text,inet) from public,anon;
grant execute on function public.accept_intake_transaction(uuid,uuid,text,uuid,text,text,text,public.carrier_tenure,text,inet) to authenticated;

-- A claimant link must never report success after matching no row.
create or replace function public.link_invited_claimant(p_claim_id uuid,p_email text,p_user_id uuid)
returns boolean language plpgsql volatile security invoker set search_path='' as $fn$
declare n integer;
begin
  if current_user <> 'service_role' then raise exception 'service role required' using errcode='42501'; end if;
  update public.claimants set user_id=p_user_id where claim_id=p_claim_id and lower(email)=lower(p_email) and (user_id is null or user_id=p_user_id);
  get diagnostics n=row_count; return n=1;
end;
$fn$;
revoke all on function public.link_invited_claimant(uuid,text,uuid) from public,anon,authenticated;
grant execute on function public.link_invited_claimant(uuid,text,uuid) to service_role;

alter table public.invites add column if not exists acceptance_attempt_id uuid;

create or replace function public.issue_invite_transaction(
  p_email text,p_role public.app_role,p_claim_id uuid,p_partner_company_id uuid,
  p_invited_by uuid,p_token_hash text,p_expires_at timestamptz,p_payload jsonb,p_ip inet
) returns jsonb language plpgsql volatile security invoker set search_path='' as $fn$
declare v_email text:=lower(btrim(p_email)); v_invite public.invites%rowtype; v_outbox uuid;
begin
  if current_user<>'service_role' then raise exception 'service role required' using errcode='42501'; end if;
  if v_email='' or (p_role='customer' and (p_claim_id is null or p_partner_company_id is not null))
    or (p_role='partner' and (p_partner_company_id is null or p_claim_id is not null))
    or (p_role in ('owner','adjuster','assistant') and (p_claim_id is not null or p_partner_company_id is not null)) then
    raise exception 'invalid invite target' using errcode='22023';
  end if;
  perform pg_advisory_xact_lock(hashtextextended(v_email||':'||p_role::text||':'||coalesce(p_claim_id::text,p_partner_company_id::text,''),0));
  -- Acceptance locks the invite row itself. Taking the same row lock before
  -- inspecting reservation state closes both interleavings: begin-first makes
  -- issuance wait and refuse; issuance-first expires the old row before begin
  -- can reserve it.
  perform 1 from public.invites where email=v_email and role=p_role
    and accepted_at is null and expires_at>now()
    and claim_id is not distinct from p_claim_id
    and partner_company_id is not distinct from p_partner_company_id
  order by id for update;
  if exists (
    select 1 from public.invites where email=v_email and role=p_role
      and accepted_at is null and acceptance_attempt_id is not null and expires_at>now()
      and claim_id is not distinct from p_claim_id
      and partner_company_id is not distinct from p_partner_company_id
  ) then
    raise exception 'invite acceptance is in progress' using errcode='55000';
  end if;
  update public.invites set expires_at=now() where email=v_email and role=p_role
    and accepted_at is null and acceptance_attempt_id is null and expires_at>now()
    and claim_id is not distinct from p_claim_id and partner_company_id is not distinct from p_partner_company_id;
  insert into public.invites(email,role,claim_id,partner_company_id,token_hash,expires_at,invited_by)
  values(v_email,p_role,p_claim_id,p_partner_company_id,p_token_hash,p_expires_at,p_invited_by) returning * into v_invite;
  insert into public.notifications_outbox(recipient_email,template,payload,dedupe_key)
  values(v_email,'invite',p_payload,'invite:'||v_invite.id::text) returning id into v_outbox;
  insert into public.audit_log(actor_id,action,entity,entity_id,meta,ip)
  values(p_invited_by,'invite.issued','invites',v_invite.id,jsonb_build_object(
    'email',v_email,'role',p_role,'claim_id',p_claim_id,'partner_company_id',p_partner_company_id,
    'token_hash',p_token_hash,'expires_at',p_expires_at),p_ip);
  return jsonb_build_object('invite_id',v_invite.id,'expires_at',v_invite.expires_at,'outbox_id',v_outbox);
end;
$fn$;
revoke all on function public.issue_invite_transaction(text,public.app_role,uuid,uuid,uuid,text,timestamptz,jsonb,inet) from public,anon,authenticated;
grant execute on function public.issue_invite_transaction(text,public.app_role,uuid,uuid,uuid,text,timestamptz,jsonb,inet) to service_role;

create or replace function public.begin_invite_acceptance(p_token_hash text,p_attempt_id uuid)
returns jsonb language plpgsql volatile security invoker set search_path='' as $fn$
declare v public.invites%rowtype;
begin
  if current_user<>'service_role' then raise exception 'service role required' using errcode='42501'; end if;
  select * into v from public.invites where token_hash=p_token_hash for update;
  if not found or v.accepted_at is not null or v.expires_at<=now() then return null; end if;
  if v.acceptance_attempt_id is null then
    update public.invites set acceptance_attempt_id=p_attempt_id where id=v.id returning * into v;
  end if;
  return jsonb_build_object('invite_id',v.id,'attempt_id',v.acceptance_attempt_id,'email',v.email,
    'role',v.role,'claim_id',v.claim_id,'partner_company_id',v.partner_company_id);
end;
$fn$;
revoke all on function public.begin_invite_acceptance(text,uuid) from public,anon,authenticated;
grant execute on function public.begin_invite_acceptance(text,uuid) to service_role;

create or replace function private.invite_account_marker(
  p_user_id uuid,p_email text,p_invite_id uuid,p_attempt_id uuid
) returns table(user_found boolean,marked boolean)
language sql stable security definer set search_path='' as $fn$
  select
    count(*)=1,
    coalesce(bool_or(
      (u.raw_app_meta_data->>'cmg_invite_id')=p_invite_id::text
      and (u.raw_app_meta_data->>'cmg_attempt_id')=p_attempt_id::text
    ),false)
  from auth.users u
  where u.id=p_user_id and lower(u.email)=lower(p_email);
$fn$;
revoke all on function private.invite_account_marker(uuid,text,uuid,uuid) from public,anon,authenticated;
grant execute on function private.invite_account_marker(uuid,text,uuid,uuid) to service_role;

create or replace function public.finalize_invite_acceptance(
  p_invite_id uuid,p_attempt_id uuid,p_user_id uuid,p_first_name text,p_last_name text,p_ip inet
) returns jsonb language plpgsql volatile security invoker set search_path='' as $fn$
declare v public.invites%rowtype; prof public.profiles%rowtype; n integer;
  user_found boolean:=false; marked boolean:=false; effective_role public.app_role;
begin
  if current_user<>'service_role' then raise exception 'service role required' using errcode='42501'; end if;
  select * into v from public.invites where id=p_invite_id for update;
  if not found or v.acceptance_attempt_id is distinct from p_attempt_id then raise exception 'acceptance mismatch' using errcode='42501'; end if;
  if v.accepted_at is not null then return jsonb_build_object('state','completed','role',v.role); end if;
  if v.expires_at<=now() then raise exception 'invitation expired' using errcode='55000'; end if;
  select m.user_found,m.marked into user_found,marked
  from private.invite_account_marker(p_user_id,v.email,v.id,p_attempt_id) m;
  if not user_found then raise exception 'account mismatch' using errcode='42501'; end if;
  select * into prof from public.profiles where id=p_user_id for update;
  if marked then
    update public.profiles set role=v.role,partner_company_id=v.partner_company_id,
      first_name=p_first_name,last_name=p_last_name where id=p_user_id;
  elsif v.role<>'customer' and (prof.role is distinct from v.role or prof.partner_company_id is distinct from v.partner_company_id) then
    return jsonb_build_object('state','blocked_existing','role',prof.role);
  end if;
  if v.role='customer' then
    update public.claimants set user_id=p_user_id where claim_id=v.claim_id and lower(email)=v.email
      and (user_id is null or user_id=p_user_id); get diagnostics n=row_count;
    if n<>1 then raise exception 'claimant link missing or ambiguous' using errcode='P0002'; end if;
  end if;
  update public.invites set accepted_at=now(),accepted_by=p_user_id where id=v.id;
  insert into public.audit_log(actor_id,action,entity,entity_id,meta,ip)
  values(p_user_id,'invite.accepted','invites',v.id,jsonb_build_object('email',v.email,'role',v.role,
    'claim_id',v.claim_id,'partner_company_id',v.partner_company_id,'attempt_id',p_attempt_id),p_ip);
  select role into effective_role from public.profiles where id=p_user_id;
  return jsonb_build_object('state','completed','role',v.role,'effective_role',effective_role,
    'account_origin',case when marked then 'invite_created' else 'existing' end);
end;
$fn$;
revoke all on function public.finalize_invite_acceptance(uuid,uuid,uuid,text,text,inet) from public,anon,authenticated;
grant execute on function public.finalize_invite_acceptance(uuid,uuid,uuid,text,text,inet) to service_role;
