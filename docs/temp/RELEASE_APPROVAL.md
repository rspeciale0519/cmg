# Release approval packet

This packet prepares launch review. It authorizes no merge, deployment, message, account change, purchase, signature, or DNS change.

The packet remains draft. Signed repair `76cdc5a` passed exact-head CI `40735491808`, superseding the three Linux failures at `8b1aecb`.
Its final Windows suite also passed. Final browser proof remains unavailable.

## Reviewed application

| Item | Verified value |
|---|---|
| Draft PR | [PR #28](https://github.com/rspeciale0519/cmg/pull/28) |
| Feature branch | `codex/launch-release-candidate` |
| Published application revision | Signed `76cdc5aea68cd5733ba93b00eff61a3b2ecb7714`; exact-head CI, focused checks, and final Windows suite passed |
| Email repair | Signed `27cfd6b221060c0b2faf1b406f8b2494ec3c7ce4`, included in current reviewed source |
| Base branch and revision | `develop` at `1b7f7f98e54a358b3a95875483a63d3f882573a3` |
| Reviewed source difference | At `76cdc5a`: 22 commits ahead, zero behind, 62 changed files against the verified GitHub base |
| GitHub merge state | Last read at published `cc27f38`: `MERGEABLE` and `CLEAN`; still draft; no submitted review. Recheck the resulting head. |
| Branch controls | `develop` is unprotected. Auto-merge and automatic branch deletion are disabled. |
| Schema | No changes under `supabase/` or in generated database types; no migration is required by this PR. |
| Recorded hosted database | 36 migrations through `20260927120000`; recheck before a release |
| Known Production | `dpl_GoXHV8n8KfTVt5BDyZosJF3jvXPk`, source `develop` at `1b7f7f9`; recorded `SITE_MODE=platform` |

These values were checked on October 28. The comparison uses verified `origin/develop`; the different local `develop` ref was not used.
The first email and lint-glob changes passed local checks. Linux CI then failed at `8b1aecb`; repair `76cdc5a` passed exact-head Linux CI.
The final Windows suite also passed. Later records-only head checks remain separate.
Later records-only commits can advance the head. Read final PR-head checks externally before requesting exact merge approval.

The candidate combines security, file validation, session, PDF, dependency, navigation, staff-count, and accessible loading/error fixes. It includes Next.js 16.4.3, Zod 4.6.6, and a Server Action limit change from `256mb` to `2mb`. Private large files use the tested direct-upload flow. Node remains 22. CI and cron configuration are unchanged.

## Passed and limited evidence

Repair `76cdc5a` changes one condition, adds a virtual-working-directory regression, and corrects one README statement.
The new regression failed before repair by blocking an attempted `C:/` read. After repair, 21 focused tests passed in 2.13 seconds.
Final type, lint, diff, and review passed.
The final Windows suite passed 1,796 tests and skipped 65 in 514.89 seconds, with exit 0; 133 files passed and 17 skipped.
It used Node 22.22.2 and unchanged default one-worker settings.

Exact-head CI `40735491808` passed verify `122982775518` and database `122982775171`.
Unit tests passed 1,796 and skipped 65 in 105.75 seconds; 133 files passed and 17 skipped.
Audit, type check, lint, and build passed; four low audit findings remain.
Database checks passed 1,350 pgTAP assertions across 44 files and 253 tests, with one live PandaDoc test skipped.
Database Vitest passed 35 files and skipped one in 27.84 seconds.
Vercel reported success for deployment `5SBC1nMrrWGhBHXXWfgDrgwvpPZL`; final browser proof remains unavailable.

Exact head `8b1aecb` failed [CI run 40734242301](https://github.com/rspeciale0519/cmg/actions/runs/40734242301), verify job `122978378239`.
The run passed 1,792 tests, failed three, and skipped 65 in 97.17 seconds; 132 files passed, one failed, and 17 skipped.
All three new scope guards received `/` on Linux because the filesystem-root fallback restored ancestor traversal.
Audit, type check, and lint passed with four low audit findings. The build step skipped.

Database job `122978378566` passed 1,350 pgTAP assertions across 44 files.
Database Vitest passed 253 tests and skipped one live PandaDoc test; 35 files passed and one skipped.
Vercel reported success for deployment `CFZf6BF6p8awJzrEZhmmZ5ejAoMx`.
Browser control was unavailable, so final browser proof remains unverified. The later Linux CI pass supersedes this failure for repair `76cdc5a`.

[Application CI 40724185151](https://github.com/rspeciale0519/cmg/actions/runs/40724185151) passed for `cc27f38`:

- 1,773 unit tests passed; 65 skipped.
- 1,350 pgTAP assertions passed across 44 files.
- 253 database tests passed; one live PandaDoc test skipped.
- Type, lint, build, and audit passed. Four low audit findings remain.
- [Preview 3ucqe9EgAwCfRk7Mq5BafwXdaiiR](https://vercel.com/robs-projects-c72886ba/cmgps/3ucqe9EgAwCfRk7Mq5BafwXdaiiR) is Ready.

Real disposable local access, signout, password-session, and upload-recovery evidence remains separate from skipped CI selections. All three modes passed 285 focused tests each. Recorded browser tests cover desktop, 390px, navigation, focus, and error/loading displays. Full network traces, real error recovery, and screen-reader announcements remain unverified. Do not use a narrow result to claim complete hosted coverage.

The new email wording tests passed 28 focused cases and 28 cases in each site mode. Final type check and lint passed after the glob repair. The application build passed after email changes and before the tooling-only glob repair. Application source did not change afterward.

Four real rendered outputs passed at 1280px and 390px without horizontal overflow or captured console warnings/errors. No CTA or phone link was activated. These browser checks do not prove mailbox, email-client, delivery, or full network behavior.

The new `npm audit --audit-level=high` passed with exit 0. Four low deepmerge-chain findings remain, with no available fix. No package changed.

Before the glob repair, the full unit run passed 1,778 tests, failed one, and skipped 65 in 354.28 seconds. A focused rerun passed three tests and failed one in 8.59 seconds. Both failures were a 5,000 ms glob timeout. Guarded diagnosis confirmed broad ancestor traversal outside the working directory.

The first adapter repair passed 20 focused tests in 1.51 seconds and nine independent compatibility checks. Its default Windows one-worker suite passed 1,795 tests and skipped 65 in 538.00 seconds, with exit 0. Of 150 files, 133 passed and 17 skipped. This resolved the earlier Windows timeout for that source. The later Linux failure required the separate root repair recorded above.

Narrower searches cover absolute paths and leading-parent paths with a literal prefix. Other leading-parent patterns retain tinyglobby behavior; UNC remains unsupported.

Earlier worker-start failures remain separate historical evidence; their cause is unconfirmed. Later checks passed for their recorded source. CodeRabbit skipped its review; that status is not a completed review.

## Mail and scheduler evidence

On October 28, Resend showed [status email 01a182ef-3fc8-7258-b332-be9ff214b502](https://resend.com/emails/01a182ef-3fc8-7258-b332-be9ff214b502) as Delivered.

- Recipient: `rob@miodiollc.com`.
- Subject: `CMG-2026-0007 — Under review`.
- Sent and delivered: October 28, 10:34 AM in the browser display.
- Recipient-server response: `250 OK id=1xM4jh-00000008PBj-1O9F`.

This confirms recipient-server acceptance. Roundcube inbox receipt remains unverified because its session expired. Do not resend the email.

The delivered message still contains the earlier representation wording. The local correction does not change that sent message or prove delivery of corrected wording.

Both Production job routes returned HTTP 200. The outbox then recorded this status email as sent on attempt one. The available records do not identify the scheduler caller. The Vercel Cron-history query returned `Outside of allowed range`. Inspect a normal scheduled run within available log retention. Do not invoke jobs or purchase longer retention without approval.

## Required owner decisions

1. Finish the pending Roundcube sign-in. Confirm scheduler evidence and the accepted queue delay.
2. Provide a manual PandaDoc sender and workspace that cannot notify any CMG-domain address. Keep existing drafts unsent.
3. Approve the legal text and the exact synthetic signing batch before uploads, sends, signatures, or filing.
4. Confirm hosting eligibility, billing owner, spending limits, repository protection, and a reviewer.
5. Name the operator for mail, replies, job failures, and monitoring. Decide contact addresses and DMARC policy.
6. Approve retention, legal holds, complete export scope, erasure rules, and the subject-request procedure with counsel.
7. Define the customer handover accounts without violating the CMG-domain access restriction.

After the data procedure is approved, test it with synthetic records. Verify complete database/file exports, access limits, and approved hold/erasure controls. These policy-dependent checks are not complete. See [RETENTION.md](../RETENTION.md#subject-requests-and-platform-activation).

No Supabase backup is approved. Public pages stay open. Do not send to Austin or any `cmgpropertysolutions.net` address or subdomain. Do not grant those accounts private access. Preserve customer data, retained tests, DNS, and unrelated edits.

## Separate release approvals

Do not request release approval until the required gates above have a result or an explicit owner decision.

Before the request:

1. Read the current PR head and base from GitHub.
2. Confirm the required checks for that exact head.
3. Confirm Vercel's Production branch connection and effective Production settings.
4. Confirm the current Production alias and compatible recovery deployment.
5. Verify hosted migration history with read-only access to project `vdtqxglhlgatpbgehsjk`.
6. Identify any remaining skipped or unverified requirement in the approval request.

Request two separate approvals together:

- Merge the named exact PR head into the named `develop` base. Keep branches and test data.
- Permit the resulting automatic Production deployment using the reviewed effective settings.

A merge to `develop` can start Production deployment immediately. Merge approval alone does not approve that deployment. Preview overrides do not establish Production settings.

After approval, follow [the README runbook](../../README.md#simple-mode-production-runbook). Verify the live source, public pages, protected-route redirects, role navigation, service settings, and error logs. Data-changing Production acceptance needs its own exact batch approval. Keep public-copy approval second-to-last and agreed SEO/domain work last.

## Risks and recovery

The release changes authentication, validation, PDF output, dependencies, and navigation. A defect can block access, file actions, or document preparation. The reviewed tests reduce these risks but do not prove every hosted failure path.

Use a reviewed forward application repair where possible. Any application rollback must support the existing schema. Returning to current Production also restores security weaknesses corrected by this candidate.

A rollback cannot restore revoked sessions or undo sent emails. Vercel Instant Rollback does not update active cron configuration; verify the jobs separately. No database reset, seed, reverse migration, or backup is part of this packet.

Immediate database restoration is unverified. Forward repair cannot recover lost data. Any rollback, live setting change, or data correction needs exact approval.

## References

- [Current release state](../RELEASE_STATE.md)
- [Engineering evidence](HANDOFF.md)
- [Test results and limits](TEST_STATUS.md)
- [Owner decision register](BLOCKERS.md)
- [Launch checklist](LAUNCH_CHECKLIST.md)
