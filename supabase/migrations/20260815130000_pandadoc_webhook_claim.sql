-- Crash-safe PandaDoc webhook ownership.
--
-- The original primary-key insert prevented concurrent handlers, but the row
-- looked complete before the protected work had finished. A process death then
-- made every PandaDoc retry look like an already-processed duplicate. This
-- migration turns the existing row into a lease without exposing the ledger to
-- signed-in users. Historical rows are complete; new rows move through
-- processing -> done, and an expired processing lease can be reclaimed.

set check_function_bodies = off;

alter table public.notifications_outbox
  add column if not exists dedupe_key text;

create unique index if not exists notifications_outbox_dedupe_key_uidx
  on public.notifications_outbox (dedupe_key);

update public.pandadoc_webhook_events
   set payload_summary = payload_summary || jsonb_build_object(
     '_state', 'done',
     '_attempts', 1,
     '_completed_at', received_at
   )
 where not (payload_summary ? '_state');

create or replace function public.claim_pandadoc_webhook_event(
  p_event_id uuid,
  p_payload_hash text,
  p_claim_token uuid,
  p_lease_seconds integer default 300
)
returns jsonb
language plpgsql
volatile
security invoker
set search_path = ''
as $fn$
declare
  current_summary jsonb;
  current_received_at timestamptz;
  inserted_count integer;
  next_attempt integer;
begin
  insert into public.pandadoc_webhook_events (event_id, received_at, payload_summary)
  values (
    p_event_id,
    pg_catalog.now(),
    jsonb_build_object('_state', 'processing', '_attempts', 1)
      || jsonb_build_object('_payload_hash', p_payload_hash, '_claim_token', p_claim_token)
  )
  on conflict (event_id) do nothing;

  get diagnostics inserted_count = row_count;
  if inserted_count = 1 then
    return jsonb_build_object('status', 'claimed', 'claim_token', p_claim_token);
  end if;

  select e.payload_summary, e.received_at
    into current_summary, current_received_at
    from public.pandadoc_webhook_events e
   where e.event_id = p_event_id
   for update;

  if current_summary ->> '_state' = 'done' then
    if current_summary ? '_payload_hash'
      and current_summary ->> '_payload_hash' <> p_payload_hash then
      return jsonb_build_object('status', 'conflict');
    end if;
    return jsonb_build_object('status', 'duplicate');
  end if;

  if current_summary ->> '_payload_hash' <> p_payload_hash then
    return jsonb_build_object('status', 'conflict');
  end if;

  if current_received_at > pg_catalog.now()
    - pg_catalog.make_interval(secs => greatest(p_lease_seconds, 1)) then
    return jsonb_build_object('status', 'busy');
  end if;

  next_attempt := greatest(coalesce((current_summary ->> '_attempts')::integer, 0), 0) + 1;

  update public.pandadoc_webhook_events
     set received_at = pg_catalog.now(),
         payload_summary = current_summary || jsonb_build_object(
           '_state', 'processing',
           '_attempts', next_attempt,
           '_claim_token', p_claim_token
         )
   where event_id = p_event_id;

  return jsonb_build_object('status', 'claimed', 'claim_token', p_claim_token);
end;
$fn$;

create or replace function public.complete_pandadoc_webhook_event(
  p_event_id uuid,
  p_claim_token uuid,
  p_payload_summary jsonb
)
returns boolean
language sql
volatile
security invoker
set search_path = ''
as $fn$
  with completed as (
    update public.pandadoc_webhook_events e
       set payload_summary = e.payload_summary
         || coalesce(p_payload_summary, '{}'::jsonb)
         || jsonb_build_object(
           '_state', 'done',
           '_completed_at', pg_catalog.now()
         )
     where e.event_id = p_event_id
       and e.payload_summary ->> '_state' = 'processing'
       and e.payload_summary ->> '_claim_token' = p_claim_token::text
    returning 1
  )
  select exists (select 1 from completed);
$fn$;

create or replace function public.release_pandadoc_webhook_event(
  p_event_id uuid,
  p_claim_token uuid,
  p_error text
)
returns boolean
language sql
volatile
security invoker
set search_path = ''
as $fn$
  with released as (
    update public.pandadoc_webhook_events e
       set received_at = '-infinity'::timestamptz,
           payload_summary = e.payload_summary || jsonb_build_object(
             '_state', 'failed',
             '_last_error', left(coalesce(p_error, 'unknown failure'), 500)
           )
     where e.event_id = p_event_id
       and e.payload_summary ->> '_state' = 'processing'
       and e.payload_summary ->> '_claim_token' = p_claim_token::text
    returning 1
  )
  select exists (select 1 from released);
$fn$;

revoke all on function public.claim_pandadoc_webhook_event(uuid, text, uuid, integer)
  from public, anon, authenticated;
revoke all on function public.complete_pandadoc_webhook_event(uuid, uuid, jsonb)
  from public, anon, authenticated;
revoke all on function public.release_pandadoc_webhook_event(uuid, uuid, text)
  from public, anon, authenticated;

grant execute on function public.claim_pandadoc_webhook_event(uuid, text, uuid, integer)
  to service_role;
grant execute on function public.complete_pandadoc_webhook_event(uuid, uuid, jsonb)
  to service_role;
grant execute on function public.release_pandadoc_webhook_event(uuid, uuid, text)
  to service_role;
