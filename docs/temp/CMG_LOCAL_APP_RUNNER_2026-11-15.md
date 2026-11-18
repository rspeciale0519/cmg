# Isolated local app launcher

Prepared November 15, 2026. The app build and server have not run through this launcher.

Launcher:

`C:/Users/rob/.codex/visualizations/2026/11/01/01a19512-82bb-71a2-8d71-83374c0d0f60/cmg-law-firm-airtable-db-runner/app-runner.mjs`

It permits only `build` and `start`.
Each command requires one of `platform`, `staff`, or `simple` and the exact confirmed DB container ID.
It accepts no arbitrary commands or extra arguments.

## Fixed target and checks

- Application checkout: the new `cmg-law-firm-airtable` checkout.
- Database project: `CMGPA_legal_airtable_disposable`.
- API: `http://127.0.0.1:15621`.
- Database: `127.0.0.1:15622/postgres`.
- App: `http://127.0.0.1:4199`.
- Node: the exact portable Node 22.22.2 executable.
- CLI: the exact installed Supabase 2.116.0 executable.

Before either action, the launcher checks the staged configuration hash and exact project.
It refuses retained-stack ports and environment bindings in that configuration.
It checks the exact DB and API containers, project labels, ports, running state, and root-confirmed DB ID.
It uses only the local Docker named pipe.
It makes one local CLI status read and validates the exact API and DB URLs.
It checks that `127.0.0.1:4199` is free.
It stops if that address is occupied and does not stop any existing process.

## Environment and data limits

The launcher starts a clean child environment.
It reads no inherited application, provider, or hosted database settings.
It refuses `.env` files before Next starts. The tracked `.env.example` is permitted because Next does not load it.
It supplies only the generated local Supabase keys and the fixed local URLs.
`AIRTABLE_ENABLED` stays `false`.
Resend, PandaDoc, Airtable, and Turnstile credentials stay absent.
Telemetry is disabled.

The CLI status result and private keys remain in process memory.
They are not written to an environment file or raw log.
Logs remove the known local keys, JWT strings, and oversized lines before display.

The local publishable key is intentionally public.
Next embeds it in the generated browser build because the app uses `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`.
This is the expected exception to memory-only handling. The secret service key is not supplied as a public variable.

The launcher performs no reset, SQL query, upload, provider call, or cleanup itself.
The running app can change only the verified local database when approved browser actions use it.
No hosted cleanup setting, retained database, browser login, DNS setting, or hosting setting changes.
Next may retrieve public font assets during a build under its existing configuration.

## Build and start

Run only after root gives the execution instruction.
Replace the container placeholder with the current confirmed 64-character ID.

```powershell
& 'C:\Users\rob\.codex\visualizations\2026\11\01\01a19512-82bb-71a2-8d71-83374c0d0f60\node-v22.22.2-win-x64\node.exe' 'C:\Users\rob\.codex\visualizations\2026\11\01\01a19512-82bb-71a2-8d71-83374c0d0f60\cmg-law-firm-airtable-db-runner\app-runner.mjs' --action build --mode platform --confirmed-db-container-id '<confirmed DB container ID>'
```

After that build passes:

```powershell
& 'C:\Users\rob\.codex\visualizations\2026\11\01\01a19512-82bb-71a2-8d71-83374c0d0f60\node-v22.22.2-win-x64\node.exe' 'C:\Users\rob\.codex\visualizations\2026\11\01\01a19512-82bb-71a2-8d71-83374c0d0f60\cmg-law-firm-airtable-db-runner\app-runner.mjs' --action start --mode platform --confirmed-db-container-id '<confirmed DB container ID>'
```

The same build can start with `platform`, `staff`, or `simple` for the route checks.
`SITE_MODE` is a private server-runtime variable, and the affected routes are dynamic.
Start requires the matching successful build, local public key hash, API URL, and site URL.
The recorded build mode is informational and does not restrict the runtime mode.
Next start receives explicit `--hostname 127.0.0.1 --port 4199` arguments.
The launcher prints its own child process ID for later precise process control.
It does not fall back to another port or retry automatically.

Each successful build appends a nonsecret record to `APP_BUILDS.jsonl` in the runner directory.
It retains earlier records and creates no record for a failed build.
The launcher never removes `.next`, caches, files, containers, or volumes itself.

## Review limits

The current local Supabase configuration uses a separate local authentication redirect address.
This launcher does not change authentication redirect settings.
Password-reset or invitation-email acceptance needs its own prepared local review scope.
Before signing in, use an isolated browser context if another local CMG session shares `127.0.0.1` cookies.
Do not change an existing login to perform this review.

The installed Next CLI documentation confirms the build prerequisite and explicit start host/port arguments.
The installed environment documentation confirms that public variables enter browser output.
Node 22 syntax checks passed for the launcher and the six-case test runner.
No app build, server start, port probe, CLI status read, or new database command ran during launcher preparation.

Next step: root reviews this scope, then starts the local build after database repairs pass.

## First approved build attempt

The launcher passed its syntax check after removing the unnecessary runtime-mode restriction.
The authorized build attempt returned exit code 1 before Next started:

```text
The current DB container differs from the root-confirmed ID.
```

The root-confirmed ID belonged to the database before the third reset.
The launcher stopped at its identity guard and read no CLI credentials.
It started no app build or server and ran no SQL.
Root must confirm the current DB ID before the next attempt.

## Build with the fresh confirmed identity

Root confirmed the post-reset DB ID `2667e0b4c1ccc6d782eb4d4ec2cc54bf628d8623efaf4a29e8a2ffe39720328d`.
The seven concurrency checks passed before this build started.
The launcher accepted the fresh identity and generated local keys.
The Next build started in `platform` mode with provider credentials absent and Airtable disabled.
The build returned exit code **0**.

- Next.js 16.4.3 compiled successfully in 26.7 seconds.
- TypeScript completed successfully.
- All seven static pages generated.
- Legal, sharing, Airtable setup, policy, and private routes were listed as dynamic.
- The nonsecret successful-build record was appended to `APP_BUILDS.jsonl`.

No app server has started.
The same build is ready for the three explicit runtime-mode checks.
