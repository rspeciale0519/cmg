# Law-firm and Airtable implementation contract

Companion checklist: [implementation record](CMG_LAW_FIRM_AIRTABLE_IMPLEMENTATION_2026-11-15.md).
This document records local preparation. It does not authorize hosted actions or Git mutations.

## Work division

1. Database worker owns new migrations, pgTAP coverage, and schema contract checks.
2. Legal worker owns legal validation, actions, queries, staff/customer components, and focused tests.
3. Airtable worker owns OAuth, mapping, transport, delivery, configuration components, and focused tests.
4. Coordinator owns package generation, shared navigation/integration changes, public policy drafts, combined checks, and independent review.

Do not let two workers edit the same file concurrently.
Freeze exported interfaces before parallel implementation. Send interface changes to the coordinator first.
No worker may change retained environments, install dependencies, commit, push, deploy, or run hosted requests without the coordinator's exact approved scope.

## Legal data and interfaces

Use `with_law_firm` as the new optional status. Add it in a separate migration before dependent SQL objects.
Keep it in `BRANCH_STATUSES`, not the ordinary `PIPELINE`.

Create:

- `law_firms`: firm and contact details, active state, actor and timestamps.
- `claim_legal_handoffs`: claim, firm/contact snapshot, milestone, earlier claim stage, version, and ending information.
- `claim_legal_milestones`: immutable actual-date/recorded-date events with unique request IDs.
- `claim_legal_packages`: immutable reviewed summary and selected-document manifest with unique request IDs.

A partial unique index permits one unfinished handoff per claim, including preparation.
Only Owners and assigned adjusters can manage private handoff/package records.
Expose a separate homeowner-safe progress result. Do not grant customers access to private summary or manifest tables.

Stable exports in `src/lib/legal/types.ts`:

```ts
export type LegalMilestone =
  | "sent" | "accepted" | "lawsuit_filed" | "declined" | "returned";
export type LegalReturnStatus =
  | "lor_signed" | "documenting" | "filed" | "negotiating"
  | "settlement_offered" | "denied" | "reopened";
export type LegalMutationResult = {
  claimId: string;
  handoffId: string;
  milestoneId: string;
  claimStatus: ClaimStatus;
  version: number;
  duplicate: boolean;
};
```

RPC responsibilities:

- `save_law_firm`: Owner-only creation/update/deactivation. No deletion.
- `start_legal_handoff`: claim-manager check, active signed representation, one active handoff, idempotent request ID.
- `prepare_legal_package`: authorized same-claim documents, reviewed field allowlist, summary snapshot, immutable manifest.
- `record_legal_milestone`: claim then handoff lock, expected version, current permissions, legal milestone order, explicit return stage.
- `claim_legal_progress`: only the caller's authorized homeowner-safe result.

Record milestone, claim stage, status history, controlled public activity, audit record, and deduplicated notification in one transaction.
Keep the email template unchanged where possible. The portal destination must come from trusted configuration and have database enforcement.
Never accept an arbitrary caller-supplied email link or private summary text in a homeowner notice.

Use normal FormState actions in `src/lib/actions/legal.ts`.
Use `loadLegalWorkspace(claimId)` and `loadLegalProgress(claimId)` in `src/lib/legal/queries.ts`.
Use `/admin/claims/[id]/legal` with a management-only claim tab.

Guard direct claim updates as well as form actions. The ordinary status picker must not bypass a confirmed handoff.
Capture the earlier claim stage when Sent is confirmed, not when preparation starts.
Close the active handoff when the claim settles without inventing another legal email milestone.

The homeowner progress ladder currently infers completion from phase order.
An early legal handoff must not falsely mark documentation or filing complete.
Use a legal callout and the latest preceding ordinary stage while the legal branch is active.

## Package boundary

Use the existing authorized document-download behavior and audit rules.
Retrieve original bytes directly from short-lived authorized storage links.
Use the existing PDF library for the reviewed summary and approved `fflate` 0.8.3 for ZIP files.
Keep original files intact. Do not merge or modify signed PDFs.
Partition selected original-file content into at most 100 MiB per volume.
Treat an interrupted or incomplete export as incomplete. Do not mark a package sent from a download result.
Record exact selected content and reviewed summary. Avoid storing additional hosted package bytes.

## Airtable data and interfaces

Keep Airtable separate from the email and cleanup queues.

Create:

- `airtable_connections`: company, base/table, mapping, defaults, enabled state, configuration revision.
- `airtable_credentials`: encrypted token pair, expiry, version, refresh lock; service-only access.
- `airtable_claim_links`: unique claim link, company/connection, confirmed record, overrides, revision, last delivered values.
- `airtable_shared_messages`: immutable approved company-facing messages with actor/date.
- `airtable_delivery_requests`: immutable snapshots, versions, approval/delivery states, leases, attempts, safe error codes.
- `airtable_rate_slots`: service-only per-base request coordination.
- Private one-use OAuth state bound to the Owner, company, callback, PKCE verifier, and expiry.

Stable module types:

```ts
export type AirtableSendMode = "automatic" | "manual" | "milestones";
export type AirtableCell = string | number | boolean | null;
export type AirtableFields = Record<string, AirtableCell>;
export type AirtableOutcome =
  | "sent" | "retry" | "uncertain" | "review_required" | "superseded";
export type AirtableSnapshot = {
  requestId: string;
  claimId: string;
  connectionId: string;
  recordId: string;
  sourceRevision: number;
  configRevision: number;
  linkRevision: number;
  fields: AirtableFields;
  messageIds: string[];
  digest: string;
};
```

