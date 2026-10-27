# CMG release handoff — engineering evidence

On October 27, the owner approved accepting synthetic claim `CMG-2026-0007` once on Preview. The claim is `under_review`, assigned to `Staff1 Tester`, and visible in that test adjuster’s claims list. One customer invitation to `rob@miodiollc.com` was sent on attempt one and reached the inbox. The owner approved its acceptance; the invitation was accepted and linked to the existing active customer account. The existing homeowner account then signed in and opened claim CMG-2026-0007; its synthetic details and assigned test adjuster were visible. The separate status email to Rob is queued with zero attempts and can be delivered by a later scheduled run. No PandaDoc document was created. Do not repeat acceptance, resend the invitation, run the worker manually, or delete records without separate approval.

On October 27, the owner approved one synthetic Preview intake without files. It was submitted once and returned `CMG-2026-0007`. At submission, the hosted database saved claim `127cdecf-564f-4d70-8f32-138b93bc8bd8` in `new_intake`, one claimant, and email and SMS consent records. The upload session completed with zero files. At submission, no adjuster was assigned and no PandaDoc document existed. Two emails to `rob@miodiollc.com` were sent on attempt one; Resend shows Delivered and both messages reached the inbox. The staff alert and confirmation contain the synthetic reference and details. The adjuster account could not see this unassigned intake. The owner queue shows CMG-2026-0007 and the synthetic details. Keep all test records. Do not resubmit, resend, assign, sign, or delete without separate approval.

On October 27, the owner approved one Preview email-consent test. The form was submitted once. One synthetic lead `2f318635-431a-44ee-b7df-36ce72df34e0` and one email-consent record were saved. The staff menu count changed from three to four after client navigation without a page reload. Two outbox rows addressed to `rob@miodiollc.com` were sent on attempt one; Resend reports both Delivered. Both messages reached the Roundcube inbox. The staff alert matched the synthetic name, phone, email and message; the automatic reply rendered successfully. Keep the test records; do not submit or send again.

On October 27, staff menu count fix `4c974eacbe6be09a874c9e5fc73f797c83cad41c` was pushed to draft PR #28. In the disposable local database, a synthetic lead changed the count from one to two after staff navigation without a page reload. The staff menu passed desktop and 390px checks; the active phone link remained visible. Simple mode kept the admin page closed; staff and platform modes opened the staff menu. Type, lint, build, and focused tests passed; the full suite passed 1,764 tests and skipped 57. No browser warnings or errors were captured; full network traces were unavailable. The Preview deployment for this commit is Ready. Read-only hosted staff navigation passed at desktop and 390px with the existing lead count; the active phone link stayed visible and no browser warnings or errors were captured. No new hosted lead was created. GitHub verify and database checks passed for this commit. The approved hosted count-change proof passed. One synthetic lead and its synthetic staff MFA setup remain in the disposable database. No hosted data or Production setting changed.

On October 27, the approved Preview contact form was submitted once. One synthetic lead was saved and appeared in the staff list. One alert to `rob@miodiollc.com` was sent on attempt one; Resend reports Delivered. Inbox receipt and the synthetic message contents were verified in Roundcube. The existing staff menu count updated after page refresh. Keep the test records and do not resubmit. Evidence: `contact-preview-result-2026-10-27.json` in session scratch.

Owner menu acceptance on Preview `71bd6ea` passed 46 checks at 1280px and 390px. These include 36 forward/reverse focus cases, six keyboard navigation cases, and four scrolled-page cases. No browser warnings or errors were captured. Staff menu acceptance passed 34 checks: 20 keyboard focus cases, 10 link checks, and four scrolled-page cases. Evidence: `t63-staff-hosted-menu-2026-10-27.json` in session scratch. Evidence: `t63-owner-hosted-menu-2026-10-27.json` and `t63-owner-hosted-phone-settings-2026-10-27.png` in session scratch.

Earlier application source is signed `8ae5c70e0be55fb9b9df1f80c76a62d0fecabbb0` in draft PR #28. Its CI and local checks pass, including audit. Vendor checks pass on its Ready Preview. Hosted owner and staff menu checks passed. A later records-only commit may advance the PR head.

Earlier source checks passed: 1,763 tests passed and 57 skipped; type, lint, build, audit, and 39/39 site-mode checks pass. The approved Undici repair changed only the lockfile leaf to 8.12.3. `package.json` and 115 production package entries were unchanged by this repair. Earlier approved runtime updates remain included.

Portable Node 22 was verified by SHA-256. The current local checks used that runtime. No dependency setup scripts ran during the approved scripts-disabled install.

Current release-candidate and staff-alert evidence is recorded below. Other dated checks retain their recorded scope. Current candidate results supersede earlier local candidate results only.
Rewrite it in place. Do not append dated sections.
The full dated record is in [the 2026-09-17 archive](../../archive/docs/temp/2026-09-17-consolidation/HANDOFF.md).

