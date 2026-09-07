-- CMG Property Solutions — private document storage
-- Single private bucket `claim-docs` (spec §4 Storage, §7.5).
-- Paths: claims/{claim_id}/{uuid}.{ext} and intake/{intake_uuid}/{uuid}.{ext}
-- The intake/ prefix is service-role-only: no policy matches it, so pre-accept
-- uploads are unreachable from any client session until they are re-parented.

set check_function_bodies = off;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'claim-docs',
  'claim-docs',
  false,
  26214400,
  array[
    'application/pdf',
    'image/jpeg',
    'image/png',
    'image/webp',
    'image/heic',
    'image/heif',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
  ]
)
on conflict (id) do update set
  public = false,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

-- ---------------------------------------------------------------------------
-- Object-path helpers
-- ---------------------------------------------------------------------------

create or replace function private.claim_id_from_object_name(p_name text)
returns uuid
language sql
immutable
set search_path = ''
as $fn$
  select (
    regexp_match(
      coalesce(p_name, ''),
      '^claims/([0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12})/'
    )
  )[1]::uuid;
$fn$;

-- Reads mirror the documents table exactly: an object is readable iff its
-- documents row is readable (staff with a reason to be on that claim, or the
-- claim's customer on a visibility='customer' document).
create or replace function private.can_read_claim_object(p_name text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $fn$
  select exists (
    select 1
      from public.documents d
     where d.storage_path = p_name
       and (
         private.is_staff_for_claim(d.claim_id)
         or (d.visibility = 'customer' and private.is_claim_customer(d.claim_id))
       )
  );
$fn$;

-- Writes are keyed off the path's claim id, because the documents row is
-- inserted after the object lands.
create or replace function private.can_write_claim_object(p_name text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $fn$
  select case
    when private.claim_id_from_object_name(p_name) is null then false
    when private.is_staff_for_claim(private.claim_id_from_object_name(p_name)) then exists (
      select 1 from public.claims c where c.id = private.claim_id_from_object_name(p_name)
    )
    else private.is_claim_customer(private.claim_id_from_object_name(p_name))
  end;
$fn$;

create or replace function private.can_manage_claim_object(p_name text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $fn$
  select coalesce(private.can_manage_claim(private.claim_id_from_object_name(p_name)), false);
$fn$;

revoke all on function private.claim_id_from_object_name(text) from public, anon;
revoke all on function private.can_read_claim_object(text) from public, anon;
revoke all on function private.can_write_claim_object(text) from public, anon;
revoke all on function private.can_manage_claim_object(text) from public, anon;
grant execute on function private.claim_id_from_object_name(text) to authenticated, service_role;
grant execute on function private.can_read_claim_object(text) to authenticated, service_role;
grant execute on function private.can_write_claim_object(text) to authenticated, service_role;
grant execute on function private.can_manage_claim_object(text) to authenticated, service_role;

-- ---------------------------------------------------------------------------
-- storage.objects policies for the claim-docs bucket: deliberately none.
--
-- Spec §4 and §7.5 both state it plainly — v1 has no client-direct upload or
-- download path. Every read is a 5-minute signed URL issued by a server action after
-- an authz check and written to audit_log; every write goes through a server action
-- that validates mime and size and renames the file. A policy granting
-- `authenticated` SELECT or INSERT on storage.objects reopens exactly the routes
-- those rules close: bytes could be pulled straight from the bucket with no signed
-- URL and no audit entry, and objects could be planted at paths no documents row
-- ever references. UPDATE and DELETE go with them, for the same reason.
--
-- With RLS on and no policy, the bucket is reachable only by the service role, which
-- is the one caller that runs behind those checks. The helpers above stay: the server
-- actions call them to decide whether to issue a URL at all, which is where that
-- decision belongs.
-- ---------------------------------------------------------------------------

drop policy if exists claim_docs_select on storage.objects;
drop policy if exists claim_docs_insert on storage.objects;
drop policy if exists claim_docs_update on storage.objects;
drop policy if exists claim_docs_delete on storage.objects;
