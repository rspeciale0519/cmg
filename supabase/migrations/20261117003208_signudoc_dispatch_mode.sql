-- Experimental provider support. Existing RPC signatures and grants are preserved.
-- Recovery: disable SIGNUDOC_ENABLED, keep credentials for in-flight polling, and
-- retain existing attempt history. Do not delete or rewrite SignuDoc ledger rows.
set check_function_bodies=off;
alter table public.esign_dispatch_attempts drop constraint esign_dispatch_attempts_mode_check;
alter table public.esign_dispatch_attempts add constraint esign_dispatch_attempts_mode_check
  check(mode in ('pandadoc','manual','signudoc')) not valid;
alter table public.esign_dispatch_attempts validate constraint esign_dispatch_attempts_mode_check;

create or replace function public.claim_esign_dispatch(
  p_claim_id uuid,
  p_request_id uuid,
  p_claim_token uuid,
  p_mode text,
  p_actor_id uuid default null,
  p_lease_seconds integer default 120
)
returns jsonb
language plpgsql volatile security invoker set search_path = '' as $fn$
declare
  target public.claims%rowtype;
  existing public.esign_dispatch_attempts%rowtype;
  active public.esign_dispatch_attempts%rowtype;
begin
  if p_mode not in ('pandadoc', 'manual', 'signudoc') then
    return jsonb_build_object('status', 'invalid_mode');
  end if;
  select * into target
    from public.claims
   where id = p_claim_id
   for update;
  if not found then return jsonb_build_object('status', 'missing'); end if;
  if target.status <> 'under_review'
     and not (
       target.status = 'lor_sent'
       and coalesce(target.esign_status in (
         'document.declined', 'document.expired', 'document.voided',
         'document.cancelled', 'document.rejected', 'document.creation_failed'
       ), false)
     ) then
    return jsonb_build_object('status', 'invalid_status');
  end if;
  select * into existing
    from public.esign_dispatch_attempts
   where request_id = p_request_id;
  if found then
    return jsonb_build_object('status', 'duplicate', 'state', existing.state);
  end if;
  if target.esign_dispatch_token is not null then
    select * into active
      from public.esign_dispatch_attempts
     where claim_id = p_claim_id
       and claim_token = target.esign_dispatch_token
       and state = 'processing';
    -- Once the provider send has started, a missing response is inherently
    -- ambiguous. Never auto-reclaim it: PandaDoc has no documented idempotency
    -- key, so takeover could put two conflicting letters in front of a client.
    if found and active.phase = 'sending' then
      return jsonb_build_object(
        'status', 'busy',
        'reason', 'provider_delivery_unresolved',
        'provider_document_id', active.provider_document_id
      );
    end if;
    if target.esign_dispatch_started_at > pg_catalog.now()
       - pg_catalog.make_interval(secs => greatest(p_lease_seconds, 1)) then
      return jsonb_build_object('status', 'busy');
    end if;
    update public.esign_dispatch_attempts
       set state = 'abandoned', completed_at = pg_catalog.now()
     where claim_id = p_claim_id
       and claim_token = target.esign_dispatch_token
       and state = 'processing';
  end if;
  insert into public.esign_dispatch_attempts (
    request_id, claim_id, actor_id, mode, state, claim_token
  ) values (
    p_request_id, p_claim_id, p_actor_id, p_mode, 'processing', p_claim_token
  );
  update public.claims
     set esign_dispatch_token = p_claim_token,
         esign_dispatch_started_at = pg_catalog.now()
   where id = p_claim_id;
  return jsonb_build_object('status', 'claimed', 'claim_token', p_claim_token);
end;
$fn$;

create or replace function public.mark_esign_dispatch_sending(
  p_request_id uuid,
  p_claim_token uuid,
  p_provider_document_id text
)
returns boolean
language plpgsql volatile security invoker set search_path = '' as $fn$
declare
  owned_claim uuid;
  provider_mode text;
