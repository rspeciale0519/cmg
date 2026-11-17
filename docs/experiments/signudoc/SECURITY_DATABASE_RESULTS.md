# Security and complete database verification follow-up

This follows the initial CMG connection implementation. Work stays on `spike/signudoc-white-label-2026-11-16`; SignuDoc remains disabled. No hosted database, real agreement/message, merge, deployment or paid server is used. Browser/mobile remains deferred.

## Security updates implemented

- CMG Next and matching lint tooling: 16.4.3 → 16.4.6. Preserve the existing scoped Next glob shim. Actual application cache usage was inspected; no `use cache`/`unstable_cache` combination exists in CMG source.
- Separate signing service node-forge: 1.4.2 → 1.4.3, packaged as checksum-pinned patch3. A forged identity-key Ed25519 signature was incorrectly accepted on1.4.2 (RED), then refused on1.4.3 (GREEN); authentic signatures still work and tampered content fails.
- Both current production dependency audits report zero known findings. This is a dependency-audit result, not a complete security audit.
- Broader audits include existing development-tool chains: CMG has8high/6moderate, service9high/6moderate after these changes. Their high counts predate this work. The shared picomatch advisory currently has no published patch; minimatch also has a moderate finding. No forced major test-tool downgrade or suppression is applied. Full `npm audit --audit-level=high` therefore remains failing and a release gate; do not describe the full tree as clean.

