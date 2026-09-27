# CMG Property Solutions

CMG runs a public marketing site and a private claims platform.
Production currently runs `SITE_MODE=staff` on `app.cmgpropertysolutions.net`.
This mode opens the CMG staff desk and keeps customer, partner, and invitation routes closed.
The owner has approved work toward `SITE_MODE=platform` after local and hosted Preview acceptance of all three invitation flows.
Check [RELEASE_STATE.md](docs/RELEASE_STATE.md) before changing the Production mode.

[RELEASE_STATE.md](docs/RELEASE_STATE.md) is the current release record.
It contains production facts, open pull requests, migration heads, environment facts, open gates, and the ordered next steps.
[HANDOFF.md](docs/temp/HANDOFF.md) contains engineering evidence and acceptance checklists.
[BLOCKERS.md](docs/temp/BLOCKERS.md) lists owner-controlled decisions.

## Stack and local setup

Use Node.js 22 and npm.
`package-lock.json` controls installed dependency versions.
The application uses Next.js 16.3, React 19, TypeScript, Tailwind CSS, Supabase, Resend, PandaDoc, and Turnstile.

1. Start Docker Desktop.
2. Confirm that the Supabase CLI is available.
3. Install the locked packages.

```powershell
npm ci
npm run db:start
```

4. Create `.env.local` from `.env.example` only if `.env.local` does not exist.
5. Set the local Supabase URL and keys from the local stack.
6. Keep `SITE_MODE=simple` for public-site work.
7. Start the application.

```powershell
npm run dev
```

The default application port is 3000.
Reuse a healthy project server before starting another server.
Do not print secrets or commit `.env.local`.
The example Turnstile keys are for development only.

Local Supabase reserves host ports 15420 through 15429.
Use [supabase/config.toml](supabase/config.toml) as the port authority.

| Port | Service | Current configuration |
|---|---|---|
| 15420 | Shadow database | Reserved for database operations |
| 15421 | API | Enabled |
| 15422 | PostgreSQL | Enabled |
| 15423 | Studio | Enabled |
| 15424 | Local email interface | Enabled |
| 15425 / 15426 | SMTP / POP3 | Optional; not enabled |
| 15427 | Analytics | Disabled |
| 15428 | Reserved | No configured service |
| 15429 | Database pooler | Disabled |

## Commands and checks

| Command | Purpose |
|---|---|
| `npm run dev` | Start the development server |
| `npm run build` | Build the production application |
| `npm run start` | Serve the production build |
| `npm run type-check` | Check TypeScript |
| `npm run lint` | Run ESLint |
| `npm test` | Run Vitest |
| `npm run db:start` / `npm run db:stop` | Start or stop the local Supabase stack |
| `npm run db:reset` | Rebuild the local database from migrations and seed data |
| `npm run db:test` | Run pgTAP schema and RLS tests |
| `npm run db:types` | Generate local database types |
| `npm audit --audit-level=high` | Check dependency security |

Confirm that local data is disposable before `npm run db:reset`.
The cleanup scheduler tests require an isolated fixture database. A quiet server alone is insufficient when existing upload embargoes have expired.
Use a separate disposable Supabase project when the normal local stack contains browser acceptance data. Do not reset shared data to make tests pass.
Obtain explicit approval before deleting local database data.
Record the reset command's exit status, not only its migration and seed output.
Do not retry a blocked reset without the required approval.
Never reset or seed production.

Run affected tests first.
Then run type checks, lint, Vitest, and the production build.
Run database checks for database, authentication, or storage changes.
Test affected behavior in both site modes.
Keep credential-dependent skips explicit in HANDOFF.

Vitest uses one isolated fork worker on Windows and four on other hosts.
These limits do not remove tests or change their assertions or timeouts.
Database-backed tests fail when fixture cleanup fails.
Do not treat a cleanup error as a passing test run.

CI also runs this selection against its local Supabase stack:

```powershell
npx vitest run src/lib/esign src/app/api/pandadoc src/lib/storage-cleanup src/lib/admin/partners.test.ts
```

Supply only local database credentials when running that selection.
Normal test discovery does not require `.env.local`.

Live PandaDoc tests stay disabled unless the invoking shell sets `PANDADOC_LIVE_DRAFT_TEST=1`.
They also require `PANDADOC_API_KEY` and `PANDADOC_DRAFT_TEST_EMAIL`.
An approved live test can load credentials from an optional `.env.local`.
It creates a real draft and must not run automatically.
See [PandaDoc setup](docs/temp/PANDADOC_SETUP.md) for the separate approval and test procedure.

## Database types

`npm run db:types` writes the Supabase CLI output to [src/types/database.ts](src/types/database.ts).
Keep that file as raw generator output.
Do not hand-edit it.

Application `Database` imports use [src/types/database-app.ts](src/types/database-app.ts).
This module adds narrow nullability contracts that the generated SQL function types omit.
It preserves all other generated fields and optional arguments.

