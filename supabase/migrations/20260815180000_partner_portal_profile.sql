-- The partner portal deliberately cannot read public.partner_companies: that
-- table also carries CMG's internal notes about the relationship. This narrow
-- RPC exposes only the active caller's own company and only the contact fields
-- suitable for showing back to its representatives.
create or replace function public.partner_company_profile()
returns table (
  id uuid,
  name text,
  contact_name text,
  contact_email text,
  contact_phone text
)
language sql
stable
security definer
set search_path = ''
as $fn$
  select pc.id, pc.name, pc.contact_name, pc.contact_email, pc.contact_phone
    from public.partner_companies pc
   where pc.id = private.current_partner_company_id();
$fn$;

revoke all on function public.partner_company_profile() from public, anon;
grant execute on function public.partner_company_profile() to authenticated, service_role;

comment on function public.partner_company_profile() is
  'Returns the active partner caller own company display/contact fields; never notes or another company.';
