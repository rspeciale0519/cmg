-- CMG Property Solutions — the partner referral (`/partner/refer`)
--
-- Phase 6 gives the partner surface its first write, and the write does not go through the
-- caller's client: §4 gives a partner no policy on `claims` or `claimants` at all, so the
-- referral is inserted by the service role behind an app-level check. That is the same
-- position the public intake is in, and it carries the same risk — the temptation, once a
-- surface needs to write, is to open a policy "just for this". This file is the assertion
-- that nothing was opened.
--
-- It also pins the one new database object the feature adds,
-- public.partner_referral_company(), which is how the action learns which company a rep may
-- act for. Its whole value is that the answer comes from Postgres under the caller's own
-- session rather than from a predicate in TypeScript, so its properties are database
-- properties and belong here:
--
--   * an active rep of an active company gets their company, and only theirs;
--   * a rep whose company has been set inactive gets nothing — `status = 'inactive'` is
--     what ends a partner relationship, and it must end the ability to file as well as the
--     ability to read;
--   * a deactivated rep gets nothing;
--   * a customer, the owner and anon get nothing, so it is not a directory.
--
-- And it pins the shape of a referral row itself: four columns that used to be NOT NULL and
-- are now absent on purpose, because §6 does not ask a contractor for the policy side.
--
--   owner      00000000-0000-4000-a000-000000000001  Austin Graham
--   adjuster   00000000-0000-4000-a000-000000000002  Dana Reyes
--   assistant  00000000-0000-4000-a000-000000000003  Priya Nolan
--   customer   00000000-0000-4000-a000-000000000004  Marcus Bell
--   partner    00000000-0000-4000-a000-000000000005  Tyler Boone   (Summit Exteriors LLC)
--   company    10000000-0000-4000-a000-000000000001  Summit Exteriors LLC

begin;
set local client_min_messages = warning;
create extension if not exists pgtap with schema extensions;

select plan(22);

-- ---------------------------------------------------------------------------
-- public.partner_referral_company() — shape and grants
-- ---------------------------------------------------------------------------

select has_function(
  'public'::name, 'partner_referral_company'::name, array[]::name[],
  'the referral company lookup exists in public, where PostgREST can reach it as an RPC — private.current_partner_company_id() cannot be called from the app at all'
);

select is(
  (select p.prosecdef from pg_proc p
     join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and p.proname = 'partner_referral_company'),
  true,
  'it is SECURITY DEFINER, which is the only way it can see a partner_companies row the caller holds no select policy on'
);

select is(
  (select count(*)::int
     from pg_proc p
     join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and p.proname = 'partner_referral_company'
      and has_function_privilege('anon', p.oid, 'EXECUTE')),
  0,
  'anon cannot execute it, so a SECURITY DEFINER reader of partner_companies is not reachable without a session'
);

-- ---------------------------------------------------------------------------
-- The referral row: what a contractor is not asked for
-- ---------------------------------------------------------------------------

select col_is_null('public'::name, 'claims'::name, 'carrier'::name,
  'a claim may exist without a carrier, because a contractor referring a job does not know it and §6 does not ask');
select col_is_null('public'::name, 'claims'::name, 'policy_number'::name,
  'and without a policy number, for the same reason');
select col_is_null('public'::name, 'claims'::name, 'carrier_tenure'::name,
  'and without a carrier tenure — the enum has three labels, all of them lengths of time, so there is no value that means "nobody was asked"');
select col_is_null('public'::name, 'claims'::name, 'loss_time'::name,
  'and without a time of loss: the column still defaults to noon for callers that omit it, so a referral has to pass an explicit null rather than let the desk be told a storm hit at 12pm');

select lives_ok(
  $$ insert into public.claims (
       id, status, property_street, property_city, property_zip,
       carrier, policy_number, carrier_tenure, loss_date, loss_time, cause, description,
       partner_company_id, referrer_name, referrer_email
     ) values (
       '23000000-0000-4000-a000-000000000001', 'new_intake', '88 Referral Way', 'Winter Park', '32789',
       null, null, null, current_date - 9, null, 'hail',
       'Referred from site: south slope stripped, ceiling wet in the back bedroom.',
       '10000000-0000-4000-a000-000000000001',
       'Summit Exteriors LLC — Tyler Boone', 'partner@cmg.test'
     ) $$,
  'the exact row referClaim() writes is accepted: a new intake with a homeowner, a loss and no policy side at all'
);

select matches(
  (select claim_ref from public.claims where id = '23000000-0000-4000-a000-000000000001'),
  '^CMG-\d{4}-\d{4}$',
  'and it is given a reference by the same trigger the public intake relies on, so a referred claim is indistinguishable from a filed one by its handle'
);

-- The success panel tells the rep the claim is on their list already. That sentence is only
-- true because refresh_claim_partner_summary() projects on `partner_company_id is not null`
-- and asks nothing about status — if a status filter were ever added, the copy would start
-- lying and this is what would notice.
select isnt_empty(
  $$ select claim_id from public.claim_partner_summaries
      where claim_id = '23000000-0000-4000-a000-000000000001' $$,
  'the projection appears the moment the referral is written, not when it is accepted'
);