begin
  if nullif(pg_catalog.btrim(p_provider_document_id), '') is null then
    return false;
  end if;
  select mode into provider_mode from public.esign_dispatch_attempts
    where request_id=p_request_id and claim_token=p_claim_token and state='processing';
  if provider_mode is null then return false; end if;
  if provider_mode='signudoc' and p_provider_document_id !~ '^signudoc:[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$' then return false; end if;
  if provider_mode<>'signudoc' and p_provider_document_id like 'signudoc:%' then return false; end if;
  update public.esign_dispatch_attempts
     set phase = 'sending',
         provider_document_id = p_provider_document_id
   where request_id = p_request_id
     and claim_token = p_claim_token
     and state = 'processing'
     and phase = 'preparing'
  returning claim_id into owned_claim;
  if owned_claim is null then return false; end if;
  update public.claims
     set esign_dispatch_started_at = pg_catalog.now(),
         pandadoc_document_id = p_provider_document_id,
         esign_active_attempt_token = p_claim_token,
         esign_status = 'document.sending'
   where id = owned_claim
     and esign_dispatch_token = p_claim_token;
  if not found then
    raise exception 'e-sign dispatch ownership was lost before send' using errcode = '40001';
  end if;
  return true;
end;
$fn$;

create or replace function public.reconcile_esign_dispatch(
  p_claim_id uuid,
  p_document_id text,
  p_attempt_token uuid,
  p_outcome text
)
returns text
language plpgsql volatile security invoker set search_path = '' as $fn$
declare
  target public.claims%rowtype;
  request uuid;
  provider_mode text;
begin
  if p_outcome not in ('delivered', 'creation_failed', 'non_proving') then
    return 'invalid_outcome';
  end if;
  select * into target from public.claims where id = p_claim_id for update;
  if not found
     or target.esign_dispatch_token is distinct from p_attempt_token
     or target.esign_active_attempt_token is distinct from p_attempt_token
     or target.pandadoc_document_id is distinct from p_document_id then
    return 'mismatch';
  end if;
  if p_outcome = 'non_proving' then return 'retained'; end if;
  select mode into provider_mode from public.esign_dispatch_attempts where claim_id=p_claim_id and claim_token=p_attempt_token;
  update public.esign_dispatch_attempts
     set state = case when p_outcome = 'delivered' then 'completed' else 'failed' end,
         result = jsonb_build_object(
           'reconciled_by', case when provider_mode='signudoc' then 'signudoc_poll' else 'pandadoc_webhook' end,
           'outcome', p_outcome,
           'provider_document_id', p_document_id
         ),
         completed_at = pg_catalog.now()
   where claim_id = p_claim_id
     and claim_token = p_attempt_token
     and state = 'processing'
     and phase = 'sending'
  returning request_id into request;
  if request is null then
    if target.esign_dispatch_token is null
       and target.esign_active_attempt_token = p_attempt_token
       and target.pandadoc_document_id = p_document_id then
      return 'duplicate';
    end if;
    return 'mismatch';
  end if;
  if p_outcome = 'delivered' and target.status = 'under_review' then
    update public.claims
       set status = 'lor_sent',
           esign_dispatch_token = null,
           esign_dispatch_started_at = null
     where id = p_claim_id;
    insert into public.claim_status_history (
      claim_id, from_status, to_status, changed_by, note
    ) values (
      p_claim_id, 'under_review', 'lor_sent', null,
      case when provider_mode='signudoc' then 'Letter of Representation delivery reconciled from SignuDoc.' else 'Letter of Representation delivery reconciled from a PandaDoc webhook.' end
    );
  elsif p_outcome = 'delivered' then
    update public.claims
       set esign_dispatch_token = null,
           esign_dispatch_started_at = null
     where id = p_claim_id;
  else
    update public.claims
       set esign_status = 'document.creation_failed',
           esign_dispatch_token = null,
           esign_dispatch_started_at = null
     where id = p_claim_id;
  end if;
  return case when p_outcome = 'delivered' then 'delivered' else 'failed' end;
end;
$fn$;

