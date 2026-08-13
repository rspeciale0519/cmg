create or replace function private.invite_account_marker(
  p_user_id uuid,
  p_email text
) returns table(
  user_found boolean,
  marker_invite_id uuid,
  marker_attempt_id uuid
)
language plpgsql stable security definer set search_path = '' as $fn$
declare
  v_invite_id text;
  v_attempt_id text;
  v_uuid_pattern constant text :=
    '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$';
begin
  select
    u.raw_app_meta_data ->> 'cmg_invite_id',
    u.raw_app_meta_data ->> 'cmg_attempt_id'
  into v_invite_id, v_attempt_id
  from auth.users u
  where u.id = p_user_id
    and lower(u.email) = lower(p_email);

  if not found then
    return query select false, null::uuid, null::uuid;
    return;
  end if;

  return query select
    true,
    case when v_invite_id ~* v_uuid_pattern then v_invite_id::uuid end,
    case when v_attempt_id ~* v_uuid_pattern then v_attempt_id::uuid end;
end;
$fn$;

revoke all on function private.invite_account_marker(uuid, text)
  from public, anon, authenticated;
grant execute on function private.invite_account_marker(uuid, text)
  to service_role;

create or replace function public.finalize_invite_acceptance(
  p_invite_id uuid,
  p_attempt_id uuid,
  p_user_id uuid,
  p_first_name text,
  p_last_name text,
  p_ip inet
) returns jsonb
language plpgsql volatile security invoker set search_path = '' as $fn$
declare
  v public.invites%rowtype;
  prof public.profiles%rowtype;
  n integer;
  user_found boolean := false;
  marked boolean := false;
  recoverable boolean := false;
  marker_invite_id uuid;
  marker_attempt_id uuid;
  effective_role public.app_role;
begin
  if current_user <> 'service_role' then
    raise exception 'service role required' using errcode = '42501';
  end if;

  select * into v from public.invites where id = p_invite_id for update;
  if not found or v.acceptance_attempt_id is distinct from p_attempt_id then
    raise exception 'acceptance mismatch' using errcode = '42501';
  end if;
  if v.accepted_at is not null then
    return jsonb_build_object('state', 'completed', 'role', v.role);
  end if;
  if v.expires_at <= now() then
    raise exception 'invitation expired' using errcode = '55000';
  end if;

  select m.user_found, m.marker_invite_id, m.marker_attempt_id
  into user_found, marker_invite_id, marker_attempt_id
  from private.invite_account_marker(p_user_id, v.email) m;
  if not user_found then
    raise exception 'account mismatch' using errcode = '42501';
  end if;

  marked := marker_invite_id = v.id and marker_attempt_id = p_attempt_id;
  if not marked and marker_invite_id is not null and marker_attempt_id is not null then
    select exists (
      select 1
      from public.invites prior
      where prior.id = marker_invite_id
        and prior.id <> v.id
        and prior.acceptance_attempt_id = marker_attempt_id
        and prior.accepted_at is null
        and prior.expires_at <= now()
        and lower(btrim(prior.email)) = lower(btrim(v.email))
        and prior.role = v.role
        and prior.claim_id is not distinct from v.claim_id
        and prior.partner_company_id is not distinct from v.partner_company_id
    ) into recoverable;
  end if;

  select * into prof from public.profiles where id = p_user_id for update;
  if marked or recoverable then
    update public.profiles
    set role = v.role,
        partner_company_id = v.partner_company_id,
        first_name = p_first_name,
        last_name = p_last_name
    where id = p_user_id;
  elsif v.role <> 'customer'
    and (prof.role is distinct from v.role
      or prof.partner_company_id is distinct from v.partner_company_id) then
    return jsonb_build_object('state', 'blocked_existing', 'role', prof.role);
  end if;

  if v.role = 'customer' then
    update public.claimants
    set user_id = p_user_id
    where claim_id = v.claim_id
      and lower(email) = v.email
      and (user_id is null or user_id = p_user_id);
    get diagnostics n = row_count;
    if n <> 1 then
      raise exception 'claimant link missing or ambiguous' using errcode = 'P0002';
    end if;
  end if;

  update public.invites
  set accepted_at = now(), accepted_by = p_user_id
  where id = v.id;
  insert into public.audit_log(actor_id, action, entity, entity_id, meta, ip)
  values (
    p_user_id,
    'invite.accepted',
    'invites',
    v.id,
    jsonb_build_object(
      'email', v.email,
      'role', v.role,
      'claim_id', v.claim_id,
      'partner_company_id', v.partner_company_id,
      'attempt_id', p_attempt_id
    ),
    p_ip
  );
  select role into effective_role from public.profiles where id = p_user_id;
  return jsonb_build_object(
    'state', 'completed',
    'role', v.role,
    'effective_role', effective_role,
    'account_origin', case when marked or recoverable then 'invite_created' else 'existing' end
  );
end;
$fn$;

revoke all on function public.finalize_invite_acceptance(uuid, uuid, uuid, text, text, inet)
  from public, anon, authenticated;
grant execute on function public.finalize_invite_acceptance(uuid, uuid, uuid, text, text, inet)
  to service_role;