| SQL function | Application override |
|---|---|
| `accept_intake_transaction` | Nullable optional intake facts, partner fields, and status note |
| `enqueue_storage_cleanup_exact` | Nullable claim ID before a claim exists |
| `issue_invite_transaction` | Nullable claim and partner-company targets according to the invite role |
| `staff_claims_projection` | Nullable assignment IDs and names returned through left joins |
| `submit_claim_transaction` | Nullable audit and partner-company arguments |

After a schema change, regenerate the raw types.
Check each override against the current SQL contract and its database tests.
Remove an override only when generated types represent that contract correctly.
Do not widen unrelated types to make compilation pass.
Run type-check, scoped lint, and affected tests after an override change.

## Browser check safeguards

Assert the expected local URL before each local browser form action.
Obtain approval before hosted submissions, including empty forms.
An empty hosted submission can still write a rate-limit record before validation fails.
Do not bypass CAPTCHA to complete acceptance checks.

Record a fresh navigation timestamp before collecting browser logs.
Filter console and network evidence by that timestamp and route.
Earlier Preview errors can remain visible during local page evaluation.
Do not describe a browser console as clean without checking that scope.

## Repository layout and records

| Path | Purpose |
|---|---|
| `src/app/` | Public, authentication, admin, customer, partner, and API routes |
| `src/components/` | Shared and surface-specific components |
| `src/lib/` | Actions, validation, authorization, email, storage, and e-signature |
| `supabase/` | Migrations, local seed data, and pgTAP tests |
| `design/` | Design reference material |
| `docs/` | Product and release records |

Current code, tests, manifests, and configuration override older design records.
[RELEASE_STATE.md](docs/RELEASE_STATE.md) records the current release state.
[ROADMAP.md](docs/ROADMAP.md) records design direction and history.
[RETENTION.md](docs/RETENTION.md) separates implemented cleanup from proposed retention policy.
The [original platform plan](.claude/plans/feature-claims-platform.md) and older progress records provide history.

<a id="simple-mode-production-runbook"></a>

## Production runbook

`develop` is the integration and production branch.
Verify the current Vercel branch connection before release.
Do not assume that a merge leaves Production unchanged.
A merge can start deployment automatically.

Preview branches can override `SITE_MODE` separately from Production.
Verify the effective mode with normal page requests before acceptance.
Simple-mode private routes must redirect to `/platform-disabled`.
A login page or expired-invite page means private entry remains available.
Obtain approval before changing the Preview environment or redeploying it.

