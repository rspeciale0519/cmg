-- Before applying: separately approve and quiesce all shared-queue senders,
-- account for in-flight claims, and review existing recipients. A migration
-- cannot recall an already-started provider request. Recovery is a reviewed
-- forward repair; no recipient is automatically changed or released.

create table public.email_recipient_policy (
  singleton boolean primary key default true check (singleton),
  blocked_domains text[] not null check (cardinality(blocked_domains) > 0)
);
alter table public.email_recipient_policy enable row level security;
revoke all on public.email_recipient_policy from public, anon, authenticated;
grant select, update on public.email_recipient_policy to service_role;
insert into public.email_recipient_policy(singleton, blocked_domains)
values (true, array['cmgpropertysolutions.net']);

alter table public.notifications_outbox
  add column hold_reason text,
  add column lease_token uuid;

create function public.email_recipient_allowed(p_recipient text)
returns boolean language sql stable security invoker set search_path = '' as $fn$
  select coalesce((
    select
      p_recipient is not null
      and p_recipient = pg_catalog.btrim(p_recipient)
      and p_recipient not like '%..%'
      and pg_catalog.left(pg_catalog.split_part(p_recipient, '@', 1), 1) <> '.'
      and pg_catalog.right(pg_catalog.split_part(p_recipient, '@', 1), 1) <> '.'
      and p_recipient ~* '^[a-z0-9.!#$%&''*+/=?^_{}|~-]+@[a-z0-9]([a-z0-9.-]*[a-z0-9])?$'
      and lower(p_recipient) <> 'unresolved-staff@invalid'
      and not exists (
        select 1 from unnest(p.blocked_domains) as d(domain)
        where d.domain is null or d.domain = '' or d.domain !~* '^[a-z0-9]+([.-][a-z0-9]+)*$'
           or lower(split_part(p_recipient, '@', 2)) = lower(d.domain)
           or right(lower(split_part(p_recipient, '@', 2)), length(d.domain) + 1) = '.' || lower(d.domain)
      )
    from public.email_recipient_policy p where p.singleton
  ), false);
$fn$;
revoke all on function public.email_recipient_allowed(text) from public, anon, authenticated;
grant execute on function public.email_recipient_allowed(text) to service_role;

create function public.hold_unallowed_outbox_recipient()
returns trigger language plpgsql security invoker set search_path = '' as $fn$
begin
  if tg_op = 'UPDATE' and (old.lease_token is not null or old.hold_reason in ('expired-lease-uncertain', 'provider-outcome-unknown'))
     and new.recipient_email is distinct from old.recipient_email then
    raise exception 'recipient cannot change while a claim is active';
  end if;
  if not public.email_recipient_allowed(new.recipient_email) then
    new.hold_reason := coalesce(new.hold_reason, 'recipient-policy');
  end if;
  return new;
end;
$fn$;

-- V2 leases have a unique fencing token. An expired lease has an unknown
-- provider outcome and is held for review instead of retried or dead-lettered.
create function public.claim_outbox_batch_v2(
  p_limit integer default 25,
  p_lease_seconds integer default 300,
  p_ids uuid[] default null,
  p_templates text[] default null
)
returns table (
  id uuid, recipient_email text, template text, payload jsonb,
  attempts integer, created_at timestamptz, lease_token uuid
)
language plpgsql volatile security invoker set search_path = '' as $fn$
declare
  v_limit integer := greatest(p_limit, 0);
