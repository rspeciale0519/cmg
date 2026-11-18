create table public.law_firms (
  id uuid primary key default gen_random_uuid(),
  name text not null check (length(btrim(name)) between 1 and 160),
  contact_name text not null check (length(btrim(contact_name)) between 1 and 160),
  contact_email text not null check (length(contact_email) <= 254 and position('@' in contact_email) > 1),
  contact_phone text not null check (length(btrim(contact_phone)) between 1 and 60),
  is_active boolean not null default true,
  created_by uuid not null references public.profiles(id),
  updated_by uuid not null references public.profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create table public.claim_legal_handoffs (
  id uuid primary key default gen_random_uuid(),
  claim_id uuid not null references public.claims(id),
  firm_id uuid not null references public.law_firms(id),
  firm_snapshot jsonb not null check (jsonb_typeof(firm_snapshot) = 'object'),
  milestone text check (milestone in ('sent','accepted','lawsuit_filed','declined','returned')),
  prior_status public.claim_status not null,
  version integer not null default 1 check (version > 0),
  created_by uuid not null references public.profiles(id),
  created_at timestamptz not null default now(),
  ended_at timestamptz,
  outcome text check (outcome in ('declined','returned','settled','cancelled')),
  request_id uuid not null unique,
  cancellation_request_id uuid unique,
  constraint legal_handoff_ending_pair check ((ended_at is null) = (outcome is null))
);
create unique index legal_handoff_one_active on public.claim_legal_handoffs(claim_id) where ended_at is null;
create index legal_handoff_claim_history on public.claim_legal_handoffs(claim_id,created_at);
create table public.claim_legal_milestones (
  id uuid primary key default gen_random_uuid(),
  handoff_id uuid not null references public.claim_legal_handoffs(id),
  claim_id uuid not null references public.claims(id),
  milestone text not null check (milestone in ('sent','accepted','lawsuit_filed','declined','returned')),
  occurred_on date not null,
  recorded_at timestamptz not null default now(),
  recorded_by uuid not null references public.profiles(id),
  from_status public.claim_status not null,
  to_status public.claim_status not null,
  recorded_txid bigint not null default txid_current(),
  request_id uuid not null unique,
  request_payload jsonb not null,
  unique(handoff_id,milestone)
);
create index legal_milestone_claim_history on public.claim_legal_milestones(claim_id,recorded_at);
create table public.claim_legal_packages (
  id uuid primary key default gen_random_uuid(),
  handoff_id uuid not null references public.claim_legal_handoffs(id),
  claim_id uuid not null references public.claims(id),
  snapshot jsonb not null check (jsonb_typeof(snapshot) = 'object'),
  request_payload jsonb not null,
  created_by uuid not null references public.profiles(id),
  created_at timestamptz not null default now(),
  request_id uuid not null unique
);
create index legal_package_handoff on public.claim_legal_packages(handoff_id,created_at);

alter table public.law_firms enable row level security;
alter table public.claim_legal_handoffs enable row level security;
alter table public.claim_legal_milestones enable row level security;
alter table public.claim_legal_packages enable row level security;
create policy law_firms_read on public.law_firms for select to authenticated
using (private.is_owner() or (private.current_app_role() = 'adjuster' and is_active));
create policy legal_handoffs_read on public.claim_legal_handoffs for select to authenticated using (private.can_manage_claim(claim_id));
create policy legal_milestones_read on public.claim_legal_milestones for select to authenticated using (private.can_manage_claim(claim_id));
create policy legal_packages_read on public.claim_legal_packages for select to authenticated using (private.can_manage_claim(claim_id));
revoke all on public.law_firms,public.claim_legal_handoffs,public.claim_legal_milestones,public.claim_legal_packages from public,anon,authenticated,service_role;
grant select on public.law_firms,public.claim_legal_handoffs,public.claim_legal_milestones,public.claim_legal_packages to authenticated,service_role;

create function private.legal_immutable_record() returns trigger language plpgsql set search_path = '' as $$
begin raise exception 'Legal history is immutable' using errcode='23514'; end;
$$;
create trigger legal_milestones_immutable before update or delete on public.claim_legal_milestones for each row execute function private.legal_immutable_record();
create trigger legal_packages_immutable before update or delete on public.claim_legal_packages for each row execute function private.legal_immutable_record();
revoke all on function private.legal_immutable_record() from public,anon,authenticated;

create or replace function public.allowed_claim_transitions(p_from public.claim_status)
returns public.claim_status[] language sql immutable set search_path = '' as $$
select case p_from
 when 'new_intake' then array['under_review','rejected']
 when 'under_review' then array['lor_sent','rejected']
 when 'lor_sent' then array['lor_signed','rejected']
 when 'lor_signed' then array['documenting','with_law_firm']
 when 'documenting' then array['filed','with_law_firm']
 when 'filed' then array['negotiating','denied','with_law_firm']
 when 'negotiating' then array['settlement_offered','denied','with_law_firm']
 when 'settlement_offered' then array['settled','denied','with_law_firm']
 when 'settled' then array['closed']
 when 'denied' then array['reopened','with_law_firm']
 when 'reopened' then array['negotiating','with_law_firm']
 when 'with_law_firm' then array['lor_signed','documenting','filed','negotiating','settlement_offered','denied','reopened','settled']
 else array[]::text[] end::public.claim_status[];
$$;

-- The permission is evidence in an immutable table, written only by the guarded
-- RPC in this same transaction. A user-settable session flag is not authority.
create function private.guard_legal_claim_transition() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
 if tg_op='INSERT' then
   if new.status='with_law_firm' then raise exception 'Use the legal handoff action' using errcode='23514'; end if;
   return new;
 end if;
 if old.status is not distinct from new.status then return new; end if;
 if new.status = 'with_law_firm' or
    (old.status = 'with_law_firm' and new.status not in ('settlement_offered','settled')) then
   if not exists(select 1 from public.claim_legal_milestones m
     where m.claim_id=old.id and m.recorded_txid=txid_current()
       and m.recorded_by=auth.uid() and m.from_status=old.status and m.to_status=new.status) then
     raise exception 'Use the legal handoff action' using errcode='23514';
   end if;
 end if;
 return new;
end;
$$;
create trigger guard_legal_claim_transition before update of status on public.claims
for each row execute function private.guard_legal_claim_transition();
create trigger guard_legal_claim_insert before insert on public.claims
for each row execute function private.guard_legal_claim_transition();
revoke all on function private.guard_legal_claim_transition() from public,anon,authenticated;

create function private.finish_legal_handoff_on_settlement() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
 if new.status='settled' and old.status is distinct from new.status then
   update public.claim_legal_handoffs set ended_at=now(),outcome='settled',version=version+1
   where claim_id=new.id and ended_at is null;
 end if;
 return new;
end;
$$;
create trigger legal_handoff_settled after update of status on public.claims
for each row execute function private.finish_legal_handoff_on_settlement();
revoke all on function private.finish_legal_handoff_on_settlement() from public,anon,authenticated;