Turnstile `110200` means the deployment hostname is not authorized.
See [Cloudflare's error-code reference](https://developers.cloudflare.com/turnstile/troubleshooting/client-side-errors/error-codes/).
Resolve hostname configuration through approved Cloudflare access before hosted form acceptance.
Do not replace production protection with test keys.

Vercel's [fair-use rules](https://vercel.com/docs/limits/fair-use-guidelines) require Pro or Enterprise for commercial use.
Use Vercel Pro for CMG after purchase approval.
Confirm that the approved commercial plan is active before commercial launch.
The plan recommendation does not authorize a purchase.
This requirement is separate from GitHub's private-repository protection plan.
A plan upgrade does not remove Vercel's 4.5 MB request limit.

1. Read RELEASE_STATE for the current candidate and open gates, then HANDOFF for the supporting evidence.
2. Complete local checks and browser acceptance at 320px, 390px, and desktop width.
3. Repeat public-route acceptance against the latest Preview.
4. Verify private-route closure, public form states, keyboard access, console output, and network requests.
5. Obtain legal approval for public copy, forms, privacy terms, and consent text.
6. Verify live Turnstile configuration for the final hostname.
7. Verify Resend, the sending domain, email DNS, `EMAIL_FROM`, and `EMAIL_STAFF_INBOX`.
8. Verify domain DNS, TLS, redirects, `CRON_SECRET`, backups, PITR, and the recovery procedure.
9. Resolve release blockers before merge or deployment approval.

The advertised upload allowance remains ten files of 25 MiB each.
The Server Action receives text fields and a small file manifest only.
The browser uploads file bytes directly to private Supabase Storage with one-time signed capabilities.
The server copies each upload to an immutable document path, verifies its signature, and then commits the claim.
The implementation and local Storage tests preserve the ten-file and 25 MiB limits.
Check HANDOFF for hosted migration and configuration evidence. Maximum-size hosted acceptance remains release work.
See [Vercel function limits](https://vercel.com/docs/functions/limitations).

Supabase [signed upload URLs](https://supabase.com/docs/reference/javascript/file-buckets-createsigneduploadurl) remain valid for two hours.
Cleanup retains both exact paths through the upload expiry and reconciles late objects after each sweep.

10. Compare hosted migration history with every repository migration.
11. Record the hosted and repository migration heads in RELEASE_STATE.
12. Record the owner's recovery decision and obtain approval for each production write.
13. Create backups only when the owner approves them.
14. Verify available recovery coverage and record any unverified restore capability.
15. Apply only the approved forward migrations to the verified hosted project.
16. Verify schema, RLS, grants, and public workflows after migration.

The owner declined a Supabase backup for the six migrations applied on 2026-09-13 and four applied on 2026-09-16.
Do not create a backup under the current authorization.
Those approved migrations use reviewed forward repair as the recovery path; immediate restore readiness remains unverified.
Database backups do not include Storage file contents. A future approved backup plan must address those objects separately.
See [Supabase backup scope](https://supabase.com/docs/guides/platform/backups).
Never run `supabase/seed.sql` or `db:reset` against production.

17. Obtain separate approval for the commit.
18. Obtain separate approval for the push.
19. Require green `verify`, `database`, and Vercel checks on the current PR head.
20. Confirm that the head build completes.
21. Obtain approval before changing the PR description.
22. Review the final remote diff.
23. Obtain approval before changing branch protection.
24. Require `verify`, `database`, and Vercel checks on `develop`.
25. Obtain separate merge and deployment approvals after all prerequisites pass.
26. Obtain separate approval for domain changes.

If repository settings cannot enforce required checks, record that release blocker.
Do not describe manual checks as branch protection.
Approval for one Git or production action does not approve another action.

27. Verify the approved `SITE_MODE` in the release environment. Production currently uses `staff`.
28. Redeploy after changing Vercel environment values.
29. Confirm that Production uses the merged commit and intended environment.
30. Verify approved public submissions, confirmation emails, staff alerts, queues, crons, logs, DNS, TLS, and redirects.
31. Record all results and rollback information in HANDOFF.

Environment changes apply to new deployments.
They do not change existing deployments.
See [Vercel environment variables](https://vercel.com/docs/environment-variables).

## Contractor intake and vendor links

The public intake separates homeowner details from optional contractor name, company, phone, and email.
The homeowner must give the displayed consent. Contractor details do not replace homeowner identity or consent.
The form asks for loss date and cause, but no longer asks for loss time.
Valid times from older clients remain supported. Omitted times are stored as null.

Each partner company has a unique public intake link. Owners can copy it from the company detail page in platform mode.
Links use `NEXT_PUBLIC_SITE_URL`; verify that this value identifies the intended public environment.
No additional environment variable or vendor-specific form is required.
The server resolves the link code after rate limits, Turnstile, and input validation.
Invalid links and inactive vendors cannot start a reservation. Direct intake without a link remains available.

Referral attribution is internal metadata. It does not assign partner access or disclose other vendors.
Possession of a link does not prove the submitter works for that vendor.
Contractor contact fields and public partner IDs cannot override the server mapping.
An existing immutable upload reservation retains its source during its normal lifetime.

Apply any new schema migrations before deploying code that reads their columns.
Old submission functions can ignore new contractor fields, so an application-first deployment risks incomplete records.
Retain the added columns during application rollback. Use reviewed forward repair for database corrections.
See [the intake acceptance record](docs/temp/INTAKE_VENDOR_ACCEPTANCE.md) for migration order and verification limits.

## Cron operation

[vercel.json](vercel.json) defines these daily schedules:

| Route | Scheduled time |
|---|---|
| `/api/cron/outbox` | 14:00 UTC |
| `/api/cron/storage-cleanup` | 14:17 UTC |

Both routes require `CRON_SECRET`.
The outbox attempts delivery after a public submission commits.
The daily sweep retries queued public messages in simple mode.
Private-platform email templates remain excluded.

Daily schedules can delay retries and cleanup until a later day.
A backlog can need several daily batches.
Short retry intervals do not create additional cron executions.
Hobby scheduling does not guarantee the configured minute.
See [Vercel cron limits](https://vercel.com/docs/cron-jobs/usage-and-pricing).

Record queue age, failed rows, dead rows, and approved recovery actions.
Do not delete unresolved queue records.

## Recovery order

1. Record the failed deployment, affected operations, and last verified recovery point.
2. Obtain approval before disabling production submissions, cron jobs, or provider writes.
3. Stop affected writes before restoring data.
4. Restore the last verified application deployment that supports the current schema.
5. Keep forward migrations unless an approved recovery procedure requires a data restore.
6. Restore database data and Storage objects together when data recovery is required.
7. Verify environment values and secrets on the selected deployment.
8. Recheck active cron schedules and authorization before enabling jobs.
9. Verify schema, public forms, email, queues, logs, DNS, TLS, and redirects.
10. Reconcile uncertain provider outcomes before retrying external sends.
11. Obtain approval before reopening paused production operations.

A Vercel Instant Rollback does not update active cron jobs.
Check them separately after every rollback.
See [Vercel cron rollback behavior](https://vercel.com/docs/cron-jobs/manage-cron-jobs).
A data restore can remove changes after the recovery point.
Never use a destructive schema rollback as an automatic recovery step.

## Later platform activation

Keep platform mode disabled until CMG approves activation.
Before activation, verify owner MFA, AAL2 enforcement, roles, customer isolation, partner isolation, storage access, and invitation recovery.
Require hosted integration checks for e-signature, webhooks, retries, and cleanup.
Verify both bundled LOR PDFs and the `H1` / `H2` signer mapping.
Template UUIDs are not required by the current PDF upload flow.

Retention automation, export, erasure, and legal holds require separate implementation and approval.
Public legal approval remains a simple-mode launch prerequisite.
See [PandaDoc setup](docs/temp/PANDADOC_SETUP.md) and [RETENTION.md](docs/RETENTION.md).
