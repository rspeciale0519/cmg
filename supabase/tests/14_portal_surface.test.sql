-- CMG Property Solutions — the customer portal's data contract
--
-- Phase 5 renders a homeowner's own claim from four reads and three writes, and each of
-- them rests on a rule the database enforces rather than on a predicate the portal
-- writes. This file pins the ones the surface newly depends on and that no earlier suite
-- already covers:
--
--   * public.portal_claim_contact() — the assigned adjuster's name, which a homeowner
--     cannot obtain any other way (profiles_select_self_or_staff gives them their own row
--     and nothing else). Brand new in this phase, so every property of it is new here:
--     that it answers for the caller's own claim, that it answers *nothing* for anyone
--     else's rather than raising, and that it is not a general directory.
--   * claim_status_history on the caller's OWN claim. 09_phase3_auth_isolation pins the
--     negative — one homeowner cannot read another claim's timeline — and nothing pinned
--     the positive, which is the row source for every date on the portal's progress
--     ladder. A policy change that closed it would empty the ladder silently rather than
--     failing anything.
--   * author_id on a customer's question. 04_rls_roles pins that a homeowner cannot
--     choose the `type` or the `visibility`; the third field they could tamper with is
--     who the entry is *from*, and an entry attributed to their adjuster is worse than
--     either — it puts words in CMG's mouth on CMG's own record.
--   * visibility on a customer's upload. The portal fixes it to 'customer' and never
--     reads it from the form; this is the assertion that the fixing is the policy's and
--     not merely the form's.
--
--   owner      00000000-0000-4000-a000-000000000001  Austin Graham
--   adjuster   00000000-0000-4000-a000-000000000002  Dana Reyes    (assigned claims 1 and 2)
--   assistant  00000000-0000-4000-a000-000000000003  Priya Nolan
--   customer   00000000-0000-4000-a000-000000000004  Marcus Bell   (claimant on claim 1)
--   partner    00000000-0000-4000-a000-000000000005  Tyler Boone   (Summit Exteriors LLC)
--
--   claim 1    20000000-0000-4000-a000-000000000001  settlement_offered
--   claim 2    20000000-0000-4000-a000-000000000002  settled, no linked portal account

begin;
set local client_min_messages = warning;
create extension if not exists pgtap with schema extensions;

select plan(19);

-- ---------------------------------------------------------------------------
-- A second homeowner, on claim 2, so cross-customer assertions are possible at all
-- ---------------------------------------------------------------------------

insert into auth.users (
  instance_id, id, aud, role, email, encrypted_password,
  email_confirmed_at, created_at, updated_at,
  raw_app_meta_data, raw_user_meta_data, is_sso_user, is_anonymous
)
values (
  '00000000-0000-0000-0000-000000000000',
  '00000000-0000-4000-a000-0000000000c2',
  'authenticated', 'authenticated', 'elena.whitfield@example.test',
  crypt('CmgDev!2026', gen_salt('bf')),
  now(), now(), now(),
  '{"provider":"email","providers":["email"]}'::jsonb,
  '{"first_name":"Elena","last_name":"Whitfield"}'::jsonb,
  false, false
);

update public.profiles set role = 'customer'
 where id = '00000000-0000-4000-a000-0000000000c2';

update public.claimants set user_id = '00000000-0000-4000-a000-0000000000c2'
 where id = '30000000-0000-4000-a000-000000000003';

-- ---------------------------------------------------------------------------
-- public.portal_claim_contact() — shape and grants
-- ---------------------------------------------------------------------------

select has_function(
  'public'::name, 'portal_claim_contact'::name, array['uuid'],
  'the portal contact lookup exists in public, where PostgREST can reach it as an RPC'
);

select is(
  (select p.prosecdef from pg_proc p
     join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and p.proname = 'portal_claim_contact'),
  true,
  'it is SECURITY DEFINER, which is the only way it can see a profiles row the caller cannot'
);

select is(
  (select count(*)::int
     from pg_proc p
     join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and p.proname = 'portal_claim_contact'
      and has_function_privilege('anon', p.oid, 'EXECUTE')),
  0,
  'anon cannot execute it, so a SECURITY DEFINER reader of profiles is not reachable without a session'
);

-- ---------------------------------------------------------------------------
-- The homeowner on claim 1
-- ---------------------------------------------------------------------------

set local request.jwt.claims = '{"sub":"00000000-0000-4000-a000-000000000004","role":"authenticated"}';
set local role authenticated;

select results_eq(
  $$ select first_name || ' ' || last_name
       from public.portal_claim_contact('20000000-0000-4000-a000-000000000001') $$,
  $$ values ('Dana Reyes'::text) $$,
  'a homeowner learns the name of the adjuster representing them, which §10 puts on the overview'
);

select is_empty(
  $$ select * from public.portal_claim_contact('20000000-0000-4000-a000-000000000002') $$,
  'and learns nothing about the adjuster on a claim that is not theirs — the same adjuster, so the empty result is the claim scope and not a coincidence of staffing'
);

select is_empty(
  $$ select * from public.portal_claim_contact('00000000-0000-0000-0000-000000000000') $$,
  'a claim id that does not exist answers exactly as one that is not theirs: no row, no raise, nothing to tell the two apart (§7.9)'
);

select isnt_empty(
  $$ select id from public.claim_status_history
      where claim_id = '20000000-0000-4000-a000-000000000001' $$,
  'a homeowner reads the transition log on their own claim, which is where every date on the portal''s progress ladder comes from'
);

