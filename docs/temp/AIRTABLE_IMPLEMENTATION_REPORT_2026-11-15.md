# Airtable local implementation

Status: local source, correction checks, database validation, and local integrated acceptance passed. Real Airtable acceptance remains unverified. No hosted action occurred.

## Implemented source

- Migrations `20261115020000` through `20261115020500` add isolated integration tables, RLS, guarded actions, transactional capture, delivery leases, encrypted OAuth state/token storage, and pause controls.
- Owners connect Airtable through scoped OAuth and PKCE. Tokens stay encrypted on the server. Refresh operations have exclusive, versioned leases.
- Owners select an existing base, table, and CMG-owned columns. Stable field IDs and explicit existing choice mappings prevent automatic schema changes.
- Claim managers inspect and confirm an existing record. A short-lived encrypted proof binds the review to the manager, claim, record, configuration, and observed cells.
- Claim links are globally unique by base, table, and record. This prevents two company connections from claiming the same blank external row.
- Initial updates always require review. Claim overrides support automatic, manual, and automatic milestone modes.
- Source triggers capture claim, claimant, financial, legal, shared-message, and assigned-adjuster contact changes in the same transaction.
- Mixed automatic/manual partitions retain unresolved changes when the other partition changes.
- Dedicated shared messages form a complete dated history. Message request IDs prevent duplicate history entries. No history is truncated.
- The worker validates current source, authority, schema, exact table membership, record identity, and reserved-cell baseline.
- It uses PATCH with `typecast: false`. Every returned intended cell must match. Unknown results remain uncertain.
- Uncertain work is read back before another write. Newer work cannot pass that record's uncertainty barrier.
- Reconnecting credentials preserves the reviewed target and its configuration revision. New connections remain disabled.
- The worker claims one item at a time. It attempts at most three items and stops new claims after ten seconds.
- Provider calls have six-second timeouts. The cron route retains `maxDuration = 60`.
- Owner company configuration and management-only claim-sharing pages use existing admin controls.
- All integration work is disabled unless both platform mode and `AIRTABLE_ENABLED=true` apply.
- Owners can pause a company connection without a provider call. Claim managers can pause their own claim sharing.
- Pause preserves the target, revisions, snapshots, and uncertain results. An already-started request can finish.
- Resume permits checking and reconciliation. It holds prior pending work and requires a new full review before writes.

## Stable integration hooks

`scheduleAirtableDelivery(claimId: string): void` is exported from `src/lib/airtable/store.ts`.
Call it only after a successful source transaction. The database queue remains the durable record.

`runAirtableDelivery(claimId?: string): Promise<number>` processes the bounded worker selection.
The separate recovery route is `GET /api/cron/airtable`.
The OAuth callback is `GET /api/integrations/airtable/callback`.

Required future server configuration:

- `AIRTABLE_ENABLED` defaults inactive.
- `AIRTABLE_CLIENT_ID`.
- `AIRTABLE_CLIENT_SECRET`.
- `AIRTABLE_REDIRECT_URI`, fixed HTTPS callback address.
- `AIRTABLE_TOKEN_ENCRYPTION_KEY`, canonical Base64 for 32 random bytes.

No values were read, created, or installed in hosted settings.

## Review corrections

- Added current-source comparison and profile/email triggers after review found a stale-contact path.
- Added final handoff-update capture because legal milestone insertion precedes its handoff update.
- Preserved both queue partitions when one source category changes.
- Initial, configuration, and failed-delivery review barriers persist across source changes. Only explicit current-snapshot approval removes them.
- Added claim-lock authority rechecks and NULL-safe revision/digest checks.
- Recheck Owner authority and active-company status after acquiring the company connection lock.
- Moved the final authority check after rate-slot waiting.
- Preserved ambiguous barriers when readiness fails.
- Any uncertain peer blocks new pending work for the same target, regardless of creation order. The worker repeats this check after its target lock.
- Added global external-record uniqueness and serialization across company connections.
- Aligned settlement and credential lock order with their source-save and refresh operations.
- Added one source/column compatibility rule for the mapping UI and server, with matching database enforcement.
- Reused the native form-reset listener after React 19 reset controls during action commit.
- Kept refused drafts and reviewed settings intact. A successful shared-message save clears its draft explicitly.
- Showed plain enumeration labels in reviews without changing outgoing protocol values.
- Kept provider-specific Basic Base64 URL encoding after checking Airtable's official OAuth reference.

