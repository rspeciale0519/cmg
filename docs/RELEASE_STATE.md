# Release state — CMG Property Solutions

Reconciled 2026-09-22 (evening). Rewrite this file in place. Do not append dated updates to it.

Use [HANDOFF.md](temp/HANDOFF.md) for engineering evidence and checklists.
Use [BLOCKERS.md](temp/BLOCKERS.md) for the owner-decision register.
Use [README.md](../README.md#simple-mode-production-runbook) for the release procedure.

## Production

| Item | Current state |
|---|---|
| Vercel project | `cmgps`, Hobby plan |
| Site mode | `SITE_MODE=staff` (Production only; Preview and Development stay `simple`) |
| Public host | `app.cmgpropertysolutions.net` |
| Deployed code | `develop`, through the PR #14 merge |
| Hosted migrations | 35 applied, through `20260917130000`. A dry run on 2026-09-22 reported "Remote database is up to date." |
| Backups | The owner declined backups for the applied migrations |
| Recovery path | Reviewed forward repair; immediate restoration is unverified |

Production carries the direct-to-Storage upload transport, contractor intake fields, vendor intake links, the per-vendor fee setting, the prefilled Letter of Representation download, the corrected agreement-type checkbox positions, password recovery on the sign-in form, and the `staff` site mode. The staff desk is live: `/login`, `/mfa`, and `/admin` are open; `/portal`, `/partner`, and `/invite` stay closed.

Production environment facts set on 2026-09-22: `PANDADOC_API_KEY` and `PANDADOC_WEBHOOK_SHARED_KEY` apply to Preview only, so Production runs the manual e-signing path and refuses every webhook call. Supabase public sign-up is disabled; accounts are created only by invitation.

Synthetic test claims in Production: `CMG-2026-0001` (new intake), `CMG-2026-0002` (under review), `CMG-2026-0003` (LOR sent, manual signature pending, fee 20%), and `CMG-2026-0004` (under review, fee 20% seeded at acceptance). Their descriptions mark them as tests.

## Pull requests

PRs #1 through #14 are merged into `develop`. No pull request is open.

## Migration heads

The hosted head and the repository head on `develop` are both `20260917130000`.
Compare hosted history against repository files before every approved production write.

The agent cannot read or write the production database. Claude Code's permission classifier blocks it even with chat approval. The owner runs hosted migrations with the Supabase CLI installed directly:

```powershell
$env:PROD_SUPABASE_DIRECT_URL = ((Select-String -Path .env.local -Pattern '^PROD_SUPABASE_DIRECT_URL=').Line -split '=',2)[1].Trim('"'); supabase db push --dry-run --db-url $env:PROD_SUPABASE_DIRECT_URL
```

Remove `--dry-run` and add `--yes` to apply. Do not call it through `npx`. npm consumes `--yes` and echoes the full connection string, including the password, into its output.

## Site modes

| Mode | Open | Closed |
|---|---|---|
| `simple` | Public site and forms | All six private prefixes |
| `staff` | `/login`, `/mfa`, `/admin` | `/portal`, `/partner`, `/invite` |
| `platform` | Everything | Nothing |

Unknown or missing values resolve to `simple`. In `staff` mode, only the three staff-alert email templates are added, because the other private templates link into portals that stay closed. Outbox rows older than `OUTBOX_MAX_AGE_DAYS` (default 7) are dead-lettered instead of sent. While `/invite` is closed, accepting an intake issues no invitations, and every admin invite control shows a "paused" note.

Invitation is the only way to create an account, so staff mode cannot add new staff members until `/invite` reopens.

## E-signing

The first release uses the manual path. Staff download a prefilled Letter of Representation from the claim screen, upload it to PandaDoc's web app, send it from there, then click "Mark letter as sent." The signed copy is uploaded to the claim as document kind `lor_signed`. This path needs no PandaDoc API key and no webhook. The API path remains in the code for later.

## Staff-desk acceptance — 2026-09-22

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
| Password recovery routes | Pass for routing and expired-link handling; real email delivery not yet exercised |
| Upload a signed letter | Not yet run |

## Environment

| Item | Current state |
|---|---|
| Turnstile | Managed widget with four authorized hostnames, covering `cmgpropertysolutions.net` and a Preview host |
| Resend domain | `cmgpropertysolutions.net`, verified 2026-09-09; sender `claims@cmgpropertysolutions.net` |
| Mail DNS | Microsoft 365 MX and SPF unchanged; Resend DKIM and `send.` subdomain records verified |
| DMARC | `v=DMARC1; p=none;` |
| Cron | `/api/cron/outbox` daily at 14:00 UTC; `/api/cron/storage-cleanup` daily at 14:17 UTC |

Daily cron caveat: Hobby scheduling does not guarantee the configured minute, and a retry or cleanup backlog can take several days to drain.

## Open gates

| Item | Who | Status |
|---|---|---|
| Upload a signed letter and advance to `lor_signed` | owner | Needs a real file; run by hand on `CMG-2026-0003` |
| Password recovery email delivery | owner | Request a reset for your own address and confirm the email arrives |
| Adding staff while `/invite` is closed | engineering | Invitations are the only account path; staff mode cannot onboard new staff yet |
| Maximum-size upload boundary acceptance | engineering | Open |
| Rotate the old preview PandaDoc webhook key | owner | Pending |
| Delete stray root folders | owner | Pending |
| Cron delay acceptance | owner | Open question |
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
- The staff desk opens first. Customer and partner logins wait for a separate decision.
- The CMG standard fee is 20 percent. Each vendor can have its own rate, set by owners only. The public form never sets a fee.
- Backups stay declined. Recovery is reviewed forward repair.

## Ordered next steps

1. Finish staff-desk acceptance: upload a signed letter on `CMG-2026-0003`, and confirm a password-recovery email arrives.
2. Decide how to onboard new staff while the customer portal stays closed.
3. Send one real Letter of Representation through PandaDoc's web app.
4. Obtain owner and legal approval of the public copy.
5. Apply the SEO origin fix and cut `app.` over to `www.` last.
