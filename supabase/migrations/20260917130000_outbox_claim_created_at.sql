-- CMG Property Solutions — a claimed outbox row has to say how old it is
--
-- WHY THIS MIGRATION EXISTS
--
-- `SITE_MODE` gains a third value, `staff`, which opens the claims desk and widens the
-- set of templates the outbox is allowed to deliver. Widening that set retroactively
-- releases whatever is already sitting in the queue under the newly-permitted templates:
-- production currently holds rows from August that were queued while the platform was
-- closed and have been held back ever since purely because their template was not
-- deliverable. Flipping a mode must not be a send button for month-old mail. A homeowner
-- who receives a claim-status notice six weeks late learns something untrue about their
-- claim, and the fault is invisible because every row involved looks perfectly healthy.
--
-- So the engine needs an age to refuse on, and `created_at` is the only column that
-- carries one. `next_attempt_at` does not: claiming a row rewrites it to now + lease, and
-- a backed-off row has had it rewritten four times before that. `attempts` does not
-- either — a row that was never deliverable was never attempted, so the stale rows this
-- guards against all have `attempts = 0`.
--
-- `created_at` is therefore added to the claim function's result, and `deliverClaimed`
-- dead-letters a row older than `OUTBOX_MAX_AGE_DAYS` instead of sending it. The check
-- lives in the engine rather than in either preselect query on purpose: `dispatchOutbox`
-- passes an explicit id list and platform mode's cron sweep passes no preselect at all,
-- so a filter written in `outbox.ts` would cover neither. Every path reaches delivery
-- through this one function, and every path therefore reaches the guard.
--
-- WHY DROP AND CREATE
--
-- CREATE OR REPLACE cannot change a function's OUT parameters, and adding a column to a
-- RETURNS TABLE is exactly that. The drop costs the ACL and the owner, so both are
-- restored below — the same revoke/grant pair `20260814120000_outbox_claim.sql` wrote,
-- repeated here because the object it applied to no longer exists.
--
-- FORWARD-SAFE AND RECOVERABLE
--
-- Queue data is untouched: no row is read, written or deleted by this migration. The body
-- is character-for-character the one `20260830123000_outbox_batch_materialized.sql`
-- installed, plus `o.created_at` in the RETURNING list. To recover, re-apply that
-- migration's CREATE OR REPLACE after dropping this signature; the only caller that
-- depends on the new column is `deliverClaimed`, which treats a missing `created_at` as
-- "age unknown" and declines to refuse on it.

drop function if exists public.claim_outbox_batch(integer, integer, uuid[]);

create function public.claim_outbox_batch(
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
  returning o.id, o.recipient_email, o.template, o.payload, o.attempts, o.created_at;
end;
$fn$;

-- No `authenticated` in this grant, unlike every other routine in the schema. A homeowner
-- and a referring contractor have no business claiming delivery work, and the rows carry
-- other people's email addresses — the function returns `recipient_email` by design, so
-- an EXECUTE grant here would hand out exactly what the table's zero-policy state exists
-- to withhold.
revoke all on function public.claim_outbox_batch(integer, integer, uuid[])
  from public, anon, authenticated;
grant execute on function public.claim_outbox_batch(integer, integer, uuid[])
  to service_role;
