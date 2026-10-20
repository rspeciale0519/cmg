# Full-platform launch checklist

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
| Dependency audit and local checks | Both jobs pass in CI run `39351780332` at exact `d523469`: 1,740 unit tests, 1,350 pgTAP assertions, 243 selected DB tests, type check, lint, build, and zero-vulnerability audit. Unit skips 57 database/live tests; DB skips one live PandaDoc test. The earlier disposable selection passed the real session test. Its automatic Preview is Ready. | Remaining hosted acceptance. HANDOFF retains the earlier timeout and its verified repair. |
| Public site | PR #23 at `15ea5f6`: six public routes rendered at 1280px and 390px, with one main heading, no overflow, and no broken completed images. The contact menu and Escape focus return passed at 390px. The first contact FAQ opens. | Remaining navigation, loading, errors, and approved form acceptance |
| Contact and claim intake | On PR #23, both widgets complete without submission. Four contractor fields are optional. Yes reveals four second-person fields; No removes them. Contact has two invalid required controls; intake has twenty-three. Upload selection is enabled after hydration; no file was selected. | Server validation, rate limits, consent, vendor referral links, upload limits, persistence, and email delivery require separately approved data-changing tests |
| Sign-in and recovery | Owner and staff sign-in/MFA and separate homeowner sign-in on PR #23 are complete. Recovery verification passes without submission. The local password fix passed real disposable-session revocation and error-path tests. | Failed login, sign-out, user-performed recovery, and final combined candidate acceptance |
| Invitations | Three hosted test invitations were accepted. Resend records staff, vendor, and corrected homeowner invitations as Delivered. PR #19 shows a generic expired-link page for `not-a-token`, without captured console warnings or errors. | Replay refusal, actual expired links, role assignment, and recovery on the final candidate |
| Owner desk | On PR #23, eight owner pages pass at both widths. Company detail, claim search empty state, Clear, and three-result Under review filtering pass. PR #24 owner MFA, Settings, safe Recheck loading/success, document controls at both widths, and cross-role redirects also pass without data writes. | Approved write and disposition tests |
| Claim administration | On PR #23, synthetic claim `CMG-2026-0003` passes all six sections at 1280px and 390px. The completed LOR panel and separate claim's manual-provider controls render. No save or download occurs. | Assignment, fee permissions, legal transitions, and approved writes |
| Staff isolation | Signed-in Staff1 Tester opens assigned claim `CMG-2026-0005`. Unassigned `CMG-2026-0003`, a missing claim, and four owner-only pages have the same generic refusal. The claims list shows only its assigned claim. Captured application-origin warning/error logs are empty after browser recovery. | Direct action refusals, owner-only writes, remaining keyboard states, and full request traces |
| Homeowner portal | PR #23 reads pass for two owned claims, profile, activity, document list/empty state, redirects, keyboard controls, and sixteen layouts. Foreign, missing, and invalid IDs have matching settled refusals. PR #24 homeowner upload, oversize refusal, exact saved download bytes, audit, and internal-file list exclusion now pass. | Approved questions/profile/password/consent writes, sign-out, and remaining direct-action tests |
| Vendor portal | PR #23 empty-company checks remain valid. PR #24 passes eight positive layouts, eight identical claim refusals, and six role redirects at 1280px and 390px. Claim 0005 is the only listed claim. Its customer-only activity stays hidden, and settlement remains private. Keyboard return passes. The approved Partner note persists once after owner reload and appears once for the vendor at both widths. Database inspection confirms its `partner` audience and zero outbox rows created since the test began. The owner intake link opens the correct Preview form without submission. Captured owner/vendor warning and error logs are empty. | Referral submission, notifications, direct actions, and full request traces remain open. New writes need exact batch approval. |
| Private files | Hosted owner/homeowner 25 MiB uploads, hashes, visibility, and two audited downloads pass. The nine-byte invalid owner PDF was refused. Its session is cancelled, verification is null, and its exact path has zero document rows. One expiry replay of the same link, 379.358 seconds after issuance, returned Storage JSON 400 `InvalidJWT`; no file bytes rendered. One audit row remains. | The saved size is 68 bytes. Its MD5 matches the recorded Storage ETag; no remote SHA-256 comparison is available. Its IDAT checksum fails; image-decoder validity is not proved. Direct internal-action refusal, non-overwrite, and interruption/retry remain open. Full raw request traces remain unavailable. Do not issue another link. |
| Upload recovery | Read-only checks confirm zero staging objects, zero unaccepted copies, and zero document rows for the exact invalid-file paths. Cleanup queue rows 12 and 13 each processed once without error or dead marker. | Cleanup state passes; scheduler attribution remains unverified. Hosted interruption/retry remains open. No retry or manual cleanup is authorized. |
| All site modes | All eighteen local combined-source checks pass across simple, staff, and platform. PR #24's approved platform Preview now passes eight entry/redirect/header checks at `e142f5f`. Token-free recovery retains no-store/no-referrer. Production is unchanged. | Authenticated role behavior on the combined security Preview |
| Mobile and accessibility | Recorded role layouts pass. Vendor Right Arrow reveals the full profile link, and Enter opens it. Owner invitation disclosures pass at measured 390px/1280px. Audit disclosure, filter, clear, and page controls pass at 390px. Overrides are cleared. | Remaining role/loading/error states and full request traces. No CSS repair was needed for the tested vendor menu. |
| Browser diagnostics | PR #23 owner checks capture no application-origin warning or error. Cloudflare-frame console entries remain recorded despite successful verification. Six public entry-route HTTP checks carry CSP and HSTS. | Full request traces, remaining roles, and release headers; do not claim a clean third-party console |
| Earlier listener errors | Fresh owner IAB and staff Chrome overview navigation captured no warning or error. Source search found no extension runtime messaging calls. Staff Tab and Enter navigation passed without writes. | Historical stack and source are unavailable. Do not claim a confirmed extension cause or a repaired application defect. |
| Recovery confirmation budget | Exact PR #23 handler and limiter passed a real disposable SQL-function test: ten allowed, eleven/twelve refused, separate IP, malformed queries, RPC outage, all modes, and 900-second bucket alignment. Auth was stubbed. Transaction rollback restored the entire rate table. | Hosted request behavior and final combined candidate acceptance; no recovery email was sent |

