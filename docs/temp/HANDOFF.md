# CMG simple-mode release handoff

## Current local intake work — 2026-09-16

Contractor fields, optional legacy loss time, and vendor-specific intake links are implemented locally.
See [INTAKE_VENDOR_ACCEPTANCE.md](INTAKE_VENDOR_ACCEPTANCE.md) for checks, migration order, and remaining browser acceptance.
The owner-approved commit `b5cfca5` is pushed to `docs/record-production-launch-current`. Production is not deployed.
The earlier Turnstile release commit is `b6774f1`.
Existing DNS remains unchanged. No Supabase backup was created.

### Pushed Preview acceptance — 2026-09-16

The owner-approved push of `b5cfca5` succeeded. Vercel reports its Preview deployment complete.
Native browser checks used the stable PR #2 Preview hostname.
Home, Services, Contractors, About, Contact, and File a claim fit widths 320, 390, and 1280 pixels.
Each route has its main heading. No completed broken images were observed.
A 320-pixel intake screenshot confirms the mobile layout. All four contractor fields are optional; no time input exists.
Keyboard Tab moves from First name to Last name. The empty form has 23 invalid required controls.
Admin, partner, portal, login, and MFA visits show the disabled-platform notice.
The inspected console log returned no warnings or errors. Full network and successful submission checks remain open.
No submission, email, DNS change, merge, or Production deployment occurred. The viewport override was reset.
The browser tab remains available for continued acceptance.

### Fresh release verification — 2026-09-16

PR #2 remains open into `develop`. Its remote head is now `b5cfca5`.
GitHub run `35114872284` and Vercel Preview deployment `8x4DTzJRFdoBUXzwFMk4Lxozr8AF` started for this head.
Verify passed in 3m1s, including the head build. Database passed in 3m26s. Vercel and CodeRabbit also passed.
CI log totals: verify ran 89 passing files and 1,019 passing tests, with 12 files and 54 tests skipped.
The database job passed all 41 pgTAP files and 1,287 assertions.
Its database-backed Vitest selection passed 30 files and 205 tests; one file and one test were skipped.
These selections overlap; do not sum them as distinct tests. Live PandaDoc acceptance remains unverified.
GitHub confirms PR #2 is mergeable at `b5cfca5`; this does not grant merge approval.
The owner approved four Production migrations without a backup: `20260913050000`, `20260916010000`, `20260916020000`, and `20260916020100`.
The verified project had 29 migrations before application. Approved migration files matched commit `b5cfca5`.
All four migrations and their history entries committed in one transaction, with bounded lock and statement timeouts.
Read-only verification confirms 33 migrations through `20260916020100`, six added columns, constraints, and the ready, valid index.
Vendor codes are non-null and unique. Claims and partner-company RLS remain enabled.
The submission RPC remains security-invoker with an empty search path and service-role-only execution among application roles.
Its definition contains contractor and vendor fields. The reference-capacity guard is present.
The schema cache received a reload notification. No seed, claim submission, or email test ran.
Hosted browser acceptance remains open. Push, PR updates, merge, and deployment need separate approval.
The owner's instruction prohibits creating a Supabase backup. Recovery requires reviewed forward repair; immediate restoration is unverified.

`npm audit --audit-level=high` reports zero vulnerabilities.
Native browser layout checks pass for Home, Services, Contractors, About, Contact, and File a claim at 320, 390, and 1280 pixels.
Every route has its main heading and no horizontal overflow. No completed broken images were observed.
An intake screenshot at 320 pixels confirms the visible layout. All visible form fields remain inside the viewport.
Keyboard Tab moves from First name to Last name. The empty intake reports 23 invalid required controls.
Native visits to `/admin`, `/partner`, `/portal`, `/login`, and `/mfa` each reach `/platform-disabled` in simple mode.
The inspected console log returned no warnings or errors during route checks.
The intake still displays the local verification failure message. No form submission or email occurred.
These checks do not establish full network, submission-success, or hosted acceptance.
The local preview server was stopped after testing. Browser viewport settings were restored.

Owner decision — 2026-09-15: the five reviewed files are approved for a local commit only.
The owner deferred Resend sign-in until returning to the office. Provider delivery and inbox receipt remain unverified.
Earlier pending-commit statements below describe prior checkpoints. Push, merge, deployment, and the new hosted migration are not authorized by this approval.

## Historical Native Preview contact acceptance — 2026-09-15

The approved synthetic contact submission returned `Request received.` after the hostname update.
The hosted lead `0d9b170b-3053-4f90-889c-a9b7085942bd` was created at `2026-09-15T16:35:05.603624Z`.
Read-only verification found both outbox entries sent after one attempt: staff alert `0a713a45-be98-4c94-bb32-b3876a138e85` and auto-reply `e53b6bd7-3686-4b1a-8af9-a0b2305efbf5`.
Recipients use the approved staff inbox and `rob@miodiollc.com`. Provider delivery and inbox receipt are not yet verified for this submission.
The application returned success through its fail-closed Turnstile submission path. Cloudflare's dashboard warning still needs reconciliation with provider activity.
The browser log contains Cloudflare-frame `NaN` diagnostic messages; do not claim a clean console for this submission.
At this checkpoint, the local Turnstile runtime-error patch was uncommitted and absent from this Preview. It is now committed as `b6774f1`.

## Approved hostname update — 2026-09-15

Cloudflare saved `cmgps-git-docs-record-production-c2abd6-robs-projects-c72886ba.vercel.app` as the fourth CMG widget hostname.
The custom-hostname option was visible in the screenshot despite an incomplete accessibility list. Selecting it added the entry before Update.
The save confirmation and four-hostname count verify persistence. The three existing hostnames, Managed mode, and disabled pre-clearance remain unchanged.
The native Preview contact page reopened without warnings or errors in the inspected console log. No form was submitted during this check.
Cloudflare also displays a Siteverify warning. This needs reconciliation with a complete submission and server-side verification evidence; it does not prove a code defect alone.
No DNS change, backup, merge, Production deployment, or hosted migration occurred.

## Continuation check — 2026-09-15

### Preview hostname acceptance

The latest owner record confirms that the approved hostname addition saved successfully, with four hostnames and unchanged widget mode and pre-clearance.
A fresh native Preview contact page now shows Turnstile `Success!` without manual challenge interaction.
This supersedes the earlier missing-hostname blocker below. No form was submitted in this check; server-side validation and email acceptance on this Preview remain unverified.
The captured console contains opaque warnings and errors from the Cloudflare challenge frame. A clean-console result is not claimed.
The local widget patch still requires separate commit and push approval before its remote acceptance can run.

### New local runtime-verification fix

