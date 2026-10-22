# CMG Programming Completion Plan

Prepared October 22, 2026. Scope: finish the existing CMG website/application programming, integration, technical verification, and release preparation. Excludes selling the website, pricing the sale, collecting payment, and customer commercial negotiations.

## Bottom line

CMG is not at the beginning of a build. The core platform and many hosted workflows already exist and have passed documented tests. It is not yet technically finished: several fixes are still in separate unmerged branches; the complete manual-signing workflow remains unproved; some role/write/recovery cases remain untested; and privacy/export/hold controls require a defined implementation or an explicitly approved workable operating alternative.

The next step is one reviewed release candidate and one evidence-based completion checklist, not another feature expansion. No reliable completion percentage or calendar estimate can be assigned until the remaining write tests and privacy-control scope are resolved.

This plan was produced from current GitHub metadata, source inspection, and the October 21 release evidence. It is not a fresh execution of the test suite or hosted acceptance. “Verification remaining” does not mean the feature is broken or absent.

## Status legend and authority

- **COMPLETE / preserve evidence:** already demonstrated in the recorded scope. Do not repeat one-time hosted actions.
- **INTEGRATE:** implemented on an unmerged branch; review and combine before final acceptance.
- **VERIFY:** code exists, but the required final behavior lacks sufficient evidence.
- **IMPLEMENT / decide scope:** an actual implementation gap or a control needing an approved operating alternative.
- **INPUT GATE:** a specific owner/legal/access decision needed for a technical step; not a sales task.

The request authorizes this document, not implementing the list. Shared merges may deploy automatically. Production deployments, hosted writes, emails, signatures, purchases, credential/security changes, destructive actions, and DNS changes retain their separate approval requirements. Preserve unrelated local edits, old drafts, synthetic fixtures, and audit records.

## 1. Establish the exact release baseline

**Status: INTEGRATE. Dependency: none.**

Current integration branch is `develop` at `1b7f7f98e54a358b3a95875483a63d3f882573a3`. The most current records are on `codex/launch-release-evidence`, not the stale October 7 release document on develop.

All these PRs were open, draft, and unmerged when checked:

| PR | Purpose | Exact head | Current exact-head CI |
|---|---|---|---|
| #23 | Original security work | `15ea5f6a5d21a9b66bef84e8f61d24d3a1a5e26c` | Passed |
| #24 | Combined security, upload/session fixes | `d523469e88149c76b8181ed4f277d757f608f47c` | Passed |
| #25 | Manual PDF corrections | `56cff18e2e9f0e7f115dfd1d4b953ba7dad87e26` | Passed |
| #26 | Reconciled release records | `e51d2f299e9d0094954f45111b3e117d1a23b0d0` | Dependency audit failed; database passed; other verify stages skipped |
| #27 | Development Vite dependency repair | `5c3886d6cb555341746f22c1da49d778eead85a5` | Passed |

- [ ] Inspect the current checkout and preserve unrelated edits before starting implementation.
- [ ] Review #24, #25, and #27 together and reconcile #26's records.
- [ ] Do not apply #23 separately: exact ancestry proves #24 already includes it.
- [ ] Reconcile #24's description with its actual inherited SECURITY_SCAN_2026-10-17.md file; distinguish that file from the unpublished local report correction.
- [ ] Obtain a substantive review of the combined diff. Zero submitted GitHub reviews were present. CodeRabbit “success” means draft review was skipped, not approval.
- [ ] Create one controlled integration candidate only when implementation/integration is authorized. Recheck current heads first.
- [ ] Do not merge merely because GitHub says mergeable. The four relevant PR file sets are disjoint, but that does not prove combined behavior.

**Done when:** one exact candidate SHA contains the selected security, PDF, dependency, and current documentation work; scope is reviewed; unrelated changes remain untouched; its complete check results are recorded.

## 2. Run the complete combined-candidate verification

**Status: VERIFY. Depends on 1.**

- [ ] Run dependency installation verification, vulnerability audit, type checking, lint, normal production build, and full unit suite.
- [ ] Run all pgTAP checks and selected database integration suites.
- [ ] Run the real password/session integration test explicitly; ordinary selected CI is not proof that this special test ran.
- [ ] Check simple, staff, and platform modes, including redirects and disabled routes.
- [ ] Verify the selected Preview uses the intended public URL, platform mode, manual signing provider, and correct security headers.
- [ ] Account for every skipped test. A skipped live PandaDoc test must not appear as passed.
- [ ] Keep the dependency audit enabled. #27 fixes development Vite; its standalone green checks do not validate combined #24/#25 functionality.
- [ ] Investigate any recurring timeout with evidence rather than weakening assertions or increasing limits to hide a failure.

