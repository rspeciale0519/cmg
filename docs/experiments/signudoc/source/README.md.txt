# CMG SignuDoc experiment artifacts

Read REPORT.md first. This is an isolated cloud feasibility spike, not a production provider or a Windows installation.

## Pinned sources
- CMG develop: 950cb27514ce10c92a1b05a4ef87bee9fc627ca2
- SignuDoc: bb9bc099151fed39da5de017d9b4cd61b124cbbd
- Remote branch: spike/signudoc-white-label-2026-11-16 (created; no experiment commits pushed)

## Contents
- prototype/field-map.cjs and its eleven native Node tests.
- prototype/verify-audit.mts invokes the actual upstream audit verifier.
- cmg-source/: minimal nonsecret source snapshots used to derive required fields.
- harness/: custom HTTP test and local Playwright configuration. No browser is launched by the custom API scenario.
- evidence/: synthetic unsigned/signed PDFs and completion certificates, exact hashes, independent pdfsig output.
- logs/: baseline and final test/build/audit logs.
- No customer agreements, live credentials, captured signing-link outbox, local database files, dependency tree, runtime binaries or production data are included.

## Reproduce the pure mapper test
Use Node 24:
    node --test prototype/field-map.test.mjs

The default mapper deliberately blocks full production-like mapping because upstream cannot preserve CMG's optional authorization fields. Only explicitly synthetic required-only mapping proceeds.

## Reproduce the HTTP scenario
Requires a disposable local PostgreSQL 15+ instance, Node 24, npm and no real credentials. Do not use a hosted database or an existing retained test dataset.

1. Clone NYLLON-SOFTWARE/SignuDoc into a directory named upstream next to prototype; check out the pinned SHA.
2. In upstream, inspect package scripts and run npm ci --ignore-scripts --no-fund.
3. Copy harness/cmg-signudoc-api.spec.ts into upstream/e2e/.
4. Copy harness/spike.playwright.config.ts into upstream/.
5. Initialize a NEW disposable local Postgres cluster. The recorded run used extracted official Debian PostgreSQL 17.12 binaries, no installed system service.
6. Start that cluster bound only to 127.0.0.1:55437, with an agent role for this test. Do not expose this test's local trust authentication on a real server.
7. Pass E2E_DATABASE_URL=postgres://agent@127.0.0.1:55437/cmg_signudoc_e2e, E2E_PORT=3187 and E2E_PROVIDER_PORT=3188.
8. Run the pinned upstream production build with only the necessary PATH/home/proxy/certificate settings inherited, no DATABASE_URL, email, storage or production secrets.
9. Run:
    node node_modules/@playwright/test/cli.js test --config spike.playwright.config.ts e2e/cmg-signudoc-api.spec.ts
10. Stop the disposable server afterward.

The test harness/global setup destroys and recreates the PUBLIC SCHEMA of its disposable test database each run. The recorded launcher hardcodes the local destination and uses an environment allowlist. Never point these tests at customer data or retain important records there.

The upstream local build can require HTTPS access to Google Fonts. Preserve approved proxy/certificate configuration rather than disabling certificate verification.

The original upstream browser E2E failed before opening a browser because this sandbox forbids Chromium's Unix socket. The custom API test does not prove desktop/mobile interaction. An HTTP User-Agent is explicitly labeled as nonvisual evidence.

## Recorded verification
286 upstream unit tests; 150 upstream Postgres tests; eleven mapper tests; one custom HTTP scenario containing both single and dual nine-page signing cases. See actual logs, not only this summary.

The clean upstream build and typecheck were run with spike-only harness files outside its compilation scope. No tracked upstream source was modified. The five lint warnings and moderate node-forge advisory are retained in the report.

## Releasing later
Do not copy this synthetic fixture into live legal agreements. Do not reuse a browser session as a machine integration. Review licensing notices, optional consent, tenant boundaries, durable send/replay/recovery, storage retention, email delivery and legal suitability before a separately approved deployment.