select is(
  (select status from public.claim_partner_summaries
    where claim_id = '23000000-0000-4000-a000-000000000001'),
  'new_intake'::public.claim_status,
  'and it reads new_intake, which is what the rep is told they will see'
);

-- ---------------------------------------------------------------------------
-- The rep — Tyler Boone, Summit Exteriors LLC
-- ---------------------------------------------------------------------------

set local request.jwt.claims = '{"sub":"00000000-0000-4000-a000-000000000005","role":"authenticated"}';
set local role authenticated;

select results_eq(
  $$ select id::text, name from public.partner_referral_company() $$,
  $$ values ('10000000-0000-4000-a000-000000000001'::text, 'Summit Exteriors LLC'::text) $$,
  'an active rep of an active company learns which company they may refer for, and the name the claim''s referrer line is built from'
);

select is(
  (select count(*)::int from public.claims),
  0,
  'and still reads no claim row at all — including the one their own company was just credited with, which is why the referral insert cannot go through their client'
);

select is(
  (select count(*)::int from public.claimants),
  0,
  'nor any homeowner contact row, so the new write path has not turned the referral relationship into a marketing list'
);

-- The two assertions this file exists for.
select throws_ok(
  $$ insert into public.claims (
       status, property_street, property_city, property_zip, loss_date, cause, description,
       partner_company_id
     ) values (
       'new_intake', '1 Direct Insert Ct', 'Orlando', '32801', current_date - 2, 'wind',
       'written straight from a partner session',
       '10000000-0000-4000-a000-000000000001'
     ) $$,
  '42501'::char(5), null::text,
  'a partner cannot create a claim directly: claims_insert_owner is the only INSERT policy on the table and it reduces to is_owner(), so /partner/refer''s service-role write did not come with a policy beside it'
);

select throws_ok(
  $$ insert into public.claimants (claim_id, first_name, last_name, email, initials, is_primary)
     values ('23000000-0000-4000-a000-000000000001', 'Dana', 'Whitfield',
             'dana@example.test', 'DW', true) $$,
  '42501'::char(5), null::text,
  'nor add a claimant to the claim their own company referred: claimants_insert is can_manage_claim(), which a contractor never satisfies'
);

select set_config('request.jwt.claims', '', true);
reset role;

-- ---------------------------------------------------------------------------
-- Not a directory
-- ---------------------------------------------------------------------------

set local request.jwt.claims = '{"sub":"00000000-0000-4000-a000-000000000004","role":"authenticated"}';
set local role authenticated;

select is_empty(
  $$ select * from public.partner_referral_company() $$,
  'a homeowner gets nothing from it, so the function cannot be used to enumerate CMG''s referral partners'
);

select set_config('request.jwt.claims', '', true);
reset role;

set local request.jwt.claims = '{"sub":"00000000-0000-4000-a000-000000000001","role":"authenticated","aal":"aal2"}';
set local role authenticated;

select is_empty(
  $$ select * from public.partner_referral_company() $$,
  'not even the owner reads through it: it answers "which company is the caller a rep of", and the owner is a rep of none — the workspace reads partner_companies directly under its own policy'
);

select set_config('request.jwt.claims', '', true);
reset role;

-- ---------------------------------------------------------------------------
-- Ending the relationship ends the ability to refer
-- ---------------------------------------------------------------------------

update public.partner_companies set status = 'inactive'
 where id = '10000000-0000-4000-a000-000000000001';

set local request.jwt.claims = '{"sub":"00000000-0000-4000-a000-000000000005","role":"authenticated"}';
set local role authenticated;

select is_empty(
  $$ select * from public.partner_referral_company() $$,
  'a rep of a company set inactive can no longer file a referral — `status = inactive` is how a partner relationship is ended, and it has to revoke the write as well as the read'
);

select set_config('request.jwt.claims', '', true);
reset role;

update public.partner_companies set status = 'active'
 where id = '10000000-0000-4000-a000-000000000001';

update public.profiles set is_active = false
 where id = '00000000-0000-4000-a000-000000000005';

set local request.jwt.claims = '{"sub":"00000000-0000-4000-a000-000000000005","role":"authenticated"}';
set local role authenticated;

select is_empty(
  $$ select * from public.partner_referral_company() $$,
  'and a deactivated rep of a live company cannot file either, so removing one person does not require ending the whole relationship'
);

select set_config('request.jwt.claims', '', true);
reset role;

update public.profiles set is_active = true
 where id = '00000000-0000-4000-a000-000000000005';

-- ---------------------------------------------------------------------------
-- anon
-- ---------------------------------------------------------------------------

set local role anon;

select throws_ok(
  $$ select * from public.partner_referral_company() $$,
  '42501'::char(5), null::text,
  'anon is refused at the grant, before the function body can run'
);

select throws_ok(
  $$ insert into public.claims (status, property_street, property_city, property_zip,
                                loss_date, cause, description)
     values ('new_intake', '2 Anon Way', 'Orlando', '32801', current_date - 1, 'wind', 'anon') $$,
  '42501'::char(5), null::text,
  'and holds no grant on claims at all, so the referral surface has not opened a door for an unauthenticated caller either'
);

reset role;

select * from finish();
rollback;
