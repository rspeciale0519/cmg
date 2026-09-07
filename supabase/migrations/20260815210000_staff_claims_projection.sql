-- Keep the staff claims list usable without restoring table-level SELECT.
-- A computed field that accepts the composite claims row requires PostgreSQL
-- to materialize every claim column, including server-only e-sign bearer
-- tokens. This projection exposes a fixed safe shape and performs its own role
-- scope before any row can leave the function.
create or replace function public.staff_claims_projection()
returns table (
  id uuid,
  claim_ref text,
  status public.claim_status,
  loss_date date,
  updated_at timestamptz,
  property_street text,
  property_city text,
  property_state text,
  property_zip text,
  assigned_adjuster_id uuid,
  partner_company_id uuid,
  adjuster_name text,
  partner_name text,
  search_text text
)
language sql
stable
security definer
set search_path = ''
as $fn$
  with caller as (
    select private.current_app_role() as app_role, auth.uid() as user_id
  )
  select
    c.id,
    c.claim_ref,
    c.status,
    c.loss_date,
    c.updated_at,
    c.property_street,
    c.property_city,
    c.property_state,
    c.property_zip,
    c.assigned_adjuster_id,
    c.partner_company_id,
    nullif(btrim(concat_ws(' ', adjuster.first_name, adjuster.last_name)), ''),
    partner.name,
    concat_ws(
      ' ',
      c.claim_ref,
      c.property_street,
      c.property_city,
      c.carrier,
      (
        select string_agg(
          concat_ws(' ', claimant.first_name, claimant.last_name, claimant.email),
          ' ' order by claimant.is_primary desc, claimant.created_at, claimant.id
        )
        from public.claimants claimant
        where claimant.claim_id = c.id
      )
    )
  from public.claims c
  cross join caller
  left join public.profiles adjuster on adjuster.id = c.assigned_adjuster_id
  left join public.partner_companies partner on partner.id = c.partner_company_id
  where caller.app_role in ('owner', 'assistant')
     or (
       caller.app_role = 'adjuster'
       and c.assigned_adjuster_id = caller.user_id
     );
$fn$;

revoke all on function public.staff_claims_projection() from public, anon;
grant execute on function public.staff_claims_projection() to authenticated, service_role;

-- Preserve migration history but remove the client grant from the composite
-- computed field. The admin page now filters the safe projection's search_text
-- column, so callers never need PostgreSQL to materialize public.claims.
revoke all on function public.claim_search_text(public.claims)
from public, anon, authenticated, service_role;
