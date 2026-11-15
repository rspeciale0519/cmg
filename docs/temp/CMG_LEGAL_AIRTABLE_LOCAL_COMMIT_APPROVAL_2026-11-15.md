# Local commit approval — legal handoff and Airtable

Prepared November 15, 2026. This record grants no approval.
The final source passed its required local checks. The exact file list contains 123 files.

## Exact action

Create one local commit on `codex/cmg-law-firm-airtable`.
Use title `Add legal handoffs and optional Airtable updates`.
The current parent is `d685032736260b1eaca57045def9edbd677da93e`.
Repository: `rspeciale0519/cmg`.
Checkout: `C:/Users/rob/.codex/visualizations/2026/11/01/01a19512-82bb-71a2-8d71-83374c0d0f60/cmg-law-firm-airtable`.

Stage only the files listed below after approval.
Do not push, create a pull request, merge, deploy, change hosted settings, or run hosted tests.
Keep the original checkout, existing branches, browser logins, retained data, and packages unchanged.
Keep cleanup blocked. Create no backup. Change no DNS, hosting plan, or account ownership.

The local helpers below remain outside the commit. Retain both files:

- `scripts/prepare-legal-airtable-db.ps1`
- `scripts/prepare-legal-airtable-browser.mjs`

## Completed verification

- Final full unit suite: 2,033 passed; 77 skipped; zero failed; exit zero. All 179 discovered files were accounted for.
- Baseline database SQL: 1,554 assertions passed across 48 files. The final forward repair then passed 105 affected assertions across two files.
- Database-backed CI selection: 279 passed; one live PandaDoc test skipped.
- Final concurrent database selection: ten passed; zero skipped.
- TypeScript, full and final scoped lint, application build, and diff checks passed.
- High-threshold dependency audit passed; four low and eight moderate findings remain.
- Actual local browser checks passed for five roles, three site modes, desktop and 390px screens.
- Legal package download preserved original PDF bytes and did not mark the package sent.
- Local milestone history, return-stage selection, permissions, error states, and retained form values passed.
- The final customer reload captured 28 HTTP 200 responses and no failed requests.

The credential-free unit suite skips explicit database and live-provider selections.
Database selections were run separately as recorded above.
One earlier JSON-only full run exited 1 and omitted a file. Its 34 tests passed separately and in the final complete run.
The original runtime cause remains unknown; the successful complete run supersedes it for this source.
Real Airtable OAuth and delivery, hosted migrations, hosted acceptance, and deployment remain unverified.
No feature commit or hosted action has run.

## Risks and recovery

The source adds 15 forward database migrations and a new claim stage.
The old application may not support records that use that stage after deployment.
Prefer a reviewed forward repair. Do not remove history or reverse migrations to recover.
Incorrect Airtable mappings can send selected claim data to the wrong external record.
Airtable remains disabled until exact setup and test approval.
A pause cannot undo an external write or reliably stop an already active request.

All three approved local resets are used. Retain the new database and its synthetic records.
The local commit does not apply migrations to a hosted database.
Use `CMG_LEGAL_AIRTABLE_RELEASE_APPROVAL_2026-11-15.md` for later approval boundaries.

## Exact file list

File count: 123.

