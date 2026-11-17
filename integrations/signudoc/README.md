# CMG's isolated SignuDoc service

Optional authorization and the authenticated CMG connection are implemented and synthetic-server-tested. The feature is disabled. Read [current security/database follow-up](../../docs/experiments/signudoc/SECURITY_DATABASE_RESULTS.md) and [initial connection results](../../docs/experiments/signudoc/CMG_CONNECTION_RESULTS.md) before intake. Browser/phone acceptance is deferred; no production deployment or real send is authorized.

SignuDoc is a separate Node 24 application; CMG remains one Node 22 application. This directory contains reproducible patches against the exact public upstream revision in `PINNED_UPSTREAM.json`, with SHA-256 verification. Keep `LICENSE.upstream` and all upstream third-party notices.

## Source preparation — no activation

With Node available, choose a NEW destination outside the CMG checkout whose parent already exists:

```sh
node --test integrations/signudoc/prepare.test.mjs
node integrations/signudoc/prepare.mjs /absolute/path/outside/cmg/signing-service
```

Preparation clones the pinned public source, checks out the exact commit and verifies/applies the listed patches. It refuses existing destinations and paths/symlinks inside CMG. It does not install dependencies, migrate/reset a database, start a service, send a message or deploy. The security follow-up reconstructs all 21 modified service files exactly from three pinned patches; see the current follow-up evidence.

- `0001-optional-authorization.patch`: optional signatures/initials/dates and signer UI/validation. Required defaults remain required. An optional date stays blank unless selected; its value comes from the server. Optional signature/initial input can be cleared.
- `0002-authenticated-cmg-bridge.patch`: one server API, schemas/HMAC authentication, atomic nonce replay guard, private binding/reminder tables, atomic draft binding, review locks, transaction-local send capability, nonblocking admission and regression tests. Apply in manifest order. Its three new migrations belong to the separate service database, never CMG's schema.

The bridge deliberately supports the actual current nine-page CMG PDFs and one/two homeowners. It is not a general-purpose public document API or a shared-tenant SaaS conversion.

- `0003-forge-security-update.patch`: node-forge1.4.3 and a forged-identity signature regression, preserving authentic-signature and tampered-content checks.

## Settings for a later approved isolated test

These are configuration names, not credentials and not instructions to activate production now. Store new random secrets in approved secret storage, never this repository or browser code. Use separate test resources and capture-only email; do not point previews at production.

| CMG (server only) | Separate SignuDoc installation |
|---|---|
| `SIGNUDOC_ENABLED=0` until explicit test activation | `CMG_BRIDGE_ENABLED=1` only in the approved isolated test |
| `SIGNUDOC_SERVICE_ORIGIN` = trusted HTTPS origin only | Normal SignuDoc `APP_URL`/auth/database/private-storage settings |
| `SIGNUDOC_FIRM_ID` = assigned installation UUID | Same UUID in `CMG_BRIDGE_FIRM_ID` |
| `SIGNUDOC_BRIDGE_KEY` = new high-entropy shared secret | Same secret in `CMG_BRIDGE_KEY` |
| Existing CMG Supabase server credentials | `CMG_BRIDGE_SENDER_EMAIL` = preprovisioned verified sender account |
| `SIGNUDOC_ALLOW_LOCAL_TEST=1` permits only loopback HTTP outside Vercel | Local tests: `EMAIL_DRIVER=capture`, private local storage and disposable local Postgres |

Protect first-run setup with SignuDoc's setup token before any external exposure. Provision the verified service sender deliberately; callers cannot choose another account. One firm per installation remains the architecture. A matching UUID/HMAC is not evidence that shared-tenancy support exists.

CMG's example environment keeps new signing disabled with empty settings. Enabling it without valid settings fails closed rather than silently switching providers. The existing opaque provider reference is namespaced `signudoc:<UUID>` in the legacy-named CMG column. Existing PandaDoc callbacks explicitly use the PandaDoc adapter. In-flight SignuDoc reconciliation can retain credentials while `SIGNUDOC_ENABLED=0` prevents new SignuDoc sends.

