begin;
set local client_min_messages = warning;
create extension if not exists pgtap with schema extensions;

select plan(11);

select is(
  (
    select column_default::text
      from information_schema.columns
     where table_schema = 'public'
       and table_name = 'claims'
       and column_name = 'loss_time'
  ),
  null::text,
  'loss_time has no fabricated default'
);

insert into public.claims (
  id, status, property_street, property_city, property_zip,
  carrier, policy_number, carrier_tenure, loss_date, cause, description
) values (
  '25000000-0000-4000-a000-000000000001', 'new_intake',
  '9 Honest Time Way', 'Orlando', '32801',
  null, null, null, current_date - 2, 'wind',
  'Partner referral whose source did not collect a time.'
);

select is(
  (select loss_time from public.claims where id = '25000000-0000-4000-a000-000000000001'),
  null::time,
  'omitting loss_time stores null rather than fabricating noon'
);

select lives_ok(
  $$ update public.claims set status = 'under_review'
      where id = '25000000-0000-4000-a000-000000000001' $$,
  'an incomplete partner referral can enter review'
);

select throws_ok(
  $$ update public.claims set status = 'lor_sent'
      where id = '25000000-0000-4000-a000-000000000001' $$,
  '23514'::char(5), null::text,
  'the lifecycle still requires carrier and policy before a letter is sent'
);

select throws_ok(
  $$ insert into public.claims (
       id, status, property_street, property_city, property_zip,
       carrier, policy_number, loss_date, cause, description
     ) values (
       '25000000-0000-4000-a000-000000000002', 'lor_sent',
       '10 Direct Insert Rd', 'Orlando', '32801', null, null,
       current_date - 2, 'wind', 'A service-role writer skipped the application.'
     ) $$,
  '23514'::char(5), null::text,
  'a direct insert at lor_sent cannot bypass policy identity'
);

select lives_ok(
  $$ update public.claims
        set carrier = 'Citizens Property Insurance', policy_number = 'FL-CPI-4410'
      where id = '25000000-0000-4000-a000-000000000001' $$,
  'staff can supply the missing identity while the referral is under review'
);

select lives_ok(
  $$ update public.claims set status = 'lor_sent'
      where id = '25000000-0000-4000-a000-000000000001' $$,
  'the referral can proceed once carrier and policy are known'
);

select throws_ok(
  $$ update public.claims set carrier = null
      where id = '25000000-0000-4000-a000-000000000001' $$,
  '23514'::char(5), null::text,
  'carrier cannot be cleared after representation was sent'
);

select throws_ok(
  $$ update public.claims set carrier = '   '
      where id = '25000000-0000-4000-a000-000000000001' $$,
  '23514'::char(5), null::text,
  'carrier cannot be blanked after representation was sent'
);

select throws_ok(
  $$ update public.claims set policy_number = E'\t'
      where id = '25000000-0000-4000-a000-000000000001' $$,
  '23514'::char(5), null::text,
  'policy number cannot be blanked after representation was sent'
);

insert into public.claims (
  id, status, property_street, property_city, property_zip,
  carrier, policy_number, loss_date, cause, description
) values (
  '25000000-0000-4000-a000-000000000003', 'new_intake',
  '11 Declined Referral Ln', 'Orlando', '32801', null, null,
  current_date - 2, 'wind', 'Incomplete referral CMG declines.'
);

select lives_ok(
  $$ update public.claims set status = 'rejected'
      where id = '25000000-0000-4000-a000-000000000003' $$,
  'an incomplete referral may be rejected without inventing policy identity'
);

select * from finish();
rollback;
