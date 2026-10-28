# Full-platform launch checklist

On October 28, PR #28 at `bacb4cf` had passing GitHub verify and database checks. Its Preview was Ready. The full local serial suite passed 1,767 tests, with 57 skipped, in 701.35 seconds. It reported 128 passing files, 14 skipped files, and exit 0.

Earlier worker failures remain recorded; their cause is unconfirmed. Later finalization assertions passed six focused tests and full `eslint .` under Node 22. The opt-in local upload test passed one real test in 31.53 seconds. The unchanged invitation refusal test passed one focused test, full type check, and file lint under Node 22. It used installed dependencies; no install was needed.

Type check, lint, and build passed before the later test-only work. The new upload test passed Node 22 type check and focused lint; disabled mode skipped one test. Audit passed the high-severity threshold with four low findings. October 28 test updates are recorded here; final commit CI and Preview verification are required. Hosted interruption, recovery, and non-overwrite remain unverified. Production remains on `develop` at `1b7f7f9`; no merge or Production release is approved.

See [TEST_STATUS.md](TEST_STATUS.md) for the October 28 evidence and limits.

On October 27, the owner approved accepting synthetic claim `CMG-2026-0007` once on Preview. The claim is `under_review`, assigned to `Staff1 Tester`, and visible in that test adjuster’s claims list. One customer invitation to `rob@miodiollc.com` was sent on attempt one and reached the inbox. The owner approved its acceptance; the invitation was accepted and linked to the existing active customer account.

The existing homeowner account then signed in and opened claim CMG-2026-0007; its synthetic details and assigned test adjuster were visible. At the October 27 stop, the separate status email to Rob was queued with zero attempts. The October 28 read records it as sent. Inbox receipt and scheduler attribution remain unverified.

No PandaDoc document was created. Do not repeat acceptance, resend the invitation, run the worker manually, or delete records without separate approval.

On October 27, the owner approved one synthetic Preview intake without files. It was submitted once and returned `CMG-2026-0007`. At submission, the hosted database saved claim `127cdecf-564f-4d70-8f32-138b93bc8bd8` in `new_intake`, one claimant, and email and SMS consent records. The upload session completed with zero files. At submission, no adjuster was assigned and no PandaDoc document existed. Two emails to `rob@miodiollc.com` were sent on attempt one; Resend shows Delivered and both messages reached the inbox. The staff alert and confirmation contain the synthetic reference and details. The adjuster account could not see this unassigned intake. The owner queue shows CMG-2026-0007 and the synthetic details. Keep all test records. Do not resubmit, resend, assign, sign, or delete without separate approval.

On October 27, the owner approved one Preview email-consent test. The form was submitted once. One synthetic lead `2f318635-431a-44ee-b7df-36ce72df34e0` and one email-consent record were saved. The staff menu count changed from three to four after client navigation without a page reload. Two outbox rows addressed to `rob@miodiollc.com` were sent on attempt one; Resend reports both Delivered. Both messages reached the Roundcube inbox. The staff alert matched the synthetic name, phone, email and message; the automatic reply rendered successfully. Keep the test records; do not submit or send again.

On October 27, staff menu count fix `4c974eacbe6be09a874c9e5fc73f797c83cad41c` was pushed to draft PR #28. In the disposable local database, a synthetic lead changed the count from one to two after staff navigation without a page reload. The staff menu passed desktop and 390px checks; the active phone link remained visible. Simple mode kept the admin page closed; staff and platform modes opened the staff menu. Type, lint, build, and focused tests passed; the full suite passed 1,764 tests and skipped 57. No browser warnings or errors were captured; full network traces were unavailable. The Preview deployment for this commit is Ready. Read-only hosted staff navigation passed at desktop and 390px with the existing lead count; the active phone link stayed visible and no browser warnings or errors were captured. No new hosted lead was created. GitHub verify and database checks passed for this commit. The approved hosted count-change proof passed. One synthetic lead and its synthetic staff MFA setup remain in the disposable database. No hosted data or Production setting changed.

