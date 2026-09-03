# CMG simple-mode release handoff

Last reconciled: 2026-09-03.
The release target is `SITE_MODE=simple`.
The current candidate is not ready for release approval.
Core local engineering validation passes for implementation `4516a82`; current release-record updates are pushed.
Owner decisions remain open.
The verified Preview redeployment is Ready and runs `SITE_MODE=simple`. Simple-mode Preview acceptance passed its route boundary checks.
A Ready Vercel deployment does not prove application acceptance or passing GitHub checks.

An accidental empty Preview contact submission wrote one hosted rate-limit record.
The operational incident below records its scope and follow-up.

Use [README.md](../../README.md#simple-mode-production-runbook) for the release procedure.
Use [BLOCKERS.md](BLOCKERS.md) for owner-controlled actions.
Use [PR_DESCRIPTION.md](PR_DESCRIPTION.md) for the local PR draft.
The historical appendix preserves earlier evidence without treating it as current acceptance.

## GitHub and Vercel evidence

These facts came from read-only inspection on 2026-09-03.
The release commit was created locally after review approval.
The PR description update occurred earlier; no branch-protection change, merge, or production deployment occurred during this review.

| Item | Recorded state |
|---|---|
| Branch | `feature/claims-platform` |
| Implementation head | `4516a82` |
| Release-record state | Pushed and clean |
| Local changes | Clean |
| PR | [#1: Release CMG simple website mode](https://github.com/rspeciale0519/cmg/pull/1), targeting `develop` |
| Current CI run | [33783583259](https://github.com/rspeciale0519/cmg/actions/runs/33783583259); `verify` and `database` pass |
| CI review note | CodeRabbit reports pass status but skipped review because 529 files exceed its 150-file limit |
| Branch Preview | [feature-claims-platform Preview](https://cmgps-git-feature-claims-platform-robs-projects-c72886ba.vercel.app), verified simple-mode deployment [cmgps-54mruv7ei-robs-projects-c72886ba.vercel.app](https://cmgps-54mruv7ei-robs-projects-c72886ba.vercel.app), Ready |
| Current Production | `37b4ec45db0ff81ccb7f1cabbb9af880370a74f4`, Ready on 2026-08-14 |
| Production deployment | [37b4ec4 Production](https://cmgps-odbuei20h-robs-projects-c72886ba.vercel.app) |
| Production alias | [cmgps.vercel.app](https://cmgps.vercel.app) |
| Custom domain routing | `cmgpropertysolutions.net` redirects `/admin` to `/lander`; it does not serve the CMG app |
| Future Production branch | Vercel UI confirms `develop`; the current Production deployment came from the feature branch |
| Vercel plan | Hobby; confirmed in the browser |
| Branch protection | `develop` is unprotected; the protection API returned HTTP 403 |

Vercel's [fair-use rules](https://vercel.com/docs/limits/fair-use-guidelines) require Pro or Enterprise for commercial use.
CMG's public business site needs a commercial plan even in simple mode.
Vercel Pro is the recommended plan.
No purchase or plan change is approved or completed.
This blocker is separate from GitHub's private-repository protection plan.
A Vercel plan upgrade does not remove the 4.5 MB request limit.

GitHub reports that private-repository protection needs an eligible plan.
Its response names GitHub Pro or a public repository.
Keep the repository private.
An owner-approved private-repository plan is unresolved.
Manual check review does not provide branch protection.

The verified simple-mode Preview returned 200 for `/`, `/contact`, `/file-a-claim`, and `/platform-disabled`.
Its `/login`, `/mfa`, `/invite`, `/admin`, `/portal`, and `/partner` routes returned 307 to `/platform-disabled`.
Its cron routes returned 401 without a bearer token, and the PandaDoc webhook returned 405 for GET.
Its public routes passed read-only checks at 320px, 390px, and 1280px with no horizontal overflow.
Fresh Preview Tab traversal moved focus through the skip link, logo, navigation, and phone link. Menu activation and full network tracing remain unverified.
Security headers remained present: CSP, `X-Frame-Options: DENY`, `Referrer-Policy`, and HSTS.
The Preview `SITE_MODE=simple` environment write and redeployment are complete.
No production environment write or deployment occurred.

The current remote checks pass for the pushed head.
Do not reuse older passing totals as evidence for the changed candidate.

Fresh read-only `gh pr view` confirms PR #1 is open, targeting `develop`, with the implementation and documentation commits pushed.
Its current `verify`, `database`, Vercel, and Vercel Preview Comments checks pass.
CodeRabbit reports pass status but skipped review because the diff exceeds its 150-file review limit.
The PR description is published from `docs/temp/PR_DESCRIPTION.md`; merge and deployment remain unapproved.

Read-only host routing checks found a production cutover blocker.
The Vercel aliases `cmgps.vercel.app`, `cmgps-rspeciale0519.vercel.app`, and `cmgps-robs-projects-c72886ba.vercel.app` serve this CMG deployment.
The custom domain `cmgpropertysolutions.net` instead redirects `/admin` to `/lander`, and its cron API path returns 404.
The custom domain therefore does not currently point to the Vercel Production app.
No domain, DNS, or production configuration changed.

## Hosted database and service evidence

The inspection read counts, schema state, and configuration presence.
It did not read user identities or secret values.
No production backup, migration, seed, reset, or repair occurred.
The owner explicitly declined a hosted Supabase database backup.
Recovery and PITR readiness remain unverified, so no production migration is authorized.

| Item | Recorded state |
|---|---|
| Hosted migrations | 23 applied, through `20260815240000` |
| Public tables | 20; RLS enabled on all 20 |
| Document bucket | `claim-docs` is private; limit is 26,214,400 bytes, or 25 MiB |
| Document path preflight | `documents=0`, `noncanonical_documents=0` at the time of the read |
| Auth users / profiles | Three Auth users and three profiles; identities and role readiness were not assessed |
| Outbox | Six `dead`, one `failed`, one `pending` |
| Storage cleanup | Zero pending rows |
| Supabase dashboard | Signed out |
| Backups and PITR | Not verified; dashboard inspection could not confirm their configuration |

The path preflight is a point-in-time result.
Repeat it immediately before the approved storage-path migration.
Zero document rows do not prove that Storage contains no objects.

Existing rows are production data.
Do not treat an earlier empty-database statement as current evidence.
Do not reset, seed, delete, or replay hosted rows without separate approval.
Review failed and dead messages before an approved retry.
A lease timeout does not prove that an email provider rejected a send.

Vercel shows `SITE_MODE` for all environments and a Preview branch override.
PandaDoc and Resend settings exist for Production and Preview.
Public and secret Turnstile settings, `CRON_SECRET`, and Supabase keys are present.
Secret values and live provider validity were not verified.
The observed Preview route behavior confirms that its deployed mode is simple.
The Preview environment change and redeployment are complete.

Fresh navigation to Preview `/contact` repeatedly produced Turnstile error `110200`.
Cloudflare defines this as “Domain not authorized” in its [error-code reference](https://developers.cloudflare.com/turnstile/troubleshooting/client-side-errors/error-codes/).
The widget needs approved hostname configuration before hosted public-form acceptance.
No CAPTCHA bypass or configuration change occurred.

| DNS item | Read-only result |
|---|---|
| `cmgpropertysolutions.net` A | `15.197.148.33`, `3.33.130.190` |
| `www.cmgpropertysolutions.net` | CNAME to the apex domain |
| Mail | Microsoft 365 MX and SPF records exist |
| `_dmarc.cmgpropertysolutions.net` | NXDOMAIN |

No domain, DNS, secret, or production configuration changed.
The custom domain HTTPS endpoint returned 200 but served `/lander`, which is a different site from the Vercel aliases.
These DNS records do not prove Resend verification, final website routing, or TLS acceptance for the CMG app.

## Security review warning

The warning in the user's screenshot appeared during the security review.
Its exact trigger remains unknown.
Blocked runtime probes were stopped without attempts to bypass the warning.
That earlier security review performed no production writes.
The later Preview rate-limit write remains a separate incident, recorded below.

## Operational incident — hosted contact submission

During widget inspection, the review agent accidentally submitted the empty form on the deployed Preview `/contact` page.
The agent disclosed the mistake immediately and stopped hosted submissions.
Preview returned the generic human-verification failure.

A hosted read-only aggregate check after `22:55:23Z` confirmed these results:

| Record | Observed change |
|---|---|
| Leads | Zero new rows |
| Claims | Zero new rows |
| Notifications | Zero new rows |
| Contact IP rate limit | One row with count 1 |

This was a hosted database write.
Leave the rate-limit record unchanged.
No hosted settings, schema, backup, deployment, Git write, or mail action occurred.
The incident does not authorize further hosted submissions or cleanup.

Subsequent local browser form actions assert the expected local URL before they proceed.
This record documents an operational incident, not an owner-action blocker.
The Turnstile hostname issue remains a separate configuration blocker.

## Local environment

The local CMGPA Supabase stack is running again, and the database container is healthy.
A prior pgTAP run found stale local fixture state; the approved local reset removed it.
Its API uses port 15421, PostgreSQL uses 15422, Studio uses 15423, and local email uses 15424.
The reserved block is 15420 through 15429.
Use Node.js 22 and `npm ci`.

The current local platform route smoke checks used `http://localhost:3010` with `SITE_MODE=platform`.
Public routes returned HTTP 200, private routes redirected to `/login`, and protected cron routes returned HTTP 401 without a bearer token.
The server belongs to CMGPA and remains healthy.
Earlier port 3011 simple-mode and port 3014 checks remain in the historical appendix.
Email and live PandaDoc remain disabled.
An earlier simple-mode route probe returned HTTP 200 for `/`, `/about`, `/contact`, and `/file-a-claim`.
It returned HTTP 307 to `/platform-disabled` for `/admin`, `/portal`, and `/partner`.
The local REST endpoint and Studio returned HTTP 200 in the same health check.
Those health results predate the current Docker service outage.

Prior local seed data was confirmed disposable before the planned database reset.
The first reset applied 25 migrations and the seed, then exited 1 at the Storage health timeout.
No application migration error was reported.
Storage later became healthy without intervention after its `vector_store` migration completed.

Auto-review rejected an earlier reset retry because the user had not yet approved deletion of local database data.
That retry did not execute.
The original reset remains a failed historical run despite its completed migration replay and later Storage recovery.
Do not infer current MFA enrollment or test totals from the historical seed record.

The user later approved deletion and rebuilding of the LOCAL CMG database only.
Target checks confirmed the CMGPA container, loopback database port 15422, and loopback API port 15421.
The approved `npm run db:reset -- --local` exited 0 and reported a local target.
It recreated the local database and applied all 29 migrations through `20260830124100`.
It ran `supabase/seed.sql` and restarted the containers.
This run had no health timeout, so the current reset gate passed.

Post-reset `npm run db:test -- --local` passed 38 files and 1,250 assertions, with exit 0.
Database, Storage, Auth, Realtime, Kong, Studio, and `pg_meta` health checks passed; the REST container is running.
No function or migration failed during the rebuilt database checks.
No hosted reset, seed, migration, or Git action occurred.

Post-reset simple-mode CI passed 30 files and 205 tests, with one live file and test skipped.
It exited 0 in 128.20 seconds.
It used the recorded CI file selection with `SITE_MODE=simple` and live provider actions disabled.

Post-reset platform CI passed 30 files and 205 tests, with one live file and test skipped.
It exited 0 in 73.75 seconds.
Post-reset `npm run db:types` exited 0 with the identical SHA256 recorded below.
The post-reset `npm run type-check` exited 0.
All post-reset checks passed.

Local read-only verification matched all 29 migration versions exactly to repository files, through `20260830124100`.
All 20 local public tables have RLS active.
The local `claim-docs` bucket remains private with a 26,214,400-byte, or 25 MiB, limit.
These checks did not recheck or change hosted state.

The third migration applied with `supabase migration up --local`, which exited 0.
This command did not reset the database.
The local cleanup removed only the verified synthetic fixture.
The checks matched its ID, reference, description, timestamp, and document metadata before removal.
That local fixture cleanup changed no hosted rows.

The fourth migration also applied locally with `supabase migration up --local`, exit 0.
That checkpoint contained 27 local migration entries and 23 recorded hosted entries.
The later direct-upload change adds two migrations, listed below.
This apply did not reset local data or change the hosted database.

Local email and PandaDoc keys are empty.
Local Turnstile uses test keys.
No live PandaDoc or email test ran during this review.

Later local UI checks submitted synthetic contact and intake data with Resend disabled and official Turnstile test keys.
No attachments were uploaded.
Exact identity guards limited teardown to those local UI fixtures.
Teardown removed three pending local notifications without delivering them.
It restored the seed claim count to two.
It restored only the test's claim-counter change: `2 → 3 → 2`.

Fixture teardown did not satisfy the required database reset.
The later approved local reset passed, as recorded above.

### Local test audit cleanup risk and correction

A separate static review found an existing test helper that broadly deleted `pandadoc_webhook` audit records.
Earlier local test runs used that helper.
Removal of unrelated local audit records cannot be excluded.
One exact CI rerun was stopped before results while this defect was investigated.

The completed correction changes four test files only.
Unique synthetic IPv6 inputs capture exact fixture audit IDs.
Cleanup leaves rows outside those captured IDs unchanged.
Nine ownership and error cases were added.
All original assertions remain.

Focused platform helper tests passed two files and 29 tests.
The subsequent platform CI selection passed, as recorded below.
The subsequent full simple-mode run passed 89 files and 884 tests, with one live file and test skipped.
These checks made no live provider calls or new hosted writes.

## Release fixes and pending migrations

The local candidate addresses these confirmed defects:

- Gate live PandaDoc test discovery before reading optional `.env.local`.
- Reject hosted database URLs in database-writing test helpers.
- Enforce simple mode inside private session reads, actions, and login/invite pages.
- Require exactly 36 characters for webhook UUID metadata before event processing.
- Queue uncertain upload cleanup instead of deleting bytes before checking committed document records.
- Reuse pending cleanup work during document deletion without changing existing worker state.
- Fail database test teardown on cleanup errors across eight callers.
- Limit webhook audit cleanup to exact fixture IDs captured through unique synthetic IPv6 inputs.
- Keep provider error text out of user responses, logs, audit metadata, and stored failure results.
- Bound outbox retries when a worker repeatedly loses its lease.
- Materialize outbox candidate sets before locking updates to preserve the batch limit.
- Reject noncanonical document paths before signing and at the database boundary.
- Prevent authenticated callers from attaching arbitrary `intake/` paths to claims.
- Correct narrow public grids that overflowed the measured mobile viewport.
- Preserve raw generated database types and place SQL nullability overrides in the application type module.
- Use one Vitest worker on Windows and four elsewhere, with isolation, tests, and timeouts unchanged.
- Send public intake file bytes directly to private Storage through approved signed upload paths.
- Preserve the upload session during confirmation retries and verify files before atomic intake creation.
- Protect issued upload capabilities during cleanup and recheck retained paths for late objects.

Static production-code review is complete within the scope below.
The test cleanup ownership correction is complete and passed platform validation.
Full simple-mode tests, final type-check, and final lint passed before the fourth migration.
Full pgTAP and the platform CI selection passed after the fourth migration.
The earlier four migrations were applied locally.
The direct-upload change adds two migrations, bringing the repository total to 29.
Six migrations follow the last recorded hosted migration.
No hosted application of these migrations is recorded.

| Pending migration | Purpose | Main risk and recovery |
|---|---|---|
| `20260830120000_outbox_attempt_limit.sql` | Stop claims after five attempts, including expired worker leases | Exhausted rows become dead when processed; preserve payloads and reconcile provider outcomes before retry |
| `20260830121000_document_storage_paths.sql` | Enforce canonical paths and claim-owned authenticated inserts | Existing invalid paths stop migration validation; review affected metadata and Storage bytes before any approved repair |
| `20260830122000_storage_cleanup_enqueue_idempotent.sql` | Prevent duplicate pending cleanup intents from rejecting document deletion | Reviewed and applied locally; existing worker state and terminal history remain unchanged; hosted application awaits approval |
| `20260830123000_outbox_batch_materialized.sql` | Materialize expired and due candidate sets before outbox updates | Function-only replacement preserves owner, grants, and queue data; full pgTAP and platform CI passed; use an approved forward correction if needed |
| `20260830124000_intake_upload_sessions.sql` | Reserve immutable upload sessions and manifests; verify object versions before atomic intake creation | Apply before the new application. Retain session records, completed references, and reserved paths during recovery. |
| `20260830124100_intake_upload_cleanup.sql` | Protect issued capabilities and requeue late, unreferenced objects | Keep cleanup reconciliation active during recovery. Review blocked cleanup work without removing committed documents. |

The deletion defect is fixed in the local candidate.
The previous trigger inserted a cleanup intent even when that exact path already had a pending intent.
The partial unique index rejected the duplicate and prevented deletion.
The reviewed migration now reuses pending work without changing its lease, attempts, timestamps, errors, or metadata.
It preserves terminal queue history and uses no data reset.

Rollback-only suite 34 stopped after three of 26 planned assertions against the old trigger because of the duplicate queue key.
All 26 assertions passed after the fix.
Strict fixture teardown now reports failed cleanup instead of leaving an unnoticed fixture.
The local uncertain-write integration test passed against real Storage with strict teardown after migration.

The fourth migration addresses the later outbox batch-limit failure recorded below.
It materializes both candidate sets in `claim_outbox_batch`.
Only the function definition changes; queue rows remain intact.
Full pgTAP and the platform CI selection passed after that local apply.

Back up the database and Storage objects before approved forward migrations.
Confirm that those backups can restore the same recovery point.
Never rename, quarantine, delete, or rewrite hosted document rows automatically.
Keep the signing guard during recovery.
Use a reviewed forward repair if existing paths need correction.
Never weaken the path boundary to make a migration pass.

## Database type generation

The generated types below include the two direct-upload migrations and their RPC contracts.
The upload candidate passed fresh type, unit, integration, database, and build checks.

Raw `npm run db:types` output is reproducible.
Generation after the upload migrations exited 0.
The current `database.ts` SHA256 is `0C04FD50FC14872FA0C555C367B47AE6759283E6E2A1A12BAAC3BF724411EA3F`.
Final type-check, lint, and both builds used the generated TypeScript files.

[database.ts](../../src/types/database.ts) remains the unedited Supabase generator output.
[database-app.ts](../../src/types/database-app.ts) contains five narrow SQL nullability overrides.
The application routes 35 `Database` imports through that module.
The overrides preserve unrelated generated fields and optional arguments.

Final `npm run type-check` and full `npm run lint` both exited 0.
No raw generated type was hand-edited, and no dependency was added.
Remaining verification appears in the ledger below.
See [README.md](../../README.md#database-types) for maintenance rules.

## Current validation ledger

Direct-upload client tests passed in both site modes: three files and 50 tests per run.
The simple run exited 0 in 42.50 seconds; the platform run exited 0 in 23.38 seconds.
The current pure authorization and mode-boundary selection passed seven files and 45 tests in each site mode.
The direct-upload Storage integration suite passed five tests against the local stack.
The last approved clean local reset applied all 29 repository migrations, and pgTAP passed 38 files and 1,250 assertions.
The full simple and platform Vitest runs each passed 98 files and 1,046 tests, with one opt-in live test skipped, after the final mobile widget adjustment.
The affected form and Turnstile selection passed four files and 51 tests in each site mode after that adjustment.
The layout warning fix and its regression test passed in both builds.
The mobile Turnstile widget now uses the compact size at 420px and below; its regression test passed.
Simple and platform production builds passed after the upload and layout changes.
Full type-check, lint, audit, and diff checks passed after the upload changes.
See [the upload section](#approved-public-upload-transport) for scope and recovery limits.

### Earlier validation checkpoint

The table below records the completed checkpoint before direct-upload implementation.
Its results do not validate the later upload code or its two migrations.
Some local gates have passed; the remaining checks stay open below.
The full simple-mode run and platform CI selection passed after the audit cleanup correction.
The next full pgTAP run failed one batch-limit assertion.
The fourth migration is applied locally; full pgTAP and the platform CI selection passed afterward.
Run new candidate checks after further code or schema changes.
Historical results do not complete these checks.

| Check | Current result |
|---|---|
| Affected unit regressions | Affected platform selection passed seven files and 110 tests; corrected helper tests passed two files and 29 tests; full simple run passed |
| `npm run type-check` | Post-reset run passed after type regeneration; exit 0 |
| `npm run lint` | Final full run passed; exit 0 |
| `npm test` | Current simple and platform runs each passed 98 files and 1,046 tests, one live file/test skipped |
| Fresh platform full-suite rerun | 98 files passed and 1,046 tests passed, one live file/test skipped |
| `npm run build` | Simple and platform builds passed after the upload and layout changes; both exited 0 |
| `npm run db:reset` | Latest approved local run passed and applied all 29 repository migrations, seed, and container restart |
| `npm run db:test` | Current clean run passed 38 files and 1,250 assertions; exit 0 |
| Fresh pgTAP rerun | 38 files and 1,250 tests passed after the approved local reset; exit 0 |
| `npm run db:types` | Regeneration passed after the upload migrations; current SHA256 is `0C04FD50FC14872FA0C555C367B47AE6759283E6E2A1A12BAAC3BF724411EA3F` |
| CI database-backed Vitest selection | Post-reset simple and platform each passed 30 files and 205 tests, one live file/test skipped; both exited 0 |
| Outbox batch suites 32 and 35 | Passed 84 assertions after the fourth migration; old-function control also passed 84 and did not reproduce the failure |
| Additional affected platform selection | Passed: seven files and 110 tests |
| `npm audit --audit-level=high` | Fresh run passed; exit 0 and zero vulnerabilities |
| Adversarial review of changed behavior | Final static review includes the fourth migration and suite 35; no further confirmed defect; planner-test limits remain recorded below |
| Final diff, source-size, and client-secret checks | Final aggregate: 103 changed or untracked files, zero deleted files, no dependency/workflow changes, and no credential-pattern matches |
| Current desktop, 390px, and 320px public browser acceptance | Fresh local simple-mode checks at 320px, 390px, and 1280px found no horizontal overflow and no fresh console errors after the compact Turnstile fix; menu click and Escape passed; empty intake returned the generic Turnstile failure; native Tab traversal, upload interaction, and full network tracing remain unverified |
| Current Preview acceptance after an approved push | Public routes passed; private routes redirect to `/platform-disabled` in simple mode |
| Current-head GitHub `verify` and `database` checks | Passed; Vercel and Preview Comments also passed |
| Current-head Vercel build and acceptance | Branch Preview Ready; simple-mode environment update and redeployment passed |
| Live PandaDoc draft test | Not run; requires separate approval and shell opt-in |

The following focused results were verified during this review:

| Group | Passed tests | Mode coverage |
|---|---:|---|
| Upload cleanup | 29 per mode | Separate simple and platform runs |
| Provider privacy | 53 per mode | Separate simple and platform runs |
| Storage paths and downloads | 31 per mode | Separate simple and platform runs |
| Database target helper | 13 | Loopback configuration and safety cases; previous simple-mode run |
| New mode guards | 48 total | Enabled and disabled modes covered inside the group |
| Strict fixture cleanup | 7 | Previous simple-mode run |
| Latest pure selection | 31 | Cleanup, target helper, and payload files with one worker |
| Storage uncertain-write integration | 1 | Real local Storage and strict teardown after the third migration |
| Server-only test helpers | 29 | Two platform files passed after the audit cleanup ownership correction |
| Additional affected platform selection | 110 | Seven platform files passed |

These groups overlap and must not be added together as a full-suite total.
The separate CI selection result appears below.
These focused groups did not complete the reset gate; the later approved local reset passed separately.

The failed full Vitest attempt passed 69 files and 628 tests, with one live test skipped.
It also had 19 worker startup handshake timeouts, so the command failed.
Four-worker attempts also failed during startup under normal process permissions.
`vitest.config.ts` now selects one worker on Windows and four on other hosts.
Isolation, assertions, test inclusion, and timeouts remain unchanged.
The full simple-mode rerun then passed with the Windows one-worker default.

The passing run completed in 573.03 seconds.
It passed 89 files and skipped one live file.
It passed 875 tests and skipped one live test, for 876 tests total.
It reported zero unhandled errors.

The later exact platform CI selection passed 178 tests and skipped one live test.
It failed after one worker startup timeout in `test-support.test.ts`.
That server-only helper test now declares `// @vitest-environment node`.
The focused platform helper selection then passed two files and 20 tests in 1.91 seconds.
The additional affected platform selection passed seven files and 110 tests.

The next exact CI rerun was stopped before results after the broad audit cleanup was found.
The completed correction then passed two platform helper files and 29 tests.
Nine new ownership and error cases preserve all original assertions.

Before the fourth migration, the latest platform CI selection passed 29 files and 200 tests.
One live PandaDoc file and test were skipped.
The command exited 0 in 173.89 seconds.
The subsequent full simple-mode run also covered those database files.
No live provider calls or new hosted writes occurred during these checks.

That full simple-mode run passed 89 files and 884 tests.
One live file and test were skipped.
It exited 0 in 398.37 seconds.
Final type-check and full lint each exited 0.

An earlier pgTAP run failed suite 30's owner-count assertion after an ignored deletion error left a synthetic fixture.
That exact verified fixture was removed after the metadata checks recorded above.
The original suite 33 collation assertion was fixed.
The third migration and cleanup-error reporting are complete.
The separate test audit ownership correction is also complete.

The earlier full pgTAP rerun passed all 35 files and 1,015 assertions.
The next full run failed suite 32 assertion 20: three rows became terminal, but the assertion expected two.
All other 1,014 assertions passed.
This failure remains part of the verification history.

Static evidence strongly supports repeated execution of a limited locking `UPDATE ... FROM` subquery as the cause.
The adverse execution plan was not captured.
Focused suites 32 and 35 passed 84 assertions against the old function.
That negative control did not reproduce the failure.

Migration `20260830123000_outbox_batch_materialized.sql` then applied locally with `supabase migration up --local`, exit 0.
Suites 32 and 35 passed all 84 assertions afterward.
New suite 35 contains 60 assertions across normal, custom, and generic planner settings.
Those settings do not guarantee a particular adverse join order.

The subsequent full `npm run db:test -- --local` passed 36 files and 1,075 assertions, with exit 0.
The platform CI rerun after this migration passed 29 files and 200 tests, with one live file and test skipped.
It exited 0 in 90.58 seconds.
This is the final platform CI evidence; it supersedes the earlier 173.89-second run.
These results do not change the original failed reset or earlier denied retry.
The later explicitly approved local reset passed separately.

The 884-test simple run, final type-check, final lint, and both builds preceded the fourth SQL-only migration.
Type regeneration afterward produced the identical SHA256.
The full pgTAP and final platform CI results above followed the migration.

The verified platform command uses the same Vitest file selection as CI:

```powershell
$env:SITE_MODE = "platform"
$env:RESEND_API_KEY = ""
$env:PANDADOC_LIVE_DRAFT_TEST = "0"
npm test -- src/lib/esign src/app/api/pandadoc src/lib/storage-cleanup
```

Use only the disposable local database for these tests.
The live draft test creates a real PandaDoc draft.
It requires shell-only `PANDADOC_LIVE_DRAFT_TEST=1`, an API key, and a test email.
See [PANDADOC_SETUP.md](PANDADOC_SETUP.md) before any approved live test.

### Static review scope

Before the batch-limit failure, the static diff review found no further production-code issue in the local fixes.
No source files were deleted in those changes.
No dependency or workflow files changed.
No credential-pattern matches appeared in the changed files.
No secret environment names appeared in built client assets.

Final static inspection recorded 103 changed or untracked files and zero deleted files.
No dependency or workflow files changed, and no credential-pattern matches were found.
The credential-pattern scan covered all 103 files, including both new SQL files.
The only oversized source file is [lor-dispatch.ts](../../src/lib/esign/lor-dispatch.ts), at 462 lines, with only a type import change.
Generated database types are exempt from the source-file size limit.

The later test cleanup correction changes four test files only and passed platform validation.
The fourth migration and new SQL suite passed full pgTAP and the platform CI selection.
That completed source and test work preceded the approved direct-upload addition.

Final static review also covered the fourth migration and suite 35.
It checked candidate uniqueness, shared limits, leases, attempt filters, NULL/empty/zero inputs, owner and grant preservation, scoped fixtures, and rollback.
No further confirmed defect was found.

<a id="known-public-upload-limitation"></a>

## Approved public upload transport

The user approved direct browser uploads to private Supabase Storage.
The local candidate implements that design.
The application advertises ten files of 25 MiB each.
The private bucket also permits 25 MiB objects.
The allowance has not changed.

The former transport sent file bytes through a Server Action.
[Vercel limits function request payloads to 4.5 MB](https://vercel.com/docs/functions/limitations).
The new Server Actions receive only text, file metadata, and session credentials.
The installed Supabase browser SDK sends file bytes directly to the private bucket.
The pushed Preview contains the reviewed implementation; Production remains on the older deployment.
Maximum-size hosted acceptance remains open until an approved deployment and approved hosted tests.

The implementation uses these controls:

1. Preparation applies rate limits, Turnstile, input validation, and file metadata validation before reservation.
2. Reservation stores an immutable manifest and exact cleanup paths before the server issues upload authority.
3. Signed upload tokens permit writes to staging paths with overwrite disabled.
4. The server copies each file to a separate destination after one database-authorized copy attempt.
5. Upload tokens do not authorize writes to those document destinations.
6. Confirmation checks size, MIME type, file signatures, object identity, and version before final submission.
7. One atomic transaction creates the intake records and stores the completed session result.
8. Repeated confirmation returns the original claim reference instead of creating another claim.

The session tables have RLS enabled and deny direct access to anonymous and authenticated browser roles.
Each confirmation request verifies at most one previously unchecked file and stores its proof.
The client follows decreasing pending-file counts for at most ten confirmation calls.
Malformed progress, stalled progress, and uncertain responses preserve the session for retry.
Only confirmed server cancellation permits a new session.

The form preserves text and selected files while it disables editing during an active session.
Progress uses the existing accessible status region.
Standard uploads retry whole files; confirmed uploads do not repeat during confirmation retries.
Client recovery requires the same open tab because session credentials and file references remain in memory.
The form warns before leaving and does not instruct the user to reload after an uncertain result.

Supabase [signed upload URLs](https://supabase.com/docs/reference/javascript/file-buckets-createsigneduploadurl) remain valid for two hours.
Sessions expire after two hours, and signing is limited to their first five minutes.
Cleanup cannot claim reserved paths until two hours and 15 minutes after reservation.
The server rejects signed tokens whose expiry exceeds that cleanup boundary.
Retained path records allow later cleanup runs to requeue objects that arrive after an earlier successful sweep.
The worker excludes committed document paths and reports blocked cleanup work.
The old 15-minute intent is not the protection used for these sessions.

Retain session records, file manifests, and cleanup reconciliation during application rollback.
A Storage write and a database commit remain separate operations.
Do not delete reserved paths or issue a new session solely because a response was lost.

The final client selection passed three files and 50 tests in each mode.
It covers file limits, metadata-only actions, progress, duplicate submission, uncertain writes, retries, and confirmed restart.
The first simple run passed 46 tests but failed when the form-test worker did not start.
That run exited 1 after 100.70 seconds; the unchanged retry passed all 50 tests.
No test, worker setting, assertion, or timeout was removed to obtain that pass.

## Public acceptance and operation

The release includes marketing, contact, intake, public email, and storage cleanup.
Expected private-route behavior remains closed in `SITE_MODE=simple`.

Normal page GET checks produced these results:

| Environment | Observed result | Acceptance limit |
|---|---|---|
| Local simple mode | Six private entry-route GETs redirected to `/platform-disabled` | Private entry closure passed for those requests |
| Production | `/admin` redirected to `/platform-disabled` | One route check passed; full Production acceptance remains pending |
| Verified Preview | Public routes returned 200; all platform entry routes redirected to `/platform-disabled` | Simple-mode closure passed |

Local `/`, `/services`, `/contractors`, `/about`, `/contact`, and `/file-a-claim` passed layout checks at 320px, 390px, and 1440px.
Actual viewport measurements confirmed those widths after the narrow grid CSS fix.
All 18 final local layout checks passed without horizontal overflow or missing images.
Selected loading and error states also passed at 390px, as recorded below.
Local success checks also passed within the scope recorded below.
Fresh Preview Tab traversal moved focus through the skip link, logo, navigation, and phone link. Menu activation and full network tracing remain unverified.

The earlier Preview layout capture passed 15 of 18 public layout checks.
At 320px, `/`, `/about`, and `/contact` each had 15px horizontal overflow.
Their document client width was 305px, and their scroll width was 320px.
Every Preview layout at 390px and 1440px passed.
The earlier Preview layout capture found no missing images.
That earlier Preview failed private-route closure; the current redeployment passes that boundary. Its complete network trace remains pending.

| Local check at 390px | Observed result |
|---|---|
| Empty contact form | Disabled “Sending your request…” button, then two field errors and focus on `name` |
| Empty intake form | Disabled “Submitting intake…” button, then 20 field errors and focus on `firstName` |
| Error layouts | No horizontal overflow |
| Second policyholder set to Yes | Four conditional fields became visible |
| Second policyholder set to No | All four second-policyholder inputs were removed without overflow |
| Prior claim set to Yes | `priorOutcome` became visible without overflow |
| Mobile menu click | Menu opened and focused Home |
| Mobile focus containment | Focus remained within the open menu |
| Escape from the menu | Menu closed, toggle focus returned, and the closed menu became inert |

| Local success check | Observed result |
|---|---|
| Contact, desktop | Success panel received focus; no horizontal overflow |
| Intake, 320px / 390px / 1440px | Success panel received focus; no horizontal overflow at each width |
| Attachments | No uploads tested |

The local widget uses official Turnstile test keys.
Empty submissions did not persist claims or leads.
They do not establish valid hosted submission or production Turnstile acceptance.

Browser logs retain older Preview errors, including the Turnstile failure.
A local-route evaluation can include those earlier entries.
Do not describe the entire browser console as clean.
Filter future console and network evidence by a fresh navigation timestamp.

Fresh local navigation after `2026-08-30T23:18:43.607Z` checked all six public routes.
No new warning or error logs appeared within that timestamp scope.
All checked images loaded.
The local contact GET returned HTTP 200.
Older Preview Turnstile errors remained in the browser logs and were excluded by timestamp.
Full network tracing and native keyboard activation remain unverified; fresh Preview Tab traversal passed.

Phone input worked visually in the browser.
DOM snapshots redact telephone values, so those snapshots do not show an input defect.

Browser Enter and Space attempts did not activate the native menu button.
The cause remains unresolved: tool behavior or an application issue.
Do not mark menu activation complete until a fresh interaction test passes.

The acceptance tab became a data-URL `ERR_CONNECTION_REFUSED` page while the local server was stopped.
After restart, Browser Use URL policy blocked access to that old error page.
That attempt ended without further keyboard interaction.
The blocked error tabs remain untouched.

A fresh tab later opened `http://127.0.0.1:3014/contact` at 390px.
The local server returned HTTP 200 before navigation.
Document client width and scroll width both measured 375px; all images loaded.
No warnings or errors appeared after `2026-08-31T00:26:25.850Z` in that tab's console logs.

Enter did not activate the menu through either locator input or native browser input.
Showing the browser did not change that result.
Click opened the menu and focused Home; Escape closed it and restored toggle focus.
Native keyboard activation and full network tracing remain unverified.
The viewport override reset successfully, and all tabs remain open.

Earlier layout, success, and scoped console checks retain their recorded results and limits.
The server restore and fresh-tab checks made no new hosted writes.

1. Check public pages, navigation, focus, validation errors, and responsive layouts.
2. Check loading, empty, error, and approved success states without exposing personal data.
3. Check console output, network failures, security headers, and CSP.
4. Check `/login`, `/mfa`, `/invite`, `/admin`, `/portal`, and `/partner` closure.
5. Check the disabled PandaDoc webhook response without creating a provider event.
6. Use approved test data for hosted forms only after production-write approval.
7. Verify confirmation emails and staff alerts through the approved live provider.
8. Record upload boundary results without claiming unsupported maximum-size success.

`vercel.json` schedules the outbox daily at 14:00 UTC.
It schedules storage cleanup daily at 14:17 UTC.
Hobby scheduling does not guarantee the exact minute.
Minimum retry delays do not create extra cron runs.
A retry or cleanup backlog can take several days.
Simple mode processes only the four public-form email templates.

## Approval and recovery sequence

Complete engineering checks in this record before release approval.
Resolve owner decisions in BLOCKERS before merging or deploying.
Keep commit, push, PR update, branch protection, merge, deployment, and domain approval separate.
A merge to `develop` can trigger Production automatically.

Follow the README backup and forward-migration procedure before approved database writes.
Record the actual release commit, deployment, backup identifiers, and compatible rollback target before release.
The current Production deployment is recorded above; its rollback compatibility is not yet verified.

During an approved recovery, stop affected writes before restoring data.
Restore a compatible application while retaining forward migrations where possible.
Restore the database and Storage together only when required by the approved recovery plan.
Check environment values, cron schedules, and cron authorization before reopening jobs.

Vercel Instant Rollback does not update active cron schedules.
Reconcile uncertain sends before retries.
No production rollback or restore has been performed.

## Later platform activation

Private workflows remain deferred for a separate activation decision.
Required checks include owner identity, MFA, AAL2, role isolation, invitations, private documents, PandaDoc, and webhook recovery.
PandaDoc uses the bundled single-owner and dual-owner PDFs with `H1` and `H2` roles.
Template UUIDs are not required by the current flow.

Retention automation, export, erasure, and legal holds require separate implementation and approval.
Public legal copy, privacy terms, consent wording, and business claims still need approval before simple-mode launch.
See [RETENTION.md](../RETENTION.md) and [PANDADOC_SETUP.md](PANDADOC_SETUP.md).

## Historical record — 2026-08-13

The following record is retained as historical evidence.
Its completion claims, checks, URLs, migration counts, account state, and next actions are superseded by the current sections above.
It does not authorize commands or production actions.

### CMG launch and browser-test handoff

Last reconciled: 2026-08-13 on `feature/claims-platform` after the new Vercel
project and hosted form checks.

The application is feature-complete for the agreed functional scope and is
ready for owner acceptance testing. The first release can use `SITE_MODE=simple`
to expose only the marketing site and public forms while keeping required email
and file-cleanup operations active. Architecture, authorization, per-role craft,
all-surface cohesion, enforcing CSP, and comparable mobile Lighthouse gates have
converged locally. Hosted owner steps remain. The feature branch is pushed and
PR #1 is open. The new Vercel Preview works in simple mode. Its hosted Supabase
database accepted one labeled contact test and one labeled intake test. The
authoritative production setup sequence is in the root
[`README.md`](../../README.md#production-launch-runbook).

#### Verified local state

- Clean local database reset applied all 21 migrations through
  `20260815220000_accept_intake_owner_guard.sql`.
- Vitest: 78 files, 731 tests passed locally; GitHub verify passed.
- pgTAP: 31 files, 915 assertions passed.
- TypeScript, ESLint, production build, source-size audit, and
  `git diff --check` passed.
- `npm audit --audit-level=high`: zero vulnerabilities.
- Built client assets contain none of the server-only credential names.
- Simple-mode HTTP smoke: `/`, `/contact`, and `/file-a-claim` return 200;
  `/admin`, `/portal`, and `/partner` redirect to `/platform-disabled`.
  The PandaDoc webhook returns 404 with `platform_disabled` in simple mode.
- CSP is enforcing, nonce-based, and covers every rendered script. Localhost
  omits only `upgrade-insecure-requests`; hosted requests retain it.
- Mobile Lighthouse comparable runs scored 93/100 and 90/100; the lower
  performance/accessibility scores are 90/100, above the 85/95 floors.
- Chrome testing passed at exact desktop and 390px widths for marketing,
  customer, partner, and staff surfaces. The production server remains at
  `http://localhost:3011`; the final reset requires local staff MFA re-enrollment.
- Vercel Preview `cmgps-5o8gs4nr1-robs-projects-c72886ba.vercel.app` is Ready.
  The hosted home, contact, and intake pages work. Simple mode blocks `/admin`.
- Hosted contact and full intake submissions passed. The intake reference is
  `CMG-2026-0001` and uses clear release-test data.

#### Safe local test accounts

The local database contains demo data only. All seeded accounts use
`CmgDev!2026`.

| Role | Email | Expected entry |
|---|---|---|
| Customer | `customer@cmg.test` | `/portal` |
| Partner rep | `partner@cmg.test` | `/partner` |
| Owner | `owner@cmg.test` | `/admin`, then TOTP setup |
| Adjuster | `adjuster@cmg.test` | `/admin`, then TOTP setup |
| Assistant | `assistant@cmg.test` | `/admin`, then TOTP setup |

Do not reuse these credentials in production. A clean `supabase db reset`
recreates the demo state and invalidates locally enrolled MFA factors.

#### Practical browser acceptance checklist

1. Marketing at desktop and 390px: open `/`, use the mobile menu, visit
   Services, Contractors, About, Contact, and File a claim; confirm no horizontal
   overflow or console errors.
2. Public forms: submit a test contact and intake. The local Cloudflare widget
   must say it is for testing; production must use real keys before launch.
3. Customer: sign in, review claim progress, activity, documents, and profile;
   post a harmless question and confirm it appears without exposing staff-only
   data.
4. Partner: sign in, open both referred claims, verify an offered claim hides
   the amount while the settled claim shows it, review partner/shared activity,
   company profile, and referral form.
5. Staff: sign in as owner, enroll TOTP, then inspect Dashboard, Intake, Leads,
   Questions, Claims, Partners, Staff, Audit, and Settings.
6. Claim operations: open `CMG-2026-0001`, inspect every tab, update only
   disposable demo data, and confirm the LOR panel shows the represented legacy
   claim as complete rather than offering a false retry.
7. E-sign recovery: create or use an `under_review` demo claim. With PandaDoc
   absent, confirm electronic sending is explicitly unavailable and manual
   signing remains available. Real PandaDoc end-to-end testing is an owner step.
8. Role boundaries: while signed in as customer or partner, paste an admin URL;
   while signed in as one customer/company, paste another fixture ID. Access
   must be refused or indistinguishably not found.
9. Operational routes: after setting a local `CRON_SECRET`, invoke the outbox
   and storage-cleanup routes with missing, wrong, and correct Bearer tokens.
10. Before production acceptance, repeat the public-form, invitation, email,
    PandaDoc/manual-LOR, document download, and cron checks against hosted
    services.

#### Owner-independent work at handoff

- Complete. Stage 3 is checkpointed at `bb958a0`; this reconciled handoff is
  included in the final Stage 4 documentation checkpoint.

Only replacing the two deliberate photo placeholders is owner-blocked; it needs
authentic CMG assets rather than generated or misleading stock photography.

#### Material limitations visible in the local MVP

- Public forms use Cloudflare's test keys and have no real bot
  protection until production Turnstile credentials are installed. This is a
  launch blocker, not deferred engineering work.
- Email remains queued/manual-link capable without Resend credentials.
- Electronic LOR sending remains unavailable without a real PandaDoc account,
  templates, key, and webhook; the secured manual-signing/upload workflow works.
- Local demo data is not production data, hosted backups are not configured,
  and owner staff must enroll TOTP on the hosted project.
- Home and About show labeled photo placeholders until genuine CMG images are
  supplied.
- Marketing statistics, testimonial attribution, legal wording, final LOR
  content, and the live domain remain owner assertions that must be approved.

#### Owner-only launch steps

Follow the dependency-ordered runbook in the README. In short:

1. Review PR #1 and merge the feature branch into `develop` when the final
   production release is approved. Confirm that the Git push starts Vercel.
2. The hosted database is current through migration `20260815220000`. Create
   the first owner Auth user and profile, enroll TOTP, enable leaked-password
   protection, and choose backups/PITR for claim records.
3. Keep Vercel project `cmgps` connected to `rspeciale0519/cmg`. Keep
   `SITE_MODE=simple` for the first release. The Next.js preset and base
   environment values are already set. Confirm both cron schedules from
   `vercel.json` after the production deployment.
4. Verify the Resend domain/DNS and sender/inbox addresses.
5. Create real production Turnstile keys for the deployed hostnames.
6. Configure PandaDoc with [`PANDADOC_SETUP.md`](PANDADOC_SETUP.md).
7. Point the final domain/DNS and validate TLS.
8. Supply authentic photos and approve statistics, testimonial, legal copy,
   license display, retention position, and LOR wording.
9. Run the hosted smoke checklist, record the deployment and rollback target,
   and monitor dead webhook, outbox, storage-cleanup, and e-sign dispatch rows.

#### Exact Git and hosted state at handoff

- Branch: `feature/claims-platform`.
- The branch is pushed through commit `b5550b4`. PR #1 is open into `develop`.
- Local verification passes: type-check, lint, 731 Vitest tests, 915 pgTAP
  assertions, and production build.
- Vercel project `cmgps` is connected to `rspeciale0519/cmg`. Its framework is
  Next.js. The current Preview is Ready and its simple-mode forms work.
- Stage checkpoints: `7a21209` (Stage 1), `9419994` (Stage 2), `bb958a0`
  (Stage 3), and `2be7e6e` (Stage 4). Documentation handoffs are separate local commits.
- Vercel has the base simple-mode values. It does not have Resend, PandaDoc API
  and template values, or real Turnstile keys.
- `.env.local` keeps local application values under the standard Supabase names
  and production values under `PROD_SUPABASE_*`. The production direct database
  connection works. All 21 migrations match through `20260815220000`.
  `claim-docs` is private, every public table has RLS enabled, and production has
  no Auth users or owner profiles yet.
