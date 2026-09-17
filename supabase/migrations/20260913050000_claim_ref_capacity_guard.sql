-- Preserve the four-digit reference contract. PostgreSQL lpad truncates inputs
-- longer than its target width, so 10000 would otherwise become 1000.
-- Recovery is a reviewed forward migration if the annual capacity must grow.
-- This replacement preserves the function identity, grants, and transaction lock.
create or replace function public.next_claim_ref()
returns text
language plpgsql
security definer
set search_path = ''
as $fn$
declare
  v_year integer := extract(year from (now() at time zone 'America/New_York'))::integer;
  v_seq integer;
begin
  insert into public.claim_ref_counters as c (year, last_value)
  values (v_year, 1)
  on conflict (year) do update set last_value = c.last_value + 1
  returning c.last_value into v_seq;

  if v_seq > 9999 then
    raise exception 'Annual claim reference capacity exceeded.' using errcode = '23514';
  end if;

  return 'CMG-' || v_year::text || '-' || lpad(v_seq::text, 4, '0');
end;
$fn$;