Native Preview acceptance reproduced Turnstile error `110200` with no accessible explanation in the form.
The shared widget caught script-load failures but did not register the provider's runtime error callback.
The local fix announces the failure with `role="alert"`, preserves the widget for automatic retries, and clears the message after success.
Server-side token validation and the public submission order remain unchanged.
The regression failed before the fix and passes afterward. The provider callback contract follows [Cloudflare's error documentation](https://developers.cloudflare.com/turnstile/troubleshooting/client-side-errors/).

The local native browser rendered the error using Cloudflare's always-failing test site key.
The message fits at 320px and desktop; DOM measurements show no horizontal overflow at 320, 390, or 1280px.
The 390px screenshot was clipped by the browser panel, so complete visual acceptance at that width remains open.
The temporary viewport was reset. The test-only dev server was stopped before the production build.
No hosted form, email, upload, DNS, or widget setting was changed in this continuation.

Type-check, build, and dependency audit pass under Node.js 22. Audit reports zero vulnerabilities.
Lint passes with the two existing unused-variable warnings in `intake-rollback.test.ts`.
The three focused suites pass all 16 tests in each explicit site mode, simple and platform.
The first full run passed all 1,048 assertions but failed its upload fixture cleanup because the sandbox could not confirm the local Docker container.
The full rerun with Docker access passes 98 files and 1,048 tests. One live PandaDoc file/test is intentionally skipped.
Five synthetic local upload sessions remained from the first run. A read-only preflight confirmed the CMG database port `15422`, zero retained claims, and zero retained Storage objects for their exact IDs.
Cleanup removed only those five session rows and their 13 file metadata rows in one transaction. These disposable fixture rows are reproducible by the test suite; no reset, seed, user-record deletion, or hosted write occurred.
The local patch is ready for commit review. Commit and push still require separate approval.
The remote green checks below cover `8be147c`, not this uncommitted patch.

PR #2 remains open at `8be147c`. Fresh GitHub checks confirm successful `verify`, `database`, and Vercel results.
The successful `verify` job includes the production build. PR #1 is already merged.
The existing local HANDOFF and BLOCKERS edits remain preserved and uncommitted.

Cloudflare sign-in is now available. The widget still lists exactly three hostnames; the approved PR #2 Preview hostname is absent.
Entering that exact hostname produced `No results`. Enter submitted the existing settings and displayed a success notice, but a fresh settings read still showed only the original three hostnames.
The attempted save therefore did not complete the hostname addition. No DNS, widget mode, pre-clearance, or key change occurred.
The settings tab remains open for owner completion. Preview form acceptance remains blocked on the hostname addition.

Cloudflare also displays a missing-Siteverify-activity warning. Source inspection confirms public actions call the fail-closed Siteverify helper; this does not prove current hosted provider activity.
Focused validation under Node.js `22.22.2` passes both `turnstile.test.ts` and `public-rate-limit-order.test.ts`: two files and 13 tests.
The initial same selection also passed under the shell's Node.js `24.20.0`; the Node.js 22 rerun is the project-version evidence.
Production migration, merge, deployment, legal, commercial-plan, recovery, and final acceptance gates remain open.

## Current release status — 2026-09-14

This section supersedes older pending-commit and remote-check statements below.
Commit `8be147c` is pushed on `docs/record-production-launch-current`; PR #2 remains open into `develop`.
GitHub `verify` and `database`, CodeRabbit, and Vercel Preview checks pass for that commit.
The approved PR title and description update is complete. Production and hosted migrations remain unchanged.
The new capacity migration still needs separate Production approval. No backup is authorized.

Latest native Preview checks cover Home, Contact, Services, Contractors, About, and intake at 1280 pixels without horizontal overflow.
Services, Contractors, and About show no completed broken images. Contact FAQ keyboard expansion passes.
Intake adds four required second-policyholder fields when Yes is selected and removes them when No is selected.
The admin route remains disabled. These checks do not prove mobile, complete visual, network, or form-success acceptance.
Turnstile reports `110200` on the new Preview hostname. The owner approved adding that exact hostname; Cloudflare sign-in now blocks the change.
DNS must stay unchanged. No widget settings have changed.
Chrome fallback measurements pass for all six public Preview routes at actual widths of 320 and 390 pixels without horizontal overflow.
Browser control interrupted the last navigation; a direct retry completed the remaining intake measurement. The temporary viewport override was reset.
These measurements do not prove complete mobile visual, keyboard, network, or form-success acceptance. The native browser is currently unavailable.
The evidence below identifies the Preview URL and deployment. This documentation update remains local and uncommitted.

## Full-platform acceptance update — 2026-09-13

### Completion gates

This table separates the current release requirements from the historical records below. Release completion remains unproven.

| Requirement | Current evidence | Remaining gate |
|---|---|---|
| Safe live-test discovery | Source checks shell opt-in before optional `.env.local`; discovery regression and README/environment examples cover the contract. | None for discovery; live provider acceptance is separate. |
| Local verification | Post-patch type, lint, build, audit, full Vitest, both selected site modes, and isolated reset/pgTAP pass. | Shared-data cleanup tests require an isolated fixture baseline. |
| Release defect review | Local dependency patches and annual reference guard have regression evidence. MFA test fixtures preserve existing factors. | New code and migration are not deployed. |
| Release records | README, ROADMAP, HANDOFF, BLOCKERS, and local PR description reflect current evidence. | Review and commit remain pending. |
| Interface acceptance | Public widths and partial native owner/customer/partner checks are recorded below. | Complete native role workflows, uploads, states, and latest patched Preview acceptance. Turnstile and MFA gates remain. |
| Remote checks | Fresh GitHub read confirms PR #1 merged into `develop`; its verify, database, and Vercel checks pass. | Commit, push, new remote review, and checks covering the local patch require separate authorization. |
| Production preparation | Approved 29 migrations, public email delivery, private test upload, DNS/TLS, and queue progress have evidence. | New migration approval, recovery limits, legal approval, commercial hosting, and authenticated cron-log verification. No backup is authorized. |
| Protected release | Production exists at the prior merged release. Fresh HTTPS checks return 200 publicly and 307 to `/platform-disabled` for five private entry routes. | Branch protection, current patched deployment, and final post-release acceptance remain incomplete. |
| Later platform scope | Only the approved Preview exposes platform routes; Production remains simple. | Full hosted role/signing acceptance, retention policy, export, and erasure work remain separate unresolved requirements. |

The current GitHub checks cover head `099f351155d821cef7b3ac2db17a2a59137b05f8`, merged as `383a99936ca7536f7e5522ea71387c2b788763df`.
They do not cover the uncommitted security patch or new capacity migration. No completion claim follows from the old green checks.

The owner resumed full-platform acceptance and approved the six pending hosted migrations without a backup.
This section supersedes earlier pending-migration and email-test statements below.
Production remains in simple mode. Preview platform activation is separately approved for `feature/claims-platform`.

- Supabase applied exactly `20260830120000` through `20260830124100`; those 29 migrations are recorded remotely. A later local capacity-guard migration is pending, as recorded below.
- No backup, seed, reset, DNS change, or existing-object deletion occurred.
- Both new upload tables have RLS enabled. `anon` and `authenticated` cannot execute the service-only upload preparation RPC.
- The preflight found zero documents and zero Storage objects before the synthetic upload test.
- The contact test created one `CMG Acceptance Email Test` lead. Resend recorded both staff alert and `rob@miodiollc.com` auto-reply as Delivered.
- Resend auto-reply ID: `40cd3517-a599-43e6-a2e2-871583e5edd4`; staff alert ID: `f39cc993-1aa1-4480-9515-e80aa253d5ec`.
- The approved synthetic upload returned `Intake received.` and reference `CMG-2026-0003`.
- Hosted checks confirm its 68-byte `synthetic-upload.png` document exists in the private `claim-docs` bucket.
- Its upload session is completed with one file. Both intake outbox entries are sent. Maximum-size upload acceptance remains open.
- Hosted accounts include two owners and one adjuster, with one verified TOTP factor. These counts do not prove complete role acceptance.
- Local pgTAP initially failed three hard-coded claim-counter expectations after earlier local submissions advanced the counter.
- The test now checks increments from a transaction-local baseline without resetting user data. All 38 files and 1,250 assertions pass.
- TypeScript passes. The first platform integration run passed 289 tests but failed overall because one worker did not start.
- The affected signature suite passed all 11 tests on retry. The full platform integration rerun passed 33 files and 300 tests; live PandaDoc remained skipped.
- The simple-mode intake and cleanup selection passed six files and 122 tests.
- Lint passed with two existing unused-variable warnings in `src/lib/actions/intake-rollback.test.ts`.
- Dependency audit failed: two moderate, 17 high, and one critical package findings. Security patch review is open; do not report release checks as green.
- The approved platform Preview redeployment is Ready: `BUCANBQxjD2LdDTiPEjgSbAkLGXu`, source `099f351`.
- Production still redirects private routes to `/platform-disabled`; unauthenticated cron requests return 401.
- The matching saved owner password passed an authentication check. The temporary session was signed out locally. The later browser result is recorded below.
- Later owner acceptance: the user explicitly approved removal of the existing TOTP factor for their owner account. The reset succeeded; a read-only retry confirmed zero remaining factors. The user then enrolled their authenticator and reached `/admin`.
- The former `E2E_OWNER_TOTP_SECRET` is obsolete after this reset. Do not use it for later MFA tests or replace the user's new factor.
- Browser checks confirm the Owner dashboard, synthetic claim overview, document list, empty financial state, and history render. The private 68-byte document is listed and five intake audit entries appear. No claim data was changed during these checks.
- These owner views returned no client console warnings or errors in the inspected log. Other-role access, downloads, mutations, and full workflow acceptance remain open.
- At a 390px viewport, the intake confirmation remains present without measured horizontal overflow. The browser log retains message-channel errors from the earlier extension interruption; no clean-console claim is made.
- PandaDoc Dev Center displays an expired plan and requests production API configuration. No live signing test ran.
- Registry metadata confirms Next.js `16.3.5` depends on patched `sharp` `^0.35.4`. The owner later approved the local update; results follow below.

The internal browser contact attempt failed before a matching lead was stored. The regular Chrome retry succeeded.
Chrome file upload required the extension's file-URL permission. The owner enabled it and separately approved the synthetic submission after automatic review rejected it.
Synthetic records remain retained. Recovery uses a reviewed forward repair; immediate restore readiness remains unverified.
Local test and evidence changes are uncommitted. No Git push or Production deployment occurred in this acceptance update.

### Release verification continuation

GitHub read-only verification confirms PR #1 is merged, with head `099f351155d821cef7b3ac2db17a2a59137b05f8` and merge `383a99936ca7536f7e5522ea71387c2b788763df`.
Its recorded `verify`, `database`, and Vercel results are successful. These results do not cover current local edits.
The first full Node.js 22 Vitest run failed: 97 files passed, one failed, and one was skipped; 1,046 tests passed and one was skipped.
The upload suite failed its cleanup hook because the sandbox could not confirm the local Docker container. Cleanup guards remained intact.
The full rerun with local Docker access passed: 98 files and 1,046 tests; one live PandaDoc file/test was skipped.
`npm run build` passed under Node.js 22 with Next.js 16.3.0. This does not resolve the separate dependency audit failure.
Chrome contact measurements show no horizontal overflow at actual viewport widths 320, 390, and 1440 pixels.
The mobile menu opens and closes at 320 pixels. Viewport emulation was reset after testing.
Chrome records extension message-channel errors from tab attachment. Full keyboard, visual, network, and all-route acceptance remain open.
Later Chrome measurements also pass for Home, Services, Contractors, About, and claim intake at 320, 390, and 1440 pixels.
The new route-check tab returned no console warnings or errors. These are width measurements, not complete visual or keyboard acceptance.
Fresh Production GET checks confirm `/login`, `/mfa`, `/admin`, `/portal`, and `/partner` return 307 to `/platform-disabled`.
GET `/api/pandadoc/webhook` returns 405; this does not verify POST behavior.
README now follows the owner's no-backup decision. BLOCKERS separates current owner decisions from historical requests.
The PR description has a local acceptance addendum; no remote description was changed.

### Newly confirmed reference-capacity defect

PostgreSQL `lpad('10000', 4, '0')` returns `1000`. The original migration's comment claiming no truncation is incorrect.
The current generator can therefore reuse an earlier reference after 9,999 allocations. The unique constraint rejects a collision when that earlier row still exists.
New migration `20260913050000_claim_ref_capacity_guard.sql` preserves the existing four-digit format and explicitly rejects annual exhaustion with SQLSTATE 23514.
It preserves the function identity, privileges, locking, and transaction rollback behavior. No public interface or database type changes are required.
New regression `39_claim_ref_capacity.test.sql` fails two of four assertions before the fix and passes all four with the replacement function.
Both initial checks used rollback-only local transactions. The migration was then applied locally with `supabase migration up --local`; it remains unapplied remotely.
Full `npm run db:test -- --local` passes all 39 files and 1,254 assertions after the local apply.
`npm run db:types` completed against the local schema. No reset or seed was used.
Production application needs separate approval. Recovery uses a reviewed forward migration; expanding annual capacity is a separate contract change.
Fresh Production checks confirm a webhook POST returns 404 `platform_disabled`, HTTPS returns 200 with HSTS and CSP, and the app CNAME points to Vercel.
The root MX still points to Microsoft 365. No DNS change occurred.

### Production queue health — read-only check

The outbox contains 17 rows: six sent, six dead, three failed, and two pending.
Six dead public emails date from August 13. Their stored errors are domain-related; do not resend or erase them automatically.
Two failed public lead emails date from September 13 at 03:18 UTC, before the later successful acceptance sends. Their errors are also domain-related.
One failed invite and two pending claim-status messages date from August 14. Simple mode excludes these private templates from its worker.
The Storage cleanup queue contains one processed and one due pending row, with zero recorded attempts.
These counts do not prove scheduled cron execution. No queue worker was invoked, and no row was changed during this check.
Operator review must resolve old terminal messages and verify the next scheduled public retry and cleanup outcomes.

Later read-only verification on September 13 found eight sent emails, six dead emails, one failed email, and two pending emails.
The two public lead retries were sent at 14:34:39 UTC, each on attempt two.
The remaining cleanup row was processed at 14:27:38 UTC on attempt one. Both cleanup rows are now processed; none are due.
These timestamps fall within the daily cron windows. Vercel signed out before the execution logs could be checked, so scheduler attribution remains unverified.
No worker was invoked manually. Old terminal and private-template messages remain retained for owner review.

### Contact keyboard and visual acceptance

On Production, the first Tab focuses `Skip to content`; Enter moves focus to the main element.
The contact field order is Full name, Phone, Email, then What happened.
Enter on the native FAQ summary expands its answer. A subsequent DOM style check confirms visible content with nonzero height.
The full-page 320px screenshot shows the contact form, FAQ rows, and footer without overlapping text or controls.
No form was submitted. The temporary viewport was reset, and the acceptance tab was retained for continued checks.
The home page also passed a full-page visual review at 320px and a first-screen review at 390px.
The Services first screen is readable at 320px. Further full-page captures timed out; desktop screenshot acceptance is not claimed.
The viewport was reset after these attempts. The browser remains open on Services for continued acceptance.

### Approved dependency update and native browser smoke tests

The owner approved the local security patch and requested smoke tests for all features in the native browser.
Next.js and eslint-config-next are now `16.3.5`. Compatible development patches resolve Vitest to `4.1.11` and js-yaml to `4.3.2`.
The lockfile resolves sharp to `0.35.4`. Installation reports zero vulnerabilities.
TypeScript, lint, and the production build pass. Lint retains the two existing unused-variable warnings recorded above.
The first updated full test run failed overall: 97 files and 1,012 tests passed, one live test was skipped, and one worker failed to start.
The worker timeout affected `use-intake-upload.test.ts`; its focused retry passed all 34 tests.
The full rerun passed all 98 active files and 1,046 tests. One live PandaDoc file/test remained skipped.
No assertion or worker guard was weakened. A fresh `npm audit --audit-level=high` passes with zero vulnerabilities.
The installer blocked the optional unrs-resolver postinstall script. Build and lint still passed; no script permission was changed.

Native browser checks remain partial:

| Surface | Environment | Observed result |
|---|---|---|
| Questions | Hosted platform Preview, owner | Empty state renders. |
| Staff | Hosted platform Preview, owner | Accounts render; last-owner demotion and deactivation controls are disabled. No access changes made. |
| Settings | Hosted platform Preview, owner | Panels render and Recheck completes. Configuration labels do not prove live PandaDoc delivery. |
| Partners | Hosted platform Preview, owner | Empty company state renders. |
| Customer login and overview | Local platform, seeded customer | Sign-in and claim routing pass. |
| Customer question | Local platform, seeded customer | Synthetic question persists in activity; email remains queued with live sending disabled. |
| Customer documents | Local platform, seeded customer | Existing file list and upload controls render. |
| Customer upload | Local platform, seeded customer | Native chooser selected the synthetic PNG. A long tool delay preceded submission; the session had expired. UI showed connection recovery text and reload returned to login. Upload success is not claimed. |
| Partner login and list | Local platform, seeded partner | Sign-in passes. Settled amount appears only for the settled claim. |
| Partner detail, activity, profile | Local platform, seeded partner | Settled detail, shared activity, and read-only company profile render. Sign-out returns to login. |
| Partner staff-route boundary | Local platform, seeded partner | Both staff dashboard and staff claim URL redirect to the partner list without staff content. |
| Partner referral | Local platform, seeded partner | Form renders. Submission is refused by verification; success is not claimed. |
| Adjuster login | Local platform, seeded adjuster | Password sign-in reaches required MFA setup. User handoff requested; no factor changed by the agent. |
| Home and contact FAQ | Production, native browser | Home first-screen visual review passes; FAQ keyboard expansion passes without horizontal overflow at width 1069. |
| Services, Contractors, About | Production, native browser | Navigation and headings render. No horizontal overflow or completed broken images at the current desktop width. |
| Claim search and filters | Hosted platform Preview, owner | Exact synthetic reference returns one row. Settled filter returns the expected empty state. |
| Claimants | Hosted platform Preview, owner | Synthetic primary claimant and outstanding invitation state render. No invitation resent. |
| Download authorization and audit | Hosted platform Preview, owner | Download issues a five-minute attachment link; history records the action. Link clicked, but saved bytes were not independently verified. |
| Customer profile | Local platform, seeded customer | First-name update saves and updates the header. Original name restored with a second successful save. Consent details expand. No password or consent change. |
| Public intake | Production, native browser | Six sections render without overflow. Second-policyholder choice adds required signer fields; choosing No removes them. No submission made. |

The native Production tab records Turnstile error `300030`. Cloudflare documents `300*` as a generic challenge failure.
Source: https://developers.cloudflare.com/turnstile/troubleshooting/client-side-errors/error-codes/
Local configuration already contains test keys. Native referral verification did not complete; no CAPTCHA or server validation was bypassed.

The local server uses local Supabase with live Resend and PandaDoc sending disabled.
The hosted download created its expected audit entry. No hosted claim edit, DNS change, backup, commit, push, or deployment occurred in this continuation.
All-feature acceptance, live signing, maximum-size uploads, and remaining role workflows are not complete.

### Post-patch database verification

The simple-mode intake and cleanup selection passed eight files and 46 tests.
The exact CI database-backed selection passed 30 files and 205 tests in platform mode; one live PandaDoc file/test was skipped.
Both selections ran after the dependency patch, with local database access and live providers disabled.

A later shared-local pgTAP run failed six assertions: two directory MFA assumptions and four cleanup scheduler assumptions.
The seeded adjuster already had a verified factor. The directory suite now creates its own rollback-only factor-state account and preserves existing MFA.
Unrelated upload manifests became eligible after their embargo elapsed. Suite 37 explicitly requires a quiet test database and has no fixture-ID worker filter.
Its assertions and production functions remain unchanged. A separate disposable stack was created from repository migrations and synthetic seed data for clean verification.
The scratch stack is `CMGPA-release-test-20260913`, with ports 15520 through 15529. It does not replace the normal 15420 through 15429 stack.
Only this new synthetic stack is eligible for the current reset check. Existing local data and Production are not disposable and were not reset.
The isolated reset completed, and all 39 pgTAP files and 1,254 assertions passed. File hashes confirm that tested migrations and tests match the worktree.
The repaired directory suite also passed all 17 assertions against the shared local database with its existing MFA factors.
The shared database still contains aged cleanup records; a full shared-data run is not a clean test baseline. No cleanup assertion was weakened.
The disposable stack was then stopped with its exact project ID and `--no-backup`; its generated volumes were removed.
The normal local stack remains available. No Supabase backup was created.

## Earlier release record

Last reconciled: 2026-09-12.
The release target is `SITE_MODE=simple`.
The merged candidate is deployed to the Vercel Production aliases.
Release acceptance remains incomplete because owner prerequisites are unresolved.
Core local engineering validation passes for implementation `4516a82`; the current launch-record updates are local and uncommitted.
Owner decisions remain open.
The verified Preview redeployment is Ready and runs `SITE_MODE=simple`. Simple-mode Preview acceptance passed its route boundary checks.
A Ready Vercel deployment does not prove application acceptance or passing GitHub checks.

An accidental empty Preview contact submission wrote one hosted rate-limit record.
The operational incident below records its scope and follow-up.

Use [README.md](../../README.md#simple-mode-production-runbook) for the release procedure.
Use [BLOCKERS.md](BLOCKERS.md) for owner-controlled actions.
Use [PR_DESCRIPTION.md](PR_DESCRIPTION.md) for the local PR draft.
The historical appendix preserves earlier evidence without treating it as current acceptance.

## GitHub and Vercel evidence

These facts came from read-only inspection on 2026-09-07.
The release commit was created locally after review approval.
PR #1 was merged into `develop`, and Vercel deployed the merge commit to Production.
No branch-protection change or production migration occurred during this review; the later app-subdomain DNS write is recorded below.

| Item | Recorded state |
|---|---|
| Branch | `feature/claims-platform` |
| Implementation head | `4516a82` |
| Release-record state | Pushed and clean |
| Local changes | Clean |
| PR | [#1: Release CMG simple website mode](https://github.com/rspeciale0519/cmg/pull/1), targeting `develop` |
| Recorded CI run | [33784420179](https://github.com/rspeciale0519/cmg/actions/runs/33784420179); `verify` and `database` pass |
| CI review note | CodeRabbit reports pass status but skipped review because 529 files exceed its 150-file limit |
| Branch Preview | [feature-claims-platform Preview](https://cmgps-git-feature-claims-platform-robs-projects-c72886ba.vercel.app), verified simple-mode deployment [cmgps-54mruv7ei-robs-projects-c72886ba.vercel.app](https://cmgps-54mruv7ei-robs-projects-c72886ba.vercel.app), Ready |
| Current Production | `383a99936ca7536f7e5522ea71387c2b788763df`, Ready on 2026-09-07 |
| Production deployment | [383a999 Production](https://cmgps-es36guo8m-robs-projects-c72886ba.vercel.app) |
| Production alias | [cmgps.vercel.app](https://cmgps.vercel.app) |
| Custom domain routing | `app.cmgpropertysolutions.net` serves the CMG Production app; the root and `www` hostnames remain unchanged |
| Production branch | Vercel deployment metadata confirms `develop`; the current Production deployment came from the merged branch |
| Vercel plan | Hobby; confirmed in the browser |
| Branch protection | `develop` is unprotected; the protection API returned HTTP 403 |

Vercel's [fair-use rules](https://vercel.com/docs/limits/fair-use-guidelines) require Pro or Enterprise for commercial use.
CMG's public business site needs a commercial plan even in simple mode.
Vercel Pro is the recommended plan.
No purchase or plan change is approved or completed.
This blocker is separate from GitHub's private-repository protection plan.
A Vercel plan upgrade does not remove the 4.5 MB request limit.

GitHub reports that private-repository protection needs an eligible plan.
Its response names GitHub Pro or a public repository.
Keep the repository private.
An owner-approved private-repository plan is unresolved.
Manual check review does not provide branch protection.

The verified simple-mode Preview returned 200 for `/`, `/contact`, `/file-a-claim`, and `/platform-disabled`.
Its `/login`, `/mfa`, `/invite`, `/admin`, `/portal`, and `/partner` routes returned 307 to `/platform-disabled`.
Its cron routes returned 401 without a bearer token, and the PandaDoc webhook returned 405 for GET.
Its public routes passed read-only checks at 320px, 390px, and 1280px with no horizontal overflow.
Fresh Preview Tab traversal moved focus through the skip link, logo, navigation, and phone link. Menu activation and full network tracing remain unverified.
Security headers remained present: CSP, `X-Frame-Options: DENY`, `Referrer-Policy`, and HSTS.
The Preview `SITE_MODE=simple` environment write and redeployment are complete.
The Production environment now includes the approved site URL; the deployment came from the merged `develop` commit.

The current remote checks pass for the pushed head.
Do not reuse older passing totals as evidence for the changed candidate.

Fresh read-only `gh pr view` confirms PR #1 is merged into `develop`, with the implementation and documentation commits pushed.
Its current `verify`, `database`, Vercel, and Vercel Preview Comments checks pass.
CodeRabbit reports pass status but skipped review because the diff exceeds its 150-file review limit.
The PR description is published from `docs/temp/PR_DESCRIPTION.md`; PR #1 is merged and Production deployment is Ready.

Read-only host routing checks found a production cutover blocker before the subdomain setup.
The Vercel aliases `cmgps.vercel.app`, `cmgps-rspeciale0519.vercel.app`, and `cmgps-robs-projects-c72886ba.vercel.app` serve this CMG deployment.
The root domain still serves its previous site by choice.
The owner approved only the new `app` subdomain, so no root, `www`, or Microsoft 365 record was changed.

Post-merge Production read-only smoke checks passed on the Vercel aliases.
`/`, `/contact`, and `/file-a-claim` returned 200.
`/admin`, `/login`, `/mfa`, `/invite`, `/portal`, and `/partner` redirected to `/platform-disabled`.
`/api/cron/outbox` and `/api/cron/storage-cleanup` returned 401 without a bearer token.
`/api/pandadoc/webhook` returned 405 for GET.
These checks confirm route behavior for the merged deployment; live provider delivery, public form acceptance, and hosted upload acceptance remain pending.

The owner then added `app.cmgpropertysolutions.net` to the Vercel project and added one GoDaddy CNAME:
`app` → `50238cf0f774d850.vercel-dns-017.com.`
Vercel verified the subdomain configuration, and the live hostname returned 200 for public routes, 307 to `/platform-disabled` for private routes, 401 for unauthenticated cron routes, and 405 for a GET PandaDoc webhook.
The root, `www`, Microsoft 365, and other pre-existing DNS records remain unchanged.
Vercel Production now uses `NEXT_PUBLIC_SITE_URL=https://app.cmgpropertysolutions.net` and redeployment `DFeBennx8L6Dhj9M7uisVKiJKPhS` is Ready from `develop` commit `383a999`.

## Hosted database and service evidence

The inspection read counts, schema state, and configuration presence.
It did not read user identities or secret values.
No production backup, migration, seed, reset, or repair occurred.
The owner explicitly declined a hosted Supabase database backup.
Recovery and PITR readiness remain unverified, so no production migration is authorized.

| Item | Recorded state |
|---|---|
| Hosted migrations | 23 applied, through `20260815240000` |
| Public tables | 20; RLS enabled on all 20 |
| Document bucket | `claim-docs` is private; limit is 26,214,400 bytes, or 25 MiB |
| Document path preflight | `documents=0`, `noncanonical_documents=0` at the time of the read |
| Auth users / profiles | Three Auth users and three profiles; identities and role readiness were not assessed |
| Outbox | Six `dead`, one `failed`, one `pending` |
| Storage cleanup | Zero pending rows |
| Supabase dashboard | Signed out |
| Backups and PITR | Not verified; dashboard inspection could not confirm their configuration |

The path preflight is a point-in-time result.
Repeat it immediately before the approved storage-path migration.
Zero document rows do not prove that Storage contains no objects.

Existing rows are production data.
Do not treat an earlier empty-database statement as current evidence.
Do not reset, seed, delete, or replay hosted rows without separate approval.
Review failed and dead messages before an approved retry.
A lease timeout does not prove that an email provider rejected a send.

Vercel shows `SITE_MODE` for all environments and a Preview branch override.
PandaDoc and Resend settings exist for Production and Preview.
Public and secret Turnstile settings, `CRON_SECRET`, and Supabase keys are present.
Resend verified `cmgpropertysolutions.net` for sending on 2026-09-09.
Vercel now has a new sending-only `RESEND_API_KEY` for Production and Preview.
`EMAIL_FROM` is `CMG Property Solutions <claims@cmgpropertysolutions.net>`, which uses the verified root domain.
Cloudflare Turnstile now authorizes `cmgpropertysolutions.net`, covering the `app` subdomain.
A synthetic phone-only production submission returned `Request received.`
Resend accepted the staff alert with HTTP 200 and recorded it as `Delivered` to `Austin@CMGPropertySolutions.net`.
The approved `rob@miodiollc.com` auto-reply remains pending a cooldown retry because contact email rate limiting blocked the second test.
The observed Preview route behavior confirms that its deployed mode is simple.
The Preview environment change and redeployment are complete.

Fresh navigation to Preview `/contact` repeatedly produced Turnstile error `110200`.
Cloudflare defines this as “Domain not authorized” in its [error-code reference](https://developers.cloudflare.com/turnstile/troubleshooting/client-side-errors/error-codes/).
The widget needs approved hostname configuration before hosted public-form acceptance.
No CAPTCHA bypass or configuration change occurred.

| DNS item | Read-only result |
|---|---|
| `cmgpropertysolutions.net` A | `15.197.148.33`, `3.33.130.190` |
| `www.cmgpropertysolutions.net` | CNAME to the apex domain |
| `app.cmgpropertysolutions.net` | CNAME to `50238cf0f774d850.vercel-dns-017.com.`; verified by Vercel |
| Mail | Microsoft 365 MX and SPF records exist |
| `resend._domainkey.cmgpropertysolutions.net` | Resend DKIM TXT; verified by Resend |
| `send.cmgpropertysolutions.net` MX | `feedback-smtp.us-east-1.amazonses.com`, priority 10; verified by Resend |
| `send.cmgpropertysolutions.net` TXT | `v=spf1 include:amazonses.com ~all`; verified by Resend |
| `_dmarc.cmgpropertysolutions.net` | `v=DMARC1; p=none;` |

The new `app` CNAME and the four Resend sender records were added.
The root domain HTTPS endpoint still serves `/lander`, which is outside the current CMG subdomain target.
Resend domain verification and a live staff-alert delivery test are complete.
The approved auto-reply recipient still needs one cooldown-safe retry.

## Security review warning

The warning in the user's screenshot appeared during the security review.
Its exact trigger remains unknown.
Blocked runtime probes were stopped without attempts to bypass the warning.
That earlier security review performed no production writes.
The later Preview rate-limit write remains a separate incident, recorded below.

## Operational incident — hosted contact submission

During widget inspection, the review agent accidentally submitted the empty form on the deployed Preview `/contact` page.
The agent disclosed the mistake immediately and stopped hosted submissions.
Preview returned the generic human-verification failure.

A hosted read-only aggregate check after `22:55:23Z` confirmed these results:

| Record | Observed change |
|---|---|
| Leads | Zero new rows |
| Claims | Zero new rows |
| Notifications | Zero new rows |
| Contact IP rate limit | One row with count 1 |

This was a hosted database write.
Leave the rate-limit record unchanged.
No hosted settings, schema, backup, deployment, Git write, or mail action occurred.
The incident does not authorize further hosted submissions or cleanup.

Subsequent local browser form actions assert the expected local URL before they proceed.
This record documents an operational incident, not an owner-action blocker.
The Turnstile hostname issue is resolved by the existing widget update.

## Local environment

The local CMGPA Supabase stack is running again, and the database container is healthy.
A prior pgTAP run found stale local fixture state; the approved local reset removed it.
Its API uses port 15421, PostgreSQL uses 15422, Studio uses 15423, and local email uses 15424.
The reserved block is 15420 through 15429.
Use Node.js 22 and `npm ci`.

The current local platform route smoke checks used `http://localhost:3010` with `SITE_MODE=platform`.
Public routes returned HTTP 200, private routes redirected to `/login`, and protected cron routes returned HTTP 401 without a bearer token.
The server belongs to CMGPA and remains healthy.
Earlier port 3011 simple-mode and port 3014 checks remain in the historical appendix.
Email and live PandaDoc remain disabled.
An earlier simple-mode route probe returned HTTP 200 for `/`, `/about`, `/contact`, and `/file-a-claim`.
It returned HTTP 307 to `/platform-disabled` for `/admin`, `/portal`, and `/partner`.
The local REST endpoint and Studio returned HTTP 200 in the same health check.
Those health results predate the current Docker service outage.

Prior local seed data was confirmed disposable before the planned database reset.
The first reset applied 25 migrations and the seed, then exited 1 at the Storage health timeout.
No application migration error was reported.
Storage later became healthy without intervention after its `vector_store` migration completed.

Auto-review rejected an earlier reset retry because the user had not yet approved deletion of local database data.
That retry did not execute.
The original reset remains a failed historical run despite its completed migration replay and later Storage recovery.
Do not infer current MFA enrollment or test totals from the historical seed record.

The user later approved deletion and rebuilding of the LOCAL CMG database only.
Target checks confirmed the CMGPA container, loopback database port 15422, and loopback API port 15421.
The approved `npm run db:reset -- --local` exited 0 and reported a local target.
It recreated the local database and applied all 29 migrations through `20260830124100`.
It ran `supabase/seed.sql` and restarted the containers.
This run had no health timeout, so the current reset gate passed.

Post-reset `npm run db:test -- --local` passed 38 files and 1,250 assertions, with exit 0.
Database, Storage, Auth, Realtime, Kong, Studio, and `pg_meta` health checks passed; the REST container is running.
No function or migration failed during the rebuilt database checks.
No hosted reset, seed, migration, or Git action occurred.

Post-reset simple-mode CI passed 30 files and 205 tests, with one live file and test skipped.
It exited 0 in 128.20 seconds.
It used the recorded CI file selection with `SITE_MODE=simple` and live provider actions disabled.

Post-reset platform CI passed 30 files and 205 tests, with one live file and test skipped.
It exited 0 in 73.75 seconds.
Post-reset `npm run db:types` exited 0 with the identical SHA256 recorded below.
The post-reset `npm run type-check` exited 0.
All post-reset checks passed.

Local read-only verification matched all 29 migration versions exactly to repository files, through `20260830124100`.
All 20 local public tables have RLS active.
The local `claim-docs` bucket remains private with a 26,214,400-byte, or 25 MiB, limit.
These checks did not recheck or change hosted state.

The third migration applied with `supabase migration up --local`, which exited 0.
This command did not reset the database.
The local cleanup removed only the verified synthetic fixture.
The checks matched its ID, reference, description, timestamp, and document metadata before removal.
That local fixture cleanup changed no hosted rows.

The fourth migration also applied locally with `supabase migration up --local`, exit 0.
That checkpoint contained 27 local migration entries and 23 recorded hosted entries.
The later direct-upload change adds two migrations, listed below.
This apply did not reset local data or change the hosted database.

Local email and PandaDoc keys are empty.
Local Turnstile uses test keys.
No live PandaDoc or email test ran during this review.

Later local UI checks submitted synthetic contact and intake data with Resend disabled and official Turnstile test keys.
No attachments were uploaded.
Exact identity guards limited teardown to those local UI fixtures.
Teardown removed three pending local notifications without delivering them.
It restored the seed claim count to two.
It restored only the test's claim-counter change: `2 → 3 → 2`.

Fixture teardown did not satisfy the required database reset.
The later approved local reset passed, as recorded above.

### Local test audit cleanup risk and correction

A separate static review found an existing test helper that broadly deleted `pandadoc_webhook` audit records.
Earlier local test runs used that helper.
Removal of unrelated local audit records cannot be excluded.
One exact CI rerun was stopped before results while this defect was investigated.

The completed correction changes four test files only.
Unique synthetic IPv6 inputs capture exact fixture audit IDs.
Cleanup leaves rows outside those captured IDs unchanged.
Nine ownership and error cases were added.
All original assertions remain.

Focused platform helper tests passed two files and 29 tests.
The subsequent platform CI selection passed, as recorded below.
The subsequent full simple-mode run passed 89 files and 884 tests, with one live file and test skipped.
These checks made no live provider calls or new hosted writes.

## Release fixes and pending migrations

The local candidate addresses these confirmed defects:

- Gate live PandaDoc test discovery before reading optional `.env.local`.
- Reject hosted database URLs in database-writing test helpers.
- Enforce simple mode inside private session reads, actions, and login/invite pages.
- Require exactly 36 characters for webhook UUID metadata before event processing.
- Queue uncertain upload cleanup instead of deleting bytes before checking committed document records.
- Reuse pending cleanup work during document deletion without changing existing worker state.
- Fail database test teardown on cleanup errors across eight callers.
- Limit webhook audit cleanup to exact fixture IDs captured through unique synthetic IPv6 inputs.
- Keep provider error text out of user responses, logs, audit metadata, and stored failure results.
- Bound outbox retries when a worker repeatedly loses its lease.
- Materialize outbox candidate sets before locking updates to preserve the batch limit.
- Reject noncanonical document paths before signing and at the database boundary.
- Prevent authenticated callers from attaching arbitrary `intake/` paths to claims.
- Correct narrow public grids that overflowed the measured mobile viewport.
- Preserve raw generated database types and place SQL nullability overrides in the application type module.
- Use one Vitest worker on Windows and four elsewhere, with isolation, tests, and timeouts unchanged.
- Send public intake file bytes directly to private Storage through approved signed upload paths.
- Preserve the upload session during confirmation retries and verify files before atomic intake creation.
- Protect issued upload capabilities during cleanup and recheck retained paths for late objects.

Static production-code review is complete within the scope below.
The test cleanup ownership correction is complete and passed platform validation.
Full simple-mode tests, final type-check, and final lint passed before the fourth migration.
Full pgTAP and the platform CI selection passed after the fourth migration.
The earlier four migrations were applied locally.
The direct-upload change adds two migrations, bringing the repository total to 29.
Six migrations follow the last recorded hosted migration.
No hosted application of these migrations is recorded.

| Pending migration | Purpose | Main risk and recovery |
|---|---|---|
| `20260830120000_outbox_attempt_limit.sql` | Stop claims after five attempts, including expired worker leases | Exhausted rows become dead when processed; preserve payloads and reconcile provider outcomes before retry |
| `20260830121000_document_storage_paths.sql` | Enforce canonical paths and claim-owned authenticated inserts | Existing invalid paths stop migration validation; review affected metadata and Storage bytes before any approved repair |
| `20260830122000_storage_cleanup_enqueue_idempotent.sql` | Prevent duplicate pending cleanup intents from rejecting document deletion | Reviewed and applied locally; existing worker state and terminal history remain unchanged; hosted application awaits approval |
| `20260830123000_outbox_batch_materialized.sql` | Materialize expired and due candidate sets before outbox updates | Function-only replacement preserves owner, grants, and queue data; full pgTAP and platform CI passed; use an approved forward correction if needed |
| `20260830124000_intake_upload_sessions.sql` | Reserve immutable upload sessions and manifests; verify object versions before atomic intake creation | Apply before the new application. Retain session records, completed references, and reserved paths during recovery. |
| `20260830124100_intake_upload_cleanup.sql` | Protect issued capabilities and requeue late, unreferenced objects | Keep cleanup reconciliation active during recovery. Review blocked cleanup work without removing committed documents. |

The deletion defect is fixed in the local candidate.
The previous trigger inserted a cleanup intent even when that exact path already had a pending intent.
The partial unique index rejected the duplicate and prevented deletion.
The reviewed migration now reuses pending work without changing its lease, attempts, timestamps, errors, or metadata.
It preserves terminal queue history and uses no data reset.

Rollback-only suite 34 stopped after three of 26 planned assertions against the old trigger because of the duplicate queue key.
All 26 assertions passed after the fix.
Strict fixture teardown now reports failed cleanup instead of leaving an unnoticed fixture.
The local uncertain-write integration test passed against real Storage with strict teardown after migration.

The fourth migration addresses the later outbox batch-limit failure recorded below.
It materializes both candidate sets in `claim_outbox_batch`.
Only the function definition changes; queue rows remain intact.
Full pgTAP and the platform CI selection passed after that local apply.

Back up the database and Storage objects before approved forward migrations.
Confirm that those backups can restore the same recovery point.
Never rename, quarantine, delete, or rewrite hosted document rows automatically.
Keep the signing guard during recovery.
Use a reviewed forward repair if existing paths need correction.
Never weaken the path boundary to make a migration pass.

## Database type generation

The generated types below include the two direct-upload migrations and their RPC contracts.
The upload candidate passed fresh type, unit, integration, database, and build checks.

Raw `npm run db:types` output is reproducible.
Generation after the upload migrations exited 0.
The current `database.ts` SHA256 is `0C04FD50FC14872FA0C555C367B47AE6759283E6E2A1A12BAAC3BF724411EA3F`.
Final type-check, lint, and both builds used the generated TypeScript files.

[database.ts](../../src/types/database.ts) remains the unedited Supabase generator output.
[database-app.ts](../../src/types/database-app.ts) contains five narrow SQL nullability overrides.
The application routes 35 `Database` imports through that module.
The overrides preserve unrelated generated fields and optional arguments.

Final `npm run type-check` and full `npm run lint` both exited 0.
No raw generated type was hand-edited, and no dependency was added.
Remaining verification appears in the ledger below.
See [README.md](../../README.md#database-types) for maintenance rules.

## Current validation ledger

Direct-upload client tests passed in both site modes: three files and 50 tests per run.
The simple run exited 0 in 42.50 seconds; the platform run exited 0 in 23.38 seconds.
The current pure authorization and mode-boundary selection passed seven files and 45 tests in each site mode.
The direct-upload Storage integration suite passed five tests against the local stack.
The last approved clean local reset applied all 29 repository migrations, and pgTAP passed 38 files and 1,250 assertions.
The full simple and platform Vitest runs each passed 98 files and 1,046 tests, with one opt-in live test skipped, after the final mobile widget adjustment.
The affected form and Turnstile selection passed four files and 51 tests in each site mode after that adjustment.
The layout warning fix and its regression test passed in both builds.
The mobile Turnstile widget now uses the compact size at 420px and below; its regression test passed.
Simple and platform production builds passed after the upload and layout changes.
Full type-check, lint, audit, and diff checks passed after the upload changes.
See [the upload section](#approved-public-upload-transport) for scope and recovery limits.

### Earlier validation checkpoint

The table below records the completed checkpoint before direct-upload implementation.
Its results do not validate the later upload code or its two migrations.
Some local gates have passed; the remaining checks stay open below.
The full simple-mode run and platform CI selection passed after the audit cleanup correction.
The next full pgTAP run failed one batch-limit assertion.
The fourth migration is applied locally; full pgTAP and the platform CI selection passed afterward.
Run new candidate checks after further code or schema changes.
Historical results do not complete these checks.

| Check | Current result |
|---|---|
| Affected unit regressions | Affected platform selection passed seven files and 110 tests; corrected helper tests passed two files and 29 tests; full simple run passed |
| `npm run type-check` | Post-reset run passed after type regeneration; exit 0 |
| `npm run lint` | Final full run passed; exit 0 |
| `npm test` | Current simple and platform runs each passed 98 files and 1,046 tests, one live file/test skipped |
| Fresh platform full-suite rerun | 98 files passed and 1,046 tests passed, one live file/test skipped |
| `npm run build` | Simple and platform builds passed after the upload and layout changes; both exited 0 |
| `npm run db:reset` | Latest approved local run passed and applied all 29 repository migrations, seed, and container restart |
| `npm run db:test` | Current clean run passed 38 files and 1,250 assertions; exit 0 |
| Fresh pgTAP rerun | 38 files and 1,250 tests passed after the approved local reset; exit 0 |
| `npm run db:types` | Regeneration passed after the upload migrations; current SHA256 is `0C04FD50FC14872FA0C555C367B47AE6759283E6E2A1A12BAAC3BF724411EA3F` |
| CI database-backed Vitest selection | Post-reset simple and platform each passed 30 files and 205 tests, one live file/test skipped; both exited 0 |
| Outbox batch suites 32 and 35 | Passed 84 assertions after the fourth migration; old-function control also passed 84 and did not reproduce the failure |
| Additional affected platform selection | Passed: seven files and 110 tests |
| `npm audit --audit-level=high` | Fresh run passed; exit 0 and zero vulnerabilities |
| Adversarial review of changed behavior | Final static review includes the fourth migration and suite 35; no further confirmed defect; planner-test limits remain recorded below |
| Final diff, source-size, and client-secret checks | Final aggregate: 103 changed or untracked files, zero deleted files, no dependency/workflow changes, and no credential-pattern matches |
| Current desktop, 390px, and 320px public browser acceptance | Fresh local simple-mode checks at 320px, 390px, and 1280px found no horizontal overflow and no fresh console errors after the compact Turnstile fix; menu click and Escape passed; empty intake returned the generic Turnstile failure; native Tab traversal, upload interaction, and full network tracing remain unverified |
| Current Preview acceptance after an approved push | Public routes passed; private routes redirect to `/platform-disabled` in simple mode |
| Current-head GitHub `verify` and `database` checks | Passed; Vercel and Preview Comments also passed |
| Current-head Vercel build and acceptance | Branch Preview Ready; simple-mode environment update and redeployment passed |
| Live PandaDoc draft test | Not run; requires separate approval and shell opt-in |

The following focused results were verified during this review:

| Group | Passed tests | Mode coverage |
|---|---:|---|
| Upload cleanup | 29 per mode | Separate simple and platform runs |
| Provider privacy | 53 per mode | Separate simple and platform runs |
| Storage paths and downloads | 31 per mode | Separate simple and platform runs |
| Database target helper | 13 | Loopback configuration and safety cases; previous simple-mode run |
| New mode guards | 48 total | Enabled and disabled modes covered inside the group |
| Strict fixture cleanup | 7 | Previous simple-mode run |
| Latest pure selection | 31 | Cleanup, target helper, and payload files with one worker |
| Storage uncertain-write integration | 1 | Real local Storage and strict teardown after the third migration |
| Server-only test helpers | 29 | Two platform files passed after the audit cleanup ownership correction |
| Additional affected platform selection | 110 | Seven platform files passed |

These groups overlap and must not be added together as a full-suite total.
The separate CI selection result appears below.
These focused groups did not complete the reset gate; the later approved local reset passed separately.

The failed full Vitest attempt passed 69 files and 628 tests, with one live test skipped.
It also had 19 worker startup handshake timeouts, so the command failed.
Four-worker attempts also failed during startup under normal process permissions.
`vitest.config.ts` now selects one worker on Windows and four on other hosts.
Isolation, assertions, test inclusion, and timeouts remain unchanged.
The full simple-mode rerun then passed with the Windows one-worker default.

The passing run completed in 573.03 seconds.
It passed 89 files and skipped one live file.
It passed 875 tests and skipped one live test, for 876 tests total.
It reported zero unhandled errors.

The later exact platform CI selection passed 178 tests and skipped one live test.
It failed after one worker startup timeout in `test-support.test.ts`.
That server-only helper test now declares `// @vitest-environment node`.
The focused platform helper selection then passed two files and 20 tests in 1.91 seconds.
The additional affected platform selection passed seven files and 110 tests.

The next exact CI rerun was stopped before results after the broad audit cleanup was found.
The completed correction then passed two platform helper files and 29 tests.
Nine new ownership and error cases preserve all original assertions.

Before the fourth migration, the latest platform CI selection passed 29 files and 200 tests.
One live PandaDoc file and test were skipped.
The command exited 0 in 173.89 seconds.
The subsequent full simple-mode run also covered those database files.
No live provider calls or new hosted writes occurred during these checks.

That full simple-mode run passed 89 files and 884 tests.
One live file and test were skipped.
It exited 0 in 398.37 seconds.
Final type-check and full lint each exited 0.

An earlier pgTAP run failed suite 30's owner-count assertion after an ignored deletion error left a synthetic fixture.
That exact verified fixture was removed after the metadata checks recorded above.
The original suite 33 collation assertion was fixed.
The third migration and cleanup-error reporting are complete.
The separate test audit ownership correction is also complete.

The earlier full pgTAP rerun passed all 35 files and 1,015 assertions.
The next full run failed suite 32 assertion 20: three rows became terminal, but the assertion expected two.
All other 1,014 assertions passed.
This failure remains part of the verification history.

Static evidence strongly supports repeated execution of a limited locking `UPDATE ... FROM` subquery as the cause.
The adverse execution plan was not captured.
Focused suites 32 and 35 passed 84 assertions against the old function.
That negative control did not reproduce the failure.

Migration `20260830123000_outbox_batch_materialized.sql` then applied locally with `supabase migration up --local`, exit 0.
Suites 32 and 35 passed all 84 assertions afterward.
New suite 35 contains 60 assertions across normal, custom, and generic planner settings.
Those settings do not guarantee a particular adverse join order.

The subsequent full `npm run db:test -- --local` passed 36 files and 1,075 assertions, with exit 0.
The platform CI rerun after this migration passed 29 files and 200 tests, with one live file and test skipped.
It exited 0 in 90.58 seconds.
This is the final platform CI evidence; it supersedes the earlier 173.89-second run.
These results do not change the original failed reset or earlier denied retry.
The later explicitly approved local reset passed separately.

The 884-test simple run, final type-check, final lint, and both builds preceded the fourth SQL-only migration.
Type regeneration afterward produced the identical SHA256.
The full pgTAP and final platform CI results above followed the migration.

The verified platform command uses the same Vitest file selection as CI:

```powershell
$env:SITE_MODE = "platform"
$env:RESEND_API_KEY = ""
$env:PANDADOC_LIVE_DRAFT_TEST = "0"
npm test -- src/lib/esign src/app/api/pandadoc src/lib/storage-cleanup
```

Use only the disposable local database for these tests.
The live draft test creates a real PandaDoc draft.
It requires shell-only `PANDADOC_LIVE_DRAFT_TEST=1`, an API key, and a test email.
See [PANDADOC_SETUP.md](PANDADOC_SETUP.md) before any approved live test.

### Static review scope

Before the batch-limit failure, the static diff review found no further production-code issue in the local fixes.
No source files were deleted in those changes.
No dependency or workflow files changed.
No credential-pattern matches appeared in the changed files.
No secret environment names appeared in built client assets.

Final static inspection recorded 103 changed or untracked files and zero deleted files.
No dependency or workflow files changed, and no credential-pattern matches were found.
The credential-pattern scan covered all 103 files, including both new SQL files.
The only oversized source file is [lor-dispatch.ts](../../src/lib/esign/lor-dispatch.ts), at 462 lines, with only a type import change.
Generated database types are exempt from the source-file size limit.

The later test cleanup correction changes four test files only and passed platform validation.
The fourth migration and new SQL suite passed full pgTAP and the platform CI selection.
That completed source and test work preceded the approved direct-upload addition.

Final static review also covered the fourth migration and suite 35.
It checked candidate uniqueness, shared limits, leases, attempt filters, NULL/empty/zero inputs, owner and grant preservation, scoped fixtures, and rollback.
No further confirmed defect was found.

<a id="known-public-upload-limitation"></a>

## Approved public upload transport

The user approved direct browser uploads to private Supabase Storage.
The local candidate implements that design.
The application advertises ten files of 25 MiB each.
The private bucket also permits 25 MiB objects.
The allowance has not changed.

The former transport sent file bytes through a Server Action.
[Vercel limits function request payloads to 4.5 MB](https://vercel.com/docs/functions/limitations).
The new Server Actions receive only text, file metadata, and session credentials.
The installed Supabase browser SDK sends file bytes directly to the private bucket.
The pushed Preview contains the reviewed implementation; Production remains on the older deployment.
Maximum-size hosted acceptance remains open until an approved deployment and approved hosted tests.

The implementation uses these controls:

1. Preparation applies rate limits, Turnstile, input validation, and file metadata validation before reservation.
2. Reservation stores an immutable manifest and exact cleanup paths before the server issues upload authority.
3. Signed upload tokens permit writes to staging paths with overwrite disabled.
4. The server copies each file to a separate destination after one database-authorized copy attempt.
5. Upload tokens do not authorize writes to those document destinations.
6. Confirmation checks size, MIME type, file signatures, object identity, and version before final submission.
7. One atomic transaction creates the intake records and stores the completed session result.
8. Repeated confirmation returns the original claim reference instead of creating another claim.

The session tables have RLS enabled and deny direct access to anonymous and authenticated browser roles.
Each confirmation request verifies at most one previously unchecked file and stores its proof.
The client follows decreasing pending-file counts for at most ten confirmation calls.
Malformed progress, stalled progress, and uncertain responses preserve the session for retry.
Only confirmed server cancellation permits a new session.

The form preserves text and selected files while it disables editing during an active session.
Progress uses the existing accessible status region.
Standard uploads retry whole files; confirmed uploads do not repeat during confirmation retries.
Client recovery requires the same open tab because session credentials and file references remain in memory.
The form warns before leaving and does not instruct the user to reload after an uncertain result.

Supabase [signed upload URLs](https://supabase.com/docs/reference/javascript/file-buckets-createsigneduploadurl) remain valid for two hours.
Sessions expire after two hours, and signing is limited to their first five minutes.
Cleanup cannot claim reserved paths until two hours and 15 minutes after reservation.
The server rejects signed tokens whose expiry exceeds that cleanup boundary.
Retained path records allow later cleanup runs to requeue objects that arrive after an earlier successful sweep.
The worker excludes committed document paths and reports blocked cleanup work.
The old 15-minute intent is not the protection used for these sessions.

Retain session records, file manifests, and cleanup reconciliation during application rollback.
A Storage write and a database commit remain separate operations.
Do not delete reserved paths or issue a new session solely because a response was lost.

The final client selection passed three files and 50 tests in each mode.
It covers file limits, metadata-only actions, progress, duplicate submission, uncertain writes, retries, and confirmed restart.
The first simple run passed 46 tests but failed when the form-test worker did not start.
That run exited 1 after 100.70 seconds; the unchanged retry passed all 50 tests.
No test, worker setting, assertion, or timeout was removed to obtain that pass.

## Public acceptance and operation

The release includes marketing, contact, intake, public email, and storage cleanup.
Expected private-route behavior remains closed in `SITE_MODE=simple`.

Normal page GET checks produced these results:

| Environment | Observed result | Acceptance limit |
|---|---|---|
| Local simple mode | Six private entry-route GETs redirected to `/platform-disabled` | Private entry closure passed for those requests |
| Production | Public routes returned 200; private routes redirected to `/platform-disabled` | Merged commit `383a999`; forms, providers, DNS, and full operational acceptance remain pending |
| Verified Preview | Public routes returned 200; all platform entry routes redirected to `/platform-disabled` | Simple-mode closure passed |

Local `/`, `/services`, `/contractors`, `/about`, `/contact`, and `/file-a-claim` passed layout checks at 320px, 390px, and 1440px.
Actual viewport measurements confirmed those widths after the narrow grid CSS fix.
All 18 final local layout checks passed without horizontal overflow or missing images.
Selected loading and error states also passed at 390px, as recorded below.
Local success checks also passed within the scope recorded below.
Fresh Preview Tab traversal moved focus through the skip link, logo, navigation, and phone link. Menu activation and full network tracing remain unverified.

The earlier Preview layout capture passed 15 of 18 public layout checks.
At 320px, `/`, `/about`, and `/contact` each had 15px horizontal overflow.
Their document client width was 305px, and their scroll width was 320px.
Every Preview layout at 390px and 1440px passed.
The earlier Preview layout capture found no missing images.
That earlier Preview failed private-route closure; the current redeployment passes that boundary. Its complete network trace remains pending.

| Local check at 390px | Observed result |
|---|---|
| Empty contact form | Disabled “Sending your request…” button, then two field errors and focus on `name` |
| Empty intake form | Disabled “Submitting intake…” button, then 20 field errors and focus on `firstName` |
| Error layouts | No horizontal overflow |
| Second policyholder set to Yes | Four conditional fields became visible |
| Second policyholder set to No | All four second-policyholder inputs were removed without overflow |
| Prior claim set to Yes | `priorOutcome` became visible without overflow |
| Mobile menu click | Menu opened and focused Home |
| Mobile focus containment | Focus remained within the open menu |
| Escape from the menu | Menu closed, toggle focus returned, and the closed menu became inert |

| Local success check | Observed result |
|---|---|
| Contact, desktop | Success panel received focus; no horizontal overflow |
| Intake, 320px / 390px / 1440px | Success panel received focus; no horizontal overflow at each width |
| Attachments | No uploads tested |

The local widget uses official Turnstile test keys.
Empty submissions did not persist claims or leads.
They do not establish valid hosted submission or production Turnstile acceptance.

Browser logs retain older Preview errors, including the Turnstile failure.
A local-route evaluation can include those earlier entries.
Do not describe the entire browser console as clean.
Filter future console and network evidence by a fresh navigation timestamp.

Fresh local navigation after `2026-08-30T23:18:43.607Z` checked all six public routes.
No new warning or error logs appeared within that timestamp scope.
All checked images loaded.
The local contact GET returned HTTP 200.
Older Preview Turnstile errors remained in the browser logs and were excluded by timestamp.
Full network tracing and native keyboard activation remain unverified; fresh Preview Tab traversal passed.

Phone input worked visually in the browser.
DOM snapshots redact telephone values, so those snapshots do not show an input defect.

Browser Enter and Space attempts did not activate the native menu button.
The cause remains unresolved: tool behavior or an application issue.
Do not mark menu activation complete until a fresh interaction test passes.

The acceptance tab became a data-URL `ERR_CONNECTION_REFUSED` page while the local server was stopped.
After restart, Browser Use URL policy blocked access to that old error page.
That attempt ended without further keyboard interaction.
The blocked error tabs remain untouched.

A fresh tab later opened `http://127.0.0.1:3014/contact` at 390px.
The local server returned HTTP 200 before navigation.
Document client width and scroll width both measured 375px; all images loaded.
No warnings or errors appeared after `2026-08-31T00:26:25.850Z` in that tab's console logs.

Enter did not activate the menu through either locator input or native browser input.
Showing the browser did not change that result.
Click opened the menu and focused Home; Escape closed it and restored toggle focus.
Native keyboard activation and full network tracing remain unverified.
The viewport override reset successfully, and all tabs remain open.

Earlier layout, success, and scoped console checks retain their recorded results and limits.
The server restore and fresh-tab checks made no new hosted writes.

1. Check public pages, navigation, focus, validation errors, and responsive layouts.
2. Check loading, empty, error, and approved success states without exposing personal data.
3. Check console output, network failures, security headers, and CSP.
4. Check `/login`, `/mfa`, `/invite`, `/admin`, `/portal`, and `/partner` closure.
5. Check the disabled PandaDoc webhook response without creating a provider event.
6. Use approved test data for hosted forms only after production-write approval.
7. Verify confirmation emails and staff alerts through the approved live provider.
8. Record upload boundary results without claiming unsupported maximum-size success.

`vercel.json` schedules the outbox daily at 14:00 UTC.
It schedules storage cleanup daily at 14:17 UTC.
Hobby scheduling does not guarantee the exact minute.
Minimum retry delays do not create extra cron runs.
A retry or cleanup backlog can take several days.
Simple mode processes only the four public-form email templates.

## Approval and recovery sequence

Complete engineering checks in this record before release approval.
Resolve owner decisions in BLOCKERS before merging or deploying.
Keep commit, push, PR update, branch protection, merge, deployment, and domain approval separate.
A merge to `develop` can trigger Production automatically.

Follow the README backup and forward-migration procedure before approved database writes.
Record the actual release commit, deployment, backup identifiers, and compatible rollback target before release.
The current Production deployment is recorded above; its rollback compatibility is not yet verified.

During an approved recovery, stop affected writes before restoring data.
Restore a compatible application while retaining forward migrations where possible.
Restore the database and Storage together only when required by the approved recovery plan.
Check environment values, cron schedules, and cron authorization before reopening jobs.

Vercel Instant Rollback does not update active cron schedules.
Reconcile uncertain sends before retries.
No production rollback or restore has been performed.

## Later platform activation

Private workflows remain deferred for a separate activation decision.
Required checks include owner identity, MFA, AAL2, role isolation, invitations, private documents, PandaDoc, and webhook recovery.
PandaDoc uses the bundled single-owner and dual-owner PDFs with `H1` and `H2` roles.
Template UUIDs are not required by the current flow.

Retention automation, export, erasure, and legal holds require separate implementation and approval.
Public legal copy, privacy terms, consent wording, and business claims still need approval before simple-mode launch.
See [RETENTION.md](../RETENTION.md) and [PANDADOC_SETUP.md](PANDADOC_SETUP.md).

## Historical record — 2026-08-13

The following record is retained as historical evidence.
Its completion claims, checks, URLs, migration counts, account state, and next actions are superseded by the current sections above.
It does not authorize commands or production actions.

### CMG launch and browser-test handoff

Last reconciled: 2026-08-13 on `feature/claims-platform` after the new Vercel
project and hosted form checks.

The application is feature-complete for the agreed functional scope and is
ready for owner acceptance testing. The first release can use `SITE_MODE=simple`
to expose only the marketing site and public forms while keeping required email
and file-cleanup operations active. Architecture, authorization, per-role craft,
all-surface cohesion, enforcing CSP, and comparable mobile Lighthouse gates have
converged locally. Hosted owner steps remain. The feature branch is pushed and
PR #1 is open. The new Vercel Preview works in simple mode. Its hosted Supabase
database accepted one labeled contact test and one labeled intake test. The
authoritative production setup sequence is in the root
[`README.md`](../../README.md#production-launch-runbook).

#### Verified local state

- Clean local database reset applied all 21 migrations through
  `20260815220000_accept_intake_owner_guard.sql`.
- Vitest: 78 files, 731 tests passed locally; GitHub verify passed.
- pgTAP: 31 files, 915 assertions passed.
- TypeScript, ESLint, production build, source-size audit, and
  `git diff --check` passed.
- `npm audit --audit-level=high`: zero vulnerabilities.
- Built client assets contain none of the server-only credential names.
- Simple-mode HTTP smoke: `/`, `/contact`, and `/file-a-claim` return 200;
  `/admin`, `/portal`, and `/partner` redirect to `/platform-disabled`.
  The PandaDoc webhook returns 404 with `platform_disabled` in simple mode.
- CSP is enforcing, nonce-based, and covers every rendered script. Localhost
  omits only `upgrade-insecure-requests`; hosted requests retain it.
- Mobile Lighthouse comparable runs scored 93/100 and 90/100; the lower
  performance/accessibility scores are 90/100, above the 85/95 floors.
- Chrome testing passed at exact desktop and 390px widths for marketing,
  customer, partner, and staff surfaces. The production server remains at
  `http://localhost:3011`; the final reset requires local staff MFA re-enrollment.
- Vercel Preview `cmgps-5o8gs4nr1-robs-projects-c72886ba.vercel.app` is Ready.
  The hosted home, contact, and intake pages work. Simple mode blocks `/admin`.
- Hosted contact and full intake submissions passed. The intake reference is
  `CMG-2026-0001` and uses clear release-test data.

#### Safe local test accounts

The local database contains demo data only. All seeded accounts use
`CmgDev!2026`.

| Role | Email | Expected entry |
|---|---|---|
| Customer | `customer@cmg.test` | `/portal` |
| Partner rep | `partner@cmg.test` | `/partner` |
| Owner | `owner@cmg.test` | `/admin`, then TOTP setup |
| Adjuster | `adjuster@cmg.test` | `/admin`, then TOTP setup |
| Assistant | `assistant@cmg.test` | `/admin`, then TOTP setup |

Do not reuse these credentials in production. A clean `supabase db reset`
recreates the demo state and invalidates locally enrolled MFA factors.

#### Practical browser acceptance checklist

1. Marketing at desktop and 390px: open `/`, use the mobile menu, visit
   Services, Contractors, About, Contact, and File a claim; confirm no horizontal
   overflow or console errors.
2. Public forms: submit a test contact and intake. The local Cloudflare widget
   must say it is for testing; production must use real keys before launch.
3. Customer: sign in, review claim progress, activity, documents, and profile;
   post a harmless question and confirm it appears without exposing staff-only
   data.
4. Partner: sign in, open both referred claims, verify an offered claim hides
   the amount while the settled claim shows it, review partner/shared activity,
   company profile, and referral form.
5. Staff: sign in as owner, enroll TOTP, then inspect Dashboard, Intake, Leads,
   Questions, Claims, Partners, Staff, Audit, and Settings.
6. Claim operations: open `CMG-2026-0001`, inspect every tab, update only
   disposable demo data, and confirm the LOR panel shows the represented legacy
   claim as complete rather than offering a false retry.
7. E-sign recovery: create or use an `under_review` demo claim. With PandaDoc
   absent, confirm electronic sending is explicitly unavailable and manual
   signing remains available. Real PandaDoc end-to-end testing is an owner step.
8. Role boundaries: while signed in as customer or partner, paste an admin URL;
   while signed in as one customer/company, paste another fixture ID. Access
   must be refused or indistinguishably not found.
9. Operational routes: after setting a local `CRON_SECRET`, invoke the outbox
   and storage-cleanup routes with missing, wrong, and correct Bearer tokens.
10. Before production acceptance, repeat the public-form, invitation, email,
    PandaDoc/manual-LOR, document download, and cron checks against hosted
    services.

#### Owner-independent work at handoff

- Complete. Stage 3 is checkpointed at `bb958a0`; this reconciled handoff is
  included in the final Stage 4 documentation checkpoint.

Only replacing the two deliberate photo placeholders is owner-blocked; it needs
authentic CMG assets rather than generated or misleading stock photography.

#### Material limitations visible in the local MVP

- Public forms use Cloudflare's test keys and have no real bot
  protection until production Turnstile credentials are installed. This is a
  launch blocker, not deferred engineering work.
- Email remains queued/manual-link capable without Resend credentials.
- Electronic LOR sending remains unavailable without a real PandaDoc account,
  templates, key, and webhook; the secured manual-signing/upload workflow works.
- Local demo data is not production data, hosted backups are not configured,
  and owner staff must enroll TOTP on the hosted project.
- Home and About show labeled photo placeholders until genuine CMG images are
  supplied.
- Marketing statistics, testimonial attribution, legal wording, final LOR
  content, and the live domain remain owner assertions that must be approved.

#### Owner-only launch steps

Follow the dependency-ordered runbook in the README. In short:

1. Review PR #1 and merge the feature branch into `develop` when the final
   production release is approved. Confirm that the Git push starts Vercel.
2. The hosted database is current through migration `20260815220000`. Create
   the first owner Auth user and profile, enroll TOTP, enable leaked-password
   protection, and choose backups/PITR for claim records.
3. Keep Vercel project `cmgps` connected to `rspeciale0519/cmg`. Keep
   `SITE_MODE=simple` for the first release. The Next.js preset and base
   environment values are already set. Confirm both cron schedules from
   `vercel.json` after the production deployment.
4. Verify the Resend domain/DNS and sender/inbox addresses.
5. Create real production Turnstile keys for the deployed hostnames.
6. Configure PandaDoc with [`PANDADOC_SETUP.md`](PANDADOC_SETUP.md).
7. Point the final domain/DNS and validate TLS.
8. Supply authentic photos and approve statistics, testimonial, legal copy,
   license display, retention position, and LOR wording.
9. Run the hosted smoke checklist, record the deployment and rollback target,
   and monitor dead webhook, outbox, storage-cleanup, and e-sign dispatch rows.

#### Exact Git and hosted state at handoff

- Branch: `feature/claims-platform`.
- The branch is pushed through commit `b5550b4`. PR #1 is open into `develop`.
- Local verification passes: type-check, lint, 731 Vitest tests, 915 pgTAP
  assertions, and production build.
- Vercel project `cmgps` is connected to `rspeciale0519/cmg`. Its framework is
  Next.js. The current Preview is Ready and its simple-mode forms work.
- Stage checkpoints: `7a21209` (Stage 1), `9419994` (Stage 2), `bb958a0`
  (Stage 3), and `2be7e6e` (Stage 4). Documentation handoffs are separate local commits.
- Vercel has the base simple-mode values. It does not have Resend, PandaDoc API
  and template values, or real Turnstile keys.
- `.env.local` keeps local application values under the standard Supabase names
  and production values under `PROD_SUPABASE_*`. The production direct database
  connection works. All 21 migrations match through `20260815220000`.
  `claim-docs` is private, every public table has RLS enabled, and production has
  no Auth users or owner profiles yet.

### PR #2 and patched Preview verification — 2026-09-14

Commit `8be147c2ec5e320f055c50d7411cbe7a0a905bf2` is pushed to `docs/record-production-launch-current` with owner approval.
The worktree was clean after the push. Earlier statements that these changes remain uncommitted are historical.
GitHub run `34791901556` passes both `verify` and `database`. CodeRabbit and Vercel checks also pass.
The owner approved updating PR #2. Its title and description now cover the dependency fixes, capacity migration, and validation limits.
No merge, Production deployment, or hosted capacity migration occurred.

Patched Preview: https://cmgps-git-docs-record-production-c2abd6-robs-projects-c72886ba.vercel.app
Vercel deployment: `6S7ES3pWhEXUXKnZsvzFp8KqZZ1M`.
Native browser checks confirm Home and Contact render at an actual width of 1280 pixels without horizontal overflow.
Home has no completed broken images. Contact navigation and FAQ keyboard expansion pass.
The empty required name and phone inputs report invalid validity states. No contact submission occurred.
The `/admin` route displays the platform-disabled page.
Contact console reports Turnstile error `110200`. Cloudflare documents this as an unauthorized hostname.
Allowlisting this exact Preview hostname needs approval before changing the widget configuration. Existing DNS must remain unchanged.
Full Preview form success, mobile acceptance, role workflows, and Production release remain incomplete.
