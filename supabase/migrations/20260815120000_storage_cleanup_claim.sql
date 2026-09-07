-- CMG Property Solutions — lease and bounded retry state for object cleanup
--
-- A document delete records the exact bucket and path in storage_cleanup_queue.
-- The Storage API call cannot run inside that transaction, so cron workers claim
-- rows here before performing the external delete. FOR UPDATE SKIP LOCKED splits
-- a batch between concurrent workers; next_attempt_at is also the crash lease.

set check_function_bodies = off;

alter table public.storage_cleanup_queue
  add column if not exists next_attempt_at timestamptz;

update public.storage_cleanup_queue
   set next_attempt_at = enqueued_at
 where next_attempt_at is null;

alter table public.storage_cleanup_queue
  alter column next_attempt_at set default now(),
  alter column next_attempt_at set not null;

alter table public.storage_cleanup_queue
  add column if not exists dead_at timestamptz;

alter table public.storage_cleanup_queue
  drop constraint if exists storage_cleanup_queue_one_terminal_state;
alter table public.storage_cleanup_queue
  add constraint storage_cleanup_queue_one_terminal_state
  check (processed_at is null or dead_at is null);

create index if not exists storage_cleanup_queue_due_idx
  on public.storage_cleanup_queue (next_attempt_at, enqueued_at, id)
  where processed_at is null and dead_at is null;

create or replace function public.claim_storage_cleanup_batch(
  p_limit integer default 25,
  p_lease_seconds integer default 300,
  p_max_attempts integer default 5
)
returns table (
  id bigint,
  bucket_id text,
  object_path text,
  attempts integer
)
language plpgsql
volatile
security invoker
set search_path = ''
as $fn$
declare
  v_limit integer := greatest(coalesce(p_limit, 25), 0);
  v_max_attempts integer := greatest(coalesce(p_max_attempts, 5), 1);
  v_terminalized integer := 0;
begin
  -- A process that dies during its final attempt cannot settle the row itself.
  -- Terminalization spends from the same batch budget as fresh claims: one cron
  -- invocation can transition at most p_limit rows, including crash recovery.
  update public.storage_cleanup_queue q
     set dead_at = pg_catalog.now(),
         last_error = 'Cleanup worker lease expired during the final permitted attempt.'
    from (
      select expired.id
        from public.storage_cleanup_queue expired
       where expired.processed_at is null
         and expired.dead_at is null
         and expired.attempts >= v_max_attempts
         and expired.next_attempt_at <= pg_catalog.now()
       order by expired.next_attempt_at, expired.enqueued_at, expired.id
       limit v_limit
         for update skip locked
    ) terminal
   where q.id = terminal.id;

  get diagnostics v_terminalized = row_count;

  return query
  update public.storage_cleanup_queue q
     set attempts = q.attempts + 1,
         next_attempt_at = pg_catalog.now()
           + pg_catalog.make_interval(
               secs => greatest(coalesce(p_lease_seconds, 300), 1)
             )
    from (
      select candidate.id
        from public.storage_cleanup_queue candidate
       where candidate.processed_at is null
         and candidate.dead_at is null
         and candidate.attempts < v_max_attempts
         and candidate.next_attempt_at <= pg_catalog.now()
       order by candidate.next_attempt_at, candidate.enqueued_at, candidate.id
       limit greatest(v_limit - v_terminalized, 0)
         for update skip locked
    ) due
   where q.id = due.id
  returning q.id, q.bucket_id, q.object_path, q.attempts;
end;
$fn$;

revoke all on function public.claim_storage_cleanup_batch(integer, integer, integer)
  from public, anon, authenticated;
grant execute on function public.claim_storage_cleanup_batch(integer, integer, integer)
  to service_role;
