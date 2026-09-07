-- Serialize external LOR dispatches and make a submitted request id one-shot.
-- The service-role worker owns these functions; signed-in clients never touch
-- the ledger or its lease columns directly.
set check_function_bodies = off;
alter table public.claims
  add column if not exists esign_dispatch_token uuid,
  add column if not exists esign_dispatch_started_at timestamptz,
  add column if not exists esign_active_attempt_token uuid;
create or replace function public.protect_esign_dispatch_columns()
returns trigger
language plpgsql set search_path = '' as $fn$
begin
  if current_user <> 'service_role'
     and (
       new.esign_dispatch_token is distinct from old.esign_dispatch_token
       or new.esign_dispatch_started_at is distinct from old.esign_dispatch_started_at
       or new.esign_active_attempt_token is distinct from old.esign_active_attempt_token
     ) then
    raise exception 'e-sign dispatch ownership is server-managed' using errcode = '42501';
  end if;
  return new;
end;
$fn$;
drop trigger if exists claims_protect_esign_dispatch_columns on public.claims;
create trigger claims_protect_esign_dispatch_columns
before update on public.claims
for each row execute function public.protect_esign_dispatch_columns();
revoke all on function public.protect_esign_dispatch_columns() from public, anon, authenticated;
alter table public.claim_events
  add column if not exists external_event_key text;
create unique index if not exists claim_events_external_event_key_uidx
  on public.claim_events (external_event_key);
alter table public.documents
  add column if not exists external_event_key text;
create unique index if not exists documents_external_event_key_uidx
  on public.documents (external_event_key);
create table if not exists public.esign_dispatch_attempts (
  request_id uuid primary key,
  claim_id uuid not null references public.claims(id) on delete cascade,
  actor_id uuid references public.profiles(id) on delete set null,
  mode text not null check (mode in ('pandadoc', 'manual')),
  state text not null check (state in ('processing', 'completed', 'failed', 'abandoned')),
  phase text not null default 'preparing' check (phase in ('preparing', 'sending')),
  claim_token uuid not null,
  provider_document_id text,
  result jsonb not null default '{}'::jsonb,
  started_at timestamptz not null default now(),
  completed_at timestamptz
);
alter table public.esign_dispatch_attempts enable row level security;
alter table public.esign_dispatch_attempts
  add column if not exists phase text not null default 'preparing'
    check (phase in ('preparing', 'sending')),
  add column if not exists provider_document_id text;
create table if not exists public.esign_recipient_completions (
  claim_id uuid not null references public.claims(id) on delete cascade,
  document_id text not null,
  recipient_hash text not null,
  completed_at timestamptz not null default now(),
  primary key (document_id, recipient_hash)
);
alter table public.esign_recipient_completions enable row level security;
create index if not exists esign_dispatch_attempts_claim_started_idx
  on public.esign_dispatch_attempts (claim_id, started_at desc);
create index if not exists esign_dispatch_attempts_actor_idx
  on public.esign_dispatch_attempts (actor_id);
