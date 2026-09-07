-- CMG Property Solutions — the outbox holds people's email addresses
--
-- Phase 7 wired every event in spec §6 to `notifications_outbox` and added
-- `public.claim_outbox_batch()` so two sweepers cannot send the same notification twice.
-- Both halves are asserted here, and the security half first, because it is the one with
-- something to lose.
--
-- WHAT THE ROWS ACTUALLY CARRY
--
-- `recipient_email` on every row, and a `payload` that is the rendered template's input —
-- a homeowner's first name and claim reference on a status update, a referring company's
-- inbox on a partner update, the full text of a question a homeowner asked their adjuster.
-- Read end to end, the table is a list of who CMG is in contact with and about what. A
-- customer must not see another customer's row, a partner must not see any of it, and
-- neither should be able to reach the function that hands rows out either — the function
-- returns `recipient_email` by design, so an EXECUTE grant would be a way around the
-- table's zero-policy state rather than a separate question.
--
-- The functional assertions then pin the property the sweeper's correctness rests on:
-- a claimed row is invisible to the next claim. Everything here runs in one transaction
-- and is rolled back, so the absolute counts other files assert are untouched.

begin;
set local client_min_messages = warning;
create extension if not exists pgtap with schema extensions;

select plan(25);

-- ---------------------------------------------------------------------------
-- Three rows to look at, addressed to three different people
-- ---------------------------------------------------------------------------

insert into public.notifications_outbox (id, recipient_email, template, payload, status, next_attempt_at)
values
  ('31000000-0000-4000-a000-000000000001', 'marcus@example.test', 'claim_status_update',
   '{"firstName":"Marcus","claimRef":"CMG-2026-0001"}'::jsonb, 'pending', now() - interval '1 minute'),
  ('31000000-0000-4000-a000-000000000002', 'tyler@palmetto.example', 'partner_status_update',
   '{"companyName":"Palmetto Roofing","claimRef":"CMG-2026-0001"}'::jsonb, 'pending', now() - interval '1 minute'),
  ('31000000-0000-4000-a000-000000000003', 'later@example.test', 'reply_posted',
   '{"firstName":"Dana"}'::jsonb, 'pending', now() + interval '1 hour');

-- ---------------------------------------------------------------------------
-- The table's own defences
-- ---------------------------------------------------------------------------

select ok(
  (select relrowsecurity from pg_class where oid = 'public.notifications_outbox'::regclass),
  'row level security is enabled on notifications_outbox'
);

select is(
  (select count(*)::int from pg_policies
    where schemaname = 'public' and tablename = 'notifications_outbox'),
  0,
  'and it carries no policies at all, which is how spec §4 spells "service role only" — there is no rule to get wrong because there is no rule'
);

select is(
  (select count(*)::int from information_schema.role_table_grants
    where table_schema = 'public' and table_name = 'notifications_outbox'
      and grantee in ('anon', 'authenticated')),
  0,
  'no table privilege is granted to anon or authenticated either, so the refusal happens at the grant layer before any policy is consulted'
);

-- ---------------------------------------------------------------------------
-- The function's grants, and the elevation it deliberately does not have
-- ---------------------------------------------------------------------------

select ok(
  not (select prosecdef from pg_proc
        where oid = 'public.claim_outbox_batch(integer,integer,uuid[])'::regprocedure),
  'claim_outbox_batch is SECURITY INVOKER, so it carries no elevation of its own and the table''s zero-policy state still applies to whoever calls it'
);

select ok(
  not has_function_privilege('anon', 'public.claim_outbox_batch(integer,integer,uuid[])', 'execute'),
  'anon cannot execute the claim function'
);

select ok(
  not has_function_privilege('authenticated', 'public.claim_outbox_batch(integer,integer,uuid[])', 'execute'),
  'and neither can authenticated — the function returns recipient_email, so an EXECUTE grant here would hand out exactly what the table exists to withhold'
);

select ok(
  has_function_privilege('service_role', 'public.claim_outbox_batch(integer,integer,uuid[])', 'execute'),
  'the service role, which is what the sweeper holds, can'
);

-- ---------------------------------------------------------------------------
-- anon — a leaked publishable key
-- ---------------------------------------------------------------------------

set local role anon;

select throws_ok(
  $$ select 1 from public.notifications_outbox $$,
  '42501'::char(5), null::text,
  'an unauthenticated caller cannot read the outbox'
);

select throws_ok(
  $$ select * from public.claim_outbox_batch(10) $$,
  '42501'::char(5), null::text,
  'nor call the function that would hand it rows'
);

select set_config('request.jwt.claims', '', true);
reset role;

-- ---------------------------------------------------------------------------
-- customer — Marcus Bell, whose own address is on row 1
-- ---------------------------------------------------------------------------

set local request.jwt.claims = '{"sub":"00000000-0000-4000-a000-000000000004","role":"authenticated"}';
set local role authenticated;

select throws_ok(
  $$ select 1 from public.notifications_outbox $$,
  '42501'::char(5), null::text,
  'a signed-in homeowner cannot read the outbox — not even the row addressed to them, because a table they can read one row of is a table they can probe for everyone else''s'
);