select is(
  (select count(*)::int from public.claim_status_history where id in
    ('60000000-0000-4000-a000-000000000001','60000000-0000-4000-a000-000000000002','60000000-0000-4000-a000-000000000003','60000000-0000-4000-a000-000000000004','60000000-0000-4000-a000-000000000005','60000000-0000-4000-a000-000000000006','60000000-0000-4000-a000-000000000007','60000000-0000-4000-a000-000000000008')),
  8,
  'and reads their own claim''s transitions only — the seed writes eight on claim 1 and eight on claim 2'
);

-- The three fields a customer's feed insert could be tampered with. `type` and
-- `visibility` are pinned in 04_rls_roles; this is the third.
select throws_ok(
  $$ insert into public.claim_events (claim_id, type, body, author_id, visibility)
     values ('20000000-0000-4000-a000-000000000001', 'question', 'posted as my adjuster',
             '00000000-0000-4000-a000-000000000002', 'customer') $$,
  '42501'::char(5), null::text,
  'a homeowner cannot attribute a question to their adjuster, so nothing on the record can be made to look like CMG said it'
);

select throws_ok(
  $$ insert into public.claim_events (claim_id, type, body, author_id, visibility)
     values ('20000000-0000-4000-a000-000000000001', 'question', 'reaching the referrer',
             '00000000-0000-4000-a000-000000000004', 'shared') $$,
  '42501'::char(5), null::text,
  'nor mark their own question `shared`, which would push it to the referring contractor'
);

select throws_ok(
  $$ insert into public.documents
       (claim_id, storage_path, original_name, kind, mime, size_bytes, uploaded_by, visibility)
     values ('20000000-0000-4000-a000-000000000001',
             'claims/20000000-0000-4000-a000-000000000001/aaaaaaaa-1111-4111-8111-aaaaaaaaaaaa.jpg',
             'hidden.jpg', 'photo', 'image/jpeg', 1024,
             '00000000-0000-4000-a000-000000000004', 'internal') $$,
  '42501'::char(5), null::text,
  'a homeowner cannot file a document they then cannot see: `visibility` is fixed at customer by the policy, not merely by the form'
);

select lives_ok(
  $$ insert into public.documents
       (claim_id, storage_path, original_name, kind, mime, size_bytes, uploaded_by, visibility)
     values ('20000000-0000-4000-a000-000000000001',
             'claims/20000000-0000-4000-a000-000000000001/bbbbbbbb-2222-4222-8222-bbbbbbbbbbbb.jpg',
             'south-slope-mine.jpg', 'photo', 'image/jpeg', 204800,
             '00000000-0000-4000-a000-000000000004', 'customer') $$,
  'the upload the portal actually performs is permitted, so the restrictions above shape the channel rather than closing it'
);

select set_config('request.jwt.claims', '', true);
reset role;

-- ---------------------------------------------------------------------------
-- The homeowner on claim 2 — the same assertions from the other side
-- ---------------------------------------------------------------------------

set local request.jwt.claims = '{"sub":"00000000-0000-4000-a000-0000000000c2","role":"authenticated"}';
set local role authenticated;

select results_eq(
  $$ select id::text from public.claims where id in
      ('20000000-0000-4000-a000-000000000001','20000000-0000-4000-a000-000000000002') order by id $$,
  $$ values ('20000000-0000-4000-a000-000000000002'::text) $$,
  'the second homeowner sees their own claim and not the first''s'
);

select results_eq(
  $$ select first_name || ' ' || last_name
       from public.portal_claim_contact('20000000-0000-4000-a000-000000000002') $$,
  $$ values ('Dana Reyes'::text) $$,
  'and does learn the adjuster on their own claim'
);

select is_empty(
  $$ select * from public.portal_claim_contact('20000000-0000-4000-a000-000000000001') $$,
  'while the first homeowner''s claim tells them nothing, in the direction the earlier suites do not walk'
);

select is(
  (select count(*)::int from public.claim_financials), 0,
  'the settled claim''s figure is not readable by the homeowner it belongs to, because claim_financials carries no customer policy at all'
);

select set_config('request.jwt.claims', '', true);
reset role;

-- ---------------------------------------------------------------------------
-- Not a directory: the function answers for customers of the claim and nobody else
-- ---------------------------------------------------------------------------

set local request.jwt.claims = '{"sub":"00000000-0000-4000-a000-000000000005","role":"authenticated"}';
set local role authenticated;

select is_empty(
  $$ select * from public.portal_claim_contact('20000000-0000-4000-a000-000000000001') $$,
  'a partner rep cannot use the portal lookup to learn which adjuster works a claim they referred — §4 gives them the projection and nothing about staffing'
);

select set_config('request.jwt.claims', '', true);
reset role;

-- The owner is not a customer of any claim, so the helper answers nothing for them
-- either. Worth pinning: the temptation with a SECURITY DEFINER reader is to widen it
-- "for staff", and the workspace already reads profiles directly under its own policy.
set local request.jwt.claims = '{"sub":"00000000-0000-4000-a000-000000000001","role":"authenticated","aal":"aal2"}';
set local role authenticated;

select is_empty(
  $$ select * from public.portal_claim_contact('20000000-0000-4000-a000-000000000001') $$,
  'not even the owner reads through this function: it answers the claim''s customer, which is the whole of its remit'
);

select set_config('request.jwt.claims', '', true);
reset role;

-- ---------------------------------------------------------------------------
-- anon
-- ---------------------------------------------------------------------------

set local role anon;

select throws_ok(
  $$ select * from public.portal_claim_contact('20000000-0000-4000-a000-000000000001') $$,
  '42501'::char(5), null::text,
  'anon is refused at the grant, before the function body can run'
);

reset role;

select * from finish();
rollback;