Use a fixed `ShareField` catalog. Do not accept SQL column names or arbitrary JSON paths from forms.
Mapping entries contain source key, stable field ID, allowed field type, and explicit status-choice mapping where required.
Support text, long text, email, phone, date, date-time, number, currency, and existing single-select choices.
Do not enable type coercion or create new Airtable choices automatically.

RPC responsibilities:

- `configure_airtable_company`: Owner authority, expected revision, validated mapping/defaults.
- `configure_airtable_claim`: current claim manager, company match, confirmed record, overrides, enabled state.
- `preview_airtable_update`: immutable outgoing snapshot and digest.
- `approve_airtable_update`: current source/configuration/link versions and valid authority.
- `retry_airtable_update`: controlled retry of eligible work, never a fresh unauthorized send.
- `claim_airtable_batch`: service-only bounded leases, serialized per external record.
- `airtable_request_ready`: recheck permissions, company/link/configuration immediately before external delivery.
- `settle_airtable_request`: fenced result settlement with safe observed values and retry state.
- `claim_airtable_refresh` and `settle_airtable_refresh`: exclusive refresh ownership and token-version comparison.

Database triggers capture relevant changes in claims, claimants, financials, legal milestones, and explicitly shared messages.
Save outgoing work in the same transaction as the source change.
Split automatic fields from held fields according to the effective mode.
Do not release held changes when a setting changes without explicit review.
Do not queue work for an unlinked/direct claim or disabled company connection.

Module responsibilities under `src/lib/airtable/`:

- `fields.ts`: catalog and field groups.
- `mapping.ts`: schema/mapping validation and outgoing cell conversion.
- `oauth.ts`: authorization, callback, and locked refresh.
- `credentials.ts`: server-only encryption and token access.
- `client.ts`: scoped schema/record reads and PATCH.
- `delivery.ts`: transport-independent delivery decisions.
- `store.ts`: database queue adapter.
- `queries.ts`: safe configuration and claim-sharing view models.
- `src/lib/actions/airtable.ts`: guarded staff actions.

Use `requireOwner()` for connection actions; role-only checks do not enforce AAL2.
Delivery runs only in platform mode. Setup in other modes must clearly remain inactive.
Use `after()` only to attempt already committed work. It is not the durable queue.
Add a separate daily recovery route and controlled Retry. Preserve existing cron paths and schedules.

## Critical Airtable safeguards

- Verify a record inside the selected table with table-scoped List records and exact `RECORD_ID()` matching.
- Do not use Get record alone to prove table membership; that endpoint can search the broader base.
- Update with PATCH and stable field IDs. Never use PUT.
- Set `typecast: false` and validate all intended returned values.
- Do not treat a partial-success or redacted-cell response as complete delivery.
- Serialize sends per linked record and preserve uncertain requests before allowing newer writes.
- Reconcile ambiguous outcomes through scoped readback before retrying.
- Compose complete shared-message history deterministically from approved message records.
- Do not reclaim an expired delivery lease as an unquestioned new send.
- OAuth refresh rotates both tokens. Use an exclusive refresh lock and fenced token update.
- If refresh outcome is unknown, require reconnection rather than reuse an old refresh token.

Official references:

- https://airtable.com/developers/web/api/update-record
- https://airtable.com/developers/web/api/get-record
- https://airtable.com/developers/web/api/oauth-reference
- https://support.airtable.com/docs/managing-api-call-limits-in-airtable

## Validation preparation

The installed default runtimes are Node 24, not Node 22.
Use portable Node 22.22.2 in task scratch if the earlier portable runtime is unavailable.
Verify the official Windows x64 ZIP SHA-256 before execution:
`7c93e9d92bf68c07182b471aa187e35ee6cd08ef0f24ab060dfff605fcc1c57c`.
Source: https://nodejs.org/download/release/v22.22.2/SHASUMS256.txt.
Change only the task process PATH, not global machine settings.

Use the verified Supabase CLI at `C:/Users/rob/scoop/apps/supabase/2.116.0/supabase.exe`, matching CI.
Prepare a new isolated local project named `CMGPA_legal_airtable_disposable` after verifying an unused port block.
Do not reset `CMGPA` or `CMGPA_private_upload_disposable`; both have retained records.
Do not copy hosted environment files into the disposable project.
Request exact setup/reset approval before database execution.

Generate types from the isolated project with the pinned CLI and explicit workdir.
Only replace `src/types/database.ts` after successful generation. Never hand-edit it.
Extend the database-test stack allowlist only for the exact new loopback/port/container identity.

Run focused tests, type-check, lint, full Vitest suite, build, and high-threshold audit under Node 22.
Run pgTAP and the CI database-backed selection only against the approved disposable stack.
Keep all real provider credentials absent from local tests.
Verify relevant roles, all three site modes, desktop and 390px layouts, error/loading/success states, and network failures.
Use native developer access or an approved browser fallback. Do not use Computer Use.

## Approval state

Approved and complete: local branch/checkout setup and exact new dependency installation.
The feature branch is `codex/cmg-law-firm-airtable`, based on published merge `d685032736260b1eaca57045def9edbd677da93e`.
The original checkout and its packages remain intact.

Approved: the separate disposable database scope in `CMG_LEGAL_AIRTABLE_DISPOSABLE_DB_APPROVAL_2026-11-15.md`.
The new stack started successfully. All three permitted resets passed. All 1,554 SQL assertions passed, and raw types were generated.
The retained local databases remain excluded. Database-backed application and actual local route acceptance checks passed.

Not requested yet: commits, push/review, OAuth registration, hosted synthetic tests, and production changes.
Local source implementation and synthetic browser checks passed. Hosted and real-provider acceptance remain unverified.
The implementation report records their results and limits. Hosted acceptance remains unverified.