Use [RELEASE_STATE.md](../RELEASE_STATE.md) for production facts, open PRs, migration heads, and the ordered next steps.
Use [BLOCKERS.md](BLOCKERS.md) for owner decisions.
Use [README.md](../../README.md#simple-mode-production-runbook) for the release procedure.
Use [INTAKE_VENDOR_ACCEPTANCE.md](INTAKE_VENDOR_ACCEPTANCE.md) for the contractor and vendor-link feature record.

<a id="current-release-evidence"></a>

## Current release evidence

GitHub currently reports `develop` at `1b7f7f98e54a358b3a95875483a63d3f882573a3`.
PRs #20, #21, and #22 are merged. PRs #18 and #19 are closed without merge; #22 includes their fixes.
The earlier v2 tree matched `develop`. Verified application source `8ae5c70` is published in draft PR #28, targeting `develop`.
The old `9a80e09` branch and the dirty main checkout were not switched, merged, or reset.
GitHub run `37713120551` passed `verify` and `database` for the current integration commit.
PR #22 run `37712410380` also passed both jobs.
Production alias inspection now resolves to Ready `dpl_GoXHV8n8KfTVt5BDyZosJF3jvXPk` at `cmgps-eyxviozc7-robs-projects-c72886ba.vercel.app`.
Its source remains `develop` commit `1b7f7f98e54a358b3a95875483a63d3f882573a3`.
Current unauthenticated Production `/portal` and `/partner` return 307 to `/login`; this matches the owner-recorded October 7 platform activation.
The owner approved `EMAIL_STAFF_INBOX=rob@miodiollc.com` for Production, Preview, and Development, followed by two same-source rebuilds.
The authenticated CLI accepted the exact value and reported all three scopes as Config. The dashboard shows one updated All Environments entry.
Dashboard value reveal required another verification check. No secret was read, and decrypted readback was not obtained.
One Production rebuild and one PR #24 Preview rebuild completed. Both approvals are consumed; do not repeat either rebuild.
PR #24 is Ready as `dpl_Zz8hWeU9yJ8Fm4hdAjKyWRHcbkfE` at `cmgps-anb859aju-robs-projects-c72886ba.vercel.app`.
Its source remains `d523469e88149c76b8181ed4f277d757f608f47c` on `codex/security-upload-session-checks`. Existing aliases resolve to the new deployments.
Both hosts returned 200 for `/`, `/contact`, and `/file-a-claim`. Both returned 307 to login for `/admin`, `/portal`, and `/partner`.
All six public page loads also rendered in Codex. No form was submitted. Captured application-origin console errors were zero.
Each tab captured two opaque Cloudflare-frame errors. Full browser request traces were unavailable. No test email was sent.
Delivery through the updated setting remains untested. Historical delivery evidence below retains its original scope.
No source code, DNS, database, account, session, access grant, or backup changed. Local evidence records were updated without another build.
The owner prohibits further agent emails, invitations, or access grants to the CMG domain or its subdomains. Public pages must remain public.
Older deployments retain their original recipient settings. Other email types retain their own recipients. This is not a global provider-level domain block.
Public contact links still show Austin's address. This batch did not authorize code changes to those links.
Evidence: `staff-alert-redirect-execution-2026-10-23.json`, both `staff-redirect-*-after-2026-10-23.json` files, and `staff-alert-read-only-routes-2026-10-23.json`.
Proof images: `staff-alert-setting-scopes-2026-10-23.png` and `staff-alert-rebuilds-ready-2026-10-23.png` in the session scratch folder.
The later combined Preview empty-file check spent a hosted rate-limit attempt, as recorded below.

### Current combined candidate verification

Verified application source `8ae5c70e0be55fb9b9df1f80c76a62d0fecabbb0` is published in draft PR #28.
It combines exact PR #24 `d523469`, PR #25 `56cff18`, and PR #27 `5c3886d` on `codex/launch-release-candidate`.
Tested application source `8ae5c70` changes 36 paths. A later records-only commit can add four documentation paths.

Signed `d72dc4d` contains the admin focus repair and Undici update. Signed `8ae5c70` contains the partner metadata repair and regression tests.

Current local results: 1,763 tests passed and 57 skipped; 128 files passed and 14 skipped in 368.37 seconds.
Type check, lint, and the safe-placeholder production build exit zero. The dependency audit reports zero vulnerabilities.
All 39 local GET checks pass across simple, staff, and platform modes. Their owned server ports closed after testing.

The 57 skips use database or live-service gates. Docker is stopped; no local stack reset ran during these repairs.
Current CI run `40267147255` passes both jobs, including 1,350 pgTAP assertions and 253 database-backed Vitest tests.
One live PandaDoc test skips in the database job. Earlier local password-session proof remains separate evidence.

The official portable Node 22.22.2 archive matched its published SHA-256 before use. No application check used the system Node 24 default.
The locked install disabled setup scripts. The latest repair changed only Undici to 8.12.3; all 115 production entries stayed unchanged.
Existing React Email deprecation warnings remain. No production package was updated to remove those warnings.

On exact Ready Preview `dpl_9ZKM7haagBLj7gdXrvoZXZT8qBsT`, 12 vendor refusal cases and four authorized navigation checks pass.
Checks cover desktop and 390px widths. Foreign, missing, and malformed IDs have identical refusal text within each route.
Summary titles are `Page not found — CMG Property Solutions`. Activity uses its static generic title, `Partner activity`.
The first expanded test incorrectly required the summary title on activity pages. Preserve its six assertion failures as harness evidence.
The earlier four empty-title failures at `5bcc62a` were application defects. The new summary title tests confirm their repair.

Foreign-ID client navigation was not tested because the interface supplies no such link. Direct route checks cover those refusals.
Four opaque Cloudflare console entries remain: two errors and two warnings. No CMG-origin entry was captured; the cause is unproved.
Full network traces remain unavailable. No new sign-in, form, upload, download, or email occurred in this follow-up.

Evidence is in session scratch: `t65-full-checks-2026-10-25`, `cmgps-undici-audit-2026-10-24`, and `t65-vendor-title-hosted-2026-10-26.json`.
Mode evidence: `launch-candidate-mode-checks-2026-10-26T04-00-24-349Z-08162a93.json`. CI summary: `candidate-ci-40267147255-summary.txt`.

The first combined audit found four new dependency issues: one critical, one high, and two moderate. The approved updates resolved them. The October 24 audit then found one high and two moderate advisories in development-only Undici 8.11.2 through jsdom 30.0.1. The approved lock-only update to 8.12.3 fixed that report; the current audit passes.
The approved installation used existing npm 12.0.2 with Node 22.22.2. Package setup scripts were disabled.
React, React DOM, Node requirements, and other direct package versions remain unchanged.

Next.js and its ESLint packages use 16.4.3. Zod uses 4.6.6, Vitest uses 4.1.12, and Vite uses 8.2.4. These approved versions passed the final checks.
PR #27 and the latest Undici repair left production package entries unchanged. Earlier approved runtime updates remain in the combined candidate.
No existing PR was closed or merged by this integration.

The final T63 source passes nine focused tests, 56 geometry cases, and eight client-route checks. The harness excludes the full shell, auth, and already-scrolled behavior.

Unit run 58689 was interrupted after a tool reset without a result; no process remained. Replacement run 31569 passed 1,752 tests with 57 skipped; 126 files passed and 14 skipped. This October 24 result is historical. The current final source passes 1,763 tests with 57 skipped.

The final-source production build and audit both pass with exit 0.
The earlier 1,750-test result is historical; the later pre-style run passed 1,752 tests.
Database-backed Vitest passes 254 tests across 37 files; one live PandaDoc test skips.
This local selection includes the real portal password-session check, which is outside the 253-test CI selection.

The earlier approved reset used only the exact disposable database.
All 39 local GET checks pass across simple, staff, and platform modes.
Local built-in browser checks pass at 1280px, 390px, and 320px for the tested controls, notices, and generic refusals.
No console error was observed in those checks. Full browser network traces remain unavailable.

Local server diagnostics recorded four `refresh_token_not_found` errors during browser checks. The pages still showed signed-out states.
Earlier local cookies after the disposable reset are a possible cause; this was not confirmed. Hosted sign-in acceptance later passed, as recorded in the dated role evidence.

All six PDF repair files exactly match tested `56cff18`; earlier rendering and provider-recognition evidence remains applicable.

An earlier candidate focused run passed 419 tests and failed one 5,000 ms tooling timeout.
The unchanged tooling file then passed all four tests. The final full suite also passes.
The first mode check failed because the harness did not accept loopback-to-localhost normalization.
Only the scratch harness changed. Thirteen simple-mode checks passed, followed by all 26 affected rerun checks.
No test assertion or timeout changed to hide a failure.

Earlier dependency-repair failures remain part of the evidence.
Records CI `39643163538` at `c032ee3` failed the Vite audit. Its database job and Preview passed; other verification steps skipped.
Two npm 10 update attempts failed with `edgesOut` before producing a patch.
The existing npm 11 CLI generated the Vite repair. A clean npm 10 install with setup scripts disabled then passed.

The first PR #27 full run stopped after 455.768 seconds without results.
A rerun passed 1,675 tests, failed one 5,000 ms tooling timeout, and skipped 56 tests.
The unchanged tooling file passed in isolation. The final PR #27 rerun passed 1,676 tests, with 56 skips, in 437.449 seconds.
Its previously timed-out case passed in 2,310 ms. The delay had no confirmed cause. No test rule or timeout changed.

PR #27 CI `39651682681` passed both jobs at exact `5c3886d`; its Preview was Ready.
That repair changed only eighteen development lock records. Its unchanged-production-dependencies statement does not describe the combined candidate.
The [Vite advisory](https://github.com/advisories/GHSA-587h-7wmj-h5pm) identifies 8.2.4 as patched for that release line.

Both jobs in exact-head CI run `40267147255` pass.
CI database checks pass 1,350 pgTAP assertions and 253 Vitest tests. One live PandaDoc test skips.

The earlier simple-mode Preview `dpl_2NCKXqNNGkywFFJm4hUp8Qzg9c25` was Ready at `cmgps-eqilllzi6-robs-projects-c72886ba.vercel.app`. Its checks are historical. The stable branch alias now resolves to Ready deployment `dpl_9ZKM7haagBLj7gdXrvoZXZT8qBsT` for verified application source `8ae5c70`.
Its [stable branch URL](https://cmgps-git-codex-launch-release-candidate-robs-projects-c72886ba.vercel.app) resolves to the candidate Preview.
Its initial effective mode is simple. All thirteen anonymous GET checks pass: three public 200 responses and ten private 307 redirects to `/platform-disabled`.
Two identical build warnings state that the Node 22 engine overrides the project Node 24 setting. Vercel reports the intended Node 22 version.

The three approved setup batches are complete. The four branch-only overrides, one Preview rebuild, and one Turnstile hostname addition are complete. All four role sign-ins and both MFA checks are verified.
The approved branch-only overrides are `SITE_MODE=platform`, the stable branch `NEXT_PUBLIC_SITE_URL`, and blank PandaDoc API and webhook keys. They apply only to the candidate branch.
The earlier `5bcc62a` Preview was Ready as `dpl_x11Nh3Ko6PfCndh9sEmYeK76SyLb` at immutable host `https://cmgps-66ig8cv25-robs-projects-c72886ba.vercel.app`. The current `8ae5c70` deployment details are listed in RELEASE_STATE.
On the earlier `5bcc62a` Preview, nine cookie-free GET checks passed with CSP, HSTS, and `nosniff`. Evidence: `launch-candidate-platform-readonly-5bcc62a.json` and `cmgps-pr28-preview-redeploy-ledger.md` in session scratch.
The approved hostname is saved and verified after reopening. The widget has nine hosts and retains prior hosts, Managed mode, no pre-clearance, and existing keys. Evidence: `pr28-turnstile-hostname-execution-2026-10-24.json` and `pr28-turnstile-saved-nine-hosts-2026-10-24.png`.

Owner sign-in/MFA passed 30 route and layout checks at 1280px and 390px. Homeowner sign-in passed 20 read-only checks at both widths. Claims 0003/0004 were readable; foreign 0005/0006 returned the same refusal. Four customer documents were visible. The owner-side 25 MiB fixture was absent from the customer view and present in the owner check. Evidence: `pr28-owner-readonly-acceptance-2026-10-24.json` and `pr28-customer-readonly-acceptance-2026-10-24.json`.

No form, download, upload, or email was used. Four account sign-ins and both MFA checks are independently verified. The owner IAB session recovered after a tool reset without another login. Debugger attachment was briefly unavailable after a tool update; this was not an app failure.

The recovery widget showed Success; evidence: `pr28-recovery-widget-success-2026-10-24.png`. No reset email was sent.

On the earlier `5bcc62a` Preview, Staff1 Tester ADJUSTER passed 26 read-only checks.

The earlier page reported as staff showed the owner header and did not consume a staff sign-in or MFA check. All four role sign-ins and both MFA checks are now verified. Vendor title/access checks pass on the current Preview; hosted T63 owner/staff focus checks remain open.
Owner Settings confirms Manual signing, bundled PDF, an unset webhook, Supabase project `vdtqxglhlgatpbgehsjk`, and zero pending or failed outbox entries. This closes only provider configuration. Real manual signing and legal approval remain open.
Initial keyboard review passed seven of nine checks. Hidden Claims and Settings focus stayed in the stable menu. T63 now focuses the nearest item and sets scroll-mx-1, which applies a 4px inline scroll margin. The resulting scroll distance varies. The component uses focus-visible outline-offset -2px and retains the full 2px ring. The horizontal-only first variant failed vertical geometry 9/9.

The corrected local T63 harness passes 56 owner and adjuster keyboard geometry cases at 390px and 1280px, in forward and reverse order. It also passes eight client-route checks with zero local console errors. The harness excludes the full shell, authentication, and already-scrolled behavior; sampled pageY values were zero. T63 is included in signed PR #28. Hosted owner and staff menu checks passed.
Historical evidence: `t63-menu-browser-acceptance-2026-10-24.json` and `t63-owner-phone-focus-fixed-2026-10-24.png`. The earlier local changes are now part of signed PR #28; they are not uncommitted.

The three public candidate pages rendered at 1280px and 390px without global horizontal overflow. Mobile menu navigation passed.
No CMG-origin console error was observed in these checks. Earlier Vercel-dashboard route-parameter errors came from the provider page.
Form verification previously displayed its generic refusal before the new hostname was approved. No form was entered or submitted during that earlier check.

Read-only inspection on October 24 confirms current Production `dpl_GoXHV8n8KfTVt5BDyZosJF3jvXPk` from `develop` at `1b7f7f98e54a358b3a95875483a63d3f882573a3`; both daily schedules are enabled.
Outbox uses `0 14 * * *`; Storage cleanup uses `17 14 * * *`, in UTC. Both windows passed before bounded runtime-log searches returned zero rows. Execution, HTTP success, and scheduler attribution remain unverified. No job was invoked. Evidence: `cmgps-cron-evidence-2026-10-24.md`.
The October 23 zero-row query is dated history. It does not show what happened during the October 24 windows.



Preview setup, rebuild, and hostname addition are complete. All four role sign-ins and both MFA checks are verified. Vendor title/access checks pass. Hosted T63 owner and staff menu checks passed. The earlier owner-header page did not consume a staff sign-in or MFA check.


Independent review found no Critical or Important candidate defect.
The security report now separates historical findings from current candidate evidence.
The prior PDF upload and contact approvals remain consumed; no repeat provider upload occurred.

Production remains on `develop` at `1b7f7f98e54a358b3a95875483a63d3f882573a3`.
No business-data write occurred in this acceptance. Approved sign-ins caused normal Auth session, audit, rate-limit, and refresh records. Production code and settings, DNS, backups, email, claims, profiles, consent, documents, and outbox rows stayed unchanged.
Hosted acceptance, operations, legal review, and real signing remain open. Shared merge and Production deployment require separate exact approvals.
The current release-record evidence is not yet published in remote PR #26.

### Current homeowner profile acceptance

The October 21 batch used PR #24 at `d523469` and existing test homeowner `rob@miodiollc.com`.
The saved CMG connection resolves to project `vdtqxglhlgatpbgehsjk` in organization `hzvstnfnlwohkessbnxg`. The project ID was verified before read-only SQL. No Supabase CLI setup was assumed.

Exactly four submissions ran once each. Empty first name returned `First name is required.` Phone `123` returned `Enter a phone number we can reach you on, or leave it empty.`
Each refusal showed the one-field feedback banner. After both refusals, SQL confirms the original values and `updated_at=2026-09-27 21:46:31.535635+00` remained unchanged.

One save changed `first_name` from `CMG` to `CMG Synthetic Profile Test`. The next save restored `CMG`.
Both returned `Saved.` and persisted after reload. The original last name `Upload Acceptance Test` and null phone are restored.

The temporary and final snapshots show role `customer`, null company, and active status unchanged.
The successful saves advanced `updated_at` to `2026-10-21 17:14:09.852622+00`, then `2026-10-21 17:14:56.558493+00`. The timestamp remains new.

The final outbox count since `2026-10-21T16:26:22.741Z` is zero. Captured console warnings and errors are empty.
Normal sign-in audit and rate records are within approval. No email, upload, password, consent, claim, permission, Production-code, setting, DNS, or backup change was submitted.

The exact batch is complete. Do not repeat it. Other hosted tests still need their exact approvals.

Evidence: `pr24-profile-test-2026-10-21.json`, `pr24-profile-empty-name-refused-2026-10-21.png`, `pr24-profile-invalid-phone-refused-2026-10-21.png`, `pr24-profile-temporary-name-saved-2026-10-21.png`, and `pr24-profile-original-name-reloaded-2026-10-21.png`.
The browser showed Saving states, both refusals, and both success states. There is no complete raw network trace or independent per-update database log.

### Current private-file expiry and cleanup evidence

On October 20, one owner Download click issued a 300-second link for the existing 68-byte `synthetic-upload.png` on synthetic claim `CMG-2026-0003`. Audit row 195 records one issuance. The same in-memory link was replayed once, 379.358 seconds after issuance. Storage returned rendered JSON status 400, `InvalidJWT`, with an expired `exp` claim. No file bytes rendered.

The audit still has one issuance row, and no new outbox rows were found. The raw link was not retained and no second link was issued.

The first browser event did not report a save path. The owner confirmed the saved file in Chrome. The file is 68 bytes, and its MD5 matches the recorded Storage ETag. No additional download or link was issued.

The local SHA-256 is `01dd7f08f84eca35384fd4e7d49f70e2cc33c2dd99a45b199bdd2297be5b0462`. Local MD5 and recorded Storage ETag are `f0c94e82190ea356f04404f0b8a51882`. The recorded object size is 68 bytes. The saved file contains a 1x1 PNG. Its IDAT checksum is `efa33f5b`; the calculated checksum is `efa2a75b`.

The PNG has an invalid IDAT chunk checksum. Its chunk boundaries and decompressed pixel bytes are present. This is a failed fixture image-validity check. The size and recorded-fingerprint comparison does not establish remote SHA-256 equality or image-decoder validity. Do not replace the hosted fixture under this approval.

No raw network status trace is available. Do not click Download again or reissue this link. Evidence: `pr24-expiry-initial-file-check-2026-10-20.json`, `pr24-expiry-test-2026-10-20.json`, and `pr24-expired-link-refused-2026-10-20.png`.

The read-only check found zero matching staging objects, unaccepted copies, and document rows for invalid-file session `c68baab2-61f4-4864-bd22-8049f9ecaf94`. Cleanup queue rows 12 and 13 completed at `2026-10-20T14:27:40.125Z` and `.473Z`, each after one attempt with null error and dead timestamps. The table has thirteen rows. This proves cleanup state, not scheduler attribution. No worker or manual cleanup ran during the read. Evidence: `pr24-invalid-cleanup-read-2026-10-20.json`, `pr24-cleanup-rows-12-13-paths-2026-10-20.png`, and `pr24-cleanup-rows-12-13-times-2026-10-20.png`.

### Earlier baseline verification limits and results

These baseline checks used the earlier clean v2 tree and installed lock-matching dependencies.
The combined candidate results above supersede this baseline for the current candidate.
Node 22.22.2 and its npm CLI are invoked by absolute path for the final type, lint, unit, and build checks.
Both Supabase variables are explicit dummy values targeting loopback port 1, so database suites cannot load real credentials from `.env.local`.
Resend, PandaDoc, webhook, and live-test opt-ins remain disabled.

| Check | Result |
|---|---|
| Type check and lint | Passed through explicit Node 22 |
| Build | Passed through explicit Node 22; default Turbopack, no configuration change |
| Dependency audit | Zero vulnerabilities |
| Focused password, invite, partner query, and admin error tests | Four files, 19 tests passed |
| Full pure unit rerun | 120 files and 1,676 tests passed; 13 files and 56 tests skipped; exit 0; 476.79 seconds |
| Local mode checks | All 18 unauthenticated HTTP checks passed across simple, staff, and platform |
| Baseline database and live-provider checks | Not run in this baseline. The later approved disposable security checks are recorded below. |

The mode-check servers bound only to `127.0.0.1:3040` and used dummy database credentials.
The harness stopped only its own child processes. No existing server was stopped.
The initial sandbox test run failed all 133 suites during transformation, before tests, with temporary-file rename `EPERM` errors.
The focused run passed after the required tool access was provided; the full rerun is tracked separately.
The first build failed to fetch Google Fonts. A later launcher run reported a compiler child-process panic.
The unchanged build then passed through the exact Node 22 executable. The panic cause was not independently isolated.

Existing PR #22 Preview `dpl_37xcCfwAAk4SyCFyHDpVVLtcwmzi` is Ready at `cmgps-git-bugfix-launch-integration-v2-robs-projects-c72886ba.vercel.app`.
Six public routes return 200. All six private prefixes return 307 to `/platform-disabled`.
Every checked response carries CSP and HSTS. These are HTTP checks, not rendered-browser acceptance.
The first built-in browser request queued, and native Chrome approval timed out.
The browser tool later became available. The PR #23 results below supersede that access limitation.

### Current security PR review

PR #23 is open at `15ea5f6a5d21a9b66bef84e8f61d24d3a1a5e26c`, based on current `develop`.
GitHub run `39044579758` passed both jobs. The original Ready Preview was `dpl_BEG9j1PgK3hrbExsjxw5mYSpqgs6`.
Its stable host is `cmgps-git-cursor-security-scan-20-059089-robs-projects-c72886ba.vercel.app`.
A bounded Luna review found no confirmed blocking defect in the redirect, filename, recovery, and action-cap changes.
An isolated comparison transpiled the actual redirect functions in memory, without network or database access.
Current `develop` accepted three control-character paths that resolve off-origin.
PR #23 refused all six unsafe inputs and preserved all three ordinary inputs.
The recovery route tests mock the limiter; they do not independently prove exact ten-per-fifteen-minute database accounting.
Active upload forms send metadata through actions and bytes directly to Storage, so the 2 MB action cap does not lower the 25 MiB upload limit.
No source, commit, push, PR change, merge, credential rotation, or database write was performed.

PR #22's `unstable_retry` review suggestion is contradicted by installed Next.js 16.3.8 documentation, types, and `error-boundary.js` lines 110–114.
The installed boundary supplies `retry`, and its type defines it. The application already uses that callback.
No code change is needed for that suggestion.

### Approved PR #23 Preview setup

The owner approved only branch `cursor/security-scan-2026-10-17-4764` on 2026-10-17.
Four new Preview-only overrides were created: `SITE_MODE=platform`, the stable Preview `NEXT_PUBLIC_SITE_URL`, and empty `PANDADOC_API_KEY` and `PANDADOC_WEBHOOK_SHARED_KEY`.
Individual scoped reads verified all four exact values and their single Preview target. No shared or Production variable was edited.
The final metadata read found twenty pre-existing environment records; none had an update timestamp during this setup. The four new branch records were separate.
Two API requests returned `Invalid JSON (400)` before the CLI environment commands succeeded; reads after each rejection confirmed zero branch overrides.
Turnstile widget `CMG Property Solutions` now has seven hostnames, including the exact PR #23 stable hostname.
All six prior hostnames, Managed mode, and no pre-clearance were retained. No key was revealed or rotated.
One approved redeploy completed as `dpl_9ZNj3TUEkd4ci63mjn19gWj2feqJ` at `15ea5f6a5d21a9b66bef84e8f61d24d3a1a5e26c`.
Its unique host is `cmgps-k7ul75d60-robs-projects-c72886ba.vercel.app`; its alias is the stable PR #23 host above.
Production still resolves to unchanged Ready `dpl_3UAUKnaYdUPv78pAAQUXZa4CJYaF`.
No DNS, database data, email, submission, upload, or audit-creating download changed.

| Read-only Preview check | Result |
|---|---|
| `/login`, `/forgot-password` | HTTP 200 with CSP and HSTS |
| `/mfa`, `/admin`, `/portal`, `/partner` | HTTP 307 to login with the matching `next`; CSP and HSTS present |
| Login password visibility | Empty field changes password to text and back; no credentials entered |
| Recovery at 1280px and 390px | Heading and controls render; no horizontal overflow; nonempty Turnstile response at both widths; no submission |
| Six public routes at both widths | `/`, `/services`, `/contractors`, `/about`, `/contact`, and `/file-a-claim` each have one main heading, no horizontal overflow, and zero broken completed images; twelve checks passed |
| Contact and intake widgets | Contact completed at both widths. Intake completed at desktop and mobile width. No form was submitted. |
| Intake controls | All four contractor fields are optional; Yes reveals four second-person fields, and No removes them. The file control is enabled after hydration and allows multiple selection. The hint states ten files and 25 MiB each. No file was selected or uploaded. |
| Empty forms | Contact has two invalid required controls; intake has twenty-three. These are validity-state reads, not submitted error-path tests. |
| Mobile controls | Contact menu opens and focuses Home; Escape closes it and restores focus to Open menu. The first FAQ opens and displays its answer. |
| Browser console | Login captured no warnings or errors. Recovery captured opaque `NaN` entries from `challenges.cloudflare.com`; no application-origin error was captured. This does not prove a clean third-party console. |
| Private acceptance and full request traces | Still open; owner sign-in required. No data-changing test is approved. |

Proof images are in the session visualization folder: `pr23-turnstile-seven-hosts-2026-10-17.jpg`, `pr23-login-desktop-2026-10-17.jpg`, and `pr23-recovery-mobile-2026-10-17.jpg`.
Additional form images are `pr23-intake-mobile-2026-10-17.jpg`, `pr23-contact-mobile-2026-10-17.jpg`, and `pr23-contact-desktop-2026-10-17.jpg`.
All temporary viewport overrides were cleared. Browser tabs remain open. The owner sign-in tab uses `/login?next=%2Fadmin`.
The owner was asked to enter credentials and complete MFA only on that page. No password, code, or session token was read.
At this earlier checkpoint, T20 still required separately approved validation, rate-limit, persistence, referral, and email tests.
The later PR #24 referral result is recorded under [Current vendor acceptance](#current-vendor-acceptance); public intake acceptance remains open.
The authenticated Settings panel now confirms Manual, bundled PDF, and webhook key not set.
Rollback would remove only the four new branch overrides and the added hostname, then rebuild Preview. That external change needs separate approval.

### PR #23 owner acceptance and remaining security work

The owner confirmed sign-in and MFA on the PR #23 Preview. The page identifies the account as Owner.
The agent did not enter credentials, read session tokens, change roles, or sign out that session.

| Check | Current result |
|---|---|
| Partner directory | Two active companies load. `CMG Synthetic Vendor Test` has one rep and zero claims; `CMG Test Vendor` has one rep and one claim. Both company detail pages agree. The zero uses the intended dash. |
| Partner filters | Active shows both companies. Inactive shows the generic empty state. `?page=99` clamps to the available page and still shows both companies. |
| Partner layouts | Directory and both company details pass at measured 1280px and 390px; six checks, no global horizontal overflow. Large table windows beyond the existing two companies remain covered by local tests, not hosted fixtures. |
| Owner route layouts | Dashboard, intake, leads, questions, claims, staff, audit, and settings each pass at 1280px and 390px; sixteen checks, one main heading, no global overflow, no retained Loading state. |
| Synthetic claim layouts | `CMG-2026-0003` overview, claimants, documents, activity, financials, and history pass at both widths; twelve checks, matching claim heading, no global overflow. No file is selected. |
| Claim filters | A synthetic no-match search shows the empty state at 390px. Clear restores rows. Under review returns the three matching claims. These actions only change URL filters. |
| Generic missing claims | Malformed and valid missing IDs produce identical main text and `Page not found · CMG claims desk` titles at 390px, without global overflow. |
| Owner cross-role routes | `/portal` and `/partner` both return the owner to `/admin`; no customer or vendor page is exposed to this role. |
| Provider display | Settings shows Manual, bundled PDF, and webhook key not set. Synthetic claim `CMG-2026-0005` shows manual download and send-record controls. Neither was used because downloads create audit rows. |
| Pending mail | Settings reports zero notifications. Source confirms this counts both `pending` and `failed`, excluding `dead`. This is not a delivery or inbox check. |
| Console | No application-origin warning or error was captured in the owner checks. Earlier Cloudflare-frame entries remain recorded. Full browser request traces remain unavailable. |

The default Codex viewport was 688px. The browser viewport override applied to the responsive test tab only.
All recorded 1280px and 390px checks above measured `innerWidth` in that tab. Temporary overrides were cleared.
Proof files include `pr23-partners-desktop-2026-10-17.jpg`, `pr23-partners-mobile-2026-10-17.jpg`, `pr23-manual-provider-desktop-2026-10-17.jpg`, and `pr23-owner-documents-mobile-2026-10-17.jpg` in the session visualization folder.

The existing staff account `4miodio+cmgstaff@gmail.com` has an authenticator and is assigned synthetic claim `CMG-2026-0005`.
It is not assigned `CMG-2026-0003`, which supplies a separate negative case without reassigning data.
The owner completed sign-in and MFA in that Chrome tab. The page identifies Staff1 Tester as ADJUSTER.
Assigned claim `CMG-2026-0005` opens. The claim list shows only that reference.
Unassigned `CMG-2026-0003`, a missing valid ID, and owner-only `/admin/staff`, `/admin/settings`, `/admin/audit`, and `/admin/partners` return identical generic main text and titles.
Dashboard, claims, intake, leads, questions, documents, activity, and financials passed sixteen layout checks at measured 1280px and 390px without global overflow.
Claimants also rendered at both widths; history rendered at 390px. The unassigned claim refusal has no global overflow at 390px.
Chrome detached during later checks, then screenshot capture timed out. Checks resumed in a working Chrome tab with the same staff session.
Overview, claimants, and history now pass at both widths, bringing the positive staff-route layout total to twenty-two.
At 390px, all four owner-only routes and the valid missing claim have exactly the same main text as the unassigned claim, without global overflow.
No application-origin warning or error was captured in the resumed staff checks. Full request traces remain unavailable.
Hosted screenshot capture still timed out; do not claim a saved staff screenshot. Temporary viewport overrides were cleared.
Direct action checks, remaining staff keyboard states, and vendor checks remain open. Current homeowner results follow below.

Read-only GitHub feedback inspection found one inline finding on #19, one on #22, and none on #23.
The [#19 hydration finding](https://github.com/rspeciale0519/cmg/pull/19#discussion_r4148525886) is fixed in #22: both forms use POST and disable controls before hydration; a regression test covers both states.
The [#22 retry suggestion](https://github.com/rspeciale0519/cmg/pull/22#discussion_r4213680955) conflicts with installed Next.js 16.3.8 documentation and types, as recorded above.
Current #23 is draft and has no submitted GitHub reviews. CodeRabbit skipped draft review. The earlier independent source review remains separate evidence.
No GitHub comment, review, draft-status change, or PR closure was submitted.

The exact #23 scan also leaves M4 and L2 open. Exact-head source reads confirmed:

- `uploadClaimDocument` and `uploadPortalDocument` still validate MIME metadata without a file-content signature check.
- Active UI forms use prepare/finalize, whose file-content checks remain in place. Legacy endpoint reachability was not tested against hosted data.
- `changePassword` returns “Password changed. Your other devices stay signed in.” Global sign-out is absent there.

The owner approved local branch `codex/security-upload-session-checks` and both fixes, including global sign-out after homeowner password changes.
The branch was created at verified current `develop`, `1b7f7f98e54a358b3a95875483a63d3f882573a3`, in the clean existing v2 checkout.
Its path is `.claude/worktrees/agent-a0f434380c0947e2d`. The dirty main checkout remains unchanged outside the release records.
Both legacy actions now check all signatures before any cleanup, Storage, or document write. Their interfaces remain unchanged.
The new regression tests showed six expected failures before implementation. Three focused files then passed 102 tests.
The rollback test's fake zero-byte JPEG fixture was corrected to valid header bytes; rollback assertions were unchanged.
Password regressions first showed three expected failures. The initial portal/reset rerun passed 57 tests.
Independent review found that a thrown audit request could skip sign-out. A new regression reproduced it.
Global sign-out now precedes the best-effort audit, which cannot prevent sign-out or redirect. The reviewer found no remaining concrete defect.
Returned and thrown sign-out failures report a changed password without claiming successful revocation or returning secrets.
The new login notice states that other devices must sign in when existing access expires, as documented by [Supabase](https://supabase.com/docs/guides/auth/signout).
Final type check, lint, and the optimized build passed through Node 22.22.2.
Full `npm test` passed: 121 files and 1,688 tests. Thirteen files and 56 database/live-service tests skipped. Exit status zero; duration 850.37 seconds.
The final suite includes the repaired audit-outage regression. No later application source change followed this run.
Nine HTTP checks passed across `simple`, `staff`, and `platform`, covering the changed login notice, `/portal/profile`, and `/admin`.
The notice renders at measured 1280px and 390px without global overflow. An immediate resize measurement was transient; settled width and screenshot confirmed 390px.
No application-origin warning or error was captured on the local notice. No password was entered or submitted.
Proof: `local-password-notice-desktop-2026-10-17.jpg` and `local-password-notice-mobile-2026-10-17.jpg` in the session visualization folder.
Active forms remain on metadata prepare/finalize and direct Storage uploads. PR #23's separate 2 MB action cap would still limit older multipart callers.
This local branch is based on develop, whose body limit remains 256 MB. The separate PR #23 changes are not included here.
Signature checks do not scan for malware or change existing stored files. No schema or policy migration is needed for these source fixes.
Recovery before release is to retain the current deployed code. A later code rollback cannot restore revoked refresh tokens or a former password.
After a sign-out failure, the person must use the changed password; the displayed warning does not promise revoked sessions.
The owner approved rebuilding the disposable configuration and one reset/test cycle for `CMGPA_private_upload_disposable` on ports 15520–15529.
The prepared workdir is `C:/Users/rob/AppData/Local/Temp/cmg-private-upload-6934583c11c14e98a1a35698847eab3b/preflight-project`.
Independent preflight verified the exact project ID, API 15521, database 15522, and only approved ID/port config differences.
All 36 migration files, 44 pgTAP files, and the seed match source hashes. Their combined SQL manifest is `047ca240674faafdd22267b3d8c3a4c20f69065e151f6c352c3d8e3e37e473b8`.
The first reset preflight parser refused comments between section headers and ports before invoking the CLI. No reset occurred on that attempt.
The corrected parser verified both ports. The one approved reset then applied all 36 migrations and seeded synthetic data, exiting zero.
`supabase test db --local --workdir <prepared-workdir>` passed all 44 files and 1,350 assertions, exit zero.
The database-backed CI Vitest selection passed 34 files and 243 tests; one explicit live PandaDoc test skipped. Exit zero; duration 78.47 seconds.
The new opt-in `portal-password-session.integration.test.ts` passed against this exact disposable stack, including the final caller-session assertion.
It calls the real password action with real Auth, rate-limit RPC, audit, update, and global sign-out. Only framework context and the external password-breach check are mocked.
The caller session becomes null, the other refresh token fails, the old password fails, and the new password signs in. Exactly one audit row is observed.
Cleanup deletes only this synthetic account and its matching audit/rate-limit rows. A count-only local query reports `0|0|0` after the final run.
The test skips before environment-file loading unless the exact stack, loopback API, and key names are present.
The no-database guard run passed 58 portal/reset tests and skipped this one integration test. The full 1,688-test unit run predates only the new isolated integration file; application code did not change afterward.
Type check and focused lint were repeated for the new test. The earlier full lint and build remain valid for unchanged application code.
No second reset is approved or needed. Retained and disposable databases remain separately bound to 15422 and 15522.
CLI startup printed disposable local keys automatically; later CLI output is filtered. No hosted credential was read or printed.
Retained `CMGPA` remains separately identified on port 15422. No hosted database or retained local data was reset.
The loopback review server on `127.0.0.1:3040` was stopped before rebuilding the changed candidate.
It used disabled hosted, email, and PandaDoc credentials. No other server was stopped.
The owner separately approved the eight-file local commit with message `fix: validate legacy uploads and revoke password sessions`.
Commit `abc44990eebf3a309ac4bf3eeefc859c601a2604` contains the login notice, three action files, portal regressions, signature tests, rollback fixture, and session integration test.
The staged file list matched the exact eight approved paths. The staged and committed diff checks passed at `abc4499`.
Main-checkout edits and release records are excluded. The owner then separately approved the exact push and draft PR creation.
The initial approved push put `origin/codex/security-upload-session-checks` at `abc44990eebf3a309ac4bf3eeefc859c601a2604`.
Draft [PR #24](https://github.com/rspeciale0519/cmg/pull/24) targets `develop` and initially contained those eight files.
CI run `39070764804` passed both required jobs at `abc4499`. No check was bypassed or restarted.
Verify passed type check, lint, build, and the dependency audit with zero vulnerabilities.
Its unit run passed 121 files and 1,688 tests; 14 files and 57 database/live tests skipped. Duration: 74.54 seconds.
Database CI passed 44 pgTAP files and 1,350 assertions. Its selected Vitest run passed 34 files and 243 tests.
One live PandaDoc file/test skipped in that selection. Duration: 35.49 seconds.
The branch-only push did not trigger CI because push filters cover only `develop` and `main`. Draft PR creation started the required jobs.
The automatic Preview is Ready as `dpl_3hYgFtpsYNxV6FhxoCy6jCQmfcu5` at the exact approved commit.
Its stable host is `cmgps-git-codex-security-upload-s-a76c10-robs-projects-c72886ba.vercel.app`.
Its unique host is `cmgps-ej9c70a55-robs-projects-c72886ba.vercel.app`.
Vercel CLI and the signed-in deployment page confirm Ready, Preview, branch, and commit.
The connector returned team-scope 403. The CLI fallback used the same team and target; no authentication or permission change occurred.
The root returns 200. Login with the changed notice and `/portal` each return 307 to `/platform-disabled`.
All three responses include CSP and HSTS. No Preview override, Turnstile hostname, or Production setting changed.
Proof: `security-pr24-preview-ready-2026-10-17.jpg` in the session visualization folder.

The first SSH push stopped because the port-443 host was unknown. It did not modify a remote branch.
The successful push used GitHub's published Ed25519 key in a temporary scratch known-hosts file, with strict checks retained.
The key fingerprint matched `SHA256:+DiY3wvvV6TuJJhbpZisF/zLDA0zPMSvHdkr4UvCOqU` from [GitHub's official list](https://docs.github.com/en/authentication/keeping-your-account-and-data-secure/githubs-ssh-key-fingerprints).
The transport used [GitHub's documented SSH port 443](https://docs.github.com/en/authentication/troubleshooting-ssh/using-ssh-over-the-https-port).
No personal SSH configuration, credential, host-trust store, or Git remote changed. The crashing HTTPS helper was not used.

Read-only `git merge-tree --trivial-merge` inspection found no conflict markers between exact #23 `15ea5f6` and #24 `abc4499`.
No branch, working file, commit, or remote state changed during that inspection. It does not prove combined tests.
The owner then approved local integration of exact `15ea5f6` without creating a commit.
`git merge --no-commit --no-ff` completed without conflicts. Before commit, HEAD was `abc4499` and MERGE_HEAD was exact `15ea5f6`.
The merge initially staged nine incoming files. The final approved index contained thirteen reviewed files, including both follow-up repairs.
The later separately approved merge commit and push are recorded below. Main-checkout records remain excluded.
Independent combined review found old stored names passed unchanged to both private download signers and returned filenames.
The installed SDK URL-encodes its download parameter. No header exploit was proved.
Four new regression cases failed before repair, with six existing tests passing.
Both actions now reuse `safeOriginalName` after user-scoped row and path checks. They preserve original audit metadata.
The repair changes only `documents.ts`, `portal-documents.ts`, and `signed-download-audit.test.ts`.
Final focused verification passed four files and 55 tests. Type check, full lint, and independent repair review passed.
The earlier 107-test combined run and build passed before this repair. The earlier full unit run was cancelled for the repair.
The combined full unit run passed 122 files and 1,710 tests; 14 files and 57 database/live tests skipped.
Exit zero; duration 526.46 seconds. It used the repository's single-worker Windows setting, without changing test limits.
The first final database selection passed 243 tests but failed one fixture setup request; one live PandaDoc test skipped.
The failure was `seed claimants failed: TypeError: fetch failed`, before the event-conflict assertion.
It left one incomplete synthetic claim because setup failed before the suite registered its ID.
The existing cleanup helper removed exact fixture `97a4f45a-4c92-40e2-9049-f533ac54dc67`, after checking its ID, reference, and description.
The target guard checked the disposable Docker label, database port 15522, and API URL 15521. No other data was removed.
The complete database selection rerun passed 35 files and 244 tests; one opt-in live PandaDoc file/test skipped.
Exit zero; duration 123.12 seconds. This includes the real-action password-session test.
Post-run counts returned zero for synthetic claims, password users, password-change audits, and password-rate rows.
All disposable migration, database-test, and seed file hashes still match source. No second database reset occurred.
Default Turbopack builds stopped while starting the unchanged CSS loader child process, with exit zero and no child output.
This occurred with restricted access and with explicit Node 22 plus broader tool access. Root cause remains unproved.
A Webpack diagnostic build passed. Checked removal of only this worktree's generated `.next` directory preceded a passing default build.
The precise cache fault remains unproved. No dependency, compiler option, or source CSS changed.
The local HTTP run then found recovery's response used `strict-origin-when-cross-origin`, despite the handler requesting `no-referrer`.
The global `next.config.ts` header rule caused this mismatch. The installed Next header guide confirms the last matching configured rule wins.
The new `headers.test.ts` uses Next's installed `unstable_getResponseFromNextConfig`, with the real configuration matcher.
Before repair, two recovery cases failed and five ordinary-route cases passed.
The final specific `/auth/confirm` rule preserves `no-referrer`, without changing ordinary-page policies or other security headers.
Header, recovery-route, and CSP verification then passed three files and 45 tests. Independent review found no defect.
The 1,710-test run predates only this header rule and its seven new tests. No other unit test imports `next.config.ts`.
The unchanged action tests remain valid. Final type check, full lint, and the default Turbopack build passed after the header repair.
All eighteen final HTTP checks passed across simple, staff, and platform modes, with CSP and HSTS.
Invalid recovery in staff/platform returns the same-origin 303 expired-link path with `no-store` and `no-referrer`.
The harness uses `localhost` consistently. Installed NextURL normalizes loopback hostnames to `localhost`; the earlier origin assertion used `127.0.0.1`.
The first HTTP run therefore had both an actual header defect and an incorrect local-origin expectation. Neither is hidden as a passing run.
Temporary simple/staff servers stopped through their exact child handles. The dummy-provider platform review server remains on loopback port 3040.
The built notice passed 1280px and 390px without overflow. Native checkbox input shows and hides the empty password field.
Captured browser warnings/errors are empty. Initial browser navigation timed out, and the dummy-provider server logged refused Auth requests.
Stale local cookies are a possible cause. That cause was not independently proved.
No cookie, credential, or session store was cleared. No password or form was submitted.
Proof: `combined-password-notice-mobile-2026-10-17.jpg` in the session visualization folder.
The filename and privacy-header repairs preserve schema and stored data. Recovery uses a reviewed code correction, not a database restore.
No remote merge, Production deployment, hosted data write, real password change, or live session revocation is approved.

The owner separately approved the exact thirteen-file local merge commit and then its push.
Commit `e142f5f875650f8d9ffa06c6d7fdc6fea9934161` is `fix: combine security hardening and recovery privacy`.
Its parents are exact `abc44990eebf3a309ac4bf3eeefc859c601a2604` and `15ea5f6a5d21a9b66bef84e8f61d24d3a1a5e26c`.
The committed diff over its first parent has thirteen files, 399 insertions, and 25 deletions. Diff checks pass; the worktree is clean.
The guarded SSH push used the same pinned GitHub host and strict checks. No HTTPS helper or personal SSH configuration was used.
Remote hash verification and GitHub PR inspection confirm exact `e142f5f`. PR #24 remains draft against `develop`, with nineteen changed files.
CI run [39075681448](https://github.com/rspeciale0519/cmg/actions/runs/39075681448) passed both jobs for that exact commit, without restart or bypass.
Verify passed in 2m48s, including type check, lint, build, and a zero-vulnerability dependency audit.
Its unit run passed 123 files and 1,717 tests; 14 files and 57 database/live tests skipped. Duration: 90.70 seconds.
The database job passed in 3m38s. It passed 44 pgTAP files and 1,350 assertions.
Its selected Vitest run passed 34 files and 243 tests; one opt-in live PandaDoc file/test skipped. Duration: 35.65 seconds.
CI does not select the real password-session test. Its earlier approved disposable result remains one passing test, with exact cleanup verified.
GitHub annotations warn about Node 20 action runtimes being forced to Node 24 and an upcoming Ubuntu runner-label change.
These are maintenance warnings, not failed checks. No workflow or runtime setting changed.
The automatic Preview is Ready as `dpl_rR3wMH8skJdjiaXcNe6btRM642Ka`, in 38 seconds.
Its unique URL is `https://cmgps-87anq7c0s-robs-projects-c72886ba.vercel.app`.
Its stable alias remains `https://cmgps-git-codex-security-upload-s-a76c10-robs-projects-c72886ba.vercel.app`.
The Vercel page shows Ready, Preview, the approved branch, and exact `e142f5f`.
Build logs show Next.js 16.3.8, Turbopack, successful compilation and TypeScript, and completed deployment.
The runtime warning says package Node 22 overrides project Node 24. The build uses the required Node 22; no setting was changed.
Seven unauthenticated HTTP checks pass. Root returns 200; login notice, recovery, admin, portal, partner, and `/auth/confirm` return 307 to `/platform-disabled`.
All seven responses include CSP and HSTS. The token-free confirm request also returns `Referrer-Policy: no-referrer`.
No Auth verification was requested. The enabled hosted recovery flow remains untested on this branch.
The root renders at measured 1280px with no overflow or broken completed images.
Captured browser warnings/errors are empty. Browser navigation confirms the login closure.
Proof: `security-pr24-merge-preview-ready-2026-10-17.png` in the session visualization folder.
No new Preview override, Turnstile hostname, Production setting, DNS record, hosted data, or message changed.

### Approved combined Preview setup

The owner later approved four overrides for `codex/security-upload-session-checks`, one missing hostname, and one Preview redeploy.
The source remains exact `e142f5f875650f8d9ffa06c6d7fdc6fea9934161`; no source, commit, push, or PR body changed during setup.
The unlinked worktree inspection returned `link_required`. No link was created.
Explicit inspection of `cmgps` confirmed project `prj_kn2TbLFlGanRks9ZHRnmJFQ3ThMz` in `robs-projects-c72886ba`.
Supported first-class CLI commands created the four branch-scoped Config overrides.

| Key | Exact approved branch value |
|---|---|
| `SITE_MODE` | `platform` |
| `NEXT_PUBLIC_SITE_URL` | `https://cmgps-git-codex-security-upload-s-a76c10-robs-projects-c72886ba.vercel.app` |
| `PANDADOC_API_KEY` | Empty |
| `PANDADOC_WEBHOOK_SHARED_KEY` | Empty |

Each new record has only target `preview` and the exact approved Git branch.
The API's individual-record reads verified only these four new non-secret values; existing credentials were not decrypted.
Before and after deployment, all 24 pre-existing environment records match their metadata hashes. Exactly four new records were added.
The existing Cloudflare CMG widget retains Managed mode, no pre-clearance, its site key, and all seven prior hostnames.
Only `cmgps-git-codex-security-upload-s-a76c10-robs-projects-c72886ba.vercel.app` was added; the saved widget now has eight hosts.
The first native input/Enter action saved the unchanged seven-host widget. Explicit custom-host selection then added the intended host.
The saved edit page was reopened; all eight names and preservation of the original seven were verified.
No key was shown, rotated, or changed. No DNS setting was opened or edited.

Exactly one `vercel redeploy` targeted the original Preview `dpl_rR3wMH8skJdjiaXcNe6btRM642Ka`, with explicit target `preview`.
The source project, branch, and exact commit were verified before the action. No local-source deployment or Production promotion occurred.
The new deployment is Ready as `dpl_8ykWz4ujjgeq1s3ojzBP1ADjSQJY`, in 51 seconds.
Its unique URL is `https://cmgps-4ldox31ib-robs-projects-c72886ba.vercel.app`.
The stable branch alias is unchanged. The API and signed-in page confirm the new deployment's exact source and Preview target.
Build logs show Next.js 16.3.8, successful Turbopack compilation, successful TypeScript, and completed deployment.
Production resolves to the same Ready `dpl_3UAUKnaYdUPv78pAAQUXZa4CJYaF` before and after this action.

Eight unauthenticated HTTP checks pass on the stable branch host.
Root, login, the password-changed notice, and recovery return 200 with CSP and HSTS.
Admin, homeowner, and vendor entry routes return 307 to same-origin login with the expected next path.
Token-free `/auth/confirm` returns the same-origin 303 expired-link notice, `Cache-Control: no-store`, and `Referrer-Policy: no-referrer`.
Source inspection confirms this malformed request returns before any rate-limit or Auth call. No valid token was sent or consumed.
Recovery and the changed login notice render without overflow at measured 1280px and 390px.
The recovery widget completes automatically at both widths. The initial check after resize was not ready; the settled mobile check passed.
The empty password control changes `password` to `text` and back, without a value or submission.
Captured application-origin warning/error logs are empty. Eight opaque NaN warning/error entries come from Cloudflare frames.
Full browser request traces remain unavailable; automatic client verification does not prove reset-email delivery.
Viewport overrides were reset. The new Preview owner login page is open; no password, MFA code, or form value was entered.
Proofs: `pr24-turnstile-host-preserved-2026-10-17.png`, `pr24-platform-preview-ready-2026-10-17.png`, `pr24-platform-recovery-mobile-2026-10-17.png`, and `pr24-platform-login-notice-mobile-2026-10-17.png`.
All proofs are in the session visualization folder. Release records remain local and uncommitted.
No Production, shared environment record, DNS record, database data, email, upload, or audit-creating download changed.
The risk is that enabled Preview pages connect to the shared hosted database. No data-changing test is included in setup approval.
Recovery is a reviewed reversal of these four branch overrides and the one added hostname; any further hosted change remains separately controlled.

### Combined Preview owner acceptance and final source review

The owner completed sign-in and MFA on the new combined Preview. Its dashboard identifies Rob Speciale as Owner.
The source remains deployed `e142f5f`; a fresh GitHub read confirms unchanged `develop` at `1b7f7f98e54a358b3a95875483a63d3f882573a3`.
PR #24 remains draft at that exact head, with successful checks and no submitted GitHub review or line comments.
CodeRabbit explicitly skipped review because the PR is draft. Its green check does not prove a review occurred.

| Owner check | Result |
|---|---|
| Settings | Supabase answers through the caller-scoped probe. Resend is configured; zero notifications wait. This is not inbox or scheduled-run proof. |
| Manual signing | Manual provider, bundled PDF, unset webhook key, and standard fee 20 percent. No provider secret was read. |
| Recheck | Source confirms owner authorization, read-only probes, and cache invalidation. Enter showed disabled Checking, then a fresh successful probe. No data-changing action ran. |
| Settings layouts | Measured 1280px and 390px; no horizontal overflow or alert. |
| Synthetic claim documents | `CMG-2026-0003` shows three visible 68-byte PNG rows and one internal 2.2 MB signed LOR. Four download buttons appear. No signed Storage URL is rendered before issue. |
| Upload controls | File input is present and enabled after hydration. Kind and visibility selections work and return to Other / CMG only without submission. Both widths fit. |
| Owner cross-role routes | `/portal` and `/partner` settle at `/admin` with the dashboard heading. |
| Current console | Zero captured warning/error entries during these owner checks. Earlier opaque Cloudflare entries remain part of recovery evidence. Full request traces remain unavailable. |

No file was selected, uploaded, or downloaded. No save, invitation, sign-out, email, password, consent, or claim mutation ran.
The browser's read-only DOM scope omitted FileList properties. This is not evidence of an empty selection or an application defect.
Proof: `pr24-owner-settings-mobile-2026-10-17.png` in the session visualization folder.

One later empty-file submission was expected to stop in the client. Instead, the UI showed Preparing upload, then its file error.
`validateUploads([])` accepts an optional empty list. The private client therefore called `prepareClaimDocumentUpload` with an empty manifest.
The server spends `staff-upload-prepare:user` before rejecting that manifest. Its ordinary one-hour counter window expires without intervention.
No upload session, document, Storage object, or outbox write is reachable after that rejection; the list remains four documents.
This spent attempt exceeded the intended read-only test scope. No compensating write or counter reset was attempted.
Do not claim database data stayed unchanged for the complete owner-check sequence. Further submissions need exact approval.
The field marks `aria-invalid=true` and gives both the field error and generic form error. No file bytes were sent.
The final captured warning/error log remains empty. Proof: `pr24-empty-upload-refusal-2026-10-17.png` in the session visualization folder.

A separate bounded Luna review inspected the nineteen-file combined source and its consumers. It found no Critical or Important code issue.
Its minor finding was that `SECURITY_SCAN_2026-10-17.md` still marked legacy signatures and the password policy as unfinished.
That local report now records both completed fixes, the stored-name defenses, the recovery header repair, and exact historical/current test limits.
The same reviewer checked the corrected report and found no remaining correction. The report diff passes `git diff --check`.
At that review, the report was the only uncommitted security-worktree file. The later local verifier test is recorded below.
No commit, push, PR body change, merge, or deployment is approved for either local change.
Application source is unchanged, so the passing exact-commit CI and prior disposable checks remain applicable.

The next proposed batch uses valid synthetic 25 MiB files for owner and homeowner upload paths, plus one-byte-over client refusals.
The size validator runs on submit, not selection. Accepted files create sessions, document/cleanup/audit records, and private Storage objects.
Signed downloads create audit entries. These tests require exact separate approval because Preview shares the Production database.
Do not promise a direct internal-file action refusal through the browser when that file has no homeowner button.
List exclusion and backend authorization tests are different evidence. A direct hosted action check remains open until a supported test path exists.
At this earlier checkpoint, positive company acceptance remained open.
The later approved referral and staff alert are recorded under [Current vendor acceptance](#current-vendor-acceptance).
Three valid synthetic PNG fixtures are ready in session scratch folder `cmg-pr24-file-tests-e142f5f` under the visualization folder.
The owner and homeowner fixtures each have 26,214,400 bytes; the over-limit fixture has 26,214,401 bytes.
All three reopen, verify, and decode as 160 by 90 RGB PNGs. Their manifest records exact SHA-256 values.
An initial process-private TEMP location could not be read by another runtime. The verified shared scratch copies supersede it; none was uploaded.

### Approved combined Preview file batch

The owner separately approved two synthetic 25 MiB PNG uploads, one-byte-over refusal per form, and one download of each accepted file.
The approved destination was synthetic claim `CMG-2026-0003` on PR #24 Preview, using the shared CMG Production database.
No email, deletion, Production code, setting, DNS change, or job invocation was included.

| Result | Owner through the staff form | Homeowner |
|---|---|---|
| Filename | `CMG-SYNTHETIC-owner-25MiB.png` | `CMG-SYNTHETIC-homeowner-25MiB.png` |
| Hosted size and MIME | 26,214,400 bytes; `image/png` | 26,214,400 bytes; `image/png` |
| Kind and visibility | `other`, `internal` | `photo`, `customer` |
| Document | `8acc99b3-74bf-4139-935f-2fd3ffdea7eb` | `b88aaf19-b877-40c5-8115-879d6dcd0202` |
| Session | `ea0bec8c-583b-40e1-b5e8-a49ed8e38bad` | `504fb524-7000-48fb-87b6-89053d489289` |
| Session result | Completed; one file and one document | Completed; one file and one document |
| Permanent object suffix | `23660ff8-c06c-4d31-b2cc-f64bce2102d2.png` | `a13cd510-8ec9-4195-b614-7eff85c09503.png` |
| Saved download SHA-256 | `6ab97f7e51e37c688f7fc35ec73ecac93903a0a3db10463e44eb57f9c87ce81e` | `52337a6e3a0a6ac27a9275741b841b5c565cbb3c72cd0dd3c299b37a0edacf1e` |

Both saved files are exactly 26,214,400 bytes and match their prepared hashes.
The owner download is in `C:/Users/rob/Downloads/CMG-SYNTHETIC-owner-25MiB.png`.
The homeowner download is in the main checkout's `temp/CMG-SYNTHETIC-homeowner-25MiB.png`. Preserve it; do not stage it.
The Chrome download event timed out after 30 seconds. The user confirmed completion and supplied the actual save folder.
The exact file/hash check then passed. No second Download click or new signed link was issued.
Browser policy blocked access to `chrome://downloads`; no alternate browser surface or raw protocol was used.

The owner form showed Preparing, then success and five documents. After the homeowner upload, an owner reload shows six documents.
The homeowner form showed Preparing, then success and four visible documents. The owner's internal image and signed LOR are absent from that list.
This proves list exclusion, not a direct hosted internal-file action refusal.
Each form then refused the verified 26,214,401-byte file with its file-field error. No third upload session or file row exists.
The client validator rejects that boundary before prepare. An empty selection behaves differently, as recorded above.

The first in-app file transfer took about 232 seconds, although its timeout option was shorter. Its native filename and screenshot confirmed selection.
Automatic review initially blocked submit because the old empty-file error still marked the control invalid.
A fresh DOM read showed the selected filename and native `validity.valid=true`.
Source confirms selection retains the old server error until submit. With this evidence, the same direct button action was accepted.
No alternate submission method, DOM mutation, or permission change was used.

The owner audit viewer filtered to today's document issuances shows exactly two matching entries, one for each new file.
Both record attachment disposition and `ttl_seconds=300`, with the correct internal/customer visibility.
Automatic review blocked direct signed-token inspection. No workaround or token decoding ran.
The owner download's automatic AX result included its temporary URL; do not copy it into retained evidence or logs.
At the time of this earlier check, the URL was limited to the synthetic image and a live expired-link refusal remained unverified. The current section above records the later one-time refusal result; the later saved-file check passes by size and recorded Storage fingerprint.

Read-only Supabase Table Editor checks confirm two upload sessions, both completed; two file rows have verified object versions and exact size/MIME.
At file-batch completion, cleanup had eleven rows: nine processed and two pending staging paths, IDs 9 and 11.
Permanent-path intents 8 and 10 are processed. Both pending staging rows have zero attempts, no error, and no dead timestamp.
The private-upload guard prevents processing until 2 hours 15 minutes after creation, despite the earlier general next-attempt timestamps.
The accepted objects and cleanup records remain for review. No worker, retry, cancellation, manual cleanup, SQL write, or deletion ran.
These two pending paths are expected staging cleanup, not evidence of a failed cleanup worker.

Both refreshed document lists fit measured 390px and 1280px widths; client and scroll widths agree at each size.
The fresh homeowner form initially disabled upload controls, then enabled them after hydration. No source repair was needed.
The Chrome full-page mobile screenshot timed out once. The documented tab screenshot succeeded afterward.
All viewport overrides were reset. Captured owner and homeowner warning/error logs are empty; full request traces remain unavailable.
No source, commit, push, PR, deployment, Production setting, DNS record, or email changed during this approved batch.
The batch changed only the approved shared hosted test data and its associated Storage, audit, cleanup, and rate records.

Proofs in the session visualization folder: `pr24-owner-25MiB-upload-success-2026-10-17.png`, `pr24-owner-over-limit-refusal-2026-10-17.png`,
`pr24-homeowner-25MiB-upload-success-2026-10-17.png`, `pr24-homeowner-over-limit-refusal-2026-10-17.png`,
`pr24-owner-files-mobile-2026-10-17.png`, and `pr24-homeowner-files-mobile-2026-10-17.png`.
Negative signatures, actual expiry refusal, interruption/retry, and remaining account/referral/signing writes still need their supported tests and exact approvals.

### October 19 queue and retained-object read

The existing CMG Supabase browser session opened the intended Production project `vdtqxglhlgatpbgehsjk`, shown Healthy.
Only Table Editor views and Storage folder listings were used. No SQL editor, new query, saved snippet, RPC, worker, or hosted mutation ran.
The cleanup table contains eleven rows. All eleven have completion timestamps; all last-error and dead timestamps are null.
The two formerly pending staging rows now show:

| Queue ID | Processed at, UTC | Attempts |
|---|---|---:|
| 9 | `2026-10-18 14:27:39.463+00` | 1 |
| 11 | `2026-10-18 14:27:39.767+00` | 1 |

The loaded `claim-docs` root lists only claims and intake folders. No private-upload staging prefix is listed.
The synthetic claim folder lists five permanent files, including both approved 25 MiB test filenames.
No preview or download was opened. This verifies retained paths, not a repeat of their earlier saved-byte hashes.
All thirty-five outbox statuses were read by unique row identity across the virtual table: twenty-four sent and eleven dead.
No row is pending or failed. No payload or invite URL was copied into retained evidence, and no message was retried.
The first viewport showed only nineteen rows; it was not used as the full queue count.
One search entry was dismissed without submission when the new UI offered Ask AI instead of a table filter.
No AI query, row edit, or save followed. A covered header click made no table change; ordinary scrolling supplied the complete status count.

The Vercel CLI project read confirms `prj_kn2TbLFlGanRks9ZHRnmJFQ3ThMz` in `robs-projects-c72886ba`.
Default restricted CLI access failed with package-info/network errors. The same read with required network access succeeded.
The bounded historical cron request for October 18 14:00–15:00 UTC returned HTTP 400, not invocation evidence.
The signed-in project browser permits Last hour; Last 12 hours and Last day require Pro.
Last hour with Production and Cron Job filters returns zero records. That window does not include the recorded cleanup completion time.
Do not infer a failed or absent scheduled run from this result. No cron endpoint, Run button, retry, redeployment, or setting change was used.

Current [Vercel timing rules](https://vercel.com/docs/cron-jobs/usage-and-pricing) permit Hobby jobs anywhere within the configured hour.
Both configured jobs fall in the 14:00–14:59 UTC window. Their order and a seventeen-minute gap are not guaranteed.
Source review found no dependency on that order. Both routes authorize before creating the privileged client or touching a queue.
Outbox is bounded to twelve with concurrency three; cleanup is bounded to twenty-five. Both routes have a sixty-second maximum.
The [cron management guide](https://vercel.com/docs/cron-jobs/manage-cron-jobs) says failed invocations are not retried automatically.
The outbox route can also return 200 with `delivery: unconfigured` when the sender key is absent, without claiming rows.
An operator must check response details, queue state, and provider evidence; HTTP 200 alone does not prove delivery.
No new route test or source change was added during this read-only review. Real scheduled invocation and accepted delay remain open.

Evidence: `cmg-queue-read-summary-2026-10-19.json`, `cmg-cleanup-complete-2026-10-19.png`,
`cmg-storage-staging-prefix-absent-2026-10-19.png`, `cmg-permanent-test-files-retained-2026-10-19.png`, and `cmg-cron-hour-limit-2026-10-19.png`.
Cleanup success is new authoritative progress. It does not prove interruption handling, live URL expiry, or scheduler attribution.
Production code, settings, DNS, database rows, mail, and all retained files were unchanged by this review.

### Current commercial hosting and protection decision evidence

Read-only API checks on 2026-10-17 confirm Vercel team `robs-projects-c72886ba` uses Hobby.
GitHub reports a private personal repository, default branch `develop`, current commit `1b7f7f9`, and `protected=false`.
The user API has no plan value. That means unavailable; it does not prove a Free subscription.
Current [Vercel commercial-use rules](https://vercel.com/docs/limits/fair-use-guidelines) still require Pro or Enterprise for commercial use.
The [Pro plan](https://vercel.com/docs/plans/pro-plan) lists a USD20 monthly base, one deploying seat, and USD20 usage credit, before tax.
Usage beyond credit and additional deploying seats cost extra. The base is not a total spending cap.
An upgrade affects the whole team, including its other projects; billing responsibility and a spending limit need owner decisions.
[GitHub's protected-branch documentation](https://docs.github.com/en/repositories/configuring-branches-and-merges-in-your-repository/managing-protected-branches/about-protected-branches) confirms eligible paid plans support private protection.
The existing subscription must be checked before purchase. No plan, member, permission, protection rule, or spending setting changed.
The proposed controls are PRs, current-base `verify`/`database` checks, resolved conversations, blocked force pushes/deletion, and administrator enforcement.
Do not require an approval count that a sole author cannot satisfy without naming another eligible reviewer.
CLI help printed successfully but exited 1 after its process ended; the later read-only team API request succeeded with exit 0.

### Current recovery-budget runtime proof

The harness loads exact PR #23 TypeScript from `15ea5f6a5d21a9b66bef84e8f61d24d3a1a5e26c` in memory under Node 22.
It calls the real confirm handler, token parser, IP resolver, rate-limit wrapper, and site-mode functions.
Actual NextRequest and NextResponse objects are used. Auth verification and unused account clients are stubbed; no Auth service is contacted.
The admin RPC transport maps only the expected function and parameters to real SQL in the disposable container.
This checks the SQL function through a transaction bridge. It does not test the PostgREST transport or hosted rate counters.
Docker identity, project label, and port exactly match `CMGPA_private_upload_disposable` at 15522.

| Boundary | Result |
|---|---|
| Budget | Attempts one through ten reach stubbed Auth. Attempts eleven and twelve do not. Every invalid-token result uses the same 303 expired-link response. |
| Caller separation | A second synthetic IP gets its own first allowed attempt. |
| Invalid shape | Five missing, malformed, wrong-type, or repeated-parameter cases spend no limiter budget and make no Auth call. |
| RPC outage | The injected RPC error fails closed before Auth. Exactly one expected internal error is captured. |
| Site modes | Simple closes the route before rate or Auth calls. Staff and platform apply the normal limit. |
| Stored counters | Counts are 12, 1, and 1. Each window start aligns to the 900-second boundary. |
| Recovery | The transaction rolls back. The entire rate-table count and fingerprint equal the pre-test values. No reset occurred. |

The harness exited zero. Its scratch file is `C:/Users/rob/AppData/Local/Temp/cmg-recovery-boundary-15ea5f6.cjs`.
No source file, dependency, hosted database, retained local stack, account, message, or provider document changed.

### Current main-checkout and listener review

The dirty main checkout remains preserved. Its uncommitted site-mode comment already matches current `origin/develop`; it is not a unique runtime change.
The `.project-board/` ignore rule and shared-board instructions remain unique local changes.
Main README describes older staff-mode operation. Current `develop` README and verified release evidence describe platform mode.
Uncommitted authorship is unknown. Do not use the old main README as current Production evidence or stage these unrelated files.
Reconciliation and any later Git actions remain separate from the security PR.

Fresh owner IAB and staff Chrome navigation to claim 0005 captured no warning or error after `2026-10-17T21:16:26.641Z`.
Both pages completed their loading state. Tab reached the next policy selector; Enter opened the staff Documents page.
No form value or hosted record was changed. Source search found no extension runtime messaging calls in `src`, `public`, or `tools`.
[Chrome's messaging guide](https://developer.chrome.com/docs/extensions/develop/concepts/messaging) explains asynchronous extension message channels.
That is context, not attribution. The old listener-error stack and source remain unavailable; no specific extension or application defect is proved.

### Current homeowner read-only acceptance

The owner opened a separate Chrome Incognito session on the PR #23 Preview at `15ea5f6`.
Profile identifies `rob@miodiollc.com` as CMG Upload Acceptance Test. Only synthetic claims `CMG-2026-0003` and `CMG-2026-0004` appear.
No credential, code, session token, or private link was read.

| Check | Result |
|---|---|
| Positive routes | Claim list, profile, and both claims' overview, activity, and documents pages pass at 1280px and 390px: sixteen layouts. Each has one main heading, no global overflow, and no retained loading state. |
| Owned documents | Claim 0003 shows three existing 68-byte PNG files. Claim 0004 shows its empty document message. No Download or Send control was used. |
| Activity and loading | Both activity feeds finish loading. Account and claim loading placeholders were observed before their completed content. No question was sent. |
| Claim isolation | Foreign claim 0005, a missing valid UUID, and an invalid UUID have the same settled main text and title within overview, activity, and documents routes at both widths. No global overflow. |
| Metadata timing | One immediate mobile invalid-ID document title retained the parent suffix before load completed. A load-complete comparison of all three document refusals matched. Do not compare the overview title format with section titles. |
| Cross-role requests | `/admin` and `/partner` redirect this homeowner to `/portal`, which shows its two claims. |
| Keyboard | Tab reaches the current-password visibility control. Enter shows and hides its empty field. Enter opens and closes consent details. Enter on the refusal return link opens the claim list. |
| Consent and profile | Four existing consent records render. The first disclosure exposes the existing consent text and withdrawal control. No value, consent, password, or session was changed. |
| Diagnostics | Captured warning and error logs are empty. Full network request traces remain unavailable. |

Proof images: `pr23-homeowner-documents-mobile-2026-10-17.jpg` and `pr23-homeowner-list-mobile-2026-10-17.jpg` in the session visualization folder.
The screenshot API included a wider backing surface; a 390-by-844 clip captures the measured document viewport.
All temporary viewport overrides were reset. The owner later closed the homeowner tab; earlier acceptance evidence remains valid.
At this earlier PR #23 checkpoint, hosted uploads, audited downloads, and profile writes were untested. The later PR #24 file and profile batches above supersede those limits. Questions, password changes, consent withdrawal, and sign-out remain open on the current candidate.

### Current vendor acceptance

The owner approved one referral submission on PR #24 at `d523469` on October 21.
The saved CMG connection was verified against project `vdtqxglhlgatpbgehsjk` before read-only SQL.
Vendor1 Tester used the existing account `4miodio+cmgvendor@gmail.com` and active company `CMG Test Vendor`.
Its profile is `377a70f3-b200-4221-aff4-6cbf274ed25c`; its company is `9c0aa48d-76da-4b07-873e-7273aee3ed97`.
The initial company claim count was one. The exact synthetic email had no claimant or outbox match.

One click created `CMG-2026-0006`, UUID `76824e46-c8de-4ad9-89b2-6225032ceaee`, at `2026-10-21T19:12:10.685417Z`.
The page showed Referral sent and the new reference. The vendor list then showed exactly claims 0005 and 0006.
The new summary opens with the approved name, address, and New intake status. Milestones and settlement remain private.
Readback confirms exact input, one primary claimant, one partner summary, and zero consent, document, or claim-event rows.

Three audit entries were created: `claims.insert` 197, `claimants.insert` 198, and `claim.partner_referral` 199.
The first two are normal insert-trigger entries with null actors. Entry 199 identifies the approved vendor actor and company.
The approval description counted only one audit entry. It understated the two automatic entries; this discrepancy was disclosed to the owner.
All three remain retained. No record correction or deletion was attempted.

Outbox `edf69c04-a420-485a-a1b5-e7d554fe8162` uses `referral_staff_alert` and the verified CMG staff inbox.
Its status is `sent`, attempts is one, and last error is null. The sent timestamp is `2026-10-21T19:12:11.144Z`.

After sign-in, Resend reports Delivered to `Austin@CMGPropertySolutions.net` for the matching subject.
Subject: "New referral CMG-2026-0006 — CMG Test Vendor". Provider record: `01a15fe0-cf49-7eec-ac11-1ac3d5a4e957`.
This confirms provider delivery. Independent recipient-inbox receipt was not checked.
Provider proof is `pr24-vendor-referral-resend-delivered-2026-10-21.png` in the session visualization folder.

No second submission, manual resend, claim acceptance, customer email, access grant, upload, or worker invocation occurred.

The prior opaque Cloudflare-frame warnings and errors did not prevent this successful submission. Full request traces remain unavailable.
The exact input is retained in `pr24-vendor-referral-proposal-2026-10-21.json`.
Result evidence is `pr24-vendor-referral-acceptance-2026-10-21.json` in the session visualization folder.
Prepared-form, success, and vendor-list images use the matching `pr24-vendor-referral-` prefix and `2026-10-21.png` date suffix.

This approval is consumed. Do not submit again. Production code, settings, DNS, and unrelated retained work remain unchanged.

The following earlier read checks retain their original dates and scope.

The owner signed in as `robspeciale@gmail.com` on PR #23 at `15ea5f6`. Its portal identifies RS Gmail and CMG Synthetic Vendor Test.
This company has no linked claims. The account is sufficient for empty pages and refusal tests; no new invitation is needed.

| Check | Result |
|---|---|
| Positive pages | List, profile, and referral form pass six layouts at 1280px and 390px. Each has one main heading and no global overflow. |
| Empty state | The list shows no referrals. Profile shows read-only company data and three contact fields marked Not on file. |
| Referral form | Eleven required controls render; ten are invalid while empty. State defaults to Florida. No input was filled or submitted. |
| Claim refusal | Foreign claim 0005, a missing UUID, and an invalid UUID have identical settled main text and document title on summary/activity at both widths. Twelve cases pass. |
| Cross-role requests | Admin and homeowner routes redirect to this vendor's partner list at both widths. Four cases pass. |
| Keyboard | Tab from first name reaches last name. At 390px, Right Arrow scrolls the menu 40px and fully reveals Company profile. Enter opens the profile. |
| Diagnostics | No application-origin warning/error was captured. Four opaque Cloudflare-frame NaN entries appeared during referral navigation. Full request traces remain unavailable. |

Proof: `pr23-vendor-empty-mobile-2026-10-17.jpg` in the session visualization folder. The saved image was inspected.
Viewport overrides were reset. No hosted claim, company, profile, message, session, or permission changed during these checks.
Positive company-scoped claim/activity proof requires an existing linked account or separately approved synthetic fixture work.
The October 19 source review found a safer next check before any fixture write.
After owner sign-in, a SELECT-only query confirmed the existing synthetic vendor mapping in CMG Production.
`4miodio+cmgvendor@gmail.com` has an active partner profile at active `CMG Test Vendor`, with one linked claim and one summary.
That claim is `CMG-2026-0005`, UUID `153a2250-297d-4b81-ab20-65da3b590852`, with status `under_review`.
The profile, claim, and summary use company UUID `9c0aa48d-76da-4b07-873e-7273aee3ed97`.
`robspeciale@gmail.com` remains an active partner at active `CMG Synthetic Vendor Test`, with zero claims and summaries.
Its company UUID is `8d770678-ed0d-4cbc-b6c9-bd55eeb114b5`.
Claim 0003 has no partner attribution or partner summary. No claim was reassigned.
Use the existing linked vendor account for the next positive list and summary checks.
The mapping depends on `profiles.partner_company_id`, an active partner profile, and an active company.
The separate `intake_referral_partner_id` does not grant portal access.
Partner activity exposes only `partner` and `shared` entries for that company's claim.
These reads need no claim reassignment, invitation, referral submission, event insertion, or audit-creating download.
They do not prove positive claim access for the separate `CMG Synthetic Vendor Test` company.
No supported application action reassigns an accepted claim's company. Do not repoint claim 0003 to create this fixture.
Such a change would disclose its projected claim data to another company and needs exact approval.
A new vendor referral creates claim and claimant records, audit data, and a staff alert. It also needs separate approval.
The Supabase session first required owner CAPTCHA completion. The owner restored access, and the exact CMG project was verified.
Both query transactions used `BEGIN READ ONLY` and ended with `ROLLBACK`. Neither was saved as a cloud snippet.
The second query counted existing claim 0005 activity: one `customer` entry, with no `partner`, `shared`, or `internal` entry.
The owner then signed in as `4miodio+cmgvendor@gmail.com`. The portal identifies Vendor1 Tester and `CMG Test Vendor`.
The user opened the earlier tab. Checks moved to the selected test tab, which shares that signed-in session.
No password, code, or session token was read.

| PR #24 linked-vendor check | Result |
|---|---|
| Positive pages | List, claim 0005 summary, activity, and company profile pass eight layouts at measured 1280px and 390px. Each has one main heading and no global overflow. |
| Company and claim | At this earlier read, the profile shows CMG Test Vendor and the list contains only claim 0005. Its summary matches the expected fields. The later approved referral adds claim 0006, as recorded above. |
| Data limits | No policy, contact, document, or download control appears on the claim summary. Settlement remains private while the claim is under review. These are rendered-page checks, not direct data-action tests. |
| Activity exclusion before the approved write | Both widths show the empty partner feed. The existing customer-only event does not appear. No partner/shared event exists at this point. The later approved note test is recorded below. |
| Claim refusal | Unattributed claim 0003 and an invalid UUID return identical main text and document titles on summary/activity at both widths. Eight cases pass. No claim data appears. |
| Role isolation | `/admin`, `/portal`, and claim 0005's homeowner-document route return to `/partner` at both widths. Six cases pass. No download occurs. |
| Keyboard and loading | Enter on the refusal return link opens the referred-claim list. Claim, profile, and return navigation show loading states before settled content. |
| Diagnostics | Captured warning/error logs are empty. Full network request traces remain unavailable. |

All twenty-two measured checks pass. The initial background-tab viewport attempt measured 814px and is excluded.
The correction uses the selected test tab. No CSS, source, permission, claim, event, invitation, or file record changed.
The temporary viewport override was cleared. The final measured size is the normal 1280 by 720 pixels.
The owner approved one partner-only entry for claim 0005, using the owner account and audience `Partner`.
Approved text: "CMG SYNTHETIC TEST — Partner-only activity acceptance. No action is required."
Normal UI Sign out uses global scope and writes an audit record. It was not used to switch the current test sessions.
The owner completed sign-in and MFA in Chrome Incognito as `rob@thespeciales.com`.
The page confirms Rob Speciale, role OWNER, claim 0005, and one existing Homeowner event before submission.
No matching synthetic note exists in that initial feed. The composer initially selects CMG only.
Codex selected Partner, entered the exact approved body, and checked the visible audience and claim before clicking Post entry once.
The page showed Posted, two entries, and one matching note by Rob Speciale labeled Partner at October 19, 8:37 PM EDT.
An owner reload preserved exactly one matching note and the earlier Homeowner event. No retry was needed.
The event insert has no duplicate guard. Do not repeat this completed write.

The signed-in Vendor1 Tester then opened claim 0005 activity. It shows exactly one matching note at measured 1280px and 390px.
The earlier customer-only text, "Claim moved to Under review.", remains absent from the vendor page.
Both layouts have one main heading and no global overflow. The temporary viewport override was cleared.
Captured owner and vendor warning/error logs are empty. Full network request traces remain unavailable.
Independent source review confirms that `postClaimEvent` calls `notifyCustomerOfReply` only for customer/shared visibility, excluding Partner.
The owner later restored CMG Supabase access. Read-only table filters confirm note `ba8600a1-730f-44a8-ad8d-cafb4285c375` with visibility `partner`.
Exactly two events exist for claim 0005: this note and the earlier `customer` status event.
The outbox has zero rows created since October 20, 00:37 UTC. No provider inbox or receipt was inspected in this batch.
The one retained synthetic event is the only hosted write in this batch. No email, file, invitation, access, Production setting, or DNS change was made.
Evidence is `pr24-partner-note-acceptance-2026-10-19.json` in the session visualization folder.
Preflight proof uses `pr24-partner-note-preflight-2026-10-19.json` and its matching PNG.
Saved-result images are `pr24-partner-note-owner-saved-2026-10-19.png`, `pr24-partner-note-vendor-1280-2026-10-19.png`, and `pr24-partner-note-vendor-390-2026-10-19.png`.
Independent readback uses `pr24-partner-note-db-read-2026-10-19.json` and `pr24-note-invalid-file-outbox-read-2026-10-19.json`.
The owner company page also displays the expected active company and a branch Preview `/file-a-claim?ref=...` link.
Opening that displayed URL as a GET loads Letter of Representation and preserves the referral code in the URL.
No form was submitted. GET does not establish active-company resolution or persistence. Proof is `pr24-vendor-referral-link-read-2026-10-19.json`.
The owner then requested Codex tab cleanup before further login help.
Eight unused Codex tabs were closed: the duplicate CMG page, five PandaDoc pages, Supabase sign-in, and Vercel logs.
All five PandaDoc pages showed Draft, with no visible unsaved-change warning, before closing.
No provider document was deleted, discarded, sent, or signed. Their IDs remain recorded below.
Only Codex tab 10 remains open, with the signed-in vendor and claim 0005 activity.
Chrome's normal homeowner session remains unchanged. The separate Incognito owner session is now signed in on claim 0005 activity.
Closed tab handles 1, 2, 3, 4, 6, 7, 8, and 9 must not be reused.
Acceptance proof is `pr24-vendor-read-acceptance-2026-10-19.json` in the session visualization folder.
Mobile proof files are `pr24-vendor-summary-mobile-2026-10-19.png`, `pr24-vendor-activity-mobile-2026-10-19.png`, and `pr24-vendor-list-mobile-2026-10-19.png`.
Proof files in the session visualization folder are `cmg-vendor-mapping-read-2026-10-19.json` and `cmg-vendor-mapping-read-2026-10-19.png`.
Activity proof is `cmg-vendor-activity-count-read-2026-10-19.json` with its matching PNG.
Independent source/proof review confirms the active company match and the limits of the database evidence.
Source review used `src/lib/partner/queries.ts`, the partner RLS policies, intake/referral actions, and `supabase/tests/22_partner_portal.test.sql`.
The current staff session was not rechecked after vendor sign-in. Do not infer separate profile isolation from the older open staff page.
The initial partly clipped link was not proof of a keyboard access defect. The existing menu is deliberately scrollable.
No CSS, component, source test, or prepared security file changed during this diagnosis.
Proof: `pr23-vendor-keyboard-profile-mobile-2026-10-17.jpg` in the session visualization folder.

### Current additional owner keyboard checks

On PR #23 at `15ea5f6`, the owner opened the staff invitation disclosure with Enter, then reached its email field with Tab.
Enter or Space closes it. Both measured 390px and 1280px checks pass without global overflow.
The three invitation fields render. No value was entered, and Send invitation was not used.
The last active owner's role and deactivation controls remain disabled, with their explanations visible. No account was changed.
The first background-tab viewport attempt measured 688px. It was not counted as a mobile or desktop result.
The completed checks used the selected review tab and measured the requested width directly.

At 390px, an audit row opens and closes with Enter. Its seven stored fields render without global overflow.
Subject selection updates the query to Documents. A real ArrowUp date change updates the URL and returns the expected empty result.
An automated date fill alone did not commit a change. That observation is not a proved application defect.
Clear filters restores All activity. Enter on Older opens the next page, and Enter on Back to newest restores the first page.
No audit entry, claim, user, invitation, or message changed. Captured warning/error logs are empty; full request traces remain unavailable.
The prior local review tab now displays hosted owner Audit. The dummy-provider local server remains separate on loopback port 3040.

### Combined Preview profile keyboard check and safe stop

At exact PR #24 `e142f5f`, the signed-in synthetic homeowner profile passed three empty password-toggle keyboard checks.
Tab reached each Show password control. Space changed only its paired input to text; a second Space restored password masking.
All fields stayed empty. No save, password change, sign-out, or consent withdrawal was submitted.
The profile fits measured 1280px and 390px widths without horizontal overflow.
At 390px, Space opened the first consent record. Tab reached its withdrawal button without activating it.
Shift+Tab and Space closed the record. All details are closed, all three passwords are hidden, and the viewport override is reset.
Captured warnings/errors are empty. Full browser request traces remain unavailable.
The profile has no advance all-device sign-out notice; the implemented success message remains on the login return path.
The initial screenshot preceded focus scrolling. The settled replacement shows the expanded record and focused withdrawal control.
Proof: `pr24-homeowner-profile-desktop-2026-10-17.png` and `pr24-homeowner-profile-mobile-2026-10-17.png` in the session visualization folder.

The owner then signed in to PandaDoc and approved both prepared synthetic uploads as unsent drafts.
The account menu confirms the CMG business account. The dashboard shows zero own drafts before any upload.
The workspace's display name has not yet been inspected. No document, draft recipient, contact, email, or signature was created.
The owner requested a safe stop on October 17 before selecting or uploading either PDF.
The owner resumed the approved test on October 19. The next subsection records the one created draft and its failed visual check.
The unchanged Dual-file approval remains unused. Revised files require a new exact upload approval.
No commit, push, deployment, Production setting, DNS, hosted database write, or backup occurred in this continuation.

### Current bounded inbox check

The existing `rob@thespeciales.com` inbox session is available. A search used the exact current subject, `Reset your CMG password`.
The Inbox search returned No messages. This does not prove non-delivery, deletion, or absence from other folders.
No message body, reset link, attachment, or unrelated message was opened. The search was cleared afterward.
The `rob@miodiollc.com` browser tab is at the mail login page. No password was entered or requested again.
Current inbox receipt and monitored reply handling remain unverified. No mail was sent, retried, moved, or marked read.

### Current offline PDF review

The review used the unchanged source assets on `codex/security-upload-session-checks` at `abc4499`.
Both variants contain nine US Letter pages, each 612 by 792 points.
Both have zero canonical AcroForm fields and zero page widgets. They use text tags that PandaDoc must convert into fields.
Single has exactly 34 manifest tags. Dual has exactly 43. Each tag appears on its expected page, with no extras.
Tag x coordinates match the manifest. The extracted y difference is 1.4 points from its baseline convention; no tag box leaves a page.
All eighteen pages were rendered. Contact sheets and detail pages 1, 5, 7, and 9 show no clipping or unintended overlap.
Page 9's raw `em`, `ne`, and `su` tags are expected source placeholders. The existing prefill regression covers their replacement.
This checks layout and manifest agreement only. It does not prove PandaDoc field recognition, signer assignment, legal accuracy, or completed signing.

| Source | SHA-256 |
|---|---|
| Single PDF | `50760ff01bf35a57a58e6825c74211e29ffbc188df0964ef0ba9aa488954d92e` |
| Dual PDF | `4d68e2e073b112b05e038dc821f079ed61cfa15d0b4a6235acb4caa22cd91941` |
| Manifest | `5d25d3737e60f391d920c9728bcce3e0dd2fb3fed4abc21433aaa5cb40056093` |

Read-only renders are in `cmg-lor-review` under the session visualization folder. No source PDF, wording, or manifest changed.
The [manual field-recognition guide](https://support.pandadoc.com/en/articles/9714598-field-tags-recognition) and [API field-tag guide](https://developers.pandadoc.com/docs/field-tags) describe different tag examples.
Neither proves that these exact role-qualified tags produce correct fields through manual web upload. That controlled draft test remains open.
No hosted PDF download, PandaDoc upload, draft, message, signature, or legal approval occurred.

### Local prefilled examples for manual web recognition

The next preparation used the actual `buildPrefilledLorPdf` function at combined commit `e142f5f`.
Only the `server-only` import guard was stubbed for the local harness. The real PDF loader, field mapper, manifest, and PDF library ran.
No Auth, database, browser, or provider request ran during generation. No application source or bundled asset changed.
Both examples use synthetic names, policy, property, carrier, phone, and `example.invalid` email values.
The fixed dispatch date is 2026-10-17. It does not represent a completed signature.

| Prepared fixture | Bytes | SHA-256 | Remaining signing tags |
|---|---:|---|---:|
| `CMG-SYNTHETIC-single-prefilled.pdf` | 2,303,878 | `9eba3d2c4b1ae288e9f00de75e9db06625fbefb5f04bdea43da6ee342aeabe47` | 9 |
| `CMG-SYNTHETIC-dual-prefilled.pdf` | 2,303,988 | `fb67a9e066456ddf0846d1afcbeefdbf217037caf2b917f6b80bda22cdfb59e2` | 18 |

Both files have nine pages. All twenty-five data tags are replaced; the intended role-qualified signing tags remain literal text.
Text checks retain the full synthetic policyholder names, policy number, fee, and email.
All eighteen pages were rendered at 72 dpi and visually inspected, including the agreement category and signature pages.
Poppler exited zero but reported `No display font for 'Symbol'` and `No display font for 'ArialUnicode'` for both files.
Visible text and checkbox marks remain present in those renders. The warnings remain a rendering limit, not an application test failure.
Values retain the existing seven-point tag font and positions. Some values lie on or below printed underlines.
Final provider appearance, field placement, readability, and legal sufficiency remain unapproved.

Fixtures, hashes, and page images are in `cmg-manual-signing-draft-fixtures` under the session visualization folder.
These are recognition-test inputs, not completed or approved letters for customers.
No PandaDoc tab was initially available. The owner has now signed in to the new built-in browser tab.
The owner approved these two synthetic files as unsent drafts in the CMG workspace.
The Single-file approval is now consumed by the one draft recorded below. Dual remains unuploaded.
If needed, draft recipients may use `cmg-test-1@example.invalid` and `cmg-test-2@example.invalid`.
No email, saved contact, purchase, hosted claim download, claim change, signature, or deletion is included.
Stop if the web upload leaves the tags visible. Do not hide tag text or place fields over it as an unreviewed workaround.
This isolated recognition check will not replace the later approved claim download, send, signing, storage, and status tests.

### Current manual PandaDoc draft result

On 2026-10-19, the browser session still used the approved CMG business account.
Workspace settings show the active workspace name `PandaDoc`, with one member. No setting or subscription changed.
Both local PDF hashes still match the approved preparation table. The dashboard showed zero own drafts before the upload.
The Single file was uploaded once. The file-chooser call took 991 seconds despite its requested 30-second timeout.
Its first observation showed Uploading. A later read of that same tab confirmed a created document; no retry or duplicate upload ran.

| Item | Observed result |
|---|---|
| Document | `GDdiBGFUY6r7ykB2xREmah`, title `CMG-SYNTHETIC-single-prefilled` |
| Status | Draft, editing step 2 of 3. Neither Review and send nor Finalize document was selected. |
| Recognition | The uploader reported nine form fields. Place fields produced five Initials and four Signature fields. |
| Pages | Initials appear on pages 1, 2, 3, 4, and 8. Signature fields appear on pages 5, 6, 7, and 9. |
| Assignment | Place fields automatically added the current CMG account as a Signer and assigned all fields to it. No dummy recipient or saved contact was added. |
| Visual result | Failed. At 200%, the page 1 Initials field shows the original black role-qualified tag text through the field. |
| Remaining scope | Dual upload, required-field properties, intended signer assignment, all-page field placement, final appearance, signing, and filing remain unverified. |

The current [web field-tag guide](https://support.pandadoc.com/en/articles/9714598-field-tags-recognition) explicitly requires tag font color to match the background.
Its web workflow places fields on top and assigns them to a recipient; recognition alone does not remove the printed tag.
The source generator sets `TAG_COLOR = (0, 0, 0)` for both data and signing tags.
`buildPrefilledLorPdf` replaces data strings but preserves signing strings and their black drawing state.
This explains the visible text. It is a PDF-preparation defect in the selected manual path, not a failed Turnstile or login check.
The proposed repair changes only manual output signing-tag glyph color while retaining parseable text, dimensions, and positions.
It must preserve visible claim values, legal content, bundled assets, and API upload bytes.
The owner approved local branch `bugfix/manual-signing-tag-visibility` and the repair, with both signer variants tested.
The isolated checkout starts at verified current `develop` commit `1b7f7f9`; the stale local `develop` reference remains unchanged.
The checkout uses the pre-authorized session scratch area. It reuses matching installed dependencies through a junction; no package was installed.
The first metadata and junction writes were sandbox-denied without partial changes. The same approved setup then succeeded with required tool access.
At that checkpoint, local implementation and render checks remained in progress. Later results and approvals appear below.

#### Local repair checks and rejected first output

The original prefill tests passed nine tests before the change.
New regression tests first failed for black signing glyphs and missing/duplicate marker acceptance.
The first repair scoped white fill around complete standalone signing text objects at the manifest positions.
Independent review found that the first broad matcher could hide extra text in the same object; the strict matcher resolved that finding.
Fifteen focused tests, type checking, lint, and the diff check then passed.
They cover both variants and missing, duplicate-across-stream, moved, and extra-text markers.

The actual repaired function produced two local synthetic PDFs, with no network, database, Auth, or provider call.
Both have nine pages and retain all nine or eighteen signing tags. All twenty-five data tags are replaced.
After removing only the scoped color operators, every content stream matches the earlier approved fixture exactly.
Extracted text is identical on all eighteen pages. Pixel differences stay within the signing-marker regions.
Bundled PDF hashes, the API upload module, the shared PDF loader, and the manifest remain unchanged.
However, white glyphs cut small gaps in underlying lines on pages 1, 7, and 8. Root rejected these outputs after visual review.
The files remain local evidence, not approved upload files or final letters.
Poppler repeated the existing Symbol and ArialUnicode font warnings at both rendering sizes.

The next local revision will retain the marker text but use scoped PDF text rendering mode 3 to avoid painting over lines.
The [PDF standard, section 9.3.6](https://opensource.adobe.com/dc-acrobat-sdk-docs/standards/pdfstandards/pdf/PDF32000_2008.pdf) defines this mode as neither filling nor stroking text.
All marker fonts in both bundled variants are Type 1 Helvetica. Both variants need fresh render and regression checks.
PandaDoc's guide does not confirm recognition of this rendering mode. A new exact draft approval and successful provider check remain required.

The default application build failed because Turbopack rejects the reused dependency junction outside its filesystem root.
No application compilation success is claimed. The existing installed packages were copied into session scratch without installation or download.
The first copy preflight stopped before copying because its path comparison mixed slash styles; the normalized comparison passed.
The existing full-unit process remains under observation. Do not replace its dependency path while it runs or start a duplicate.
After it exits, replace only the generated junction with the copied packages and repeat the normal build without a configuration workaround.

#### Second local output: non-painting signing tags

The next regression first failed because both signer variants used text rendering mode 0.
The revised helper now scopes `1 g` and `3 Tr` around each exact standalone signing text object, with `q/Q` restoration.
All fifteen focused prefill tests pass after the revision. The separate source reviewer found no new Critical or Important issue.
The fixture source SHA-256 is `14f6e8a48b249989493311816431704bf4e2dc036b3fba876bf274e532628af2`.
The original output and rejected white-only output remain unchanged as local evidence.

| Revised local test file | Bytes | SHA-256 |
|---|---:|---|
| `CMG-SYNTHETIC-single-nonpainting-signing-tags.pdf` | 2,303,966 | `589d1a8fe2fcda63ea27198bac7278b4ce47eb8c5673e37f036fefd2921a1658` |
| `CMG-SYNTHETIC-dual-nonpainting-signing-tags.pdf` | 2,304,090 | `613747b47a6584952d429929d0052de6d4a52592a305498ca0550f44ec3be816` |

Both files are in the session scratch folder `cmg-manual-signing-tag-fixed-fixtures-v2`.
They use the actual revised function and the same synthetic values and fixed October 17 dispatch date as the original fixtures.
Both contain nine pages. Single retains nine marker strings; Dual retains eighteen. All twenty-five data tags are absent.
Removing only the scoped color/render operators restores every original approved content stream exactly.
Pypdf confirms identical extracted text on all eighteen pages.
PDFium renders all eighteen pages pixel-identically to an in-memory reference with only the signing-tag show strings blanked.
This confirms that the revised markers do not paint over existing lines or content.
Poppler also rendered every page at 72 and 144 dpi. Root inspected both contact sheets and all eighteen enlarged signing areas.
The line gaps from the white-only attempt are absent. The existing Symbol and ArialUnicode warnings remain recorded.
The existing date values on pages 1 and 8 intersect printed lines in both the original and revised files.
That older layout issue is outside the approved tag-color repair. Do not describe the complete legal PDF layout as accepted.

At this local stage, no revised file was uploaded. The later approved provider results are recorded below.
The broader unit process began before the render-mode revision and is not final evidence for the revised source.
Fresh type, lint, normal build, and full unit checks remain required after the local dependency-layout repair.

#### Final local check progress

The final revision passes `npm run type-check` and `npm run lint` under Node 22.22.2.
The focused selection passes 124 tests in each of `SITE_MODE=simple`, `staff`, and `platform`.
That selection includes the prefill, marker-color, manual action, and site-mode unit tests. It is not hosted role acceptance.
The earlier broad run exited 0 with 1,682 tests passed and 56 database/live tests skipped, but preceded the final revision.
The fresh final full unit run passes 121 files and 1,682 tests; 13 files and 56 database/live tests skip.
It exits 0 after 639.96 seconds. Do not count the earlier run as final verification.

After that earlier process and mode checks exited, only the verified generated dependency junction was removed.
The already-copied packages were moved into its place. The original installed packages remain unchanged.
No package, lockfile, Next.js setting, PostCSS setting, CSS, or production dependency changed.
The normal build then reached a blocked Google Inter request under the default network restriction.
The network-enabled build and its diagnostic retry stopped when the Turbopack PostCSS worker exited before connecting.
Direct PostCSS processed 82,293 CSS bytes successfully. A local parent/child TCP probe failed with EACCES under normal restrictions and passed with required tool access.
These observations did not prove the exact worker failure cause.
The failed generated `.next` folder was retained outside application inputs after both absolute paths and its non-link status were verified.
The fresh normal `npm run build` then passed with required tool access, local placeholder URLs/keys, and telemetry disabled.
Compilation took 12.9 seconds; TypeScript took 33.8 seconds; all five static pages generated successfully.
No bundler switch, configuration workaround, validation bypass, hosted call, or deployment was used.

Docker's local engine is unavailable. No disposable database test, reset, or database type generation ran for this PDF-only repair.
Database/live tests remain explicit skips. SQL, authentication, Storage behavior, and generated database types are unchanged.

The final source SHA-256 is `85387c4d2fcc76012ddc1afe0e34580a475f480fe3e971b40fa530b068050356`.
It differs from the fixture-generation source only by a comment that now requires a provider check after PDF-preparation changes.
Root verified that exact comment-only difference. No executable code changed after fixture generation.
The new test file SHA-256 is `02e6c4acbf365c7f1cfa238d71feed4cb23f6c8a7c190e0c39ff0db9efced4d0`.
Both revised fixture hashes still match. Both changed source files pass whitespace checks; all thirty-one local Markdown references exist.
The source diff contains only `lor-prefill.ts` and the new `lor-prefill-color.test.ts`; no Git action followed branch creation.
The retained PandaDoc document is still Draft at step 2 of 3, with 100% zoom. No provider state changed during the final read.
Proof: `cmg-pandadoc-retained-draft-2026-10-19.png`.

The next provider action required exact approval for the two revised unsent drafts in the existing CMG workspace `PandaDoc`.
The owner later approved that exact batch, with unsaved `example.invalid` recipients only. Its completed results follow below.
The existing failed draft is retained. The unchanged Dual-file approval was not used for revised bytes.
The revised-file approval excluded send, signature, saved contact, purchase, deletion, CMG change, Git actions, and deployment.
The local repair needs no Production recovery because no release ran. Preserve the bundled assets and use a reviewed code correction for any later defect.

At the first failed-draft stop, zoom was restored to 100%. No second draft, email, contact, signature, deletion, or CMG write occurred.
Proof: `cmg-pandadoc-single-visible-tags-2026-10-19.png`, `cmg-pandadoc-single-fields-2026-10-19.png`, and `cmg-pandadoc-workspace-2026-10-19.png`.

#### Revised provider drafts: recognition and required settings pass

On October 19, the owner approved the exact revised files and full hashes listed above as two new unsent drafts.
Each hash was rechecked before upload. Each file was uploaded once to the same CMG workspace, without a retry or duplicate.
Single detection passed before the Dual upload began. The old failed Single draft remains unchanged and retained.

| Check | Revised Single | Revised Dual |
|---|---|---|
| Document ID | `GxuADmbyQZ5rJDCtZXnpH5` | `9o6Qkr27Yyu5MvhgyRMo9N` |
| Title | `CMG-SYNTHETIC-single-nonpainting-signing-tags` | `CMG-SYNTHETIC-dual-nonpainting-signing-tags` |
| Recognition | Nine fields | Eighteen fields |
| Initials | Five; pages 1, 2, 3, 4, and 8 | Ten; two on each of pages 1, 2, 3, 4, and 8 |
| Signature | Four; pages 5, 6, 7, and 9 | Eight; two on each of pages 5, 6, 7, and 9 |
| Required setting | All nine show Required field, Value 1 | All eighteen show Required field, Value 1 |
| Marker appearance | No visible black marker strings | No visible black marker strings |
| Assigned signer | All fields default to the current account | All fields default to the current account |
| Fresh reopen | Nine fields, Draft, no Connecting or Syncing state | Eighteen fields, Draft, no Connecting or Syncing state |

Root inspected each field's actual properties. The Dual initials boxes do not expose their type text on the canvas.
Their individual properties confirm Initials; a canvas-text count alone would miss them. Every page has the expected two fields.
One fresh Single reopen initially showed Connecting and partial fields. A later read settled with all nine, without another upload or reload.
Both saved drafts remain at editing step 2 of 3. Neither Finalize document nor Review and send was selected.

Both recipient searches were checked with the approved synthetic addresses, one in each draft.
Each offered only **Create as new contact** for the new address. Root dismissed each search without saving a contact.
The [official recipient guide](https://support.pandadoc.com/en/articles/9714650-add-and-manage-recipients) describes this saved-contact step.
The existing approval explicitly excluded saved contacts. Intended Single and separate Dual recipient assignments therefore remain unverified.
Do not edit the current account's personal details as a workaround; that can update its saved contact.

The Single page 7 field rectangle reaches the last affidavit line area.
The Dual page 7 Signature rectangles overlap each other, and the upper rectangle reaches that area.
The text remains visible through the editor boxes. This is a placement risk, not proof that completed signed ink damages text.
Root and an independent Luna review agree that each box needs its own intended INSURED line, clear of text and other fields.
No field was moved or resized in this batch. Existing page 1 and 8 date-line intersections remain a separate printed-layout gate.
No completed signature appearance, legal sufficiency, real claim download, provider send, signed filing, or CMG status transition was tested.

One initial Single field click opened the provider's initials dialog. Root canceled before Accept and sign, without entering or accepting initials.
Later property checks selected field borders. No signature, initials, email, contact, finalization, purchase, deletion, or CMG write occurred.
No Git action, deployment, Production setting, or DNS record changed. Both revised-file upload approvals are now consumed.

Evidence remains in the session scratch folder:

- `cmg-pandadoc-single-revised-checks-2026-10-19.json` and `cmg-pandadoc-dual-revised-checks-2026-10-19.json` contain all field checks and reopen results.
- `cmg-pandadoc-single-revised-required-signature-2026-10-19.png` shows the required Signature setting.
- `cmg-pandadoc-dual-revised-recognition-2026-10-19.png` shows eighteen detected fields before placement.
- `cmg-pandadoc-single-revised-page7-placement-2026-10-19.png` and `cmg-pandadoc-dual-revised-page7-placement-2026-10-19.png` show the placement risks.
- `cmg-pandadoc-draft-recipient-contact-limit-2026-10-19.png` and `cmg-pandadoc-dual-contact-limit-2026-10-19.png` show the saved-contact requirement.
- `cmg-pandadoc-single-revised-saved-2026-10-19.png` and `cmg-pandadoc-dual-revised-persisted-2026-10-19.png` show retained Draft state.

At that checkpoint, the pending request covered two saved contacts, clearly named CMG Synthetic Signer 1 and CMG Synthetic Signer 2.
Use only `cmg-test-1@example.invalid` and `cmg-test-2@example.invalid` in the existing CMG workspace.
Then assign Single's nine fields to signer 1 and Dual's corresponding nine fields to each separate signer.
Correct only field rectangles in these two existing synthetic drafts, then recheck types, required settings, signer ownership, and placement.
Retain the contacts and all drafts. Exclude new uploads, finalization, email, signing, purchase, deletion, CMG writes, Git actions, and deployment.
Provider edits save automatically; recovery is another reviewed draft correction. No customer document or account needs to change.

#### Printed-value placement diagnosis only

Read-only review traced the known date intersections to `scripts/build-lor-tagged-pdfs.py` and the shared tag manifest.
The generator uses text baselines `d1=(464,55)` on page 1 and `d8=(455,30)` on page 8 in both variants.
It paints the raster page background first, then places tags at those positions. Prefill replaces their strings without moving the text matrix.
The retained Single renders confirm date glyphs crossing the printed rules. Page 1's policyholder value also crosses its rule.
Other printed fields need a measured full-value review before calling the layout accepted; a two-date-only repair would not establish that result.
The independent render review confirms page 1 policyholder and both dispatch-date crossings in both variants.
Page 1 carrier, policy, loss date, cause, fee, and property positions need measurement against their rules or divider.
The page 9 adjuster value also needs close measurement. Dates on pages 2–7 need baseline checks; no definite crossing is established there.
Other page 9 values appear below their rules without definite crossing in these renders. Do not classify every near-line value as defective without measurement.
No PDF, source, manifest, or bundled asset was changed during this diagnosis. No new draft was uploaded.
Any asset regeneration would affect the API path too and exceed the prior manual tag-color scope.
The owner then approved the precise local printed-value repair and its validation. No new branch or Git action is included.
The approved local extension keeps the current isolated repair branch and changes only measured data baselines in the generator.
Regenerate its manifest and both bundled variants together; preserve the source background, legal text, values, signer tags, and tag identity.
Use the actual manual prefill function to verify every printed value in both variants and compare all eighteen pages.
Run manifest/PDF agreement, prefill, error, three-mode, type, lint, unit, and build checks. Do not install a dependency or change a schema.
The risk is shared asset placement in both signing paths. Recovery is corrected local regeneration while all current source/output evidence remains retained.
No Production recovery is needed before release. New provider files would require separate exact upload approval after local checks.
No contact, upload, email, signature, hosted write, Git action, or deployment is included in the proposed local extension.
Implementation and available local checks are now complete, as recorded below. Earlier hashes describe the prior version, not the new layout.

#### Approved local printed-value repair: current result

The owner approved this local extension after the diagnosis. Only twelve data baselines change in each variant.
All horizontal positions, fonts, values, source background pixels, signer strings, signer coordinates, and checkbox positions remain unchanged.
The page 9 adjuster rule is the generator's replacement at y=480, not the original source rule at y=488.
Root checked that exception before adding its regression boundary. Correcting only the two dates would have left other confirmed crossings.

| Field | Page | Old y | New y |
|---|---:|---:|---:|
| ph | 1 | 550 | 558 |
| carrier, policy | 1 | 522 | 526 |
| property | 1 | 484 | 489 |
| lossdate | 1 | 443 | 446 |
| cause | 1 | 443 | 447 |
| fee | 1 | 316 | 320 |
| d1 | 1 | 55 | 59 |
| d6 | 6 | 677 | 678 |
| d7 | 7 | 420 | 418 |
| d8 | 8 | 30 | 36 |
| adjuster | 9 | 480 | 483 |

The new tests read actual decoded PDF text matrices and compare every tag against the manifest.
They also check twenty-two measured printed-rule regions, including valid below-rule fields that should not move.
The other three fields are the unchanged agreement checkboxes. Existing tests preserve values, black data fill, and exact invisible signing tags.
The first test collection hit the known sandbox EPERM rename restriction before assertions.
The same local command with required access then failed both layout cases, with twenty-four expected clearance failures.
After the manifest changed but before the PDFs changed, both new coordinate cases failed against stale assets.
After paired regeneration, all twenty-two focused tests pass. This proves both regression checks detect their intended failure.

The actual prefill function produced two new synthetic files. Only the server-only import guard was stubbed.
There was no network, Auth, database, provider, or audited claim-download call.
The original October 17 synthetic values and fixed dispatch date are unchanged.

| Current local file | Bytes | SHA-256 |
|---|---:|---|
| `CMG-SYNTHETIC-single-layout-fixed.pdf` | 2,106,754 | `fc93e94ecb12aee5ccb094d49d350beaf7da2b87e826d66f25094a626d2618cd` |
| `CMG-SYNTHETIC-dual-layout-fixed.pdf` | 2,106,876 | `5d3bda620316028e8be2139e84fbc6b3549c94a5123f50ac73fffe4f03ca6a0f` |

The folder is `cmg-manual-signing-layout-fixtures-v3` in session scratch. All older inputs, rejected outputs, approved v2 files, and provider drafts remain retained.
Restoring only the twelve y values makes every v3 content stream identical to v2, including strings, colors, fonts, and drawing operators.
All eighteen decoded background images and extracted page strings match v2 exactly.
At 144 dpi, every changed pixel falls within the union of the old and new data-glyph regions.
Root reviewed both contact sheets and every changed field area. Independent Luna visual review found no blocking collision on all eighteen pages.
The page 7 date clears its rule and the nearby parenthetical text. The adjuster value clears the replacement rule and label.
Independent source/test review found no Critical or Important defect. That reviewer did not independently render the files.
Poppler rendered all eighteen pages with exit zero. The existing Symbol and ArialUnicode display-font warnings remain in retained stderr logs.

Node 22.22.2 checks pass: `npm run type-check`, `npm run lint`, and the normal `npm run build`.
The build compiled in 12.2 seconds, completed TypeScript in 7.1 seconds, and generated all five static pages.
It used the public font network access, telemetry-off setting, and CI loopback placeholder values; no Production credential or deployment was used.
The focused prefill/action/site-mode selection passes 128 tests in each of simple, staff, and platform modes.
The fresh `npm test` run finishes with exit zero: 121 files and 1,686 tests pass; thirteen files and 56 tests skip.
Session 91028 ran for 280.18 seconds. The earlier 1,682-test result remains historical evidence for the prior layout.
Docker's Linux engine pipe is missing. No database-backed selection, reset, schema change, type generation, or Supabase backup ran.
Database/live coverage remains incomplete for this local revision. The hosted database and retained local stack remain unchanged.

Changed repository files are the generator, manifest, both bundled PDFs, the earlier manual-prefill source, and its new appearance/layout test.
The shared assets now change API upload bytes under the new local approval. API implementation, field mapping, and legal wording remain unchanged.
At that checkpoint, no Git action, deployment, new provider upload, contact, email, signature, or CMG write was approved or performed for v3.
Provider recognition and assignment results for v2 do not prove v3 acceptance. Exact new-file approval is required after final checks.
Evidence scripts: `check-manual-signing-layout.cjs` and `review-manual-signing-layout.py`; retained comparison: `review/comparison.json` in the v3 folder.

The owner subsequently approved the exact provider batch below, replacing the unanswered v2 contact and draft-correction request.
Upload exactly the two v3 files and hashes above as new unsent drafts. Check Single first and stop if recognition fails.
Create only the retained contacts CMG Synthetic Signer 1 and CMG Synthetic Signer 2 at the two approved synthetic addresses.
Assign Single's nine fields to signer 1. Assign Dual's corresponding nine fields to each separate signer.
Correct the new drafts' field rectangles, then check detection, required settings, ownership, placement, and persistence on all pages.
Provider uploads retain files and contacts; draft edits save automatically. Recovery uses another reviewed draft correction, with all earlier drafts retained.
This proposal excludes finalization, email, signatures, purchases, deletion, CMG writes, Git actions, deployment, and DNS changes.
The owner also separately approved the commit of only the six reviewed source, test, manifest, and asset files.
The five main-checkout records and all unrelated edits remain excluded from that proposed commit.
Final record checks pass: all thirty-one local Markdown references resolve, and both scoped Git whitespace checks return exit zero.
The pre-commit integrity check confirmed the six changed paths, no staged files, and both exact v3 fixture hashes and sizes.
The retained `cmg-pandadoc-before-v3-approval-2026-10-19.png` shows the older Dual draft and its current account recipient.
An idle reconnect warning cleared before that capture. No provider edit, reload, new upload, contact, or signature occurred.

#### Approved six-file commit and v3 provider batch

The owner approved the exact commit and provider batch in separate answers on October 19.
The first staging attempt could not write the protected Git index. The authorized access retry succeeded without changing the six-file scope.
Commit `56cff18e2e9f0e7f115dfd1d4b953ba7dad87e26` uses message `fix: hide manual signing tags and align PDF values`.
Its parent is exactly `1b7f7f98e54a358b3a95875483a63d3f882573a3`. Independent review confirms the six paths and a clean isolated checkout.
The source and both fixture hashes still match their verified values. No source changed after the passing local checks.
No push, PR, merge, deployment, or main-checkout record commit is approved or performed.
The current `npm audit --audit-level=high` check under Node 22 returns zero vulnerabilities with exit zero.
Its first sandbox attempt ended with `ENOTFOUND registry.npmjs.org`. The same read-only check with permitted registry access succeeded.
No package, lockfile, registry setting, or dependency changed during the audit.

Each exact v3 file was uploaded once. Single detection passed before Dual was uploaded.

| Variant | Unsent draft ID | Required fields | Types |
|---|---|---:|---|
| Single | `3Sh2wmDoV4Zziz4fpkDKx4` | 9 | Five Initials; four Signature |
| Dual | `K3TCRLokDjx6FC2WkYb4GX` | 18 | Ten Initials; eight Signature |

Both have initials on pages 1–4 and 8, and signatures on pages 5–7 and 9.
Each Single page has one field. Each Dual page has two fields. All twenty-seven actual property checks show Required field enabled.
Single page 1 was checked before the evidence helper; its JSON has no field ID. Its other eight IDs are unique.
All eighteen Dual field IDs and UI field UUIDs are unique. Expected H1/H2 labels in the JSON describe intended roles, not verified assignments.

PandaDoc automatically adds the current account when placing fields. All fields still belong to that account.
The approved contact form used only `cmg-test-1@example.invalid`, first name `CMG Synthetic`, and last name `Signer 1`.
PandaDoc shows “Please ensure domain is correct.” and disables Save. Root canceled the form without saving or changing the address.
Contact 2 was not attempted. No contact, test recipient, or intended separate signer assignment exists from this batch.
Do not bypass the domain check or substitute another address without exact approval.

Root resized and moved only the three page 7 signature rectangles: one Single and two Dual.
Each sits on its intended INSURED rule, clear of the affidavit text, labels, other box, date line, and parenthetical text.
Single's provider navigation reopened the saved document. Dual was explicitly reloaded after its saving indicators cleared.
Both reopens retain nine and eighteen fields and the corrected boxes. All three edited fields still show Required enabled afterward.
The final views are Draft, without Saving, Syncing, or Connecting state. Both editor zoom values are restored to 100 percent.
An independent Luna review confirms the saved page 7 geometry and the evidence limits. Completed signed ink and legal acceptance remain untested.

An early property helper read an accessibility diff as a complete state and refused to record a result.
The helper was corrected to request the complete visible property state. Required/type checks then passed; no application check was bypassed.
A saved-draft navigation briefly showed Connecting. Root waited on the same tab and did not create another upload.
Each new provider tab captures seventeen warnings and zero errors. Warnings name shared module version mismatches and DOM snapshot depth.
These are provider-page observations, not a clean-console claim. Full network traces remain unverified; no CMG dependency was changed for provider warnings.

Retained evidence in session scratch:

- `cmg-v3-single-checks-2026-10-19.json` and `cmg-v3-dual-checks-2026-10-19.json` contain field checks and reopen results.
- `cmg-v3-single-recognition-2026-10-19.png` and `cmg-v3-dual-recognition-2026-10-19.png` show nine and eighteen recognized fields.
- `cmg-v3-single-page7-saved-2026-10-19.png` and `cmg-v3-dual-page7-saved-2026-10-19.png` show the saved corrections.
- `cmg-v3-synthetic-contact-domain-refusal-2026-10-19.png` shows the rejected address and disabled Save button.
- Per-field `cmg-v3-*-required-*.png` images retain the property checks, including the three post-correction checks.
- `cmg-v3-provider-console-summary-2026-10-19.json` contains counts and sanitized warning text, without credential or full-URL output.

The owner then approved the exact usable test addresses and assignment only in these existing v3 drafts.
Do not upload the PDFs again. Use page positions with UI field UUIDs; the original Dual page 7 expected-role order is not authoritative.
The account may change only to draft CC under that approval. Saved account and contact details must remain unchanged.
Contact retention and recipient changes are material external writes. Recovery uses a reviewed draft correction, with all drafts retained.
The later advance engineering approval covers the exact `56cff18` push and its draft PR, both now complete as PR #25.
The push starts an automatic Preview; the draft PR starts CI. Its current results are recorded below.
A separately approved draft PR targeting develop will start the required CI checks.
The proposed PR title is `fix: hide manual signing tags and align PDF values`. It includes only the six reviewed files.
The description will state the 1,686 unit passes, 56 skips, local checks, provider draft evidence, and remaining end-to-end acceptance gates.
These next proposals exclude finalization, email, signatures, purchases, deletion, CMG database writes, Production changes, and DNS changes.
The current batch changed only approved PandaDoc drafts and the approved local Git commit. Older drafts, original fixtures, and unrelated edits remain intact.

### Approved Gmail contact and assignment continuation — October 19

The owner approved CMG Synthetic Signer 1 at `4miodio@gmail.com` and CMG Synthetic Signer 2 at `robspeciale@gmail.com`.
Exact search found no existing signer 1 contact. Root created that contact once and reused it in Dual without changing saved details.
Single now assigns all nine fields to signer 1: five initials and four signatures. The current account becomes CC automatically.
Root selected all nine Single fields and read Required field as checked. A saved reload retains nine assignments and the CC role.

Dual now assigns nine left/upper fields to signer 1. Its nine right/lower fields still belong to the current account.
The assigned nine-field group remains required. A saved reload retains all eighteen fields, the nine/nine split, and the page 7 corrections.
Page 7 uses upper INSURED for H1 and lower INSURED for H2. Its original expected-role array does not match the corrected position order.
The new assignment evidence records that position mapping explicitly. No field box moved during this contact/assignment continuation.
The prior full per-field Required checks remain recorded; only the newly assigned nine-field groups were rechecked in this continuation.

Adding another Dual recipient opens the provider's actual plan dialog. It permits two recipients per document and counts the current account.
Root dismissed the dialog without purchase or plan change. Signer 2 is not created. The account remains a Dual signer with nine fields.
The recipient menu offers Replace recipient. Root only inspected that menu and made no replacement.
The proposed next action replaces only the current account's Dual draft recipient entry with signer 2, within the two-recipient limit.
This needs separate approval because the earlier current-account scope permitted only changing its draft role to CC.
It must not delete a saved contact or account, change saved personal details, or buy an upgrade.
After approval, verify nine fields per test signer, required states, correct positions, and persistence. Keep both drafts unsent.

New session-scratch evidence:

- `cmg-v3-contact-assignment-2026-10-19.json` records saved field ownership, page/type mapping, required-group checks, and the incomplete Dual assignment.
- `cmg-v3-single-assignment-saved-2026-10-19.png` shows signer 1 and the current account's saved CC role.
- `cmg-v3-dual-partial-assignment-2026-10-19.png` shows separate upper/lower page 7 fields and both current recipients.
- `cmg-v3-dual-recipient-limit-2026-10-19.png` shows the two-recipient plan limit and purchase dialog.

At that checkpoint, both drafts remained Draft after their saved reloads. No send, signature, new upload, purchase, deletion, CMG data, Production, or DNS write occurred.
Both editor views were restored to 100 percent. Independent evidence review confirmed the assignment counts, page 7 position mapping, and actual plan limit.
That checkpoint did not establish fresh post-assignment Required checks for all eighteen Dual fields. Full network traces remain unverified.
Commit `56cff18` remained local at that checkpoint. The later approved publication is complete in draft PR #25; do not request it again.

### Approved Dual recipient replacement — October 19

The owner approved replacing only Collin Graham's recipient entry in Dual draft `K3TCRLokDjx6FC2WkYb4GX` with CMG Synthetic Signer 2.
The approved email is `robspeciale@gmail.com`. Exact search found no saved match, so root created that contact once.
Root used **Replace recipient**, not **Edit personal details**. **Keep Collin Graham as CC** stayed unchecked to retain two recipients.
The confirmation warns that replacement has no Undo. Recovery uses a reviewed draft correction, not an unverified immediate restore.
The provider confirms that CMG Synthetic Signer 2 replaced Collin as a signer. No saved account or existing contact details changed.

Exactly nine right/lower fields transferred to signer 2. All nine left/upper signer 1 assignments stayed unchanged.
Each signer has five initials and four signatures, with one field per signer on pages 1 through 9.
Root opened all eighteen individual property panels after replacement. Required, type, and actual assignee checks all pass.
All field IDs remain captured. The type and style comparison confirms no field position or size change.
Independent read-only review confirms the eighteen checks, exact nine-assignment change, and unchanged signer 1 fields.

After the draft settled, root reloaded the same document. It reopened as Draft, without Saving, Syncing, Connecting, or Reconnecting state.
All eighteen UI UUIDs, types, assignments, positions, and sizes match the pre-reload result. The current account has no remaining fields or recipient entry.
The required checks ran before that saved reload; the subsequent comparison verifies field identity, assignment, type, and geometry persistence.
The page 7 saved view shows H1 on the upper INSURED line and H2 on the lower line, with clear text and separate boxes.
Dual zoom is restored to 100 percent after proof capture. Single remains unchanged from its saved nine-field assignment and current-account CC result.

New session-scratch evidence:

- `cmg-v3-dual-replacement-checks-2026-10-19.json` records all eighteen property checks, exact replacement differences, and the saved-reload field comparison.
- `cmg-v3-dual-final-required-1-2026-10-19.png` through `cmg-v3-dual-final-required-18-2026-10-19.png` retain individual property-panel proof.
- `cmg-v3-dual-two-signers-saved-2026-10-19.png` shows both approved test signers and the saved page 7 fields.

Synthetic draft recognition, required settings, separate assignments, placement, and persistence pass for the two retained v3 drafts.
This does not prove legal acceptance, a real claim's Preview download, completed signatures, signed-file filing, claim status, or role access.
The next provider gate needs legal review and exact approval for the real claim, document, signers, and destination.
Sending, CMG sent-state recording, signed-file storage, status changes, and notifications need their separate hosted-write approvals.
Do not re-upload either synthetic PDF. Keep all drafts and contacts. No send, signature, purchase, saved-contact deletion, CMG data, Production, DNS, or Git write occurred.
The later advance approval answers both `56cff18` Git questions. Its push and draft PR #25 are complete.
Local Docker checks skipped, but PR #25 CI now passes the database job. The live provider test still skips.

### Current independent GitHub check

The October 19 Luna read-only check confirms `develop` remains `1b7f7f98e54a358b3a95875483a63d3f882573a3`.
GitHub compare reports identical, zero ahead and behind, and no changed files against the earlier reviewed head.
PR #23 remains open and draft at `15ea5f6`; PR #24 remains open and draft at `e142f5f`. Both target unchanged `develop`.
The latest CI runs and Vercel statuses succeed. Submitted reviews and inline review threads remain empty.
CodeRabbit success is not proof of a submitted review; the earlier draft-skip limitation remains.
The agent's CLI connection failed; connected GitHub read-only APIs supplied the successful snapshot. No remote state changed.

The later October 19 read again confirms unchanged develop and PR #19, #23, and #24 heads, with successful current CI and deployment statuses.
No new submitted review finding or conversation appeared. PR #19's old hydration finding is already covered by POST and readiness guards in develop.
The owner then approved closing only superseded PR #19, without merge or branch deletion.
The GitHub update changed only its state. A fresh read verifies `closed`, `merged=false`, and closed time `2026-10-19T22:24:27Z`.
Its title, body, base, branch name, and head SHA remain unchanged. No other PR, branch, deployment, DNS, or CMG data changed.

### Local private-verifier coverage

The authorized Luna review found no focused test for `verifyPrivateUploadFiles` in the combined security checkout.
The new local `src/lib/private-upload/verified-files.test.ts` tests the real signature checker and Storage range reader together.
Only fetch, Storage metadata/copy, and Supabase proof operations are stubbed. Unexpected fetches throw; globals and environment are restored after each test.
Fifteen focused tests pass under Node 22.22.2. Project type checking also passes.
They cover a valid PDF signature, staged/permanent metadata mismatch, bad bytes, missing destination identity/version, unavailable Storage, and invalid range responses.
They also cover a lost copy response, refused proof persistence, and reuse of a stored proof on retry.
These tests do not use a real Storage service or prove hosted failure behavior.
The first test draft mocked the signature helper and range reader. Root review rejected that evidence; the agent replaced those mocks with real helpers.
Type checking also found a fixture type error. The corrected file passed the focused suite and type check afterward.
The default temporary directory caused rename errors. The successful tests used the approved session scratch directory for process-local temporary files.
A separate Luna review found no blocking issue in the final file. Production source, SQL, dependencies, and the old scan-report edit remain unchanged.
The broader full-unit run passed: 124 files and 1,732 tests passed; 14 files and 57 database/live tests skipped.
It took 707.49 seconds. The existing process was observed until exit 0; no duplicate run was started.
Full lint also passed with exit 0. These local results include the new fifteen-test file, which is not committed or CI-covered.
No new test or report commit, push, CI run, or deployment is approved.

The next bounded local review found missing checks for unsafe verification URLs and accepted writes without persisted proof.
Eight cases now extend the same test file: foreign origin, embedded credentials, wrong object path, missing readback, and four malformed-proof variants.
All twenty-three focused cases pass in 5.16 seconds. Fresh type check and full lint pass with exit zero.
Independent review found no blocking issue. Tests use the real URL guard, signature checker, and range reader, with mocked service calls and restored globals.
Application code, SQL, dependencies, the existing scan-report edit, and all hosted systems stay unchanged.
The same broader full-unit process, handle `22567`, completed with exit zero. Root observed it through quiet polls without starting a duplicate.
All 124 test files and 1,740 tests pass; fourteen files and 57 database/live tests skip. The run took 710.64 seconds.
Its full log and exit record use `cmg-private-verifier-full-unit-2026-10-19.log` and `.exit` in session scratch.
The new test file SHA-256 is `2d00e93145c52d2cc172cbb7164bf1db0bb05d1c48e0eb739ad8dd5f701154b7`.
No application code changed, so the prior normal build remains applicable. No build, browser, or database check was repeated for test-only edits.
The owner then approved only the one-file local test commit, with message `test: cover private upload verification boundaries`.
Commit `ff55bbfc615be027911535e2aae72e71ce38faa2` contains 279 added lines in `src/lib/private-upload/verified-files.test.ts` and no other path.
Its parent is `e142f5f875650f8d9ffa06c6d7fdc6fea9934161`. The staged whitespace check passed before the approved commit.
Independent post-commit checks confirm the parent, exact path, empty index, and tested file hash. Only the pre-existing scan-report edit remains unstaged.
The owner's later advance approval authorizes the exact feature push and reviewed task fixes, commits, pushes, and draft PRs.
Both original commits are now published. The following current record supersedes the earlier pending Git questions.

### Approved feature publication and CI repair on October 19

Exact signed `ff55bbfc615be027911535e2aae72e71ce38faa2` is published to `origin/codex/security-upload-session-checks`.
Exact signed `56cff18e2e9f0e7f115dfd1d4b953ba7dad87e26` is published to `origin/bugfix/manual-signing-tag-visibility`.
GitHub reports both original signatures as verified, reason `valid`. No commit was recreated with different bytes.
The native SSH attempt failed authentication before changing any branch. The crashing HTTPS Git helper was not used.
Publication used authenticated GitHub API object uploads, with exact blob/tree/commit hash and signature checks before a non-force ref update.
The preflight checks limited the repository, branch, expected parent, and approved paths. No private SSH store, remote configuration, or permission changed.
Draft [PR #25](https://github.com/rspeciale0519/cmg/pull/25) targets `develop`, with one commit and exactly the six reviewed PDF files.
It and existing PR #24 are attached to this task. Neither PR is merged or marked ready for review.

PDF CI run [39349972823](https://github.com/rspeciale0519/cmg/actions/runs/39349972823) passes both jobs.
Type check, lint, build, and a zero-vulnerability dependency audit pass.
Unit tests pass 121 files and 1,686 tests; 13 files and 56 database/live tests skip.
The database job passes 44 pgTAP files and 1,350 assertions, then 35 Vitest files and 253 tests.
One opt-in live PandaDoc file/test skips. These checks do not prove completed signing or legal acceptance.
Automatic Preview `dpl_Eko5QAw2p5ADdFDEicMZuNVz5wU2` is Ready at `cmgps-239ch8hei-robs-projects-c72886ba.vercel.app`.

Security CI run [39349917391](https://github.com/rspeciale0519/cmg/actions/runs/39349917391) passes its database job.
It passes 44 pgTAP files and 1,350 assertions, then 34 Vitest files and 243 tests; one live PandaDoc test skips.
Audit, type check, and lint pass. The full unit step has 1,739 passes, one failure, and 57 skips; build is skipped.
The single failure is the five-second timeout in `file-signatures.test.ts`, for the full 25 MiB DOCX allowance.
Its test fixture calculates CRC with about 210 million JavaScript bit iterations before the bounded-read assertion.
A measured 25 MiB checksum takes 1,694.4ms in that helper and 9.9ms in Node's native CRC function, with equal results.
Empty, standard `123456789`, 1 MB, and 25 MiB vector comparisons agree. Node added `zlib.crc32` in 22.2.0, within the project's engine range.
The repair only imports native `crc32` and removes the test helper. It changes no assertion, timeout, fixture structure, runtime code, SQL, or dependency.
The 78 focused tests pass in 703ms total, with 121ms test time. Type check and full lint pass.
The full local suite passes 124 files and 1,740 tests, with 14 files and 57 tests skipped, in 431.73 seconds.
Independent review finds no blocking issue. Signed commit `d523469e88149c76b8181ed4f277d757f608f47c` contains only this one test-file repair.
It is published over `ff55bbf` to PR #24 with original signature verified. CI run `39351780332` passes both jobs at that exact head.
Verify passes type check, lint, build, and a zero-vulnerability audit. Unit passes 124 files and 1,740 tests; 14 files and 57 tests skip.
CI unit duration is 74.68 seconds. The build compiles in 15.4 seconds.
Database passes 44 pgTAP files and 1,350 assertions, then 34 Vitest files and 243 tests, with one live PandaDoc test skipped.
The database Vitest duration is 24.80 seconds. No failed workflow was rerun; the changed commit starts its own CI.
Automatic Preview `dpl_3HYMqaJ4UicNYTR47GfUmoeyGi3s` is Ready at `cmgps-ibczas125-robs-projects-c72886ba.vercel.app`.
Vercel inspection confirms project `cmgps`, target Preview, Ready state, and the existing stable branch alias.
GitHub's status for exact `d523469` associates that deployment with the tested head. The CLI summary does not expose Git metadata.
The original scan report remains unstaged. Main-checkout edits, Production, DNS, and hosted data are not included in these pushes.
CodeRabbit skipped automatic review of draft PRs. Its green status is not a submitted review.

### Approved hosted invalid-file refusal on October 19

The owner approved one nine-byte `cmg-invalid-signature-20261019.pdf`, containing exactly `FAKE-PDF!`, on PR #24 claim 0005.
The normal owner form selects Other and CMG only. The file chooser selects the exact file, confirmed by native input value and screenshot.
The accessibility tree omits the native filename, but this is not an empty file selection.
One Add to the file click starts the upload. The page returns: "This upload session has ended. Check the details and submit again."
No retry is authorized or attempted. Reload clears selection and preserves the earlier single document, without the invalid filename.
Captured browser warning/error logs are empty. Full network request traces remain unavailable.

Read-only dashboard table filters confirm session `c68baab2-61f4-4864-bd22-8049f9ecaf94`, created October 20 at 00:54:57.319759 UTC.
It is `cancelled`, has one file, and has null result and completion time.
The child file has the exact name, `other`, `internal`, `application/pdf`, nine bytes, and null verification.
Its copy started at 00:54:59.907755 UTC. The exact permanent path has zero matching document rows.
Both objects exist in private bucket `claim-docs`, each with nine-byte Storage metadata:

- Staging: `private-upload/c68baab2-61f4-4864-bd22-8049f9ecaf94/4ca20785-7d0f-4141-bdb7-c87579c2f25d.pdf`.
- Unaccepted copy: `claims/153a2250-297d-4b81-ab20-65da3b590852/214a044b-7bde-4430-9bd7-1b1e0d1eb11d.pdf`.

Cleanup eligibility is October 20 at 03:09:57.319759 UTC, or October 19 at 11:09:57 PM EDT.
At the time of this read, removal after normal cleanup remained unverified. The current section above confirms the later cleanup state; scheduler attribution remains unverified. No cron, retry, manual cleanup, deletion, or compensating write ran during this earlier read.
The outbox has zero rows created since 00:37 UTC, covering both the Partner note and this upload test.
No SQL snippet was saved. Only dashboard read filters were used for this independent check.
Evidence: `pr24-invalid-file-ui-2026-10-19.json`, `pr24-invalid-file-db-read-2026-10-19.json`, and `pr24-note-invalid-file-outbox-read-2026-10-19.json`.
Proof images: `pr24-invalid-file-refused-2026-10-19.png`, `pr24-invalid-file-session-cancelled-2026-10-19.png`, and `pr24-invalid-file-no-document-2026-10-19.png`.
The batch changed only its approved synthetic upload/session/rate records and two objects. No document, email, status, access, Production setting, or DNS change occurred.

### Current operations evidence and limits

See the current October 24 Production schedule and bounded-log evidence above.
No cron endpoint was invoked during that bounded historical read.


The available log window is limited. It does not prove a complete retention window or accepted retry delay.
The owner restored the correct CMG Supabase session. The latest read-only query supersedes the earlier access blocker.
All 36 hosted migration versions match source. The stored `20260927120000` SQL, after removing carriage returns, hashes to `9d133c55183b362c98abbf3c547600c8611b9dcb549e4b54abf5ecce01701ce6`, matching source.
The migration viewer adds a final empty statement separator; its body matches after line-ending normalization.
`notifications_outbox` contains 24 sent and 11 dead rows, with zero pending or failed rows. Cleanup has zero unprocessed or retried-unprocessed rows.
The query used `begin read only` and `rollback`. No saved snippet, cron call, retry, cleanup execution, or hosted data write occurred.
Proof: `cmg-hosted-readonly-2026-10-17.jpg` in the session visualization folder.

### Earlier engineering evidence

The following records retain their original commit, environment, and date limits.
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
The reviewed staging held 53 files and no unstaged tracked changes.
The owner separately approved committing that candidate on 2026-10-05.
Commit `9a80e090f3badd86ff046f0252d00f3d3f77932e` has message `fix: integrate launch safeguards`.
Its tree matches the approved staging. The candidate worktree is clean, and the original branches remain unchanged.
The owner separately approved the push. SSH push to `origin/bugfix/launch-integration` succeeded.
GitHub independently confirmed remote SHA `9a80e090f3badd86ff046f0252d00f3d3f77932e`.
Its automatic Vercel Preview `dpl_FaYzi5PwFn1TTCcuGUewXE67rjim` failed during Inter font compilation.
Read-only CLI logs confirm Next.js 16.3.8 and restoration of Production cache `AcDgdsGubFaSGLvUoVRU8Wax54nZ`.
The build failed with 28 font-resolution errors and `next/font/google queries have exactly one entry`.
The committed layout and Next.js configuration have no diff from `develop` at `2fdf6bd`; local build evidence remains passed.
The owner approved one cache-free Preview rebuild of `9a80e09` on 2026-10-13.
The Vercel form showed Preview, the original source, and unchecked **Use existing Build Cache**.
One submission created `dpl_C2UqHb6rSJbXZ9bpQWNTRHyfqRHV`; no second rebuild was submitted.
CLI project inspection confirmed `robs-projects-c72886ba/cmgps` before deployment inspection.
CLI inspection and browser status both report Ready.
Build logs confirm `9a80e09`, `Skipping build cache, deployment was triggered without cache.`, Next.js 16.3.8, successful compilation, and completed deployment.
The ready deployment uses `cmgps-git-bugfix-launch-integration-robs-projects-c72886ba.vercel.app` and deployment URL `cmgps-jub1jpwi0-robs-projects-c72886ba.vercel.app`.
The public root renders. Its computed body font family names Inter, and its font set reports loaded; no individual font faces were exposed by the inspection.
No console warning or error was captured. Full network tracing and private acceptance remain unverified.
Proof: `C:/Users/rob/.codex/visualizations/2026/08/30/01a05474-d495-7123-b74b-29a8631befca/launch-integration-preview-ready-2026-10-13.png`.
The clean rebuild passed without code changes. Cache incompatibility remains a supported hypothesis, not an isolated root cause.
Vercel's connector denied scope access; the existing CLI login supplied logs without exposing credentials.
The browser independently showed the failed Preview, branch, and commit. DOM inspection timed out; its screenshot succeeded.
The earlier automatic approval rejection is settled by the owner's exact rebuild approval.
No source repair, PR change, merge, Production setting, DNS record, database write, or backup ran during this task.
Read-only CLI inspection now resolves the public Production alias to ready deployment `dpl_3UAUKnaYdUPv78pAAQUXZa4CJYaF`.
Its source commit is absent from the CLI summary. This differs from the older recorded deployment and needs release preflight verification.
The shared project board's T03 also records a newer `develop` dependency repair. No integration update was made here.
The push did not start combined GitHub Actions; branch triggers cover only `develop` and `main`.
These post-commit facts are recorded in the main worktree; no unapproved amend or second commit was created.

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