select throws_ok(
  $$ insert into public.notifications_outbox (recipient_email, template)
     values ('attacker@example.test', 'invite') $$,
  '42501'::char(5), null::text,
  'and cannot write into it, so the outbox cannot be used to make CMG send mail on their behalf'
);

select throws_ok(
  $$ select * from public.claim_outbox_batch(10) $$,
  '42501'::char(5), null::text,
  'and cannot claim delivery work, which would return other people''s addresses'
);

select set_config('request.jwt.claims', '', true);
reset role;

-- ---------------------------------------------------------------------------
-- partner — Tyler Boone, a referring contractor's rep
-- ---------------------------------------------------------------------------

set local request.jwt.claims = '{"sub":"00000000-0000-4000-a000-000000000005","role":"authenticated"}';
set local role authenticated;

select throws_ok(
  $$ select 1 from public.notifications_outbox $$,
  '42501'::char(5), null::text,
  'a partner rep cannot read the outbox either — their whole read surface is claim_partner_summaries, and this table would carry every homeowner CMG has ever emailed'
);

select throws_ok(
  $$ select * from public.claim_outbox_batch(10) $$,
  '42501'::char(5), null::text,
  'and cannot claim delivery work'
);

select set_config('request.jwt.claims', '', true);
reset role;

-- ---------------------------------------------------------------------------
-- The claim, as the sweeper uses it
-- ---------------------------------------------------------------------------

create temp table claimed as
  select * from public.claim_outbox_batch(
    10, 300,
    array['31000000-0000-4000-a000-000000000001',
          '31000000-0000-4000-a000-000000000002',
          '31000000-0000-4000-a000-000000000003']::uuid[]
  );

select is(
  (select count(*)::int from claimed),
  2,
  'the claim takes the two rows that are due and leaves the one scheduled an hour out, so a backed-off row is not dragged forward by the next sweep'
);

select is(
  (select count(*)::int from claimed where attempts = 1),
  2,
  'and returns each with attempts already incremented — that is the number the dead-letter rule is applied to, so it must be the post-claim count'
);

select ok(
  (select bool_and(recipient_email is not null and template is not null) from claimed),
  'each claimed row carries what the renderer needs'
);

-- The property the whole sweeper rests on: a claimed row is no longer due.
select is(
  (select count(*)::int from public.claim_outbox_batch(
    10, 300,
    array['31000000-0000-4000-a000-000000000001',
          '31000000-0000-4000-a000-000000000002']::uuid[]
  )),
  0,
  'claiming the same rows again returns nothing: the lease pushed next_attempt_at into the future, which is what stops a second sweeper — or a post-commit dispatch racing one — sending the same notification twice'
);

select ok(
  (select bool_and(next_attempt_at > now())
     from public.notifications_outbox
    where id in ('31000000-0000-4000-a000-000000000001',
                 '31000000-0000-4000-a000-000000000002')),
  'the lease is on the same column the due predicate already reads, so a sweeper that dies holding a row costs one lease interval and needs no reaper'
);

select is(
  (select status::text from public.notifications_outbox
    where id = '31000000-0000-4000-a000-000000000001'),
  'pending',
  'and status is untouched by the claim — it keeps meaning what happened to the notification rather than also meaning which process is holding it'
);

-- ---------------------------------------------------------------------------
-- The claim's own filters
-- ---------------------------------------------------------------------------

select is(
  (select count(*)::int from public.claim_outbox_batch(10, 300,
    array['31000000-0000-4000-a000-000000000003']::uuid[])),
  0,
  'a row whose next_attempt_at is in the future is not claimable, however narrowly it is asked for'
);

select is(
  (select count(*)::int from public.claim_outbox_batch(0)),
  0,
  'a zero limit claims nothing rather than everything'
);

update public.notifications_outbox
   set status = 'dead', next_attempt_at = now() - interval '1 day'
 where id = '31000000-0000-4000-a000-000000000003';

select is(
  (select count(*)::int from public.claim_outbox_batch(10, 300,
    array['31000000-0000-4000-a000-000000000003']::uuid[])),
  0,
  'a dead row is never claimed again, however long it has been due — five attempts is the end of the ladder, not a pause on it'
);

update public.notifications_outbox
   set status = 'sent', sent_at = now(), next_attempt_at = now() - interval '1 day'
 where id = '31000000-0000-4000-a000-000000000003';

select is(
  (select count(*)::int from public.claim_outbox_batch(10, 300,
    array['31000000-0000-4000-a000-000000000003']::uuid[])),
  0,
  'and neither is a sent one, so a delivered notification cannot be resent by a stale timestamp'
);

update public.notifications_outbox
   set status = 'failed', attempts = 3, next_attempt_at = now() - interval '1 minute'
 where id = '31000000-0000-4000-a000-000000000003';

select is(
  (select attempts from public.claim_outbox_batch(10, 300,
    array['31000000-0000-4000-a000-000000000003']::uuid[])),
  4,
  'a failed row that has come due is claimed and continues its count, so the ladder is walked once rather than restarted'
);

select * from finish();
rollback;
