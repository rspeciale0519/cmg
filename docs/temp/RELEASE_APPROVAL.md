# Release approval packet

This packet prepares launch review. It authorizes no merge, deployment, message, account change, purchase, signature, or DNS change.

The packet remains draft. New email and lint-glob repairs passed local checks. Resulting exact-head CI and Preview checks remain pending.

## Reviewed application

| Item | Verified value |
|---|---|
| Draft PR | [PR #28](https://github.com/rspeciale0519/cmg/pull/28) |
| Feature branch | `codex/launch-release-candidate` |
| Current reviewed application revision | Signed `4ee40506c50001f29ba0bd1e7822416175ea7873`; local checks passed; resulting CI/Preview pending |
| Email repair | Signed `27cfd6b221060c0b2faf1b406f8b2494ec3c7ce4`, included in current reviewed source |
| Base branch and revision | `develop` at `1b7f7f98e54a358b3a95875483a63d3f882573a3` |
| Reviewed difference | 20 commits ahead, zero behind, 61 changed files against the verified GitHub base |
| GitHub merge state | Last read at published `cc27f38`: `MERGEABLE` and `CLEAN`; still draft; no submitted review. Recheck the resulting head. |
| Branch controls | `develop` is unprotected. Auto-merge and automatic branch deletion are disabled. |
| Schema | No changes under `supabase/` or in generated database types; no migration is required by this PR. |
| Recorded hosted database | 36 migrations through `20260927120000`; recheck before a release |
| Known Production | `dpl_GoXHV8n8KfTVt5BDyZosJF3jvXPk`, source `develop` at `1b7f7f9`; recorded `SITE_MODE=platform` |

These values were checked on October 28. The comparison uses verified `origin/develop`; the different local `develop` ref was not used.
New email and lint-glob source changes passed local checks. Resulting PR checks remain pending.
Later records-only commits can advance the head. Read final PR-head checks externally before requesting exact merge approval.

The candidate combines security, file validation, session, PDF, dependency, navigation, staff-count, and accessible loading/error fixes. It includes Next.js 16.4.3, Zod 4.6.6, and a Server Action limit change from `256mb` to `2mb`. Private large files use the tested direct-upload flow. Node remains 22. CI and cron configuration are unchanged.

## Passed and limited evidence

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

The repaired adapter passed 20 focused tests in 1.51 seconds and nine independent compatibility checks. The final default Windows one-worker suite passed 1,795 tests and skipped 65 in 538.00 seconds, with exit 0. Of 150 files, 133 passed and 17 skipped. This supersedes the diagnosed glob timeout for the repaired source. Resulting exact-head CI and Preview checks remain pending.

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
