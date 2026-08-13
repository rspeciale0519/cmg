-- A PostgREST computed field keeps claimant matches inside the database. The
-- previous two-step query expanded every matching claimant's claim UUID into
-- an `or=` URL, which made request size grow with the result set.
create or replace function public.claim_search_text(p_claim public.claims)
returns text
language sql
stable
security invoker
set search_path = ''
as $fn$
  select concat_ws(
    ' ',
    p_claim.claim_ref,
    p_claim.property_street,
    p_claim.property_city,
    p_claim.carrier,
    (
      select string_agg(
        concat_ws(' ', c.first_name, c.last_name, c.email),
        ' ' order by c.is_primary desc, c.created_at, c.id
      )
      from public.claimants c
      where c.claim_id = p_claim.id
    )
  );
$fn$;

revoke all on function public.claim_search_text(public.claims) from public, anon;
grant execute on function public.claim_search_text(public.claims) to authenticated, service_role;
