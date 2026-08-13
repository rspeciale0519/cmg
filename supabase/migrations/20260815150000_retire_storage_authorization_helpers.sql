-- Storage objects are service-role-only. Authorization happens by selecting the
-- documents row through caller RLS before a server action mints a signed URL;
-- these helpers were never called by production code or a storage policy.
drop function if exists private.can_read_claim_object(text);
drop function if exists private.can_write_claim_object(text);
drop function if exists private.can_manage_claim_object(text);
drop function if exists private.claim_id_from_object_name(text);