**Done when:** all required automated checks pass on the same candidate, every skip is categorized, and remaining live checks have explicit cases and prerequisites.

## 3. Finish public contact and claim-intake acceptance

**Status: VERIFY; fix only reproduced defects. Depends on 2.**

- [ ] Contact: required-field/server validation, invalid input, CAPTCHA failure/expiry, rate limits, persistence, confirmation, and staff notification.
- [ ] Intake: all required and optional fields, second-policyholder Yes/No behavior, consent, and consistent client/server validation.
- [ ] Test upload number, size, and content limits; failed upload/finalization must not leave a falsely successful claim.
- [ ] Test direct intake without a vendor code and valid public vendor-link intake.
- [ ] Reject invalid, unknown, and inactive vendor references safely.
- [ ] Verify server-side provenance cannot be overridden by public partner IDs or contractor details.
- [ ] Keep optional contractor details separate from homeowner identity and consent.
- [ ] Verify public referral attribution does not itself grant vendor access to a claim.
- [ ] Preserve immutable reservation behavior when a vendor is deactivated.
- [ ] Verify omitted new loss time is null while supported legacy values remain intact.
- [ ] Test interruption, repeated clicks, retry, and recovery without duplicate claims, claimants, consents, files, or notifications.
- [ ] Verify loading, focus, errors, and confirmation on mobile and desktop.

**Done when:** approved synthetic submissions produce exactly the intended records and effects, forbidden requests produce none, and recovery is safe. The completed authenticated vendor referral does not substitute for public vendor-link intake.

## 4. Complete authentication and authorization coverage

**Status: INTEGRATE + VERIFY. Depends on 1–2.**

#24 already contains the redirect hardening, recovery privacy/budget work, legacy upload validation, stored-filename sanitation, password global sign-out, and smaller action body cap. Do not rebuild those fixes.

- [ ] Verify failed login, normal sign-out, recovery, actual expired invitations, replay refusal, and intended invitation role assignment.
- [ ] Check hosted recovery privacy headers and limiter behavior; disposable tests with stubbed Auth are not hosted proof.
- [ ] Verify password-change success and failure paths, caller sign-out, and refusal of another session's refresh.
- [ ] Record the limitation that existing access tokens may remain valid until expiry.
- [ ] Test direct server actions, not just hidden buttons or page redirects.
- [ ] Test owner/MFA enforcement for privileged writes.
- [ ] Test assigned and unassigned adjusters separately.
- [ ] Test the distinct assistant role. A tested adjuster session does not prove assistant permissions.
- [ ] Test inactive accounts, company boundaries, cross-homeowner requests, malformed IDs, and generic refusal.
- [ ] Verify applicable last-owner, self-demotion, and deactivation guards.

**Done when:** a role/action matrix proves each permitted operation works and each forbidden operation causes no unauthorized data access or mutation. Preserve the implemented contract: assistants can ordinary notes/replies/uploads, not financial, representation, or management operations.

## 5. Finish owner and staff write workflows

**Status: VERIFY. Depends on 4; destructive document actions also depend on 9.**

- [ ] Lead disposition and status changes.
- [ ] Intake accept/reject, assignment, policy prerequisites, invitations, and intended downstream effects.
- [ ] Claim policy edits and reassignment; verify an adjuster loses access after assigning a claim away where required.
- [ ] Fee and financial edits with correct permission boundaries and stored values.
- [ ] Allowed claim lifecycle transitions and rejection of forbidden transitions.
- [ ] Verify history, activity, timestamps, and notifications for each transition.
- [ ] Company create/edit/activate/deactivate and deletion/provenance guards.
- [ ] Representative/staff invitations and role/active-status changes.
- [ ] Internal, customer, and partner notes/replies with correct visibility and notifications.
- [ ] Document deletion and cleanup behavior under the approved hold/retention rules.

**Done when:** each supported write has positive and negative evidence, survives reload, produces exactly the intended effects, and leaks no internal information across audiences.

## 6. Finish homeowner and vendor portal gaps

**Status: VERIFY. Depends on 4–5.**

- [ ] Homeowner password and consent changes, sign-out, and direct-action refusal.
- [ ] Prove account and claim isolation beyond list filtering.
- [ ] Verify visibility of customer-facing activity/documents and absence of internal/other-account data.
- [ ] Complete vendor direct-action and cross-company refusal cases.
- [ ] Verify remaining notification classes and independent inbox receipt where required.
- [ ] Check inactive company/account behavior and permission changes.
- [ ] Preserve completed profile save/restore, homeowner question, Partner note, and authenticated vendor referral evidence.

