# Security updates and complete database verification

Approved follow-up: complete disposable database verification and fix the existing Next/node-forge advisories, then retest. Base: 516827f7564509de5651c43d9809ffdae62ea0a9 on the existing experiment branch. No merge, deployment, hosted mutation, real message or real agreement is authorized. Browser/mobile remains deferred.

- [ ] Restore the published experiment and verify current remote/base and deployment suppression.
- [ ] Establish an isolated full Supabase test stack; all new local data is synthetic/disposable. Never reset retained or hosted data.
- [ ] Run migration reset, all pgTAP and database-backed Vitest checks; add any necessary missing real-stack bridge tests.
- [ ] Generate types with the official CLI, inspect the diff and remove the temporary new-RPC overlay if generated output supplies it.
- [ ] Apply narrowly scoped Next 16.4.6 and node-forge 1.4.3 updates with lockfiles and relevant security regressions.
- [ ] Rebuild the pinned signing-service patch chain reproducibly; preserve licensing and notices.
- [ ] Run affected/full tests, type checks, lint, builds and dependency audits; keep actual skipped checks explicit.
- [ ] One fresh-context final review and a bounded fix pass for Important/Critical findings.
- [ ] Publish only the authorized experiment branch; independently verify contents and unchanged develop/deployment suppression.

Runtime investigation: the previous task's pinned CLI 2.116.0 requires Docker. Current official docs describe a newer native experimental stack on Linux. Verify actual published versions/CLI help before using it; keep test-runtime settings task-local unless a deliberate repository update is justified. This is a new isolated checkout; no prior retained acceptance data is present.

Security checkpoint: Next16.4.6 with matching eslint-config/override and node-forge1.4.3 applied. Forged-identity Ed25519 regression observed RED on1.4.2 and GREEN on1.4.3. Current production audits report zero findings. Full default local checks pass, pending real database run. Broader development-tool audits still report pre-existing minimatch/picomatch chains; picomatch has no published patched release. Do not report the full dependency tree as clean or force major test-tool downgrades.

Runtime ruling: retain the repository-pinned CLI2.116.0 for full checks on an ephemeral GitHub Actions runner with Docker. The newer native2.122.1 runtime was tested in a separate project: automatic ports and checksum-verified official artifacts resolved its first setup/download failures, but the execution sandbox blocks PostgreSQL Unix sockets (Operation not permitted). No native CLI/config/ports changes are carried into CMG. Cost if wrong: CI availability/workflow permission is a remaining verification dependency; no paid server or hosted data is needed.

The isolated workflow uses only checkout/read permission, current synthetic seeds and ephemeral service containers. It never receives hosted credentials, merges or deploys. It is triggered only by the exact experiment branch and explicit verification-request/workflow changes. Generated types are retained as an artifact for deliberate intake. All full-stack checks remain unconfirmed until the actual run succeeds.

Verification checkpoint published at 2d364a0856d1606a2f37cc7538fb98179afec2bc. Isolated run: https://github.com/rspeciale0519/cmg/actions/runs/44152218172 . Results are pending; this is not a green CI claim. Native test attempts and official artifact hash provenance are retained outside the repository until a sanitized handoff is written.

First full CI run passed:47pgTAPfiles/1441assertions,313selectedtests/2intentional live-onlyskips,1921defaulttests/70skips; service298unit/152db; type/lint/build and productionaudits0. Official generated schema taken in verbatim (only4line pollRPC addition); temporary overlay removed.

Final review:3Important findings handled in one pass. RequiredDBavailability tests3RED→GREEN; native ABI filters54removed→0changed; distinct signed/evidence fixtures and exact nonvacuous replay-orphan checks strengthened. Second request002 reruns completechecks with those fixes. Minor deferred: loopback bind and checkout credential persistence in synthetic-only ephemeral job. Browser/mobile remain deferred; no full-audit-clean claim because existing developer-tool advisories remain.
