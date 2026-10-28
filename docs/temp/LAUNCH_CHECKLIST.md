# Full-platform launch checklist

Source `76cdc5a` passed exact-head CI `40735491808`. Verify job `122982775518` passed 1,796 tests and skipped 65 in 105.75 seconds; 133 files passed and 17 skipped. Audit, type check, lint, and build passed; audit retained four low findings. The Windows suite passed 1,796 tests and skipped 65 in 514.89 seconds, with exit 0. It used Node 22.22.2 and unchanged default one-worker settings; 133 files passed and 17 skipped.

Earlier head `8b1aecb` failed CI `40734242301`, verify job `122978378239`: 1,792 tests passed, three failed, and 65 skipped in 97.17 seconds. Of 150 files, 132 passed, one failed, and 17 skipped. Audit, type check, and lint passed; the build step skipped. The new exact-head Linux pass supersedes that failure for the repaired source.

All three new scope failures observed an attempted `/` read. The filesystem-root fallback restored ancestor traversal on Linux. Signed and pushed repair `76cdc5aea68cd5733ba93b00eff61a3b2ecb7714` changes one condition, adds a virtual-working-directory regression, and corrects one README statement. Before repair, the new regression failed by blocking an attempted `C:/` read. After repair, 21 focused tests passed in 2.13 seconds; type, lint, diff, and review checks passed. Both Linux CI and the default Windows suite passed.

Database job `122982775171` passed 1,350 pgTAP assertions across 44 files, plus 253 database tests with one live PandaDoc test skipped. Database Vitest passed 35 files and skipped one in 27.84 seconds. Vercel reported success for deployment `5SBC1nMrrWGhBHXXWfgDrgwvpPZL`. The browser control API was unavailable; final browser proof remains unverified.

Published application source `4ee40506c50001f29ba0bd1e7822416175ea7873` includes email repair `27cfd6b221060c0b2faf1b406f8b2494ec3c7ce4` and the first lint-glob repair. Email tests passed 28 focused cases and 28 cases in each site mode. Local type check and lint passed after that repair. The application build passed after email changes and before the tooling-only glob repair. Browser checks passed for four real rendered email outputs. These local results do not override the Linux CI failure.

Before the glob repair, the full unit run passed 1,778 tests, failed one, and skipped 65 in 354.28 seconds. A focused rerun passed three tests and failed one in 8.59 seconds. Both failures were a 5,000 ms glob-test timeout. Guarded diagnosis confirmed broad ancestor traversal outside the working directory.

The first adapter repair passed 20 focused tests in 1.51 seconds and nine independent compatibility checks. Its default Windows one-worker suite passed 1,795 tests and skipped 65 in 538.00 seconds, with exit 0. Of 150 files, 133 passed and 17 skipped. This resolved the earlier Windows timeout for that source. The later Linux failure required the separate root repair recorded above.

Earlier source `cc27f38` passed CI `40724185151`: 1,773 unit tests passed, 65 skipped. Its database checks passed 1,350 pgTAP assertions and 253 tests; one live PandaDoc test skipped. Type, lint, build, and audit passed; four low findings remained. Preview `3ucqe9EgAwCfRk7Mq5BafwXdaiiR` was Ready for that exact revision.

Published UI tests and real local signout, access, and upload-recovery results retain their recorded scope. Synthetic fixtures remain retained. Earlier worker-start failures remain separate historical evidence; their cause is unconfirmed.

No authentication implementation, schema, or dependency changes are part of these new repairs. The new audit passed the high-severity threshold with four low deepmerge-chain findings; no fix is available. Earlier database evidence remains relevant. Verify the resulting PR #28 head and Preview after the repairs. Additional hosted replay, expiry, interruption, recovery, and non-overwrite proof remains unverified. Existing evidence does not require an automatic repeat.

Production remains on `develop` at `1b7f7f9`; no merge or Production release is approved.

See [TEST_STATUS.md](TEST_STATUS.md) for the October 28 evidence and limits.

Resend confirmed claim `CMG-2026-0007` status-email delivery to `rob@miodiollc.com` on October 28 at 10:34 AM. Provider ID `01a182ef-3fc8-7258-b332-be9ff214b502` returned SMTP `250 OK`. This proves recipient-server acceptance, not inbox placement. Roundcube receipt and scheduler attribution remain unverified. No email was resent.