create or replace function public.finalize_esign_pdf(
  p_claim_id uuid,
  p_document_id text,
  p_attempt_token uuid,
  p_external_event_key text,
  p_storage_path text,
  p_original_name text,
  p_size_bytes bigint
)
returns jsonb
language plpgsql volatile security invoker set search_path = '' as $fn$
declare
  target public.claims%rowtype;
  existing_id uuid;
  did_transition boolean := false;
begin
  select * into target from public.claims where id = p_claim_id for update;
  if not found
     or target.esign_status = 'manual_pending'
     or target.pandadoc_document_id is distinct from p_document_id
     or (target.esign_active_attempt_token is not null
         and target.esign_active_attempt_token is distinct from p_attempt_token)
     or target.status not in ('lor_sent', 'lor_signed') then
    return jsonb_build_object('status', 'stale');
  end if;
  if p_document_id like 'signudoc:%' then
    if target.esign_dispatch_token is not null and target.esign_dispatch_token is distinct from p_attempt_token then return jsonb_build_object('status','stale'); end if;
    if target.esign_status <> 'document.completed' then return jsonb_build_object('status','stale'); end if;
    if not exists(select 1 from public.esign_dispatch_attempts a where a.claim_id=p_claim_id and a.claim_token=p_attempt_token and a.mode='signudoc' and a.provider_document_id=p_document_id)
       or not exists(select 1 from public.documents d where d.claim_id=p_claim_id and d.external_event_key='signudoc:'||p_attempt_token::text||':evidence' and d.visibility='internal' and d.kind='other' and d.mime='application/pdf') then
      return jsonb_build_object('status','evidence_pending');
    end if;
  end if;
  -- The claim lock serializes filing. Check an existing SignuDoc event
  -- before INSERT so an ignored duplicate never settles a new orphan path.
  if p_document_id like 'signudoc:%' then
    select id into existing_id from public.documents
     where external_event_key=p_external_event_key and claim_id=p_claim_id
       and kind='lor_signed' and visibility='customer';
  end if;
  if existing_id is null then
  insert into public.documents (
    claim_id, storage_path, original_name, kind, mime, size_bytes,
    visibility, external_event_key
  ) values (
    p_claim_id, p_storage_path, p_original_name, 'lor_signed',
    'application/pdf', p_size_bytes, 'customer', p_external_event_key
  )
  on conflict (external_event_key) do nothing
  returning id into existing_id;
  end if;
  if existing_id is null then
    select id into existing_id from public.documents
     where external_event_key = p_external_event_key;
  end if;
  if target.status = 'lor_sent' then
    update public.claims
       set status = 'lor_signed', esign_status = 'document.completed'
     where id = p_claim_id;
    did_transition := true;
    if p_document_id like 'signudoc:%' then
      insert into public.claim_status_history(claim_id,from_status,to_status,note)
      values(p_claim_id,'lor_sent','lor_signed','Signed agreement and audit evidence filed from SignuDoc.');
      insert into public.claim_events(claim_id,type,visibility,body,external_event_key)
      values(p_claim_id,'document','shared','The signed Letter of Representation and audit evidence have been filed.','signudoc:'||p_attempt_token::text||':completed') on conflict(external_event_key) do nothing;
      insert into public.audit_log(action,entity,entity_id,meta)
      values('esign.signudoc_artifacts_filed','claims',p_claim_id,jsonb_build_object('provider_document_id',p_document_id,'attempt_token',p_attempt_token));
    end if;
  end if;
  return jsonb_build_object(
    'status', 'recorded', 'document_id', existing_id,
    'transitioned', did_transition
  );
end;
$fn$;

create or replace function public.esign_attempt_is_active(
  p_claim_id uuid,
  p_document_id text,
  p_attempt_token uuid
)
returns boolean
language sql stable security invoker set search_path = '' as $fn$
  select exists (
    select 1 from public.claims c
     where c.id = p_claim_id
       and c.esign_status <> 'manual_pending'
       and c.pandadoc_document_id = p_document_id
       and (p_document_id not like 'signudoc:%' or c.esign_dispatch_token is null or c.esign_dispatch_token=p_attempt_token)
       and (c.esign_active_attempt_token is null
            or c.esign_active_attempt_token = p_attempt_token)
  );
