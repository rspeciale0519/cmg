# Owner-only launch blockers and decisions

Last reconciled: 2026-09-03.
The release target is `SITE_MODE=simple`.
The site is not approved for launch.
Current release-record updates are pushed; the verified Preview redeployment is Ready in simple mode.
This file contains owner-controlled decisions, access, and publication actions.
[HANDOFF.md](HANDOFF.md) contains engineering checks, release evidence, and pending release work.
Pending engineering checks are not owner-only blockers.

The previous record remains in the historical appendix.
Its completion and configuration claims do not describe the current release candidate.

## Simple-mode launch blockers

### 1. Hosted upload publication and acceptance

The user approved direct browser uploads to private Supabase Storage.
The local candidate implements the approved transport.
The advertised allowance is ten files of 25 MiB each.
File bytes now bypass Next.js Server Actions and their Vercel request limit.
See the implementation, validation, and cleanup controls in [HANDOFF.md](HANDOFF.md#approved-public-upload-transport).

**Owner action:** approve hosted deployment and hosted boundary-test submissions separately.
Architecture approval is complete and must not be requested again.
The pushed Preview contains the replacement transport, but hosted upload boundary acceptance remains unverified.
Do not claim maximum-size hosted acceptance before that deployment and its approved tests.
Local engineering validation belongs in HANDOFF, not this owner-only list.

Supabase [signed upload URLs](https://supabase.com/docs/reference/javascript/file-buckets-createsigneduploadurl) remain valid for two hours.
The implementation delays cleanup for two hours and 15 minutes after reservation and rechecks retained paths for late objects.
Retain these protections during any approved rollback.

### 2. Protection for the private repository

`develop` is unprotected.
GitHub returned HTTP 403 when its protection settings were inspected.
The response requires an eligible plan for private-repository protection.

**Owner action:** approve a supported private-repository plan and the separate branch-protection change.
Keep the repository private.
Require the approved checks before merging.
Manual review does not create an enforced protection rule.

### 3. Vercel commercial hosting plan

The browser confirmed that the Vercel team uses Hobby.
Vercel's [fair-use rules](https://vercel.com/docs/limits/fair-use-guidelines) require Pro or Enterprise for commercial use.
CMG's business site falls within that commercial scope, including simple mode.

**Recommendation:** use Vercel Pro for CMG.
**Owner action:** approve the commercial plan before purchase or commercial launch.
No purchase or plan change is approved or completed.
This decision is separate from GitHub's private-repository protection plan.
A Vercel upgrade does not remove the upload request limit or change the configured cron schedules.

### 4. Live public services and operating expectations

Vercel contains Resend and Turnstile settings.
Secret values and email delivery remain unverified.
Local vendor keys are empty, and local Turnstile keys are test-only.
Configuration presence does not prove delivery or bot protection.

Fresh Preview `/contact` navigation repeatedly reported Turnstile `110200`.
Cloudflare identifies this as “Domain not authorized” in its [error-code reference](https://developers.cloudflare.com/turnstile/troubleshooting/client-side-errors/error-codes/).
**Owner action:** approve widget hostname configuration for the intended Preview and production hosts.
No CAPTCHA bypass or configuration change occurred.

The Preview `SITE_MODE=simple` environment update and redeployment are complete.
Private routes redirect to `/platform-disabled`, and public routes pass read-only checks.

**Owner action:** confirm live accounts, sending-domain control, recipient addresses, and final Turnstile hostnames.
Approve live submissions and test messages before they write to hosted services or contact recipients.
Confirm the permitted test recipients and data.

The outbox runs daily at 14:00 UTC.
Storage cleanup runs daily at 14:17 UTC.
Hobby execution can occur later within the scheduled hour.
Retries and backlog processing can extend into later days.
Confirm that this operating delay meets CMG's requirements.
A faster schedule requires a separate decision after commercial-plan approval.

### 5. Domain, DNS, TLS, and mail policy

The current DNS observations are recorded in [HANDOFF.md](HANDOFF.md#hosted-database-and-service-evidence).
The Vercel aliases serve the CMG app, but `cmgpropertysolutions.net` redirects to `/lander` and its cron API path returns 404.
The custom domain is therefore not routed to the Vercel Production deployment.
The final site domain and sender-domain acceptance remain unconfirmed.
Microsoft 365 mail records exist, and the DMARC lookup returned NXDOMAIN.
These observations do not establish the required DNS changes.

**Owner action:** confirm the final hostname, DNS authority, mail policy, and cutover timing.
Attach the custom domain to the CMG Vercel project and validate the canonical redirect before launch.
Approve domain and DNS writes separately from deployment.
Preserve existing Microsoft 365 mail routing.
Approve hosted TLS, redirect, form, and email acceptance actions before launch.

### 6. Public business and legal approval

Public copy includes business claims, license information, testimonials, forms, privacy terms, and consent wording.
Only CMG and its legal adviser can approve those assertions and obligations.

**Owner action:** approve the exact release copy and public data-handling terms.
Confirm the retention position for public submissions and required legal holds.
Do not treat deferred private features as a waiver of public legal review.
See [RETENTION.md](../RETENTION.md) for implemented behavior and proposed policy.

### 7. Production backups and approved migrations

The hosted database contains three Auth users and three profiles.
The review did not inspect identities or confirm account roles.
The database must not be treated as empty or disposable.
Backup and PITR readiness remain unconfirmed.
The Supabase dashboard is signed out, so its backup settings could not be verified.
The owner explicitly declined a hosted Supabase database backup.

Six forward migrations follow the last recorded hosted migration, including two for direct uploads.
Their names, risks, and required preflight checks are in HANDOFF.
No production backup, migration, seed, reset, or data repair occurred during this review.

**Owner action:** confirm the recovery decision and Storage recovery coverage.
No production migration is authorized while recovery and PITR readiness remain unverified.
If a backup is later required, confirm that it includes private object bytes, not only database metadata.
Approve each production migration or repair separately.
Never seed or reset production.

An invalid existing document path can stop migration validation.
A repair needs reviewed metadata and Storage evidence.
Do not authorize automatic renaming, deletion, quarantine, or constraint removal as a default response.

### 8. Separate release approvals

The reviewed implementation and documentation commits are pushed.
PR #1 targets `develop`, and its current required GitHub checks pass.
The Ready Preview contains these fixes and runs simple mode.
The Vercel UI confirms that future Production deployments track `develop`.
A merge can therefore start deployment automatically.

The following actions require separate authorization:

- Update the PR description from the local draft.
- Change branch protection.
- Merge the approved PR.
- Deploy or promote Production.
- Change domain or DNS settings.
- Apply production migrations, repairs, backups, or restores.
- Submit hosted test data or send live test messages.

Approval for one action does not approve another action.
Auto-review rejected an earlier local reset retry before the user approved deletion of local database data.
That retry did not execute.

The user later approved deletion and rebuilding of the LOCAL CMG database only.
The approved local reset and its subsequent checks passed; no reset approval remains outstanding.
The approval did not authorize hosted reset, seed, migration, or Git actions.
Direct-upload implementation approval also leaves those separate approval scopes unchanged.
Use the prerequisite and recovery order in [README.md](../../README.md#simple-mode-production-runbook).
This record requests no approval and authorizes no action.

## Decisions deferred until platform activation

Private authentication, staff MFA, AAL2 acceptance, invitations, customer access, and partner access remain deferred.
Do not create a first owner merely because an old record says that no accounts exist.
Confirm existing identities and roles through an approved private-platform process.

PandaDoc signing and webhook acceptance remain deferred.
The current flow uses bundled PDFs with `H1` and `H2` roles.
It does not require template UUIDs.
An approved live draft test creates a real draft and must not run automatically.
See [PANDADOC_SETUP.md](PANDADOC_SETUP.md).

Retention automation, export, erasure, and legal holds need separate implementation and approval before applicable platform activation.
Public legal approval remains a simple-mode prerequisite.

## Optional authentic photography

Home and About retain labeled image placeholders.
CMG can supply approved photos and usage rights.
Do not use generated or misleading images as evidence of CMG people or work.
Photography does not block launch unless CMG makes it a requirement.

## Historical record — 2026-08-13

The following owner ledger is retained as historical evidence.
Its launch status, configuration claims, schedules, and required setup steps are superseded by the current sections above.
It does not authorize commands or production actions.

### Owner-only launch blockers and decisions

Last reconciled: 2026-08-13 after the simple release implementation. Every item below requires an account, purchase,
credential, business assertion, or publication authority that is unavailable to
repository-only work. There is no deferred material application defect.

#### Launch-blocking owner actions

##### 1. Hosted Supabase access and production data controls

- **Impact:** production authentication, claims, documents, RLS, and recovery
  cannot operate until the first owner and production controls are configured.
- **Why owner-only:** project creation, plan selection, billing, backup/PITR
  policy, and production-user identity require the owner's account and decision.
- **Safe fallback:** keep acceptance testing on the disposable local stack; do
  not expose it publicly.
- **Current state:** `.env.local` contains separate `PROD_SUPABASE_*` values for
  project `vdtqxglhlgatpbgehsjk`. The direct production connection works. All 21
  migrations match through `20260815220000_accept_intake_owner_guard.sql`.
  `claim-docs` exists and is private. Every public table has RLS enabled. A real
  contact test and a real intake test passed. The intake created the clearly
  labeled test claim `CMG-2026-0001`. Production has no Auth users or profiles.
- **Steps:** create the first production Auth user and owner profile, enroll
  TOTP, enable leaked-password protection, and choose backups/PITR. The owner
  email and initial password must come from the owner; they must not be invented
  in repository automation.
- **Validation:** migration version matches `20260815220000`; demo accounts are
  absent; owner reaches `/admin` only after AAL2; cross-role RLS smoke passes;
  upload/download and restore tests succeed.
- **Launch blocking:** yes.

##### 2. Vercel production publication

- **Impact:** the Preview works, but the verified branch is not yet the approved
  production release.
- **Why owner-only:** the final merge and public release are business decisions.
- **Safe fallback:** use the working Vercel Preview for private acceptance.
- **Current state:** project `cmgps` belongs to `rspeciale0519`, is linked to
  `rspeciale0519/cmg`, uses the Next.js preset, and has a Ready Preview.
  `SITE_MODE=simple` is set. The home, contact, and intake pages return 200.
  `/admin` redirects to `/platform-disabled`. Both hosted public forms passed.
- **Steps:** review PR #1, keep `develop` as the production branch, merge when
  approved, and confirm that the Git push creates the expected Vercel
  deployment. Promote only after the other launch blockers are complete.
- **Validation:** Vercel build passes; `/`, `/contact`, and `/file-a-claim` are
  200; protected routes redirect; no secret appears in client assets or logs.
- **Launch blocking:** yes.

##### 3. Resend domain, DNS, and operational inbox

- **Impact:** invitations and notifications remain durably queued/manual-link
  capable but no production email is delivered.
- **Why owner-only:** Resend account access and DNS control are required.
- **Safe fallback:** the UI returns manual invitation links; this is suitable for
  private acceptance only, not a public launch.
- **Steps:** verify the sending domain; publish Resend DNS; set
  `RESEND_API_KEY`, `EMAIL_FROM`, and `EMAIL_STAFF_INBOX`; confirm the five-minute
  outbox cron.
- **Validation:** send a real invitation and staff/customer notification;
  confirm provider delivery and `notifications_outbox.sent_at`.
- **Launch blocking:** yes.

##### 4. Real Cloudflare Turnstile credentials

- **Impact:** local public forms visibly use always-pass test challenges and
  therefore have no real bot protection.
- **Why owner-only:** widget creation and hostname approval require the owner's
  Cloudflare account and final domains.
- **Safe fallback:** do not expose the local/test-key build to public traffic.
- **Steps:** create a Managed widget for every production hostname; set
  `NEXT_PUBLIC_TURNSTILE_SITE_KEY` and `TURNSTILE_SECRET_KEY`; rebuild.
- **Validation:** test-only label disappears; valid contact/intake submissions
  pass; missing/invalid tokens fail; rate limiting still occurs first.
- **Launch blocking:** yes.

##### 5. Domain, DNS, TLS, and hosted smoke authorization

- **Impact:** canonical URLs, HTTPS, webhook URL, email links, and public reach
  cannot be final without the live domain.
- **Why owner-only:** DNS/domain ownership and go-live authority are external.
- **Safe fallback:** Vercel preview can be used for private hosted acceptance
  after secrets are installed.
- **Steps:** confirm the final domain; attach it in Vercel; set DNS and
  `NEXT_PUBLIC_SITE_URL`; configure the PandaDoc webhook URL if used; run the
  HANDOFF smoke suite.
- **Validation:** TLS/canonical/sitemap/robots pass; enforcing CSP has no hosted
  violations; forms, links, invites, downloads, crons, and webhooks use the
  production origin.
- **Launch blocking:** yes.

##### 6. Business and legal content approval

- **Impact:** unapproved claims or regulated wording could misrepresent CMG.
- **Why owner-only:** only CMG/counsel can attest to business facts and approve
  retention and LOR language.
- **Safe fallback:** keep the site private and use manual signing for controlled
  acceptance.
- **Steps:** approve the $86M, 2,400+, 45-year, testimonial attribution, license
  display, marketing/legal wording, retention position, and final LOR wording.
- **Validation:** written approval is recorded against the exact deployed copy
  and PandaDoc/manual LOR document.
- **Launch blocking:** yes.

#### Owner decisions that do not block a manual-signing launch

##### PandaDoc electronic signing

- **Impact:** without it, electronic send/status/PDF automation is unavailable.
- **Why owner-only:** API key, webhook key, template creation, and template UUIDs
  require the owner's PandaDoc account.
- **Fallback:** the secured manual-signing and signed-LOR upload workflow is
  complete and visible in Admin Settings.
- **Steps/validation:** follow [`PANDADOC_SETUP.md`](PANDADOC_SETUP.md). Configure
  the API key, shared webhook key, one-/two-signer template UUIDs, exact
  Homeowner roles, and 11 tokens. Test sent, viewed, failure/recovery, decline,
  completion, replay, and PDF filing.
- **Launch blocking:** no, if CMG explicitly accepts manual signing.

##### Authentic photography

- **Impact:** Home/About retain clearly labeled photo placeholders.
- **Why owner-only:** only CMG can supply truthful storm/inspection/team images
  and consent to their use.
- **Fallback:** keep the labeled placeholders; do not use generated or misleading
  stock imagery as evidence of CMG people or work.
- **Steps/validation:** supply approved optimized assets and captions; confirm
  crop, alt text, rights, and mobile/desktop layout before deployment.
- **Launch blocking:** no, unless CMG makes photography a launch requirement.

##### Repository promotion

- **Impact:** the verified branch is not merged or deployed.
- **Why owner-only:** final merge and public release approval are business
  decisions. Git push and Vercel access are now available.
- **Fallback:** preserve the local branch and commits.
- **Steps/validation:** review PR #1 and the passing GitHub checks; merge into
  `develop`; verify the remote commit and the automatic Vercel deployment.
- **Launch blocking:** yes for publication, not for local acceptance.