begin
  with expired as materialized (
    select n.id from public.notifications_outbox n
     where n.status in ('pending', 'failed')
       and n.hold_reason is null and n.lease_token is not null
       and n.next_attempt_at <= pg_catalog.now()
       and (p_ids is null or n.id = any (p_ids))
       and (p_templates is null or n.template = any (p_templates))
     order by n.next_attempt_at, n.id limit v_limit for update skip locked
  )
  update public.notifications_outbox o
     set hold_reason = 'expired-lease-uncertain', lease_token = null
    from expired where o.id = expired.id;
  with terminal as materialized (
    select n.id from public.notifications_outbox n
     where n.status in ('pending', 'failed') and n.hold_reason is null
       and n.lease_token is null and n.attempts >= 5
       and public.email_recipient_allowed(n.recipient_email)
       and n.next_attempt_at <= pg_catalog.now()
       and (p_ids is null or n.id = any (p_ids))
       and (p_templates is null or n.template = any (p_templates))
     order by n.next_attempt_at, n.id
     limit v_limit for update skip locked
  )
  update public.notifications_outbox o
     set status = 'dead', last_error = 'Delivery worker lease expired during the final permitted attempt.'
    from terminal where o.id = terminal.id;
  return query with due as materialized (
    select n.id from public.notifications_outbox n
     where n.status in ('pending', 'failed') and n.hold_reason is null
       and n.lease_token is null and n.attempts < 5
       and public.email_recipient_allowed(n.recipient_email)
       and n.next_attempt_at <= pg_catalog.now()
       and (p_ids is null or n.id = any (p_ids))
       and (p_templates is null or n.template = any (p_templates))
     order by n.next_attempt_at, n.id
     limit v_limit for update skip locked
  )
  update public.notifications_outbox o
     set attempts = o.attempts + 1,
         next_attempt_at = pg_catalog.now() + pg_catalog.make_interval(secs => greatest(p_lease_seconds, 1)),
         lease_token = pg_catalog.gen_random_uuid()
    from due where o.id = due.id
  returning o.id, o.recipient_email, o.template, o.payload, o.attempts, o.created_at, o.lease_token;
end;
$fn$;

-- Old workers cannot participate in the fenced protocol. Revocation is
-- deliberate: their dispatch fails closed until the upgraded worker is live.
-- The pre-migration quiescence gate still covers already-claimed messages.
revoke all on function public.claim_outbox_batch(integer, integer, uuid[])
  from public, anon, authenticated, service_role;
revoke all on function public.claim_outbox_batch_v2(integer, integer, uuid[], text[]) from public, anon, authenticated;
grant execute on function public.claim_outbox_batch_v2(integer, integer, uuid[], text[]) to service_role;

-- The token, recipient, lease and policy are checked immediately before the
-- provider call. A policy change still requires quiescence of direct senders.
create function public.outbox_claim_ready_v2(p_id uuid, p_token uuid, p_recipient text)
returns boolean language sql stable security invoker set search_path = '' as $fn$
  select exists (
    select 1 from public.notifications_outbox o
     where o.id = p_id and o.lease_token = p_token and o.hold_reason is null
       and o.status in ('pending', 'failed') and o.next_attempt_at > pg_catalog.now()
       and o.recipient_email = p_recipient
       and public.email_recipient_allowed(o.recipient_email)
  );
$fn$;
revoke all on function public.outbox_claim_ready_v2(uuid, uuid, text) from public, anon, authenticated;
grant execute on function public.outbox_claim_ready_v2(uuid, uuid, text) to service_role;

-- Fencing prevents a delayed worker from overwriting a newer claim. A held
-- policy check occurs before the provider call, so its reserved attempt can
-- be restored only by the worker that still owns this token.
create function public.settle_outbox_claim_v2(
  p_id uuid, p_token uuid, p_outcome text, p_error text, p_retry_seconds integer
) returns boolean language plpgsql volatile security invoker set search_path = '' as $fn$
declare changed integer;
begin
  if p_outcome not in ('sent', 'failed', 'dead', 'held', 'uncertain') then
    raise exception 'invalid outbox outcome';
  end if;
  update public.notifications_outbox o
     set status = case when p_outcome in ('held', 'uncertain') then o.status else p_outcome::public.outbox_status end,
         last_error = case when p_outcome = 'sent' then null else p_error end,
         sent_at = case when p_outcome = 'sent' then pg_catalog.now() else o.sent_at end,
         attempts = case when p_outcome = 'held' then greatest(o.attempts - 1, 0) else o.attempts end,
         next_attempt_at = case when p_outcome = 'failed'
           then pg_catalog.now() + pg_catalog.make_interval(secs => greatest(coalesce(p_retry_seconds, 0), 0))
           else o.next_attempt_at end,
         hold_reason = case when p_outcome = 'held' then 'recipient-policy-check' when p_outcome = 'uncertain' then 'provider-outcome-unknown' else o.hold_reason end,
         lease_token = null
   where o.id = p_id and o.lease_token = p_token
     and (o.hold_reason is null or p_outcome in ('held', 'uncertain'))
     and o.status in ('pending', 'failed');
  get diagnostics changed = row_count;
  return changed = 1;
end;
$fn$;
revoke all on function public.settle_outbox_claim_v2(uuid, uuid, text, text, integer) from public, anon, authenticated;
grant execute on function public.settle_outbox_claim_v2(uuid, uuid, text, text, integer) to service_role;

