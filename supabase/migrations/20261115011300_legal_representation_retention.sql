-- The optional stage still depends on the signed representation. Extend the
-- existing deletion policy helper rather than creating a second status list.
create or replace function private.claim_past_lor_gate(p_claim_id uuid)
returns boolean language sql stable security definer set search_path='' as $$
 select coalesce(exists(
   select 1 from public.claims where id=p_claim_id and status in (
     'lor_signed','documenting','filed','negotiating','settlement_offered',
     'settled','closed','denied','reopened','with_law_firm'
   )
 ),false);
$$;

-- Relabelling a signed letter would evade the existing deletion policy. Keep
-- the same service-context correction exception as the existing document rules.
create function private.guard_signed_representation_kind()
returns trigger language plpgsql set search_path='' as $$
begin
 if not private.is_service_context() and old.kind='lor_signed'
    and new.kind is distinct from old.kind and private.claim_past_lor_gate(old.claim_id) then
   raise exception 'Signed representation must remain on the claim' using errcode='42501';
 end if;
 return new;
end;
$$;
create trigger documents_guard_signed_representation_kind before update of kind on public.documents
for each row execute function private.guard_signed_representation_kind();
revoke all on function private.guard_signed_representation_kind() from public,anon,authenticated;
