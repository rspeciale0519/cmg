-- Keep stored object keys canonical before a service-role client signs them.
-- Existing generated names and ordinary nested claim paths remain valid.
-- Validate existing rows in this transaction. If validation fails, stop the
-- release and reconcile those rows and their bytes; never delete or rename them
-- automatically. Recovery is a reviewed forward migration with the app guard
-- retained, not a return to accepting noncanonical names.

alter table public.documents
  add constraint documents_storage_path_canonical check (
    storage_path ~ (
      '^claims/' || claim_id::text ||
      '/[A-Za-z0-9_-][A-Za-z0-9._:-]*(/[A-Za-z0-9_-][A-Za-z0-9._:-]*)*$'
    )
    or storage_path ~
      '^intake/[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}/[A-Za-z0-9_-][A-Za-z0-9._:-]*$'
  );

-- Only the trusted intake transaction can attach an intake UUID to a new claim.
-- Authenticated uploads already generate paths under that claim's own prefix.
-- This restrictive policy also applies alongside future permissive policies.
create policy documents_insert_claim_path on public.documents
  as restrictive for insert to authenticated
  with check (storage_path like 'claims/' || claim_id::text || '/%');
