# CMG launch and browser-test handoff

Last reconciled: 2026-08-13 on `feature/claims-platform`.

The application is feature-complete for the agreed functional scope and is
ready for owner acceptance testing. The broader continuation goal is still in
progress: architecture convergence, the admin/customer/partner craft and
all-surface cohesion gates, comparable mobile Lighthouse floors, stage
checkpoints, and final reconciliation remain mandatory. It has not been pushed,
merged, deployed, or connected to production services. The authoritative
production setup sequence is in the root
[`README.md`](../../README.md#production-launch-runbook).

## Verified local state

- Clean local database reset applied all 18 migrations through
  `20260815180000_partner_portal_profile.sql`.
- Vitest: 70 files, 712 tests passed.
- pgTAP: 25 files, 787 assertions passed.
- TypeScript, ESLint, production build, and `git diff --check` passed.
- `npm audit --audit-level=high`: zero vulnerabilities.
- Built client assets contain none of the server-only credential names.
- Production HTTP smoke: `/`, `/contact`, and `/file-a-claim` return 200;
  `/admin`, `/portal`, and `/partner` redirect unauthenticated visitors to login.
- CSP is enforcing, nonce-based, and covers every rendered script. Localhost
  omits only `upgrade-insecure-requests`; hosted requests retain it.
- Chrome testing passed at desktop and 390px for marketing, customer, partner,
  and staff surfaces. The browser and local production server remain open at
  `http://localhost:3010`.

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

## Required owner-independent work still in progress

- Fresh backend architecture convergence and the complete authorization matrix.
- Admin, customer, and partner craft convergence plus the all-surface cohesion
  gate, with required live screenshots and fresh critics.
- Two comparable mobile Lighthouse navigation runs whose lower performance is
  at least 85 and accessibility at least 95, including any owner-independent
  performance fixes needed to reach those floors.
- Stage checkpoint commits and final requirement-by-requirement reconciliation.

Only replacing the two deliberate photo placeholders is owner-blocked; it needs
authentic CMG assets rather than generated or misleading stock photography.

## Material limitations visible in the local MVP

- Public forms use Cloudflare's visible test widget and have no real bot
  protection until production Turnstile credentials are installed. This is a
  launch blocker, not deferred engineering work.
- Email remains queued/manual-link capable without Resend credentials and the
  deployed cron schedule.
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

1. Approve and publish the Git branch through the repository workflow.
2. Create/link hosted Supabase, run `supabase db push` without seed data,
   bootstrap the first owner, enable TOTP/leaked-password protection, and choose
   backups/PITR appropriate for claim records.
3. Import the app into Vercel, set every environment variable from
   `.env.example`, and confirm both cron schedules from `vercel.json`.
4. Verify the Resend domain/DNS and sender/inbox addresses.
5. Create real production Turnstile keys for the deployed hostnames.
6. Configure PandaDoc or formally accept the manual-signing launch mode.
7. Point the final domain/DNS and validate TLS.
8. Supply authentic photos and approve statistics, testimonial, legal copy,
   license display, retention position, and LOR wording.
9. After the remaining local stages and checkpoint commits complete, run the
   hosted smoke checklist, document rollback, and monitor dead webhook, outbox,
   and storage-cleanup rows.