On October 27, the approved Preview contact form was submitted once. One synthetic lead was saved and appeared in the staff list. One alert to `rob@miodiollc.com` was sent on attempt one; Resend reports Delivered. Inbox receipt and the synthetic message contents were verified in Roundcube. The existing staff menu count updated after page refresh. Keep the test records and do not resubmit. Evidence: `contact-preview-result-2026-10-27.json` in session scratch.

Owner menu acceptance on Preview `71bd6ea` passed 46 checks at 1280px and 390px. These include 36 forward/reverse focus cases, six keyboard navigation cases, and four scrolled-page cases. No browser warnings or errors were captured. Staff menu acceptance passed 34 checks: 20 keyboard focus cases, 10 link checks, and four scrolled-page cases. Evidence: `t63-staff-hosted-menu-2026-10-27.json` in session scratch. Evidence: `t63-owner-hosted-menu-2026-10-27.json` and `t63-owner-hosted-phone-settings-2026-10-27.png` in session scratch.

Earlier application source is signed `8ae5c70e0be55fb9b9df1f80c76a62d0fecabbb0` in draft PR #28. Its CI and local checks pass, including audit. Vendor checks pass on its Ready Preview. Hosted owner and staff menu checks passed. A later records-only commit may advance the PR head.

Earlier source checks passed: 1,763 tests passed and 57 skipped; type, lint, build, audit, and 39/39 site-mode checks pass. The approved Undici repair changed only the lockfile leaf to 8.12.3. `package.json` and 115 production package entries were unchanged by this repair. Earlier approved runtime updates remain included.

This checklist covers the owner's full-platform goal, including customer and vendor access.
It does not authorize a hosted write, live message, Git action, or Production change.
Use [RELEASE_STATE.md](../RELEASE_STATE.md) for deployment facts and [HANDOFF.md](HANDOFF.md) for test evidence.
Use [BLOCKERS.md](BLOCKERS.md) for owner decisions.

## Evidence rules

Record the commit, environment, role, date, result, and evidence for each test.
Local success does not prove hosted success.
An older passing check does not prove that a changed release passes.
Provider acceptance does not prove inbox delivery.
Record skipped checks and unavailable console or network evidence.
Keep credentials, signed links, and customer data out of this record.

## Engineering and acceptance

