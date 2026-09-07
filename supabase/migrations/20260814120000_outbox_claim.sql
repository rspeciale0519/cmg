-- CMG Property Solutions — one sweeper takes a row, and the other one does not
--
-- WHY THIS MIGRATION EXISTS
--
-- `notifications_outbox` gained a sweeper this phase (`/api/cron/outbox`), and it has a
-- second caller that predates it: `dispatchOutbox`, the immediate post-commit attempt
-- every enqueue site fires. Both walk the same rows, and until now both selected rows
-- and then updated them:
--
--     select id, ... from notifications_outbox where status = 'pending'   -- reads
--     ... send ...                                                        -- sends
--     update notifications_outbox set status = 'sent' where id = ...      -- writes
--
-- Nothing between the read and the send stops a second caller reading the same row. On
-- Vercel the cron sweep is an ordinary HTTP request with no lease and no singleton
-- guarantee — a slow sweep still running when the next one fires, or a homeowner's
-- status change landing mid-sweep, is two processes holding the same row and two copies
-- of the same email arriving. Sending a stranger's claim update twice is the cheap
-- version; the expensive version is a settlement notice.
--
-- So the read becomes a write. `for update skip locked` inside an UPDATE is the whole
-- mechanism: the subquery takes a row lock on the rows it selects and *skips* any row
-- already locked by another transaction rather than queuing behind it, so two concurrent
-- sweepers partition the due set between them instead of colliding on it. A row leaves
-- this function already claimed, and the claim is committed before a byte is sent.
--
-- WHY A LEASE AND NOT A 'sending' STATUS
--
-- The obvious alternative is a fourth status. It was rejected because it needs a reaper:
-- a process that dies between the claim and the send leaves a row in `sending` for ever,
-- so something has to decide how long is too long and move it back — which is a lease,
-- written twice and in two places.
--
-- This does it once. Claiming pushes `next_attempt_at` `p_lease_seconds` into the future,
-- which is the same column, the same index (`notifications_outbox_due_idx`) and the same
-- "is it due" predicate that already governs retries. A crashed sweeper therefore costs
-- one lease interval of delay and nothing else: the row is simply not due yet, and the
-- next sweep picks it up with no new state to interpret. `status` keeps meaning what it
-- has always meant — what happened to this notification — rather than also meaning which
-- process is holding it.
--
-- WHY `attempts` INCREMENTS HERE AND NOT ON FAILURE
--
-- Because the bound has to hold against the failures that never report one. If `attempts`
-- only rose when a send came back with an error, a row whose send reliably kills the
-- process — a payload that crashes the renderer, a body that exhausts memory — would be
-- reclaimed for ever and never reach `dead`, and the dead-letter rule the spec asks for
-- would be a rule about well-behaved failures only. Counting at the claim makes `attempts`
-- mean "deliveries started", which is the number that can actually be bounded, and five
-- claims is five claims however each of them ended.
--
-- The cost is the honest one: a send that succeeds after the process dies mid-flight is
-- an attempt spent. An outbox is at-least-once by construction and this is the direction
-- to err in.
--
-- WHY SECURITY INVOKER
--
-- The sweeper holds a service-role client, which bypasses RLS, so the function needs no
-- elevation of its own. Leaving it INVOKER means the table's zero-policy state (spec §4:
-- `notifications_outbox` grants nothing to `authenticated`) still applies to anyone else
-- who reaches it — the grant below is the lock, and RLS is the second one behind it.
-- 17_outbox_sweeper.test.sql pins both.

set check_function_bodies = off;

-- ---------------------------------------------------------------------------
-- public.claim_outbox_batch(p_limit, p_lease_seconds, p_ids)
-- ---------------------------------------------------------------------------
--
-- Returns the rows it has just claimed, with `attempts` already incremented — that value
-- is what the caller applies the dead-letter rule to, so it must be the post-claim count.
--
-- `p_ids` narrows the sweep to a known set and is what `dispatchOutbox` passes: the
-- immediate attempt wants the rows it just inserted, not the backlog. Null means "whatever
-- is due", which is the cron sweep. Both paths go through this one claim, so the two
-- callers cannot race each other either.
--
-- `order by next_attempt_at` and not `created_at`: the queue is ordered by when a row is
-- owed, not when it was written, or a single failing row that has backed off to an hour
-- would keep its place at the head of every sweep and starve everything behind it.
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
language sql
volatile
security invoker
set search_path = ''
as $fn$
  update public.notifications_outbox o
     set attempts = o.attempts + 1,
         next_attempt_at = pg_catalog.now()
           + pg_catalog.make_interval(secs => greatest(p_lease_seconds, 1))
    from (
      select n.id
        from public.notifications_outbox n
       where n.status in ('pending', 'failed')
         and n.next_attempt_at <= pg_catalog.now()
         and (p_ids is null or n.id = any (p_ids))
       order by n.next_attempt_at
       limit greatest(p_limit, 0)
         for update skip locked
    ) due
   where o.id = due.id
  returning o.id, o.recipient_email, o.template, o.payload, o.attempts;
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
