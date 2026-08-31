-- A limited locking subquery can run again inside a nested-loop update.
-- Materialize each candidate set so a plan change cannot exceed the batch budget.
-- CREATE OR REPLACE preserves the function owner and existing ACL. Queue data is unchanged.
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
  attempts integer
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
  returning o.id, o.recipient_email, o.template, o.payload, o.attempts;
end;
$fn$;