| Requirement | Current evidence | Remaining proof |
|---|---|---|
| PR #18 partner directory count | On PR #23, both company details match directory counts: one rep/zero claims and one rep/one claim. Filters, empty state, page clamp, and six desktop/mobile layouts pass. PR #22 contains the fix. | Count acceptance passed; company writes and disposition tests remain separately controlled |
| PR #19 private upload transport | Local and hosted owner staff-form/homeowner 25 MiB uploads pass. Hosted sessions each completed with one 26,214,400-byte file. Both forms refuse one byte over. Downloaded hashes match both fixtures. | Remaining failure/retry paths and final release checks; an owner test does not prove every adjuster permission |
| Upload hydration protection | Regression tests and local browser passed at `d8e55fa` | Hosted staff and homeowner render and interaction checks |
| Dependency audit and local checks | PR #28 at `bacb4cf` passed GitHub verify and database checks. The October 28 serial suite passed 1,767 tests, with 57 skipped. Type, lint, and build passed; audit passed the high-severity threshold with four low findings. | Later finalization assertions passed six focused tests and full lint. The real local upload test passed once. Hosted recovery remains open; the earlier worker-start cause remains unconfirmed. |
| Public site | PR #23 at `15ea5f6`: six public routes rendered at 1280px and 390px, with one main heading, no overflow, and no broken completed images. The contact menu and Escape focus return passed at 390px. The first contact FAQ opens. | Remaining navigation, loading, errors, and approved form acceptance |
| Contact and claim intake | Approved October 27 contact, email-consent contact, and no-file intake tests saved their synthetic records. Their approved emails reached Rob. Eight local intake consent boundary cases passed on October 28. | Remaining form boundaries, rate limits, vendor links, file handling, and error states need their supported tests. New hosted data changes need exact approval. |
| Sign-in and recovery | All four role sign-ins and both MFA checks are complete under the approved PR #28 account batch. Recovery displayed Success after the approved hostname addition; no reset email was sent. | Hosted T63 owner and staff focus checks passed. Vendor title/access checks pass on the current Preview; other live recovery and data-changing checks remain open. |
| Invitations | Earlier approved invitations were accepted. Claim 0007 invitation acceptance linked the existing active customer account. Three local reservation-failure cases passed. The unchanged mocked used/expired refusal test passed in the candidate with full type check and file lint under Node 22. | Hosted replay, actual expiry, and remaining final-candidate account behavior remain open. Candidate testing used installed dependencies; no further install is needed. The retained original checkout still lacks broader validation. |
| Owner desk | PR #23 and PR #24 evidence remains valid. On the earlier `5bcc62a` Preview, owner sign-in/MFA passed and 30 route/layout checks passed at 1280px and 390px. Owner Settings confirms Manual signing, bundled PDF, an unset webhook, Supabase project `vdtqxglhlgatpbgehsjk`, and zero pending or failed outbox entries. This closes only provider configuration; real manual signing and legal acceptance remain open. Evidence: `pr28-owner-readonly-acceptance-2026-10-24.json`. | Approved write and disposition tests; real signing and legal review |
| Claim administration | On PR #23, synthetic claim `CMG-2026-0003` passes all six sections at 1280px and 390px. The completed LOR panel and separate claim's manual-provider controls render. No save or download occurs. | Assignment, fee permissions, legal transitions, and approved writes |
| Staff isolation | On the earlier `5bcc62a` Preview, Chrome Incognito verified Staff1 Tester ADJUSTER. Twenty-six read-only checks passed at 1280px and 390px. Assigned claim 0005 was visible; foreign 0003 and owner-only pages returned matching generic refusals. Portal and partner redirected to admin. Console errors were zero. Evidence: `pr28-staff-readonly-acceptance-2026-10-24.json`. | Direct action refusals, owner-only writes, and full request traces remain open. |
| Homeowner portal | PR #23 read tests cover two owned claims, profile, activity, documents, refusals, redirects, keyboard controls, and sixteen layouts. PR #24 passes uploads, size-limit refusal, saved download bytes, audits, and internal-file list exclusion. The exact profile batch passes two refusals, one temporary-name save, and one restoration. SQL and reload confirm the original name and null phone; role, company, and active status stay unchanged. The update timestamp remains new, and no new outbox row appears. The earlier approved synthetic question and staff alert passed. On the earlier `5bcc62a` Preview, one homeowner sign-in and 20 read-only checks passed at 1280px and 390px. Claims 0003/0004 were readable; foreign 0005/0006 returned the same generic refusal. The customer list showed four documents. The owner-side 25 MiB fixture was absent from the customer view and present in the owner-side cross-check. Evidence: `pr28-customer-readonly-acceptance-2026-10-24.json`. October 28 claim 0007 keyboard controls and profile layouts, labels, focus, and disclosure checks passed without submission. Local mocked question and download refusals passed. Disposable database claim isolation passed with rollback. | Password and consent writes, sign-out, remaining direct-action tests, and full network traces remain open. Do not repeat one-time approved actions. Do not repeat the profile batch. |
| Vendor portal | Earlier candidate `5bcc62a` checks passed 22 vendor read-only cases at desktop and mobile widths. One approved referral created claim 0006; claims 0005 and 0006 appeared, and the alert was delivered on its first attempt. Three audit rows remain. Do not repeat the referral or resend. On verified source `8ae5c70`, all 12 route-specific refusal checks pass at 1280px and 390px; four authorized client-navigation title/reference checks pass. Evidence: `t65-vendor-title-hosted-2026-10-26.json` in session scratch. Summary pages show generic not-found metadata; the activity child page uses static title “Partner activity.” Four opaque Cloudflare-origin console entries remain (two errors and two warnings); cause is unproved, and no CMG-origin entry was captured. Raw network traces are unavailable. | Foreign-ID client navigation, independent inbox receipt, other notifications, and direct actions remain open. |
| Private files | Hosted owner/homeowner 25 MiB uploads, hashes, visibility, and two audited downloads pass. The nine-byte invalid owner PDF was refused. Its session is cancelled, verification is null, and its exact path has zero document rows. One expiry replay of the same link, 379.358 seconds after issuance, returned Storage JSON 400 `InvalidJWT`; no file bytes rendered. One audit row remains. | The saved size is 68 bytes. Its MD5 matches the recorded Storage ETag; no remote SHA-256 comparison is available. Its IDAT checksum fails; image-decoder validity is not proved. Direct internal-action refusal, non-overwrite, and interruption/retry remain open. Full raw request traces remain unavailable. Do not issue another link. |
| Upload recovery | Invalid-file paths remain absent; cleanup rows 12 and 13 each processed once. Three component and six server cases passed with mocked Storage and finalization. October 28 test updates are recorded here; final commit CI and Preview verification are required. The real disposable-stack test proved interrupted 25 MiB upload retry, one document, refused replacement, and stable hashes, IDs, versions, and repeated finalization. | The real local upload test passed once; later assertions passed six focused tests and full lint. Hosted interruption, recovery, non-overwrite, and scheduler attribution remain unverified. No hosted retry or manual cleanup is approved. |
| All site modes | The earlier source passed 39 GET checks across simple, staff, and platform modes. October 27 staff-menu checks also covered all three modes. PR #28 at `bacb4cf` passed verify and database CI. | Preserve each check date and source. Later local test-only changes need their relevant checks. |
| Mobile and accessibility | T63 source is in signed PR #28. Local focused tests, 56 geometry cases, and eight client-route checks pass. Hosted owner and staff menu focus checks passed. The harness excludes the full shell, auth, and already-scrolled state. | Keep full network traces marked unavailable. |
| Browser diagnostics | Final hosted vendor proof on Ready PR #28 passes 12/12 route-specific refusal checks and four authorized client-navigation checks. No new title defect was found; the activity child page correctly uses “Partner activity.” Full network traces remain unavailable. | Foreign-ID client navigation remains untested. Hosted owner and staff focus checks passed. |
| Earlier listener errors | Fresh owner IAB and staff Chrome overview navigation captured no warning or error. Source search found no extension runtime messaging calls. Staff Tab and Enter navigation passed without writes. | Historical stack and source are unavailable. Do not claim a confirmed extension cause or a repaired application defect. |
| Recovery confirmation budget | Exact PR #23 handler and limiter passed a real disposable SQL-function test: ten allowed, eleven/twelve refused, separate IP, malformed queries, RPC outage, all modes, and 900-second bucket alignment. Auth was stubbed. Transaction rollback restored the entire rate table. | Hosted request behavior and final combined candidate acceptance; no recovery email was sent |