create index if not exists esign_recipient_completions_claim_idx
  on public.esign_recipient_completions (claim_id);
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
  if p_mode not in ('pandadoc', 'manual') then
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
begin
  if nullif(pg_catalog.btrim(p_provider_document_id), '') is null then
    return false;
  end if;
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
  update public.esign_dispatch_attempts
     set state = case when p_outcome = 'delivered' then 'completed' else 'failed' end,
         result = jsonb_build_object(
           'reconciled_by', 'pandadoc_webhook',
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
      'Letter of Representation delivery reconciled from a PandaDoc webhook.'
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
create or replace function public.record_esign_recipient_completion(
  p_claim_id uuid,
  p_document_id text,
  p_attempt_token uuid,
  p_recipient_hash text
)
returns jsonb
language plpgsql volatile security invoker set search_path = '' as $fn$
declare
  target public.claims%rowtype;
  completed_count integer;
  recipient_count integer;
begin
  select * into target
    from public.claims
   where id = p_claim_id
   for update;
  if not found
     or target.esign_status = 'manual_pending'
     or target.pandadoc_document_id is distinct from p_document_id
     or (target.esign_active_attempt_token is not null
         and target.esign_active_attempt_token is distinct from p_attempt_token) then
    return jsonb_build_object('status', 'stale');
  end if;
  insert into public.esign_recipient_completions (
    claim_id, document_id, recipient_hash
  ) values (p_claim_id, p_document_id, p_recipient_hash)
  on conflict (document_id, recipient_hash) do nothing;
  select count(*)::integer into completed_count
    from public.esign_recipient_completions
   where claim_id = p_claim_id and document_id = p_document_id;
  select count(*)::integer into recipient_count
    from public.claimants
   where claim_id = p_claim_id;
  if target.esign_status <> 'document.completed'
     and target.esign_status not in (
       'document.declined', 'document.expired', 'document.voided',
       'document.cancelled', 'document.rejected', 'document.creation_failed'
     ) then
    update public.claims
       set esign_status = 'recipient.completed:' || completed_count::text
         || ':' || recipient_count::text
     where id = p_claim_id;
  end if;
  return jsonb_build_object(
    'status', 'recorded',
    'completed', completed_count,
    'recipients', recipient_count
  );
end;
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
  if target.esign_status = 'document.completed'
     and p_status <> 'document.completed' then return 'ignored'; end if;
  if target.esign_status like 'recipient.completed:%'
     and p_status in ('document.sent', 'document.viewed') then return 'ignored'; end if;
  if target.esign_status is not distinct from p_status then return 'ignored'; end if;
  update public.claims set esign_status = p_status where id = p_claim_id;
  return 'applied';
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
       and (c.esign_active_attempt_token is null
            or c.esign_active_attempt_token = p_attempt_token)
  );
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
  insert into public.documents (
    claim_id, storage_path, original_name, kind, mime, size_bytes,
    visibility, external_event_key
  ) values (
    p_claim_id, p_storage_path, p_original_name, 'lor_signed',
    'application/pdf', p_size_bytes, 'customer', p_external_event_key
  )
  on conflict (external_event_key) do nothing
  returning id into existing_id;
  if existing_id is null then
    select id into existing_id from public.documents
     where external_event_key = p_external_event_key;
  end if;
  if target.status = 'lor_sent' then
    update public.claims
       set status = 'lor_signed', esign_status = 'document.completed'
     where id = p_claim_id;
    did_transition := true;
  end if;
  return jsonb_build_object(
    'status', 'recorded', 'document_id', existing_id,
    'transitioned', did_transition
  );
end;
$fn$;
create or replace function public.settle_esign_dispatch(
  p_request_id uuid,
  p_claim_token uuid,
  p_state text,
  p_result jsonb default '{}'::jsonb
)
returns boolean
language plpgsql volatile security invoker set search_path = '' as $fn$
declare
  settled_claim uuid;
begin
  if p_state not in ('completed', 'failed') then return false; end if;
  update public.esign_dispatch_attempts
     set state = p_state,
         result = coalesce(p_result, '{}'::jsonb),
         completed_at = pg_catalog.now()
   where request_id = p_request_id
     and claim_token = p_claim_token
     and state = 'processing'
  returning claim_id into settled_claim;
  if settled_claim is null then return false; end if;
  update public.claims
     set esign_dispatch_token = null,
         esign_dispatch_started_at = null
   where id = settled_claim
     and esign_dispatch_token = p_claim_token;
  return true;
end;
$fn$;
revoke all on table public.esign_dispatch_attempts from public, anon, authenticated;
revoke all on table public.esign_recipient_completions from public, anon, authenticated;
revoke all on function public.claim_esign_dispatch(uuid, uuid, uuid, text, uuid, integer) from public, anon, authenticated;
revoke all on function public.settle_esign_dispatch(uuid, uuid, text, jsonb) from public, anon, authenticated;
revoke all on function public.mark_esign_dispatch_sending(uuid, uuid, text) from public, anon, authenticated;
revoke all on function public.reconcile_esign_dispatch(uuid, text, uuid, text) from public, anon, authenticated;
revoke all on function public.record_esign_recipient_completion(uuid, text, uuid, text) from public, anon, authenticated;
revoke all on function public.apply_esign_webhook_state(uuid, text, uuid, text) from public, anon, authenticated;
revoke all on function public.esign_attempt_is_active(uuid, text, uuid) from public, anon, authenticated;
revoke all on function public.finalize_esign_pdf(uuid, text, uuid, text, text, text, bigint) from public, anon, authenticated;
grant all on table public.esign_dispatch_attempts to service_role;
grant all on table public.esign_recipient_completions to service_role;
grant execute on function public.claim_esign_dispatch(uuid, uuid, uuid, text, uuid, integer) to service_role;
grant execute on function public.settle_esign_dispatch(uuid, uuid, text, jsonb) to service_role;
grant execute on function public.mark_esign_dispatch_sending(uuid, uuid, text) to service_role;
grant execute on function public.reconcile_esign_dispatch(uuid, text, uuid, text) to service_role;
grant execute on function public.record_esign_recipient_completion(uuid, text, uuid, text) to service_role;
grant execute on function public.apply_esign_webhook_state(uuid, text, uuid, text) to service_role;
grant execute on function public.esign_attempt_is_active(uuid, text, uuid) to service_role;
grant execute on function public.finalize_esign_pdf(uuid, text, uuid, text, text, text, bigint) to service_role;
