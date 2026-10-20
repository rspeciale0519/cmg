# Release state — CMG Property Solutions

Reconciled 2026-10-20. Rewrite this file in place. Keep exact test evidence in HANDOFF.

Use [HANDOFF.md](temp/HANDOFF.md) for engineering evidence.
Use [BLOCKERS.md](temp/BLOCKERS.md) for owner decisions.
Use [LAUNCH_CHECKLIST.md](temp/LAUNCH_CHECKLIST.md) for unfinished launch requirements.
Use [README.md](../README.md#simple-mode-production-runbook) for release procedures.

## Current code and Production

| Item | Verified state |
|---|---|
| Integration branch | GitHub `develop` is `1b7f7f98e54a358b3a95875483a63d3f882573a3`. Its code tree matches the previously verified v2 commit `df6a99a`. The existing v2 checkout now holds the separately approved local security branch. |
| Combined fixes | PR #22 merged the private direct-to-Storage uploads, partner counts, hydration protection, and admin retry repairs. No further merge of the older candidate is needed. |
| Production | `app.cmgpropertysolutions.net` resolves to ready deployment `dpl_3UAUKnaYdUPv78pAAQUXZa4CJYaF`. GitHub associates that deployment with the current `develop` commit. |
| Site mode | The owner's recorded activation was `platform` on 2026-10-07. Current unauthenticated `/portal` and `/partner` requests redirect to `/login`, rather than `/platform-disabled`. No environment value was changed in this review. |
| Preview | PR #24 is Ready at exact `d523469`, as `dpl_3HYMqaJ4UicNYTR47GfUmoeyGi3s`. Its approved branch overrides remain unchanged. PR #25's automatic Preview is also Ready. PR #23's earlier rebuild remains unchanged. |
| Database | Hosted history matches all 36 source versions through `20260927120000`; the stored head SQL hash matches source. The earlier two accepted upload sessions and eleven processed cleanup rows remain retained. The invalid-file session is cancelled; its two nine-byte objects are now absent, and cleanup rows 12 and 13 processed. No migration was reapplied. |
| Recovery | No Supabase backup. Use reviewed forward repair. Immediate restoration is unverified; forward repair cannot recover lost data. |

No Production deployment, DNS record, or email changed during this review.
One later empty-file check spent a shared hosted rate-limit attempt; its exact effect is recorded below.
The owner-approved PR #23 Preview setup changed four branch overrides and added one Turnstile hostname.
The later separately approved PR #24 setup added four overrides only for `codex/security-upload-session-checks` and one more hostname.
All seven prior widget hostnames remain; the widget now has eight. Managed mode and no pre-clearance remain unchanged.
The older `bugfix/launch-integration` at `9a80e09` remains untouched.
Its approved cache-free Preview rebuild passed on 2026-10-13; that branch is superseded by the merged v2 work.
The main checkout has unrelated dirty files. They remain unstaged and preserved.

## Pull requests

| PR | Current GitHub state |
|---|---|
| #18 | Closed without merge; its count fix is included in #22. |
| #19 | Closed without merge on October 19 under separate owner approval. Its upload fixes are included in #22. Its branch remains retained. |
| #20 | Merged; password visibility and the existing-account invite hint are in `develop`. |
| #21 | Merged; the dependency repair is in `develop`. |
| #22 | Merged; both PR and post-merge CI jobs passed. Its Preview and Production deployment checks passed. |
| #23 | Open and draft at `15ea5f6a5d21a9b66bef84e8f61d24d3a1a5e26c`. Security fixes have green verify/database jobs. Its one approved Preview rebuild is Ready. No submitted GitHub review, merge approval, or Production release approval exists. |
| #24 | Open and draft at `d523469e88149c76b8181ed4f277d757f608f47c`, targeting `develop`, with 21 changed files. CI run `39351780332` passes both jobs after the test-fixture repair. The automatic Preview is Ready. No remote merge or Production approval exists. |
| #25 | Open and draft at `56cff18e2e9f0e7f115dfd1d4b953ba7dad87e26`, targeting `develop`. It contains only the six reviewed PDF files. CI run `39349972823` passes both jobs. Its automatic Preview is Ready; real signing and legal acceptance remain open. |

PR #22's review suggestion to replace `retry()` with `unstable_retry()` conflicts with the installed Next.js 16.3.8 implementation, types, and documentation.
Keep `retry()`; no source change was made for that comment.

## Security and verification

The current `develop` redirect sanitizer accepts three tested control-character paths that resolve to a different origin.
An isolated in-memory test of the actual functions reproduced this without HTTP requests or account data.
PR #23 refuses all six unsafe inputs and preserves all three valid inputs in that comparison.
Its remaining changes sanitize download filenames, limit recovery confirmations, and reduce Server Action bodies to 2 MB.
The active upload forms send bytes directly to Storage; the smaller action cap does not reduce their 25 MiB file limit.
Review found no confirmed blocking defect in the four changed behaviors. Exact recovery-counter runtime proof now passes on the disposable database.
The real PR #23 handler and limiter allowed ten calls to stubbed Auth, refused attempts eleven and twelve, and kept separate IP budgets.
Five malformed queries spent no budget. An RPC failure refused access. The simple, staff, and platform gates passed.
The SQL function used a 900-second fixed window. The transaction rolled back, restoring the entire rate-table fingerprint.
Auth and unused account clients were stubbed. This did not contact hosted Auth or prove hosted request behavior.
The original PR #23 scan recorded two further tasks: legacy upload file-content checks and the password-change session policy.
PR #23 alone lacks those checks. The combined PR #24 fixes both items, as described below.
The owner approved local branch `codex/security-upload-session-checks` from current `develop` and both fixes.
Both legacy actions now check every file's bytes before cleanup intents, Storage writes, or document inserts.
Homeowner password changes request global sign-out and return to login after success.
An audit transport failure cannot skip sign-out. A sign-out failure reports that the password changed without claiming full revocation.
Existing access tokens can remain valid until expiry. No live account or session was changed.
Focused upload/signature/rollback checks passed: three files, 102 tests. Portal/reset checks passed 58 tests after the audit-order repair.
Final type check, lint, and build passed. Nine three-mode HTTP checks and both local notice layouts passed.
The full suite passed 121 files and 1,688 tests; 13 files and 56 database or live-service tests skipped.
The owner approved one reset of `CMGPA_private_upload_disposable` only. It applied all 36 migrations and exited zero.
All 44 pgTAP files and 1,350 assertions passed. The CI database selection passed 243 tests across 34 files; one live PandaDoc test skipped.
A separate real-action test confirmed caller sign-out, second-session refresh refusal, old-password refusal, new-password sign-in, and the audit record.
Its synthetic user, audit row, and rate-limit row were removed. No real account was changed.
The owner approved the eight-file local commit. Commit `abc44990eebf3a309ac4bf3eeefc859c601a2604` contains exactly those files.
The approved push created `origin/codex/security-upload-session-checks`. GitHub confirms the exact commit.
The approved draft PR is #24. Its first remote source was `abc4499`; the later approved merge and push are recorded below.
Both required CI jobs passed. Verify passed 1,688 tests, type check, lint, build, and the zero-vulnerability dependency audit.
CI skipped 57 database or live-service unit tests. Database CI passed 1,350 pgTAP assertions and 243 integration tests; one live PandaDoc test skipped.
Its automatic Preview is Ready as `dpl_3hYgFtpsYNxV6FhxoCy6jCQmfcu5`.
That Preview still closes login and portal routes with 307 to `/platform-disabled`; no branch setting was changed.
The owner approved local integration of exact PR #23 commit `15ea5f6`, without a commit.
The merge completed without conflicts. Before the approved commit, its index contained thirteen reviewed files over `abc4499`.
Independent review found that old stored filenames bypass the new upload sanitizer when download links are created.
Both download actions now sanitize the signing parameter and returned filename. Original stored names remain unchanged in audit records.
Four new regression cases failed before repair. All 55 focused tests, type check, lint, and independent repair review now pass.
The combined full unit run passed 122 files and 1,710 tests; 14 files and 57 database/live tests skipped.
The database rerun passed 35 files and 244 tests, including the real password-session test. One live PandaDoc test skipped.
The first database run failed during fixture setup. Its exact incomplete fixture was removed before the complete rerun.
Final disposable counts show zero synthetic claims, password users, password-change audits, and password-rate rows.
The first default builds stopped in a compiler child process. Webpack passed diagnostically; the default build passed after generated-cache removal.
The exact cache fault remains unproved. No compiler setting, test threshold, or source dependency changed.
Built HTTP checks then exposed the global header rule replacing recovery's `no-referrer` policy.
A specific `/auth/confirm` rule now preserves it. Seven framework-backed cases cover the route, query string, and ordinary pages.
Two cases failed before repair. All 45 header, recovery, and CSP tests passed afterward; independent review found no defect.
The 1,710-test run predates only this header rule and its new test. No other unit file imports the changed configuration.
Final type check, full lint, and the default build passed. Eighteen HTTP checks passed across simple, staff, and platform modes.
The final built recovery redirects use `no-store` and `no-referrer`. Ordinary pages keep their prior header policy.
Both local notice layouts and the empty password control passed. Hosted data, account sessions, and Production remain unchanged.
The owner separately approved the thirteen-file merge commit and its exact push.
Commit `e142f5f875650f8d9ffa06c6d7fdc6fea9934161` has parents `abc4499` and `15ea5f6`. Its worktree was clean after the push.
GitHub confirms this exact branch and PR #24 head. No main-checkout record or unrelated edit is included.
Both jobs passed in CI run `39075681448`: 1,717 unit tests, 1,350 pgTAP assertions, and 243 selected database tests.
Type check, lint, build, and the zero-vulnerability audit passed. Unit skipped 57 database/live tests; DB selection skipped one live PandaDoc test.
The real password-session test remains covered by the earlier approved disposable run; the CI selection does not include it.
The new Preview is Ready as `dpl_rR3wMH8skJdjiaXcNe6btRM642Ka`, built in 38 seconds.
Its unique host is `cmgps-87anq7c0s-robs-projects-c72886ba.vercel.app`; its stable branch alias is unchanged.
Seven HTTP checks pass with CSP and HSTS. The closed `/auth/confirm` response also preserves `no-referrer`, without a token or Auth request.
This does not prove the enabled hosted recovery flow. The public root renders at 1280px without overflow or broken completed images.
Captured browser warnings/errors are empty. Login, recovery, admin, homeowner, and vendor routes still redirect to `/platform-disabled`.
Vercel uses Node 22 from `package.json`; the build warns that this overrides the project's Node 24 setting. No setting was changed.
The owner then separately approved PR #24's branch-only setup and one redeployment. Both are complete.
The four exact overrides are `SITE_MODE=platform`, its stable branch `NEXT_PUBLIC_SITE_URL`, and empty PandaDoc API/webhook keys.
Individual reads verified the new values and their single Preview branch scope. All 24 pre-existing environment records match their original hashes.
Only the missing stable branch hostname was added to the existing CMG widget. All seven earlier hosts remain.
The one redeploy is Ready as `dpl_8ykWz4ujjgeq1s3ojzBP1ADjSQJY` at `e142f5f`, in 51 seconds.
Its unique URL is `https://cmgps-4ldox31ib-robs-projects-c72886ba.vercel.app`; the stable branch alias is unchanged.
Eight current HTTP checks pass. Login and recovery return 200; unauthenticated admin, homeowner, and vendor routes redirect to login.
Token-free recovery returns the generic 303 expired-link notice with `no-store` and `no-referrer`, before rate limits or Auth calls.
The recovery widget completes automatically at 1280px and 390px, without submission. Both login-notice layouts and the empty password toggle pass.
Captured application-origin warning/error logs are empty; eight opaque Cloudflare-frame entries remain. Full browser request traces are unverified.
Production still resolves to `dpl_3UAUKnaYdUPv78pAAQUXZa4CJYaF`. No DNS or database data changed.
Owner sign-in and MFA on this Preview are complete. Settings confirms Manual signing, bundled PDF, unset webhook, and zero waiting notifications.
The owner-only Recheck action showed Checking, then returned a fresh successful probe. It performs reads and cache invalidation, without a data write.
Settings and the synthetic claim document controls fit measured 1280px and 390px widths. No file was selected, uploaded, or downloaded.
Owner requests for `/portal` and `/partner` return to `/admin`. Current owner checks captured no warning or error.
An empty-file submission returned the expected file error and left four documents. It reached the prepare action and spent a rate-limit attempt.
No upload session, document, Storage object, or email was created. The one-hour counter window expires normally; no compensating write was attempted.
This submission exceeded the intended read-only scope. Further form submissions wait for exact approval.
A separate Luna source review found no Critical or Important code issue. Its one minor finding was a stale security scan report.
That report is corrected locally and passed a separate reread and diff check.
The security worktree now also has a new private-verifier test file, described below. The owner separately approved its one-file local commit.
The verifier file now has twenty-three focused tests, including unsafe URL refusal and proof-readback failures. All twenty-three pass.
Fresh type check and full lint pass. The full suite passes 1,740 tests in 124 files; 57 database/live tests in fourteen files skip.
The full run exits zero in 710.64 seconds. Only tests changed; application code, SQL, dependencies, and the previous build remain unchanged.
Independent review found no blocking test issue. Commit `ff55bbfc615be027911535e2aae72e71ce38faa2` contains only that test file, over parent `e142f5f`.
Post-commit review confirms the exact path, parent, empty index, and unchanged test hash. Only the pre-existing scan report remains unstaged.
The owner approved its exact push on October 19. Remote PR #24 now has exact signed commit `ff55bbf`; GitHub verifies its signature.
CI run `39349917391` passed audit, type check, lint, 1,350 pgTAP assertions, and 243 database-backed tests.
Its full unit run failed one five-second DOCX boundary-test timeout: 1,739 passed, one failed, and 57 skipped. Build was skipped.
Diagnosis found slow test-fixture CRC calculation, not a failed content assertion. The native CRC repair changes only the test helper.
Its 78 focused tests, type check, lint, and full suite pass locally: 1,740 tests, 57 skips, and 431.73 seconds.
The reviewed repair is published as signed `d523469`. CI run `39351780332` passes both jobs at that exact head.
CI passes 1,740 unit tests, 1,350 pgTAP assertions, and 243 database-backed tests, plus type, lint, build, and zero-vulnerability audit.
Unit skips 57 database/live tests. The database selection skips one opt-in live PandaDoc test.
PR #24 remains draft. CodeRabbit skipped its draft review; a green status is not evidence of review.
Advance approval now covers reviewed local fixes, feature commits/pushes, draft PRs, and branch builds with existing settings.
New hosted batches, merges, Production releases, permission changes, purchases, and legal acceptance remain separate gates.
The owner then approved the exact synthetic file batch. Both owner staff-form and homeowner 25 MiB uploads passed on PR #24.
Both forms refused 26,214,401-byte files. Two hosted sessions are completed, with one verified 26,214,400-byte file and document each.
The owner sees six documents; the homeowner sees four and cannot see the owner's internal test image in its list.
Each new file was downloaded once. Both saved files have their exact prepared SHA-256 values; the audit shows exactly two matching issuance entries.
Both audit entries record attachment disposition and a 300-second lifetime. A live expired-link refusal now passes once, as recorded below. The saved 68-byte file now matches the recorded Storage size and fingerprint. Its PNG fixture checksum issue is separate.
The two document lists fit measured 390px and 1280px widths. Captured warning/error logs are empty for both tested sessions.
At file-batch completion, cleanup had eleven rows: nine processed and two staging rows pending without errors or dead rows.
The private-upload guard prevents cleanup until 2 hours 15 minutes after session creation. No cleanup job was run or record removed.
This approved batch changed shared hosted test data. Production code, settings, DNS, email, and the deployed commit did not change.
The October 19 read now confirms all eleven cleanup rows processed. Staging rows 9 and 11 each have one attempt and October 18 14:27:39 UTC completion timestamps.
Every cleanup error and dead timestamp is null. The loaded Storage root has no private-upload prefix, and both permanent test filenames remain listed.
No file was downloaded or removed during this read. Original saved-byte hashes were not repeated.
All thirty-five mail rows were read once by unique row identity: twenty-four sent, eleven dead, none pending or failed.
The Vercel historical CLI log request returned HTTP 400. The browser permits Last hour; longer windows require an upgrade.
Production plus Cron Job filters show zero records in that available hour. This does not prove a scheduled invocation failed or never ran.
Cleanup completion is verified, but the scheduler trigger remains unverified. No job was invoked or configuration changed.
The report and main-checkout release/signing records remain uncommitted beside preserved unrelated edits. The verifier test is published in `ff55bbf`.
No unrelated main-checkout edit is included in either feature push. Remaining hosted batches and release actions need their defined approvals.
The later approved invalid-file batch submits one nine-byte synthetic PDF on claim 0005, once, as Other and CMG only.
The page refuses it. Read-only inspection confirms cancelled session `c68baab2-61f4-4864-bd22-8049f9ecaf94`, null verification, and zero document rows at its exact path.
At the time of the October 19 invalid-file read, one staging object and one unaccepted copy remained, each nine bytes. Cleanup eligibility began October 19 at 11:09:57 PM EDT. The October 20 read below confirms both objects are now absent. No retry, manual cleanup, email, or additional hosted write occurred.
The October 20 read found zero matching staging objects, unaccepted copies, or document rows for the exact invalid-file path. Cleanup queue rows 12 and 13 each completed with one attempt and no error or dead marker. No worker ran during the read. The rows do not prove which scheduled worker processed them.
Do not treat current `develop` as launch-ready while the security correction remains unmerged.

### October 20 expiry and cleanup acceptance

One owner Download click issued a 300-second link for the existing 68-byte `synthetic-upload.png` on synthetic claim `CMG-2026-0003`. It created audit row 195. The same in-memory link was replayed once, 379.358 seconds after issuance. Storage returned rendered JSON with status 400, `InvalidJWT`, and an expired `exp` claim. No file bytes rendered. The audit still has one issuance row, no new outbox rows were found, and the raw link was not retained.

The initial browser event did not report a save path. The owner confirmed the saved file in Chrome. The file is 68 bytes, and its MD5 matches the recorded Storage ETag. No additional download or link was issued.

The PNG has an invalid IDAT chunk checksum. Its chunk boundaries and decompressed pixel bytes are present. This is a failed fixture image-validity check. The size and recorded-fingerprint comparison does not establish remote SHA-256 equality or image-decoder validity. Do not replace the hosted fixture under this approval.

No raw network status trace is available. Do not click Download again or reissue this link. Evidence: `pr24-expiry-initial-file-check-2026-10-20.json` and `pr24-expiry-test-2026-10-20.json`.

The read-only cleanup check found zero staging-object records, zero unaccepted-copy records, and zero document rows at the exact path for cancelled session `c68baab2-61f4-4864-bd22-8049f9ecaf94`. Queue rows 12 and 13 completed at `2026-10-20T14:27:40.125Z` and `.473Z`, each after one attempt with null error and dead timestamps. The cleanup table has thirteen rows. This proves cleanup state, not scheduler attribution. No worker or manual cleanup ran during the read. Evidence: `pr24-invalid-cleanup-read-2026-10-20.json`, `pr24-cleanup-rows-12-13-paths-2026-10-20.png`, and `pr24-cleanup-rows-12-13-times-2026-10-20.png`.

Baseline local verification used the original clean v2 tree, which matches `develop`:

- Type check, lint, and the optimized build passed through explicit Node 22 commands.
- The dependency audit reports zero vulnerabilities.
- Four focused files and 19 tests passed.
- Eighteen unauthenticated route checks passed across `simple`, `staff`, and `platform` on loopback-only servers.
- Full unit rerun: 120 files and 1,676 tests passed; 13 files and 56 database or live-provider tests skipped.
- The baseline skipped database and live-provider checks. Later approved disposable security checks passed as recorded above; live provider checks remain skipped.
- Existing GitHub `verify` and `database` jobs passed for current `develop` and PR #23.

The initial local test run failed before assertions because sandbox temporary-file renames were refused.
A focused rerun with the required tool access passed.
The initial build could not reach Google Fonts; a later launcher run reported a compiler child-process failure.
The unchanged build passed through the exact Node 22 executable. The child-process failure was not independently isolated.
No source, test threshold, lint rule, dependency, or compiler setting was changed to make validation pass.

## Hosted acceptance and operations

The merged records contain owner-session acceptance from 2026-10-07 for staff, vendor, existing-homeowner, and new-homeowner invitations.
Those are historical results, not proof of the final security candidate.
Remaining hosted requirements include file-size boundaries, private visibility, signed downloads, invitation replay/expiry, role isolation, mobile layouts, and interruption cleanup.
Hosted submissions, uploads, audit-creating downloads, resets, invitations, and signing sends need exact separate approval.

The existing v2 Preview closes private routes. PR #23 now has its approved branch-only platform, URL, blank PandaDoc keys, and Turnstile hostname.
The built-in browser is available again. The login password control passed without credentials.
Recovery rendered without horizontal overflow at 1280px and 390px. Turnstile supplied a nonempty response at both widths without submission.
All six public pages rendered at both widths with one main heading, no horizontal overflow, and no broken completed images.
Contact verification completed at both widths. Intake verification, second-person controls, and optional contractor fields passed read-only checks.
Six unauthenticated Preview HTTP checks passed with CSP and HSTS. Protected routes redirect to login.
Recovery captured opaque `NaN` console entries from the Cloudflare challenge frame, despite completed verification; no application-origin error was captured.
The owner completed sign-in and MFA. The partner directory now loads and its two company pages match the displayed counts.
Active, inactive-empty, and out-of-range page checks passed. Directory and company details passed six desktop/mobile layout checks.
Eight owner routes passed sixteen layout checks. All six sections of synthetic claim `CMG-2026-0003` passed twelve layout checks.
Claim search, its empty state, status filtering, generic not-found responses, and owner cross-role redirects also passed.
No application-origin console warning or error was captured during these owner checks; full request traces remain unavailable.
The owner completed staff sign-in and MFA in Chrome as `4miodio+cmgstaff@gmail.com`.
The staff account opens assigned claim `CMG-2026-0005`; its claim list excludes unassigned `CMG-2026-0003`.
The unassigned claim and missing claim return the same generic refusal as owner-only staff, settings, audit, and partner pages.
Eleven staff routes passed twenty-two layout checks at measured 1280px and 390px without global overflow.
The generic staff refusals also passed exact main-text comparison at 390px. No application-origin warning or error was captured after browser recovery.
Chrome had intermittent detachments and hosted screenshot timeouts. Full request traces and some keyboard/loading states stay unverified.
The separate homeowner session identifies `rob@miodiollc.com` and shows only its two synthetic claims, `CMG-2026-0003` and `CMG-2026-0004`.
Their overview, activity, and documents pages, the claim list, and profile pass sixteen desktop/mobile layouts.
Foreign, missing, and malformed claim IDs have identical settled refusal text and titles within each route at both widths.
Admin and partner routes return this homeowner to its portal. Empty documents, loaded activity, password visibility, and consent keyboard disclosure pass.
No homeowner submission, upload, download, consent change, password change, or sign-out occurred. Captured warning/error logs are empty.
The owner then signed in as vendor `robspeciale@gmail.com`. Its company is `CMG Synthetic Vendor Test`, with no referred claims.
Vendor list, referral form, and profile passed six desktop/mobile layouts. Twelve foreign, missing, and invalid claim cases returned identical refusal text.
Four admin/homeowner route checks returned this vendor to its own portal. First-name Tab focus reached the last-name field.
No vendor form was submitted. No application-origin warning or error was captured; four opaque Cloudflare-frame entries remain recorded.
The later positive vendor claim check uses an existing linked account without fixture work.
October 19 read-only queries confirm active `4miodio+cmgvendor@gmail.com` at active `CMG Test Vendor`, with claim 0005 and one matching summary.
Claim 0003 remains unattributed. No claim or permission record changed.
The owner signed in with the existing linked account on PR #24. Eight positive layouts pass at 1280px and 390px.
List, summary, activity, and profile show the expected company and claim, with no global overflow.
Before the approved note test, claim 0005's customer-only event stays hidden and the vendor feed is empty at both widths.
Eight unattributed/invalid claim refusals have matching main text and titles. Six staff/homeowner route requests return to `/partner`.
Keyboard return passes. Captured warning/error logs are empty; full network traces remain unavailable.
The approved one-entry test passed on October 19 at 8:37 PM EDT. The owner posted the exact synthetic note once with audience `Partner`.
After reload, the owner sees one matching Partner note and the earlier Homeowner entry. The vendor sees only the new note at 1280px and 390px.
Both vendor layouts have one main heading and no global overflow. Captured owner/vendor warning and error logs are empty.
Read-only database inspection confirms exactly two claim events, including the new `partner` note `ba8600a1-730f-44a8-ad8d-cafb4285c375`.
The outbox has zero rows created since October 20, 00:37 UTC. Source review also excludes the homeowner email path for Partner notes.
Full network traces remain unverified. The owner company page displays a correct branch Preview intake link, and its GET opens the form.
The GET preserves the referral code in the URL. It does not establish company resolution or persistence without submission.
Referral submission, notifications, and direct actions remain open. No other hosted write, Production setting, or DNS change occurred.
The mobile menu requires horizontal scrolling. Right Arrow reveals the full company-profile link, and Enter opens it.
This confirms keyboard access without a CSS change. The initial partial label alone did not prove an access defect.
Owner invitation disclosures open, focus the email field with Tab, and close at measured 390px and 1280px.
Audit disclosure, subject/date filtering, empty results, filter clearing, and older/newest keyboard navigation passed at 390px without writes.
The homeowner tab was closed by the owner. Earlier staff acceptance remains valid evidence, but current staff session state was not rechecked.
Direct actions, data-changing tests, and full request traces remain open.
HTTP response checks do not replace browser acceptance.

PR #23 Settings confirms the Manual provider, bundled PDF, and an unset webhook key.
The under-review synthetic claim shows manual download and send-record controls; neither was used.
Offline review found nine pages in each bundled PDF. All 34 Single tags and 43 Dual tags match the manifest and expected pages.
Rendered review found no clipping or unintended overlap. This does not prove PandaDoc field recognition or legal approval.
Two synthetic prefilled examples are now prepared with the actual combined `e142f5f` function, without a hosted download or data write.
Each has nine pages. Single retains nine signing tags; Dual retains eighteen. All data tags are replaced.
All eighteen pages were inspected. Existing seven-point positions and renderer font warnings remain explicit review limits in HANDOFF.
The owner signed in to PandaDoc and approved exactly two unsent synthetic drafts, then resumed after the safe stop.
On October 19, one Single draft was created. PandaDoc recognized nine fields and placed five Initials and four Signature fields.
The first visual check failed: black tag text remains visible through the fields. The workflow stopped with the draft unsent.
The provider automatically assigned the fields to the current account. Intended homeowner assignment is unverified.
Dual remains unuploaded. No email, saved contact, signature, deletion, or CMG claim change occurred.
The owner approved the isolated local color repair. Branch `bugfix/manual-signing-tag-visibility` starts at current `develop` commit `1b7f7f9`.
Revised upload bytes needed new exact draft approval. The owner later approved both revised files, as recorded below.
The first local white-glyph output failed rendering because it cuts gaps in underlying lines. That rejected output was never uploaded.
The scoped invisible-text revision and local dependency-layout recovery are recorded in HANDOFF.
The second local revision passes eighteen-page text and pixel checks, focused tests in all three modes, type checking, lint, and the normal build.
The final full unit run passes 1,682 tests; 56 database/live tests skip. Docker's local engine is unavailable.
The first output and build failures remain recorded in HANDOFF. At that stage, no Git action or deployment was approved.
The owner approved the exact revised Single `589d1a8f` and Dual `613747b4` files as two new unsent drafts.
Both uploads completed once. Single draft `GxuADmbyQZ5rJDCtZXnpH5` retains nine fields; Dual `9o6Qkr27Yyu5MvhgyRMo9N` retains eighteen.
Every field is required. Both drafts retain the expected page/type counts after a fresh reopen, without Connecting or Syncing state.
The revised markers are not visible. The old failed draft remains unchanged and unsent.
PandaDoc assigned all fields to the current account. Both recipient forms require a saved contact for the approved test addresses.
No contact was saved because the approval excluded contacts. Intended Single and separate Dual signer assignments remain unverified.
On page 7, Single's field rectangle reaches the last affidavit line area. Dual's two rectangles overlap each other and reach that area.
The text remains visible. This is a placement risk, not proof that signed ink damages text; no completed-signature appearance was tested.
At that point, the proposed provider step needed two saved synthetic contacts and draft-only assignment and placement correction.
That request was later replaced by the approved v3 batch below because the local layout repair creates new PDF bytes.
No finalization, email, signature, purchase, deletion, CMG write, Git action, deployment, or DNS change occurred during this draft batch.
Existing date-line intersections remain a separate layout gate before legal acceptance.
Read-only source review traces the date positions to generator baselines `d1=(464,55)` and `d8=(455,30)`, shared by both manifests.
Prefill replaces text at those positions. The raster background retains the printed rules, so preserving streams also preserves the existing intersections.
The page 1 policyholder value also crosses its rule in the retained render. A date-only correction must not be treated as full printed-value acceptance.
No layout source, manifest, bundled asset, API byte, or approved fixture changed during this diagnosis.
The owner then approved a local generator/manifest/bundled-asset correction on the existing isolated repair branch.
It preserves legal wording, values, background, and signer tags. The local change now corrects twelve data baselines per variant.
The manifest and both bundled PDFs were regenerated together. Their shared API bytes change under this new approval; API implementation remains unchanged.
Twenty-two focused tests pass after the clearance and stale-asset checks first failed as expected.
All eighteen background images and extracted strings match the prior files. Pixel changes stay inside the moved data areas.
Root and independent visual review found no new field collision. Separate source/test review found no blocking defect.
Type check, lint, the normal build, and 128 focused tests in each of three site modes pass under Node 22.
The fresh full unit run passes 1,686 tests in 121 files; 56 database/live tests in thirteen files skip.
The run finishes with exit zero in 280.18 seconds. Docker is unavailable, so database/live coverage remains incomplete.
The owner separately approved the six-file commit and the exact v3 provider batch. Both approvals supersede the earlier pending requests.
Local commit `56cff18e2e9f0e7f115dfd1d4b953ba7dad87e26` contains only the six reviewed files. Its isolated checkout is clean.
The approved exact push is complete. Draft PR #25 targets `develop` with this one signed commit and exactly six files.
CI run `39349972823` passed both jobs: 1,686 unit tests, 1,350 pgTAP assertions, and 253 database-backed tests.
Type check, lint, build, and the zero-vulnerability audit pass. Unit skips 56 database/live tests; the database selection skips one live PandaDoc test.
Automatic Preview `dpl_Eko5QAw2p5ADdFDEicMZuNVz5wU2` is Ready. Main-checkout records and unrelated edits remain outside that commit.
The current Node 22 dependency audit returns zero vulnerabilities. The first sandbox DNS failure and successful permitted retry are recorded in HANDOFF.
Single v3 draft `3Sh2wmDoV4Zziz4fpkDKx4` retains nine required fields. Dual v3 draft `K3TCRLokDjx6FC2WkYb4GX` retains eighteen.
The three page 7 boxes now sit on their intended INSURED rules, clear of text and each other.
Saved reopens retain the counts and corrections. The three edited fields remain required; both editor views are restored to 100 percent.
PandaDoc rejects `cmg-test-1@example.invalid` with “Please ensure domain is correct.” Save is disabled; creation was canceled.
No contact was saved from that rejected attempt. The owner then approved the two exact Gmail test contacts and draft assignments.
CMG Synthetic Signer 1 (`4miodio@gmail.com`) was created once and reused in both existing v3 drafts.
Single saves all nine fields for signer 1; the current account is CC. Its selected nine-field group remains required.
The plan permits two recipients and counted the current account. Adding another recipient was blocked; no upgrade was purchased.
The owner then approved replacing only the current account's Dual recipient entry with signer 2, within that limit.
CMG Synthetic Signer 2 (`robspeciale@gmail.com`) was created once and replaced that entry without retaining the current account as CC.
Exactly nine right/lower fields changed to signer 2. All nine left/upper signer 1 fields stayed unchanged.
Each Dual signer has five initials and four signatures, with one field on each page. All eighteen individual Required checks pass.
All field types, positions, and sizes match their pre-replacement values. No saved account or existing contact details changed.
The saved Dual reload retains all eighteen assignments and unchanged field geometry. Both test drafts remain unsent and unsigned.
Single assignment remains complete. Real-claim Preview download, legal review, completed signing, filing, status, and access checks remain open.
Do not upload the synthetic PDFs again or send mail. Any real provider test needs its separate exact approval.
The owner later approved the exact PDF push and draft PR creation. Both are complete; PR #25 passes CI and its Preview build.
All older drafts remain retained. No finalization, email, signature, purchase, deletion, CMG database write, Production change, or DNS change occurred.
The current independent GitHub check confirms unchanged develop and PR heads, successful latest CI/Vercel statuses, and no submitted review.
The combined Preview profile passed three empty keyboard password toggles and consent disclosure/focus checks without submission.
Both measured widths fit; all controls and viewport overrides were restored. Captured warnings/errors are empty; full request traces remain unverified.
Production manual PandaDoc configuration is historical evidence and must be rechecked before an approved signing test.
Keep the selected manual release path. Do not send through the API by default.
PR #23 Settings reports zero pending or failed notifications. This does not prove provider or inbox delivery.
Both Production cron schedules remain enabled at 14:00 and 14:17 UTC. A bounded log search returned no records; execution remains unverified.
The owner restored CMG Supabase access. A read-only transaction verified all migration versions and the stored SQL hash.
The outbox has 24 sent and 11 dead rows, with no pending or failed rows. Cleanup has zero unprocessed rows.
No cron endpoint, retry, cleanup execution, or hosted data write occurred.
Provider delivery, reply handling, and operational ownership still need current evidence.
The open owner inbox returned no matches for the current exact reset-email subject. No message body was opened or changed.
This does not prove failed delivery or cover archived messages. The other test mailbox is at its login page.
Never resend synthetic messages marked dead.

## Remaining owner gates

Commercial hosting, private-repository protection, email operations, privacy, retention, legal holds, export/erasure, and legal review remain open.
Public-copy approval stays second-to-last. SEO and domain changes stay last.
Preserve all existing DNS unless the owner approves an exact change.

## Ordered next steps

1. Review draft PR #24 at `d523469` and PDF PR #25 at `56cff18`. Their exact-head CI jobs and automatic Previews pass.
2. Preserve the completed role reads, Partner note, upload boundaries, and invalid-file refusal. Do not repeat one-time actions or unchanged Preview setup.
3. Keep the invalid-file cleanup result and one-time expired-link refusal recorded. Do not invoke cleanup again or issue another link. The saved-file size and recorded-fingerprint checks pass. Scheduler attribution remains unverified; fixture image validity is a separate limitation.
4. Obtain exact approval for remaining hosted acceptance batches. Preserve the database, accounts, files, and recipients outside each defined batch.
5. Complete legal review and the approved manual-signing acceptance, including the signed file, claim state, and access checks.
6. Resolve hosting, repository protection, email operations, privacy, retention, and other owner decisions. Obtain separate merge and Production release approvals; merges can deploy automatically.
7. Obtain public-copy approval second-to-last. Complete SEO and domain work last, with exact approval for any DNS change.