Use the [release approval packet](RELEASE_APPROVAL.md) for exact preflight steps, owner decisions, and recovery limits.

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
| Dependency audit and local checks | Source `76cdc5a` passed exact-head Linux CI and the final Windows suite, each with 1,796 tests passed. Database checks, type/lint/build, and audit passed. Four low findings remain. | Check any later records-only head separately. Keep the earlier failed runs and their stated limits. |
| Customer email wording | Status, invitation, reply, and settled messages use neutral wording. Email tests passed 28 focused cases and 28 in each mode. Real rendered HTML passed at 1280px and 390px. Source `76cdc5a` passed CI. | Vercel reported success; final browser proof is unavailable. Fixture checks do not prove mailbox, email-client, delivery, or full network behavior. |
| Public site | PR #23 at `15ea5f6`: six public routes rendered at 1280px and 390px, with one main heading, no overflow, and no broken completed images. The contact menu and Escape focus return passed at 390px. The first contact FAQ opens. | Remaining navigation, loading, errors, and approved form acceptance |
| Contact and claim intake | Approved October 27 contact, email-consent contact, and no-file intake tests saved their synthetic records. Their approved emails reached Rob. Eight local intake consent boundary cases passed on October 28. | Remaining form boundaries, rate limits, vendor links, file handling, and error states need their supported tests. New hosted data changes need exact approval. |
| Sign-in and recovery | All four role sign-ins and both MFA checks are complete under the approved PR #28 account batch. Recovery displayed Success after the approved hostname addition; no reset email was sent. | Hosted T63 owner and staff focus checks passed. Vendor title/access checks pass on the current Preview; other live recovery and data-changing checks remain open. |
| Invitations | Earlier approved invitations were accepted. Claim 0007 invitation acceptance linked the existing active customer account. Three local reservation-failure cases passed. The unchanged mocked used/expired refusal test passed in the candidate with full type check and file lint under Node 22. | Hosted replay, actual expiry, and remaining final-candidate account behavior remain open. Candidate testing used installed dependencies; no further install is needed. The retained original checkout still lacks broader validation. |
| Owner desk | PR #23 and PR #24 evidence remains valid. On the earlier `5bcc62a` Preview, owner sign-in/MFA passed and 30 route/layout checks passed at 1280px and 390px. Owner Settings confirms Manual signing, bundled PDF, an unset webhook, Supabase project `vdtqxglhlgatpbgehsjk`, and zero pending or failed outbox entries. This closes only provider configuration; real manual signing and legal acceptance remain open. Evidence: `pr28-owner-readonly-acceptance-2026-10-24.json`. | Approved write and disposition tests; real signing and legal review |
| Claim administration | On PR #23, synthetic claim `CMG-2026-0003` passes all six sections at 1280px and 390px. The completed LOR panel and separate claim's manual-provider controls render. No save or download occurs. | Assignment, fee permissions, legal transitions, and approved writes |
| Staff isolation | Earlier hosted role checks passed at both widths. Current local actions refused foreign reassignment and non-owner company changes. AAL2 and own-claim controls passed. | Local framework context was replaced. Additional hosted action proof and full traces remain unverified. |
| Homeowner portal | Earlier hosted uploads, downloads, profile writes, and claim reads retain their scope. Current Preview navigation passed at 1280px and 390px. Local global signout, foreign question/download refusals, and one consent withdrawal passed. | Local framework context was replaced. Additional hosted action proof and full network traces remain unverified. Do not repeat consumed actions. |
| Vendor portal | Earlier hosted reads, titles, refusal pages, and the approved referral retain their scope. Current local tests refused vendor staff/homeowner actions. | Additional hosted action proof and foreign-ID client navigation remain unverified. Do not repeat the referral or resend. |
| Private files | Earlier hosted uploads, hashes, visibility, downloads, invalid-file refusal, and one expired-link refusal passed. Current local foreign/internal download refusals and upload recovery passed. | No allowed-download action runs in the local refusal test. Earlier hosted positive evidence remains separate. Dependencies differ. The PNG checksum remains invalid. Do not issue another link. |
| Upload recovery | Real local interrupted 25 MiB retry passed: one document, refused replacement, unchanged hashes/IDs/versions, and repeat finalization. Earlier mock tests retain their scope. | Additional hosted recovery proof remains unverified. It does not require an automatic repeat. Scheduler attribution remains open. |
| All site modes | Simple, staff, and platform each passed seven files and 285 tests; exit 0 under Node 22.22.2. Durations: 25.74, 41.72, and 28.05 seconds. | Component/mode tests replace Auth/proxy behavior. Earlier actual 39-GET mode evidence remains separate. |
| Mobile and accessibility | Current homeowner navigation passed both widths. Three local error screens and profile loading passed desktop/mobile checks. Six UI tests passed after three expected failures before repair. | Framework context was replaced locally. Retry callbacks ran once. Actual refresh and screen-reader announcement remain unverified. Five synthetic mount logs were expected. |
| Browser diagnostics | Final hosted vendor proof on Ready PR #28 passes 12/12 route-specific refusal checks and four authorized client-navigation checks. No new title defect was found; the activity child page correctly uses “Partner activity.” Full network traces remain unavailable. | Foreign-ID client navigation remains untested. Hosted owner and staff focus checks passed. |
| Earlier listener errors | Fresh owner IAB and staff Chrome overview navigation captured no warning or error. Source search found no extension runtime messaging calls. Staff Tab and Enter navigation passed without writes. | Historical stack and source are unavailable. Do not claim a confirmed extension cause or a repaired application defect. |
| Recovery confirmation budget | Exact PR #23 handler and limiter passed a real disposable SQL-function test: ten allowed, eleven/twelve refused, separate IP, malformed queries, RPC outage, all modes, and 900-second bucket alignment. Auth was stubbed. Transaction rollback restored the entire rate table. | Hosted request behavior and final combined candidate acceptance; no recovery email was sent |