## Operations and release

| Requirement | Current evidence | Release gate |
|---|---|---|
| Migration compatibility | Read-only CMG history matches all 36 versions and the stored head SQL SHA-256. No DDL ran during the approved file tests. Current staging cleanup is recorded below. | Repeat relevant schema/config checks before an approved release write; no migration reapplication |
| Email and cleanup queues | The October 28 read records claim 0007 status mail as sent on attempt one at 14:34:40 UTC. No pending cleanup rows existed. No row completed or became dead during 14:27:30–14:28:30 UTC. Earlier cleanup rows 12 and 13 remain processed. | Status-email inbox receipt and scheduler attribution remain unverified. Do not resend synthetic mail or invoke a worker. |
| Cron and provider operation | Both configured daily schedules remain recorded. October 28 Production logs show HTTP 200 for cleanup at 14:27:36 UTC and outbox at 14:34:37 UTC. No manual invocation occurred. | The logs do not identify the requester or affected records. Scheduler attribution, cleanup work in that run, inbox receipt, and accepted delay remain unverified. |
| Email operations | The October 27 approved synthetic contact test saved one lead and one staff-alert row. The alert to `rob@miodiollc.com` was sent on attempt one; Resend reports Delivered. No consent row was created. | Inbox receipt passed. Name a monitored reply operator. Preserve the test records; do not resubmit. No agent email or access grant to `cmgpropertysolutions.net` or its subdomains is authorized. |
| Manual PandaDoc signing | Both v3 drafts remain unsent. Recognition, hidden markers, corrected boxes, required fields, and saved signer assignments pass. Exact signed `56cff18` is published in draft PR #25 with six files. CI run `39349972823` passes type, lint, build, audit, 1,686 unit tests, 1,350 pgTAP assertions, and 253 database-backed tests. Unit skips 56 database/live tests; one live PandaDoc test skips in the DB job. The automatic Preview is Ready. All six PDF repair files in candidate `5bcc62a` exactly match tested `56cff18`; prior provider checks remain applicable. | Signing is blocked while sender or recipient notifications can reach a CMG-domain address. No separate non-CMG workspace exists. Legal review and exact approvals remain required for download, upload, send, signing, filing, status, and access tests. Merge and Production release remain excluded. |
| PandaDoc API path | Not selected for first release. Shared Preview keys remain unchanged; approved PR #23 and PR #24 overrides are blank. Candidate branch API and webhook keys are blank under the approved branch settings. | Keep Production manual. Do not send through the API. Verify the candidate's runtime Manual setting in the owner Settings page before claiming hosted verification. |
| Hosting and repository | Fresh API reads confirm Hobby and private personal `develop` with `protected=false`. The user plan is unavailable, not proved Free. Current official commercial-use, pricing, and private-protection requirements are verified. | Confirm billing and existing GitHub eligibility, then obtain separate purchase and protection approvals |
| Privacy and retention | Corrected no-backup preflight and manual request proposal; export tooling and enforced holds remain absent | Owner and legal approval, synthetic completeness tests, and workable operator controls or approved implementation |
| Public copy and LOR PDFs | Legal approval remains open | Exact copy and both PDF variants approved second-to-last |
| Production deployment | The public alias resolves to Ready `dpl_GoXHV8n8KfTVt5BDyZosJF3jvXPk`, rebuilt from unchanged `develop` source `1b7f7f9`. PR #24 is Ready as `dpl_Zz8hWeU9yJ8Fm4hdAjKyWRHcbkfE` at unchanged `d523469`. Exactly two approved rebuilds completed. | Any later release requires separate merge and Production approval. This batch did not release PR #24 to Production. |
| Platform activation | The owner recorded platform activation on October 7. Current Production portal and partner requests redirect unauthenticated callers to login. Historical owner-session invitation acceptance is in merged HANDOFF. | Remaining full-platform acceptance; do not request the completed activation again |
| Domain and SEO | `app.` remains the temporary host | Approved SEO and domain work last; preserve every existing DNS record unless an exact change is approved |
| Recovery | Backups declined; immediate restore unverified | Reviewed forward repair, compatible code recovery, and clear operator steps; no backup or database reset |
| Final records | October 28 evidence is recorded in these five release documents. Earlier PR #26 records do not establish the current candidate status. | Review the final local test changes and records. Standing feature commit, push, and draft PR approvals remain valid within their original scope. Merge and Production release need separate approvals. |
| Remaining security scan items | Earlier source and current CI checks passed within their recorded scope. October 28 local mock and disposable database boundary checks add limited coverage. | Finish remaining direct hosted action tests, upload recovery, operational decisions, legal review, and signing. Obtain separate merge and Production approval. |

