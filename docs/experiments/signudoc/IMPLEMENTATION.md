# Implementation ledger — optional authorization and CMG connection

Approved 2026-11-16: implement optional fields first, then CMG integration; defer browser/mobile acceptance until afterward. Existing production, PandaDoc/manual defaults, in-flight agreements and unrelated projects remain untouched. Work is confined to the existing experiment branch. No real sends, hosted changes, merges or deployments.

- [x] Step 1: genuine optional initials/signatures/dates; chosen, declined and mixed two-homeowner database/HTTP checks; unit/type/lint/build checks; publish tested patch.
- [x] Step 2: authenticated, firm-scoped service bridge and CMG integration using current authorization/dispatch/storage invariants; test real synthetic local transport and negative/retry paths; publish source/results.
- [x] Fresh-context final code review and fixes.
- [x] Verify remote branch content and report exact passing/incomplete checks.
- [ ] Deferred: browser/mobile acceptance; production/pilot release gates remain closed.

Ruling: keep SignuDoc a separately built Node 24 service represented by reproducible pinned patches in this CMG repository, rather than copying a second Next application into CMG's compilation tree. CMG stays its current single Node 22 app. Cost if wrong: extra fork packaging/maintenance work; no tenancy or deployment shortcut is assumed.

Pre-flight: CMG dispatch SQL currently allows only manual/pandadoc and stores provider identity in a PandaDoc-named column; SignuDoc integration must add a distinct identity and preserve the existing protected dispatch leases. A new provider transport alone is insufficient.

Step 1 RED: all four new schema tests failed against pinned upstream: optional signature/initial/date rejected and explicit date choice absent. Existing actual-contract HTTP diagnostic already confirmed full field manifest HTTP 400. Implementing coherent optional date choice and clearable optional signer input.

Step 1 GREEN: 290/290 unit, 150/150 Postgres tests, TypeScript exit 0, lint exit 0 (five existing warnings), build exit 0; five actual-contract HTTP cases passed for Single/Dual accepted/declined/mixed. 45 pages preserved legal backgrounds and blank declined regions; ten valid self-signed artifact seals. Browser/mobile deliberately deferred by owner. Source patch and evidence preserved in integrations/signudoc.

Step 1 publication: commit 8f9c67a8331c8f2a4b175ee4284c7760c6451170 on the existing GitHub branch; all 17 files independently read back exactly. Develop and production untouched.

Step 2 RED/GREEN foundation: signed-request authentication test failed before implementation and passed afterward. Tests cover body/path/method/firm/key/clock/nonce tampering, unsigned requests and empty keys. Nonces will additionally be consumed atomically in the service database; an HMAC alone is not replay protection.

Ruling: retain the existing opaque provider-document reference in CMG's legacy-named pandadoc_document_id column, namespaced as signudoc:<UUID>. Use the existing generic dispatch ledger and attempt guards rather than duplicating claim state. PandaDoc callbacks must keep an explicit PandaDoc transport and cannot match namespaced SignuDoc IDs. Cost if wrong: historical column naming remains technical debt; new code/tests must enforce the namespace at every bridge boundary.

Step 2 checkpoints: new authentication/request-boundary tests and CMG client/provider-selection/review-token/review-dispatch/reconciliation/component/worker tests ran RED then GREEN. Actual CMG-client → SignuDoc HTTP tests passed using both real CMG contracts, full optional fields, local Postgres, capture-only email and verified artifact hashes. A new negative test demonstrated that an ordinary sender session could edit a prepared bridge draft; a database review lock and atomic draft binding are being added and retested. No live send/hosted database was used.

Ruling: background filing uses a fair, leased poll batch, not repeated calls to the first unchanged claims. One new server-only RPC contract is declared in the existing non-generated database-app type overlay; the generated database.ts is not edited. Full local-stack type regeneration/pgTAP remains a gate until the required Supabase runtime is available. Cost if wrong: migration/contract mismatch; verify with the SQL tests and regenerate before merge/activation.

Browser/mobile remains deferred by Rob; no visual signing acceptance is claimed. The new background endpoint will not be scheduled or activated by this task.

Final Step 2 verification: CMG 1,921 passed/68 skipped; service 296 units/152 Postgres; CMG actual SQL 68 assertions; type/lint/build both exit 0; 106 affected checks per site mode; real provider HTTP Single/Dual, reminder and lost response pass. Two pinned patches reconstruct all 18 changed upstream files exactly. The first CMG build's Next advisory was recorded, its retry passed, and dependency upgrades remain release gates.

Final review: four Important findings plus one author-discovered authorization mismatch fixed, with RED→GREEN regressions and full checks. No Minor findings deferred. See CMG_CONNECTION_RESULTS.md for all decisions and limits. Nonblocking admission bounds one bridge operation per install; cost is throughput/busy responses. Full Supabase checks and generated types remain incomplete: the pinned CLI reported LegacyContainerRuntimeNotFoundError (no Docker/Podman). Existing generated database.ts, dependencies, deployed environments and production provider remain unchanged.

Ruling: retain pinned dependency versions in this integration change and explicitly gate activation on the recorded moderate Next/node-forge upgrades — avoid mixing unrelated upgrades into the bridge patch — cost: this branch cannot be activated until a reviewed dependency update and retest.

Step 2 publication: 94fad6fcec97e79a0668389941cc54f42ca6c9e3; all 85 changed files independently read back exactly. Develop unchanged, branch deployment suppression intact, no commit-status entries. See IMPLEMENTATION_PUBLICATION.md for receipt.
