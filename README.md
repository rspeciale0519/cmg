# CMG Property Solutions

Marketing site and secure claims platform for CMG Property Solutions — licensed Florida
public adjusters (Austin Graham, license #G086165).

## Stack

Next.js 16 (App Router) · React 19 · TypeScript 6 (strict) · Tailwind CSS v4 ·
Supabase (Postgres 17, Auth, Storage) · Resend · PandaDoc e-signature · Cloudflare Turnstile

## Getting started

```bash
npm install
cp .env.example .env.local   # fill in values; see notes inside
npm run db:start             # local Supabase via Docker (Docker Desktop must be running)
npm run dev
```

## Scripts

| Script | Purpose |
|---|---|
| `npm run dev` | Development server |
| `npm run build` / `start` | Production build / serve |
| `npm run type-check` | `tsc --noEmit` |
| `npm run lint` | ESLint |
| `npm test` | Vitest unit tests |
| `npm run db:start` / `db:stop` | Local Supabase stack |
| `npm run db:reset` | Re-apply migrations + seed |
| `npm run db:test` | pgTAP suite (RLS and schema) |
| `npm run db:types` | Regenerate `src/types/database.ts` |

## Layout

```
src/app/          routes: marketing, auth, admin, portal, partner, api
src/components/   shared UI
src/lib/          supabase clients, authz, validators, esign, email
supabase/         migrations, seed, pgTAP tests
design/           original Claude Design prototypes (visual source of truth)
docs/             roadmap, PandaDoc reference, progress log, handoff
```

## Documentation

- Design authority: [`.claude/plans/feature-claims-platform.md`](.claude/plans/feature-claims-platform.md)
- Roadmap: [`docs/ROADMAP.md`](docs/ROADMAP.md)
- Progress log: [`docs/temp/PROGRESS.md`](docs/temp/PROGRESS.md)
- PandaDoc integration: [`docs/reference/pandadoc/`](docs/reference/pandadoc/README.md)

## Production launch runbook

This repository is ready to configure, but nothing in it creates hosted resources or
deploys automatically. Complete these steps in order:

1. Decide the Git/PR path and production branch. Review the feature branch, commit the
   intended files, and merge only after the consolidated verification suite passes.
2. Create a hosted Supabase project in a US East region. Link the CLI and run
   `npx supabase db push`. Never run `supabase/seed.sql` in production; it contains
   demo users and claims.
3. Create the first owner through Supabase Auth, then insert its `public.profiles` row
   with role `owner`. Sign in and enroll MFA before inviting any other staff.
4. Enable leaked-password protection, require staff MFA, configure the private
   `claim-docs` bucket, and enable backups/PITR appropriate to the plan. Verify a
   restore procedure before accepting live claims.
5. Create a Vercel project and set every required variable from `.env.example`.
   Set `SITE_MODE=simple` for the first release. This keeps the marketing site,
   public forms, email delivery, and file cleanup available while the private
   platform stays closed. Use `SITE_MODE=platform` only after CMG buys and
   approves the platform features.
   Keep `SUPABASE_SECRET_KEY`, `CRON_SECRET`, Resend, PandaDoc, and Turnstile secrets
   server-only. `vercel.json` schedules outbox delivery every five minutes and storage
   cleanup hourly; Vercel sends `CRON_SECRET` to both protected routes.
6. Verify the sending domain in Resend, set `EMAIL_FROM` and `EMAIL_STAFF_INBOX`,
   publish the required DNS records, and send a real invitation plus notification.
7. Create the Cloudflare Turnstile widget for the final hostname and configure its
   public/secret keys. Submit both public forms and confirm refused traffic is
   rate-limited before Turnstile verification.
8. Configure PandaDoc API, one- and two-signer template UUIDs, the exact token/role
   contract shown in Admin Settings, and the webhook shared key/URL. Exercise sent,
   viewed, declined, retry, manual fallback, and completed-PDF filing.
9. Attach the production domain in Vercel, finish DNS, and verify HTTPS redirects,
   canonical URLs, sitemap, robots, security headers, and representative CSP behavior.
10. Run production smoke tests for marketing forms, invitation redemption, staff MFA,
    admin claim management, customer isolation, partner isolation, document access,
    e-sign recovery, email delivery, and both cron endpoints.
11. Record the deployment ID and migration version. Roll back application code through
    Vercel; use additive database migrations for forward fixes rather than destructive
    schema rollback. Restore data only through the rehearsed backup procedure.
12. Monitor failed/dead rows in `notifications_outbox`, `storage_cleanup_queue`,
    `pandadoc_webhook_events`, and `esign_dispatch_attempts`. Investigate rather than
    deleting ledger rows; they are operational evidence and recovery inputs.

The detailed owner checklist and validation evidence live in
[`docs/temp/HANDOFF.md`](docs/temp/HANDOFF.md) and
[`docs/temp/BLOCKERS.md`](docs/temp/BLOCKERS.md).
