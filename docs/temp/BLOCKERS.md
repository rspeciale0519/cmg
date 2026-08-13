# Owner-only launch blockers and decisions

Last reconciled: 2026-08-12. No open item below is fixable solely inside the
repository. These items do not include the still-required architecture, craft,
cohesion, Lighthouse, verification, documentation, or checkpoint work.

## Launch blockers

1. **Hosted Supabase and production data controls.** Create the project, apply
   migrations without `seed.sql`, bootstrap the first owner, enable TOTP and
   leaked-password protection, and select backups/PITR. Do not copy local demo
   accounts or claims into production.
2. **Production deployment and secrets.** Import the approved branch into
   Vercel and set the exact variables in `.env.example`. Keep
   `SUPABASE_SECRET_KEY`, `TURNSTILE_SECRET_KEY`, `RESEND_API_KEY`,
   `CRON_SECRET`, and every PandaDoc credential server-only.
3. **Real Turnstile credentials.** The public forms visibly use Cloudflare test
   keys locally and therefore accept test challenges. Create a Managed widget
   for every deployed hostname, set both keys, rebuild, and confirm the test
   badge is gone on `/contact` and `/file-a-claim`.
4. **Email domain and operations.** Verify the Resend sending domain/DNS, choose
   `EMAIL_FROM` and `EMAIL_STAFF_INBOX`, set `RESEND_API_KEY`, and verify the
   five-minute outbox cron. Without this, messages stay durable but queued.
5. **Domain/TLS and final hosted smoke.** Point the production domain, set
   `NEXT_PUBLIC_SITE_URL`, verify TLS and CSP, then run the checklist in
   `HANDOFF.md` against the hosted environment.
6. **Business/legal approval.** The owner must confirm the $86M/2,400+/45-year
   claims, testimonial attribution and figures, public-adjuster license display,
   marketing/legal wording, retention position, and production LOR content.

## Owner decisions that do not block a manual-signing launch

- **PandaDoc:** supply the API key, shared webhook key, and one-/two-signer
  template UUIDs using the roles and 11 tokens listed on `/admin/settings`; or
  explicitly launch with manual signing and signed-LOR upload.
- **Photography:** supply authentic storm/inspection and CMG team images for the
  labeled Home/About placeholders. Stock imagery should not represent real CMG
  people or work.
- **Repository promotion:** authorize commit/push/PR/merge/deploy. No external
  repository or hosted-resource mutation was performed by this build.

See the root README for exact commands, variable names, rollout order, rollback,
and monitoring.