create function public.count_outbox_held() returns bigint
language sql stable security invoker set search_path = '' as $fn$
  select count(*) from public.notifications_outbox o
   where o.status in ('pending', 'failed')
     and (o.hold_reason is not null or not public.email_recipient_allowed(o.recipient_email));
$fn$;
revoke all on function public.count_outbox_held() from public, anon, authenticated;
grant execute on function public.count_outbox_held() to service_role;
revoke all on function public.hold_unallowed_outbox_recipient() from public, anon, authenticated;
create trigger outbox_recipient_hold before insert or update of recipient_email
on public.notifications_outbox for each row execute function public.hold_unallowed_outbox_recipient();

-- Preserve blocked rows across later policy or address edits. Release requires
-- a separately reviewed change to the hold and recipient; this migration never
-- changes recipients, attempts, or message payloads.
update public.notifications_outbox
   set hold_reason = coalesce(hold_reason, 'recipient-policy')
 where status in ('pending', 'failed') and not public.email_recipient_allowed(recipient_email);

create function public.hold_outbox_on_policy_change()
returns trigger language plpgsql security invoker set search_path = '' as $fn$
begin
  update public.notifications_outbox
     set hold_reason = coalesce(hold_reason, 'recipient-policy')
   where status in ('pending', 'failed') and not public.email_recipient_allowed(recipient_email);
  return new;
end;
$fn$;
revoke all on function public.hold_outbox_on_policy_change() from public, anon, authenticated;

-- Serialize a policy edit against claims and require every token to be
-- accounted for before the edit. A token represents a possibly in-flight send.
create function public.guard_email_policy_change()
returns trigger language plpgsql volatile security invoker set search_path = '' as $fn$
begin
  lock table public.notifications_outbox in share row exclusive mode;
  if exists (select 1 from public.notifications_outbox where lease_token is not null
    or hold_reason in ('expired-lease-uncertain', 'provider-outcome-unknown')) then
    raise exception 'recipient policy cannot change while a claim is active';
  end if;
  return new;
end;
$fn$;
revoke all on function public.guard_email_policy_change() from public, anon, authenticated;
create trigger outbox_policy_change_guard before update on public.email_recipient_policy
for each row execute function public.guard_email_policy_change();
create trigger outbox_policy_hold after update on public.email_recipient_policy
for each statement execute function public.hold_outbox_on_policy_change();

create or replace function public.claim_outbox_batch(
  p_limit integer default 25,
  p_lease_seconds integer default 300,
  p_ids uuid[] default null
)
returns table (
  id uuid,
  recipient_email text,
  template text,
  payload jsonb,
  attempts integer,
  created_at timestamptz
)
language plpgsql
volatile
security invoker
set search_path = ''
as $fn$
declare
  v_limit integer := greatest(p_limit, 0);
  v_terminalized integer := 0;
begin
  with expired as materialized (
    select n.id
      from public.notifications_outbox n
     where n.status in ('pending', 'failed')
       and n.hold_reason is null
       and public.email_recipient_allowed(n.recipient_email)
       and n.attempts >= 5
       and n.next_attempt_at <= pg_catalog.now()
       and (p_ids is null or n.id = any (p_ids))
     order by n.next_attempt_at, n.id
     limit v_limit
       for update skip locked
  )
  update public.notifications_outbox o
     set status = 'dead',
         last_error = 'Delivery worker lease expired during the final permitted attempt.'
    from expired
   where o.id = expired.id;

  get diagnostics v_terminalized = row_count;

  return query
  with due as materialized (
    select n.id
      from public.notifications_outbox n
     where n.status in ('pending', 'failed')
       and n.hold_reason is null
       and public.email_recipient_allowed(n.recipient_email)
       and n.attempts < 5
       and n.next_attempt_at <= pg_catalog.now()
       and (p_ids is null or n.id = any (p_ids))
     order by n.next_attempt_at, n.id
     limit greatest(v_limit - v_terminalized, 0)
       for update skip locked
  )
  update public.notifications_outbox o
     set attempts = o.attempts + 1,
         next_attempt_at = pg_catalog.now()
           + pg_catalog.make_interval(secs => greatest(p_lease_seconds, 1))
    from due
   where o.id = due.id
  returning o.id, o.recipient_email, o.template, o.payload, o.attempts, o.created_at;
end;
$fn$;
