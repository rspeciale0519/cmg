-- Separate integration state. No existing email or cleanup queue is changed.
create table public.airtable_connections (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null unique references public.partner_companies(id),
  base_id text check (base_id ~ '^app[a-zA-Z0-9]{14,32}$'),
  table_id text check (table_id ~ '^tbl[a-zA-Z0-9]{14,32}$'),
  mappings jsonb not null default '[]',
  default_fields text[] not null default array['claim_ref','status'],
  default_mode text not null default 'manual' check (default_mode in ('automatic','manual','milestones')),
  enabled boolean not null default false,
  config_revision bigint not null default 1,
  needs_reconnect boolean not null default true,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create table public.airtable_credentials (
  connection_id uuid primary key references public.airtable_connections(id),
  ciphertext text not null,
  expires_at timestamptz not null,
  token_version bigint not null default 1,
  refresh_lease uuid, refresh_started_at timestamptz
);
create table public.airtable_oauth_states (
  state_hash text primary key,
  owner_id uuid not null,
  company_id uuid not null references public.partner_companies(id),
  ciphertext text not null,
  expires_at timestamptz not null,
  consumed_at timestamptz
);
create table public.airtable_claim_links (
  claim_id uuid primary key references public.claims(id),
  connection_id uuid not null references public.airtable_connections(id),
  company_id uuid not null references public.partner_companies(id),
  record_id text not null check (record_id ~ '^rec[a-zA-Z0-9]{14,32}$'),
  base_id text not null, table_id text not null,
  mode_override text check (mode_override in ('automatic','manual','milestones')),
  fields_override text[], enabled boolean not null default false,
  review_required boolean not null default true,
  revision bigint not null default 1, source_revision bigint not null default 1,
  config_revision bigint not null,
  last_values jsonb not null default '{}', last_source jsonb not null default '{}',
  authorized_by uuid not null references public.profiles(id),
  updated_at timestamptz not null default now(),
  unique(connection_id, record_id), unique(base_id,table_id,record_id)
);
create table public.airtable_shared_messages (
  id uuid primary key default gen_random_uuid(), claim_id uuid not null references public.claims(id),
  connection_id uuid not null references public.airtable_connections(id),
  body text not null check (length(body) between 1 and 4000),
  author_id uuid not null references public.profiles(id),
  created_at timestamptz not null default now(), request_id uuid not null unique
);
create table public.airtable_delivery_requests (
  id uuid primary key default gen_random_uuid(), claim_id uuid not null references public.claims(id),
  connection_id uuid not null references public.airtable_connections(id), record_id text not null,
  base_id text not null, table_id text not null,
  source_revision bigint not null, config_revision bigint not null, link_revision bigint not null,
  selected_fields text[] not null, source_values jsonb not null, expected_values jsonb not null,
  digest text not null, authorized_by uuid not null, reviewed boolean not null default false,
  status text not null check (status in ('held','pending','sending','uncertain','sent','review_required','superseded')),
  attempts integer not null default 0, lease_token uuid, lease_until timestamptz,
  next_attempt_at timestamptz not null default now(), last_error text,
  created_at timestamptz not null default now(), sent_at timestamptz
);
create index airtable_delivery_pending on public.airtable_delivery_requests(status,next_attempt_at);
create index airtable_delivery_claim on public.airtable_delivery_requests(claim_id,created_at desc);
create table public.airtable_rate_slots (
  base_id text primary key, next_request_at timestamptz not null
);

alter table public.airtable_connections enable row level security;
alter table public.airtable_credentials enable row level security;
alter table public.airtable_oauth_states enable row level security;
alter table public.airtable_claim_links enable row level security;
alter table public.airtable_shared_messages enable row level security;
alter table public.airtable_delivery_requests enable row level security;
alter table public.airtable_rate_slots enable row level security;

create policy airtable_connections_read on public.airtable_connections for select to authenticated using (
  private.is_owner() or exists(select 1 from public.claims c where c.partner_company_id=company_id and private.can_manage_claim(c.id))
);
create policy airtable_links_read on public.airtable_claim_links for select to authenticated using (private.can_manage_claim(claim_id));
create policy airtable_messages_read on public.airtable_shared_messages for select to authenticated using (private.can_manage_claim(claim_id));
create policy airtable_requests_read on public.airtable_delivery_requests for select to authenticated using (private.can_manage_claim(claim_id));

revoke all on public.airtable_connections,public.airtable_credentials,public.airtable_oauth_states,public.airtable_claim_links,public.airtable_shared_messages,public.airtable_delivery_requests,public.airtable_rate_slots from anon,authenticated;
grant select on public.airtable_connections,public.airtable_claim_links,public.airtable_shared_messages,public.airtable_delivery_requests to authenticated;
grant all on public.airtable_connections,public.airtable_credentials,public.airtable_oauth_states,public.airtable_claim_links,public.airtable_shared_messages,public.airtable_delivery_requests,public.airtable_rate_slots to service_role;

create function private.airtable_field_keys() returns text[] language sql immutable set search_path='' as $$
  select array['claim_ref','status','lor_signed_at','filed_at','denied_at','settled_at','homeowner_name','homeowner_email','homeowner_phone','property_address','carrier','claim_number','loss_date','cause','adjuster_name','adjuster_email','law_firm_name','law_firm_email','law_firm_phone','legal_milestone','legal_date','settlement_amount','messages'];
$$;
create function private.airtable_milestone_keys() returns text[] language sql immutable set search_path='' as $$
  select array['claim_ref','status','lor_signed_at','filed_at','denied_at','settled_at','legal_milestone','legal_date'];
$$;
create function private.airtable_field_type_allowed(p_source text,p_type text) returns boolean language sql immutable set search_path='' as $$
 select case
  when p_source='claim_ref' then p_type='singleLineText'
  when p_source='messages' then p_type='multilineText'
  when p_source='settlement_amount' then p_type in ('currency','number')
  when p_type in ('singleLineText','multilineText') then true
  when p_type='email' then p_source in ('homeowner_email','adjuster_email','law_firm_email')
  when p_type='phoneNumber' then p_source in ('homeowner_phone','law_firm_phone')
  when p_type in ('date','dateTime') then p_source in ('lor_signed_at','filed_at','denied_at','settled_at','loss_date','legal_date')
  when p_type='singleSelect' then p_source in ('status','cause','legal_milestone')
  else false end;
$$;
create function private.airtable_actor_allowed(p_actor uuid,p_claim uuid) returns boolean
language sql stable security definer set search_path='' as $$
  select exists(select 1 from public.profiles p join public.claims c on c.id=p_claim
    where p.id=p_actor and p.is_active and (p.role='owner' or (p.role='adjuster' and c.assigned_adjuster_id=p.id)));
$$;
revoke all on function private.airtable_field_keys(),private.airtable_milestone_keys(),private.airtable_actor_allowed(uuid,uuid) from public,anon,authenticated;
revoke all on function private.airtable_field_type_allowed(text,text) from public,anon,authenticated;
