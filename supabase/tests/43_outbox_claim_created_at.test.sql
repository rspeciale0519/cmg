-- CMG Property Solutions — the claim function has to hand back a row's age
--
-- `SITE_MODE=staff` widens the deliverable-template set, which retroactively releases
-- everything already queued under a newly-permitted template. The engine refuses to send
-- a row older than `OUTBOX_MAX_AGE_DAYS`, and the only column that can answer "how old"
-- is `created_at` — so this file asserts that `claim_outbox_batch` returns it, that the
-- value is the row's own, and that the drop-and-recreate in
-- `20260917130000_outbox_claim_created_at.sql` did not quietly hand the function's
-- privileges to anyone.
--
-- The security assertions come first because they are the ones with something to lose:
-- DROP FUNCTION discards the ACL, and a migration that forgot to restore it would leave
-- the default — EXECUTE to PUBLIC — on a function that returns other people's email
-- addresses out of a table whose whole protection is that nothing is granted on it.
--
-- Everything runs in one transaction and is rolled back, so the absolute counts other
-- files assert are untouched.

begin;
set local client_min_messages = warning;
create extension if not exists pgtap with schema extensions;

select plan(14);

-- ---------------------------------------------------------------------------
-- The grants the drop-and-recreate had to put back
-- ---------------------------------------------------------------------------

select ok(
  not (select prosecdef from pg_proc
        where oid = 'public.claim_outbox_batch(integer,integer,uuid[])'::regprocedure),
  'claim_outbox_batch is still SECURITY INVOKER after the recreate, so it carries no elevation of its own'
);

select ok(
  not has_function_privilege('anon', 'public.claim_outbox_batch(integer,integer,uuid[])', 'execute'),
  'anon still cannot execute the claim function'
);

select ok(
  not has_function_privilege('authenticated', 'public.claim_outbox_batch(integer,integer,uuid[])', 'execute'),
  'authenticated still cannot execute it either — a homeowner or a referring contractor has no business claiming delivery work, and the function returns recipient_email by design'
);

select ok(
  has_function_privilege('service_role', 'public.claim_outbox_batch(integer,integer,uuid[])', 'execute'),
  'service_role can, which is the sweeper and the post-commit dispatch'
);

-- ---------------------------------------------------------------------------
-- The new column, in the signature
-- ---------------------------------------------------------------------------

select ok(
  'created_at' = any (
    select unnest(proargnames) from pg_proc
     where oid = 'public.claim_outbox_batch(integer,integer,uuid[])'::regprocedure
  ),
  'created_at is one of the function''s named results'
);

select is(
  (select count(*)::int from pg_proc p, unnest(p.proallargtypes, p.proargmodes, p.proargnames)
        as a(argtype, argmode, argname)
    where p.oid = 'public.claim_outbox_batch(integer,integer,uuid[])'::regprocedure
      and a.argmode = 't'
      and a.argname = 'created_at'
      and a.argtype = 'timestamptz'::regtype),
  1,
  'and it is a timestamptz OUT column, not a text rendering the caller would have to parse'
);

-- ---------------------------------------------------------------------------
-- The value is the row's own, for a fresh row and for an old one
-- ---------------------------------------------------------------------------

insert into public.notifications_outbox
  (id, recipient_email, template, payload, status, attempts, next_attempt_at, created_at)
values
  ('42000000-0000-4000-a000-000000000001', 'fresh@example.test', 'lead_auto_reply',
   '{"suite":42,"case":"fresh"}'::jsonb, 'pending', 0, now() - interval '1 minute',
   now() - interval '2 hours'),
  -- The shape the guard exists for: queued in August, held back ever since because its
  -- template was not deliverable, still `pending` and still due.
  ('42000000-0000-4000-a000-000000000002', 'stale@example.test', 'claim_status_update',
   '{"suite":42,"case":"stale"}'::jsonb, 'pending', 0, now() - interval '1 minute',
   now() - interval '45 days'),
  ('42000000-0000-4000-a000-000000000003', 'failed@example.test', 'esign_staff_alert',
   '{"suite":42,"case":"failed"}'::jsonb, 'failed', 2, now() - interval '1 minute',
   now() - interval '9 days');

select is(
  (select c.created_at from public.claim_outbox_batch(
     10, 300, array['42000000-0000-4000-a000-000000000001']::uuid[]) c),
  (select o.created_at from public.notifications_outbox o
    where o.id = '42000000-0000-4000-a000-000000000001'),
  'the returned created_at is the row''s own value and not the claim time'
);

select isnt(
  (select o.created_at from public.notifications_outbox o
    where o.id = '42000000-0000-4000-a000-000000000001'),
  (select o.next_attempt_at from public.notifications_outbox o
    where o.id = '42000000-0000-4000-a000-000000000001'),
  'and claiming rewrote next_attempt_at to the lease while leaving created_at alone — which is exactly why next_attempt_at cannot answer "how old is this"'
);

select is(
  (select c.created_at::date from public.claim_outbox_batch(
     10, 300, array['42000000-0000-4000-a000-000000000002']::uuid[]) c),
  (now() - interval '45 days')::date,
  'a forty-five-day-old row reports forty-five days, so the engine can refuse it'
);

select is(
  (select c.created_at::date from public.claim_outbox_batch(
     10, 300, array['42000000-0000-4000-a000-000000000003']::uuid[]) c),
  (now() - interval '9 days')::date,
  'a failed row that has been retried carries its original queue time, not the time of its last attempt'
);

-- ---------------------------------------------------------------------------
-- Everything the recreate must not have changed
-- ---------------------------------------------------------------------------

insert into public.notifications_outbox
  (id, recipient_email, template, payload, status, attempts, next_attempt_at)
values
  ('42000000-0000-4000-a000-000000000011', 'once@example.test', 'lead_auto_reply',
   '{"suite":42,"case":"lease"}'::jsonb, 'pending', 0, now() - interval '1 minute'),
  ('42000000-0000-4000-a000-000000000012', 'exhausted@example.test', 'lead_auto_reply',
   '{"suite":42,"case":"exhausted"}'::jsonb, 'pending', 5, now() - interval '1 minute');

select is(
  (select count(*)::int from public.claim_outbox_batch(
     10, 300, array['42000000-0000-4000-a000-000000000011']::uuid[])),
  1,
  'a due row is still claimed exactly once'
);

select is(
  (select count(*)::int from public.claim_outbox_batch(
     10, 300, array['42000000-0000-4000-a000-000000000011']::uuid[])),
  0,
  'and is invisible to the next claim, because the lease pushed it past due — the concurrency guard survived the recreate'
);

select is(
  (select count(*)::int from public.claim_outbox_batch(
     10, 300, array['42000000-0000-4000-a000-000000000012']::uuid[])),
  0,
  'an attempt-exhausted row is still never returned for delivery'
);

select is(
  (select o.status::text from public.notifications_outbox o
    where o.id = '42000000-0000-4000-a000-000000000012'),
  'dead',
  'and is still terminalized to dead instead, with the same attempt limit as before'
);

select * from finish();
rollback;