## Validation

- Initial transport/mapping selection: seven tests passed.
- First expanded selection: 22 tests passed; one new date-precision regression failed as intended.
- Fixed date conversion. Changed mapping/OAuth selection: ten tests passed.
- Final focused selection: five files and 26 tests passed.
- Scoped ESLint for all Airtable modules, actions, components, pages, and routes passed with exit code zero.
- Later correction selection passed mapping, delivery, and pause-action tests. One company form interaction exceeded its unchanged five-second limit.
- Three other component cases passed. Final scoped lint, including the shared native reset helper, passed.
- The earlier full suite ran while source changed. It reported 2,008 passes, five failures, and 67 skipped tests across 155 passing files, two failed files, and 17 skipped files. Duration: 3,348.41 seconds.
- Its four mapping failures reported no expected exception. Its existing intake retention test exceeded five seconds.
- A subsequent quiet selection retained default workers and timeouts. Delivery and pause actions passed all 14 tests.
- Three jsdom workers did not start: mapping, Airtable forms, and intake forms. Vitest reported three worker-start timeout errors and exited with code one after 210.61 seconds.
- Those three files did not reach assertions in that quiet selection. The final full rerun has not started.
- A process check confirmed no task test worker remained. The local preview process stayed open.
- Installed Vitest 4.1.12 sends its worker-start response after environment setup. Its unchanged startup limit is 60 seconds.
- An isolated rerun of `mapping.test.ts` passed all ten tests with unchanged settings. Duration: 61.54 seconds; environment setup: 55.12 seconds; assertions: 75 milliseconds.
- The system reported about 1.7 GiB free physical memory from 31.7 GiB total. This is context, not proof of a memory fault.
- The startup evidence identifies slow environment initialization as the immediate limit. No runner deadline, worker setting, or system process was changed.
- The remaining quiet form selection passed both files and all ten tests. Duration: 100.42 seconds; environment setup: 33.30 seconds; assertions: 14.61 seconds.
- This selection included all four Airtable form regressions and all six intake form tests. No assertion or timeout change was needed.
- All five requested files passed across these focused runs: 34 tests total. The prior full-suite failure remains recorded; it is not replaced by a claimed full pass.
- Validation stopped after these results. The final integrated suite must follow approved schema generation and database checks.
- A TypeScript diagnostic failed on missing generated new-schema types. No type guard was bypassed.
- `47_airtable.test.sql` prepares permission, partition, identity, concurrency, null-input, lease, OAuth, and token tests.
- No database migration or pgTAP execution occurred. These require the approved new disposable database.
- The prepared company-deactivation test covers refusal. A concurrent lock-wait test still needs the disposable database.
- This worker ran no browser, provider, or hosted acceptance check.
- The coordinator later completed synthetic component browser checks. Their scope and limits are in `CMG_LEGAL_AIRTABLE_BROWSER_REVIEW_2026-11-15.md`.

## Recovery and open acceptance

Keep the feature disabled until schema generation, database tests, full checks, and authorized browser acceptance pass.
The migration is additive. Existing claim, email, and cleanup behavior remains available when Airtable stays disabled.
No downgrade or deletion is required to pause delivery.
An uncertain provider write remains blocked until its recorded destination can be checked.
Never clear that barrier or remove test records as routine cleanup.

Future exact approvals must cover OAuth registration, server values, the synthetic Airtable base/table, provider access, hosted test writes, and deployment.
A real referring-company connection is optional for launch acceptance.

Official references checked:

- [Airtable OAuth reference](https://airtable.com/developers/web/api/oauth-reference).
- [Airtable update record](https://airtable.com/developers/web/api/update-record).
- [Airtable list records](https://airtable.com/developers/web/api/list-records).
- [Vercel function duration](https://vercel.com/docs/functions/configuring-functions/duration).

Vercel documents a 300-second Hobby maximum with Fluid compute and a 60-second legacy Hobby maximum.
This implementation uses the lower 60-second bound and makes no paid hosting change.
