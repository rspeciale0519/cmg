# Implementation ledger — optional authorization and CMG connection

Approved 2026-11-16: implement optional fields first, then CMG integration; defer browser/mobile acceptance until afterward. Existing production, PandaDoc/manual defaults, in-flight agreements and unrelated projects remain untouched. Work is confined to the existing experiment branch. No real sends, hosted changes, merges or deployments.

- [x] Step 1: genuine optional initials/signatures/dates; chosen, declined and mixed two-homeowner database/HTTP checks; unit/type/lint/build checks; publish tested patch.
- [ ] Step 2: authenticated, firm-scoped service bridge and CMG integration using current authorization/dispatch/storage invariants; test real synthetic local transport and negative/retry paths; publish source/results.
- [ ] Fresh-context final code review and fixes.
- [ ] Verify remote branch content and report exact passing/incomplete checks.
- [ ] Deferred: browser/mobile acceptance; production/pilot release gates remain closed.

Ruling: keep SignuDoc a separately built Node 24 service represented by reproducible pinned patches in this CMG repository, rather than copying a second Next application into CMG's compilation tree. CMG stays its current single Node 22 app. Cost if wrong: extra fork packaging/maintenance work; no tenancy or deployment shortcut is assumed.

Pre-flight: CMG dispatch SQL currently allows only manual/pandadoc and stores provider identity in a PandaDoc-named column; SignuDoc integration must add a distinct identity and preserve the existing protected dispatch leases. A new provider transport alone is insufficient.

Step 1 RED: all four new schema tests failed against pinned upstream: optional signature/initial/date rejected and explicit date choice absent. Existing actual-contract HTTP diagnostic already confirmed full field manifest HTTP 400. Implementing coherent optional date choice and clearable optional signer input.

Step 1 GREEN: 290/290 unit, 150/150 Postgres tests, TypeScript exit 0, lint exit 0 (five existing warnings), build exit 0; five actual-contract HTTP cases passed for Single/Dual accepted/declined/mixed. 45 pages preserved legal backgrounds and blank declined regions; ten valid self-signed artifact seals. Browser/mobile deliberately deferred by owner. Source patch and evidence preserved in integrations/signudoc.
