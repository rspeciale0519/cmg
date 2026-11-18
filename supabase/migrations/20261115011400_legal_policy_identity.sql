-- Expand the existing invariant before removing its older fixed-stage form.
-- Only pre-representation intake states may lack insurer or policy identity.
alter table public.claims add constraint claims_policy_identity_by_representation_v2
check (
 status in ('new_intake','under_review','rejected') or (
   carrier is not null and carrier ~ '[^[:space:]]'
   and policy_number is not null and policy_number ~ '[^[:space:]]'
 )
) not valid;
alter table public.claims validate constraint claims_policy_identity_by_representation_v2;
alter table public.claims drop constraint claims_policy_identity_by_representation;
alter table public.claims rename constraint claims_policy_identity_by_representation_v2 to claims_policy_identity_by_representation;