$fn$;

create or replace function public.apply_esign_webhook_state(
  p_claim_id uuid,
  p_document_id text,
  p_attempt_token uuid,
  p_status text
)
returns text
language plpgsql volatile security invoker set search_path = '' as $fn$
declare target public.claims%rowtype;
begin
  select * into target from public.claims where id = p_claim_id for update;
  if not found
     or target.esign_status = 'manual_pending'
     or target.pandadoc_document_id is distinct from p_document_id
     or (target.esign_active_attempt_token is not null
         and target.esign_active_attempt_token is distinct from p_attempt_token) then
    return 'stale';
  end if;
  if p_document_id like 'signudoc:%' and target.esign_dispatch_token is not null and target.esign_dispatch_token is distinct from p_attempt_token then return 'stale'; end if;
  -- SignuDoc poll responses can finish out of order. Terminal state and
  -- observed signer progress are monotonic within the same attempt.
  if p_document_id like 'signudoc:%' then
    if target.esign_status in ('document.declined','document.voided','document.expired','document.completed')
       and p_status is distinct from target.esign_status then return 'ignored'; end if;
    if target.esign_status ~ '^recipient[.]completed:[0-9]+:[0-9]+$'
       and p_status ~ '^recipient[.]completed:[0-9]+:[0-9]+$'
       and split_part(p_status,':',2)::integer <= split_part(target.esign_status,':',2)::integer then return 'ignored'; end if;
  end if;
  if target.esign_status = 'document.completed'
     and p_status <> 'document.completed' then return 'ignored'; end if;
  if target.esign_status like 'recipient.completed:%'
     and p_status in ('document.sent', 'document.viewed') then return 'ignored'; end if;
  if target.esign_status is not distinct from p_status then return 'ignored'; end if;
  update public.claims set esign_status = p_status where id = p_claim_id;
  return 'applied';
end;
$fn$;

-- Fair, leased provider polling: no unchanged request can monopolize a batch.
create function public.claim_signudoc_poll_batch(p_limit integer default 4,p_lease_seconds integer default 600)
returns jsonb language sql volatile security invoker set search_path='' as $fn$
 with candidates as materialized (
   select a.request_id,c.id,c.claim_ref,c.status,c.esign_status,c.pandadoc_document_id,
          c.esign_active_attempt_token,c.esign_dispatch_token
   from public.claims c join public.esign_dispatch_attempts a
     on a.claim_id=c.id and a.claim_token=c.esign_active_attempt_token
   where a.mode='signudoc' and a.provider_document_id=c.pandadoc_document_id
     and c.pandadoc_document_id like 'signudoc:%'
     and c.status in ('under_review','lor_sent')
     and (c.esign_dispatch_token is null or c.esign_dispatch_token=a.claim_token)
     and coalesce((a.result->>'signudoc_poll_after')::double precision,0)<=extract(epoch from now())
   order by coalesce((a.result->>'signudoc_polled_at')::double precision,0),a.started_at,a.request_id
   limit greatest(0,least(coalesce(p_limit,4),20)) for update of a skip locked
 ), leased as (
   update public.esign_dispatch_attempts a set result=a.result||jsonb_build_object(
     'signudoc_polled_at',extract(epoch from now()),
     'signudoc_poll_after',extract(epoch from now())+greatest(60,least(coalesce(p_lease_seconds,600),1800)))
   from candidates c where a.request_id=c.request_id returning a.request_id
 ) select coalesce(jsonb_agg(to_jsonb(c)-'request_id'),'[]'::jsonb)
 from candidates c join leased l using(request_id);
$fn$;
revoke all on function public.claim_signudoc_poll_batch(integer,integer) from public,anon,authenticated;
grant execute on function public.claim_signudoc_poll_batch(integer,integer) to service_role;
