# CMG signing implementation — steps 1 and 2

The optional-authorization fix and CMG connection are implemented on the experiment branch. Synthetic server tests pass. **The feature remains disabled and is not approved for live agreements.** Browser/phone testing is deliberately deferred at Rob's request. The full Supabase runtime checks described below are still incomplete.

## What is now built

1. Homeowners can decline optional initials/signatures/dates and still complete the required agreement. Optional dates require an explicit selection and are supplied by the server. Full Single/Dual manifests are retained.
2. Authorized CMG staff can prepare the actual agreement, review/download every page, confirm homeowners and fee, then send the exact reviewed bytes. The signed review expires after ten minutes; changed claim data, recipients, fee, legal assets or actor invalidate it.
3. CMG's existing dispatch leases, per-attempt ownership, ambiguous-send lock and PandaDoc/manual paths are preserved. A lost send response never triggers an automatic resend. Only an explicit pre-operation HTTP 429 busy refusal can be retried, with bounded delays and a fresh authentication nonce.
4. A separate signing service accepts firm-bound HMAC requests with atomic replay refusal. Ordinary sender sessions cannot change reviewed drafts or send them outside CMG, even after a failed send has recorded durable intent. One accepted operation per installation prevents pool starvation; excess requests fail fast.
5. Staff can refresh individual homeowner progress and explicitly request a reminder to the outstanding homeowner. Automatic service reminders are off. No reminder is sent to completed homeowners.
6. Completed agreement and audit PDFs are downloaded with verified hashes, stored privately with the correct claim and filed using the existing atomic CMG transition. Audit evidence stays internal. Cleanup/persistence failures can retry using fresh object paths; event keys prevent duplicate filing.
7. An authenticated, leased background filing endpoint exists, but no schedule has been added or activated. Credentials can remain available to reconcile existing requests when the new-send feature flag is disabled.

Initial scope is the current approved CMG Single/Dual PDFs. This does not implement a general template marketplace, shared-tenant SignuDoc SaaS, all firms' branding/wording, or a production rollout.

## Verification

| Check | Result and scope |
|---|---|
| CMG full default suite | 1,921 passed; 68 skipped; 150 files passed, 18 skipped. Skipped live/database suites are not counted as passes. |
| CMG type check, lint, production build | Exit 0 each. The first build stopped with a dependency advisory; the documented retry passed. The advisory remains an open release gate. |
| Site modes | 106 affected/matrix checks passed separately in simple, staff and platform. |
| Signing service units | 296 passed. |
| Signing service Postgres | 152 passed, including admission bursts above pool capacity and ordinary sender refusal after durable intent. |
| Signing service type check, lint, build | Exit 0 each; five existing editor lint warnings. |
| Actual CMG SQL | 68 pgTAP assertions passed: existing leases/reconciliation plus 38 new assertions, on real disposable PostgreSQL with all actual CMG migrations and minimal test-only Auth/Storage schemas. This is not a complete Supabase stack. |
| Actual provider/HTTP | Both real nine-page CMG contract layouts completed using the actual CMG SignuDocProvider/client, real SignuDoc HTTP, local Postgres and capture-only email. Full 11/21 fields, one/two homeowners, mixed optional authorization, review locking, firm/claim/refusal/replay checks, duplicate sends, one explicit reminder, lost accepted-send response, signed/evidence hashes all exercised. |
| Source preparation | Both checksum-pinned patches apply to a fresh exact upstream checkout; all 18 changed source files match the tested source byte-for-byte. Preparation overwrite/symlink/repository guards passed. |
| Browser/phone | Deferred; no browser launch, viewport emulation or physical-phone acceptance is claimed. The HTTP harness's Playwright project label does not mean it launched Chromium. |

Earlier Step 1 evidence separately records five accepted/declined/mixed actual-contract HTTP cases, 45-page legal-background/blank-optional comparisons, and ten valid self-signed artifact seals. Those seals do not establish independently trusted identity or legal sufficiency.

The transport scenario does not exercise a deployed CMG claim screen, real Supabase Auth/MFA/REST/Storage, real email delivery or an end-to-end hosted claim transition. Those boundaries have separate unit and actual-SQL coverage, not combined live acceptance.

Archived terminal logs have normalized line endings/trailing whitespace; original task logs remain in the local workspace.