**Done when:** every supported portal capability has correct persistence, access boundaries, and effects. Do not resubmit the already-consumed vendor referral or resend its alert.

## 7. Finish private-file failure and recovery tests

**Status: VERIFY. Depends on 4 and the relevant 9 controls.**

- [ ] Cover assigned-adjuster and assistant permissions, not only owner uploads.
- [ ] Refuse a homeowner's direct request for an internal file.
- [ ] Prove permanent paths cannot overwrite an accepted document.
- [ ] Test interruption, lost connection, navigation/refresh, delayed arrival, retries, and failed finalization.
- [ ] Ensure failure cleanup never removes an accepted permanent object.
- [ ] Verify final-candidate hydration and interaction behavior.
- [ ] Check resulting document/session/audit/cleanup state after each approved case.
- [ ] If claiming valid image decoding, use a genuinely valid fixture under new approval. The retained 68-byte PNG has an invalid IDAT checksum; matching size/ETag does not prove decoder validity.
- [ ] Capture supported request diagnostics without retaining signed URLs, secrets, or customer content.

**Done when:** successful files remain private and intact; failed attempts are recoverable or cleaned safely; no duplicate/overwritten documents or unintended messages occur.

Do not repeat the completed 25 MiB owner/homeowner uploads, one-byte-over refusals, original hash downloads, invalid nine-byte PDF refusal, expired-link replay, or processed cleanup merely to populate this checklist.

## 8. Complete the selected manual signing workflow

**Status: VERIFY; repair only demonstrated issues. Depends on 1–5 and approved test inputs.**

The release uses manual PandaDoc, not paid API automation.

- [ ] Obtain the exact authorized claim and signing test scope; legal approval of document wording remains an external input.
- [ ] Download the claim-derived PDF from the final candidate using saved carrier, policy, agreement, fee, and claimant data.
- [ ] Inspect all pages and printed values, including long names/unsupported characters and truncation behavior.
- [ ] Verify required fields and intended recipients for the approved provider upload.
- [ ] Send only after specific approval; establish provider state before retrying an uncertain send.
- [ ] Use CMG “Mark letter as sent”; verify lor_sent state and its audit/activity.
- [ ] Complete all required signers through the actual supported flow.
- [ ] Verify finished signature appearance and provider completion evidence.
- [ ] Preserve the final signed PDF without altering its bytes.
- [ ] Upload it as lor_signed with the authorized visibility.
- [ ] Verify stored bytes and permitted access.
- [ ] Explicitly advance the claim to LOR signed. Upload alone must not advance it.
- [ ] Verify timestamp, state history, activity, and intended customer/partner notifications.
- [ ] Verify homeowner access and foreign-claim refusal.

**Done when:** the full chain works once on the approved case, with accurate state and no duplicate documents/messages. Synthetic unsigned drafts alone do not satisfy this gate.

Already complete: Single/Dual synthetic recognition, invisible tags, data-baseline repairs, page-7 geometry, required flags, and saved signer assignments. Do not recreate their contacts or repeat the v3 uploads. Do not add API/webhook activation to this release.

## 9. Resolve the real data-handling implementation gaps

**Status: IMPLEMENT / decide scope. Can be designed after 1; final verification depends on approved policy.**

The repository explicitly records absent export tooling and unenforced legal holds. General retention automation is not implemented. This is not permission to build an expansive compliance subsystem or choose legal policy.

### 9A. Request handling and export
- [ ] Define authorized requester verification, scope, operator, and private evidence handling.
- [ ] Implement a private request register or approve a workable controlled alternative.
- [ ] Export relevant relational data and actual document bytes, not just document metadata rows.
- [ ] Include applicable profiles/claimants, contractor/contact details, consents, history, provider references, and permitted audit evidence.
- [ ] Exclude unrelated people's data and unauthorized internal records.
- [ ] Produce counts, relationship/file manifests, integrity checks, and explicit missing-object errors.
- [ ] Define secure delivery, expiry, access revocation, and synthetic completeness tests.

**Done when:** a verified synthetic request yields a complete, correctly scoped package and unauthorized requests cannot retrieve it.

### 9B. Holds and erasure
- [ ] Define hold creation/release authority and scope.
- [ ] Implement enforceable holds or obtain explicit approval of an effective operator-controlled alternative.
- [ ] Prevent destruction through every applicable path, including document deletion and cleanup jobs.
- [ ] Test hold/deletion races and authorized release.
- [ ] Implement approved erasure/anonymization with dry-run scope, hold checks, audit, and verified results.
- [ ] Preserve required reconciliation, uncertain-send, and replay-prevention records.

