# Release state — CMG Property Solutions

Reconciled 2026-09-17. This file replaces the dated release paragraphs that were spread across ROADMAP, HANDOFF, and BLOCKERS.
Rewrite this file in place. Do not append dated updates to it.

Use [HANDOFF.md](temp/HANDOFF.md) for engineering evidence and checklists.
Use [BLOCKERS.md](temp/BLOCKERS.md) for the owner-decision register.
Use [README.md](../README.md#simple-mode-production-runbook) for the release procedure.

## Production

| Item | Current state |
|---|---|
| Vercel project | `cmgps`, Hobby plan |
| Site mode | `SITE_MODE=simple` |
| Public host | `app.cmgpropertysolutions.net` |
| Deployed commit | `develop` merge commit `383a999` |
| Hosted migrations | 33 applied, through `20260916020100` |
| Backups | The owner declined backups for the applied migrations |
| Recovery path | Reviewed forward repair; immediate restoration is unverified |

Production carries the direct-to-Storage upload transport. Only maximum-size upload boundary acceptance remains open.

## Open pull requests and branches

| Item | Head | State |
|---|---|---|
| PR #2 `docs/record-production-launch-current` | `fc3dd43` | Open into `develop`. All checks green and mergeable. The owner approved the merge and will run it. |
| PR #3 `chore/tooling-hardening` | `86a95b9` | Open into `develop` |
| PR #4 `feature/vendor-link-followthrough` | `5323c31` | Open into `develop` |
| Schema branch | In progress | Adds per-vendor fee settings and schema cleanup |
| Test branch | In progress | Adds action and gate coverage |

PR #2 contains five commits: `c8fb9af`, `8be147c`, `b6774f1`, `b5cfca5`, `fc3dd43`.

## Migration heads

The hosted head is `20260916020100`. The repository head on `develop` matches it.
The in-progress schema branch adds a later migration that is not applied anywhere.
Compare hosted history against repository files before every approved production write.

## Environment

| Item | Current state |
|---|---|
| Turnstile | Managed widget with four authorized hostnames, covering `cmgpropertysolutions.net` and the PR #2 Preview host |
| Resend domain | `cmgpropertysolutions.net`, verified 2026-09-09; sender `claims@cmgpropertysolutions.net` |
| Mail DNS | Microsoft 365 MX and SPF unchanged; Resend DKIM and `send.` subdomain records verified |
| DMARC | `v=DMARC1; p=none;` |
| Cron | `/api/cron/outbox` daily at 14:00 UTC; `/api/cron/storage-cleanup` daily at 14:17 UTC |

Daily cron caveat: Hobby scheduling does not guarantee the configured minute, and a retry or cleanup backlog can take several days to drain.
Whether that delay meets CMG's requirements is still an open owner question.

## Open gates

| Item | Who | Status | Evidence |
|---|---|---|---|
| Merge PR #2 and run post-deploy checks | owner | Approved, not yet run | [HANDOFF](temp/HANDOFF.md#current-release-evidence) |
| Land PR #3, PR #4, and the two in-progress branches | engineering | In progress | [HANDOFF](temp/HANDOFF.md#current-release-evidence) |
| Maximum-size upload boundary acceptance | engineering | Open | [HANDOFF](temp/HANDOFF.md#public-upload-transport) |
| Hosted submission-success and email acceptance for the vendor intake | engineering | Open | [INTAKE_VENDOR_ACCEPTANCE](temp/INTAKE_VENDOR_ACCEPTANCE.md) |
| PandaDoc manual prefilled-PDF path for staff | engineering | Planned for the first release | [PANDADOC_SETUP](temp/PANDADOC_SETUP.md) |
| Staff admin desk activation | engineering | Prerequisites open | [BLOCKERS](temp/BLOCKERS.md) |
| Resend inbox verification for the 2026-09-15 lead | owner | Pending owner sign-in | [BLOCKERS](temp/BLOCKERS.md) |
| Rotate the old preview PandaDoc webhook key | owner | Pending | [BLOCKERS](temp/BLOCKERS.md) |
| Delete stray root folders | owner | Pending | [BLOCKERS](temp/BLOCKERS.md) |
| Cron delay acceptance | owner | Open question | [BLOCKERS](temp/BLOCKERS.md) |
| DMARC `p=none` policy decision | owner | Open question | [BLOCKERS](temp/BLOCKERS.md) |
| Legal review of both bundled LOR PDFs | external | Open | [PANDADOC_SETUP](temp/PANDADOC_SETUP.md) |
| Owner and legal approval of public copy | owner | Deliberately second-to-last | [BLOCKERS](temp/BLOCKERS.md) |
| Commercial Vercel plan | owner | Open | [BLOCKERS](temp/BLOCKERS.md) |
| Private-repository plan and branch protection | owner | Open | [BLOCKERS](temp/BLOCKERS.md) |
| SEO origin fix and `app.` to `www.` cutover | owner | Deliberately last | [BLOCKERS](temp/BLOCKERS.md) |

## Owner decisions — 2026-09-17

- `app.cmgpropertysolutions.net` stays the demo host until CMG pays for commercial hosting.
- The SEO origin fix in `src/lib/site.ts`, which hardcodes `www`, and the `app.` to `www.` cutover are deliberately last.
- Owner and legal approval of public copy is deliberately second-to-last. It covers the statistics, the testimonial, "Se habla español", "licensed and bonded in every state", and the partner payment promises.
- PandaDoc e-signing must ship in the first release. "Simple mode excludes PandaDoc" is no longer the target.
- The planned path is a staff admin desk open to CMG staff, with a manual prefilled-PDF PandaDoc flow that avoids API fees.
- Customer and partner logins wait for a separate decision.
- The CMG standard fee is 20 percent. A per-vendor fee is a staff-only setting.
- The owner will rotate the old preview PandaDoc webhook key if it is still active, and delete the stray root folders.
- Backups stay declined. Recovery is reviewed forward repair.

## Ordered next steps

1. Merge PR #2 into `develop`, then run the post-deploy checks on the new Production deployment.
2. Land PR #3 and PR #4.
3. Land the per-vendor fee schema branch, then the test-coverage branch.
4. Build the manual prefilled-PDF PandaDoc path.
5. Complete the staff-desk activation prerequisites: staff MFA and AAL2, role boundaries, private document access, and hosted acceptance.
6. Obtain owner and legal approval of the public copy.
7. Apply the SEO origin fix and cut `app.` over to `www.` last.
