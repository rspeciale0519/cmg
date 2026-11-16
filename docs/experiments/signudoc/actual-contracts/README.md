# Replaying the actual CMG contract diagnostics

Read [RESULTS.md](RESULTS.md) first. These are separate CMG-unit and SignuDoc-HTTP tests with real CMG templates; they do not implement a working combined provider.

## Evidence and source

- [Machine-readable summary](evidence/verification-summary.json)
- [Actual-contract HTTP results](evidence/actual-cmg-api-results.json)
- [CMG test log](evidence/cmg-targeted-tests.txt)
- [SignuDoc HTTP test log](evidence/signudoc-actual-contract-http-tests.txt)
- [All-page integrity results](evidence/pdf-integrity-results.json)
- [Single asset manifest](evidence/single-manifest.json) / [Dual asset manifest](evidence/dual-manifest.json)
- [CMG source checksum list](evidence/cmg-source-sha256.json)
- [New source snapshots and hashes](source/SHA256SUMS.json)

The preceding experiment's passive materializer restores only its original source set; **it does not automatically install these additional actual-contract files**.

## Isolated workspace layout

Use new throwaway checkouts, outside any working CMG project. Never copy environment/credential files from a live project.

    trial/
      actual-cmg/             CMG checkout at 950cb27514ce10c92a1b05a4ef87bee9fc627ca2
      upstream/               SignuDoc at bb9bc099151fed39da5de017d9b4cd61b124cbbd
      prototype/              original experiment mapper and verify-audit.mts
      cmg-source/             original manifest from preceding experiment
      actual-contract-evidence/
      run-actual-api.py
      verify-actual-pdfs.py

Check the two source PDF SHA-256 values in the manifests before testing. The real assets live in CMG's `src/lib/esign/templates/`; do not substitute the earlier synthetic blank pages.

## CMG phase

1. Copy `source/signudoc-actual-contract-export.test.ts.txt` into the throwaway `actual-cmg/src/lib/esign/` directory as `signudoc-actual-contract-export.test.ts`. This should be the only new application-path file.
2. Use CMG's Node 22 requirement and lockfile. The recorded run used Node 22.22.2 and `npm ci --ignore-scripts --no-fund --no-audit`; never replace the machine's global Node runtime to replay this.
3. From `actual-cmg/`, run the following targeted command. It writes only the fake-data prepared PDFs/manifests into the sibling `actual-contract-evidence/input/`.

    node node_modules/vitest/vitest.mjs run \
      src/lib/esign/lor-pdf.test.ts \
      src/lib/esign/lor-prefill.test.ts \
      src/lib/esign/lor-prefill-color.test.ts \
      src/lib/esign/prefill-lor.test.ts \
      src/lib/esign/send-lor.test.ts \
      src/lib/esign/signudoc-actual-contract-export.test.ts

All six files/74 tests passed in the recorded run. Some tests deliberately trigger errors to prove fail-closed behavior; the logged “audit unavailable” and “pdf-lib exploded” cases are expected negative tests.

## SignuDoc phase

1. Follow the original isolated experiment README for pinned dependencies, test configuration, disposable PostgreSQL, local certificate and capture-only storage/email. Do not run its global setup against a retained database: it resets the disposable public schema.
2. Copy `source/cmg-actual-contract.spec.ts.txt` to `upstream/e2e/cmg-actual-contract.spec.ts`. Retain the original `spike.playwright.config.ts`, mapper and audit verifier.
3. Copy `source/run-actual-api.py.txt` into the trial root as `run-actual-api.py`. Inspect its hardcoded target: only loopback `cmg_signudoc_e2e` on 55437; app 3187 and fake provider 3188. Its local extracted PostgreSQL binary/data paths must match the preceding experiment setup. Do not repoint it to hosted CMG or retained data.
4. Use the separate SignuDoc Node 24 runtime and run `python run-actual-api.py`. The runner starts/stops the isolated database; Playwright starts/stops the local app and fake identity-provider stand-in. Messages are captured to local files, not sent.
5. A passing scenario includes **expected rejection of the complete optional-field manifest**, then an explicitly partial required-field diagnostic. It is not a full agreement acceptance test and does not launch a browser.

The optional UI preparation/server snapshots document the unsuccessful managed-browser attempt. They are not phone/browser acceptance evidence. They emit ephemeral signing links into a LOCAL-ONLY JSON file, which must never be committed. The server exits when `STOP-actual-ui` exists or after its time limit; remove that sentinel only in your new local trial if starting it again. This environment's browser could not reach the isolated loopback server.

## PDF integrity phase

Copy `source/verify-actual-pdfs.py.txt` to the trial root as `verify-actual-pdfs.py`. In a disposable Python environment with PyMuPDF and numpy, run `python verify-actual-pdfs.py`. It verifies all nine original legal background images per variant are retained, all synthetic watermarks remain, and a 2x raster comparison finds no changed pixels outside the mapped required signing fields with 10pt padding.

Independently run `pdfsig` on each signed/evidence PDF. Recorded signatures are valid, but test certificate issuers are unknown. This does not establish trusted signer identity or legal sufficiency.

## Publishing results

Keep source as `.txt` snapshots under this documentation directory; future production implementation belongs in a deliberately reviewed change. Publish sanitized summaries/hashes, not runtime outboxes, signing URLs, session material, private keys or customer information. Keep exact-branch deployment suppression. Do not merge, deploy, contact real recipients, or replace PandaDoc as part of replay.