Primary advisories: [Next cache isolation](https://github.com/advisories/GHSA-mfr8-8qww-v76h), [forge signature validation](https://github.com/advisories/GHSA-6889-vf6x-f3g5), [forge TLS compression](https://github.com/advisories/GHSA-w4xr-hqv8-ch44), [forge HTTP trimming](https://github.com/advisories/GHSA-6cv4-p8m7-4r25), [forge closed-session handshake](https://github.com/advisories/GHSA-j8rw-jp99-435v), [picomatch](https://github.com/advisories/GHSA-fc5q-39xc-vjpf), [minimatch](https://github.com/advisories/GHSA-g3hv-75wg-m249).

## Local evidence

CMG: 1,921 default tests passed,68skipped; type-check/lint/build exit0 after the framework update. The newly added explicit real-Supabase suite is skipped by default and requires `CMG_SIGNUDOC_DATABASE_TEST=1`; it refuses a missing runtime instead of silently skipping when requested.

Signing service:298unit tests passed; type-check/build exit0; lint exit0 with five existing editor warnings. Third-patch source preparation reproduces all21changed source files exactly, including the package/lockfile and security regression. The passive preparation guard test passed.

Existing SQL/server evidence from the initial implementation remains historical evidence; it does not substitute for rerunning database checks after these updates.

## Full database verification — completed

The newer native CLI2.122.1 was investigated in a separate disposable project. It requires ports outside its internal reserved range, so the tracked CMG port configuration was copied/adapted only in the test project. Official service archives/manifests were retrieved via the working HTTPS proxy and verified against every locked digest, preserving CLI integrity verification. Startup then failed because the execution sandbox prohibits PostgreSQL Unix sockets (`Operation not permitted`). The temporary stack and loopback artifact server were stopped; no native CLI/configuration changes are carried into CMG.

The alternative is an isolated GitHub Actions workflow using the repository-pinned CLI2.116.0 and Docker on an ephemeral runner. It has only contents-read permission, no hosted credentials or deployment commands, and triggers only on the exact experiment branch and an explicit verification-request/workflow change. It runs full pgTAP, official generated types, the repository database-backed Vitest selection, and additional actual SignuDoc private-filing/replay tests. A second job rebuilds the pinned signing service and runs its full real-Postgres suite.

First checkpoint:2d364a0856d1606a2f37cc7538fb98179afec2bc. [Run44152218172](https://github.com/rspeciale0519/cmg/actions/runs/44152218172) passed both jobs:47pgTAP files/1,441assertions; database-backed selection313passed/2intentional skips (real signing HTTP and live PandaDoc); default1,921passed/70skipped; type/lint/build; service298units/152Postgres; both production audits zero findings.

Official artifact14360570761 has ZIP SHA-256 ec3eaa8679f48742f748ed94d926fcde6a4d12ce7e61356772cc2bc20e7ac463, matching GitHub. Its exact generated file was taken into src/types/database.ts (SHA-25672af45bc1e8ccd54e3b3934e874fe8cba395fd140c949da85ea5794907d8535f). The whole diff is four lines declaring the poll RPC. The temporary non-generated overlay was removed; existing nullable overrides remain.

The consolidated review fix pass strengthens the next CI gate: all required DB probes fail closed in the explicit job, signed/evidence fixtures have distinct bytes and per-kind hashes, replay orphans must actually exist and exactly match pending cleanup intents, and original native-platform installer metadata is preserved. The final strengthened run passed; its results are recorded below.

## Decisions

1. Keep CLI2.116.0 and CMG's tracked ports unchanged; run full checks on a disposable GitHub runner. Cost: verification depends on runner/workflow availability; no production resource is involved.
2. Apply exact patched production dependencies and preserve unrelated package versions. Cost: existing unpatched development-tool exposure remains an explicit release gate.
3. Use actual claim/database/storage tests with a fake completed-provider snapshot for filing checks. Cost: this proves the filing boundary, not deployed claim UI, actual email delivery or phone signing. Those remain later acceptance steps.

## Remaining release gates

Development-tool advisory disposition, browser/phone acceptance, two-firm separation/branding/template/retention/restore checks, legal/security review and an explicitly approved hosted pilot. No release readiness percentage is assigned.

## Independent review disposition

One fresh-context review found no Critical and three Important issues. Platform filters were demonstrably removed (26CMG/28service), then all original filters were preserved and source reproduction reverified. The explicit required-DB probe tests failed three cases, then passed after fail-closed handling; ordinary offline test behavior remains unchanged. Artifact fixtures/assertions were strengthened rather than an application bug being claimed: the actual implementation already verifies hashes, and the stronger real-stack scenarios must pass in the next run.

Minor hardening deferred: bind the disposable PostgreSQL service port explicitly to loopback and disable checkout credential persistence. This runner contains only synthetic data with a read-only GitHub token, but those settings can reduce its exposure further. Current patch-count/schema-intake documentation was updated as part of the planned handoff; no outdated state should be treated as current. The reviewer did not rerun suites or rereview author fixes.

Final source checkpoint:052e0e20a5ac233450a757bcb4785dc6e1447572; all41changed files independently fetched and matched exactly. [Strengthened run 44154829008](https://github.com/rspeciale0519/cmg/actions/runs/44154829008) passed both jobs. Local final checks:1,924passed/70skipped, type/lint/build exit0. Develop and branch deployment suppression verified unchanged.

## Final verified outcome

The final strengthened run passed against source commit `052e0e20a5ac233450a757bcb4785dc6e1447572`:

| Check | Result |
|---|---|
| Complete pgTAP schema/RLS | 47 files, 1,441 assertions passed |
| Explicit database-backed application selection | 316 passed; 2 intentional opt-in skips: separate service-HTTP harness and live PandaDoc |
| Default CMG suite | 1,924 passed; 70 database/live/other opt-in skips |
| Signing service | 298 units and 152 real-Postgres tests passed |
| Locked installs, type checks, lint, builds | Passed for both applications; service lint retains five existing warnings |
| Production dependency audits | Zero findings for both applications |
| Full development dependency audit | Still failing on the documented pre-existing tooling advisories; not counted as clean |
| Official type generation | Passed; final artifact 14359369878 contains bytes identical to committed database.ts |
| Three-patch reconstruction | All 21 modified signing-service source files match |

The final schema ZIP digest is `0983bca034b943a57ee63a2de31d17644bf14dc2b48afacbabb251171bcccd99`. Its member file remains `72af45bc1e8ccd54e3b3934e874fe8cba395fd140c949da85ea5794907d8535f`. The original ABI/platform metadata is preserved, explicit required database probes fail closed, and the real filing tests check distinct document kinds/hashes plus exactly matching pending cleanup for actual replay orphans.

This completes the requested full database verification and the two known production dependency updates. It does not establish zero vulnerabilities, a complete security audit, authenticated homeowner filing access, deployed adjuster review/send, current actual-service HTTP signing, physical-phone acceptance or launch approval. Existing separate API evidence is historical, and the actual provider snapshot in these filing tests is simulated. Existing repository Auth/MFA/RLS suites ran in the same full stack; the new filing suite itself uses privileged storage and anonymous-download refusal.

Both disposable CI jobs cleaned up their local services. Develop remains unchanged and the experiment branch deployment suppression is retained. No real message, customer agreement, hosted mutation, merge, deployment or new paid server occurred.
