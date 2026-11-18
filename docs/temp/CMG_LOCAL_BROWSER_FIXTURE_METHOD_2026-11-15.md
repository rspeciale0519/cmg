# Local browser fixture and session method

Status: prepared source only. The helper has not run.
The coordinator must review the private session transfer before execution.

## Fixed scope

- Use only `CMGPA_legal_airtable_disposable`, API `http://127.0.0.1:15621`, and database port `15622`.
- Use the new feature checkout and explicit Node 22 runtime.
- Keep every existing helper, browser login, database, and stored record unchanged.
- Create five synthetic accounts: Owner, adjuster, Assistant, customer, and partner.
- Create one generic referring company and three synthetic claims.
- Assign the direct and referred claims to the new adjuster and customer.
- Leave the third claim unassigned for refusal checks.
- Store two small copies of the same synthetic PDF, one for each represented claim.
- Mark the PDF clearly as synthetic. It contains no actual signature or agreement.
- Keep every created record and both file copies. The helper has no deletion operation.
- Keep real Resend, PandaDoc, Airtable, and hosted database credentials absent.

Before preparation and each session transfer, the helper checks the fixed local Docker pipe and executable.
It supplies only the Windows process variables and fixed local Docker settings to Docker.
It checks container labels, ports, running state, and the shared isolated network.
The database container ID must equal `bac99181c05c2ddf3fd699287547d5327f5b100cce7923086acb549e71607734`.
A replacement container causes a stop, even if its name is unchanged.

## Commands

The new helper is `scripts/prepare-legal-airtable-browser.mjs`.
Importing it performs no fixture action.

The preferred runner is a Node child with an IPC channel.
Use the approved Node 22 executable as `execPath`.
Start the helper with `--ipc` and `silent: true`.
Pass credentials through Node IPC only.
Do not put credentials in arguments, environment files, tool output, or reports.

Each command has an integer `id` and a `kind`:

1. `initialize`: supply `options.appPort`, `options.publishableKey`, and `options.secretKey` from the new local stack.
2. `inspect`: return safe current metadata. It performs no inspection or network request.
3. `prepare`: verify the exact Docker identities and ports, then create the synthetic fixtures once.
4. `handoff`: supply one `role`. Transfer that new session once through private IPC.

Responses have three forms:

- `metadata`: safe fixture IDs, synthetic emails, local origins, PDF hashes, and progress.
- `error`: a fixed operation name and generic message. Stop and inspect safe metadata.
- `private-session`: new role cookies and their exact local origin. Never print or save this response.

The helper sends no secrets to stdout or stderr.
The parent must not print raw child output or complete IPC messages.
Keep any unexpected output in memory until it can be inspected without exposing credentials.

`handoff` means the session reached the parent process.
It does not prove that the browser installed or accepted it.
The parent must verify the intended local role page afterward.

## Browser transfer review

Each role receives a new hostname under a random reserved `.localhost` run label.
No existing browser session is read or copied.

Use the native Browser developer API to install only the supplied cookies at their supplied `url`.
The cookie payload omits `domain`, which keeps each cookie scoped to its exact new host.
Do not clear browser cookies, change existing cookies, sign out, or close existing tabs.
Check the exact hostname and port before installation.
Stop if native developer access cannot restrict the operation to these new hosts.

The helper obtains actual local Auth sessions through password sign-in.
Owner, adjuster, and Assistant sessions also complete local TOTP enrollment and verification.
Passwords, TOTP secrets, access tokens, refresh tokens, and cookie values stay in memory.
Only the safe role and AAL result enters metadata.
The new profile must exist, have the requested role, and remain active before sign-in.

## Application process

Use one task-owned application process on a verified unused port, bound to loopback.
Use only the new local API and its local keys.
Keep `AIRTABLE_ENABLED=false` and provider credentials absent.
Do not start email, Airtable, PandaDoc, or cleanup workers.

Installed Next.js documentation permits `.localhost` origins without an additional development allowlist.
Same-origin Server Actions need no extra allowed origin.
The narrow proxy correction treats reserved `.localhost` hosts as local for CSP.
Password and TOTP operations use relative same-origin redirects.
They do not need changes to the staged Auth email/OAuth redirect allowlist.
Make no hosts-file or DNS change.

## Remaining route checks

Use the real application routes with the synthetic records.
Check Owner and assigned-adjuster access, Assistant refusal, unassigned-claim refusal, and homeowner-safe progress.
Check direct-claim sharing without a company and generic-company sharing while the provider remains disabled.
Use real local forms for legal preparation, package downloads, and actual-milestone test records.
Milestone notices can enter the local outbox. Do not run an email worker.

Check desktop and 390px layouts, pending states, refusals, success states, console, and network results.
Reuse the same retained role sessions for staff and simple mode route-gate checks.
Restart only the verified task-owned application process when changing its mode.
Do not repeat completed unrelated acceptance tests.

Actual Airtable connection and external writes remain a separate hosted synthetic acceptance scope.
Local disabled-provider pages do not prove provider behavior.