The first local tag-color repair failed rendering because white glyphs erase small parts of underlying lines.
The normal local build also failed on the reused dependency junction. HANDOFF retains the failed attempts and recovery evidence.
The second revision passed eighteen-page rendering, all three focused mode checks, type checking, lint, and the normal build.
Its full unit run passed 1,682 tests, with 56 database/live tests skipped.
At that stage, provider recognition and required-field checks passed. Signer assignment, page 7 placement, printed layout, and legal acceptance remained open.
Read-only review then confirmed a page 1 policyholder/rule crossing. This finding required measured review of all printed values.
The owner approved the local generator/manifest/bundled-asset correction. Twelve data baselines now change in each variant.
Focused, three-mode, type, lint, build, and eighteen-page checks pass. The fresh full suite passes 1,686 tests, with 56 database/live tests skipped.
Docker-dependent coverage was incomplete at that local stage. Later PR #25 CI passes the database checks recorded above. Neither result establishes legal acceptance.
The owner approved both exact v3 uploads and the separate six-file commit. Both uploads and commit `56cff18` are complete.
All twenty-seven v3 fields are required. Saved page 7 rectangles pass separation and text-clearance checks, including independent review.
The initial `.invalid` attempt saved no contact. The later Gmail approval saved contact 1 and completed Single assignment.
The two-recipient limit initially blocked contact 2. The owner then approved replacing only the current account's Dual recipient entry.
Both contacts are now saved. Dual retains nine fields per test signer after reload, with eighteen Required checks and unchanged geometry.
No upgrade was purchased. Real-claim signing, legal acceptance, filing, and claim-state tests remain open.
Both v3 upload approvals are consumed. The later approved PDF push and draft PR #25 are complete. No repeat upload, finalization, email, signature, purchase, deletion, CMG write, merge, or Production deployment is approved.

