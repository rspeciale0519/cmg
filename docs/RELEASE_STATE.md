# Release state — CMG Property Solutions

Reconciled 2026-09-26. Rewrite this file in place. Do not append dated updates to it.

Use [HANDOFF.md](temp/HANDOFF.md) for engineering evidence and checklists.
Use [BLOCKERS.md](temp/BLOCKERS.md) for the owner-decision register.
Use [README.md](../README.md#simple-mode-production-runbook) for the release procedure.

## Production

| Item | Current state |
|---|---|
| Vercel project | `cmgps`, Hobby plan |
| Site mode | `SITE_MODE=staff` (Production only; Preview and Development stay `simple`) |
| Public host | `app.cmgpropertysolutions.net` |
| Deployed code | GitHub reports a successful Production deployment of `develop` commit `2fdf6bd` on 2026-09-24; the public host still needs an exact deployment-alias check |
| Hosted migrations | Read-only query on 2026-09-26 found 35 applied, through `20260917130000` |
| Backups | The owner declined backups for the applied migrations |
| Recovery path | Reviewed forward repair; immediate restoration is unverified |

Production carries the direct-to-Storage upload transport, contractor intake fields, vendor intake links, the per-vendor fee setting, the prefilled Letter of Representation download, the corrected agreement-type checkbox positions, password recovery on the sign-in form, and the `staff` site mode. The staff desk is live: `/login`, `/mfa`, and `/admin` are open; `/portal`, `/partner`, and `/invite` stay closed.

Production environment facts recorded on 2026-09-22: `PANDADOC_API_KEY` and `PANDADOC_WEBHOOK_SHARED_KEY` apply to Preview only. Production uses the manual e-signing path. A current webhook response has not been checked. Supabase public sign-up is disabled; accounts are created only by invitation.

Synthetic test claims in Production: `CMG-2026-0001` (new intake), `CMG-2026-0002` (under review), `CMG-2026-0003` (`lor_signed`, signed letter uploaded, fee 20%), and `CMG-2026-0004` (under review, fee 20% seeded at acceptance). Their descriptions mark them as tests.

## Pull requests

PRs #1 through #17 are merged into `develop`. GitHub listed no open pull request on 2026-09-26.
GitHub run `36003466471` passed `verify` and `database` for head `2fdf6bd`.

## Migration heads

The hosted head and the repository head on `develop` are both `20260917130000`.
Compare hosted history against repository files before every approved production write.

The 2026-09-26 migration check used a read-only connection and did not print the database password.
Do not pass a production database URL on a visible command line. Obtain separate approval for every Production write.

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

## Staff-desk acceptance — 2026-09-22 and 2026-09-23

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
| Password recovery routes | Pass, including real email delivery. On 2026-09-23 Resend showed "Reset your CMG password" delivered to the owner's address. |
| Forgot-password retry | Watch item. The first submission in Chrome was refused once. The retry succeeded. The cause is unknown. |
| Upload a signed letter | Pass on 2026-09-23. A signed LOR was uploaded to `CMG-2026-0003` as kind `lor_signed` (CMG only). The claim moved to `lor_signed`, and the Representation signed milestone was recorded. |
| Letter panel after `lor_signed` | The panel showed stale pending controls on 2026-09-23. PR #16 merged a fix; current rendered behavior still needs confirmation. |

## Environment

| Item | Current state |
|---|---|
| Turnstile | Managed widget with four authorized hostnames, covering `cmgpropertysolutions.net` and a Preview host |
| Resend domain | `cmgpropertysolutions.net`, verified 2026-09-09; sender `claims@cmgpropertysolutions.net` |
| Mail DNS | Microsoft 365 MX and SPF unchanged; Resend DKIM and `send.` subdomain records verified |
| DMARC | `v=DMARC1; p=none;` |
| Cron | `/api/cron/outbox` daily at 14:00 UTC; `/api/cron/storage-cleanup` daily at 14:17 UTC |

Read-only checks on 2026-09-26 found the `app.` CNAME at `50238cf0f774d850.vercel-dns-017.com`.
The Microsoft 365 MX remains present, and DMARC remains `v=DMARC1; p=none;`.
The `app.` TLS certificate passed normal validation with TLS 1.3 and expires on 2026-12-08.
No DNS record or certificate setting changed during these checks.

Daily cron caveat: Hobby scheduling does not guarantee the configured minute, and a retry or cleanup backlog can take several days to drain.
Read-only inspection on 2026-09-26 found four pending `claim_status_update` messages.
Two were older than seven days. None was sent during this inspection.
The Storage cleanup queue had no open jobs; all three retained rows were processed.
Before platform activation, review the four pending messages and approve their intended delivery or retention.
Platform mode permits customer templates, and the daily outbox job can act on pending rows.

## Open gates

| Item | Who | Status |
|---|---|---|
| Admin invitations for staff, vendors, and homeowners | engineering, then owner | Local synthetic browser acceptance passed on 2026-09-26, including staff MFA, role boundaries, and uploaded document download. The partner-directory count fix is on `bugfix/partner-directory-count`; Vercel Preview is ready, but CI requires a pull request. Hosted Preview platform acceptance, invitation replay, hosted document bytes, and responsive checks stay open. Review pending messages before requesting Production `SITE_MODE=platform`. |
| Pending customer status messages | engineering, then owner | Four pending; two older than seven days on 2026-09-26. Review before platform activation so the outbox does not decide their delivery by default. |
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
- The staff desk opens first. On 2026-09-23 the owner decided that admins must be able to invite staff, vendors, and homeowners. This opens customer and partner logins through `SITE_MODE=platform`.
- The CMG standard fee is 20 percent. Each vendor can have its own rate, set by owners only. The public form never sets a fee.
- Backups stay declined. Recovery is reviewed forward repair.

## Ordered next steps

1. Test all three invitation types in local and hosted Preview platform mode, including role boundaries and private documents. Review pending outbox messages. Obtain approval before changing Production to `SITE_MODE=platform`. Then run Production acceptance.
2. Send one real Letter of Representation through PandaDoc's web app.
3. Obtain owner and legal approval of the public copy.
4. Apply the SEO origin fix and cut `app.` over to `www.` last.
