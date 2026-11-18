# CMG Property Solutions

CMG runs a public marketing site and a private claims platform.
Production runs `SITE_MODE=platform` on `app.cmgpropertysolutions.net`.
This mode opens the public site, the staff desk, the customer portal, the partner portal, and invitation redemption.
The owner switched Production from `staff` to `platform` on 2026-10-07 after hosted invitation acceptance.
Check [RELEASE_STATE.md](docs/RELEASE_STATE.md) before changing the Production mode.

[RELEASE_STATE.md](docs/RELEASE_STATE.md) is the current release record.
It contains production facts, open pull requests, migration heads, environment facts, open gates, and the ordered next steps.
[HANDOFF.md](docs/temp/HANDOFF.md) contains engineering evidence and acceptance checklists.
[BLOCKERS.md](docs/temp/BLOCKERS.md) lists owner-controlled decisions.

## Stack and local setup

Use Node.js 22 and npm.
`package-lock.json` controls installed dependency versions.
The application uses Next.js 16.4, React 19, TypeScript, Tailwind CSS, Supabase, Resend, PandaDoc, and Turnstile.

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

Use [AGENTS.md completion checks](AGENTS.md#completion-checks) to select the required checks for the change.
The application supports `simple`, `staff`, and `platform` site modes.
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

Outbox email uses `EMAIL_FROM` as the sender.
The server sets `Reply-To` to `collin@cmgpropertysolutions.net`.
This fixed value needs no environment variable.
Delivery recipients and staff recipient checks remain separate.

The advertised upload allowance remains ten files of 25 MiB each.
The Server Action receives text fields and a small file manifest only.
The browser uploads file bytes directly to private Supabase Storage with one-time signed capabilities.
The server copies each upload to an immutable document path, verifies its signature, and then commits the claim.
Staff and homeowner document uploads use the same pattern with `private_upload_sessions`.
Their Server Actions reserve paths and confirm the upload; the browser sends the file bytes directly to Storage.
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

27. Verify the approved `SITE_MODE` in the release environment. Production currently uses `platform`.
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

[vercel.json](vercel.json) defines these schedules for deployment:

| Route | Schedule |
|---|---|
| `/api/cron/outbox` | Daily at 14:00 UTC (`0 14 * * *`) |
| `/api/cron/storage-cleanup` | Daily at 14:17 UTC (`17 14 * * *`) |
| `/api/cron/airtable` | Daily at 15:15 UTC (`15 15 * * *`), when Airtable is enabled |

All three routes require `CRON_SECRET`.
The outbox attempts delivery after a public submission commits.
The daily sweep retries eligible queued messages that the current site mode permits.
Simple mode delivers only the public-form templates. Staff mode adds the staff-alert templates.
Platform mode delivers every template.

Retry delays are minimum waits of 1, 5, 25, and 125 minutes.
An eligible retry waits for a later sweep and available batch space.
Daily batches can delay retries until later days, so these delays do not promise a delivery time.
A backlog can need several daily sweeps.
The unchanged default seven-day age limit can stop old messages.
The fifth failed attempt marks a message dead.
Each sweep claims at most 12 messages and sends at most three concurrently.
The claim lease remains 300 seconds.

The daily schedule meets Hobby's frequency limit only.
Hobby can start this job between 14:00 and 14:59 UTC.
The separate commercial-use requirement in this runbook remains in force.
Any schedule change requires separate deployment approval.
See [Vercel cron limits](https://vercel.com/docs/cron-jobs/usage-and-pricing).

Storage cleanup remains blocked. Its daily schedule remains unchanged.
Do not run these jobs manually without approval.
Daily cleanup batches can delay cleanup retries until later days.
Keep uncertain sends and held notifications blocked until their required review is complete.
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

<a id="later-platform-activation"></a>

## Platform activation

The owner activated `SITE_MODE=platform` in Production on 2026-10-07.
Hosted acceptance before and after the switch covered owner MFA, staff and vendor invitations, homeowner invitations, and role isolation.
See RELEASE_STATE for the current open gates and HANDOFF for the evidence.
Keep checking AAL2 enforcement, customer isolation, partner isolation, storage access, and invitation recovery after each release.
Hosted e-signature, retry, and cleanup checks remain release work.
Verify both bundled LOR PDFs and the `H1` / `H2` signer mapping.
Template UUIDs are not required by the current PDF upload flow.

Retention automation, export, erasure, and legal holds require separate implementation and approval.
Public legal approval remains a launch prerequisite.
See [PandaDoc setup](docs/temp/PANDADOC_SETUP.md) and [RETENTION.md](docs/RETENTION.md).

## Legal handoff and optional Airtable sharing

These additions are local candidate work. See the [implementation record](docs/temp/CMG_LAW_FIRM_AIRTABLE_IMPLEMENTATION_2026-11-15.md) for validation and approval limits.

The Legal handoff tab is for the Owner and the claim's assigned adjuster.
A represented, active claim can move to the optional With law firm stage after staff confirm that the package was sent.
Preparing or downloading a package does not record sending.
Staff select the summary and original documents. Each ZIP part contains at most 100 MiB of selected original files, plus its summary and manifest.
The package includes a PDF summary and an exact UTF-8 text copy.
Staff send it outside CMG and record the actual milestone afterward.
An unsent preparation can be cancelled. Its evidence remains stored.
No law firm login is created. Homeowners see the milestones and the accepted firm's contact details.
Milestone notices use the existing email queue and site-mode rules.

Airtable sharing is optional for every referring company. Direct homeowner claims need no connection.
An Owner connects Airtable from the company page and selects an existing base, table, and reserved CMG columns.
The Owner or assigned adjuster confirms an exact existing record from the claim's Sharing tab.
The first update requires review. CMG does not create an Airtable record or change its schema.
Choose automatic selected updates, review every update, or automatic stages with review for other information.
Internal notes, internal fees, files, photos, credentials, and file-access links are excluded.
Shared messages keep their dated history. There is no Airtable-to-CMG import.

Set these values only under a separate hosted configuration approval:

- `AIRTABLE_ENABLED=true`, with `SITE_MODE=platform`, permits delivery.
- `AIRTABLE_CLIENT_ID` and `AIRTABLE_CLIENT_SECRET` identify the registered OAuth integration.
- `AIRTABLE_REDIRECT_URI` must match its HTTPS callback, ending in `/api/integrations/airtable/callback`.
- `AIRTABLE_TOKEN_ENCRYPTION_KEY` is a stable base64-encoded 32-byte secret. Keep it server-side.

The OAuth scopes are `data.records:read`, `data.records:write`, and `schema.bases:read`.
Register the approved support contact, Privacy URL, and Terms URL before public integration use.
The policy pages return 404 until publication approval is configured.
`CMG_POLICY_DRAFTS=true` displays drafts only in local development, outside Vercel.
`CMG_PUBLIC_POLICIES_APPROVED=2026-11-15` publishes this reviewed policy version. Setting it requires separate approval.

Source changes create durable update requests in the same database transaction.
Successful application saves attempt immediate delivery. The daily Airtable job recovers eligible requests.
Daily recovery can delay a failed update until a later day. A large queue can need more than one daily run.
Review uncertain outcomes, changed access, changed columns, and unexpected record edits before retrying.
Do not release old held updates merely because the company mode changed.
The [Vercel cron limits](https://vercel.com/docs/schedules/cron-jobs/usage-and-pricing) allow daily schedules on Hobby; function usage and commercial-use requirements still apply.
The [Airtable OAuth reference](https://airtable.com/developers/web/api/oauth-reference) defines the required scopes, callback registration, and public policy links.

Apply additive schema changes before the compatible application release, under exact approval.
Keep Airtable disabled until configuration and a synthetic acceptance check pass.
The main risks are incorrect external sharing, lost encryption access, stale updates, and incomplete legal milestone records.
Recovery uses approved pause controls, retained queue/history records, external-result reconciliation, and reviewed forward repairs.
Keep the encryption key available for retained tokens. Do not replace it without a reviewed rotation procedure.
After a claim uses `with_law_firm`, do not roll back to code that cannot read that status.
Keep all new schema and retained evidence during application recovery.
No hosted reset, cleanup, backup, real-company connection, or production acceptance test is authorized by this runbook.

The existing local databases contain retained acceptance records.
Use only the separately approved [isolated database scope](docs/temp/CMG_LEGAL_AIRTABLE_DISPOSABLE_DB_APPROVAL_2026-11-15.md) for new reset-based checks.
Do not run the default reset or type-generation command against a retained database.