**Done when:** held data cannot be removed by the supported workflow, and permitted erasure removes/anonymizes exactly its approved scope. A written hold alone currently does not block document deletion.

### 9C. Retention and consent
- [ ] Obtain approved retention rules for active/closed/reopened/disputed claims, detached consent, leads, and relationship records.
- [ ] Implement the agreed automation or approved bounded manual process; preserve database relationships and Storage bytes together.
- [ ] Verify archive completeness/restoration before any deletion.
- [ ] Add idempotent batches, hold exclusions, retry/error reporting, and operator recovery.
- [ ] If exact rate-record retention is required, replace or supplement opportunistic pruning.
- [ ] Define which future/queued message categories consent withdrawal suppresses and test that contract.

**Done when:** synthetic cases demonstrate the approved policy, hold protection, recovery, and traceable outcomes. Existing transactional templates are not evidence of a marketing-send bug merely because the worker does not inspect withdrawn_at.

## 10. Verify email queues and scheduled jobs

**Status: VERIFY; implementation only if agreed service requirements expose a gap. Depends on 2.**

- [ ] Verify independent inbox receipt for remaining required notifications.
- [ ] Verify reply handling and the monitored mailbox; the current sender has no explicit replyTo.
- [ ] Prove scheduled invocation of both outbox and storage-cleanup jobs using supported logs/evidence.
- [ ] Distinguish proven cleanup completion from unproved scheduler attribution.
- [ ] Verify cron authentication, bounded throughput, queue age, retry/dead-row handling, and uncertain-send reconciliation.
- [ ] Record supported latency and lack of guaranteed order on current daily scheduling.
- [ ] Decide whether additional provider-event ingestion is required; absence of a Resend webhook is not automatically a missing release feature.
- [ ] Document operator recovery without manually resending the eleven retained synthetic dead messages.

**Done when:** scheduled operation, required delivery/reply paths, and failure handling are proved or covered by an explicitly approved operating procedure.

## 11. Complete responsive, accessibility, and diagnostic QA

**Status: VERIFY. Depends on integrated candidate and functional flows.**

- [ ] Preserve recorded 390px/1280px passes; extend remaining pages and states.
- [ ] Add a narrow 320px regression check as a recommended final QA case, not a claim that previous required tests failed.
- [ ] Test keyboard order, visible focus, labels/errors, menu/dialog dismissal, and focus return.
- [ ] Test loading, success, failure, retry, repeated click, Back/Forward, refresh, and interrupted flow.
- [ ] Cover owner, adjuster, assistant, homeowner, vendor, and unauthenticated views.
- [ ] Obtain available fresh-navigation console/network evidence and final security headers.
- [ ] Fix reproducible application problems; do not invent an extension cause for historical listener errors or call opaque Cloudflare-frame messages application defects.

**Done when:** required views remain usable at the agreed widths and with keyboard navigation, no unexplained blocking application failures remain, and evidence limitations are explicitly recorded.

## 12. Finish release safety and technical operating documentation

**Status: VERIFY + INPUT GATES. Depends on 1–11 as applicable.**

- [ ] Reconcile actual schema/history before any approved release write. All 36 migrations already matched; do not reapply them.
- [ ] Check effective settings, manual signing selection, private Storage/access, required headers, and disabled unused paths.
- [ ] Prepare any new migration with isolated tests, permissions review, and compatible rollout/forward repair.
- [ ] Validate application rollback compatibility and what scheduled jobs do after rollback.
- [ ] State the recovery limit honestly: backups were declined; immediate restore is unverified; forward repair cannot recover deleted bytes.
- [ ] Document environment requirements, safe deploy procedure, cron operations, email reconciliation, signing, export/hold/erasure handling, and troubleshooting.
- [ ] Verify required-check/branch protections if separately approved and available; do not purchase plans or change settings as part of this planning task.
- [ ] Review any remaining obsolete key/secret action through a separate security approval without exposing values.
- [ ] Reconcile RELEASE_STATE, HANDOFF, LAUNCH_CHECKLIST, BLOCKERS, and this plan to the actual final candidate.

**Done when:** another developer can operate and safely change the software from the documentation, with no invented backup, ignored failure, or unsupported recovery promise.

## 13. Final content integration and domain/SEO sequence

**Status: INPUT GATE + later technical work. Depends on preceding software gates.**

