# CMG release handoff — engineering evidence

Reconciled 2026-10-05. This file holds current engineering evidence and acceptance checklists only.
Rewrite it in place. Do not append dated sections.
The full dated record is in [the 2026-09-17 archive](../../archive/docs/temp/2026-09-17-consolidation/HANDOFF.md).

Use [RELEASE_STATE.md](../RELEASE_STATE.md) for production facts, open PRs, migration heads, and the ordered next steps.
Use [BLOCKERS.md](BLOCKERS.md) for owner decisions.
Use [README.md](../../README.md#simple-mode-production-runbook) for the release procedure.
Use [INTAKE_VENDOR_ACCEPTANCE.md](INTAKE_VENDOR_ACCEPTANCE.md) for the contractor and vendor-link feature record.

<a id="current-release-evidence"></a>

## Current release evidence

PRs #1 through #17 are merged. PR #18 is open against `develop` at `284d155`; PR #19 is open at `3922e5a`.
The remote `develop` head is `2fdf6bd`. GitHub run `36003466471` passed its `verify` and `database` jobs for that head.
Vercel maps `app.cmgpropertysolutions.net` to the ready Production deployment for that commit.
PR #18 run `36351680879` and PR #19 run `37314652490` passed `verify` and `database`; their separate branch Previews are ready.
The current private-upload platform Preview uses deployment `dpl_5dkvuwLMDURbm1qEe2dQM8r8g1T2` at `3922e5a`.
The owner restored Chrome access to this Preview and Resend on 2026-10-05.
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
The fix passed local checks and is in PR #18 on `bugfix/partner-directory-count`.
CI passed at `1bdeba1`. A branch-specific Vercel override sets `SITE_MODE=platform` for this Preview only.
Unauthenticated `/portal`, `/partner`, and `/admin` routes reach sign-in, rather than `/platform-disabled`.
Hosted owner sign-in and MFA passed on 2026-09-27. The owner opened Staff and synthetic claim pages.
The hosted partner directory shows zero companies, matching the hosted table. Summit Exteriors exists only in the isolated local fixture.
Hosted staff, partner, and homeowner role acceptance still needs test accounts and approved writes.

The PR #18 hostname was absent from the Cloudflare Turnstile widget. The Preview contact and password-reset forms showed verification failure.
On 2026-09-27, the widget retained its four existing hosts and added this exact Preview hostname as the fifth.
Vercel's public site key matched the widget key. After propagation, the password-reset widget showed Success.
On 2026-09-29, Chrome showed Success on the Preview contact form's Turnstile widget. The form was not submitted. The in-app browser did not show a conclusive widget result.
At a 390px Chrome viewport, the contact form had no horizontal overflow (`scrollWidth` and `clientWidth` were both 375px after the scrollbar). The viewport override was reset.
One approved reset request for `rob@thespeciales.com` reached the generic "Check your email" state.
Resend marked email `01a0e4ac-4e53-7162-8e75-89282abcb0ac` Delivered. Inbox receipt and the owner's password change are unverified.
One approved homeowner invite for synthetic claim `CMG-2026-0003` was sent to `rob@miodiollc.com`.
The hosted database has one new `customer` invite and one `sent` outbox row; Resend marked email `01a0e4c0-d9f5-75c3-a22f-da4b84c9e68a` Delivered.
The owner opened that email, but its invite link went to Production `/platform-disabled`. The branch Preview inherited the global Production `NEXT_PUBLIC_SITE_URL`.
A branch-only Preview override now points `NEXT_PUBLIC_SITE_URL` to the PR #18 hostname. Deployment `4vrNEikYKQn5v22d2wtroka9xr2R` is Ready at `284d155`.
The original email cannot change. The owner approved one resend for `CMG-2026-0003` to `rob@miodiollc.com`.
The UI queued it, hosted outbox row `20f89351-7747-4de0-a249-6964dfe028d0` is `sent`, and Resend email `01a0e4d2-c38f-737d-80ab-d73d6f86fcb2` is Delivered.
The new email's link uses the branch Preview hostname. The owner used it and set the password without agent access to it.
Hosted invite `f4634a6b-fbb5-481e-92ff-f8160d3175db` has `accepted_at` and `accepted_by`; its claimant has a linked user.
The homeowner portal opened claim `CMG-2026-0003`. It showed one homeowner-visible document and withheld the private signed LOR from its list.
Customer access to `/admin` and `/partner` redirected to the claim portal. The homeowner document page fit 390px without horizontal overflow.
The homeowner activity and profile pages opened. The profile showed the retained consent details. No browser console warnings or errors appeared in this customer tab.
Production `/portal` still redirected to `/platform-disabled` after the branch Preview redeploy.
With separate approval, the homeowner downloaded `synthetic-upload.png`. The browser saved 68 bytes, and hosted audit action `document.signed_url_issued` was recorded.
The homeowner posted one `SYNTHETIC TEST ONLY` question. It appeared as a customer-visible claim event. Its staff alert was Delivered to the configured CMG inbox.
Two separate browser submissions stored `synthetic-upload (1).png` twice, 26 seconds apart. Each row and Storage object has 68 bytes. The first submission came from an in-app browser click after its file picker appeared empty to automation; the second came from Chrome. The test duplicates remain for review.
Both browser file pickers reported an empty `FileList` through automation after selection, even when a screenshot showed the chosen file. Do not treat that reading as evidence of an empty selection.
Chrome logged three browser message-listener errors during the file-picker work. The upload success state and hosted rows passed, but this console trace is not clean; the source of those extension errors is unverified.
Focused local upload tests passed: 2 files, 36 tests. A file over 25 MiB was prepared but not submitted under the approval given, then removed.
Homeowner and staff uploads send multipart bodies through Server Actions. The UI offers 25 MiB, but [Vercel documents a 4.5 MB function request limit](https://vercel.com/docs/errors/function_payload_too_large). This hosted boundary is open; the public intake uses direct-to-Storage transport.
Replay refusal, private LOR refusal by direct request, other roles, and larger upload delivery remain unverified.
PR #18 CI run `36351680879` passed `verify` and `database` at `284d155`; its Vercel Preview is ready.
At 390px, the hosted owner dashboard, partner directory, staff directory, and synthetic claim document page had no horizontal overflow.
The document list showed two files, including the private signed letter. No hosted download was attempted.

On 2026-09-27, the owner approved one synthetic adjuster invitation to `4miodio@gmail.com` and one vendor invitation to `robspeciale@gmail.com`.
The owner approved and created `CMG Synthetic Vendor Test` as the vendor's company. It has no real referred claims.
The hosted outbox showed one `sent` invitation for each address before acceptance. Provider delivery records remain unverified.
The owner reported opening both test portals after setting the credentials. No agent received passwords or MFA codes.
The vendor Preview showed the synthetic company and no referrals. Direct navigation to `/admin` and `/portal` returned to `/partner`.
The adjuster Preview showed an empty assigned caseload. `/admin/partners`, `/admin/staff`, and a known unassigned claim returned the same not-found page.
Direct `/portal` navigation returned to the adjuster dashboard. Invitation row status and provider delivery records still need direct verification.

The private 25 MiB upload fix is being built on `bugfix/private-upload-transport` from `origin/develop` in an isolated worktree.
The new migration passed 24 pgTAP assertions inside a rollback-only transaction. The shared local database retains its existing acceptance data and has no lasting schema change.
The focused private upload server tests passed: 2 files, 5 tests. UI helper and hook tests also passed: 5 tests total.
The owner approved a separate disposable local stack reset. The isolated stack on ports 15520 through 15529 reset successfully and applied the new migration.
Generated database types include only the new upload tables and RPCs. The full pgTAP suite passed: 44 files, 1,346 assertions.
The later expiry-guard edit passed 28 pgTAP assertions in a rollback-only transaction. On 2026-09-29, a fresh disposable reset applied that final edit, and all 44 pgTAP files passed with 1,350 assertions.
The database-backed CI selection passed against the disposable stack: 33 files passed, one skipped; 242 tests passed, one skipped.
Post-edit checks passed: TypeScript, lint, and the optimized Next.js build. The full Vitest run passed 114 files and 1,637 tests; 12 files and 55 tests were skipped.
The in-app browser showed the 25 MiB synthetic PDF selected, but no staging object or document appeared after the first submission.
The first retry used an old Server Action ID after a local action signature change and returned 404. A clean local browser retry remains open.
The browser's 25 MiB file-picker transfer later stopped before submission and reset its browser-control process. Do not treat the browser boundary as passed.
Docker Desktop stopped before the first final-reset attempt. On 2026-09-29 it restarted long enough for the disposable reset and full pgTAP suite to pass, then stopped again before the browser upload. Port 15521 was closed after the suite. No hosted data changed in these local tests.
The reviewed migration and both affected pgTAP files were copied to the disposable stack. Their SHA-256 hashes match the isolated worktree copies.
Apply the new migration before deploying code that calls `reconcile_private_upload_cleanup`. Recovery is a reviewed forward repair; do not roll the application code ahead of its RPC.
Hosted maximum-size acceptance remains open. The local commit was separately approved and created as recorded below. Push, hosted migration, and Production mode changes still require separate approval.
On 2026-09-29, after the computer restart, the owner selected the recreated 25 MiB PDF in Chrome. The local upload prepared its session but failed before the Storage request reached the container. No document or staging object was created.
The local CSP allowed only the normal stack's port 15421 and blocked the disposable stack's port 15521. The isolated fix now adds the configured exact loopback origin only in local mode. Hosted Production excludes loopback transports. All 13 CSP regression tests passed, and the live local response includes port 15521 without an HTTP wildcard.
On 2026-09-30, the owner selected the PDF again on a fresh Chrome page. The approved upload succeeded and displayed the document and success message. The disposable database contains one matching document; its size and Storage metadata both report 26,214,400 bytes. No hosted data changed.
After the CSP correction, type-check, lint, and the optimized production build passed. Full Vitest passed 114 files and 1,647 tests; 12 files and 55 tests were skipped. Browser console evidence and the over-limit browser rejection remain unverified. Chrome screenshot capture timed out.
On the resumed 2026-09-30 run, the disposable API and local application were reachable. The restarted application used legacy environment variable names, which caused a Supabase client error. Its startup environment was corrected to `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` and `SUPABASE_SECRET_KEY`; no source code changed. A fresh in-app homeowner sign-in and document page passed with no captured warning or error logs. Direct navigation to the staff document route returned the homeowner to its own claim. The successful PDF session is completed with one document; an earlier failed session remains pending with no document. The over-limit baseline contains no matching document. The 26,214,401-byte synthetic file is ready for manual Chrome selection. The seeded adjuster reaches the required MFA setup screen; the owner must complete credential setup before staff browser tests. No hosted or Production changes occurred.
The next read-only check confirmed that an anonymous request for the actual stored PDF returns HTTP 400 without document bytes. File selection remained empty, and the local adjuster still showed MFA setup. Review of the finalization and verification code confirmed caller-scoped document insertion, exact metadata matching, immutable object version proof, and retry reconciliation. The migration reserves both paths, limits files to 26,214,400 bytes, restricts session RPCs to service_role, and excludes live reservations and referenced documents from cleanup. This review found no new issue; remaining browser tests and the final release review are still required.
After the owner completed both manual steps on 2026-09-30, Chrome showed the selected 26,214,401-byte synthetic PDF. The local validator refused it with a file-field error before issuing an upload request. Disposable queries found zero matching document rows and zero upload reservations. Chrome screenshot capture succeeded for this refusal. Three browser message-channel errors remain in the Chrome log; their source is unverified. The in-app adjuster session completed MFA and opened its assigned claim documents with no captured warning or error logs. Staff sees four documents, including one CMG-only seed photo; the homeowner sees three. The staff maximum-size upload awaits separate approval and manual file selection. The server also recorded stale refresh-token errors before the fresh local sign-ins; those errors did not recur during the current checks.
The owner then approved and selected one local staff upload. The in-app adjuster submitted the synthetic 25 MiB PDF as `other` with `internal` visibility. The page displayed success and five documents. The new document and Storage metadata both report 26,214,400 bytes, and its session is completed. The homeowner still sees three documents and only its original customer-visible PDF. A direct homeowner API query for the internal PDF returns zero rows. No captured in-app warning or error logs appeared during the staff upload. Staff and homeowner document pages both fit an actual 390px viewport without page overflow; temporary viewport settings were reset. Chrome did not honor the requested 390px width, so the homeowner mobile check used the in-app browser instead. Screenshots showed the staff upload success and oversized-file refusal. No source code changed during these tests, and no hosted data changed.
With separate owner approval, commit `aa19129` was created on `bugfix/private-upload-transport` on 2026-09-30. It contains exactly the 30 reviewed private-upload source, test, generated-type, CSP, and migration files. The isolated worktree is clean. Main-worktree release records and unrelated edits were excluded. No push, PR creation, hosted migration, or deployment was performed. Before a push that can trigger Preview deployment, verify and approve the hosted migration sequence.
The resumed migration-order review confirmed that this branch adds exactly one migration. Its SHA-256 is `9D133C55183B362C98ABBF3C547600C8611B9DCB549E4B54ABF5ECCE01701CE6`. Read-only GitHub inspection confirmed PR #18 remains open at `284d155` with successful CI, Vercel, and CodeRabbit checks. The Supabase connector has no CMG permission, so hosted checks used the owner's signed-in Codex browser.

The owner separately approved applying `20260927120000_private_upload_sessions.sql` to CMG Production without a backup on 2026-09-30. The verified project is `vdtqxglhlgatpbgehsjk`, in the CMG Property Solutions organization. Before application, the hosted history had 35 migrations through `20260917130000`. Required tables, document enums, Storage columns, and cleanup functions existed. The new tables and functions did not exist. Documents RLS remained enabled.

The approved SQL ran in one atomic `DO` block with its migration-history insertion and a five-second lock timeout. An exact SHA-256 guard and history-head guard preceded DDL. The first attempt stopped at the hash guard because browser paste added Windows carriage returns. It made no schema or history change. The second attempt removed only those added carriage returns before the same exact hash check and succeeded. No approved migration source changed.

The post-migration read found 36 migrations through `20260927120000`. The stored SQL hash matches the approved file. Both new tables have RLS enabled, deny anonymous and authenticated SELECT, grant service-role SELECT/INSERT/UPDATE, and deny service-role DELETE. All five public upload RPCs use invoker security, deny anonymous and authenticated execution, and permit service-role execution. All three new guards are enabled. Documents RLS and the private-upload cleanup embargo are active. Both new tables contain zero rows. No claim data was rewritten, no test upload was submitted, no backup was created, and DNS and site mode stayed unchanged.

Browser checks after migration rendered Production `/contact` and `/login`; `/portal` redirected to `/platform-disabled`, consistent with staff mode. No captured browser warning or error logs appeared during these page checks. No fresh public form submission or hosted maximum-size upload was attempted. Shell HTTP checks failed because Windows Schannel could not obtain credentials; browser checks supplied the route evidence. A screenshot showed the hosted verification result, but no saved image file was produced.

The Supabase status page reported an unresolved Eastern US latency incident while Database and Dashboard were operational. The migration transaction and subsequent reads succeeded. Recovery remains reviewed forward repair; immediate restoration is unverified.

With separate owner approval, `aa19129114d7577096030315285a9bfa13861770` was pushed to `origin/bugfix/private-upload-transport` on 2026-09-30. The remote ref matches the approved commit, and the isolated worktree remains clean. Vercel deployment `EYvgCwCaHHCX9KAZg8wJvDmR7AzB` completed successfully. The branch diff contains the approved 30 files and passes `git diff --check`. GitHub Actions had no run for the branch push because CI push triggers cover only `develop` and `main`.

With separate owner approval, PR #19 was created against `develop` and attached to this chat. CI run `36765828554` started for `aa19129`. The verify job failed at `npm audit --audit-level=high`, before application checks. Its report contains two high package findings and one critical package finding: brace-expansion, undici, and Next.js. Next.js advisory [GHSA-vcvr-r3jv-pc5j](https://github.com/advisories/GHSA-vcvr-r3jv-pc5j) was published to the advisory database on 2026-09-30 and identifies 16.3.6 as patched. The CI audit recommends 16.3.8. No `next/og` or `ImageResponse` consumer was found under `src`; this is not a reason to suppress the audit. The brace-expansion paths are ESLint and eslint-config-next; undici is under jsdom. No dependency was changed or installed during diagnosis. The database job later completed successfully. The PR must not merge while CI fails. Dependency installation, another commit and push, Preview configuration changes, merge, and Production activation need their separate approvals.

Current browser work:

- Maximum-size upload boundary acceptance.
- Hosted Preview acceptance and remaining invitation replay, hosted document-byte, and role-specific responsive checks before platform activation.
- Fresh public form and private-role checks against the latest deployed commit.
- Contact FAQ activation by Enter passed. Other native menus still need a fresh interaction check.

Record a fresh navigation timestamp before collecting console evidence.
Earlier Preview errors can remain visible in a later evaluation.

## Email and queues

Resend verified `cmgpropertysolutions.net` on 2026-09-09. `EMAIL_FROM` is `CMG Property Solutions <claims@cmgpropertysolutions.net>`.

The 2026-09-13 acceptance contact test recorded both messages as Delivered:
auto-reply `40cd3517-a599-43e6-a2e2-871583e5edd4` and staff alert `f39cc993-1aa1-4480-9515-e80aa253d5ec`.
The auto-reply cooldown retry that an older record described is complete; do not repeat that request.

The 2026-09-15 Preview contact test created hosted lead `0d9b170b-3053-4f90-889c-a9b7085942bd`.
Both of its outbox entries are sent after one attempt.
Current Resend records show both messages as Delivered. Inbox receipt remains unverified.

A `sent` state means the provider accepted the request. It does not prove inbox delivery.
Old dead and failed public messages from August and September remain retained for operator review. Do not resend or erase them automatically.
Staff mode processes the four public-form templates and three staff-alert templates.
Hosted inspection on 2026-09-27 found four pending `claim_status_update` rows for synthetic claims.
Two were older than seven days and had a stale `www` portal URL; the newer two used `app.`.
One failed August `invite` row was also owed. Its first send failed while the old `updates.` domain was unverified.
With owner approval, exactly these five rows were marked `dead` in a guarded Production transaction. Their payloads remain for review.
Read-only verification found all five `dead` and no pending or failed outbox rows. Recovery needs a reviewed forward requeue if any was needed.
The newer approved homeowner invite sent on 2026-09-27 is a separate `sent` row and was not changed.
The Storage cleanup queue has zero open rows and three processed rows.

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

## Local dependency security repair — 2026-09-30

The owner approved installing Next.js and eslint-config-next 16.3.8 and patching the affected transitive dependencies. The isolated branch has two uncommitted files: `package.json` and `package-lock.json`. The lockfile updates Next.js companion packages, brace-expansion to 1.1.21 and 5.0.12, and undici to 8.11.2. It also contains npm-generated optional-package metadata normalization. No source file, schema, security rule, or CI check was changed. No new production dependency was added.

The default shell used Node.js 24.20.0. Commands selected the installed Node.js 22.22.2 runtime without changing global settings. The initial npm wrapper reported npm 12.0.2; the transitive update and checks used the Node.js 22 installation's npm 10.9.7. npm reported a locked old SWC cleanup directory during installation. The patched compiler built successfully. npm also reported a blocked unrs-resolver install script; no permission was expanded, and lint passed.

Checks: `npm audit --audit-level=high` reported zero vulnerabilities. Type check, lint, build, and `git diff --check` passed. Full Vitest passed 114 files and 1,647 tests, with 12 files and 55 tests skipped. The database-backed selection passed 33 files and 242 tests, with one file and one live test skipped. No database reset was needed because these changes affect dependencies only.

The first database-backed run used port 15521 but omitted `CMG_TEST_STACK=CMGPA_private_upload_disposable`. The existing stack safeguards refused four upload tests and fixture cleanup. Five exact synthetic session IDs from that failed run were captured and removed only from the disposable stack; 13 manifest rows and five session rows were removed. No hosted or retained normal-stack data changed. The corrected run preserved the safeguards and passed.

The verified old local server on port 3020 was stopped before the build. It was restarted with Next.js 16.3.8 against the disposable stack, with Resend and PandaDoc keys empty. The homeowner document page rendered its three expected documents. An empty upload produced the expected field error, and the server returned HTTP 200 for the page and action. No captured browser warning or error logs appeared. No file upload or third-party email was submitted. Browser network request details beyond the server log were not available. A screenshot showed the error state; no saved image path was produced.

With separate owner approval, dependency commit `c3e4781` was created on `bugfix/private-upload-transport`. It contains only `package.json` and `package-lock.json`. The isolated worktree is clean. A repeated audit before the commit reported zero vulnerabilities and exit code 0; `git diff --check` also returned 0. Main-worktree release records and unrelated edits were excluded. With separate push approval, the commit was pushed to `origin/bugfix/private-upload-transport`. PR #19 and the remote ref both match `c3e478116f1dae1d47ab524bf8d3b05e5f1c55a4`. CI run `36776578059` completed successfully: verify and database passed. Vercel deployment `9j3N3fbnVyDXZEFJGxbHYSU2H4Z3` and CodeRabbit also passed. The browser checked the branch Preview login URL and observed a redirect to `/platform-disabled`, consistent with the default simple mode. Hosted private-route acceptance remains open and requires separate branch-only environment and hostname setup approval. The older audit failure applies to `aa19129`. Production code, site mode, and DNS did not change. Recovery is a reviewed dependency correction; no Production rollback is needed for this repair. No merge or platform activation was performed.

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

## Private upload hydration repair — 2026-09-30

PR #19's review check succeeded but includes an actionable P2 finding. The staff and homeowner upload forms could submit a native GET before client hydration. The local repair follows the intake form pattern: `useSyncExternalStore` reports false on the server, controls stay disabled until hydration, submission checks readiness, and the forms specify `method="post"`. Both forms include a JavaScript requirement in `noscript`. No database or authorization boundary changed.

The targeted upload selection passed three files and 12 tests. Its first run passed ten tests but a worker failed to start. The complete rerun passed without unhandled errors. Type checking, lint, and the optimized build passed. Full Vitest passed 115 files and 1,651 tests, with 12 files and 55 tests skipped. The run took 712.95 seconds; most time was test environment startup.

Browser inspection observed disabled controls on initial render and enabled controls after hydration. Empty submission returned the expected file error. The homeowner route fit the requested 390px viewport without horizontal overflow and used POST. No captured warning or error appeared. Detailed browser network evidence and a fresh staff browser session remain unverified. The local server was restored on port 3020 after the build.

No file or email was sent in this smoke check. Final diff checks passed in both worktrees. Main-worktree release records remain separate. Existing database check results still apply because this repair changes only client readiness and form fallback behavior. Recovery is a local source correction; no Production rollback is needed.

With separate owner approval on 2026-10-04, only the four reviewed repair files were committed as `d8e55fa5444af9b4f2486381860bfb708dd0f934`. The message is `fix: guard private uploads until hydration`. The commit contains 62 insertions and nine deletions. The isolated worktree is clean, and the reviewed changes match the tested repair.

With separate push approval, `d8e55fa` was pushed to `origin/bugfix/private-upload-transport`. PR #19 and a remote ref read both match the full commit. CI run `37244906090` passed database checks but failed verify at the dependency audit. Vercel deployment `D9eKGZ14YuXYm7auuQW2cbhyUN63`, CodeRabbit, and Vercel Preview Comments passed. No merge, Preview setting, Production setting, DNS, or database change was performed. Required checks must pass before merge consideration.

## Current lint dependency repair

The audit failure is [GHSA-vfj7-8cjw-p6xm](https://github.com/advisories/GHSA-vfj7-8cjw-p6xm). Five high findings describe one dependency chain: Next.js ESLint plugin, fast-glob, micromatch, and braces. The advisory lists no patched braces release. Registry reads confirmed braces 3.0.3 and stable Next.js ESLint plugin 16.3.8. Canary 16.4.0-canary.60 still depends on fast-glob 3.3.1. Do not run the suggested forced downgrade to eslint-config-next 14.2.35.

The plugin's only installed fast-glob consumer calls `globSync` with `onlyDirectories: true` for configured root directories. A direct tinyglobby 0.2.17 alias removed the vulnerable chain but failed compatibility tests. Tinyglobby was already present through other development tools. No runtime package, Next.js version, audit threshold, or lint rule changed. npm 10 under Node 22 generated the candidate lock with installation scripts disabled. Its zero-vulnerability audit does not prove compatibility or completion.

Initial compatibility tests exposed relative paths and directory suffixes instead of fast-glob's absolute path formatting. Next.js consumes those paths through filesystem calls, so the revised test checks resolved directory identity and executes its navigation rule. It then found static-directory expansion differences; the direct alias is unsafe for that contract. A private adapter sets explicit absolute-path and static-directory options and rejects unsupported calls. The initial full ESLint configuration test exceeded five seconds; the replacement executes the actual Next.js rule through `Linter`. That filesystem integration test uses a 15-second limit without removing any assertion.

npm retained the old nested tinyglobby alias when the scoped local-file reference was added. The adapter was therefore not loaded, and compatibility tests still failed. Two earlier installations overlapped and produced generated-folder errors; their results were rejected. The lock was regenerated from the committed baseline with npm 10 under Node 22. No unrelated package version changed. The root development alias named fast-glob now uses the scoped `$fast-glob` override. A clean `npm ci --ignore-scripts` passed, followed by a separate exact `npm ci` pass. The plugin resolves `tools/next-eslint-glob/index.js`. The installed tree has no braces or micromatch, and audit reports zero vulnerabilities.

All four compatibility tests passed after the correct adapter loaded. Type checking and full lint also passed. The adapter uses module imports because the project's lint rule rejects CommonJS `require()` imports. Node 22.22.2 loaded the module from the plugin's CommonJS caller. The private package identifies itself as `3.3.1+cmg.1`; it implements only the reviewed call, not the full upstream API. Its README states this limit and the upstream-removal requirement.

The full unit run lost its process handle and had no saved final result. A process check found no running command for this worktree. The replacement full unit run passed 116 files and 1,655 tests, with 12 files and 55 tests skipped. It took 584.34 seconds and saved exit code 0 in session scratch storage. The optimized build passed and saved exit code 0. A repeated audit reported zero vulnerabilities, and diff checks passed. These results apply before the final filesystem-root correction. Credential-dependent database and live-provider checks were not enabled by this tooling repair. Earlier database evidence remains applicable because no database, storage, authorization, or runtime source changed.

Separate final review found that removing a trailing slash could change a filesystem root's identity.
The adapter now preserves filesystem roots.
All four compatibility tests, type checking, lint, full unit tests, build, and audit passed against this correction.
Unit tests passed 116 files and 1,655 tests; 12 files and 55 tests skipped.
The unit run took 542.88 seconds.
Each command saved exit code 0 in scratch directory `cmg-launch-final-bde56795ea2b4a5a9e5796ba78a9b139`.

The separate Luna review found a declared Node version gap.
The CommonJS caller needs Node 22.12 or later to load this ESM adapter.
The root manifest now requires `^22.12.0`; npm regenerated the lock.
After that metadata correction, exact `npm ci`, four compatibility tests, audit, and diff checks passed again.
No unrelated package version changed.
Installation reported existing React Email deprecation warnings; no new audit finding appeared.
The filesystem-root guard lacks a direct regression test; review found no remaining defect.
No staging, commit, push, hosted write, or deployment occurred.

## Combined PR review

Read-only GitHub inspection confirmed PR #18 at `284d155` and PR #19 at `d8e55fa`. PR #18's recorded finding concerns its documented CI selection; the committed README includes `src/lib/admin/partners.test.ts`. PR #19's recorded hydration finding is covered by the existing four-file repair. No remote comment was posted or resolved.

The two PRs overlap in the intake fixture helper and intake upload integration test. Keep PR #19's exact local-stack allowlist when combining them. Keep PR #18's partner-directory permission regression and its README and CI selection. Do not deploy PR #18 alone with the old dependency baseline. Combined CI and hosted acceptance remain required; separate green checks do not prove the combined release.

The existing PR #18 Preview browser session is an adjuster. Its dashboard and claim list show an empty assigned caseload. No warning or error was captured during the observed navigation. Detailed request diagnostics and combined-release acceptance remain unverified. The read-only Vercel lookup confirms Production remains ready at `2fdf6bd0982c9be5b58ae76b998870c5f215083f` on `develop`, with the existing app-domain alias.

The live Vercel project setting reports Node `24.x`. The committed manifest requires `22.x`; Vercel's [version rules](https://vercel.com/docs/functions/runtimes/node-js/node-js-versions) give the manifest priority. A deployed runtime version was not captured. The connector could not read team billing details or build logs. Commercial hosting and execution-log verification therefore remain open. No setting was changed.

The Supabase connector denied the aggregate queue and migration-history read.
No query ran, and no privilege changed.
The existing authorized browser session supplied fresh read-only evidence instead.
All 36 migration versions and names match the private-upload branch through `20260927120000`.
Stored SQL hashes and schema checks were not repeated.

The outbox Table Editor showed 28 records.
Filter `status:in:pending,failed` returned zero records without an error.
The dead filter showed 11 records, including four `claim_status_update` records and the old `invite`.
All five previously retired synthetic messages remain dead.
The cleanup table showed five records.
Filter `processed_at:is:null` returned zero records without an error.
All five records therefore have completion timestamps.
No message, record, SQL snippet, migration, backup, or reset was issued.

The main-worktree [launch checklist](LAUNCH_CHECKLIST.md) covers all current routes and operational release gates. Main-worktree records and unrelated edits stay outside the isolated dependency repair. Recovery is a reviewed local dependency correction before any release. No Production rollback is needed for an uncommitted local repair.

## Current hosted Preview configuration and public checks

Read-only Vercel inspection confirmed PR #19 deployment `dpl_D9eKGZ14YuXYm7auuQW2cbhyUN63` at `d8e55fa`.
Its assigned branch host is `cmgps-git-bugfix-private-upload-t-cffa43-robs-projects-c72886ba.vercel.app`.
The Vercel dashboard has no private-upload branch override for `SITE_MODE` or `NEXT_PUBLIC_SITE_URL`.
Existing overrides belong to the partner-directory and feature-platform branches.
No value was revealed or changed.
The dashboard still labels the team Hobby.

Browser checks covered Home, Services, Contractors, About, Contact, and File a claim.
Each route rendered its expected heading at 1280px, 390px, and 320px.
No horizontal overflow or broken loaded image appeared.
The initial mobile claim-form screenshot also showed a readable layout.
No warning or error appeared in the captured console log.
Detailed network requests, submissions, and loading transitions were not checked.
The keyboard checks below cover the mobile menu and skip link only.
The claim form later displayed the verification failure message.
An immediate render can precede that message; do not treat an initially empty alert list as verification success.
No form was submitted and no file was uploaded.

In this simple Preview, `/login`, `/mfa`, `/admin`, `/portal`, `/partner`, and `/invite/not-a-token` redirected to `/platform-disabled`.
These checks prove route closure, not platform acceptance.
Cloudflare redirected the existing account URL to sign-in.
Current Turnstile hostname coverage remains unverified.
The owner must sign in before the hostname can be checked.
No hostname, environment, DNS, account, or Production setting changed.

The authorized Vercel browser session also opened current request logs and cron settings.
Observed Preview public requests returned 200, and observed private-prefix requests returned 307.
These are provider request records, not complete browser network traces.
The Production cron filter returned no request logs in the available last-hour window.
Longer windows showed a Pro upgrade requirement.
This does not prove that a scheduled daily run failed or succeeded.
Current cron settings show Enabled with outbox `0 14 * * *` and cleanup `17 14 * * *`.
They match `vercel.json`.
No Run button or enable control was used.
The browser blocked an unauthenticated Production outbox URL with `net::ERR_BLOCKED_BY_CLIENT`.
No response was available; the endpoint rejection check remains incomplete.
No alternative client was used to bypass that block.

### Current mobile keyboard acceptance

On 2026-10-04, the PR #19 Preview at `d8e55fa` passed these checks at a verified 390 × 844 viewport.
Enter opened the menu and moved focus to Home.
Main and footer had `inert` attributes while the menu was open; body scrolling was locked.
Tab from the last menu link moved focus to Close menu.
Shift+Tab from Close menu moved focus to the last menu link.
Escape closed the menu and restored focus to Open menu.
Closing restored background access and body scrolling; the closed panel had `inert`.
Keyboard navigation to Services rendered its expected heading and closed the menu.
Enter on Skip to content focused `main` and set `#main`.
No warning or error appeared in the captured tab console.
No telephone link, form submission, hosted write, or email send occurred.
These checks do not prove form acceptance or private-route behavior.

Contact fields had associated labels and the expected required name and phone controls.
Enter opened and closed the first FAQ answer.
The contact form also displayed the verification failure; submission remains blocked.
The intake form had no unlabelled visible input, select, or textarea.
Selecting Yes for a second policyholder displayed four required fields with labels.
Selecting No removed those fields.
The expanded form had no horizontal overflow at 390px; captured console warnings and errors remained empty.
No personal data was entered, consent accepted, or form submitted.
The temporary viewport override was reset, and all review tabs remain open for continued work.

The current GitHub read found no new PR #19 finding.
Its recorded hydration comment still refers to the earlier code.
PR #19 remains at `d8e55fa`, with the audit failure in run `37244906090`.
GitHub reports `develop` at `2fdf6bd0982c9be5b58ae76b998870c5f215083f`, without branch protection.
No review comment, credential, permission, or remote Git state changed.

## Retention procedure review

The retained policy still requested a backup and simple mode despite later owner decisions.
The local document now uses the approved no-backup forward-repair preflight and the current staff-mode activation gate.
It separates the selected manual PandaDoc flow from optional API and webhook acceptance.
A proposed manual subject-request procedure covers identity, scope, other people's data, complete exports, holds, and separate transmission or erasure approvals.
No export tool, request register, or database-enforced hold is claimed to exist.
Owner approval, legal review, synthetic completeness tests, and effective operator controls remain required.
No public terms changed and no private record was exported or erased.

A bounded Luna source review checked consent withdrawal and email delivery.
Customer withdrawal sets `withdrawn_at` under RLS and preserves original consent evidence.
The database audit trigger records that change.
The portal promises no marketing email about the claim while claim messages continue.
Current source identifies its templates as transactional; no separate marketing producer was found.
The delivery engine and cron filter do not consult withdrawal state.
Tests cover the consent record change and ownership, not withdrawal-based delivery filtering.
This does not prove that the application currently sends marketing mail after withdrawal.
CMG must define any suppressed category before its acceptance test or implementation.
No delivery policy or application code changed during this review.

## Public response security checks

On 2026-10-04, anonymous HTTPS GET checks covered the Production and PR #19 Preview home routes.
Both returned 200 without credentials or writes.
The observed hosts were `app.cmgpropertysolutions.net` and `cmgps-git-bugfix-private-upload-t-cffa43-robs-projects-c72886ba.vercel.app`.
The release record identifies them with Production `2fdf6bd` and Preview `d8e55fa`; response headers do not independently prove commit identity.

| Header | Observed on both hosts |
|---|---|
| Content-Security-Policy | Nonce scripts, strict-dynamic, Cloudflare frame and connection sources, no frame ancestors, no objects, self-only form actions, HTTPS upgrade |
| Strict-Transport-Security | `max-age=63072000; includeSubDomains; preload` |
| X-Content-Type-Options | `nosniff` |
| X-Frame-Options | `DENY` |
| Referrer-Policy | `strict-origin-when-cross-origin` |
| Permissions-Policy | Camera, microphone, location, payment, USB, and interest-cohort disabled |
| Cross-Origin-Opener-Policy | `same-origin` |
| X-Powered-By | Absent |
| Cache-Control | `no-store, must-revalidate, no-cache, max-age=0, private` |

Two subsequent responses per host had different CSP nonces.
Production had 12 script tags per response, including one data script; every tag matched its response nonce.
Preview had 11 executable script tags per response; every executable tag matched its response nonce.
Its one data script was excluded from that executable-script check.
Neither observed policy allowed `unsafe-eval` or a loopback connection source.
The isolated release-candidate configuration enables loopback sources only for local development or a local application origin.
Cloudflare is an allowed source in the observed policy, but this does not prove why its widget failed.

No browser network-inspection backup tool was available in the current tool inventory.
These direct HTTP checks supplement the earlier browser checks; they are not a complete browser network trace.
Private-route response headers, request failures, and final release behavior remain open.
The blocked cron endpoint was not retried through another client.
No security header, environment, Production record, DNS record, or credential changed.

## Manual signing procedure review

The 2026-10-04 source review found two missing steps in the local signing guide.
Staff must record a confirmed provider send with **Mark letter as sent**.
A manual signed-document upload does not advance the claim automatically.
Staff must separately select **LOR signed** and submit **Move to lor signed**.
The action and database gate require an existing `lor_signed` document.
The private-upload completion path stores documents and upload-session results; it does not change claim status.
The optional provider webhook completion path has different behavior and must not be used as manual-path evidence.

The revised guide separates manual acceptance from optional API setup and webhook tests.
It requires review of printed values, signer assignments, required signature fields, visibility, and uncertain sends.
The prefill source can shorten long text and omit characters outside its supported font encoding.
Staff must stop when the resulting value no longer identifies the intended person, policy, property, or agreement term.
Current provider documentation describes web-upload field placement separately from the role-qualified API tag format.
The actual CMG manual web-upload recognition and field assignments remain unverified.
Local tag tests cannot prove them.
No PDF asset, legal wording, application source, provider document, claim, or email changed.
Existing passing source tests were not repeated for this documentation-only correction.
`git diff --check` passed.

## Approved repair commit and current Turnstile configuration

On 2026-10-05, the owner approved the six-file audit repair commit and restored Cloudflare sign-in.
Commit `3922e5a` contains only the two manifests, the compatibility test, and the three adapter files.
It is on `bugfix/private-upload-transport` in the approved isolated worktree.
The final staged check found one extra blank line at the adapter's end.
That whitespace was removed; the staged check passed before commit.
The isolated worktree is clean, and the commit remains unpushed.
Main-worktree records, PDF files, and unrelated edits are excluded.
Earlier application checks remain applicable; no behavior changed in this final whitespace repair.

The existing Cloudflare widget remains Managed with no pre-clearance and five permitted hostnames:

- `cmgpropertysolutions.net`
- `cmgps-git-bugfix-partner-directory-count-robs-projects-c72886ba.vercel.app`
- `cmgps-git-docs-record-production-c2abd6-robs-projects-c72886ba.vercel.app`
- `cmgps-git-feature-claims-platform-robs-projects-c72886ba.vercel.app`
- `cmgps.vercel.app`

The PR #19 branch host is absent.
Its observed public client bundle `/_next/static/immutable/chunks/0x419vu9g4852.js` contains the same public widget key shown in Cloudflare.
The initial HTML check matched a chunk filename, not the widget key; it was not used as configuration evidence.
Cloudflare's [hostname rules](https://developers.cloudflare.com/turnstile/additional-configuration/hostname-management/) require an authorized hostname.
They also explain why the root CMG entry covers `app.` but an unrelated Vercel branch does not.
This is a verified configuration blocker; successful verification after its repair remains unproven.
No secret key was revealed or rotated.
No widget setting, hostname, DNS record, or Production record changed.
Separate requests cover the exact commit push and the addition of only the missing Preview hostname.

The owner then approved both actions.
Two approved push attempts did not execute because automatic approval review failed with a model-capacity error.
The browser inspection also did not execute for the same reason.
No push or hostname change occurred. Approval is retained for both unchanged actions.
The next push retry succeeded through the same approval checks.
PR #19 now matches full head `3922e5a08e8ad89780225825e9ea64ee28b6aa42`.
CI run `37314652490` passed both jobs: `verify` in 3m43s and `database` in 3m10s.
Audit, type, lint, unit tests, build, pgTAP, and database-backed Vitest steps passed.
Vercel deployment check `J5gAfx3nXLbZAKNW2kGqcmv5xpAq` and CodeRabbit passed.
GitHub reported runner/action runtime deprecation notices; no required check failed.
The browser runtime restarted, and the Codex browser is unavailable.
Chrome opened the exact widget edit URL but redirected to Cloudflare sign-in.
The owner must sign in there before the approved hostname change can run.
Approval is retained; do not request duplicate approval for either action.
Current Vercel browser review confirms no PR #19 override for `SITE_MODE` or `NEXT_PUBLIC_SITE_URL`.
The connector returned `INVALID_ARGUMENT` for read-only environment and deployment requests; browser review supplied the configuration evidence.
Separate approval was requested for branch-only platform mode, its stable Preview site URL, and redeployment.
No environment value, hosted data, Production deployment, or DNS record changed.

## Combined PR review at current heads

Read-only GitHub review confirms PR #18 at `284d155` and PR #19 at `3922e5a` are open against `develop`.
Each PR is individually mergeable; this does not prove compatibility with the other PR.
Their local common ancestor is `2fdf6bd0982c9be5b58ae76b998870c5f215083f`.
`git merge-tree --trivial-merge` reports conflict markers in two overlapping files:

- `src/lib/intake/test-fixtures.ts`
- `src/lib/storage-cleanup/intake-uploads.test.ts`

PR #18 permits explicitly configured local project identifiers and ports in its fixture helper.
PR #19 instead uses the exact `CMGPA` and `CMGPA_private_upload_disposable` stack allowlist.
Retain PR #19's API port, database port, container, URL, and fixture-ID checks during integration.
Retain PR #18's partner directory code, authenticated AAL2 regression test, and CI test selection.
PR #19's new upload tests must keep the matching allowlist helper import.
No actual merge, branch creation, source change, database reset, or hosted write occurred.
The combined release still requires separately approved integration work and full relevant validation.

## Approved PR #19 platform Preview

The owner approved the two branch-only overrides and Preview redeployment.
The original Chrome tab timed out twice. A fresh tab restored dashboard access.
The connector returned `INVALID_ARGUMENT`; the CLI lacked an active CMG account login.
Its temporary device-login flow was stopped after browser recovery. No CLI login is now needed.
Automatic review rejected selecting the branch while Production remained selected in the unsaved form.
The dashboard prevents removal of its last environment selection.
The unsaved key and value fields were cleared first, then the branch was selected and Production removed.
Only after the exact branch-only scope was verified were the approved values entered and saved.
No Production environment change was submitted.

Saved configuration:

- Preview branch: `bugfix/private-upload-transport`
- `SITE_MODE=platform`
- `NEXT_PUBLIC_SITE_URL=https://cmgps-git-bugfix-private-upload-t-cffa43-robs-projects-c72886ba.vercel.app`

The saved URL, `platform` value, and branch-only scope were verified in the dashboard.
The redeploy dialog selected Preview, source `3922e5a`, and the same branch alias.
Build-cache reuse stayed unselected. Ready deployment: `dpl_5dkvuwLMDURbm1qEe2dQM8r8g1T2`.
Its unique host is `cmgps-q9avikrzr-robs-projects-c72886ba.vercel.app`.
The new build became ready in approximately one minute.
No commit, merge, Production deploy, DNS change, database write, message, or backup occurred.

Current browser results:

- `/login` renders its labeled email and password form.
- Unauthenticated `/admin`, `/portal`, `/partner`, and `/mfa` redirect to login with their `next` paths.
- `/invite/not-a-token` renders the generic expired-link page; captured warnings and errors are empty.
- At 390×844, login and invalid-invite pages have no settled horizontal overflow and no captured warnings or errors.
- Login email and password inputs have associated labels.
- An immediate viewport-change sample showed a transient six-pixel overflow; the settled viewport and element bounds showed none.
- The temporary viewport override was reset.
- Production `/portal` still redirects to `/platform-disabled` and shows the closed-account notice.

Browser control intermittently timed out or detached during navigation.
The actual rendered state was inspected before proceeding; actions were not blindly repeated.
Owner sign-in was handed off on the new Preview login tab.
Cloudflare sign-in was later recovered in the Codex browser; the approved hostname addition and retest are complete below.
Authenticated roles, private mobile routes, live uploads, and email acceptance are not yet proved on this Preview.

## Approved PR #19 Turnstile hostname and retest

On 2026-10-05, the restored Codex browser exposed the signed-in CMG widget edit page.
Only `cmgps-git-bugfix-private-upload-t-cffa43-robs-projects-c72886ba.vercel.app` was added.
The five existing entries remained selected; Managed mode and disabled pre-clearance stayed unchanged.
The saved widget list shows six hostnames, Managed, and No pre-clearance.
The initial Enter key saved the unchanged five-entry form; the visible custom-hostname option was then selected and Update saved six.
No original entry, DNS record, secret, widget key, or Production setting changed.

On ready platform Preview `dpl_5dkvuwLMDURbm1qEe2dQM8r8g1T2` at `3922e5a`:

- `/forgot-password` showed the green Turnstile Success result.
- `/forgot-password`, `/contact`, and `/file-a-claim` each held a nonempty verification response.
- None displayed the verification failure message.
- The read-only check printed only response presence, never token values.
- No CAPTCHA control was clicked, form submitted, email sent, or hosted test record written.
- Captured Cloudflare iframe logs contain obfuscated `%c%d font-size:0;color:transparent NaN` warnings and errors despite successful verification.
- No full network trace was available; these checks do not prove backend verification or email delivery.
- Owner sign-in is now complete. Current authenticated read results appear below.

Recovery screenshot: `C:/Users/rob/.codex/visualizations/2026/08/30/01a05474-d495-7123-b74b-29a8631befca/preview-password-recovery-success.jpg`.
Release records remain local and uncommitted.

## Current mobile verification and integration gate

On 2026-10-05, the ready PR #19 Preview at `3922e5a` passed further browser checks:

- Fresh recovery, contact, and intake forms each held a verification response at a measured 390px viewport.
- Recovery document width was 390px; contact and intake document width was 375px. No horizontal overflow appeared.
- Recovery showed the green Success result; no form displayed the verification-failure message.
- The three previously unchecked FAQ disclosures opened and closed with Enter at desktop width.
- Native accessibility presents these disclosures as buttons, while the DOM snapshot identifies generic summaries.
- The initial button locator matched no element; inspection identified native `summary` controls, and all three passed using those controls.
- No form submission, email, hosted record write, CAPTCHA interaction, or application code change occurred.
- Full network tracing remains unverified; earlier Cloudflare iframe diagnostic entries remain recorded above.

Temporary width overrides were cleared from the final test tab.
The empty agent-created recovery tab retained its earlier width after the browser reset.
It was replaced with a fresh 1280px recovery tab; no user tab was closed or entered data discarded.
Mobile recovery proof: `C:/Users/rob/.codex/visualizations/2026/08/30/01a05474-d495-7123-b74b-29a8631befca/preview-mobile-password-recovery-success.jpg`.

Current GitHub reads confirm PR #18 at `284d155` and PR #19 at `3922e5a` remain open and individually mergeable.
Both have successful verify, database, Vercel, and CodeRabbit results.
The owner authorized the local integration task after restoring browser access.
The previously clean private-upload worktree now holds local branch `bugfix/launch-integration`, based on `develop` at `2fdf6bd`.
Local three-way application combined PR #19 at `3922e5a` with PR #18 at `284d155`.
Both fixture conflicts retain PR #19's exact allowlist, loopback checks, container/port verification, and UUID-scoped cleanup.
The partner fix, database regression, and CI selection remain included.
Original branches and remote heads remain unchanged. No commit, push, PR update, remote merge, or deployment occurred.

Adversarial review found that a separate failed active-count query could display zero companies.
The local repair rejects either query error or missing exact count with a generic error.
Seven unit cases cover both failures, both missing counts, later-page totals, and status filters.
The tests also assert the exact count query options.
Next.js 16.3's installed guide and implementation show that `retry()` refreshes server data before resetting the boundary.
The local admin boundary now uses this recovery call. Its regression verifies the callback and keeps error text out of the page.
The first new component test failed at the server-only import boundary.
Mocking only its imported server action matches the client/server boundary; all eight focused tests then passed.

| Combined local check | Current result |
|---|---|
| Focused upload and tooling checks before count repair | 5 files and 22 tests passed |
| Partner query and admin error recovery | 2 files and 8 tests passed |
| Final type check and lint | Passed after retry repair |
| First full unit run | 117 files and 1,662 tests passed; 13 files and 56 tests skipped; 450.97 seconds |
| Final platform build | Passed after retry repair |
| Audit | Zero vulnerabilities |
| Final full unit run | 118 files and 1,663 tests passed; 13 files and 56 tests skipped; 519.64 seconds |
| Three-mode affected checks | 5 files and 113 tests passed in each of `simple`, `staff`, and `platform` |
| Combined pgTAP | 44 files and 1,350 assertions passed after the approved disposable reset |
| Combined database-backed CI selection | 34 files and 243 tests passed; one live PandaDoc file and test skipped; 148.27 seconds |
| Generated database types | Fresh disposable-schema output matches the candidate after line-ending normalization |

Pure tests use an unreachable loopback URL and placeholder key. Live Resend and PandaDoc tests remain disabled.
Installed Vitest 4.1.11 matches the lock file. Node 22.22.2 and npm 10.9.7 run these checks.
The first staff-mode selection failed only the test named “resolves missing to simple”.
Its undefined argument used the existing environment default, while the test incorrectly assumed that variable was absent.
The fixture now explicitly unsets `SITE_MODE` for that case and verifies the default environment value in all three modes.
This test-only repair changes no route or mail rule. All three affected selections, type check, and lint passed afterward.
The owner approved resetting only `CMGPA_private_upload_disposable` on 2026-10-05.
The approved reset completed using explicit `--local` and the verified scratch directory.
It recreated the local database, applied all 36 migrations, seeded test data, and restarted its containers.
Production and retained local stacks did not change. No backup was created.
The disposable config is in session scratch directory `cmg-private-upload-6934583c11c14e98a1a35698847eab3b`.
The first Supabase help call failed on a sandbox telemetry write.
The approved outside-sandbox help check succeeded and confirmed the pinned CLI version 2.116.0.
Migration file names and hashes match the candidate.
The scratch project initially held only the two affected pgTAP files.
The 42 missing candidate tests were copied without deletion or database commands.
All 44 pgTAP SQL files match the candidate hashes.
The reset and `supabase test db --local --workdir <disposable-directory>` both returned exit code zero.
The final reset preflight confirms the disposable seed file matches the combined candidate by SHA-256.
Its config identifies `CMGPA_private_upload_disposable`, API port 15521, database port 15522, and shadow port 15520.
Port 15529 belongs to its pooler, not its shadow database.
Docker lists the disposable database and API containers on 15522 and 15521.
The retained `CMGPA` database and API containers remain separately identified on 15422 and 15421.
The sandbox could not read Docker state; an authorized read-only command supplied this evidence.
The read-only preflight changed no container, mapping, or database data.
After reset, local status verified API `http://127.0.0.1:15521`; credentials stayed in memory and were not printed.
The database-backed selection used `CMG_TEST_STACK=CMGPA_private_upload_disposable` and Node 22.22.2.
It ran `src/lib/esign`, `src/app/api/pandadoc`, `src/lib/storage-cleanup`, and `src/lib/admin/partners.test.ts`.
A database probe passed before discovery. No database suite silently skipped for unavailable credentials.
Resend and PandaDoc keys and the live-draft opt-in stayed disabled; only the intentional live provider test skipped.
Type generation used explicit `--local --workdir` and compared output in memory; the generated file did not change.
The candidate has 53 staged files and no unstaged tracked changes. No commit exists for the combination.

## Current authenticated owner evidence

Chrome read-only acceptance on PR #19 at `3922e5a` passed dashboard, staff, intake, leads, questions, settings, and audit.
The active owner has MFA enabled. Last-owner demotion and deactivation controls remain disabled.
The adjuster test account has MFA enabled. No invitation is outstanding.
Synthetic claim `CMG-2026-0003` passed overview, claimants, documents, activity, financials, and history reads.
Its completed representation panel no longer offers stale pending controls.
The document page shows four files and their visibility; the signed letter remains CMG only.
The private upload form uses POST. A fresh mobile page shows disabled controls before hydration and enabled controls afterward.
No file was selected or uploaded during these reads.
The New lead filter returned two records. Synthetic claim search displayed “Nothing matches those filters.”
Dashboard, documents, claims, search empty state, settings, staff, intake, leads, questions, audit, and all six synthetic claim sections fit measured 390px.
The first viewport override did not affect the older owner tab. A separate Chrome test tab produced measured 390px evidence.
The first full-page screenshot timed out; a viewport screenshot succeeded.
Mobile proof: `C:/Users/rob/.codex/visualizations/2026/08/30/01a05474-d495-7123-b74b-29a8631befca/preview-staff-documents-mobile.jpg`.

The current PR #19 partner directory still reports no companies because that Preview lacks PR #18's fix.
This is an open hosted gate for the combined candidate.
Chrome captured five asynchronous-listener channel errors on the synthetic claim overview at 15:28:47 UTC.
Their source is unverified. Subsequent captured logs contain no new error from the inspected routes.
Full request tracing remains unavailable. No hosted record, role, assignment, status, financial value, or document changed.
Temporary viewport overrides were cleared; the final test tab returned to 1920px.
The original owner tab remains on the dashboard. User tabs and both browser sessions remain open.

Further owner checks used a separate Chrome tab on the same PR #19 deployment.
`/portal` and `/partner` both redirected the owner to `/admin`; the dashboard heading confirmed the final route.
Claim `00000000-0000-4000-a000-000000000000` and malformed ID `not-a-uuid` displayed identical generic not-found text.
The not-found page measured 390px without horizontal overflow. Captured warnings and errors were empty.
Proof: `C:/Users/rob/.codex/visualizations/2026/08/30/01a05474-d495-7123-b74b-29a8631befca/preview-owner-generic-not-found.jpg`.
The viewport override was cleared. These owner reads do not prove adjuster or customer isolation.

Fresh GitHub reads confirm PR #18 at `284d155` and PR #19 at `3922e5a` remain open, individually mergeable, and green.
Both retain one unresolved, current review thread.
Exact PR heads include the corrected README database-test selection and hydration-protected upload forms.
No review comment or thread was changed. Combined validation remains required before release.

The current Preview settings page reports configured PandaDoc API and webhook keys.
Source inspection confirms a nonblank API key selects PandaDoc; absent or blank selects manual signing.
This Preview therefore cannot prove the selected manual Production flow.
Separately approved branch-only key overrides and redeployment are required before manual hosted acceptance.
Disable both keys only for the selected test branch; preserve shared Preview values and Production settings.
The combined branch also requires its own approved Preview mode, URL, and Turnstile hostname.
No provider key was read, printed, changed, or sent. No PandaDoc document was created or sent.

## Current email-provider delivery evidence

The owner restored Chrome Resend access on 2026-10-05. Read-only email-list records show Delivered:

| Test message | Recipient | Provider record |
|---|---|---|
| Staff invitation | `4miodio@gmail.com` | `01a0e500-6d22-774e-8daf-f30fcd766f92` |
| Vendor invitation | `robspeciale@gmail.com` | `01a0e506-2c25-70b5-8eac-50e336150562` |
| Owner reset | `rob@thespeciales.com` | `01a0e4ac-4e53-7162-8e75-89282abcb0ac` |
| Homeowner reset | `rob@miodiollc.com` | `01a0e4e3-912a-709d-999e-a7cf08a70cdc` |
| Corrected homeowner invite | `rob@miodiollc.com` | `01a0e4d2-c38f-737d-80ab-d73d6f86fcb2` |
| Synthetic question alert | CMG staff inbox | `01a0e4da-2d11-7744-85b7-7bb083f3f6ef` |
| September 15 lead receipt | `rob@miodiollc.com` | `34c1225a-203e-4b8a-bb59-a400ba3e823b` |
| September 15 lead alert | CMG staff inbox | `0d3345a3-84fa-41cb-9d6b-f8f99eefca04` |

The provider date filter covered the last 30 days. No email body or invitation token was needed.
The current Domains list confirms `cmgpropertysolutions.net` is verified.
The older unused `updates.cmgpropertysolutions.net` entry remains not started. No domain setting or DNS record changed.
No message was sent or retried. Dead synthetic outbox rows stayed unchanged.
Delivered does not prove inbox receipt; the September 15 lead receipt remains an owner check.
Provider proof: `C:/Users/rob/.codex/visualizations/2026/08/30/01a05474-d495-7123-b74b-29a8631befca/resend-delivered-invitations.jpg`.
Owner and provider sign-in are complete. Combined local database checks passed after the approved reset.
Separate Git actions and combined hosted acceptance are the current engineering gates.

Resend Metrics for all domains, September 21 through October 5, shows eight emails and 100% deliverability.
Transient, permanent, and undetermined bounce counts are zero. The complaint count is zero.
The page reports 15-minute updates; this is bounded historical evidence, not a guarantee for future delivery.
Metrics proof: `C:/Users/rob/.codex/visualizations/2026/08/30/01a05474-d495-7123-b74b-29a8631befca/resend-delivery-metrics.jpg`.
The current Webhooks page displays “No webhooks yet.” No webhook was added or changed.
The combined candidate has no Resend event receiver. Its sender records provider acceptance, not later delivery events.
It sends no explicit `replyTo`; a monitored reply destination still needs verification.
Domain verification permits sending but does not prove that the sender mailbox receives replies.
No message, suppression, provider setting, DNS record, or queue row changed during this review.

Recommended email procedure, pending owner approval:

1. Assign one CMG operator to inspect Resend Emails and Metrics each business day.
2. Inspect the CMG outbox and cleanup queue after the scheduled jobs.
3. Record failures and uncertain sends in an access-controlled operational log.
4. Do not put recipients, message bodies, or recovery links in repository documents.
5. Check provider records before requesting approval to resend an uncertain message.
6. Never resend synthetic rows that the owner marked dead.
7. Confirm a monitored mailbox receives replies to the configured sender.
8. Escalate a bounce or complaint before attempting another send to that address.

No operator is assigned by this proposal. Approval, reply-path verification, and scheduled-job evidence remain open.
[Resend's sending guide](https://resend.com/docs/dashboard/emails/introduction) documents dashboard delivery monitoring.
[Its webhook guide](https://resend.com/docs/webhooks/introduction) describes event notifications; no such integration is configured here.

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
