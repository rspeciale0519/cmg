-- CMG Property Solutions — the public-form throttle.
-- check_rate_limit() is the only thing standing between the unauthenticated intake
-- and contact forms and an attacker with a script. It has to refuse past the budget,
-- keep one caller's budget out of another's, and stay unreadable to the caller.

begin;
set local client_min_messages = warning;
create extension if not exists pgtap with schema extensions;

select plan(17);

-- ---------------------------------------------------------------------------
-- Within the budget
-- ---------------------------------------------------------------------------

select ok(
  public.check_rate_limit('test:ip:198.51.100.10', 3, interval '1 hour'),
  'the first submission from an address is allowed, because throttling must not punish ordinary use'
);

select ok(
  public.check_rate_limit('test:ip:198.51.100.10', 3, interval '1 hour'),
  'the second submission is still allowed'
);

select ok(
  public.check_rate_limit('test:ip:198.51.100.10', 3, interval '1 hour'),
  'the third submission is allowed, so the budget is spent exactly at the stated maximum and not one short of it'
);

-- ---------------------------------------------------------------------------
-- Past the budget
-- ---------------------------------------------------------------------------

select ok(
  not public.check_rate_limit('test:ip:198.51.100.10', 3, interval '1 hour'),
  'the fourth submission inside the window is refused, which is the whole point of the throttle'
);

select ok(
  not public.check_rate_limit('test:ip:198.51.100.10', 3, interval '1 hour'),
  'the refusal persists rather than resetting on the next attempt, so retrying does not reopen the budget'
);

select is(
  (select sum(count)::int from public.rate_limits where key = 'test:ip:198.51.100.10'),
  5,
  'refused attempts are still counted, so a caller cannot regain budget by hammering the endpoint'
);

-- ---------------------------------------------------------------------------
-- Budgets are per key
-- ---------------------------------------------------------------------------

select ok(
  public.check_rate_limit('test:ip:203.0.113.55', 3, interval '1 hour'),
  'a different address gets its own budget, so one abusive submitter cannot lock every other homeowner out of the intake form'
);

select ok(
  public.check_rate_limit('test:ip:203.0.113.55', 3, interval '1 hour'),
  'the second address is still spending its own budget'
);

select ok(
  public.check_rate_limit('test:ip:203.0.113.55', 3, interval '1 hour'),
  'the second address reaches its own maximum independently of the first'
);

select ok(
  not public.check_rate_limit('test:ip:203.0.113.55', 3, interval '1 hour'),
  'the second address is then refused on its own terms, proving the two budgets are tracked separately rather than sharing one counter'
);

select is(
  (select count(distinct key)::int from public.rate_limits where key like 'test:ip:%'),
  2,
  'each key is a row of its own, which is what keeps per-IP and per-email limits from cancelling each other out'
);

-- ---------------------------------------------------------------------------
-- Fixed windows
-- ---------------------------------------------------------------------------

select is(
  (select extract(epoch from window_start)::bigint % 3600
     from public.rate_limits
    where key = 'test:ip:203.0.113.55'
    order by window_start desc limit 1),
  0::bigint,
  'counters are bucketed onto fixed window boundaries rather than sliding from first contact, so an attacker cannot pin the window open by submitting continuously'
);

select ok(
  (select now() >= window_start and now() < window_start + interval '1 hour'
     from public.rate_limits
    where key = 'test:ip:203.0.113.55'
    order by window_start desc limit 1),
  'the bucket a call is counted into is the one containing the current moment'
);

-- ---------------------------------------------------------------------------
-- The throttle refuses nonsense rather than silently allowing it
-- ---------------------------------------------------------------------------

select throws_ok(
  $$ select public.check_rate_limit('   ', 5, interval '1 minute') $$,
  '22023'::char(5), null::text,
  'an empty key is rejected outright: a caller identifier that failed to resolve must not collapse into one shared unlimited bucket'
);

select throws_ok(
  $$ select public.check_rate_limit('test:ip:0.0.0.0', 0, interval '1 minute') $$,
  '22023'::char(5), null::text,
  'a maximum of zero is rejected as a programming error rather than being honoured as a permanent lockout'
);

-- ---------------------------------------------------------------------------
-- The counters themselves stay out of reach
-- ---------------------------------------------------------------------------

select ok(
  not has_function_privilege('anon', 'public.check_rate_limit(text,integer,interval)', 'EXECUTE'),
  'the anon role cannot call the throttle directly, so it cannot be used to burn another caller''s budget from an unauthenticated session'
);

set local request.jwt.claims = '{"sub":"00000000-0000-4000-a000-000000000001","role":"authenticated"}';
set local role authenticated;

select throws_ok(
  $$ select 1 from public.rate_limits $$,
  '42501'::char(5), null::text,
  'even a signed-in owner cannot read the counter table, so the throttle state cannot be inspected or reasoned about from a client session'
);

reset role;

select * from finish();
rollback;
