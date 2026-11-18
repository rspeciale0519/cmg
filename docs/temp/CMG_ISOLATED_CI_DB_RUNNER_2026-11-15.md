# Isolated CI database test runner

Prepared November 15, 2026. No database command or database-backed test ran during this preparation.

The user approved the separate database scope.
The root agent owns setup, reset, SQL tests, type generation, and the decision to start this runner.
Wait until the root agent confirms that the SQL checks are stable.

## Exact runner and target

Runner directory:

`C:/Users/rob/.codex/visualizations/2026/11/01/01a19512-82bb-71a2-8d71-83374c0d0f60/cmg-law-firm-airtable-db-runner`

Files: `run.mjs`, `vitest.config.mjs`, and `loopback-fetch-guard.mjs`.

- Project: `CMGPA_legal_airtable_disposable`.
- API: `http://127.0.0.1:15621`.
- Database: `127.0.0.1:15622/postgres`.
- DB container: `supabase_db_CMGPA_legal_airtable_disposable`.
- API container: `supabase_kong_CMGPA_legal_airtable_disposable`.
- CLI: `C:/Users/rob/scoop/apps/supabase/2.116.0/supabase.exe`.
- Node: the exact portable Node 22.22.2 executable in this chat's scratch directory.

The runner cannot start, reset, stop, or remove a database.
The database tests retain their approved synthetic-fixture cleanup.
They cannot use a retained database through this runner's fixed environment.

## Command after root confirmation

Replace the placeholder with the full DB container ID that the root agent has confirmed.
The runner requires exactly 64 lowercase hexadecimal characters and an explicit suite.
Do not run another database test at the same time.
Run CI first. The later Airtable concurrency tests retain their synthetic records.

```powershell
& 'C:\Users\rob\.codex\visualizations\2026\11\01\01a19512-82bb-71a2-8d71-83374c0d0f60\node-v22.22.2-win-x64\node.exe' 'C:\Users\rob\.codex\visualizations\2026\11\01\01a19512-82bb-71a2-8d71-83374c0d0f60\cmg-law-firm-airtable-db-runner\run.mjs' --suite ci --confirmed-db-container-id '<confirmed 64-character DB container ID>'
```

After CI passes, use the same command with `--suite airtable`.

## CI execution sequence and limits

1. Check the exact runner, Node executable, staged project name, configuration hash, and approved ports.
2. Refuse any normal environment file in the application checkout without reading its content.
3. Inspect only the exact DB and API containers through the local Docker named pipe.
4. Compare the DB container ID with the root agent's confirmed ID.
5. Confirm the pinned CLI version.
6. Run one `status --workdir <exact-new-work-directory> --output json` call.
7. Keep the returned local credentials in memory.
8. Require the exact API and database URLs from that result.
9. Read at most one webhook-event row to confirm the local API works.
10. Read at most one unfinished storage-cleanup row.
11. Stop if an unfinished cleanup row exists.
12. Run the exact CI test selection once.
13. Require all 11 database-backed files to pass without skipped assertions.
14. Permit only the explicit live PandaDoc draft test to stay skipped.

The two record reads return no output.
Raw CLI status output is never printed or saved.
Known local credentials and JWT strings are removed from test diagnostics before display.
No credential file, raw JSON report, or environment file is created.
Unexpected results stop the runner. It performs no automatic retry or reset.

## CI selection

The selection matches `.github/workflows/ci.yml`:

```text
src/lib/esign
src/app/api/pandadoc
src/lib/storage-cleanup
src/lib/admin/partners.test.ts
```

It includes their ordinary unit tests and these database-backed files:

1. `src/lib/esign/lor-dispatch.test.ts`
2. `src/lib/esign/lor-dispatch-validation.test.ts`
3. `src/lib/esign/webhook.test.ts`
4. `src/lib/esign/webhook-edge.test.ts`
5. `src/lib/esign/webhook-reconciliation.test.ts`
6. `src/lib/esign/webhook-supersession.test.ts`
7. `src/app/api/pandadoc/webhook/route.test.ts`
8. `src/lib/storage-cleanup/concurrency.test.ts`
9. `src/lib/storage-cleanup/intake-uploads.test.ts`
10. `src/lib/storage-cleanup/uncertain-write.test.ts`
11. `src/lib/admin/partners.test.ts`

The new legal and Airtable SQL acceptance remains in the root agent's pgTAP run.
This runner does not replace that SQL acceptance.

## Separate Airtable concurrency mode

`--suite airtable` runs only `src/lib/airtable/concurrency.local.test.ts`.
It retains the same fixed project, staged-configuration, Node, container, port, and clean-environment checks.
It makes no CLI status read and obtains no API credential.
It sets these two additional child-process variables:

```text
CMG_AIRTABLE_CONCURRENCY_TEST=1
CMG_CONFIRMED_DB_CONTAINER_ID=<the verified root-confirmed DB container ID>
```

