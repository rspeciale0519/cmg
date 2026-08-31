-- Check the public batch contract under several local planner settings.
-- Planner switches vary the test conditions; they do not guarantee a particular
-- join order or a rescan of a limited candidate query.
begin;
set local client_min_messages = warning;
create extension if not exists pgtap with schema extensions;
set local search_path = public, extensions;
select plan(60);

-- Each run owns 27 distinct IDs. Never clear a collision: an unexpected existing
-- fixture must fail the INSERT. Every worker call supplies an explicit p_ids.
create function pg_temp.check_outbox_batch_bounds(p_run integer, p_label text)
returns setof text
language plpgsql
security invoker
as $test$
declare
  v_ids uuid[];
  v_scope uuid[];
  v_returned uuid[];
  v_guards_before jsonb;
begin
  select array_agg(
    ('35000000-0000-4000-a00' || p_run::text || '-' || lpad(n::text, 12, '0'))::uuid
    order by n
  ) into v_ids
  from generate_series(1, 27) as fixture(n);

  insert into public.notifications_outbox
    (id, recipient_email, template, payload, status, attempts, next_attempt_at, last_error)
  select f.id, 'batch35-' || p_run::text || '-' || f.n::text || '@example.test',
    'lead_auto_reply', jsonb_build_object('suite', 35, 'run', p_run, 'fixture', f.n),
    (case when f.n % 2 = 0 then 'failed' else 'pending' end)::public.outbox_status,
    case
      when f.n between 1 and 8 or f.n in (17, 18, 25, 27) then 5
      when f.n = 24 then 2
      else 0
    end,
    case
      when f.n in (24, 25) then now() + interval '1 hour'
      -- Mixed fresh rows are older than exhausted rows. Recovery still takes
      -- priority and spends from the same batch budget.
      when f.n in (17, 18) then now() - interval '1 minute'
      else now() - make_interval(mins => (40 - f.n)::integer)
    end,
    'fixture error retained'
  from unnest(v_ids) with ordinality as f(id, n);

  -- IDs 24 and 25 are active fresh/exhausted leases included in every call.
  -- IDs 26 and 27 are due fresh/exhausted rows excluded from every call.
  select jsonb_agg(to_jsonb(o) order by o.id) into v_guards_before
  from public.notifications_outbox o where o.id = any(v_ids[24:27]);

  v_scope := v_ids[1:8] || v_ids[24:25];
  v_returned := array(select c.id from public.claim_outbox_batch(3, 300, v_scope) c order by c.id);
  return next extensions.is(v_returned, array[]::uuid[],
    p_label || ': exhausted rows are never returned for delivery');
  return next extensions.is(
    array(select o.id from public.notifications_outbox o
      where o.id = any(v_ids[1:8]) and o.status = 'dead' order by o.id),
    v_ids[1:3], p_label || ': recovery stops at the three oldest exhausted rows');
  return next extensions.ok(
    (select bool_and(o.attempts = 5) from public.notifications_outbox o where o.id = any(v_ids[1:8])),
    p_label || ': recovery never spends another delivery attempt');

  v_returned := array(select c.id from public.claim_outbox_batch(3, 300, v_scope) c order by c.id);
  return next extensions.is(v_returned, array[]::uuid[],
    p_label || ': a following recovery call also returns no deliveries');
  return next extensions.is(
    array(select o.id from public.notifications_outbox o
      where o.id = any(v_ids[1:8]) and o.status = 'dead' order by o.id),
    v_ids[1:6], p_label || ': the following recovery call spends only its own three-row budget');

  v_returned := array(select c.id from public.claim_outbox_batch(3, 300, v_scope) c order by c.id);
  return next extensions.is(v_returned, array[]::uuid[],
    p_label || ': the exhausted remainder does not become delivery work');
  return next extensions.is(
    array(select o.id from public.notifications_outbox o
      where o.id = any(v_ids[1:8]) and o.status = 'dead' order by o.id),
    v_ids[1:8], p_label || ': a final call processes the two-row exhausted remainder');

  v_scope := v_ids[9:16] || v_ids[24:25];
  v_returned := array(select c.id from public.claim_outbox_batch(3, 300, v_scope) c order by c.id);
  return next extensions.is(v_returned, v_ids[9:11],
    p_label || ': fresh delivery claims stop at the three oldest due rows');
  return next extensions.is(
    array(select o.id from public.notifications_outbox o
      where o.id = any(v_ids[9:16]) and o.attempts > 0 order by o.id),
    v_ids[9:11], p_label || ': only the returned fresh batch spends attempts');
  return next extensions.ok(
    (select bool_and(o.attempts = 1 and o.next_attempt_at = now() + interval '300 seconds'
      and o.status in ('pending', 'failed'))
      from public.notifications_outbox o where o.id = any(v_ids[9:11])),
    p_label || ': each claimed row spends one attempt and receives an active lease');

  v_returned := array(select c.id from public.claim_outbox_batch(3, 300, v_scope) c order by c.id);
  return next extensions.is(v_returned, v_ids[12:14],
    p_label || ': the following fresh batch claims only the next three unleased rows');
  v_returned := array(select c.id from public.claim_outbox_batch(3, 300, v_scope) c order by c.id);
  return next extensions.is(v_returned, v_ids[15:16],
    p_label || ': the next fresh batch returns the two remaining rows');
  v_returned := array(select c.id from public.claim_outbox_batch(3, 300, v_scope) c order by c.id);
  return next extensions.is(v_returned, array[]::uuid[],
    p_label || ': another call cannot replay active fresh leases');
  return next extensions.ok(
    (select bool_and(o.attempts = 1 and o.next_attempt_at = now() + interval '300 seconds')
      from public.notifications_outbox o where o.id = any(v_ids[9:16])),
    p_label || ': all fresh rows retain exactly one attempt and their original lease');

  v_scope := v_ids[17:23] || v_ids[24:25];
  v_returned := array(select c.id from public.claim_outbox_batch(4, 300, v_scope) c order by c.id);
  return next extensions.is(v_returned, v_ids[19:20],
    p_label || ': two recoveries leave capacity for only two fresh deliveries');
  return next extensions.is(
    array(select o.id from public.notifications_outbox o
      where o.id = any(v_ids[17:23]) and o.status = 'dead' order by o.id),
    v_ids[17:18], p_label || ': the mixed batch terminalizes exactly its two exhausted rows');
  return next extensions.is(
    array(select o.id from public.notifications_outbox o
      where o.id = any(v_ids[19:23]) and o.attempts > 0 order by o.id),
    v_ids[19:20], p_label || ': mixed recovery and delivery share the four-row change budget');

  v_returned := array(select c.id from public.claim_outbox_batch(4, 300, v_scope) c order by c.id);
  return next extensions.is(v_returned, v_ids[21:23],
    p_label || ': the following mixed batch claims only the three remaining deliveries');
  v_returned := array(select c.id from public.claim_outbox_batch(4, 300, v_scope) c order by c.id);
  return next extensions.is(v_returned, array[]::uuid[],
    p_label || ': a later mixed batch cannot replay terminal work or active leases');
  return next extensions.is(
    (select jsonb_agg(to_jsonb(o) order by o.id) from public.notifications_outbox o
      where o.id = any(v_ids[24:27])),
    v_guards_before, p_label || ': active leases and excluded rows remain completely unchanged');
end;
$test$;

set local role service_role;
set local plan_cache_mode = auto;
set local enable_hashjoin = on;
set local enable_mergejoin = on;
set local enable_nestloop = on;
set local enable_material = on;
select * from pg_temp.check_outbox_batch_bounds(1, 'default planner');

set local plan_cache_mode = force_custom_plan;
set local enable_hashjoin = off;
set local enable_mergejoin = off;
set local enable_material = off;
select * from pg_temp.check_outbox_batch_bounds(2, 'custom plan with nested-loop bias');

set local plan_cache_mode = force_generic_plan;
select * from pg_temp.check_outbox_batch_bounds(3, 'generic plan with nested-loop bias');

reset role;
select * from finish();
rollback;
