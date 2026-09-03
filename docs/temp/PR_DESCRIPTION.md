# Release CMG simple website mode

Release description for [PR #1](https://github.com/rspeciale0519/cmg/pull/1), targeting `develop`.
Prepared on 2026-09-03.
The reviewed implementation commit `4516a82` and current release-record updates are pushed on `feature/claims-platform`.
The PR remains open. Production merge and deployment remain gated by the unresolved owner prerequisites.

## Problem

The release exposes the public website while keeping private claims workflows disabled through `SITE_MODE=simple`.
An earlier CI run failed before completing validation because the live PandaDoc test read `.env.local` during discovery.
The live test is now shell-opt-in, and the current `verify` and `database` checks pass without local secrets.

The release review also found unsafe failure paths in document cleanup, document signing, and provider-error handling.
An uncertain database response could trigger immediate deletion of a file whose document transaction had committed.
Stored path prefixes alone did not prevent URL normalization or unauthorized attachment of another intake path.
Raw provider messages could reach user responses and durable records.
Expired outbox leases could permit attempts beyond the intended retry bound.

The deletion review found another defect: the document trigger inserted a cleanup intent even when that path already had one pending.
The partial unique index then rejected the document deletion.
The reviewed local migration now reuses that pending work without changing its worker state or terminal history.

Later full pgTAP validation found an outbox batch-limit failure: three rows became terminal when the assertion expected two.
The local fourth migration materializes candidate sets before outbox updates.
Full pgTAP and the platform CI selection passed after the local apply.

The former public upload transport sent files through a Server Action and exceeded Vercel's 4.5 MB request limit.
The user approved direct uploads to private Storage while preserving ten files of 25 MiB each.
The local candidate implements that transport without adding a production dependency.

## Changes

- Keep marketing, contact, intake, public email, and cleanup active in simple mode.
- Keep private routes and the PandaDoc webhook closed until separate platform activation.
- Add simple-mode guards inside private session reads, actions, and login/invite pages.
- Reject webhook UUID metadata unless its length is exactly 36 characters.
- Require shell opt-in before the live draft test reads optional `.env.local`.
- Add discovery regressions without requiring credentials or making live provider calls.
- Reject non-loopback database URLs in test helpers that insert or delete fixtures.
- Send public intake files directly to private Storage; Server Actions receive text, metadata, and session credentials only.
- Reserve immutable upload manifests and cleanup paths before issuing signed tokens with overwrite disabled.
- Copy uploads to separate server-controlled document paths and verify their size, MIME type, signature, identity, and version.
- Commit one intake transaction after file verification and recover its original reference on repeated confirmation.
- Preserve client session state and follow at most ten decreasing verification-progress responses without uploading files again.
- Delay cleanup beyond upload-token expiry and recheck retained paths for late objects.
- Queue exact upload cleanup through the guarded worker after uncertain writes.
- Preserve cleanup intents and exclude committed document paths before removing Storage bytes.
- Reuse pending cleanup work during document deletion without renewing leases or resetting attempts.
- Apply strict fixture cleanup across eight database test callers.
- Capture exact webhook audit fixture IDs through unique synthetic IPv6 inputs and preserve unrelated rows during cleanup.
- Validate canonical document paths before signed URL creation.
- Add database path constraints and deny authenticated inserts into the trusted `intake/` namespace.
- Use generic provider failures and bounded diagnostic fields without copying provider text.
- Bound outbox claims after five attempts, including worker lease expiry.
- Materialize expired and due outbox candidate sets so locking updates retain the batch limit.
- Add affected application, database, and failure-path regressions.
- Correct narrow public grids that exceeded the measured mobile viewport.
- Mark the smooth-scroll contract on the root document and keep focus feedback synchronous for form errors and success panels.
- Keep raw database types reproducible through a separate module for five SQL nullability overrides.
- Use one isolated Vitest worker on Windows and four elsewhere, without removing tests or changing timeouts.
- Reconcile Node 22 setup, local ports, bundled PDF roles, cron schedules, retention limits, and release approvals.

The committed candidate also includes the local Supabase port move and mobile hero corrections.
The local environment uses the 15420 through 15429 port block.
PandaDoc uses bundled single-owner and dual-owner PDFs with `H1` and `H2` roles.
Template UUIDs are not required by the current upload flow.

## Validation

The direct-upload client selection passed three files and 50 tests in each site mode.
Simple mode exited 0 in 42.50 seconds; platform mode exited 0 in 23.38 seconds.
The current pure authorization and mode-boundary selection passed seven files and 45 tests in each site mode.
Scoped client lint and whitespace checks passed.
An earlier simple run passed 46 tests but failed when the form-test worker did not start.
The unchanged retry passed all 50 tests; worker settings, assertions, and timeouts remained intact.
The full simple and platform Vitest runs each passed 98 files and 1,046 tests, with one opt-in live test skipped, after the final mobile widget adjustment.
An earlier platform-mode rerun was incomplete while Docker was stopped. After Docker recovered and the local database was reset, the current platform and simple runs each passed 98 files and 1,046 tests, with one opt-in live test skipped.
After Docker recovered, the approved local reset removed stale fixtures. The fresh local pgTAP run passed all 38 files and 1,250 assertions.
The affected form and Turnstile selection then passed four files and 51 tests in each site mode.
Both production builds passed after the upload, focus, and smooth-scroll changes.
The layout regression test passed, and a fresh local browser run found no new console errors or horizontal overflow at 320px, 390px, or 1280px.
The verified Preview redeployment runs `SITE_MODE=simple`; public routes return 200, platform routes redirect to `/platform-disabled`, cron routes return 401, and the GET webhook returns 405.
Preview security headers remain present, and its public routes passed the recorded responsive checks.

### Earlier validation checkpoint

The results below predate the direct-upload addition and its two migrations.
The full simple-mode run and platform CI selection passed after the audit cleanup correction.
An earlier full pgTAP run failed one assertion; all 1,075 assertions passed after the fourth migration.
The platform CI rerun after that migration passed 29 files and 200 tests, with one live skip.
No earlier passing total applies automatically to these changes.

Focused groups passed during this review; HANDOFF records their exact counts and mode coverage.
Final type-check and full lint each exited 0.
The fresh dependency audit exited 0 with zero vulnerabilities.

Type-check and scoped ESLint passed after the application type-module change.
Raw type generation is reproducible, and 35 `Database` imports use the application module.
No raw generated type was hand-edited, and no dependency was added.
Run new candidate checks after further code or schema changes.
Both simple-mode and platform-mode production builds exited 0 after the code, type, and UI edits.

Type generation after the third migration exited 0, and the raw schema hash remained unchanged.
Generation after the fourth migration also exited 0 with an unchanged SHA256, recorded in HANDOFF.
Final type-check, lint, and both builds used the identical TypeScript files.

The first local reset applied 25 migrations and seed data, then exited 1 at a Storage health timeout.
Storage later recovered after its `vector_store` migration.
Auto-review rejected an earlier reset retry because the user had not yet approved deletion of local data.
That retry did not execute, and the first reset remains a failed historical run.

The user later approved deletion and rebuilding of the LOCAL CMG database only.
Checks confirmed the CMGPA container and loopback database port 15422 and API port 15421.
The approved `npm run db:reset -- --local` exited 0 and reported a local target.
It recreated the database, applied all 29 migrations through `20260830124100`, ran `supabase/seed.sql`, and restarted the containers.
No health timeout occurred, and the current reset gate passed.
No hosted reset, seed, migration, or Git action occurred.

Post-reset `npm run db:test -- --local` passed 38 files and 1,250 assertions, with exit 0.
Database, Storage, Auth, Realtime, Kong, Studio, and `pg_meta` health checks passed; the REST container is running.
No function or migration failed during the rebuilt database checks.
Earlier validation results below predate the approved reset.

Post-reset simple-mode CI passed 30 files and 205 tests, with one live file and test skipped.
It exited 0 in 128.20 seconds.
It used the recorded CI file selection with `SITE_MODE=simple` and live provider actions disabled.

Post-reset platform CI passed 30 files and 205 tests, with one live file and test skipped.
It exited 0 in 73.75 seconds.
Post-reset `npm run db:types` exited 0 with the identical SHA256 recorded in HANDOFF.
The post-reset `npm run type-check` exited 0.
All post-reset checks passed.

Local read-only checks matched all 29 migrations to repository files, through `20260830124100`.
All 20 local public tables have RLS active.
The local `claim-docs` bucket is private with a 26,214,400-byte, or 25 MiB, limit.
Hosted state was not rechecked or changed.

The full Vitest attempt passed 69 files and 628 tests, with one live test skipped.
It failed with 19 worker startup handshake timeouts.
Four-worker attempts also failed during startup under normal process permissions.
Windows now uses one worker, while other hosts use four.
Isolation, tests, assertions, and timeouts remain intact.
The full simple-mode rerun then passed with the Windows one-worker default.

That run passed 89 files and skipped one live file.
It passed 875 tests and skipped one live test, for 876 tests total.
It completed in 573.03 seconds with zero unhandled errors.

The later exact platform CI selection passed 178 tests and skipped one live test.
It failed after one worker startup timeout in `test-support.test.ts`.
That server-only helper test now declares `// @vitest-environment node`.
The focused platform helper selection then passed two files and 20 tests in 1.91 seconds.
The additional affected platform selection passed seven files and 110 tests.

A separate static review found an existing helper that broadly deleted `pandadoc_webhook` audit records.
Earlier local test runs used it, so removal of unrelated local audit records cannot be excluded.
One exact CI rerun was stopped before results while this defect was investigated.

The completed correction changes four test files only.
Unique synthetic IPv6 inputs capture exact fixture audit IDs, and cleanup leaves all other rows unchanged.
Nine ownership and error cases were added without removing original assertions.
Focused platform helper tests passed two files and 29 tests.

Before the fourth migration, the platform CI selection passed 29 files and 200 tests.
One live file and test were skipped.
It exited 0 in 173.89 seconds.
The subsequent full simple-mode run covered those same database files.
These checks made no live provider calls or new hosted writes.

That full simple-mode run passed 89 files and 884 tests, with one live file and test skipped.
It exited 0 in 398.37 seconds.
Final type-check and full lint each exited 0.

The verified command uses the same Vitest file selection as CI:

```powershell
$env:SITE_MODE = "platform"
$env:RESEND_API_KEY = ""
$env:PANDADOC_LIVE_DRAFT_TEST = "0"
npm test -- src/lib/esign src/app/api/pandadoc src/lib/storage-cleanup
```

Strict cleanup's seven cases and the 13 target-helper cases passed in the earlier simple-mode run.
The latest three-file pure selection passed 31 tests with one worker.
The real Storage uncertain-write test passed with strict teardown after migration.

An earlier pgTAP failure came from a synthetic fixture left after an ignored deletion error.
Only that exact fixture was removed after ID, reference, description, timestamp, and document checks.
The original suite 33 collation assertion was fixed.
The earlier full `npm run db:test` passed 35 files and 1,015 assertions across suites 00–34.
This does not change the original failed reset or earlier denied retry.
The later explicitly approved local reset passed separately.

The next full pgTAP run failed suite 32 assertion 20: three rows became terminal, but the assertion expected two.
All other 1,014 assertions passed.
Static evidence strongly supports repeated execution of a limited locking `UPDATE ... FROM` subquery as the cause.
The adverse execution plan was not captured.

Focused suites 32 and 35 passed 84 assertions against the old function, so that control did not reproduce the failure.
They also passed 84 after the fourth migration applied locally.
New suite 35 contains 60 assertions across normal, custom, and generic planner settings.
These settings do not guarantee a particular adverse join order.

The subsequent full `npm run db:test -- --local` passed 36 files and 1,075 assertions, with exit 0.
The platform CI rerun after the fourth migration passed 29 files and 200 tests, with one live file and test skipped.
It exited 0 in 90.58 seconds.
This supersedes the earlier 173.89-second run as final platform CI evidence.

The 884-test simple run, final type-check, final lint, and both builds preceded the fourth SQL-only migration.
Type regeneration afterward produced the identical SHA256.
The full pgTAP and final platform CI results followed that migration.

Six local public routes passed measured layout checks at 320px, 390px, and 1440px after the narrow grid fix.
All 18 final local layout checks passed without horizontal overflow or missing images.
Empty contact and intake forms passed loading and error checks at 390px without persisting records.
Conditional fields, menu click, focus containment, and Escape behavior passed those local checks.

Local contact success passed on desktop, and intake success passed at 320px, 390px, and 1440px.
The success panels received focus without overflow.
Complete keyboard activation and full network tracing remain unverified.

Both local success submissions used synthetic data, disabled Resend, and official Turnstile test keys.
No attachments were uploaded.
Exact identity guards limited teardown to the local UI fixtures and three undelivered pending notifications.
The seed claim count returned to two, and only the test's counter change was restored: `2 → 3 → 2`.
This fixture teardown did not satisfy the reset gate; the later approved local reset passed separately.

The latest Preview passed 15 of 18 public layout checks.
At 320px, `/`, `/about`, and `/contact` each overflowed by 15px, with client width 305px and scroll width 320px.
All Preview layouts at 390px and 1440px passed.
The earlier layout capture found no missing images.
Fresh Preview contact navigation now repeatedly reports Turnstile `110200`, which requires approved hostname configuration.

Locally, prior-claim Yes revealed `priorOutcome`, and second-policyholder No removed four inputs without overflow.
Phone input worked visually; DOM snapshots redact telephone values.
No phone-entry defect was established.

Browser Enter and Space attempts did not activate the native menu button.
Tool behavior or an application issue remains unresolved.
Browser logs retain older Preview errors and can include them during local page evaluation.
Final evidence must filter entries by a fresh navigation timestamp.

Fresh local navigation after `2026-08-30T23:18:43.607Z` checked all six public routes.
No new warning or error logs appeared within that scope, and all checked images loaded.
The local contact GET returned HTTP 200.
Older Preview Turnstile entries were excluded by timestamp.
Full network tracing and native keyboard activation remain unverified.

The full local preview server was temporarily stopped on its identified port to free memory.
The same project server is restored on port 3014 in simple mode, with email and live PandaDoc disabled.
A normal local GET to `/contact` returned HTTP 200 and the expected contact content.

The acceptance tab became a data-URL `ERR_CONNECTION_REFUSED` page while the server was stopped.
Browser Use URL policy blocked access to that old error page after restart.
That attempt ended without further keyboard interaction; the blocked error tabs remain untouched.

A fresh local tab later loaded `/contact` at 390px after an HTTP 200 server check.
Its client width and scroll width both measured 375px, and all images loaded.
No warning or error logs appeared after `2026-08-31T00:26:25.850Z` in that tab.
Enter did not open the menu through either input method, including with the browser visible.
Click opened the menu and focused Home; Escape closed it and restored toggle focus.
Native keyboard activation and full network tracing remain unverified.

The viewport override reset successfully, and all tabs remain open.
Earlier layout, success, and scoped console evidence retain their recorded limits.
The restore and fresh-tab checks made no new hosted writes.

Before the batch-limit failure, the static diff review found no further production-code issue in the local fixes.
No source files were deleted, and no dependency or workflow files changed.
No credential-pattern matches appeared in changed files, and no secret environment names appeared in built client assets.
Final static inspection recorded 103 changed or untracked files and zero deleted files.
The only oversized source file is `lor-dispatch.ts`, at 462 lines, with only a type import change.
Generated database types are exempt from source-file size limits.

The later cleanup correction changes four test files only and passed platform validation.
That completed source and test work preceded the approved direct-upload addition.

Final static review covered the fourth migration and suite 35, including batch bounds, preserved contracts, grants, scoped fixtures, and rollback.
No further confirmed defect was found.
The credential-pattern scan covered all 103 files, including both new SQL files, without matches.

- [x] Full simple-mode regressions after cleanup correction: 89 files and 884 tests, one live skip, exit 0
- [x] Final TypeScript and full ESLint: exit 0
- [x] Additional affected platform selection: seven files and 110 tests
- [x] Production builds in simple and platform modes
- [x] Explicitly approved local database reset: exit 0, all 29 migrations and seed, without a health timeout
- [x] Post-reset pgTAP: 38 files and 1,250 assertions, exit 0
- [x] Post-reset simple-mode CI selection: 30 files and 205 tests, one live skip, exit 0
- [x] Post-reset platform CI selection: 30 files and 205 tests, one live skip, exit 0
- [x] Post-reset type regeneration: exit 0 and unchanged SHA256
- [x] Post-reset type-check after regeneration: exit 0
- [x] Full pgTAP after the fourth migration: 36 files and 1,075 assertions, exit 0
- [x] Focused suites 32 and 35 after the fourth migration: 84 assertions passed
- [x] Generated database types after the third migration; raw schema hash unchanged
- [x] Database type generation after the fourth migration: exit 0 and unchanged SHA256
- [x] Platform CI file selection before the fourth migration: 29 files and 200 tests passed, one live skip
- [x] Simple-mode database file coverage in the full 884-test run before the fourth migration
- [x] Final platform CI selection after the fourth migration: 29 files and 200 tests, one live skip, exit 0
- [x] Fresh dependency audit: exit 0 and zero vulnerabilities
- [x] Static production-code, diff, source-size, and client-secret review within the scope above
- [x] Final static file, source-size, dependency, workflow, and credential-pattern checks
- [x] Cleanup ownership correction and platform helper validation: two files and 29 tests
- [x] Current full simple and platform Vitest runs: 98 files and 1,046 tests per mode, one live skip, exit 0
- [x] Current smooth-scroll layout regression and synchronous form focus regression
- [x] Current mobile Turnstile sizing regression: compact widget below 420px
- [x] Public browser acceptance at desktop, 390px, and 320px; simple-mode private-route closure passed after redeployment
- [x] Current-head GitHub `verify`, `database`, and Vercel checks
- [x] Updated Preview acceptance after the approved push; Preview runs simple mode and closes platform routes

Previous CI run [33099790158](https://github.com/rspeciale0519/cmg/actions/runs/33099790158) failed in both required jobs.
Its pgTAP step passed 32 files and 923 assertions.
Its database Vitest selection passed 22 files and 142 tests but failed live-test discovery.
Those partial results do not make the old run green.

Fresh read-only `gh pr view` confirms PR #1 remains open, targeting `develop`, with the reviewed implementation and documentation commits pushed.
The current `verify`, `database`, Vercel, and Vercel Preview Comments checks pass for the pushed head.
CodeRabbit reports pass status but skipped review because the diff exceeds its 150-file review limit.
The PR description was published from this record; merge and deployment remain unapproved.

The branch Preview uses the pushed implementation and documentation commits.
It runs simple mode and passes the required private-route closure acceptance.
Its `/admin`, `/portal`, and `/partner` requests redirect to `/platform-disabled`; `/login`, `/mfa`, and `/invite` follow the same boundary.
The current deployment is Ready, and no production deployment occurred.

Current Production remains on `37b4ec45db0ff81ccb7f1cabbb9af880370a74f4`.
Its normal `/admin` GET redirects to `/platform-disabled`.
Six local private entry-route GETs also redirect there.
The Vercel aliases serve the CMG app, but `cmgpropertysolutions.net` redirects to `/lander` and its cron API path returns 404.
The custom domain is not routed to the Vercel Production deployment.
The reviewed commits were pushed after approval.
No merge, production deployment, or hosted migration has occurred during this review.

## Security review warning

The warning in the user's screenshot appeared during the security review.
Its exact trigger remains unknown.
Blocked runtime probes were stopped without attempts to bypass the warning.
That earlier security review performed no production writes.
The later Preview write remains a separate incident, recorded below.

## Operational incident

During widget inspection, the review agent accidentally submitted the empty form on the deployed Preview `/contact` page.
The agent disclosed this immediately and stopped hosted submissions.
The response showed the generic human-verification failure.

A hosted read-only aggregate check after `22:55:23Z` found no new leads, claims, or notifications.
It confirmed one contact IP rate-limit row with count 1.
This was a hosted database write; leave the record unchanged.
No hosted settings, schema, backup, deployment, Git write, or mail action occurred.
Subsequent local form actions assert their expected local URL before proceeding.

## Database and recovery

The repository contains 29 migrations, while the last hosted inspection recorded 23.
Six local forward migrations follow that hosted checkpoint:

- `20260830120000_outbox_attempt_limit.sql`
- `20260830121000_document_storage_paths.sql`
- `20260830122000_storage_cleanup_enqueue_idempotent.sql`
- `20260830123000_outbox_batch_materialized.sql`
- `20260830124000_intake_upload_sessions.sql`
- `20260830124100_intake_upload_cleanup.sql`

The earlier approved local reset and its 27-migration checks predate the two upload migrations.
The upload changes require their paired schema and cleanup migrations before the new application deploys.

The third migration received peer review and applied with `supabase migration up --local`, exit 0.
Its rollback-only suite stopped after three of 26 planned assertions against the old trigger with a duplicate-key error.
All 26 assertions passed after the fix.
The local apply did not reset the database or change production.

The fourth migration also applied locally with `supabase migration up --local`, exit 0.
It materializes both candidate sets in `claim_outbox_batch` and preserves the function owner, grants, and queued records.
Full pgTAP passed 1,075 assertions, and the platform CI selection passed 200 tests after the local apply.
Use an approved forward correction if further checks fail.

Back up database data and private Storage objects before approved migration work.
Never reset or seed production.

Retain upload session records, immutable manifests, and cleanup reconciliation during application rollback.
Outstanding signed uploads can complete after an earlier cleanup pass.
Do not clear those records or abandon their cleanup paths because a response was lost.

Preflight existing document paths before applying the canonical-path constraint.
The hosted read-only preflight found `documents=0` and `noncanonical_documents=0`.
Repeat this point-in-time check immediately before the approved migration.
Invalid legacy rows can stop the migration.
Do not rename, quarantine, or delete them automatically.
Use an approved forward repair while retaining the signing guard.

Outbox exhaustion preserves message payloads for operator review.
A worker timeout can follow provider acceptance.
Reconcile the delivery outcome before any approved replay.

Use the ordered recovery procedure in [README.md](../../README.md#recovery-order).
Stop affected writes before a required restore.
Select an application deployment that supports the resulting schema.
Recheck active cron schedules and authorization after rollback.
Vercel Instant Rollback does not update cron jobs.

## Open release conditions

The advertised upload allowance remains ten files of 25 MiB each.
Direct-upload architecture approval and local implementation are complete.
File bytes bypass the Vercel function request limit through signed private Storage uploads.
The current Production deployment does not contain this change, so maximum-size hosted acceptance remains open.

Supabase [signed upload URLs](https://supabase.com/docs/reference/javascript/file-buckets-createsigneduploadurl) remain valid for two hours.
The implementation allows two-hour sessions and five minutes for signing, with cleanup blocked until two hours and 15 minutes after reservation.
It checks token expiry against that boundary and rechecks retained paths for late objects.
Standard uploads retry whole files; client recovery requires the same open tab.
See [HANDOFF.md](HANDOFF.md#approved-public-upload-transport) for implementation and validation details.

Fresh Preview `/contact` navigation repeatedly reported Turnstile `110200`.
Cloudflare defines this as “Domain not authorized” in its [error-code reference](https://developers.cloudflare.com/turnstile/troubleshooting/client-side-errors/error-codes/).
Approved widget hostname configuration remains a launch condition.
No CAPTCHA bypass or configuration change occurred.

Vercel currently uses Hobby.
Its [fair-use rules](https://vercel.com/docs/limits/fair-use-guidelines) require Pro or Enterprise for commercial use.
Vercel Pro is recommended for CMG; no purchase or plan change is approved or completed.
This hosting decision is separate from GitHub's private-repository protection plan.

`develop` lacks enforced branch protection because the current private-repository plan rejects that API operation.
Keep the repository private and resolve the supported plan with the owner.
Live services, domain routing, legal copy, backup readiness, and production acceptance remain owner-controlled conditions.
The Supabase dashboard is signed out; backups and PITR remain unverified.

The outbox runs daily at 14:00 UTC.
Storage cleanup runs daily at 14:17 UTC.
Hobby scheduling can delay execution, retries, and cleanup.
Environment changes need a new deployment.

Private MFA/AAL2 acceptance, PandaDoc, retention automation, export, and erasure remain deferred until platform activation.
Public legal approval remains required before simple-mode launch.

Commit, push, PR update, branch protection, merge, deployment, domain changes, and production writes require separate approval.
A merge to `develop` can trigger Production automatically.
See [HANDOFF.md](HANDOFF.md) for current evidence and [BLOCKERS.md](BLOCKERS.md) for owner-controlled decisions.