See [machine-readable verification](../../../integrations/signudoc/evidence/cmg-connection/verification-summary.json), [HTTP results](../../../integrations/signudoc/evidence/cmg-connection/bridge-http-results.json), [SQL results](../../../integrations/signudoc/evidence/cmg-connection/cmg-sql-results.json) and [source preparation](../../../integrations/signudoc/README.md).

## Independent review and fixes

One fresh-context whole-branch review found four Important issues and no Critical findings. All four were fixed in one consolidated pass; the author also found the protected-column authorization mismatch. Regression tests observed failure and then success for:

- Deterministic storage paths that could become permanently unusable after cleanup. New filing attempts use fresh paths; existing evidence is hash-verified. An ordinary conflicting insert rolls back cleanup-settlement side effects; duplicate finalization checks the existing row before inserting a fresh orphan path.
- Blocking session locks starving the shared database pool. Per-install nonblocking admission releases rejected/error connections; a 24-request burst test verifies progress. The client only retries explicit busy refusals, never an unknown send outcome.
- An ordinary sender bypass after durable send intent. Sending now requires the bridge's transaction-local attempt capability, which does not persist on pooled connections. The old SQL function failed the corrected test; the forward migration passed it.
- Older poll replies undoing terminal states/signing progress. SignuDoc-specific SQL guards retain terminal state and the highest observed signer count; old PandaDoc behavior remains scoped separately.
- Reading private dispatch bearer columns through a signed-in client. The initial read now uses only user-visible columns and RLS/capabilities; the server fetches protected columns afterward and rechecks assignment. SQL asserts those columns remain unavailable to authenticated clients.

There were no deferred Minor review findings. The reviewer did not review the subsequent fix diff; fixes were verified with the regression and full suites, as the execution plan requires.

## Decisions and costs

1. Keep SignuDoc a separate Node 24 service represented by pinned patches; CMG remains one Node 22 app. Cost: maintain a second service/fork and its operational dependencies.
2. Reuse CMG's existing opaque legacy-named `pandadoc_document_id` column with `signudoc:<UUID>` identity plus distinct dispatch mode/attempt guards. Cost: historical naming remains technical debt; every boundary must retain namespace tests.
3. Use a fair leased polling worker and one new server-only RPC, with its signature in the non-generated type overlay until official regeneration is available. Cost: generated-type/migration drift remains a merge/activation gate.
4. Serialize bridge operations per installation with nonblocking admission. Cost: bounded throughput and occasional busy responses; revisit only with measured need and equivalent safeguards.
5. Keep existing dependency versions in this integration change and record advisory upgrades as release gates. Cost: this branch must not be activated with the known advisories unresolved.

## Remaining gates, in order

1. On an approved disposable Supabase stack, run the repository's `db:reset`, `db:test`, database-backed Vitest selection and official `npm run db:types`. Inspect generated changes; do not hand-edit generated types. The attempted pinned CLI generation failed with `LegacyContainerRuntimeNotFoundError`: Docker and Podman are unavailable here. No hosted database was queried/migrated for this implementation.
2. Address the existing production dependency advisories in a reviewed update: CMG Next 16.4.3 (audit proposes 16.4.6) and SignuDoc node-forge 1.4.2 (audit proposes 1.4.3). Each audit reports one moderate affected package, zero high/critical; these are not zero-vulnerability results. Recheck patches against the updated fork.
3. Perform actual desktop/browser and phone signing/recovery acceptance, including cross-day two-homeowner dates, optional authorization pairs, reload/expiry, download UI, reminders and claim filing. Rob deferred this until after implementation; it is still mandatory before live use.
4. Validate two separate firm installations, versioned reusable templates without prior homeowner data, branding, retention/deletion/export behavior, backups/restores, credential rotation, monitoring and costs. Prepared-record guards need explicit retention/erase acceptance.
5. Obtain independent security/legal review of consent, optional authorization, contracts and certificate/identity/timestamp policy. A self-signed PDF seal is not the same as trusted signer identity.
6. Obtain exact approval for an isolated hosted pilot, resource/email/certificate choices and any real sends, then complete the launch plan's pilot and repeatable white-label rollout gates.

No merge, PR, deployment, real message, hosted migration, paid resource, new cron schedule or production provider switch occurred. The existing experiment-only Vercel Git-deployment suppression remains in place.