PR #22 already merged the earlier integration fixes. Draft PR #28 combines the later pending repairs; no superseded old-branch merge is needed.
The old `9a80e09` Preview rebuild passed on October 13 and remains historical evidence.
The earlier v2 Preview passed six public 200 responses and six private 307 closures, all with CSP and HSTS.
PR #24 supplies the security fixes in release candidate `5bcc62a`. Draft PR #28 also includes PR #25, PR #27, and approved runtime updates. An isolated actual-function test reproduced three unsafe redirects in current develop and confirmed their correction.
PR #23 passed CI. Its approved branch-only setup and one rebuild are complete as `dpl_9ZNj3TUEkd4ci63mjn19gWj2feqJ` at `15ea5f6`.
Built-in browser control is restored. The recovery widget completes at both required widths without submission.
Cloudflare frame console entries remain recorded; private interaction and full request traces remain open.
The external setup changed only four branch overrides and one added Turnstile hostname.
The initial separately approved commit and push were `abc4499`; both CI jobs passed.
The owner then separately approved the thirteen-file merge commit `e142f5f` and its exact push. PR #24 now has nineteen changed files against `develop`.
The new exact-commit Preview is Ready in 38 seconds. Seven HTTP checks pass with CSP and HSTS; the closed confirm response retains `no-referrer`.
The root renders without captured warnings/errors. That initial simple-mode check did not prove enabled hosted recovery.
The owner later approved four PR #24 branch overrides, one new Turnstile hostname, and one redeployment. All are complete.
The platform Preview is Ready as `dpl_8ykWz4ujjgeq1s3ojzBP1ADjSQJY`, in 51 seconds, at exact `e142f5f`.
Its eight current HTTP checks pass. Recovery verification and login-notice layouts pass at 1280px and 390px without submission.
The captured app console is empty; eight opaque Cloudflare-frame entries remain. Full request traces and reset delivery remain unverified.
Setup preserved all 24 original environment records and all seven original widget hosts. It changed no Production code, DNS, or database data.
Owner, staff, homeowner, and both vendor read-only checks passed. Positive vendor claim access passes; visible partner activity and data-changing acceptance remain open.
Full request traces remain unavailable. Vendor referral navigation captured opaque Cloudflare-frame warnings/errors, with no application-origin entry.
The approved merge of #23 into #24 and both follow-up repairs are committed and pushed as `e142f5f`.
No remote merge, Production deployment, or additional Preview change is approved. The exact file-test batch was later approved as recorded below.
Owner sign-in and MFA on the new combined Preview are complete. Settings and document controls pass both widths; Recheck and cross-role redirects pass.
The initial owner checks captured no warning or error. They submitted no file upload, download, save, or email.
One empty-file submission returned its field error but spent a hosted rate-limit attempt. It created no upload session or document.
This exceeded the intended read-only scope. Further submissions require exact approval; no counter reset was attempted.
A separate Luna source review found no Critical or Important code issue. The stale scan report is corrected locally and rereviewed.
The report remains an uncommitted security-worktree change. The owner separately approved the one-file verifier test commit, now `ff55bbf`.
The verifier now passes twenty-three focused cases. Fresh type, full lint, and the full suite pass: 1,740 tests, with 57 database/live skips.
Eight added cases cover unsafe signed URLs, absent proof readback, and malformed saved proofs. Independent review found no blocking issue.
Application code, SQL, and dependencies stay unchanged. The exact approved `ff55bbf` push is complete.
CI run `39349917391` passes audit, type, lint, 1,350 pgTAP assertions, and 243 database-backed tests.
Its unit step fails one five-second DOCX fixture timeout: 1,739 pass, one fails, 57 skip; build is skipped.
The reviewed test-only CRC repair passes 78 focused tests, type, lint, and 1,740 full-suite tests locally; 57 skip.
Signed repair `d523469` is published to PR #24. CI run `39351780332` passes both jobs at that exact head.
Type check, lint, build, and zero-vulnerability audit pass. Unit tests pass 1,740; 57 database/live tests skip.
Database checks pass 1,350 pgTAP assertions and 243 Vitest tests; one live PandaDoc test skips. The automatic Preview is Ready.
All available #19/#22/#23 comments were triaged. The #19 hydration fix is merged, and the #22 retry suggestion conflicts with installed Next.js.
PR #23 is still draft, with no submitted GitHub review. Earlier independent source review is separate evidence.
PR #24 also has no submitted review. CodeRabbit explicitly skipped its draft review despite the successful check status.
The later exact file batch is complete. Both 25 MiB uploads and saved hashes pass; both one-byte-over files are refused.
Two hosted sessions completed, and two matching download audits record a 300-second lifetime. No extra download was issued after a browser-event timeout.
The owner sees six documents; the homeowner sees four. Both lists fit measured 390px and 1280px widths, with no captured warnings/errors.
Shared hosted test data changed under approval. No email, worker invocation, deletion, Production code, setting, or DNS change ran.
At the file-batch stop, two staging objects awaited guarded cleanup. The October 19 read verifies their completion and retained permanent paths.
Live expiry refusal passes once. The saved-file size and recorded-fingerprint checks pass. Failure/retry behavior, remaining portal writes, signing, scheduled-trigger proof, and operational decisions stay open. The PNG checksum failure remains a test-data limitation.

