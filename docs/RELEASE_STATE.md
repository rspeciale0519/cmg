# Release state — CMG Property Solutions

Reconciled 2026-10-05. Rewrite this file in place. Do not append dated updates to it.

Use [HANDOFF.md](temp/HANDOFF.md) for engineering evidence and checklists.
Use [BLOCKERS.md](temp/BLOCKERS.md) for the owner-decision register.
Use [README.md](../README.md#simple-mode-production-runbook) for the release procedure.
Use [LAUNCH_CHECKLIST.md](temp/LAUNCH_CHECKLIST.md) for full-platform completion requirements.

## Production

| Item | Current state |
|---|---|
| Vercel project | `cmgps`, Hobby plan |
| Site mode | Production uses `SITE_MODE=staff`. Default Preview and Development use `simple`; selected branch Previews have `platform` overrides. |
| Public host | `app.cmgpropertysolutions.net` |
| Deployed code | Read-only Vercel inspection on 2026-10-04 confirmed ready Production deployment `dpl_AcDgdsGubFaSGLvUoVRU8Wax54nZ` at `develop` commit `2fdf6bd0982c9be5b58ae76b998870c5f215083f`, with `app.cmgpropertysolutions.net` assigned |
| Hosted migrations | Approved private-upload migration applied on 2026-09-30; 36 applied, through `20260927120000` |
| Backups | The owner declined backups for the applied migrations |
| Recovery path | Reviewed forward repair; immediate restoration is unverified |

Production carries the direct-to-Storage upload transport, contractor intake fields, vendor intake links, the per-vendor fee setting, the prefilled Letter of Representation download, the corrected agreement-type checkbox positions, password recovery on the sign-in form, and the `staff` site mode. The staff desk is live: `/login`, `/mfa`, and `/admin` are open; `/portal`, `/partner`, and `/invite` stay closed.

Production environment facts recorded on 2026-09-22: `PANDADOC_API_KEY` and `PANDADOC_WEBHOOK_SHARED_KEY` apply to Preview only. Production uses the manual e-signing path. A current webhook response has not been checked. Supabase public sign-up is disabled; accounts are created only by invitation.

Synthetic test claims in Production: `CMG-2026-0001` (new intake), `CMG-2026-0002` (under review), `CMG-2026-0003` (`lor_signed`, signed letter uploaded, fee 20%), and `CMG-2026-0004` (under review, fee 20% seeded at acceptance). Their descriptions mark them as tests.

## Pull requests

PRs #1 through #17 are merged into `develop`. PR #18, `bugfix/partner-directory-count`, is open against `develop`.
GitHub run `36003466471` passed `verify` and `database` for head `2fdf6bd`.
Read-only GitHub inspection on 2026-09-30 confirmed that PR #18 remains open at `284d155`. Its `verify` and `database` checks passed in run `36351680879`; Vercel and CodeRabbit also passed.
The private-upload fix is committed as `aa19129` on `bugfix/private-upload-transport`. With separate owner approvals, it was pushed and PR #19 was opened against `develop` on 2026-09-30. The remote branch matches the full commit, and the isolated worktree is clean. Vercel deployment `EYvgCwCaHHCX9KAZg8wJvDmR7AzB` completed successfully. CI run `36765828554` passed `database` but failed the `verify` dependency audit: Next.js 16.3.5 has a critical advisory, and transitive brace-expansion and undici have high advisories. No merge is approved. Commit approval excluded the main-worktree release records and unrelated edits.

The owner approved local dependency patches and then separately approved their commit and push. Commit `c3e4781` contains only `package.json` and `package-lock.json`: Next.js and eslint-config-next 16.3.8, brace-expansion 1.1.21 and 5.0.12, and undici 8.11.2. The isolated worktree is clean. Local audit reports zero vulnerabilities. Type check, lint, build, full Vitest, database-backed Vitest, and the local document-page smoke check passed. PR #19 and its remote branch now match `c3e478116f1dae1d47ab524bf8d3b05e5f1c55a4`. CI run `36776578059` passed both verify and database. The patched Preview build and CodeRabbit check also passed. The Preview login route redirects to platform-disabled; private hosted acceptance needs a branch-only platform configuration. No merge or Production activation is approved.

## Migration heads

The verified hosted head is `20260927120000`; `develop` remains at migration head `20260917130000`.
The owner separately approved `20260927120000_private_upload_sessions.sql` without a backup. It was applied to CMG Production on 2026-09-30 before the dependent application deployment. Schema, RLS, grants, document guards, cleanup protection, and the stored SQL hash passed verification. The private-upload branch was then pushed with separate approval. Its automatic Preview build passed; GitHub CI and hosted acceptance remain open.
Compare hosted history against repository files before every approved Production write.
The connector denied access on 2026-10-04; no query ran.
The existing authorized Supabase browser session then showed all 36 migration versions and names.
They match the private-upload branch through `20260927120000`.
The stored SQL hash and schema checks were not repeated.

The 2026-09-26 migration check used a read-only connection and did not print the database password.
Do not pass a production database URL on a visible command line. Obtain separate approval for every Production write.

## Site modes

| Mode | Open | Closed |
|---|---|---|
| `simple` | Public site and forms | All six private prefixes |
| `staff` | `/login`, `/mfa`, `/admin` | `/portal`, `/partner`, `/invite` |
| `platform` | Everything | Nothing |

Unknown or missing values resolve to `simple`. In `staff` mode, only the three staff-alert email templates are added, because the other private templates link into portals that stay closed. Outbox rows older than `OUTBOX_MAX_AGE_DAYS` (default 7) are dead-lettered instead of sent. While `/invite` is closed, accepting an intake issues no invitations, and every admin invite control shows a "paused" note.

Invitation is the only way to create an account, so staff mode cannot add new staff members until `/invite` reopens.

## E-signing

The first release uses the manual path.
Staff download a prefilled letter, upload it to PandaDoc, and record the confirmed send with **Mark letter as sent**.
After all signatures, staff upload the final copy as `lor_signed` and separately advance the claim to **LOR signed**.
Upload alone does not advance manual claim status.
Actual web-upload field recognition, assignment, and signing remain open acceptance requirements.
This path needs no PandaDoc API key or webhook.
The API path remains in the code for later.
Current PR #19 Preview reports API and webhook keys as configured.
Its nonblank API key selects the API provider; it does not match manual Production signing.
Manual hosted acceptance requires separately approved branch-only key overrides and redeployment.
Keep shared Preview values and Production unchanged. Do not send through the API for this test.

## Staff-desk acceptance — 2026-09-22 and 2026-09-23

| Step | Result |
|---|---|
| Owner sign-in with TOTP | Pass |
| Dashboard, intake queue, claims list, partners, staff, settings | Pass; no console errors |
| Letter refuses with no saved fee | Pass |
| Save fee on Financials | Pass |
| Download prefilled letter | Pass; valid 2.3 MB PDF |
| Mark letter as sent | Pass; claim moved to `lor_sent`, feed entry recorded |
| `lor_signed` blocked until a signed letter is uploaded | Pass |
| Accept intake | Pass; 20% fee seeded, no invitations issued in staff mode |
| Password recovery routes | Pass, including real email delivery. On 2026-09-23 Resend showed "Reset your CMG password" delivered to the owner's address. |
| Forgot-password retry | Watch item. The first submission in Chrome was refused once. The retry succeeded. The cause is unknown. |
| Upload a signed letter | Pass on 2026-09-23. A signed LOR was uploaded to `CMG-2026-0003` as kind `lor_signed` (CMG only). The claim moved to `lor_signed`, and the Representation signed milestone was recorded. |
| Letter panel after `lor_signed` | The panel showed stale pending controls on 2026-09-23. PR #16 merged a fix; current rendered behavior still needs confirmation. |

## Environment

| Item | Current state |
|---|---|
| Turnstile | Managed widget with six authorized hostnames, including PR #19's stable Preview host added with approval on 2026-10-05; existing hosts stayed in place |
| Resend domain | `cmgpropertysolutions.net`, verified 2026-09-09; sender `claims@cmgpropertysolutions.net` |
| Mail DNS | Microsoft 365 MX and SPF unchanged; Resend DKIM and `send.` subdomain records verified |
| DMARC | `v=DMARC1; p=none;` |
| Cron | `/api/cron/outbox` daily at 14:00 UTC; `/api/cron/storage-cleanup` daily at 14:17 UTC |

The approved private-upload branch now has Preview-only `SITE_MODE=platform` and its stable `NEXT_PUBLIC_SITE_URL` override.
PR #19's current branch host is `cmgps-git-bugfix-private-upload-t-cffa43-robs-projects-c72886ba.vercel.app`.
The ready deployment renders login and redirects unauthenticated private routes to login.
The restored Codex browser supplied the authorized Cloudflare session on 2026-10-05.
The approved PR #19 hostname was saved as the sixth entry.
All five previous entries, Managed mode, and disabled pre-clearance stayed unchanged.
Password recovery, contact, and intake now complete automatic verification without the failure message.
Each form held a nonempty response; no response value was printed and no form was submitted.
Cloudflare iframe logs contain obfuscated warning and error entries; full request tracing remains unverified.
Production settings, DNS, credentials, and widget keys did not change.
Current Vercel cron settings show both daily schedules enabled and matching `vercel.json`.
Recent Production cron logs are empty within the available last-hour window; scheduled execution remains unverified.

Read-only checks on 2026-09-26 found the `app.` CNAME at `50238cf0f774d850.vercel-dns-017.com`.
The Microsoft 365 MX remains present, and DMARC remains `v=DMARC1; p=none;`.
The `app.` TLS certificate passed normal validation with TLS 1.3 and expires on 2026-12-08.
No DNS record or certificate setting changed during these checks.

Daily cron caveat: Hobby scheduling does not guarantee the configured minute, and a retry or cleanup backlog can take several days to drain.
The connector denied the queue read on 2026-10-04.
Read-only browser filters then verified zero pending or failed messages among 28 outbox records.
Eleven records remain dead, including four claim updates and the old invitation.
All five cleanup records have a completion timestamp; no unprocessed job remains.
No record was changed, and no message was sent.
Read-only inspection on 2026-09-27 found four pending `claim_status_update` messages for synthetic test claims.
Two were older than seven days and had a stale `www` portal link. The newer two linked to `app.`.
The Storage cleanup queue had no open jobs; all three retained rows were processed.
One failed August invitation was also owed. Its first send failed while the old `updates.` sender domain was unverified.
With owner approval, all five synthetic rows were marked `dead` on 2026-09-27. The rows remain for review, and no pending or failed outbox rows remain.

PR #19's hydration finding was repaired and pushed as `d8e55fa` with separate approvals. PR #19 and the remote branch match `d8e55fa5444af9b4f2486381860bfb708dd0f934`. CI run `37244906090` passed database checks but failed verify at the dependency audit. Vercel deployment `D9eKGZ14YuXYm7auuQW2cbhyUN63` and CodeRabbit passed. No merge or Production change is approved.

## Current dependency audit

The failed audit reports five high findings from one `braces` dependency chain under the Next.js ESLint plugin. The current advisory lists no patched `braces` release. The registry's latest stable and canary Next.js ESLint plugins still depend on `fast-glob`.

A scoped local override replaces only `@next/eslint-plugin-next@16.3.8`'s glob dependency.
A direct tinyglobby alias failed compatibility tests and was rejected.
The private adapter preserves static directories, absolute paths, and filesystem roots.
It rejects unsupported calls.
The generated lock removes `braces` and `micromatch` without changing unrelated package versions.

Final checks passed: four compatibility tests, type checking, lint, 1,655 unit tests, and the optimized build.
Fifty-five credential-dependent or opt-in tests skipped.
Audit reports zero vulnerabilities.
Review found that the adapter needs Node 22.12 or later.
The manifest now requires `^22.12.0`.
After that metadata correction, exact `npm ci`, compatibility tests, audit, and diff checks passed again.

No audit threshold or lint rule changed.
Database checks were not repeated because this repair changes development tooling only.
The owner approved the six-file commit on 2026-10-05.
The final staged check found an extra blank line at the adapter's end; it was removed without changing behavior.
The staged diff check then passed, and commit `3922e5a` contains only the six reviewed files.
The isolated worktree is clean.
The owner approved the push and the Turnstile hostname addition.
Two push attempts did not execute because automatic approval review failed with a model-capacity error.
The next retry succeeded. PR #19 now matches `3922e5a08e8ad89780225825e9ea64ee28b6aa42`.
CI run `37314652490` passed both `verify` and `database`; Vercel and CodeRabbit also passed.
The restored Codex browser completed the approved Turnstile hostname addition and verification retest.
The owner approved both branch-only overrides and Preview redeployment.
The Vercel dashboard saved `SITE_MODE=platform` and `NEXT_PUBLIC_SITE_URL=https://cmgps-git-bugfix-private-upload-t-cffa43-robs-projects-c72886ba.vercel.app` for Preview branch `bugfix/private-upload-transport` only.
Ready Preview deployment `dpl_5dkvuwLMDURbm1qEe2dQM8r8g1T2` uses `3922e5a` and the stable branch alias.
The login page renders. Unauthenticated admin, portal, partner, and MFA routes redirect to login.
The synthetic invalid invite shows the generic expired-link page, with no captured console warning or error.
Login and invalid-invite layouts passed at 390px after the viewport settled; no horizontal overflow remained.
Production `/portal` still redirects to `/platform-disabled`.
The owner signed in through Chrome. Current owner pages now open on this PR #19 Preview.
The owner also restored Resend access. Provider delivery records were inspected without sending or retrying a message.
Resend Metrics reports eight emails, 100% deliverability, zero bounces, and zero complaints for September 21–October 5.
No Resend webhook is configured. The application records provider acceptance rather than subsequent delivery events.
Daily operator review and a monitored reply mailbox remain open email-operation requirements.
Fresh GitHub reads confirm both PRs remain open at `284d155` and `3922e5a`, with successful recorded checks and individual mergeability.
Each PR retains one unresolved review thread. Exact head contents already fix the README selection and upload hydration findings.
No review thread, comment, or remote record changed. Combined release checks remain required.
Recovery, contact, and intake verification passed at measured 390px without horizontal overflow.
The remaining three FAQ disclosures opened and closed with Enter at desktop width.
Read-only `git merge-tree --trivial-merge` review of PR #18 at `284d155` and PR #19 at `3922e5a` reports two test-file conflicts.
They affect `src/lib/intake/test-fixtures.ts` and `src/lib/storage-cleanup/intake-uploads.test.ts`.
Integration must retain PR #19's exact local-stack allowlist and PR #18's partner regression and CI selection.
The owner authorized the local integration task. Branch `bugfix/launch-integration` now combines both PR heads from `develop` at `2fdf6bd`.
It reuses the previously clean private-upload worktree. Both original branches and all remotes remain unchanged.
The two conflicts retain PR #19's exact fixture allowlist and cleanup safeguards.
The candidate also retains PR #18's partner fix and database CI selection.
Adversarial review found a silent count-query failure. Local repair rejects failed or missing counts with a generic error.
The admin error boundary now uses Next.js 16.3's `retry()` to refresh server data before recovery.
Eight focused tests, type check, lint, and the final full unit run passed after the retry repair.
The first combined full run passed 117 files and 1,662 tests; 13 files and 56 tests skipped.
The final full run passed 118 files and 1,663 tests; 13 files and 56 tests skipped.
Mode-specific checks then found a test fixture that assumed an unset `SITE_MODE`.
Only the test changed: it explicitly unsets the variable for the missing-value case and checks all three environment modes.
All five affected files and 113 tests passed in each of `simple`, `staff`, and `platform`.
Type check and lint passed again after that test-only repair. Runtime mode rules did not change.
The final platform build passed after the retry repair. Audit reports zero vulnerabilities.
The owner approved the disposable-stack reset on 2026-10-05. It completed on ports 15521/15522 using the verified scratch directory.
All 36 migrations applied. Combined pgTAP passed 44 files and 1,350 assertions.
The database-backed CI selection passed 34 files and 243 tests; one intentional live PandaDoc file and test skipped.
Fresh generated database types match the candidate. Credentials stayed in memory, and live provider tests remained disabled.
Combined hosted acceptance remains open. No commit, push, PR update, remote merge, or deployment occurred.
Production, retained local stacks, and DNS stay unchanged. No backup was created.

Current hosted owner reads passed dashboard, staff, intake, leads, questions, settings, audit, and all six sections of synthetic claim `CMG-2026-0003`.
Owner requests to customer and vendor portals redirect to the staff dashboard.
Missing and malformed claim IDs show identical generic not-found text at 390px without overflow or captured warnings/errors.
The claim has four documents and a completed representation panel. The staff upload form uses POST and becomes enabled after hydration.
Dashboard, documents, claims, settings, staff, intake, leads, questions, audit, and all synthetic claim sections fit a measured 390px viewport.
Synthetic claim search returned the expected empty state. The New lead filter returned two leads.
The current PR #19 Preview still shows an empty partner directory because PR #18's fix is absent there.
The combined candidate must pass that hosted check before release.
Chrome captured five asynchronous-listener errors on the claim overview. Their source is unverified; no later error appeared in these reads.
Full request tracing remains unavailable. No hosted record, role, claim status, financial value, or document changed.
Temporary viewport overrides were cleared. The original owner tab remains on the dashboard at normal width.

Resend shows Delivered for the staff invitation to `4miodio@gmail.com` and vendor invitation to `robspeciale@gmail.com`.
It also shows Delivered for the 2026-09-15 synthetic lead receipt and staff alert.
The homeowner invite, owner and homeowner reset messages, and synthetic question alert are Delivered.
Provider delivery does not prove inbox receipt. The lead's inbox receipt remains an owner check.
The current Resend domain list confirms `cmgpropertysolutions.net` is verified.
The older unused `updates.cmgpropertysolutions.net` entry is not started. It was not changed or removed.

## Combined PR review

Read-only inspection confirmed that PR #18 remains open at `284d155`, with all recorded checks passing. PR #19 remains open at `3922e5a`, with verify, database, Vercel, and CodeRabbit passing. PR #18's README correction addresses its recorded review finding. PR #19's hydration repair addresses its recorded review finding. No review comment was changed or resolved remotely.

The 2026-10-04 GitHub review found no new PR #19 finding.
Its one recorded hydration finding still refers to the earlier code.
The current `develop` head is `2fdf6bd0982c9be5b58ae76b998870c5f215083f`; GitHub reports it as unprotected.
The existing account permitted these reads; no credential or permission changed.

Both PRs change `src/lib/intake/test-fixtures.ts` and `src/lib/storage-cleanup/intake-uploads.test.ts`. The authorized local combination retains PR #19's explicit stack allowlist and PR #18's partner-count regression and CI selection. The current separate Previews do not prove the combined release. No remote merge, deployment, or Production activation occurred.

## Open gates

| Item | Who | Status |
|---|---|---|
| Admin invitations for staff, vendors, and homeowners | engineering, then owner | Local synthetic browser acceptance passed on 2026-09-26. Hosted owner sign-in and MFA passed on 2026-09-27. A branch-only Preview URL override was deployed after the first homeowner invite linked to closed Production. The approved resend was Delivered; homeowner redemption and portal access passed. The customer cannot open staff or partner routes. The visible PNG downloaded with an audit entry. A synthetic question appeared on the claim, and its staff alert was Delivered. Two 68-byte synthetic uploads were stored during browser testing. Four owner pages and the homeowner document page fit 390px without horizontal overflow. One synthetic partner company was created. The approved adjuster and vendor invitations were sent. The owner reports both test portals open. The vendor sees the synthetic company, no referred claims, and cannot open staff or homeowner routes. The adjuster sees an empty assigned caseload; owner pages and an unassigned claim return not-found. Replay, provider delivery records, and upload boundaries stay open. |
| Owed customer messages | engineering | Five old synthetic rows were marked `dead` with owner approval on 2026-09-27. The rows remain for review. No pending or failed outbox rows remain. |
| Maximum-size upload boundary acceptance | engineering | Hosted acceptance remains open. Homeowner and staff uploads use multipart Server Actions while the UI offers 25 MiB. [Vercel documents a 4.5 MB function request limit](https://vercel.com/docs/errors/function_payload_too_large). Public intake uses direct-to-Storage upload. An isolated local branch contains a private direct-to-Storage fix. On 2026-09-29, a fresh disposable reset applied the final migration, and all 44 pgTAP files passed with 1,350 assertions. The database-backed CI selection passed. On 2026-09-30, the local homeowner Chrome upload succeeded after a local CSP correction. Its database record and Storage object both contain exactly 26,214,400 bytes. Type-check, lint, full Vitest, and the optimized build passed after that correction. Local Chrome refused the one-byte-over-limit file without a document or upload reservation. Staff MFA and assigned-claim document access passed. The approved local staff 25 MiB upload passed with internal visibility, exact byte counts, and a completed session. Homeowner page and direct API access exclude it. Both document pages fit 390px. Hosted boundaries remain open. Apply the migration before deploying code that calls its cleanup RPC. |
| Rotate the old preview PandaDoc webhook key | owner | Pending |
| Delete stray root folders | owner | Pending |
| Cron delay acceptance | owner | Both daily schedules are enabled. Scheduled execution and acceptable retry delay remain open. |
| DMARC `p=none` policy decision | owner | Open question |
| Legal review of both bundled LOR PDFs | external | Open. The checkbox positions were corrected on 2026-09-22 and owner-checked visually. |
| Owner and legal approval of public copy | owner | Deliberately second-to-last |
| Commercial Vercel plan | owner | Open |
| Private-repository plan and branch protection | owner | Open |
| SEO origin fix and `app.` to `www.` cutover | owner | Deliberately last |

## Owner decisions

- `app.cmgpropertysolutions.net` stays the demo host until CMG pays for the project.
- The SEO origin fix in `src/lib/site.ts`, which hardcodes `www`, and the `app.` to `www.` cutover are deliberately last.
- Owner and legal approval of public copy is deliberately second-to-last. It covers the statistics, the testimonial, "Se habla español", "licensed and bonded in every state", and the partner payment promises.
- E-signing ships in the first release through the manual prefilled-PDF path, which avoids PandaDoc API fees.
- The staff desk opens first. On 2026-09-23 the owner decided that admins must be able to invite staff, vendors, and homeowners. This opens customer and partner logins through `SITE_MODE=platform`.
- The CMG standard fee is 20 percent. Each vendor can have its own rate, set by owners only. The public form never sets a fee.
- Backups stay declined. Recovery is reviewed forward repair.

## Ordered next steps

1. Preview configuration and its Turnstile hostname addition are complete; no duplicate approval is needed.
2. Review the passing combined local candidate and obtain separate approval for its commit.
3. Obtain separate Git and Preview approvals, then verify the combined hosted candidate.
4. Complete remaining role, upload, invitation, and operational acceptance against the launch checklist.
5. Obtain separate merge and Production deployment approvals.
6. Recheck queues before requesting separate Production platform activation approval.
7. Test the activated full platform.
8. Complete the separately approved real PandaDoc signing test.
9. Resolve commercial hosting, repository protection, email operations, privacy, retention, and legal gates.
10. Obtain owner and legal approval of public copy second-to-last.
11. Complete approved SEO and domain work last.
