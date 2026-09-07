-- A missing time of loss is unknown, not noon. Public intake supplies the
-- required value explicitly, while partner referrals deliberately leave it
-- null until the homeowner or staff provides one.
alter table public.claims alter column loss_time drop default;

comment on column public.claims.loss_time is
  'Null when the source did not collect a time. Public intake supplies it explicitly; partner referrals do not invent one.';

-- From the moment CMG says a Letter of Representation was sent, every later
-- claim row must continue to name both the carrier and policy. This CHECK also
-- covers service-role inserts at a later status and prevents either value from
-- being cleared after the transition trigger has run. It deliberately excludes
-- carrier tenure and loss time: neither is an identity printed on the letter.
alter table public.claims
  add constraint claims_policy_identity_by_representation
  check (
    status not in (
      'lor_sent',
      'lor_signed',
      'documenting',
      'filed',
      'negotiating',
      'settlement_offered',
      'settled',
      'denied',
      'reopened',
      'closed'
    )
    or (
      carrier is not null
      and carrier ~ '[^[:space:]]'
      and policy_number is not null
      and policy_number ~ '[^[:space:]]'
    )
  ) not valid;

alter table public.claims
  validate constraint claims_policy_identity_by_representation;
