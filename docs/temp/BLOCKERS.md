# Owner decision register

Current code and release decisions reconciled 2026-10-19. Other dated decisions retain their recorded scope.
This file lists only current owner-controlled decisions.
Rewrite it in place. Do not add dated layers.
The superseded layered version is in [the 2026-09-17 archive](../../archive/docs/temp/2026-09-17-consolidation/BLOCKERS.md).

Use [RELEASE_STATE.md](../RELEASE_STATE.md) for production facts, open PRs, and the ordered next steps.
Use [HANDOFF.md](HANDOFF.md) for engineering evidence. Engineering checks are not owner blockers.
Use [README.md](../../README.md#simple-mode-production-runbook) for the release procedure.

This record requests no approval and authorizes no action.

## Settled — do not ask again

- Direct browser uploads to private Supabase Storage. The architecture is approved and deployed.
- `app.cmgpropertysolutions.net` as the temporary public host. It stays the demo host until CMG pays for commercial hosting.
- Preservation of existing root, `www`, and Microsoft 365 DNS records.
- The approved test recipients and the applied hosted migrations.
- No Supabase backup. Recovery for the applied migrations is reviewed forward repair. Immediate restoration is unverified.
- PandaDoc e-signing ships in the first release, through a manual prefilled-PDF flow.
- The CMG standard fee is 20 percent. A per-vendor fee is an owner-only setting.
- PRs #1 through #17 and #20 through #22 are merged. The owner recorded Production platform activation on 2026-10-07.
- On 2026-09-23, the owner decided that admins must be able to invite staff, vendors, and homeowners.
- On 2026-10-17, the owner approved PR #23's four branch-only Preview overrides, one additional Turnstile hostname, and one redeploy. This setup is complete.
- The owner approved local branch `codex/security-upload-session-checks` from `develop` and both security fixes.
- Homeowner password changes must request sign-out on all devices and return to login. Existing access tokens can last until expiry.
- The owner separately approved the eight-file local security commit, its push, and draft PR creation. These created PR #24 at `abc4499`.
- The owner approved local integration of exact PR #23 commit `15ea5f6`, without creating a commit. This merge is complete.
- The owner then separately approved the thirteen-file local merge commit `e142f5f` and its exact push. Both actions are complete.
- The owner separately approved PR #24's four branch-only overrides, one added Turnstile hostname, and one redeploy. Setup is complete at exact `e142f5f`.

## 1. Release sequence

The owner fixed this order. Later items must not move earlier.

1. Complete remaining local and hosted acceptance, including the current security correction.
2. Production platform activation already occurred. Do not repeat it or undo it without a new exact approval.
3. Send one real Letter of Representation through PandaDoc's web app.
4. Approve the public copy. This is second-to-last.
5. Apply the SEO origin fix and cut `app.` over to `www.`. This is last.

Current Production customer and partner routes redirect unauthenticated callers to `/login`; they no longer use the closed platform page.

**Owner action:** approve each new Production release separately after acceptance. The current instruction permits no Production change.

Owner sign-in and local integration-branch approval are complete.
Branch `bugfix/launch-integration` combines PRs #18 and #19 locally and resolves both test-file conflicts.
Combined application and database checks passed after the separately approved disposable-stack reset on 2026-10-05.
Only `CMGPA_private_upload_disposable` was reset. Retained local stacks and Production did not change.
The owner separately approved the candidate commit. Commit `9a80e09` contains the reviewed 53 files; its worktree is clean.
The separately approved push to `origin/bugfix/launch-integration` is complete; GitHub confirms exact commit `9a80e09`.
Its automatic Preview failed during font compilation after restoring the older Production cache.
The owner approved one cache-free rebuild of this exact Preview on 2026-10-13.
It completed successfully as `dpl_C2UqHb6rSJbXZ9bpQWNTRHyfqRHV` at `9a80e09`.
The existing build failure no longer blocks acceptance. No duplicate rebuild approval is needed.
No Production setting, DNS record, hosted data, or environment setting changed during this task.
PR #22 already merged the v2 integration. Current `develop` is `1b7f7f9` and includes those fixes.
No merge or update of the older integration branch is needed. PR #18 is closed.
The owner separately approved closing superseded PR #19 without merge or branch deletion. That action is complete on October 19.
PR #23 contains the current security corrections. Its CI and Preview are green, but it is unmerged.
An isolated test reproduced three unsafe redirect inputs in current `develop` and confirmed #23 refuses them.
The approved hosted test setup is complete: platform mode, matching site URL, blank PandaDoc keys, one added Turnstile hostname, and one Ready redeployment.
That approval applied only to branch `cursor/security-scan-2026-10-17-4764` and its matching host.
The later combined PR #24 approval and current test host are recorded below.
Preserve shared Preview values, all existing widget hosts, Production, DNS, and database data.
No data-changing tests, emails, uploads, or audit-creating downloads were included in that approval.
Owner sign-in and MFA on PR #23 are complete. Owner read-only checks passed.
The owner completed staff sign-in and MFA as `4miodio+cmgstaff@gmail.com`. Recorded staff access checks passed.
Homeowner read-only claim, isolation, profile, and responsive checks also passed in a separate Incognito session.
Vendor `robspeciale@gmail.com` passed empty-list, profile, referral-form layout, and access-refusal checks without writes.
Its company has no linked claim. The later positive claim check uses an existing linked account at the other test company.
October 19 read-only queries confirm the existing `CMG Test Vendor` account and claim 0005 mapping.
The owner completed Supabase and linked-vendor sign-in. PR #24 passes twenty-two measured read-only vendor checks at desktop and mobile widths.
No new access grant was needed. Do not change an accepted claim's company to create a fixture.
The approved Partner note test passed on October 19 at 8:37 PM EDT. The exact approved text was submitted once on claim 0005.
The owner sees one matching note after reload, labeled `Partner`. The vendor sees it at 1280px and 390px.
Claim 0005's customer-only event stays hidden from the vendor. Both layouts fit without global overflow; captured warning/error logs are empty.
The entry remains in the shared Production database. No email was authorized; source review confirms this visibility excludes the homeowner email path.
Read-only database inspection confirms one matching `partner` note. The outbox has zero rows created since October 20, 00:37 UTC.
Full network traces remain unverified. Other vendor writes and notification tests still need exact approval.
Owner sign-in and this one-entry approval are resolved. Do not post the note again or sign out the current test sessions.
This permits no file, invitation, access, Git, Production code/settings, or DNS change.
Remaining direct actions, data-changing acceptance, and full request traces remain open.
Further PR changes, remote merges, Preview configuration, and Production changes remain separately controlled.
Separate release approvals remain required after combined checks and hosted acceptance.

PR #23 alone leaves two further security items. The combined PR #24 fixes both; active forms keep their checked upload path.
The approved local branch now contains file-content checks and the selected global sign-out policy.
The owner approved one reset/test cycle on `CMGPA_private_upload_disposable`, using only local ports 15520–15529.
The reset, 1,350 pgTAP assertions, 243 selected integration tests, and the real synthetic-session test passed.
This approval does not include another reset, retained local data, or hosted writes.
The first eight-file commit was `abc4499`; its Preview and both required CI jobs passed.
The separately approved merge commit `e142f5f` combines exact PR #23 with the filename and recovery-header repairs. Its push is complete.
PR #24 is draft at that exact head. Both jobs passed in CI run `39075681448`; the automatic Preview is Ready.
Current CI passed 1,717 unit tests, 1,350 pgTAP assertions, and 243 selected database tests.
Its unit run skipped 57 database/live tests; its database selection skipped one live PandaDoc test.
Local checks pass: type check, lint, default build, 1,710 full-unit tests, 45 final header/recovery/CSP tests, and 244 database tests.
The full-unit run predates only the header rule and its new tests. Its other source remains unchanged.
Database selection skipped one live PandaDoc test. Full unit skipped 57 database/live tests. Final eighteen three-mode HTTP checks pass.
The compiler build recovered after generated-cache removal. The first database setup request failed; exact fixture cleanup and the complete rerun passed.
No further approval is needed for the completed `e142f5f` commit or push.
The separately approved branch-only setup is complete as Ready `dpl_8ykWz4ujjgeq1s3ojzBP1ADjSQJY` at `e142f5f`.
All four new values and the single Preview branch scope are verified. The 24 pre-existing environment records are unchanged.
Only one hostname was added; all seven prior hosts remain. The eight current HTTP checks and both recovery/login layouts pass.
Owner sign-in and MFA on the combined Preview are complete. Safe owner checks confirm Manual signing and zero waiting notifications.
The read-only Recheck action, document controls at both widths, and owner cross-role redirects pass without a data-changing submission.
One later empty-file check reached the prepare action and spent a shared rate-limit attempt before refusing the empty manifest.
It created no upload session, document, Storage object, or email. No counter reset or other compensating write was attempted.
A separate Luna review found no Critical or Important code issue. Its stale scan-report finding is corrected locally and rereviewed.
The security worktree has the uncommitted `SECURITY_SCAN_2026-10-17.md` and a new private-verifier test.
The verifier file now has twenty-three focused tests, including eight added URL and proof-confirmation cases. All twenty-three pass locally.
Type check and full lint pass. The full suite passes 1,740 tests in 710.64 seconds, with 57 database/live tests skipped.
Independent review found no blocking issue. The owner approved the one-file test commit, now `ff55bbfc615be027911535e2aae72e71ce38faa2`.
It contains only the verifier test, with parent `e142f5f`. Independent post-commit checks confirm its scope, empty index, and tested file hash.
The existing scan-report edit and all main-checkout records remain excluded and uncommitted.
The owner approved its exact push, which is complete. PR #24 CI run `39349917391` passed database checks but failed one unit-test timeout.
The test-only CRC repair passes 78 focused tests, type check, lint, and 1,740 full-suite tests locally; 57 database/live tests skip.
The reviewed repair is published as signed commit `d523469`. CI run `39351780332` passes both jobs at that exact head.
It passes 1,740 unit tests, 1,350 pgTAP assertions, and 243 database-backed tests, plus type, lint, build, and zero-vulnerability audit.
Unit skips 57 database/live tests. The database selection skips one live PandaDoc test. Its automatic Preview is Ready.
The exact two-upload, two-oversize-refusal, two-download batch is now separately approved and complete. Do not request it again.
Both 25 MiB files and saved download hashes match; the audit has two matching entries. Owner and homeowner see six and four documents respectively.
The hosted upload tables have two completed sessions and two verified files. The October 19 read confirms all eleven cleanup rows processed.
No cleanup row remains pending, failed, or dead. Both formerly pending staging rows completed on October 18 at 14:27:39 UTC.
The staging prefix is absent from the loaded Storage root; both approved permanent test filenames remain listed.
These Preview tests changed the Production database's synthetic records. Production code, settings, DNS, and email stayed unchanged.
The owner later approved one invalid-file test on claim 0005. It was submitted once and refused, with no accepted document.
Read-only inspection confirms cancelled session `c68baab2-61f4-4864-bd22-8049f9ecaf94`, null verification, and zero document rows at its exact permanent path.
One staging object and one unaccepted copy remain, each nine bytes. Cleanup eligibility is October 19 at 11:09:57 PM EDT.
Normal scheduled removal remains unverified. Do not retry the upload, invoke cleanup, or delete either object manually.
No new outbox row exists since October 20, 00:37 UTC, covering both newly approved test writes.
**Owner action:** approve the next exact failure-path, portal-write, vendor-referral, or manual-signing batch before it changes hosted state.
Remote merge, further live-data tests, and Production deployment remain separate actions. No extension permission was changed.

## 2. Public business and legal approval

Public copy carries business assertions that only CMG and its legal adviser can approve.
The named items are the statistics, the testimonial and its attribution, "Se habla español",
"licensed and bonded in every state", and the partner payment promises.
Privacy terms, consent wording, and the retention position need the same approval.

**Owner action:** approve the exact deployed copy and the public data-handling terms.
See [RETENTION.md](../RETENTION.md) for implemented behavior and proposed policy.

## 3. PandaDoc configuration

The current flow uploads bundled PDFs with `H1` and `H2` signer roles.
It does not use template UUIDs, and it does not need the "11 tokens" that an older record described.

| Item | Requirement |
|---|---|
| `PANDADOC_API_KEY` | Optional. The manual prefilled-PDF path works without it. |
| `PANDADOC_WEBHOOK_SHARED_KEY` | Required for HMAC verification once webhook events are used. |
| Webhook subscription | `document_state_changed`, `recipient_completed`, `document_completed_pdf_ready`, and `document_creation_failed`. |
| Legal review | Both bundled PDFs, `CMG_LOR-2026-PandaDoc-Single.pdf` and `CMG_LOR-2026-PandaDoc-Dual.pdf`. |
| Manual path | Staff prefill the bundled PDF and complete signing outside the API, which avoids API fees. |

**Owner action:** rotate the old preview PandaDoc webhook key if it is still active.
Approve any live draft or send test separately. A live test must never run automatically.
The earlier PR #19 Preview reported configured API and webhook keys.
The provider selects PandaDoc when `PANDADOC_API_KEY` contains a nonblank value.
It selects manual signing only when that value is absent or blank.
PR #23 and the combined PR #24 have approved branch-only blank-key overrides and Ready rebuilds for manual acceptance.
These overrides disable both PandaDoc keys only for those branches and leave Production unchanged.
Do not remove shared Preview values or expose their contents.
PR #23's site-mode, URL, and hostname setup is also complete. Do not repeat the completed setup approval.
Its authenticated Settings panel confirms the Manual provider and an unset webhook key.
See [PANDADOC_SETUP.md](PANDADOC_SETUP.md).

Two local synthetic prefilled examples were prepared for Single and Dual web-field recognition.
They used the combined PR #24 function and no hosted claim or audit write.
The owner signed in to PandaDoc and approved both unsent synthetic draft uploads.
After the owner resumed on October 19, the Single upload created one draft and recognized nine fields.
The visual check failed because black tag text shows through the placed fields. The draft remains unsent; Dual is not uploaded.
The current account was automatically added as a draft signer. No saved contact, email, or signature was created.
The owner approved local branch `bugfix/manual-signing-tag-visibility` and the manual output tag-color repair.
The isolated repair starts at current `develop` commit `1b7f7f9`.
The first local white-glyph output damages underlying lines. It was rejected before any upload.
Invisible tag painting and the local dependency-layout recovery are recorded in HANDOFF. This is not a verified release candidate.
The second local revision preserves all eighteen printed pages and passes three-mode focused checks, type checking, lint, and the normal build.
The final full unit run passes 1,682 tests, with 56 database/live tests skipped. Docker is unavailable.
The owner approved both revised files after local checks. Each was uploaded once as a new unsent draft.
Single retains nine expected fields; Dual retains eighteen. All twenty-seven are required and persist after a fresh reopen.
Revised tag text is not visible. The original failed draft remains unsent and retained.
All fields still belong to the current account. Both recipient forms require a saved contact for a new test address.
No contact was saved because the approval excluded contacts. Separate signer assignment remains unverified.
Page 7 field boxes reach the last affidavit line area; Dual's boxes also overlap each other.
The text remains visible. No signed appearance, signature, or legal acceptance was tested.
The earlier unanswered request covered two saved synthetic contacts and draft-only assignment and placement correction in the two v2 drafts.
Use only `cmg-test-1@example.invalid` and `cmg-test-2@example.invalid`, clearly labeled as synthetic.
Retain the contacts and drafts. This next approval must exclude finalization, email, signing, purchase, deletion, CMG writes, Git actions, and deployment.
The earlier color-only scope kept legal content, claim data, bundled PDFs, and API bytes unchanged.
The later local approval below extends only the measured PDF layout scope. It does not approve Git submission or a hosted write.
The original unused approval applies only to the unchanged Dual file. The two revised-file uploads have now consumed their separate approval.
No additional upload, payment, signature, CMG record change, or real Letter of Representation send is approved.
Final field placement, printed-value readability, and legal review remain open.
Read-only review confirms printed-rule crossings for page 1's policyholder and dispatch dates on pages 1 and 8.
Other page 1 values and the page 9 adjuster position need measurement. A two-date-only repair would not prove full value readability.
The owner approved extending the existing isolated local repair to measured printed-value placement, generator/manifest alignment, and both bundled PDF assets.
This supersedes the earlier color-only asset restriction for this local work. It changes assets shared by the manual and API paths.
Preserve source background, legal wording, values, and signer tags. Verify both variants and every rendered page before proposing new provider uploads.
The approval excludes contacts, uploads, mail, signatures, hosted writes, Git actions, and deployment.
The local correction passes focused, three-mode, type, lint, build, and eighteen-page comparison checks.
The fresh full unit run passes 1,686 tests in 121 files; 56 database/live tests in thirteen files skip.
Current v3 hashes are in HANDOFF. Database/live checks remain incomplete because Docker is unavailable.
The owner separately approved the six-file commit and the exact v3 provider batch. Do not ask for those unchanged actions again.
Commit `56cff18` contains only the six reviewed files. Its approved exact push and draft PR #25 targeting `develop` are complete.
CI run `39349972823` passes both jobs: 1,686 unit tests, 1,350 pgTAP assertions, and 253 database-backed tests.
Type check, lint, build, and audit pass. Unit skips 56 database/live tests; the database selection skips one live PandaDoc test.
Both exact v3 uploads are complete once. Single retains nine required fields; Dual retains eighteen. The saved page 7 corrections pass.
PandaDoc rejects `cmg-test-1@example.invalid` with “Please ensure domain is correct.” Save is disabled, so contact creation was canceled.
No contact was saved from that rejected attempt. The owner then approved both exact Gmail contacts and assignments in the existing v3 drafts.
CMG Synthetic Signer 1 (`4miodio@gmail.com`) is now saved once and reused. Single saves all nine fields for signer 1; the current account is CC.
The two-recipient plan limit blocked adding a third entry. The owner separately approved replacing the current account's Dual entry with signer 2.
CMG Synthetic Signer 2 (`robspeciale@gmail.com`) is now saved once. The approved replacement transferred only the current account's nine right/lower fields.
Signer 1 retains all nine left/upper fields. Each test signer has five initials and four signatures, one field on each page.
All eighteen individual Required, type, and assignee checks pass. Field types, positions, and sizes stay unchanged.
The saved Dual reload retains all eighteen assignments and unchanged geometry. The current account is not retained as a third CC recipient.
No upgrade, saved-contact deletion, or saved account change occurred. Recovery uses a reviewed draft correction; the provider has no Undo for replacement.
The synthetic draft recognition, assignment, required-field, and placement checks pass. These checks do not prove legal acceptance or completed signing.
**Owner action:** legal review and exact approval for the later real-claim Preview download, provider upload, and intended signers.
Sending, signed-file storage, claim status changes, and their notifications each remain subject to their separate hosted-write approvals.
Do not upload the synthetic PDFs again, delete a saved contact or draft, buy an upgrade, or send mail.
The automatic PDF Preview is Ready at `dpl_Eko5QAw2p5ADdFDEicMZuNVz5wU2`. No new branch setting was added.
Merge and Production release remain excluded from the owner's advance engineering approval.
Keep all older drafts and fixtures. Exclude finalization, signatures, deletion, purchases, CMG writes, Production changes, and DNS changes.

## 4. Commercial hosting and repository protection

The Vercel team API freshly confirms `robs-projects-c72886ba` uses Hobby. Vercel's [fair-use rules](https://vercel.com/docs/limits/fair-use-guidelines)
require Pro or Enterprise for commercial use. CMG's public site falls inside that scope, including simple mode.
GitHub freshly reports private personal repository `rspeciale0519/cmg`, default branch `develop`, and `protected=false`.
The signed-in user API returns no plan value. This does not prove the account has GitHub Free.
GitHub requires an eligible plan for private-repository protection; check the existing subscription before any purchase.

Recommendation: use Vercel Pro and GitHub Pro for the current personal repository owner.
Vercel's [Pro plan](https://vercel.com/docs/plans/pro-plan) lists a $20 monthly platform fee, one deploying seat, and usage charges beyond included allowances.
GitHub's [plan guide](https://docs.github.com/en/get-started/learning-about-github/githubs-plans) includes private protected branches in personal GitHub Pro.
These primary sources were checked again on 2026-10-17. No plan purchase or permission change occurred.
Confirm billing responsibility and usage limits before purchase.
Vercel's upgrade applies to the whole team, including its other projects. The base fee is not a total spending limit.
The proposed branch controls require pull requests, current-base `verify` and `database` checks, and resolved conversations.
They also block force pushes and branch deletion and apply to administrators. These controls are not configured.
Name another eligible reviewer before requiring an approval count that the sole PR author cannot satisfy.

**Owner action:** approve a commercial Vercel plan before commercial launch.
Approve a supported private-repository plan, then approve the branch-protection change separately.
Keep the repository private. Manual review is not branch protection.

## 5. Provider verification

Resend verified the sending domain, and a synthetic staff alert was delivered.
The owner restored Resend access in Chrome on 2026-10-05.
Read-only provider records show Delivered for both staff and vendor invitations, the 2026-09-15 lead receipt and alert, and the homeowner invite.
Owner and homeowner reset messages and the synthetic question alert are also Delivered.
No message was sent or retried during this review. No new Resend login is needed for these completed reads.
The September 21–October 5 Metrics window reports eight emails, 100% deliverability, zero bounces, and zero complaints.
The Webhooks page shows no configured webhook. CMG does not receive later delivery events.
The sender sets no explicit `replyTo`; receipt of replies at the sender mailbox remains unverified.
Recommendation: approve the daily operator procedure in [HANDOFF.md](HANDOFF.md#current-email-provider-delivery-evidence) and name its CMG operator.
Confirm a monitored reply mailbox before launch. Do not change mail routing or recipient details without exact approval.

**Owner action:** confirm inbox receipt for the 2026-09-15 lead. Provider delivery does not prove receipt in the inbox.
The Vercel connector verified the current Production deployment and project on 2026-10-04.
It could not read billing details or build logs.
Use an authorized Vercel session to complete those checks.
The current browser session can read request logs and enabled cron schedules.
The last-hour Production cron window has no records; older windows require Pro.
Scheduled execution remains unverified.
The October 19 current read confirms cleanup completion, not the scheduler trigger.
All thirty-five mail rows remain twenty-four sent and eleven dead, with none pending or failed. No message was retried.
The historical CLI log request returned HTTP 400. Current browser history permits only Last hour; longer windows require Pro.
The available Production/Cron Job hour contains zero records and excludes the cleanup completion time.
Do not infer a failed scheduled run from that missing window, or invoke a worker without exact approval.

The Vercel browser session now permits a read-only configuration review.
The owner approved PR #19's branch-only platform and site URL overrides and redeployment.
Both overrides are saved for `bugfix/private-upload-transport` only, and the new Preview is ready.
Current owner sign-in is complete. Remaining role acceptance and hosted upload boundaries stay open.
The restored Codex browser completed the approved Cloudflare hostname addition on 2026-10-05.
The CMG widget now includes `cmgps-git-bugfix-private-upload-t-cffa43-robs-projects-c72886ba.vercel.app`.
The five existing entries, Managed mode, and disabled pre-clearance remain unchanged.
Recovery, contact, and intake completed automatic verification without form submission.
No further Cloudflare sign-in or duplicate approval is needed for this completed action.
No DNS record or widget key changed.

The earlier browser session supplied read-only migration and queue evidence after the connector denied access.
Those earlier migration and cleanup results remain dated. Current PR #23 Settings confirms zero pending or failed mail.
The owner restored Codex CMG Supabase access. Read-only versions, stored SQL hash, and queue checks passed.
Use that signed-in CMG session for further authorized reads. Reauthenticate only if it expires; do not broaden account permissions.
Do not send passwords or service keys in chat.

The open owner Inbox has no match for the current exact reset-email subject. This is not proof of delivery failure.
No message or reset link was opened. The other test mailbox is at login. Inbox receipt and reply handling remain open.

## 6. Open operational questions

- **Cron delay.** The outbox runs daily at 14:00 UTC and Storage cleanup at 14:17 UTC.
  Hobby scheduling can miss the configured minute, and a backlog can take several days.
  Both jobs can run anywhere in the 14:00–14:59 UTC hour. Their order and seventeen-minute separation are not guaranteed.
  Confirm that this delay meets CMG's requirements. A faster schedule needs a commercial plan first.
- **DMARC.** The domain publishes `v=DMARC1; p=none;`. Decide whether to move to `quarantine` or `reject`.
  Any change must preserve Microsoft 365 mail routing.
- **Stray root folders.** The owner will delete them.

## 7. Production data controls

The hosted database holds real records. Never treat it as empty or disposable.
Never seed or reset production.

**Owner action:** approve each production migration, repair, backup, or restore separately.
Approve each hosted test submission and live message separately. Do not create a Supabase backup under the current decision.
If a backup is later required, confirm that it covers private object bytes, not only database metadata.
An invalid existing document path can stop migration validation; a repair needs reviewed metadata and Storage evidence.
Do not authorize automatic renaming, deletion, quarantine, or constraint removal as a default response.

## 8. Separate Git and deployment approvals

Approval for one action never approves another.
Commit, push, PR description change, branch protection, merge, deployment, and domain change stay separate.
A merge to `develop` can start a Production deployment automatically.
The six-file repair commit `3922e5a` is approved and created; its push is now approved.
Two push attempts did not execute because automatic approval review failed with a model-capacity error.
The next retry succeeded. PR #19 matches `3922e5a`; CI run `37314652490` passed both jobs.
Vercel and CodeRabbit also passed. The separately approved branch-only configuration and redeployment are complete.

## 9. Customer and partner access

The owner approved work on all three invitation flows. Production platform activation already occurred on October 7; do not repeat or undo it.
Do not create a first owner merely because an old record says no accounts exist.
Confirm existing identities and roles through an approved process.
Retention automation, export, erasure, and legal holds need separate implementation and approval.
The manual request procedure in [RETENTION.md](../RETENTION.md) is a proposal, not an approved operating process.
Choose effective operator controls or separate hold enforcement before relying on a manual legal hold.
Approve the procedure with counsel, then authorize its synthetic completeness and access tests.
Define any email category that consent withdrawal must stop.
Current claim messages are transactional, and the worker does not filter by `withdrawn_at`.
Do not assume that this alone proves an existing marketing send defect.

## 10. Optional authentic photography

Home and About retain labeled image placeholders.
CMG can supply approved photos and usage rights.
Do not use generated or misleading images as evidence of CMG people or work.
Photography does not block launch unless CMG makes it a requirement.