- [ ] Public-copy and both LOR wording approvals remain external inputs, deliberately second-to-last.
- [ ] Engineering applies only approved text/assets and reruns affected layout/PDF tests.
- [ ] SEO/origin work and domain cutover remain last: canonical URLs, metadata, sitemap, robots, redirects, absolute links, and destination origin.
- [ ] Keep the current app host until the owner separately authorizes the exact change.
- [ ] Preserve mail and unrelated DNS records; no domain or DNS mutation is authorized here.
- [ ] After an approved release, verify the deployed commit, auth redirects, private access, forms, files, manual signing configuration, jobs, and critical routes.
- [ ] Record technical handoff and known accepted limitations.

**Done when:** the approved final destination serves the verified release, technical origin/SEO behavior is correct, and the post-release smoke check passes. Sale/payment negotiations are not part of this work.

## Execution order and definition of finished

1. Freeze the current evidence and exact candidate scope.
2. Review/combine #24 + #25 + #27 and reconcile #26 when authorized.
3. Run the full combined automated and mode checks.
4. Resolve privacy-control scope and implement agreed gaps in parallel with bounded functional test preparation.
5. Complete public/intake, auth/roles, administrative, portal, and file failure/retry acceptance.
6. Complete actual manual signing through final filing and state transition.
7. Verify jobs, email operations, responsive/error/accessibility states, and recovery documentation.
8. Integrate approved final copy/PDF wording second-to-last.
9. Perform separately approved final release/origin/domain work last.
10. Deliver the final technical handoff with exact passed, failed, skipped, and accepted-limitation records.

For each item record: owner, candidate SHA, environment, role, prerequisites/approval, test/data scope, expected outcome, actual result, evidence link, and remaining issue. A required row cannot be checked off solely because code exists or a Preview is Ready. Changes after a pass trigger targeted regression; they do not justify repeating unchanged consumed hosted actions.

Programming is complete only when the selected functionality is integrated, actual implementation gaps are resolved or explicitly covered by an approved workable alternative, required automated and end-to-end checks pass, no blocking defect is open, and the release can be operated within its documented recovery limits.

## Completed work not to rebuild or repeat

- PR #22 already merged upload transport, partner counts, hydration protection, and admin retry. Keep retry(); the old unstable_retry suggestion conflicts with installed Next.js.
- Platform activation and earlier invitation acceptance already occurred.
- PR #23/#24 Preview overrides and Turnstile setup are already complete.
- Recorded owner/staff/homeowner/vendor isolation and layout checks, safe Settings Recheck, Partner note, homeowner question/alert, profile validation/save/restore, and authenticated vendor referral are complete in their recorded scope.
- Large-file boundary/hash tests, invalid PDF refusal, the one expired-link replay, and all 13 recorded cleanup rows are complete.
- Synthetic PDF v3 recognition/layout/required fields/separate signer assignments are complete; the drafts remain unsigned and do not prove final signing.

## Evidence references

- [Release state at reviewed records commit](https://github.com/rspeciale0519/cmg/blob/e51d2f299e9d0094954f45111b3e117d1a23b0d0/docs/RELEASE_STATE.md)
- [Full launch checklist](https://github.com/rspeciale0519/cmg/blob/e51d2f299e9d0094954f45111b3e117d1a23b0d0/docs/temp/LAUNCH_CHECKLIST.md)
- [Engineering evidence](https://github.com/rspeciale0519/cmg/blob/e51d2f299e9d0094954f45111b3e117d1a23b0d0/docs/temp/HANDOFF.md)
- [Retention scope and gaps](https://github.com/rspeciale0519/cmg/blob/e51d2f299e9d0094954f45111b3e117d1a23b0d0/docs/RETENTION.md)
- [Manual signing setup](https://github.com/rspeciale0519/cmg/blob/e51d2f299e9d0094954f45111b3e117d1a23b0d0/docs/temp/PANDADOC_SETUP.md)
- [Role capability contract](https://github.com/rspeciale0519/cmg/blob/1b7f7f98e54a358b3a95875483a63d3f882573a3/src/lib/claims/capabilities.ts)
- [#24](https://github.com/rspeciale0519/cmg/pull/24), [#25](https://github.com/rspeciale0519/cmg/pull/25), [#26](https://github.com/rspeciale0519/cmg/pull/26), [#27](https://github.com/rspeciale0519/cmg/pull/27)
- [#24 CI](https://github.com/rspeciale0519/cmg/actions/runs/39351780332), [#25 CI](https://github.com/rspeciale0519/cmg/actions/runs/39349972823), [#26 CI](https://github.com/rspeciale0519/cmg/actions/runs/39662032629), [#27 CI](https://github.com/rspeciale0519/cmg/actions/runs/39651682681)

No application code, hosted data, production configuration, or DNS was changed while preparing this plan.
