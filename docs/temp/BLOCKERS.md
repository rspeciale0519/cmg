# Owner-only launch blockers and decisions

Last reconciled: 2026-08-13. Every item below requires an account, purchase,
credential, business assertion, or publication authority that is unavailable to
repository-only work. There is no deferred material application defect.

## Launch-blocking owner actions

### 1. Hosted Supabase and production data controls

- **Impact:** production authentication, claims, documents, RLS, and recovery
  cannot operate without the hosted database and Storage project.
- **Why owner-only:** project creation, plan selection, billing, backup/PITR
  policy, and production-user identity require the owner's account and decision.
- **Safe fallback:** keep acceptance testing on the disposable local stack; do
  not expose it publicly.
- **Steps:** create a US East project; link the CLI; run `npx supabase db push`
  without `supabase/seed.sql`; create the first Auth user and matching owner
  profile; enroll TOTP; enable leaked-password protection; confirm private
  `claim-docs`; choose backups/PITR and rehearse restore.
- **Validation:** migration version matches `20260815220000`; demo accounts are
  absent; owner reaches `/admin` only after AAL2; cross-role RLS smoke passes;
  upload/download and restore tests succeed.
- **Launch blocking:** yes.

### 2. Vercel production project, secrets, and publication authorization

- **Impact:** there is no public application, production environment, or cron
  execution until the project is imported and deployed.
- **Why owner-only:** importing the repository, selecting the production branch,
  storing credentials, and approving publication are external account actions.
- **Safe fallback:** continue local production-mode testing at port 3011.
- **Steps:** approve the five local commits ahead of origin; choose push/PR/merge
  path; import the approved branch; set every variable from `.env.example` in
  the correct Vercel environments; set `NEXT_PUBLIC_SITE_URL`; deploy only after
  the other blockers below are resolved.
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
- **Steps/validation:** configure the API key, shared webhook key, one-/two-signer
  template UUIDs, exact Homeowner roles, and 11 tokens; exercise sent, viewed,
  failure/recovery, decline, completion, and PDF filing.
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

- **Impact:** the verified local checkpoints remain unpublished.
- **Why owner-only:** push, PR, merge, and deploy authority was not granted.
- **Fallback:** preserve the local branch and commits.
- **Steps/validation:** review the final diff and checks; explicitly authorize
  the desired push/PR/merge/deploy workflow; verify remote commit IDs afterward.
- **Launch blocking:** yes for publication, not for local acceptance.
