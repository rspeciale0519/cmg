-- Keep source-vendor lookups and foreign-key checks bounded as intake grows.
-- Recovery: retain this index when reverting application changes.
create index claims_intake_referral_partner_idx
  on public.claims(intake_referral_partner_id);
