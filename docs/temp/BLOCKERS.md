# Owner-only launch blockers and decisions

Last reconciled: 2026-08-13 after the simple release implementation. Every item below requires an account, purchase,
credential, business assertion, or publication authority that is unavailable to
repository-only work. There is no deferred material application defect.

## Launch-blocking owner actions

### 1. Hosted Supabase access and production data controls

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

### 2. Vercel production publication

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

### 3. Resend domain, DNS, and operational inbox

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

### 4. Real Cloudflare Turnstile credentials

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

### 5. Domain, DNS, TLS, and hosted smoke authorization

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

### 6. Business and legal content approval

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

## Owner decisions that do not block a manual-signing launch

### PandaDoc electronic signing

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

### Authentic photography

- **Impact:** Home/About retain clearly labeled photo placeholders.
- **Why owner-only:** only CMG can supply truthful storm/inspection/team images
  and consent to their use.
- **Fallback:** keep the labeled placeholders; do not use generated or misleading
  stock imagery as evidence of CMG people or work.
- **Steps/validation:** supply approved optimized assets and captions; confirm
  crop, alt text, rights, and mobile/desktop layout before deployment.
- **Launch blocking:** no, unless CMG makes photography a launch requirement.

### Repository promotion

- **Impact:** the verified branch is not merged or deployed.
- **Why owner-only:** final merge and public release approval are business
  decisions. Git push and Vercel access are now available.
- **Fallback:** preserve the local branch and commits.
- **Steps/validation:** review PR #1 and the passing GitHub checks; merge into
  `develop`; verify the remote commit and the automatic Vercel deployment.
- **Launch blocking:** yes for publication, not for local acceptance.