- `.env.example`
- `docs/RELEASE_STATE.md`
- `docs/temp/AIRTABLE_IMPLEMENTATION_REPORT_2026-11-15.md`
- `docs/temp/CMG_ISOLATED_CI_DB_RUNNER_2026-11-15.md`
- `docs/temp/CMG_LAW_FIRM_AIRTABLE_CONTRACT_2026-11-15.md`
- `docs/temp/CMG_LAW_FIRM_AIRTABLE_IMPLEMENTATION_2026-11-15.md`
- `docs/temp/CMG_LEGAL_AIRTABLE_ACTUAL_BROWSER_2026-11-15.md`
- `docs/temp/CMG_LEGAL_AIRTABLE_BROWSER_REVIEW_2026-11-15.md`
- `docs/temp/CMG_LEGAL_AIRTABLE_DISPOSABLE_DB_APPROVAL_2026-11-15.md`
- `docs/temp/CMG_LEGAL_AIRTABLE_LOCAL_COMMIT_APPROVAL_2026-11-15.md`
- `docs/temp/CMG_LEGAL_AIRTABLE_RELEASE_APPROVAL_2026-11-15.md`
- `docs/temp/CMG_LOCAL_APP_RUNNER_2026-11-15.md`
- `docs/temp/CMG_LOCAL_BROWSER_FIXTURE_METHOD_2026-11-15.md`
- `docs/temp/DB_POLICY_PREPARATION_REPORT_2026-11-15.md`
- `docs/temp/HANDOFF.md`
- `docs/temp/LEGAL_IMPLEMENTATION_REPORT_2026-11-15.md`
- `package-lock.json`
- `package.json`
- `README.md`
- `src/app/(admin)/admin/claims/[id]/activity/page.tsx`
- `src/app/(admin)/admin/claims/[id]/financials/page.tsx`
- `src/app/(admin)/admin/claims/[id]/layout.tsx`
- `src/app/(admin)/admin/claims/[id]/legal/page.tsx`
- `src/app/(admin)/admin/claims/[id]/page.tsx`
- `src/app/(admin)/admin/claims/[id]/sharing/page.tsx`
- `src/app/(admin)/admin/intake/page.tsx`
- `src/app/(admin)/admin/partners/[id]/airtable/page.tsx`
- `src/app/(admin)/admin/partners/[id]/page.tsx`
- `src/app/(admin)/admin/partners/page.tsx`
- `src/app/(customer)/portal/claims/[id]/page.tsx`
- `src/app/(marketing)/privacy/page.tsx`
- `src/app/(marketing)/terms/page.tsx`
- `src/app/api/cron/airtable/route.ts`
- `src/app/api/integrations/airtable/callback/route.ts`
- `src/components/admin/airtable-claim-forms.tsx`
- `src/components/admin/airtable-company-form.tsx`
- `src/components/admin/airtable-forms.test.tsx`
- `src/components/admin/airtable-pause-form.tsx`
- `src/components/admin/legal-handoff-forms.test.tsx`
- `src/components/admin/legal-handoff-forms.tsx`
- `src/components/admin/legal-package-download.test.tsx`
- `src/components/admin/legal-package-download.tsx`
- `src/components/admin/retain-form-inputs.ts`
- `src/components/marketing/policy-page.tsx`
- `src/components/portal/legal-progress.test.tsx`
- `src/components/portal/legal-progress.tsx`
- `src/lib/actions/airtable-claim.test.ts`
- `src/lib/actions/airtable-pause.test.ts`
- `src/lib/actions/airtable-pause.ts`
- `src/lib/actions/airtable.ts`
- `src/lib/actions/claim-feed-financial-actions.ts`
- `src/lib/actions/claim-policy.test.ts`
- `src/lib/actions/claims.ts`
- `src/lib/actions/intake-queue.ts`
- `src/lib/actions/legal-package-files.test.ts`
- `src/lib/actions/legal-package-files.ts`
- `src/lib/actions/legal.test.ts`
- `src/lib/actions/legal.ts`
- `src/lib/airtable/action-state.ts`
- `src/lib/airtable/client.test.ts`
- `src/lib/airtable/client.ts`
- `src/lib/airtable/concurrency-test-support.ts`
- `src/lib/airtable/concurrency.local.test.ts`
- `src/lib/airtable/config.ts`
- `src/lib/airtable/crypto.test.ts`
- `src/lib/airtable/crypto.ts`
- `src/lib/airtable/delivery.test.ts`
- `src/lib/airtable/delivery.ts`
- `src/lib/airtable/fields.ts`
- `src/lib/airtable/mapping.test.ts`
- `src/lib/airtable/mapping.ts`
- `src/lib/airtable/oauth.test.ts`
- `src/lib/airtable/oauth.ts`
- `src/lib/airtable/parse.ts`
- `src/lib/airtable/queries.ts`
- `src/lib/airtable/store.ts`
- `src/lib/claims/status.test.ts`
- `src/lib/claims/status.ts`
- `src/lib/intake/test-fixtures.test.ts`
- `src/lib/intake/test-fixtures.ts`
- `src/lib/legal/package-file-reader.test.ts`
- `src/lib/legal/package-file-reader.ts`
- `src/lib/legal/package-summary.test.ts`
- `src/lib/legal/package-summary.ts`
- `src/lib/legal/package.test.ts`
- `src/lib/legal/package.ts`
- `src/lib/legal/parse.ts`
- `src/lib/legal/queries.ts`
- `src/lib/legal/types.ts`
- `src/lib/legal/validation.test.ts`
- `src/lib/legal/validation.ts`
- `src/lib/policies/availability.test.ts`
- `src/lib/policies/availability.ts`
- `src/lib/policies/content.ts`
- `src/lib/policies/routes.test.tsx`
- `src/lib/portal/legal-progress.test.ts`
- `src/lib/portal/progress.ts`
- `src/lib/security/csp.ts`
- `src/proxy.test.ts`
- `src/proxy.ts`
- `src/types/database-app.ts`
- `src/types/database.ts`
- `supabase/migrations/20261115010000_legal_claim_status.sql`
- `supabase/migrations/20261115011000_legal_handoff_schema.sql`
- `supabase/migrations/20261115011100_legal_handoff_actions.sql`
- `supabase/migrations/20261115011200_legal_transition_enforcement.sql`
- `supabase/migrations/20261115011300_legal_representation_retention.sql`
- `supabase/migrations/20261115011400_legal_policy_identity.sql`
- `supabase/migrations/20261115020000_airtable_schema.sql`
- `supabase/migrations/20261115020100_airtable_capture.sql`
- `supabase/migrations/20261115020200_airtable_controls.sql`
- `supabase/migrations/20261115020300_airtable_delivery.sql`
- `supabase/migrations/20261115020400_airtable_oauth.sql`
- `supabase/migrations/20261115020500_airtable_pause.sql`
- `supabase/migrations/20261115030000_legal_airtable_foreign_key_indexes.sql`
- `supabase/migrations/20261115031000_legal_after_lock_authority.sql`
- `supabase/migrations/20261115032000_airtable_record_proof_guard.sql`
- `supabase/tests/00_schema.test.sql`
- `supabase/tests/01_claim_ref_and_status.test.sql`
- `supabase/tests/46_legal_handoffs.test.sql`
- `supabase/tests/47_airtable.test.sql`
- `supabase/tests/48_airtable_record_proof.test.sql`
- `vercel.json`
