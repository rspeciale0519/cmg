# Release state — CMG Property Solutions

Reconciled 2026-10-07. Rewrite this file in place. Do not append dated updates to it.
Keep this file short. Put narrative evidence, commit IDs, run numbers, and preview URLs in HANDOFF.

Use [HANDOFF.md](temp/HANDOFF.md) for engineering evidence and checklists.
Use [BLOCKERS.md](temp/BLOCKERS.md) for the owner-decision register.
Use [LAUNCH_CHECKLIST.md](temp/LAUNCH_CHECKLIST.md) for full-platform completion requirements.
Use [README.md](../README.md#simple-mode-production-runbook) for the release procedure.

## Production

| Item | Current state |
|---|---|
| Vercel project | `cmgps`, Hobby plan |
| Site mode | `SITE_MODE=platform` in Production since 2026-10-07. Preview and Development default to `simple`; selected branch Previews can carry overrides. |
| Public host | `app.cmgpropertysolutions.net`. Production `NEXT_PUBLIC_SITE_URL` is `https://app.cmgpropertysolutions.net`. |
| Deployed code | Production deploys from `develop`. PRs #16 and #17 are live and verified. Confirm the deployed commit in Vercel before each release. |
| Hosted migrations | 36 applied, through `20260927120000` (private upload sessions, applied 2026-09-30 ahead of its code) |
| Backups | The owner declined backups for the applied migrations |
| Recovery path | Reviewed forward repair; immediate restoration is unverified |

Platform mode opens the public site, `/login`, `/mfa`, `/admin`, `/portal`, `/partner`, and `/invite`.
The owner switched from `staff` to `platform` after PRs #16 and #17 merged and the five old outbox rows were confirmed safe.

`PANDADOC_API_KEY` and `PANDADOC_WEBHOOK_SHARED_KEY` apply to Preview only, so Production uses the manual e-signing path.
A current Production webhook response has not been checked.
Supabase public sign-up is disabled; accounts are created only by invitation.

Synthetic test records in Production: claims `CMG-2026-0001` through `CMG-2026-0005`, test vendor companies including "CMG Test Vendor" (standard 20% fee), and test staff, vendor, and homeowner accounts.
Their descriptions or names mark them as tests. Do not treat them as customer data, and do not delete them without approval.

## Pull requests

PRs #1 through #17 and #21 are merged into `develop`.

| PR | State |
|---|---|
| #18 partner-directory count | Open. Superseded by `bugfix/launch-integration-v2` once that branch merges. |
| #19 private upload transport | Open. Superseded by `bugfix/launch-integration-v2` once that branch merges. Its dependency commits are already in `develop` through #21. |
| #20 password show/hide toggle and invite hint | Approved and passing. Not merged. Independent of the combined branch. |

`bugfix/launch-integration-v2` rebuilds the code of #18 and #19 and the later launch repairs on current `develop`.
It replaces the earlier `bugfix/launch-integration` branch, which was built on an older base.

## Migration heads

The hosted head is `20260927120000`. The repository head on `develop` is `20260917130000`.
`bugfix/launch-integration-v2` adds `20260927120000_private_upload_sessions.sql`, which is already applied in Production.
After that merge, the hosted and repository heads match. Do not apply the migration again.
Compare hosted history against repository files before every approved Production write.
The owner runs hosted migrations. Do not pass a production database URL on a visible command line.

## Site modes

| Mode | Open | Closed |
|---|---|---|
| `simple` | Public site and forms | All six private prefixes |
| `staff` | `/login`, `/mfa`, `/admin` | `/portal`, `/partner`, `/invite` |
| `platform` | Everything | Nothing |

Unknown or missing values resolve to `simple`.
Staff mode adds only the three staff-alert email templates; platform mode delivers every template.
Outbox rows older than `OUTBOX_MAX_AGE_DAYS` (default 7) are dead-lettered instead of sent.

## E-signing

The first release uses the manual path.
Staff download a prefilled letter, upload it to PandaDoc, and record the confirmed send with **Mark letter as sent**.
After all signatures, staff upload the final copy as `lor_signed` and separately advance the claim to **LOR signed**.
Upload alone does not advance the claim status.
Web-upload field recognition, signer assignment, and a real signing remain open acceptance requirements.
See [PANDADOC_SETUP.md](temp/PANDADOC_SETUP.md).

## Hosted acceptance on Production

| Area | Result |
|---|---|
| Staff invitation (adjuster) | Pass on 2026-10-07: password set, TOTP enrolled, assigned claims only, owner-only pages not found, `/portal` and `/partner` redirect to `/admin` |
| Vendor invitation | Pass on 2026-10-07: rep lands on `/partner`, sees only the company's referred claim without documents, policy, or homeowner contact, and cannot open `/admin` or `/portal` |
| Homeowner invitation to an existing account | Pass on 2026-10-07: claim linked, password unchanged by design, portal shows only that account's claims |
| New homeowner through public intake | Pass on 2026-10-07 with `CMG-2026-0005`: receipt and invitation emails delivered; adjuster and vendor rep each see exactly that claim |
| Manual signature panel after `lor_signed` (PR #16) | Live and verified |
| Partner referral attribution and claimants refresh (PR #17) | Live and verified |
| Password-reset email and `lor_signed` upload | Pass on 2026-09-23 |

Details are in [HANDOFF.md](temp/HANDOFF.md).

## Known Production gaps

| Gap | Fix |
|---|---|
| Staff and homeowner document uploads use Server Actions while the UI offers 25 MiB. Vercel limits function request bodies to 4.5 MB, so larger files fail. | `bugfix/launch-integration-v2` uploads private documents directly to Storage. Its migration is already in Production. |
| The owner partner directory embeds a count from `claims`, which the authenticated column grant refuses. The directory shows no companies. Observed on a Preview of the same code and hosted database on 2026-10-05. | `bugfix/launch-integration-v2` counts `claim_partner_summaries` and shows a recoverable error if a count fails. |

## Environment

| Item | Current state |
|---|---|
| Turnstile | Managed widget with six authorized hostnames, including `cmgpropertysolutions.net` and selected Preview hosts |
| Resend domain | `cmgpropertysolutions.net`, verified 2026-09-09; sender `claims@cmgpropertysolutions.net` |
| Mail DNS | Microsoft 365 MX and SPF unchanged; Resend DKIM and `send.` subdomain records verified |
| DMARC | `v=DMARC1; p=none;` |
| Cron | `/api/cron/outbox` daily at 14:00 UTC; `/api/cron/storage-cleanup` daily at 14:17 UTC |

Hobby scheduling does not guarantee the configured minute, and a retry or cleanup backlog can take several days to drain.
Scheduled cron execution has not been verified from logs.

## Open gates

| Item | Who | Status |
|---|---|---|
| Merge `bugfix/launch-integration-v2` | engineering, then owner | Open. Requires green CI and a successful Vercel Preview. Watch the Preview for `next/font/google` build errors. |
| Hosted 25 MiB upload boundary for staff and homeowner documents | engineering | Open until the combined branch deploys |
| Owner partner directory in Production | engineering | Open until the combined branch deploys |
| PR #20 merge | owner | Approved and passing; not merged |
| Remaining full-platform acceptance | engineering | See LAUNCH_CHECKLIST: invitation replay and expiry, upload boundaries, cleanup recovery, private routes at 390px, browser diagnostics |
| Real PandaDoc signing test | owner | Open |
| Email operations | owner | Named daily operator, monitored reply mailbox, and inbox receipt are open |
| Retention, export, erasure, and legal holds | owner and counsel | Open. Platform mode is live, so these are active obligations. See RETENTION. |
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
- Admins invite staff, vendors, and homeowners (decided 2026-09-23). Production runs `SITE_MODE=platform` from 2026-10-07.
- The CMG standard fee is 20 percent. Each vendor can have its own rate, set by owners only. The public form never sets a fee.
- Backups stay declined. Recovery is reviewed forward repair.

## Ordered next steps

1. Merge `bugfix/launch-integration-v2` after CI and the Vercel Preview pass. Then close PRs #18 and #19 as superseded.
2. Verify hosted 25 MiB staff and homeowner uploads and the owner partner directory in Production.
3. Merge PR #20 when the owner chooses.
4. Complete the remaining acceptance in LAUNCH_CHECKLIST.
5. Send one real Letter of Representation through PandaDoc's web app.
6. Resolve commercial hosting, repository protection, email operations, privacy, retention, and legal gates.
7. Obtain owner and legal approval of the public copy.
8. Apply the SEO origin fix and cut `app.` over to `www.` last.
