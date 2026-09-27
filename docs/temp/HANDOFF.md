# CMG release handoff — engineering evidence

Reconciled 2026-09-26. This file holds current engineering evidence and acceptance checklists only.
Rewrite it in place. Do not append dated sections.
The full dated record is in [the 2026-09-17 archive](../../archive/docs/temp/2026-09-17-consolidation/HANDOFF.md).

Use [RELEASE_STATE.md](../RELEASE_STATE.md) for production facts, open PRs, migration heads, and the ordered next steps.
Use [BLOCKERS.md](BLOCKERS.md) for owner decisions.
Use [README.md](../../README.md#simple-mode-production-runbook) for the release procedure.
Use [INTAKE_VENDOR_ACCEPTANCE.md](INTAKE_VENDOR_ACCEPTANCE.md) for the contractor and vendor-link feature record.

<a id="current-release-evidence"></a>

## Current release evidence

PRs #1 through #17 are merged. GitHub lists no open PR on 2026-09-26.
The remote `develop` head is `2fdf6bd`. GitHub run `36003466471` passed its `verify` and `database` jobs for that head.
GitHub reports a successful Production deployment for that commit. Exact alias mapping still needs a Vercel session check.
The test totals below are retained evidence from the earlier PR #2 release checks. They do not describe the latest head.

| Check | Historical PR #2 result |
|---|---|
| `npm test`, simple mode | 100 files and 1,072 tests pass; one live PandaDoc test skipped |
| `npm run db:test` | 41 files and 1,287 assertions pass after an isolated reset |
| CI database-backed Vitest selection | 30 files and 205 tests pass; one live file and test skipped |
| `npm run type-check` | Exit 0 |
| `npm run lint` | Exit 0 with two existing unused-variable warnings in `src/lib/actions/intake-rollback.test.ts` |
| `npm run build` | Passes in both site modes |
| `npm audit --audit-level=high` | Zero vulnerabilities |
| `npm run db:types` | Regenerated from the migrated database; no hand edits |

The `verify` and `database` selections overlap. Do not add their totals together.
Use Node.js 22. A shell on a different Node.js version is not project evidence.

The 2026-09-26 isolated acceptance checkout started at `2fdf6bd` and tested the partner-directory candidate fix.
The disposable Supabase stack used a separate project and port block; Production and the shared development stack were not reset.
After an isolated reset, `npm test` passed 119 files and 1,665 tests; one live file and test were skipped.
The same checkout passed `npm run lint`, both default and platform `npm run build`, and `npm audit --audit-level=high` with zero vulnerabilities.
The main checkout passed `npm run type-check` after the fix and test changes.
The focused partner-directory database regression passed in both platform and staff modes with a synthetic AAL2 owner.
The isolated `supabase test db` passed 43 files and 1,322 assertions before the application fix; no migration changed.
These local results do not replace required CI or hosted Preview acceptance.

## Hosted state

Production runs `SITE_MODE=staff` on `app.cmgpropertysolutions.net`.
On 2026-09-26, public route checks returned 200 for `/` and `/login` with HSTS and CSP.
`/invite`, `/portal`, and `/partner` returned 307 to `/platform-disabled`.
The unauthenticated outbox cron returned 401.
Read-only hosted migration inspection found 35 migrations through `20260917130000`.
See RELEASE_STATE for the staff-desk acceptance and owner decisions.

Read-only verification confirms the added columns, constraints, the ready and valid index, unique vendor codes,
RLS on claims and partner companies, service-role-only execution of the submission RPC, and the reference-capacity guard.
The submission RPC remains security-invoker with an empty search path.

Existing hosted rows are production data. Do not reset, seed, delete, or replay them.
Recovery uses reviewed forward repair. Immediate restoration is unverified.

## Route behavior

| Environment | Result |
|---|---|
| Production public routes | `/` returned 200 with HSTS and CSP on 2026-09-26. Other public routes need a fresh check. |
| Production private routes | `/login` returns 200; `/invite`, `/portal`, and `/partner` return 307 to `/platform-disabled`. Other routes need a fresh browser check. |
| Production cron routes | 401 without a bearer token |
| Production PandaDoc webhook | Manual signing is active. No webhook response was checked in this pass. |
| Historical PR #2 Preview | Public routes returned 200; private entry routes reached `/platform-disabled` at that checkpoint. |

## Browser acceptance

Historical native checks on the PR #2 Preview cover Home, Services, Contractors, About, Contact, and File a claim
at 320, 390, and 1280 pixels. Each route has its main heading and no horizontal overflow.
No completed broken images were observed. The inspected console log returned no warnings or errors.

The intake form shows four optional contractor fields and no loss-time input.
Keyboard Tab moves from First name to Last name. The empty form reports 23 invalid required controls.
A vendor link renders the same seven public sections with no vendor directory.

On 2026-09-26, an isolated local Supabase stack and native browser exercised all three invitation types in `SITE_MODE=platform`.
Email delivery was disabled; the forms returned manual links, and no live messages were sent.
The owner enrolled MFA, issued synthetic staff, vendor, and homeowner invitations, and each link reached its expected account setup form.
The new adjuster enrolled MFA, reached an empty assigned caseload, and received not-found on the owner-only partner page.
The new vendor reached the partner portal with two referred claims; `/admin` and `/portal` redirected to `/partner`.
The homeowner reached her claim and two visible documents; another claim's document page returned not-found.
At 390px, the homeowner overview and document list rendered without horizontal overflow; desktop overview also had no overflow.
The seeded signed-letter row failed to download because its local seed has metadata without object bytes.
On 2026-09-26, the owner selected `synthetic-upload.png` in the built-in browser after automated file selection failed.
The local portal accepted the 152 KB file, listed it on the claim, and downloaded it through a signed URL.
The earlier seeded signed-letter download failure was limited to seed metadata without object bytes.
These checks do not prove hosted Preview delivery, one-time link replay, maximum-size upload, or Production access.

The first partner-directory browser check failed with `permission denied for table claims` and showed zero companies.
The directory embedded a count from `claims`, whose authenticated SELECT grant covers only safe columns.
Changing the count embed to `claim_partner_summaries` restored the seeded company, one rep, and two referred claims.
A database-backed regression with a synthetic AAL2 owner passed against the isolated stack.
The candidate fix passed local checks and was pushed as `bugfix/partner-directory-count` at `242ab01`.
Vercel showed the branch Preview ready on 2026-09-26. CI runs only for pull requests and pushes to `develop` or `main`, so this branch push did not start CI.
CI and hosted Preview platform-mode acceptance still need to verify it.

Current browser work:

- Maximum-size upload boundary acceptance.
- Hosted Preview acceptance and remaining invitation replay, hosted document-byte, and role-specific responsive checks before platform activation.
- Fresh public form and private-role checks against the latest deployed commit.
- Native menu activation by Enter or Space, which has not passed a fresh interaction test.

Record a fresh navigation timestamp before collecting console evidence.
Earlier Preview errors can remain visible in a later evaluation.

## Email and queues

Resend verified `cmgpropertysolutions.net` on 2026-09-09. `EMAIL_FROM` is `CMG Property Solutions <claims@cmgpropertysolutions.net>`.

The 2026-09-13 acceptance contact test recorded both messages as Delivered:
auto-reply `40cd3517-a599-43e6-a2e2-871583e5edd4` and staff alert `f39cc993-1aa1-4480-9515-e80aa253d5ec`.
The auto-reply cooldown retry that an older record described is complete; do not repeat that request.

The 2026-09-15 Preview contact test created hosted lead `0d9b170b-3053-4f90-889c-a9b7085942bd`.
Both of its outbox entries are sent after one attempt. Provider inbox receipt for that lead is still unverified
and waits on the owner's Resend sign-in.

A `sent` state means the provider accepted the request. It does not prove inbox delivery.
Old dead and failed public messages from August and September remain retained for operator review. Do not resend or erase them automatically.
Staff mode processes the four public-form templates and three staff-alert templates.
Read-only hosted inspection on 2026-09-26 found four pending `claim_status_update` rows.
Two are older than seven days. No message was sent or changed during inspection.
The Storage cleanup queue has zero open rows and three processed rows.
Review the pending customer messages before opening platform mode; it permits those templates.

`vercel.json` schedules the outbox daily at 14:00 UTC and Storage cleanup daily at 14:17 UTC.
Hobby scheduling does not guarantee the exact minute, and a backlog can take several days.
Scheduler attribution is unverified because the Vercel session expired before the execution logs could be read.

<a id="public-upload-transport"></a>

## Public upload transport

The application advertises ten files of 25 MiB each. The private `claim-docs` bucket permits 25 MiB objects.
File bytes bypass Server Actions, which are limited to [4.5 MB request payloads](https://vercel.com/docs/functions/limitations).
Production contains this transport. Maximum-size boundary acceptance remains open.

The controls are:

1. Preparation applies rate limits, Turnstile, input validation, and file-metadata validation before reservation.
2. Reservation stores an immutable manifest and exact cleanup paths before the server issues upload authority.
3. Signed upload tokens permit writes to staging paths with overwrite disabled.
4. The server copies each file to a separate destination after one database-authorized copy attempt.
5. Upload tokens do not authorize writes to those document destinations.
6. Confirmation checks size, MIME type, file signature, object identity, and version before final submission.
7. One atomic transaction creates the intake records and stores the completed session result.
8. Repeated confirmation returns the original claim reference instead of creating another claim.

Supabase [signed upload URLs](https://supabase.com/docs/reference/javascript/file-buckets-createsigneduploadurl) stay valid for two hours.
Sessions expire after two hours, and signing is limited to their first five minutes.
Cleanup cannot claim reserved paths until two hours and 15 minutes after reservation.
Retained path records let later sweeps requeue objects that arrive after an earlier successful run.

Retain session records, file manifests, and cleanup reconciliation during any application rollback.
A Storage write and a database commit are separate operations.
Do not delete reserved paths or issue a new session only because a response was lost.

## Database types

[database.ts](../../src/types/database.ts) stays raw Supabase generator output. Do not hand-edit it.
[database-app.ts](../../src/types/database-app.ts) holds narrow SQL nullability overrides, and the application routes its `Database` imports through it.
See [README.md](../../README.md#database-types) for the maintenance rules.

## Test and fixture safety

- Live PandaDoc tests check the shell opt-in before reading an optional `.env.local`. They must never run automatically.
- Database-writing test helpers reject non-loopback database URLs.
- Webhook audit cleanup is limited to exact fixture IDs captured through unique synthetic IPv6 inputs.
- Database-backed tests fail when fixture cleanup fails. A cleanup error is not a passing run.
- Vitest uses one isolated fork worker on Windows and four elsewhere. Assertions and timeouts are unchanged.
- Suite 37 needs a quiet test database. Use a separate disposable Supabase project when the shared local stack holds acceptance data.
- Confirm that local data is disposable before `npm run db:reset`. Never reset or seed production.

The verified platform database selection is:

```powershell
$env:SITE_MODE = "platform"
$env:RESEND_API_KEY = ""
$env:PANDADOC_LIVE_DRAFT_TEST = "0"
npm test -- src/lib/esign src/app/api/pandadoc src/lib/storage-cleanup
```

See [PANDADOC_SETUP.md](PANDADOC_SETUP.md) before any approved live test.

## Local environment

The local Supabase stack reserves ports 15420 through 15429: API 15421, PostgreSQL 15422, Studio 15423, local email 15424.
Local email and PandaDoc keys are empty. Local Turnstile uses official test keys, so a local browser submission cannot pass verification.

## Acceptance checklist

1. Check public pages, navigation, focus, validation errors, and responsive layouts at 320, 390, and desktop width.
2. Check loading, empty, error, and approved success states without exposing personal data.
3. Check console output, network failures, security headers, and CSP against a fresh navigation timestamp.
4. Check `/login`, `/mfa`, `/invite`, `/admin`, `/portal`, and `/partner` closure in simple mode.
5. Check the disabled PandaDoc webhook response without creating a provider event.
6. Use approved test data for hosted forms only after production-write approval.
7. Verify confirmation emails and staff alerts through the approved live provider.
8. Record upload boundary results without claiming unsupported maximum-size success.

## Approval and recovery sequence

Complete the engineering checks above before release approval.
Resolve the owner decisions in [BLOCKERS.md](BLOCKERS.md) before merging or deploying.
Keep commit, push, PR update, branch protection, merge, deployment, and domain approval separate.

During an approved recovery, stop affected writes before restoring data.
Restore a compatible application while retaining forward migrations where possible.
Restore the database and Storage together only when the approved recovery plan requires it.
Check environment values, cron schedules, and cron authorization before reopening jobs.
Vercel Instant Rollback does not update active cron schedules.
Reconcile uncertain sends before retries. No production rollback or restore has been performed.

## Later platform activation

Required checks include owner identity, staff MFA, AAL2, role isolation, invitations, private documents, PandaDoc, and webhook recovery.
PandaDoc uses the bundled single-owner and dual-owner PDFs with `H1` and `H2` roles. Template UUIDs are not required.
Retention automation, export, erasure, and legal holds need separate implementation and approval.
See [RETENTION.md](../RETENTION.md) and [PANDADOC_SETUP.md](PANDADOC_SETUP.md).