## Operations and release

| Requirement | Current evidence | Release gate |
|---|---|---|
| Migration compatibility | Read-only CMG history matches all 36 versions and the stored head SQL SHA-256. No DDL ran during the approved file tests. Current staging cleanup is recorded below. | Repeat relevant schema/config checks before an approved release write; no migration reapplication |
| Email and cleanup queues | The October 28 read records claim 0007 status mail as sent on attempt one at 14:34:40 UTC. No pending cleanup rows existed. No row completed or became dead during 14:27:30–14:28:30 UTC. Earlier cleanup rows 12 and 13 remain processed. | Status-email inbox receipt and scheduler attribution remain unverified. Do not resend synthetic mail or invoke a worker. |
| Cron and provider operation | October 28 cleanup/outbox HTTP 200 results remain recorded. Cron filter exists. The 10:25–10:40 local query returned `Outside of allowed range`; bounded CLI returned 400. | Attribution remains unverified. Roundcube is at login; Outlook access was rejected as outside approved scope. Status-email inbox receipt remains open. |
| Email operations | The October 27 approved synthetic contact test saved one lead and one staff-alert row. The alert to `rob@miodiollc.com` was sent on attempt one; Resend reports Delivered. No consent row was created. | Inbox receipt passed. Name a monitored reply operator. Preserve the test records; do not resubmit. No agent email or access grant to `cmgpropertysolutions.net` or its subdomains is authorized. |
| Manual PandaDoc signing | Both v3 drafts remain unsent. Recognition, hidden markers, corrected boxes, required fields, and saved signer assignments pass. Exact signed `56cff18` is published in draft PR #25 with six files. CI run `39349972823` passes type, lint, build, audit, 1,686 unit tests, 1,350 pgTAP assertions, and 253 database-backed tests. Unit skips 56 database/live tests; one live PandaDoc test skips in the DB job. The automatic Preview is Ready. All six PDF repair files in candidate `5bcc62a` exactly match tested `56cff18`; prior provider checks remain applicable. | Signing is blocked while sender or recipient notifications can reach a CMG-domain address. No separate non-CMG workspace exists. Legal review and exact approvals remain required for download, upload, send, signing, filing, status, and access tests. Merge and Production release remain excluded. |
| PandaDoc API path | Not selected for first release. Shared Preview keys remain unchanged; approved PR #23 and PR #24 overrides are blank. Candidate branch API and webhook keys are blank under the approved branch settings. | Keep Production manual. Do not send through the API. Verify the candidate's runtime Manual setting in the owner Settings page before claiming hosted verification. |
| Hosting and repository | Fresh API reads confirm Hobby and private personal `develop` with `protected=false`. The user plan is unavailable, not proved Free. Current official commercial-use, pricing, and private-protection requirements are verified. | Confirm billing and existing GitHub eligibility, then obtain separate purchase and protection approvals |
| Privacy and retention | Corrected no-backup preflight and manual request proposal; export tooling and enforced holds remain absent | Owner and legal approval of the procedure comes first. Then verify complete synthetic database/file exports, access limits, and approved hold/erasure controls. |
| Public copy and LOR PDFs | Legal approval remains open | Exact copy and both PDF variants approved second-to-last |
| Production deployment | The public alias resolves to Ready `dpl_GoXHV8n8KfTVt5BDyZosJF3jvXPk`, rebuilt from unchanged `develop` source `1b7f7f9`. PR #24 is Ready as `dpl_Zz8hWeU9yJ8Fm4hdAjKyWRHcbkfE` at unchanged `d523469`. Exactly two approved rebuilds completed. | Any later release requires separate merge and Production approval. This batch did not release PR #24 to Production. |
| Platform activation | The owner recorded platform activation on October 7. Current Production portal and partner requests redirect unauthenticated callers to login. Historical owner-session invitation acceptance is in merged HANDOFF. | Remaining full-platform acceptance; do not request the completed activation again |
| Domain and SEO | `app.` remains the temporary host | Approved SEO and domain work last; preserve every existing DNS record unless an exact change is approved |
| Recovery | Backups declined; immediate restore unverified | Reviewed forward repair, compatible code recovery, and clear operator steps; no backup or database reset |
| Final records | Six records identify source `76cdc5a`, passing Windows and exact-head CI checks, prior failures, and the draft approval packet. Earlier PR #26 records do not establish current status. | Check the final records-only head separately. Standing feature approvals retain their original scope. Merge and Production release need separate approvals. |
| Remaining security scan items | Local signout, role refusals, consent withdrawal, upload recovery, and earlier hosted positive evidence cover the reviewed engineering paths. | Finish resulting CI/Preview, mail/scheduler evidence, safe signing, and owner operational/legal/release decisions. Extra hosted proof does not require automatic repeats. |

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