## Completion rule

Preview setup, rebuild, and hostname addition are complete. All four role sign-ins and both MFA checks are verified. Vendor title and access checks pass on the current Preview. Hosted T63 owner and staff menu checks passed.

The October 28 serial suite passed 1,767 tests with 57 skipped. Type check, lint, and build passed before later test-only work. Audit passed the high-severity threshold with four low findings. Later finalization assertions passed six focused tests and full `eslint .` under Node 22. The real local upload test passed once in 31.53 seconds. Earlier worker failures remain recorded; their cause is unconfirmed.
Earlier evidence in session scratch: `t65-full-checks-2026-10-25`, `cmgps-undici-audit-2026-10-24`, `launch-candidate-mode-checks-2026-10-26T04-00-24-349Z-08162a93.json`, and `t65-vendor-title-hosted-2026-10-26.json`.

The recorded candidate production build passed with exit 0 before the later test-only work.
Production remains on `1b7f7f9`. Earlier read-only acceptance caused normal Auth records only. The separately approved October 27 submissions changed hosted synthetic records. October 28 reads confirmed later mail status without manual resend or worker invocation.

Do not mark the goal complete while a required row lacks evidence or an approved operational procedure.
Optional photography does not block launch unless the owner makes it a requirement.
Do not treat the historical simple-mode roadmap as approval to omit full-platform acceptance.
