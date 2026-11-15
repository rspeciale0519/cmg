# Disposable database approval scope

Prepared November 15, 2026. The user approved this exact scope on November 15, 2026.
Execution is limited to the new project and at most three resets recorded below.

## Execution ledger

- Approval received: “Approve this isolated local database scope”.
- Final combined ESLint from the preceding task completed with exit code zero.
- Fresh preflight found no target directory, target container, or target volume.
- Existing CMG database containers were inspected without changes. Their retained state remains outside this approval.
- New-project startup passed. All candidate migrations and synthetic seed loaded.
- Verified the exact new project labels, healthy database, API port 15621, DB port 15622, and new-project database volumes.
- Reset 1 of 3 passed with exit code zero. No retained database was reset.
- First pgTAP run: 48 files, 1,554 assertions, one failure. The existing foreign-key index check identified 14 missing indexes on new tables.
- Both new legal and Airtable SQL files passed their assertions in that run.
- Added forward migration `20261115030000_legal_airtable_foreign_key_indexes.sql`. Existing migrations remain unchanged.
- Reset 2 of 3 passed with exit code zero.
- Second full pgTAP run passed: 48 files and 1,554 assertions, exit code zero.
- Raw database types generated successfully from this exact stack. The source file is the unmodified CLI output.
- Generated types SHA-256: `947603FD55F2AC91B40404519A4BA18D0E981BECED96AD1A983F6D019257A9D3`.
- Nullable SQL argument contracts belong in `src/types/database-app.ts`; no generated type was hand-edited.
- Independent review identified three legal authority checks before lock waits. The regression run reproduced all three failures; its three Airtable tests passed.
- Added forward migration `20261115031000_legal_after_lock_authority.sql`. Existing migrations and RPC signatures remain unchanged.
- A Docker label-format guard failed before staging or reset. The corrected identity read passed. No reset was issued by that failed guard.
- Reset 3 of 3 passed. The full baseline pgTAP run passed all 1,554 assertions across 48 files.
- The reset replaced the DB container. A stale-ID guard stopped the app launcher before any build or API read.
- Fresh verified DB ID: `2667e0b4c1ccc6d782eb4d4ec2cc54bf628d8623efaf4a29e8a2ffe39720328d`. Project labels, work directory, and ports remain correct.
- The concurrent selection after reset 3 passed seven tests with zero failures or skips. It includes three legal after-lock refusals and four Airtable authority/order/worker checks.
- Resets issued: 3 of 3. All passed. No reset allowance remains. Retain the new database.
- The first database-backed Vitest attempt stopped during sandbox preflight. No test ran. The same exact Docker identity read passed outside that sandbox.
- The corrected runner reports the failing command phase without printing credentials. The database-backed run passed 279 tests and skipped only the live PandaDoc test.

## Incremental record-proof repair after reset 3

Final review found that an Airtable configuration could change while a claim-record confirmation waited.
The repair binds the final save to the reviewed connection and configuration under a database lock.
It also checks current authority and company status after that wait.

- Added forward migration `20261115032000_airtable_record_proof_guard.sql` without changing any prior migration.
- The first incremental inspection stopped because the runner's configuration-hash literal contained one extra `a`.
- The actual configuration and original staging manifest were unchanged. That failed inspection performed no mutation.
- Root corrected only the runner literal. The next inspection and staging passed.
- All 51 prior migration hashes matched their original staged hashes before the upgrade.
- The exact local `migration up` operation applied only version `20261115032000` at `2026-11-15T18:31:01Z`.
- Applied migration SHA-256: `f002cb35cfdd89a01052913a8aa8b4f6edec4294631e8d61e89dc78c15eb426b`.
- Targeted SQL files `47_airtable.test.sql` and `48_airtable_record_proof.test.sql` passed all 105 assertions across two files.
- The expanded concurrency selection passed all ten cases, with zero failures or skips.
- The three new cases check configuration change, Owner access loss, and company deactivation while claim confirmation waits.
- No reset followed reset 3. The local browser fixtures and earlier synthetic records remain.
- Raw database type regeneration after this repair passed. Its output is identical to the application source.
- Regenerated SHA-256: `947603fd55f2ac91b40404519a4ba18d0e981beced96ad1a983f6d019257a9d3`.
- Raw output is retained as `database-after-320-1794767695985.ts` in the scratch runner directory. No source replacement or manual type edit occurred.

The full baseline result remains 48 files and 1,554 assertions.
The later targeted result is two files and 105 assertions.
These are separate runs. No combined 49-file run is claimed.

A new reset was unnecessary for this forward function repair.
Reset 3 already verified the unchanged migration chain.
The incremental application verified the new upgrade against that chain and preserved the acceptance records.
All three reset allowances remain used. Another reset requires new approval.

The scratch runner and proof records are under:

`C:/Users/rob/.codex/visualizations/2026/11/01/01a19512-82bb-71a2-8d71-83374c0d0f60/cmg-law-firm-airtable-db-runner`