All ten tests must pass. No test can skip, and no extra test file can run.
Three cases check revoked Airtable Owner authority, an inactive company, and concurrent uncertain-delivery claims.
Three cases check legal firm edits, handoff starts, and package preparation after a waiting Owner loses access.
The seventh case holds one worker transaction open and proves that another worker cannot claim the same external record.
Three further cases refuse claim confirmation after a configuration change, Owner access loss, or company deactivation during a lock wait.
The test helper independently verifies the exact DB identity and project labels.
It opens SQL sessions using the immutable confirmed container ID.
The helper closes its test sessions and retains their synthetic records.
It reads no environment file and calls no provider or hosted API.

## Isolation findings

### General fixtures accept more than the new port

`src/lib/esign/test-support.ts` accepts a loopback host on any port.
It rejects hosted URLs, URL credentials, extra paths, queries, and fragments.
Its environment loader reads `.env.local` if either database setting is absent.
The runner supplies both settings and disables Vite environment-file loading.
It starts a clean child environment rather than copying application or provider variables.

### An unavailable database can look like a skipped suite

The existing fixture helper returns `false` after an availability error.
The affected suites then skip their database assertions.
The runner makes its own local API read before starting.
It also rejects missing, failed, or skipped database assertions in the final JSON report.

### Cleanup batch claims are not limited to one fixture

The concurrency suite calls `claim_storage_cleanup_batch` against the local queue.
Those RPC calls can claim another due synthetic row in the same database.
The runner therefore stops when any unfinished cleanup row exists before testing.
Run it after a fresh isolated reset and successful transactional SQL tests.
Do not run another database suite at the same time.

### Some existing cleanup hooks do not check returned errors

The concurrency suite scopes its deletions to a random fixture path prefix.
Its cleanup hook does not assert the returned delete errors.
The runner does not weaken or change that existing test.
A passing result therefore does not prove that every synthetic cleanup row was removed.
Keep any remaining data for review. Do not run broad cleanup.

### Fixture references have a small random namespace

The shared e-signature helper uses a random `CMG-2099-####` reference.
A collision can cause a test failure in a database with earlier fixture remnants.
The runner stops on that failure and does not delete conflicting records or retry automatically.

### Intake fixture cleanup has a separate Docker path

`src/lib/intake/test-fixtures.ts` now includes the exact new project, API port, DB port, and container.
The runner sets `CMG_TEST_STACK` to that exact value.
It sets `DOCKER_HOST` to the local Docker named pipe and does not inherit a remote Docker context.
The helper checks the container port before deleting only captured synthetic session UUIDs.

### The live provider test remains separate

`pandadoc-draft.live.test.ts` requires its explicit opt-in before reading an optional environment file.
The runner sets that opt-in to `0` and supplies no real provider credentials.
The discovery tests still create and remove their own temporary files with fake credentials.
Their subprocess setup refuses all network calls.
The runner's normal fetch guard permits only the exact local API and refuses redirects.
Provider tests can still use their explicit in-memory HTTP mocks.

## Preparation checks

Node 22 syntax checks passed for all three runner files.
The modified runner passed another syntax check after the two suite modes were added.
No runner import, CLI status read, Docker inspection, database query, or test execution occurred in this preparation.
No app source, shared Vitest configuration, package file, hosted environment, login, or cleanup setting changed.

Next step: wait for root's SQL-stable confirmation before running the prepared command.

## First approved CI attempt

Root confirmed reset 2 and all 48 pgTAP files passed, with 1,554 assertions.
Root authorized one CI attempt against this exact DB container:

```text
bac99181c05c2ddf3fd699287547d5327f5b100cce7923086acb549e71607734
```

The runner returned exit code 1 during command preflight.
Its exact diagnostic was:

```text
A required local preflight command failed. No test run started.
```

The command wrapper uses that message for Docker identity, CLI version, and CLI status failures.
The output does not identify which command failed.
No API preflight read or Vitest process was reached.
No database assertion or test cleanup ran.
Credentials were not printed.
No retry, reset, or other database test followed this result.

Next step: diagnose the failed preflight under root's instruction before another CI attempt.

## Diagnosed preflight and corrected attempt

Root authorized safe diagnosis and one corrected CI run.
The exact two-container identity read returned exit status 1 inside the sandbox.
The same read outside the sandbox returned exit status 0 and matched the confirmed DB ID.
This established that the sandbox blocked Docker access.
The target and network guards did not change.
The command wrapper now reports the failed command phase, sanitized error code, and exit status.
It still suppresses raw command output that could contain credentials.

The corrected CI attempt started with authorized local access.
Its exact identity and API preflight checks passed.
The runner returned exit code **0**.

```text
Tests: 279 passed; 0 failed; 1 pending/skipped.
All 11 required database-backed files passed. Only the explicit live PandaDoc test was skipped.
```

The only skipped file was `src/lib/esign/pandadoc-draft.live.test.ts`.
Its real provider action was not enabled.
All 11 mandatory database-backed files completed their assertions.
No reset, broad cleanup, hosted request, or real provider send ran.
The tests used only their approved synthetic-fixture cleanup.
The CI result remains complete. It was not repeated.

