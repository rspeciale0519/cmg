# Release state — CMG Property Solutions

Reconciled 2026-09-22. Rewrite this file in place. Do not append dated updates to it.

Use [HANDOFF.md](temp/HANDOFF.md) for engineering evidence and checklists.
Use [BLOCKERS.md](temp/BLOCKERS.md) for the owner-decision register.
Use [README.md](../README.md#simple-mode-production-runbook) for the release procedure.

## Production

| Item | Current state |
|---|---|
| Vercel project | `cmgps`, Hobby plan |
| Site mode | `SITE_MODE=simple` |
| Public host | `app.cmgpropertysolutions.net` |
| Deployed code | `develop`, through the PR #10 merge |
| Hosted migrations | 35 applied, through `20260917130000`. A dry run on 2026-09-22 reported "Remote database is up to date." |
| Backups | The owner declined backups for the applied migrations |
| Recovery path | Reviewed forward repair; immediate restoration is unverified |

Production carries the direct-to-Storage upload transport, contractor intake fields, vendor intake links, the per-vendor fee setting, the prefilled Letter of Representation download, the corrected agreement-type checkbox positions, and the `staff` site mode. The staff desk stays closed until `SITE_MODE` is changed.

Synthetic acceptance claim `CMG-2026-0004` exists in Production. Its description marks it as a test.

## Pull requests

PRs #1 through #10 are merged into `develop`. No pull request is open.

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

Unknown or missing values resolve to `simple`. In `staff` mode, only the three staff-alert email templates are added, because the other private templates link into portals that stay closed. Outbox rows older than `OUTBOX_MAX_AGE_DAYS` (default 7) are dead-lettered instead of sent.

## E-signing

The first release uses the manual path. Staff download a prefilled Letter of Representation from the claim screen, upload it to PandaDoc's web app, and send it from there. The signed copy is uploaded to the claim as document kind `lor_signed`. This path needs no PandaDoc API key and no webhook. The API path remains in the code for later.

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
| Rotate the Supabase database password | owner | Recommended 2026-09-22. The password appeared in a scrambled but recoverable form in a local agent transcript. |
| Resend delivery check for `CMG-2026-0004` and the 2026-09-15 lead | engineering | Waiting on the owner to sign in to Resend in a browser tab the agent controls |
| Staff desk activation | owner | Migrations done. Set `SITE_MODE=staff` in Vercel, redeploy, then enroll staff MFA. |
| Staff-desk hosted acceptance | engineering | After activation: MFA and AAL2, role boundaries, prefilled letter download, signed-letter upload |
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

1. Rotate the Supabase database password.
2. Complete the Resend delivery check.
3. Turn on the staff desk: set `SITE_MODE=staff` in Vercel, redeploy, and enroll staff MFA.
4. Run staff-desk hosted acceptance, including one prefilled letter sent through PandaDoc's web app.
5. Obtain owner and legal approval of the public copy.
6. Apply the SEO origin fix and cut `app.` over to `www.` last.