- `incremental-runner.mjs`: exact local identity, prior-hash, phase, and history checks.
- `INCREMENTAL-320-STAGED.json`: hashes for the one new migration and two SQL test files.
- `INCREMENTAL-320-ATTEMPT.json`: the single recorded migration attempt.
- `INCREMENTAL-320-APPLIED.json`: the successful application time and migration hash.
- `database-after-320-1794767695985.ts`: raw regenerated types, identical to `src/types/database.ts`.

The original `cmg-law-firm-airtable-db/STAGING-MANIFEST.json` remains unchanged.
The runner permits only `inspect`, `stage`, `migrate`, `test`, and `types` phases.
It has no reset, seed, delete, or hosted-project operation.
No credentials were printed or written to these proof records.

## Exact target

- Source checkout: `C:/Users/rob/.codex/visualizations/2026/11/01/01a19512-82bb-71a2-8d71-83374c0d0f60/cmg-law-firm-airtable`.
- New database work directory: `C:/Users/rob/.codex/visualizations/2026/11/01/01a19512-82bb-71a2-8d71-83374c0d0f60/cmg-law-firm-airtable-db`.
- Supabase project ID: `CMGPA_legal_airtable_disposable`.
- Ports: `15620–15629`. API: `15621`. Postgres: `15622`.
- Expected database container: `supabase_db_CMGPA_legal_airtable_disposable`.
- Supabase executable: `C:/Users/rob/scoop/apps/supabase/2.116.0/supabase.exe`.
- Node executable: the verified portable Node 22.22.2 in this chat's scratch directory.

The retained `CMGPA` project uses `15420–15429`.
The retained `CMGPA_private_upload_disposable` project uses `15520–15529`.
Neither retained project is included in this approval.

## Read-only preparation result

The new project has no matching Docker container or named volume.
Ports `15620–15629` have no listener at the preparation check.
Both retained CMG database containers are running.
The pinned CLI reports version `2.116.0`.

Initial sandbox checks could not inspect Docker or Windows network resources.
The subsequent read-only checks with required local access succeeded.
No database connection, SQL query, service start, reset, or removal ran.

## Requested operations

1. Recheck the exact new name, directory, and ports immediately before setup.
2. Stage the candidate migrations, seed, SQL tests, and test includes with `scripts/prepare-legal-airtable-db.ps1`.
3. Record source-file hashes in the staging manifest.
4. Start this new local project with the pinned CLI. Required local container images may download.
5. Verify its project identity, exact container, and port bindings before any reset or test.
6. Run at most three resets of this new project while fixing failed migrations or local checks.
7. Run its pgTAP tests and the applicable database-backed application tests.
8. Generate database types from this exact work directory.
9. Replace the new checkout's generated `src/types/database.ts` only after generation succeeds.
10. Retain the new project and its remaining synthetic data after testing.

Local tests can create synthetic accounts, claims, documents, history, queued notices, and update requests.
Tests can roll back transactions and remove only their own recorded synthetic fixtures in this new project.
The reset allowance can erase this new project's synthetic data. It cannot erase retained data in either older project.
No real email worker, PandaDoc request, Airtable request, or hosted application test is included.

## Execution restrictions

- Do not copy `.env`, `.env.local`, linked-project files, hosted credentials, or old database volumes.
- The staged configuration has a new project ID and port block. Provider environment bindings are blank.
- Studio and the edge runtime stay disabled. Local authentication email remains inside the local email-capture service.
- Keep Resend, PandaDoc, real Airtable, and hosted Supabase credentials absent from test processes.
- Confirm staged migrations do not enable scheduled requests to hosted services before starting the project.
- Test requests must use the new loopback API and the verified new local container.
- Do not run bare `npm run db:reset` or `npm run db:types`; they use the ordinary checkout configuration.
- Do not run `supabase link`, `db push`, remote reset, backup, stop-all, prune, or volume removal.
- Keep the hosted cleanup deny enabled. Do not run hosted cleanup.
- Preserve every browser login, existing server, and unrelated Docker project.
- Stop on a name/port mismatch, unexpected existing target, or inability to prove isolation.
- Stop after the third failed reset cycle. A larger reset allowance needs new approval.

## Historical setup commands

These commands describe the completed setup. All three reset allowances are used.
Do not run another reset under this approval.

Use the fixed executable and explicit work directory for every command:

```text
supabase.exe start --workdir <exact-new-work-directory>
supabase.exe db reset --local --workdir <exact-new-work-directory>
supabase.exe test db --local --workdir <exact-new-work-directory>
supabase.exe gen types typescript --local --workdir <exact-new-work-directory>
```

Capture type-generation output into a new temporary file. Check the exit code and expected schema before replacing generated types.
The application fixture allowlist must add only the exact new project, port, and container identity.
Do not loosen its loopback and captured-record safeguards.

## Plain-language approval question

May I create one separate local test database for the two new features?

It will use `CMGPA_legal_airtable_disposable` on ports `15620–15629`.
I will load only synthetic data and the candidate database changes.
I may reset this new database up to three times to fix failed checks.
I will run the database tests and generate the application’s database types.
The tests may remove their own synthetic records in this new database only.

Your two existing databases, hosted data, logins, and cleanup block remain unchanged.
No real email, Airtable update, signature, upload to Production, or backup is included.