The CMG migration adds a distinct dispatch mode and a private leased poll RPC using the existing protected ledger. Run it only on an approved disposable CMG stack first. Regenerate `src/types/database.ts` with the official command and inspect the result. The current temporary declaration lives in the non-generated `database-app.ts` overlay; the generated baseline was not hand-edited.

## Workflow and recovery

- Staff authorization/AAL2 and user-scoped claim visibility/capabilities precede any protected read.
- Prepare/download the actual agreement; check all pages, agreement wording, fee and recipients; confirm before send. The server holds the exact reviewed bytes with a ten-minute actor/content-bound approval.
- The bridge freezes source/recipient/field definitions before delivery. Persistent send intent alone cannot authorize an ordinary sender route; the send transaction must carry the bridge capability.
- Refresh shows outstanding homeowners. Explicit reminders have unique operation IDs and upstream cooldown; automatic service reminders are off.
- A timeout/unknown send stays locked. Query status to reconcile; never automatically create a replacement. Only a confirmed pre-operation 429 refusal can retry, at most three times with fresh nonces and short delays.
- Completed signed PDF and audit evidence are hash-verified and filed privately with the claim; only then does the atomic claim transition occur. Fresh object names allow recovery after cleanup; stable event keys deduplicate records.
- `/api/cron/signudoc` is implemented behind existing site-mode/cron authorization, but deliberately unscheduled. A later approved pilot must supply a schedule, credential rotation, monitoring and failure/cleanup alerts. Refresh provides a staff-triggered reconciliation path meanwhile.
- Disable new sends using the feature flag during recovery. Retain keys/configuration for existing requests. Do not remove history, tighten mode constraints over retained rows or roll back by deleting signed documents.

Per-install admission permits one active bridge operation and promptly rejects contenders, leaving the shared pool free for that operation's transactions. This prioritizes safety over throughput; measure actual workload before changing it.

## Reproducing checks

Use Node 22 and the locked install for CMG; Node 24 and its locked install for the separately prepared service. Do not change CMG's Node requirement. Standard commands are the respective `package.json` definitions.

CMG: affected tests, `npm run type-check`, `npm run lint`, `npm test`, `npm run build`; the native preparation test above. Run the repository's official disposable Supabase database/type checks and database-backed Vitest suites before merge/activation. They remain incomplete here because Docker/Podman are unavailable. The real SQL fallback is narrower, as documented in the results.

Separate service: `npm test`, `npm run typecheck`, `npm run lint`, `npm run build`; `npm run test:db` only with an explicitly disposable local database whose name contains `e2e`. Never reset retained/hosted data. The preserved HTTP/SQL harness snapshots under `source/cmg-connection/` are evidence source, not automatic installers: they show this task's isolated ports/tool locations and must be reviewed/adapted to a new approved disposable environment. The native CMG transport scenario is explicitly opt-in with `CMG_SIGNUDOC_INTEGRATION=1`; it reads no optional environment/files unless enabled.

Evidence is under `evidence/cmg-connection/`. No captured outbox, signing link, cookie/session trace, runtime database, private certificate/key, customer record or dependency tree is included. The project name “chromium” in the HTTP log is only a Playwright project label; the test used HTTP fixtures and never launched a browser.

The original Step 1 evidence separately retains five real-contract optional-authorization HTTP cases, 45-page legal-background/blank-region checks and ten valid self-signed seals. Browser/mobile, independent certificate/identity/legal review, dependency advisories, cross-day dates, two-install separation and operational acceptance remain launch gates.

## Publication boundary

Keep the experiment branch's Vercel Git deployment suppression. No command here authorizes merge, hosted migration, paid resources, real agreements/messages, production provider changes or deployment. Intake with CMG's current development process and the linked launch plan, reconciling intervening work first.