Published `cc27f38` passed 1,773 unit tests, with 65 skipped, plus type, lint, build, CI, and mode checks.
The email batch passed build, browser, and mode checks. Its full unit run failed one glob timeout before repair.
The first adapter repair passed 20 focused tests, nine independent checks, and local type/lint.
Its Windows suite passed 1,795 tests and skipped 65 in 538.00 seconds, with exit 0.
Head `8b1aecb` failed Linux CI: 1,792 passed, three failed, and 65 skipped.
Root repair `76cdc5a` passed 21 focused tests, type/lint/diff/review, and exact-head Linux CI with 1,796 tests passed and 65 skipped.
The final Windows suite passed 1,796 tests and skipped 65 in 514.89 seconds, with exit 0.
Vercel reported deployment success, but final browser proof is unavailable. The database CI job passed.
Real local signout and access checks passed seven tests. Earlier upload, audit, and worker-failure evidence remains recorded.
Read final-head CI and Preview results from PR #28.
Earlier evidence in session scratch: `t65-full-checks-2026-10-25`, `cmgps-undici-audit-2026-10-24`, `launch-candidate-mode-checks-2026-10-26T04-00-24-349Z-08162a93.json`, and `t65-vendor-title-hosted-2026-10-26.json`.

The email batch production build passed before the tooling-only lint-glob repair. Application source did not change afterward.
Production remains on `1b7f7f9`. Earlier read-only acceptance caused normal Auth records only. The separately approved October 27 submissions changed hosted synthetic records. October 28 reads confirmed later mail status without manual resend or worker invocation.

Do not mark the goal complete while a required row lacks evidence or an approved operational procedure.
Optional photography does not block launch unless the owner makes it a requirement.
Do not treat the historical simple-mode roadmap as approval to omit full-platform acceptance.
