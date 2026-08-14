# CMG launch and browser-test handoff

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

## Verified local state

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

## Safe local test accounts

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

## Practical browser acceptance checklist

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

## Owner-independent work at handoff

- Complete. Stage 3 is checkpointed at `bb958a0`; this reconciled handoff is
  included in the final Stage 4 documentation checkpoint.

Only replacing the two deliberate photo placeholders is owner-blocked; it needs
authentic CMG assets rather than generated or misleading stock photography.

## Material limitations visible in the local MVP

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

## Owner-only launch steps

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

## Exact Git and hosted state at handoff

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