## Operations and release

| Requirement | Current evidence | Release gate |
|---|---|---|
| Migration compatibility | Read-only CMG history matches all 36 versions and the stored head SQL SHA-256. No DDL ran during the approved file tests. Current staging cleanup is recorded below. | Repeat relevant schema/config checks before an approved release write; no migration reapplication |
| Email and cleanup queues | October 19 read: 35 mail rows are 24 sent and 11 dead, with none pending/failed. October 20 read: all 13 cleanup rows are processed, with no errors or dead rows. Rows 12/13 completed at 14:27:40 UTC after one attempt. The exact invalid-file staging/copy paths are absent. | Cleanup state passes. Scheduler attribution and interruption/retry remain open; never resend synthetic dead messages |
| Cron and provider operation | Both daily schedules remain recorded. The October 19 historical CLI request returned HTTP 400. Browser history permits Last hour; longer windows require Pro. The Production/Cron Job hour has zero records and excludes cleanup completion. Both jobs share the Hobby 14:00–14:59 UTC window; order is not guaranteed. | Successful scheduled execution, log coverage, inbox receipt, and approved delay. Cleanup completion now passes; no job was invoked |
| Email operations | Historical Resend delivery evidence and the operator proposal remain recorded. The current owner Inbox search has no exact reset-subject match; no message was opened. The other test mailbox is at login. | Named operator, procedure approval, current inbox receipt, monitored replies, and recovery checks. Do not infer failure from one Inbox search or resend dead synthetic mail. |
| Manual PandaDoc signing | Both v3 drafts remain unsent. Recognition, hidden markers, corrected boxes, required fields, and saved signer assignments pass. Exact signed `56cff18` is published in draft PR #25 with six files. CI run `39349972823` passes type, lint, build, audit, 1,686 unit tests, 1,350 pgTAP assertions, and 253 database-backed tests. Unit skips 56 database/live tests; one live PandaDoc test skips in the DB job. The automatic Preview is Ready. | Legal review and an exact approved real-claim Preview download, provider upload, send, signing, filing, status, and access test. Merge and Production release remain excluded. |
| PandaDoc API path | Not selected for first release. Shared Preview keys remain unchanged; approved PR #23 and PR #24 overrides are blank. | Keep Production manual. Do not send through the API. |
| Hosting and repository | Fresh API reads confirm Hobby and private personal `develop` with `protected=false`. The user plan is unavailable, not proved Free. Current official commercial-use, pricing, and private-protection requirements are verified. | Confirm billing and existing GitHub eligibility, then obtain separate purchase and protection approvals |
| Privacy and retention | Corrected no-backup preflight and manual request proposal; export tooling and enforced holds remain absent | Owner and legal approval, synthetic completeness tests, and workable operator controls or approved implementation |
| Public copy and LOR PDFs | Legal approval remains open | Exact copy and both PDF variants approved second-to-last |
| Production deployment | Current `develop` is `1b7f7f9`; GitHub associates it with the Ready Production deployment resolved by the public alias. PR #22 is already merged. | Any security release requires separate merge and Production approval; no Production write is currently approved |
| Platform activation | The owner recorded platform activation on October 7. Current Production portal and partner requests redirect unauthenticated callers to login. Historical owner-session invitation acceptance is in merged HANDOFF. | Remaining full-platform acceptance; do not request the completed activation again |
| Domain and SEO | `app.` remains the temporary host | Approved SEO and domain work last; preserve every existing DNS record unless an exact change is approved |
| Recovery | Backups declined; immediate restore unverified | Reviewed forward repair, compatible code recovery, and clear operator steps; no backup or database reset |
| Final records | This checklist is open | Current release records, exact passed and skipped checks, unresolved gates, and owner acceptance |
| Remaining security scan items | Local branch combines PR #23, legacy signatures, global sign-out, stored-filename sanitation, and recovery privacy headers. Combined full unit passes 1,710 tests. The later header repair passes 45 focused tests, type/lint/build, and eighteen mode checks. DB selection passes 244 tests, including real sessions. Unchanged SQL retains 1,350 passing pgTAP assertions. | Combined hosted acceptance and separate Git/release approval. Exact skipped checks and test sequence remain in HANDOFF. |

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

Current review supersedes the older integration plan. PR #22 already merged the combined fixes; no new combined PR or old-branch merge is needed.
The old `9a80e09` Preview rebuild passed on October 13 and remains historical evidence.
Current v2 Preview has six public 200 responses and six private 307 closures, all with CSP and HSTS.
PR #24 is the combined security candidate. An isolated actual-function test reproduced three unsafe redirects in current develop and confirmed their correction.
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

Do not mark the goal complete while a required row lacks evidence or an approved operational procedure.
Optional photography does not block launch unless the owner makes it a requirement.
Do not treat the historical simple-mode roadmap as approval to omit full-platform acceptance.
