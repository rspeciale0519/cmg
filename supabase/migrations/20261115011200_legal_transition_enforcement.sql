-- Preserve normal lifecycle gates. The legal RPC may additionally return a
-- handoff to the manager-confirmed stage, backed by an immutable transaction row.
create or replace function public.enforce_claim_status_transition()
returns trigger language plpgsql security definer set search_path='' as $$
declare v_allowed public.claim_status[]; v_legal boolean;
begin
 select exists(select 1 from public.claim_legal_milestones m
   where m.claim_id=old.id and m.recorded_txid=txid_current()
   and m.recorded_by=auth.uid() and m.from_status=old.status and m.to_status=new.status)
 into v_legal;
 v_allowed=public.allowed_claim_transitions(old.status);
 if not v_legal and (v_allowed is null or coalesce(array_length(v_allowed,1),0)=0 or not new.status=any(v_allowed)) then
   raise exception 'Illegal claim status transition' using errcode='23514';
 end if;
 if new.status='lor_sent' and (nullif(btrim(new.carrier),'') is null or nullif(btrim(new.policy_number),'') is null) then
   raise exception 'Carrier and policy required' using errcode='23514';
 end if;
 if new.status in ('lor_signed','with_law_firm') and not exists(select 1 from public.documents where claim_id=old.id and kind='lor_signed') then
   raise exception 'Signed representation required' using errcode='23514';
 end if;
 if new.status='lor_signed' then new.lor_signed_at=coalesce(new.lor_signed_at,now()); end if;
 if new.status='filed' then new.filed_at=coalesce(new.filed_at,now()); end if;
 if new.status='denied' then new.denied_at=coalesce(new.denied_at,now()); end if;
 if new.status='settled' then new.settled_at=coalesce(new.settled_at,now()); end if;
 return new;
end;
$$;