## Six-case concurrency reproduction before the repair

Root approved one run before migration `20261115031000` was staged.
The runner used the same confirmed container ID and authorized local access.
It returned exit code **1**, as expected for the reproduction.

```text
Tests: 3 passed; 3 failed; 0 pending/skipped.
```

All three Airtable cases passed.
All three legal cases failed at the intended permission assertion in `concurrency.local.test.ts:137`:

```text
AssertionError: expected undefined to be 'SQLSTATE 42501'
```

The failing cases were firm edit, handoff start, and package preparation after the waiting Owner lost access.
No unrelated failure occurred.
The test sessions closed and their synthetic records remain.
No reset or retry ran from this agent.
Root will stage the repair and give the next execution instruction.

## Seven-case concurrency result after the repair

Root completed the third approved reset and loaded migration `20261115031000`.
All 48 pgTAP files passed again, with 1,554 assertions, before this run started.
The third reset replaced the DB container.
Root confirmed its new immutable ID:

```text
2667e0b4c1ccc6d782eb4d4ec2cc54bf628d8623efaf4a29e8a2ffe39720328d
```

The seventh case adds an explicit overlapping-transaction check for the same external record.
The runner required exactly seven cases and used the fresh confirmed ID.
It returned exit code **0**:

```text
Tests: 7 passed; 0 failed; 0 pending/skipped.
All seven Airtable and legal concurrency tests passed. No tests were skipped.
```

All cases passed:

1. Refuse an Airtable save after a waiting Owner loses access.
2. Refuse an Airtable save after the company becomes inactive.
3. Claim the uncertain request before older pending work.
4. Block a second pending request while the first transaction holds the same external record.
5. Refuse a legal firm edit after a waiting Owner loses access.
6. Refuse a legal handoff start after a waiting Owner loses access.
7. Refuse package preparation after a waiting Owner loses access.

The test sessions closed and their synthetic records remain.
No reset, broad cleanup, hosted request, or provider send ran.
The earlier CI run was not repeated.

## Ten-case result after the record-proof repair

Final review found a stale record-confirmation proof across a configuration change.
Root applied `20261115032000_airtable_record_proof_guard.sql` incrementally to the same verified local database.
The application time was `2026-11-15T18:31:01Z`.
Its SHA-256 was `f002cb35cfdd89a01052913a8aa8b4f6edec4294631e8d61e89dc78c15eb426b`.
No earlier migration changed, and no fourth reset occurred.

The first inspection stopped before mutation because the incremental runner had an incorrect configuration-hash literal.
Root removed its extra `a`. The actual configuration and original staging manifest did not change.
The corrected inspection, staging, and migration phases passed.

The targeted SQL run passed 105 assertions across `47_airtable.test.sql` and `48_airtable_record_proof.test.sql`.
The earlier full baseline run remains 48 files and 1,554 assertions.
No combined 49-file run is claimed.

The scratch race runner then required exactly ten passing cases and no skips.
Its CI requirements, local identity checks, environment restrictions, and network guards remained unchanged.
The result was:

```text
Tests: 10 passed; 0 failed; 0 pending/skipped.
All ten Airtable and legal concurrency tests passed. No tests were skipped.
```

The earlier seven cases passed again.
The three added cases passed:

1. Refuse claim confirmation when company settings change during its wait.
2. Refuse claim confirmation when the waiting Owner loses access.
3. Refuse claim confirmation when the referring company becomes inactive during its wait.

The test sessions closed. Their synthetic records and the local browser fixtures remain.
The completed CI selection was not repeated.
Raw type regeneration after the repair passed.
Its SHA-256 is `947603fd55f2ac91b40404519a4ba18d0e981beced96ad1a983f6d019257a9d3`, identical to `src/types/database.ts`.
The raw output is retained as `database-after-320-1794767695985.ts` in the scratch runner directory.
No source replacement or manual type edit occurred.

## Incremental runner and proof records

The existing runner directory also contains `incremental-runner.mjs`.
It pins the original staging manifest and configuration hashes.
It verifies all 51 earlier migration hashes in both the source and staged directories.
It accepts only migration `20261115032000_airtable_record_proof_guard.sql` and SQL test files 47/48.
It checks the exact local container and migration history before each relevant phase.
It records one migration attempt and does not retry automatically.

Its phases are `inspect`, `stage`, `migrate`, `test`, and `types`.
The `types` phase writes raw output to a new scratch file and leaves application types unchanged.
The runner has no reset, seed, delete, remote project, or arbitrary command path.

These proof files are in the same absolute runner directory listed above:

- `INCREMENTAL-320-STAGED.json`
- `INCREMENTAL-320-ATTEMPT.json`
- `INCREMENTAL-320-APPLIED.json`
- `database-after-320-1794767695985.ts`

Reset 3 verified the unchanged baseline migration chain.
Incremental application verified the additional forward repair without erasing acceptance records.
No fresh reset was required. All three reset allowances remain used.
