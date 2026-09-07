# Retired storage authorization helpers

Archived in Packet 1D by additive migration
`supabase/migrations/20260815150000_retire_storage_authorization_helpers.sql`.

The retired functions were `private.claim_id_from_object_name`,
`private.can_read_claim_object`, `private.can_write_claim_object`, and
`private.can_manage_claim_object`. They were originally introduced in
`20260809120200_storage.sql` for an anticipated client-direct Storage policy,
but no such policy exists and no production TypeScript called them. Actual
downloads first select the `documents` row with the caller's RLS-bound client,
then use a server-only service-role client to mint a short-lived signed URL and
write the audit event. Uploads validate and authorize through their caller-side
claim/document reads before the service role touches Storage.

The obsolete behavior assertions were replaced by structural pgTAP checks that
the four functions stay absent. Historical migrations remain unchanged so a
fresh database still reproduces the original sequence before the additive
retirement migration runs.
