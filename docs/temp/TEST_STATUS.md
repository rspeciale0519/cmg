# Platform test status — 2026-10-28

This is a summary of the current evidence. See `LAUNCH_CHECKLIST.md` and `HANDOFF.md` for details and earlier results. A partial pass does not close a wider requirement.

## Current verification

Signed and pushed root repair: `76cdc5aea68cd5733ba93b00eff61a3b2ecb7714`.
It is 22 commits ahead and zero behind verified GitHub base `1b7f7f98e54a358b3a95875483a63d3f882573a3`, with 62 changed files.
No schema or generated database-type diff exists.

The repair changes one condition, adds a virtual-working-directory regression, and corrects one README statement.
The regression failed before repair by blocking an attempted `C:/` read. After repair, 21 focused tests passed in 2.13 seconds.

Final type, lint, diff, and review checks passed.
The final Windows suite passed 1,796 tests and skipped 65 in 514.89 seconds, with exit 0; 133 files passed and 17 skipped.
It used Node 22.22.2 and unchanged default one-worker settings.
Scratch log: `glob-root-final-full-suite-2026-10-28.log`. Later records-only head checks remain separate.

Exact-head [CI 40735491808](https://github.com/rspeciale0519/cmg/actions/runs/40735491808) passed verify `122982775518` and database `122982775171`.
Unit tests passed 1,796 and skipped 65 in 105.75 seconds; 133 files passed and 17 skipped.
All 17 scope tests passed in 48 ms; four existing compatibility tests passed in 113 ms.
Audit, type check, lint, and build passed; audit retained four low findings.
Build compilation took 13.8 seconds, TypeScript took 15.7 seconds, and static generation completed all five pages.

Database CI passed 1,350 pgTAP assertions across 44 files.
Database Vitest passed 253 tests and skipped one live PandaDoc test in 27.84 seconds; 35 files passed and one skipped.
Vercel reported success for deployment `5SBC1nMrrWGhBHXXWfgDrgwvpPZL`. Final browser proof remains unavailable.

Earlier head `8b1aecb` failed [CI run 40734242301](https://github.com/rspeciale0519/cmg/actions/runs/40734242301).
Verify job `122978378239` passed 1,792 tests, failed three, and skipped 65 in 97.17 seconds.
Of 150 files, 132 passed, one failed, and 17 skipped.
All three failures were new glob-scope tests whose read guard received `/` on Linux.
The filesystem-root fallback restored ancestor traversal. Repair `76cdc5a` addresses that condition; its exact-head Linux CI now passes.
Audit, type check, and lint passed; audit retained four low findings. The build step skipped after the test failure.

Database job `122978378566` passed 1,350 pgTAP assertions across 44 files.
Database Vitest passed 253 tests and skipped one live PandaDoc test; 35 files passed and one skipped.
Vercel reported success for deployment `CFZf6BF6p8awJzrEZhmmZ5ejAoMx`.
The browser control API was unavailable. Final browser proof remains unverified.
The later Linux CI and final Windows passes supersede this failure for the repaired source.

## Earlier published verification

Signed commit `cc27f380ba58eaf4ed06c8d90af7a43eac9b5e57` is pushed to draft [PR #28](https://github.com/rspeciale0519/cmg/pull/28). Its thirteen files contain eight source/test files and five release records.

- [CI run 40724185151](https://github.com/rspeciale0519/cmg/actions/runs/40724185151) passed for that exact commit. Unit tests: 1,773 passed and 65 skipped. Type, lint, build, and audit passed. Audit has four low findings.
- Database CI passed 1,350 pgTAP assertions across 44 files. Database Vitest passed 253 tests and skipped one live PandaDoc test.
- Access, signout, password-session, and upload-recovery tests remained opt-in and skipped in CI. Their real local passes remain separate evidence.
- [Preview deployment 3ucqe9EgAwCfRk7Mq5BafwXdaiiR](https://vercel.com/robs-projects-c72886ba/cmgps/3ucqe9EgAwCfRk7Mq5BafwXdaiiR) was Ready for the same commit. Its branch alias pointed to that deployment at that check. Both build warnings describe the required Node 22 override of project setting 24; no setting changed.
- The homeowner portal opened after the new deployment. Its existing session and three synthetic claim links remained available. CodeRabbit reported `Review skipped`; this is not a completed review.

This verification covers `cc27f38` only. Later head `8b1aecb` failed Linux CI, as recorded above. Production, DNS, and hosted data did not change during that earlier verification.

## Email and lint-glob evidence

Signed email commit: `27cfd6b221060c0b2faf1b406f8b2494ec3c7ce4`.
Signed first adapter commit: `4ee40506c50001f29ba0bd1e7822416175ea7873`.
At `4ee4050`, the source was 20 commits ahead and zero behind verified `origin/develop` at `1b7f7f98e54a358b3a95875483a63d3f882573a3`, with 61 changed files.
No Supabase or generated database-type diff exists. Later records-only commits can advance the head; read final PR-head checks externally.

The read-only provider preview exposed wording that implied representation for an `under_review` claim. Current status rules do not establish representation at that stage.
Local templates now use neutral wording for status, customer invitation, customer-visible reply, and settled notices.
Email tests passed 28 focused cases and 28 cases in each of `simple`, `staff`, and `platform` modes.
Final type check and lint passed under Node 22.22.2 after the lint-glob repair.
The application build passed after email changes and before the tooling-only glob repair. Application source did not change afterward.
The new `npm audit --audit-level=high` returned exit 0 with four low deepmerge-chain findings and no available fix.
No package changed. Scratch log: `email-glob-audit-2026-10-28.log`.

Before the glob repair, the full unit run passed 1,778 tests, failed one, and skipped 65 in 354.28 seconds.
A focused rerun passed three tests and failed one in 8.59 seconds.
Both failures were a 5,000 ms timeout in the glob test.
Guarded diagnosis confirmed broad ancestor traversal outside the working directory.
The repaired adapter passed 20 focused tests in 1.51 seconds: 16 new scope cases and four unchanged configuration cases.
Nine independent virtual-filesystem compatibility checks passed under Node 22 without ancestor or network enumeration.
The final default Windows one-worker suite passed 1,795 tests and skipped 65 in 538.00 seconds, with exit 0.
Of 150 files, 133 passed and 17 skipped. Scratch log: `email-glob-final-full-suite-2026-10-28.log`.
This passing Windows run superseded the earlier Windows timeout for that source. It does not override the later Linux CI failure.
This diagnosed failure is distinct from the earlier worker-start failures, whose cause remains unconfirmed.

The adapter supports `globSync(string, { onlyDirectories: true })`; other options and non-string patterns still throw.
Absolute paths and leading-parent paths with a literal prefix use the narrower search. Other leading-parent patterns retain tinyglobby behavior.
UNC traversal remains unsupported. These checks do not cover every matcher combination.

Four real rendered email outputs passed browser checks at 1280px and 390px with synthetic values and `example.invalid` links.
Neutral wording, body/footer display, and horizontal fit passed. Captured console warnings and errors were zero.
No CTA or phone link was activated. Normal viewport captures supplied layout evidence; full-page captures changed sizing and were excluded.
The viewport was reset. These checks do not prove mailbox, email-client, delivery, or full network behavior.
Evidence, source hashes, HTML hashes, and shutdown checks remain in session scratch under `cmg-email-copy-preview-2026-10-28`.
The loopback fixture server was stopped after its process and port ownership were verified. Files and browser tabs remain retained.

## Passed within the stated scope

- Published eight-file UI/test batch: full type check, lint, and build passed under Node 22.22.2. Unit results: 1,773 passed, 65 skipped; 132 files passed, 17 skipped; 288.06 seconds; exit 0.
- Earlier baseline `72bd57c` passed CI run `40718012838`: 1,768 unit tests passed, 58 skipped; 1,350 pgTAP assertions and 253 database tests passed. One live database-selection test skipped. Preview `A7bzAYRkUfogAW5FE36wLUjf8ze1` was Ready. These checks predate `cc27f38` and the pending repairs.
- Six focused UI tests passed after three expected failures before repair. Portal/partner controls use `retry()`; profile loading text is outside `aria-hidden`.
- Real local signout passed 1/1 in 9.49 seconds. Global logout, caller clearing, second-refresh refusal, `/login` redirect, and one audit passed. Audit `2071` remains retained. Access tokens can last until expiry.
- Real local access checks passed 6/6 in 16.99 seconds. Named role refusals and one caller-owned consent withdrawal passed. Audit `2081` and fixtures remain retained; exact IDs are in HANDOFF.
- Current homeowner Preview header, cards, switcher, and claim 0007 tabs passed keyboard, focus, scroll, and layout checks at 1280px and 390px. No overflow or console errors were captured.
- Three local error screens and profile loading passed both widths. Generic text and digests rendered; retry callbacks ran once. Five synthetic mount errors were expected.
- Simple, staff, and platform each passed seven files and 285 tests under Node 22.22.2, with exit 0. Durations were 25.74, 41.72, and 28.05 seconds. Components, mode rules, and mocked Auth/proxy behavior were tested. Earlier actual 39-GET mode evidence remains separate.
- PR #28 at `bacb4cf`: GitHub verify and database checks passed; Preview was Ready. This does not release the candidate to Production.
- Owner and staff Preview menus passed recorded desktop, 390px, and keyboard checks. Customer claim 0007 activity and empty documents fit at 390px.
- On PR #28 Preview, customer claim 0007 activity and document form controls passed forward and reverse keyboard-focus checks. No form was submitted.
- On the PR #28 branch Preview, the existing homeowner session opened `/portal/profile`. The page had one main heading and no horizontal overflow at 390px and 1280px. All six visible inputs had associated labels. Keyboard focus reached profile, password, and consent controls with visible outlines. The consent disclosure opened and closed with Enter; its withdrawal button was focused but not activated. Console warnings/errors were empty. No values, passwords, consent, or profile records were submitted. Full request traces were unavailable. The viewport override was reset.
- Synthetic contact and intake submissions and claim 0007 invitation were completed once. Their approved emails to Rob reached his inbox. The customer opened claim 0007.
- Candidate `bacb4cf` passed eight local intake consent boundary cases under Node 22.22.2. Missing and false consent values were refused; accepted values produced email and SMS consent rows for the primary homeowner. Scratch evidence is `intake-consent-boundary.test.ts` and `intake-consent-config.mjs`. Browser submission and database persistence were not tested in this run.
- Candidate `bacb4cf` passed three local mocked invitation reservation-failure cases under Node 22.22.2. Null reservation, missing attempt ID, and RPC error returned a refusal before account creation. Scratch evidence is `invite-reservation-boundary.test.ts` and `invite-reservation-config.mjs`. Hosted authentication and database behavior were not tested.
- Candidate `bacb4cf` passed a local outbox retry test under Node 22.22.2. A mocked failure scheduled a 60-second retry, and the next mocked success reused the same idempotency key. Scratch evidence is `outbox-retry-boundary.test.ts` and `outbox-retry-config.mjs`. The provider and store were mocked; scheduled execution and real delivery remain unverified.
- The hosted outbox recorded claim `CMG-2026-0007` status email as sent on attempt 1 at 2026-10-28 14:34:40 UTC. It was pending with zero attempts at 14:24 UTC. Inbox receipt and scheduler attribution remain unverified. No manual resend or job invocation was performed.
- Production logs show HTTP 200 for `/api/cron/storage-cleanup` at 2026-10-28 14:27:36 UTC and `/api/cron/outbox` at 14:34:37 UTC, on deployment `dpl_GoXHV8n8KfTVt5BDyZosJF3jvXPk`. The latter preceded the sent record by about three seconds. The logs do not identify the requester or processed records; attribution and cleanup effects remain unverified.
- A read-only query of CMG project `vdtqxglhlgatpbgehsjk` found no pending cleanup rows and no rows processed or marked dead during 2026-10-28 14:27:30–14:28:30 UTC. Two synthetic rows were processed on 2026-10-20 at 14:27:40 UTC, one attempt each. The records do not identify the requester.
- The candidate's private-upload component test includes a lost-finalization-response retry case. All three focused cases passed. Storage and finalization were mocked. This mocked run does not prove real interruption or recovery; the separate local result appears below. Published CI and Preview evidence is recorded above.
- Candidate server-side finalization tests passed six focused cases, including exact and mismatched document readback after an insert error. Database and Storage operations were mocked. Real commit recovery and thrown network errors remain unverified. Published CI and Preview evidence is recorded above.
- Hosted owner and homeowner uploads at 25 MiB, size-limit refusal, visibility, saved-file hashes, and audited downloads passed for the recorded fixtures. The invalid owner PDF was refused and its staged objects were cleaned up.
- The unchanged invitation refusal test passed one focused test, full type check, and file lint in the candidate under Node 22. Used and expired invitations returned the same error without reservation or account creation. Its file SHA matches the original test. Existing candidate dependencies were used; no install was needed. The original isolated checkout remains retained and uncommitted, with its broader checks unverified. Hosted replay and actual expiry remain unverified.
- On disposable stack `CMGPA_private_upload_disposable`, test customer 0004 could insert a question on own claim 0001 but was refused on foreign claim 0002. The transaction rolled back, leaving no test events.
- Candidate `bacb4cf` passed two mocked `askQuestion` checks under Node 22.22.2. The foreign claim produced no event insert or notification call; the positive control reached both mocks. Scratch evidence is `foreign-question.test.ts` and `foreign-question-config.mjs` in the session scratch directory. Real outbox and hosted behavior are not proved.
- Candidate `bacb4cf` passed a mocked homeowner download-refusal test under Node 22.22.2. Missing or inaccessible rows and a lookup error returned the same refusal before privileged client creation or audit. Scratch evidence is `foreign-download.test.ts` and `foreign-download-config.mjs` in the session scratch directory. Real RLS and hosted behavior are not proved.
- Candidate `bacb4cf` passed five mocked owner-only partner-status action checks under Node 22.22.2. Four non-owner roles were refused before a company write; an AAL2 owner reached the mocked operation. Scratch evidence is `owner-action-boundary.test.ts` and `owner-action-config.mjs` in the session scratch directory. Hosted behavior is not proved.
- The disposable database refused a seeded vendor's direct activity insert on its linked claim. The transaction rolled back and the test event was absent afterward. Application actions and hosted behavior are not proved.

- The opt-in `private-upload-recovery.local.test.ts` passed one real test under Node 22 in 31.53 seconds, with exit 0. It used `CMGPA_private_upload_disposable`. An interrupted 25 MiB signed PUT retried in the same session and created one document. Changed-byte signed-token replay and duplicate copy were refused; hashes, IDs, versions, and repeated finalization stayed unchanged. Type check and focused lint passed; disabled mode skipped one test. Hosted recovery remains unverified, and the synthetic fixture remains retained.

Resend confirmed claim `CMG-2026-0007` status-email delivery to `rob@miodiollc.com` on October 28 at 10:34 AM. Provider ID `01a182ef-3fc8-7258-b332-be9ff214b502` returned SMTP `250 OK`. This proves recipient-server acceptance, not inbox placement. Roundcube receipt and scheduler attribution remain unverified. No email was resent.

See the [release approval packet](RELEASE_APPROVAL.md) for the remaining decisions and exact release preflight.

## Failed or limited checks

- Local action tests replace framework context. They do not exercise Next.js HTTP actions or browser cookies. The download-refusal case has no allowed-download action.
- Earlier hosted downloads, hashes, and audits provide separate positive evidence. Relevant source blobs match tested `d523469`, with no migration change. Dependencies differ.
- Local error/loading checks do not prove actual server refresh or screen-reader announcement. Full browser traces remain unavailable.
- Vercel has a Cron filter. At noon, the October 28 10:25–10:40 local query returned `Outside of allowed range`; bounded CLI returned 400. Neither identifies the scheduler caller.
- Roundcube remains at login. Automatic approval review rejected Outlook access because it was outside approved scope. Status-email inbox receipt remains pending.
- An earlier Vite audit failed on draft PR #26's inherited dependencies. The combined candidate has a later passing audit; that does not change the older PR's result.
- The 68-byte downloaded PNG has an invalid IDAT checksum. It does not prove image decoding.
- Full network traces were unavailable for earlier browser tests. Historical Cloudflare and listener errors have no confirmed cause.
- The earlier October 28 default-worker run failed: 1,697 tests passed, four failed, and 57 skipped. Vitest also reported ten worker-start errors. Failures affect Turnstile and the ESLint configuration. The cause is not yet confirmed. Candidate type-check, lint, and build passed. Audit passed the high-severity threshold with four low findings.
- A serial rerun of the two failed files passed all seven tests. That focused rerun alone did not establish a full-suite pass or the cause of the earlier worker errors.
- A subsequent full serial run passed: 128 files passed, 14 skipped; 1,767 tests passed, 57 skipped. It returned exit 0 after 701.35 seconds. This supersedes the failed run for the tested source, but the default-worker startup failure cause remains unconfirmed. Later finalization assertions passed six focused tests and full lint. The real local upload test passed once; its type, focused lint, and disabled-mode checks also passed.

## Blocked or awaiting approval

- PandaDoc signing is blocked until sender and recipient notifications cannot reach a CMG-domain address. Existing drafts remain unsent.
- PandaDoc documents an API [silent-send option](https://developers.pandadoc.com/reference/send-document) that excludes approval-workflow notifications. This does not prove that the manual flow is safe. [Link sharing](https://support.pandadoc.com/en/articles/15049117-share-document-link-with-your-recipients-classic-experience) can activate reminders, and [signing order](https://support.pandadoc.com/en/articles/9714771-signing-order) can send emails. The owner has no separate non-CMG workspace. No send or configuration change was made.
- Hosted data-changing tests, new messages, uploads, signatures, shared-branch merges, and Production releases need exact separate approval. Do not repeat consumed approvals.
- The declined installation in the original invitation checkout no longer blocks this candidate test. Candidate focused, type, and file-lint checks passed with installed dependencies. No further install is needed. Broader checks for the retained original checkout remain unverified.
- Legal wording, hosting, monitoring, retention, customer access, contact addresses, and final release decisions remain open.
- The subject-request and export procedure needs owner and legal approval. Then test complete synthetic database/file exports, access limits, and approved hold/erasure controls. These policy-dependent checks remain incomplete.

## Untested or not fully verified

- Additional hosted action refusals and runtime accessibility proof remain unverified. Named local refusal and browser checks passed.
- Hosted private-upload interruption, retry, and non-overwrite. Existing local tests do not prove the hosted path.
- Additional hosted invitation replay, expiry, consent, and session proof remains unverified. This does not require automatic repeated hosted writes.
- Scheduler attribution, cleanup work during the successful endpoint request, and claim 0007 status-email inbox receipt remain unverified. Do not manually resend it.
- Both end-to-end manual signing variants and final-candidate launch acceptance. No Production launch is authorized by this record.

## Ordered remaining actions

1. Check the final records-only PR head CI and Preview separately. Preserve the verified source results and browser evidence limits.
2. Verify status-email inbox receipt and scheduler attribution through approved reads. Roundcube sign-in and available scheduler logs are required. Do not resend or invoke jobs.
3. Establish a manual signing test that cannot notify CMG-domain addresses. Obtain legal approval and exact approvals for its external actions.
4. Resolve hosting, repository protection, monitoring, monitored replies, retention, legal holds, export, erasure, customer access, and contact-address decisions. Preserve the no-backup decision.
5. Obtain separate shared-branch merge and Production release approvals. Verify the approved live release and operating instructions. A merge to `develop` can deploy automatically.
6. Approve final public copy and both PDF variants. Complete any agreed SEO and domain work last, with exact DNS approval.

Keep local and hosted evidence within its recorded limits. Additional unverified hosted proof does not require automatic repeated submissions. The launch remains incomplete.
