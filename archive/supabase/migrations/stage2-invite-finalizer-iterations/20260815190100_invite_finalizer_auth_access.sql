-- Limit elevated auth-schema access to one read-only marker projection.
create or replace function private.invite_account_marker(
  p_user_id uuid,p_email text,p_invite_id uuid,p_attempt_id uuid
) returns table(user_found boolean,marked boolean)
language sql stable security definer set search_path='' as $fn$
  select
    count(*)=1,
    coalesce(bool_or(
      (u.raw_app_meta_data->>'cmg_invite_id')=p_invite_id::text
      and (u.raw_app_meta_data->>'cmg_attempt_id')=p_attempt_id::text
    ),false)
  from auth.users u
  where u.id=p_user_id and lower(u.email)=lower(p_email);
$fn$;
revoke all on function private.invite_account_marker(uuid,text,uuid,uuid) from public,anon,authenticated;
grant execute on function private.invite_account_marker(uuid,text,uuid,uuid) to service_role;

create or replace function public.finalize_invite_acceptance(
  p_invite_id uuid,p_attempt_id uuid,p_user_id uuid,p_first_name text,p_last_name text,p_ip inet
) returns jsonb language plpgsql volatile security invoker set search_path='' as $fn$
declare v public.invites%rowtype; prof public.profiles%rowtype; n integer;
  user_found boolean:=false; marked boolean:=false; effective_role public.app_role;
begin
  if current_user<>'service_role' then raise exception 'service role required' using errcode='42501'; end if;
  select * into v from public.invites where id=p_invite_id for update;
  if not found or v.acceptance_attempt_id is distinct from p_attempt_id then raise exception 'acceptance mismatch' using errcode='42501'; end if;
  if v.accepted_at is not null then return jsonb_build_object('state','completed','role',v.role); end if;
  select m.user_found,m.marked into user_found,marked
  from private.invite_account_marker(p_user_id,v.email,v.id,p_attempt_id) m;
  if not user_found then raise exception 'account mismatch' using errcode='42501'; end if;
  select * into prof from public.profiles where id=p_user_id for update;
  if marked then
    update public.profiles set role=v.role,partner_company_id=v.partner_company_id,
      first_name=p_first_name,last_name=p_last_name where id=p_user_id;
  elsif v.role<>'customer' and (prof.role is distinct from v.role or prof.partner_company_id is distinct from v.partner_company_id) then
    return jsonb_build_object('state','blocked_existing','role',prof.role);
  end if;
  if v.role='customer' then
    update public.claimants set user_id=p_user_id where claim_id=v.claim_id and lower(email)=v.email
      and (user_id is null or user_id=p_user_id); get diagnostics n=row_count;
    if n<>1 then raise exception 'claimant link missing or ambiguous' using errcode='P0002'; end if;
  end if;
  update public.invites set accepted_at=now(),accepted_by=p_user_id where id=v.id;
  insert into public.audit_log(actor_id,action,entity,entity_id,meta,ip)
  values(p_user_id,'invite.accepted','invites',v.id,jsonb_build_object('email',v.email,'role',v.role,
    'claim_id',v.claim_id,'partner_company_id',v.partner_company_id,'attempt_id',p_attempt_id),p_ip);
  select role into effective_role from public.profiles where id=p_user_id;
  return jsonb_build_object('state','completed','role',v.role,'effective_role',effective_role,
    'account_origin',case when marked then 'invite_created' else 'existing' end);
end;
$fn$;
revoke all on function public.finalize_invite_acceptance(uuid,uuid,uuid,text,text,inet) from public,anon,authenticated;
grant execute on function public.finalize_invite_acceptance(uuid,uuid,uuid,text,text,inet) to service_role;
