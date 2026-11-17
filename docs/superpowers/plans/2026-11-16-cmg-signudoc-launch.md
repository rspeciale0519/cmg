# CMG SignuDoc Launch-Readiness Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (- [ ]) syntax for tracking. This document does not authorize implementation, deployment, real sends or signatures; read the authorization section first.

**Goal:** Deliver a reliable signing experience inside CMG that can later be repeated for other public-adjusting firms, while preserving the existing PandaDoc/manual workflow and every existing agreement.

**Architecture:** Proposed starting architecture: one maintained SignuDoc fork, deployed separately for each firm with separate database, private files, branding, service credentials and signing keys. A server-side, authenticated bridge connects CMG to the signing service. CMG remains responsible for claim authorization, dispatch ownership, document filing and claim-state changes; SignuDoc handles signing.

**Tech Stack:** Current CMG: Node 22, npm, Next.js/React/TypeScript, Supabase and existing e-signature provider interface. Pinned SignuDoc experiment: Node 24, Next.js, Postgres, private object storage and captured local email; production hosting/email/certificate choices remain owner decisions.

**Spec:** ../../experiments/signudoc/FEASIBILITY_REPORT.md plus the approved product requirements below. This is a launch-readiness plan, not an approved production design.

## Authorization and current state

Authorized in this task: plan creation, preservation of the existing synthetic experiment, actual CMG contract/system diagnostics using exclusively synthetic data, and publication to the existing experiment branch. The later explicit publication instruction supersedes the initial no-push restriction. There is no authorization to merge, deploy, create paid resources, change hosted credentials/security, migrate production, email real agreements or replace PandaDoc.

- Experiment branch: spike/signudoc-white-label-2026-11-16.
- Checked base: develop at 950cb27514ce10c92a1b05a4ef87bee9fc627ca2.
- Checked upstream: SignuDoc 0.2.1 at bb9bc099151fed39da5de017d9b4cd61b124cbbd.
- Recheck these against the actual current CMG work before implementing; do not discard intervening fixes.
- Branch-only Vercel deployment suppression accompanies publication. Keep it on this experiment branch. Do not blindly merge/cherry-pick deployment configuration into other branches.
- Initial publication was verified at 890f907e5e488f2c779643115f42636d93f7d929; the experiment README records the receipt. Task 1 is complete. The subsequent authorization and current implementation checkpoint below supersede the original no-implementation planning boundary.

## Current authorized implementation checkpoint

Rob subsequently approved fixing optional authorization first and then building the CMG connection, with synthetic local testing and publication to this same experiment branch. Browser/mobile acceptance is explicitly deferred until after implementation. This does not authorize hosted changes, merge, deployment, paid resources or real agreements/messages.

- [x] Optional-authorization implementation and server/actual-contract regressions.
- [x] Authenticated CMG provider/bridge, reviewed-byte send controls, progress/reminders, private filing and fair leased worker implementation.
- [x] One independent whole-branch review; Important findings fixed and regression/full checks rerun.
- [x] Reproducible checksum-pinned service patches and implementation evidence prepared.
- [x] Full disposable Supabase stack, database-backed Vitest and official generated types on an isolated GitHub runner; see the security/database follow-up for the final strengthened verification run.
- [ ] Dependency advisory updates and the existing security/legal/operational gates.
- [ ] Browser/phone acceptance, deliberately deferred by Rob.
- [ ] Hosted pilot and white-label rollout approval/gates.

Read [current security/database follow-up](../../experiments/signudoc/SECURITY_DATABASE_RESULTS.md) and [initial implementation results](../../experiments/signudoc/CMG_CONNECTION_RESULTS.md) for exact scope, decisions and open checks. The detailed tasks below retain their individual acceptance requirements; server implementation does not close their legal, mobile, operations or rollout portions. Historical diagnostics are not current blockers after a later verified fix.

## Required product behavior

1. From a claim, the adjuster selects the appropriate firm-approved agreement; trusted homeowner/claim data prefills it.
2. Before any send, the adjuster can review the full document, agreement wording/version, recipients, signer roles and material terms.
3. CMG shows which homeowner has signed and who is outstanding, with distinct failure/expiry/reconciliation states.
4. Authorized staff can send controlled reminders without duplicating agreements or contacting a completed signer.
5. Completed signed agreement AND audit evidence are automatically filed privately with the correct claim, unchanged.
6. One- and two-homeowner signing work on actual phones and desktop browsers.
7. Each firm has its own branding, approved wording and reusable templates; customer information never crosses firms.
8. The existing CMG authorization, MFA, audit, outbox, Storage and claim-transition safeguards remain in force.

## Global constraints

- Preserve existing PandaDoc/manual behavior, in-flight envelopes, old signed documents and unrelated local work.
- No production changes follow from this plan. Each hosted/pilot/release phase has its own approval gate.
- Use synthetic claims and local capture-only email until an exact hosted test scope is approved.
- Never silently convert optional authorization to mandatory consent or omit it from a real agreement.
- Never put secrets, signing links, session cookies, actual customer data or signed legal records in GitHub evidence.
- Do not install SignuDoc's migrations into CMG's public schema or share an unrestricted database role.
- Do not use Vercel account access or a user's browser cookie as the CMG integration credential.
- New CMG schema/RLS changes require new migrations and pgTAP tests; never rewrite old migrations or hand-edit generated database types.
- Current code/configuration outrank historical status documents. Refresh decisions and exact commits before rollout.
- A green build, an HTTP mobile User-Agent, or a sealed fake PDF is not mobile/legal/production acceptance.
- No full rebuild of unrelated CMG functions or expansion into a shared-tenancy SaaS without a reviewed decision.
- Store publication/test material under docs/experiments/signudoc; code snapshots have .txt suffixes to avoid CMG TypeScript/lint/test discovery.

## Review focus: five conditions that must not slip through

- A homeowner declines optional authorization but can still complete the ordinary required agreement: Tasks 5, 14.
- A send is accepted remotely and CMG loses the response: Tasks 8, 9, 12.
- An envelope completes but artifact download/storage or CMG commit fails: Tasks 12, 13.
- A valid user/template/envelope from another firm is substituted: Tasks 4, 6, 8, 15.
- A signer/recipient, legal template, property or fee changes after adjuster review: Tasks 6, 7, 9.

## Evidence already proven and its limits

| Evidence | Proven scope | Not established |
|---|---|---|
| 286 upstream unit tests passed | Pinned upstream unit suite | Future fork or combined CMG release |
| 150 Postgres tests passed | Disposable cloud-local Postgres | Hosted CMG schema/security |
| 11 mapper tests passed | Required field mapping; default blocks optional-field mismatch | Complete legal template mapping |
| One API scenario passed, covering both one/two homeowners | Real SignuDoc HTTP handlers, nine synthetic pages, template reuse, consent, sequential signing, access refusal, replay refusal, audit edit detection | Real CMG provider, real email, phone interaction, legal signing |
| Signed PDF and certificate per fixture | Valid file signature; stored hash; self-signed certificate | Independently trusted signer identity, trusted timestamp, long-term legal sufficiency |
| Clean upstream build/typecheck passed; lint exit 0 with five warnings | Unmodified pinned SignuDoc source | CI on future production changes |
| Dependency audit: zero high/critical; one moderate affected package | Pinned installed production tree | Zero vulnerabilities or full security audit |
| Browser run blocked at Chromium Unix socket startup | Confirmed execution-environment limitation | A product browser failure or a successful mobile test |

### Later actual-CMG-contract checkpoint — 2026-11-16

See [actual contract results](../../experiments/signudoc/actual-contracts/RESULTS.md). Both real nine-page CMG assets were downloaded/hash-verified and prefilled by the unmodified actual CMG builder with fake identities, then watermarked on every page. 74 targeted CMG tests passed (72 existing + two exports). Existing claim authorization/service tests use mocks; this is not a hosted CMG or RLS integration test.

A new real SignuDoc HTTP scenario passed for required-field signing of both actual layouts (9/18 required fields). Full manifests (11/21 fields) were deliberately submitted and both failed HTTP 400: optional initials are currently prohibited. The optional sections remained blank/unexecuted in the subsequent diagnostic. This confirms Task 5 is a hard blocker, not completed agreement support.

All 18 final pages retained the original legal background images and watermark; a 2x pixel comparison found no changes outside padded signing fields. All four signed/evidence artifact seals validated; their issuers are self-signed/unknown. Local capture-only email and disposable Postgres were used; servers were stopped. Source files and production workflows were unchanged.

Actual UI testing was attempted through the managed browser but its loopback could not reach the execution environment (ERR_CONNECTION_REFUSED after the local server passed in-process readiness). Execution-side Chromium had independently failed at Unix socket startup. No phone, viewport emulation or visual signing acceptance is established. No CMG provider bridge, pending-signer screen, callback reconciliation or automatic claim filing was exercised. Dates were fixed/same-day; cross-day two-signer date behavior still needs acceptance. Production template reuse must exclude prior homeowner data.

This evidence advances diagnosis only. Tasks 5–17 and all pilot/rollout gates retain their acceptance requirements; do not mark them complete from this partial scenario.

No combined CMG/SignuDoc production readiness percentage is assigned.

## File map for the implementation phase

Exact new names below are proposed interfaces for the implementation, not existing files or completed code. Confirm consistency with current CMG before starting. Avoid editing large upstream modules beyond the necessary behavior.

**CMG existing sources to review**
- src/lib/esign/types.ts, provider.ts, config.ts, send-lor.ts, lor-dispatch.ts.
- src/lib/esign/lor-pdf.ts and lor-tag-manifest.json; existing approved PDF sources.
- Existing webhook/ledger/Storage/outbox modules and their tests.
- Current claim representation UI and status transition SQL: locate via source search; record exact paths in Task 2.
- README.md, docs/RELEASE_STATE.md, docs/temp/HANDOFF.md, docs/temp/BLOCKERS.md, docs/RETENTION.md and .cursor/skills/verify-cmg/SKILL.md.

**Proposed new CMG units**
- src/lib/esign/signudoc/contracts.ts: runtime-validated, versioned data/status contracts.
- src/lib/esign/signudoc/client.ts: configured-origin authenticated transport; no arbitrary URLs.
- src/lib/esign/signudoc/provider.ts: ESignProvider adapter, feature-disabled by default.
- src/lib/esign/signudoc/template-map.ts: versioned firm/template/claimant mapping.
- src/lib/esign/signudoc/reconcile.ts: durable state and artifact reconciliation.
- src/app/api/signudoc/webhook/route.ts: dedicated raw-body verified ingress.
- Co-located *.test.ts and necessary new supabase/tests/*.test.sql.
- New timestamped supabase/migrations SQL, filename allocated after current head inspection.
- docs/reference/signudoc/ for the approved contract and operational runbooks.

**SignuDoc fork**
- src/lib/schemas/field.ts; signing.ts; field-choices.ts; services/pdf-finalize.ts.
- src/components/envelopes/prepare-live-shell.tsx and signing/signing-live-shell.tsx.
- envelopes.ts, templates.ts, settings.ts, retention/export modules where changes are actually necessary.
- Proposed src/app/api/internal/cmg/v1/... routes and src/lib/cmg-bridge/ contract/auth/replay/dispatch/artifact modules.
- New forward migrations plus focused unit/database/browser tests; no edits to applied upstream migrations.

## Stable proposed integration contract

Define exact schemas in Task 8 before both sides are implemented:

- SigningContext = server-derived firmId, claimId, authorizedActorId and operation permissions.
- AgreementDraft = context + dispatchAttemptId + idempotencyKey + approved templateId/templateVersion/templateHash + sourcePdfHash + ordered signer roles/identities + trusted prefill values + reviewed terms hash.
- DraftResult = providerInstallationId + envelopeId + immutable revisionHash + draft state.
- DispatchResult = same identifiers + sent | uncertain; a transport timeout never implies failed delivery.
- EnvelopeSnapshot = same identifiers + provider state + per-signer state + artifact availability + revision/sequence.
- CompletionEvidence = originalPdfHash + signedPdfHash + auditCertificateHash + signer completion evidence + source envelope/revision identifiers.
- Unrecognized state/version, conflicting duplicate identifiers or an unbound firm/envelope mapping fail closed.

Never accept tenant/claim routing solely from a callback's user-supplied metadata.

## Ordered work

### Task 1 — Preserve and publish the reviewable experiment
**Owner:** coordinating engineer. **Depends on:** none. **Deliverable:** inspectable branch, sources, evidence and intake instructions.

- [x] Record current CMG/upstream SHAs, original reports and successful test evidence.
- [x] Keep the synthetic fixtures visibly labeled NOT A LEGAL AGREEMENT; retain MIT/third-party notices.
- [x] Package replayable mapper/harness source snapshots and checksums without runtime databases, credentials, customer content or link-bearing outbox/trace files.
- [x] Validate the branch-only no-deployment setting, secret scan and exact changed-file scope.
- [x] Publish to the authorized experiment branch and independently read back all 24 files at 890f907e5e488f2c779643115f42636d93f7d929. Record the receipt.

**Acceptance/tests:** source snapshots regenerate a separate experiment outside the CMG checkout; file hashes match; no application source or dependency change; only the exact experiment branch is updated; develop remains unchanged. No merge/PR/deploy is part of this task.

### Task 2 — Fit the work into CMG's actual development process
**Owner:** CMG engineering lead. **Depends on:** 1. **Deliverable:** reconciled baseline and bounded approved design.

- [ ] Read current repository/global instructions and release state; identify active related branches/PRs and unfinished claim/signing work.
- [ ] Map current representation UI, authorization wrapper, dispatch lease, transition SQL, outbox and document visibility to exact source paths.
- [ ] Decide with Rob whether one isolated installation per firm is the initial architecture; list integration, pilot and product-rollout milestones separately.
- [ ] Record required agreement categories, fees, signer roles, reminder behavior and exact operator permissions.
- [ ] Approve a technical design and task owners before implementation; preserve this experiment rather than replacing ongoing release work.

**Acceptance/tests:** every proposed edit has an owning task and a current base; no duplicate implementation; no feature switches automatically activate SignuDoc. This plan is not approval of the design.

### Task 3 — Establish the maintained SignuDoc fork and clean baseline
**Owner:** signing engineer. **Depends on:** 2. **Deliverable:** pinned, supportable fork.

- [ ] Preserve MIT and all bundled font/PDF.js notices; define how updates are reviewed and tested.
- [ ] Add failing/relevant cryptographic regression tests before changing the flagged dependency.
- [ ] Triage/update node-forge 1.4.2 to the reviewed patched version or document any unresolved exposure; never auto-upgrade all packages.
- [ ] Run locked install, upstream unit/database suites, lint, typecheck, production build and production dependency audit on the same fork commit.
- [ ] Record intentional differences and review-only commits; do not enable unattended upstream auto-merge/migrations.

**Acceptance/tests:** no unaccepted high/critical finding, moderate findings disposition recorded, valid/invalid/tampered PDF tests pass; exact source/lockfile recorded. Current pinned test totals are reference evidence, not a threshold to game.

### Task 4 — Prove per-firm and environment separation
**Owner:** platform/security engineer. **Depends on:** 2–3. **Deliverable:** two isolated synthetic firms and an environment/resource matrix.

- [ ] Define separate firm database roles/databases, private stores, keys, sender domains and access policies.
- [ ] Separate development, test, Preview and Production; keep real credentials out of builds and preview copies.
- [ ] Lock initial setup against first-visitor takeover and restrict operator account enrollment.
- [ ] Test firm A accounts, tokens, template IDs, file IDs and callbacks against firm B, including export, verification, admin and cleanup paths.
- [ ] Test firm-scoped restore/update operations and prove they do not affect the other firm.

**Acceptance/tests:** all cross-firm reads/writes fail without revealing existence; no global branding/settings leak; no shared unrestricted secrets. Creating hosted resources requires later exact approval, so begin with local disposable installs.

### Task 5 — Preserve optional authorization correctly
**Owner:** signing engineer; counsel reviews semantics. **Depends on:** 3, approved document requirements from 2. **Deliverable:** correct optional initials/date support.

- [ ] Write failing tests for declining optional authorization while completing all nine ordinary required fields; cover one and two homeowners.
- [ ] Update schema, editor, remaining-field calculation, server validation and PDF rendering consistently.
- [ ] Keep required fields required; optional blanks stay blank and never inherit another initial/date.
- [ ] Test explicitly choosing authorization, leaving it unselected, missing paired values, reload and second-homeowner behavior.
- [ ] Review final PDFs against approved wording; remove the prototype's required-only bypass from any production pathway.

**Acceptance/tests:** Single preserves its two optional fields and Dual its three at the checked manifest revision, or a newly approved manifest supersedes them. No copied/synthesized consent; no hidden mandatory authorization. This is a hard gate for using the actual CMG agreements.

### Task 6 — Build firm branding and reusable approved templates
**Owner:** signing/UI engineer plus firm legal owner. **Depends on:** 4–5. **Deliverable:** immutable versioned templates for each supported agreement/signer count.

- [ ] Store firm branding, support/reply address, approved wording and role-specific template definitions.
- [ ] Map PDF page dimensions/coordinates using the actual approved document; keep one- and two-homeowner assignments separate.
- [ ] Bind template version, document hash, fee/agreement category and firm to each envelope; later edits create a new version.
- [ ] Verify template reuse never carries prior customer data or signatures into the next claim.
- [ ] Test foreign-template access, long/Unicode names, missing second homeowner, page rotations, crop boxes and amended wording.

**Acceptance/tests:** every field is legible and correctly assigned on every page; no silent text truncation; each firm sees only its own identity/content. A template changed after review invalidates that send review.

### Task 7 — Add claim-based selection, prefill and adjuster review
**Owner:** CMG application engineer. **Depends on:** 2, 5–6. **Deliverable:** a reviewable agreement from a claim, with no automatic send.

- [ ] Add tests for owner/assigned staff permission and AAL2; deny unauthorized direct server-action calls.
- [ ] Populate homeowner names/contact details, property, carrier/policy/claim, agreement category and saved fee from trusted claim records.
- [ ] Block missing/ambiguous fields, stale claim values and unsupported characters rather than substitute misleading text.
- [ ] Show all pages, recipients/roles, terms/version and fee; require explicit send confirmation.
- [ ] Revalidate a reviewed snapshot at send time; any changed recipient, fee, property or template requires fresh review.

**Acceptance/tests:** the adjuster can select the agreement and inspect accurate prefilling; browser-supplied price/fee/tenant IDs cannot override trusted data; drafting never advances the claim to sent/signed.

### Task 8 — Implement the authenticated bridge and durable request contracts
**Owner:** integration/security engineer. **Depends on:** 4, 6–7. **Deliverable:** versioned server-to-server draft/status/artifact API.

- [ ] Finalize the contract above with runtime validation, bounded sizes and configured service origins.
- [ ] Implement per-firm authentication, method/path/body binding, bounded time skew, key identifiers and constant-time checks.
- [ ] Persist nonce/request-id/idempotency body hashes; distinguish exact retries from conflicting reuse.
- [ ] Enforce capabilities on create/send/status/artifact/reminder operations; never trust caller metadata as authorization.
- [ ] Test missing/wrong/revoked credentials, tampering, old timestamps, duplicate/concurrent requests, foreign firm IDs and arbitrary URL injection.

**Acceptance/tests:** the same logical retry returns its original result; changed-payload reuse fails; no public unauthenticated bridge; no browser token/hosting-admin credential required. Authentication/key choices and rotation overlap are documented, not improvised in routes.

### Task 9 — Make create/send reliable through failures
**Owner:** integration engineer. **Depends on:** 7–8. **Deliverable:** persistent dispatch with safe reconciliation.

- [ ] Add failing tests for crash before/after draft creation, before send, after remote send and before response receipt.
- [ ] Create drafts separately from sending, bind them to a durable dispatch attempt, and persist provider identity/before-send intent.
- [ ] On an uncertain response, mark uncertain and inspect the existing envelope; never automatically create/send another.
- [ ] Handle concurrent clicks, retries, stale drafts, changes after review and operator correction with one authoritative state machine.
- [ ] Reconcile send evidence before recording CMG sent state or notifying its normal outbox.

**Acceptance/tests:** no duplicate agreements/emails from tested retries/races; no "failed" label that invites an unsafe resend after remote acceptance. Precisely define the provider's own email-delivery uncertainty and retry behavior.

### Task 10 — Add provider-neutral CMG persistence and migration
**Owner:** CMG/database engineer. **Depends on:** 2, 8–9. **Deliverable:** backward-compatible mapping and feature-disabled provider.

- [ ] Inspect current schema/history and migration order; choose a generic firm/provider/envelope/revision/attempt mapping.
- [ ] Add new migration/RLS/constraints; retain existing PandaDoc fields, documents and references.
- [ ] Extend validated provider configuration/types and ESignProvider without changing the default manual/PandaDoc selection.
- [ ] Add pgTAP and database integration tests for role boundaries, uniqueness, state transitions and old-record compatibility.
- [ ] Rehearse migration, app compatibility and corrective rollback in a verified disposable database; regenerate database types via the repository command.

**Acceptance/tests:** old signing flows still pass with the new feature off; no new production provider activates from an incidental environment variable; no migration repair falsely marks SQL applied.

### Task 11 — Show outstanding signers and controlled reminders
**Owner:** CMG/UI engineer. **Depends on:** 8–10. **Deliverable:** useful claim signing panel and safe reminders.

- [ ] Display each required homeowner with pending/notified/viewed/signed/declined/expired states when supported; label unavailable evidence rather than invent it.
- [ ] Distinguish sent, partially signed, awaiting artifacts, completed, uncertain and failed.
- [ ] Allow authorized reminder requests with durable deduplication, throttling and the correct current recipient.
- [ ] Test manual and scheduled reminders; stop them for completed, declined, voided or expired envelopes.
- [ ] Ensure recipient corrections/reissues invalidate stale signing links and require review; never reuse another person's signature.

**Acceptance/tests:** an adjuster can identify exactly who is outstanding; reminders do not resend the agreement, duplicate email or reach a completed/old recipient. Reminder defaults, maximum frequency and escalation are approved in Task 2.

### Task 12 — Track provider events and recover missed updates
**Owner:** integration engineer. **Depends on:** 8–10. **Deliverable:** authenticated, replay-safe callback ingestion plus reconciliation.

- [ ] Implement dedicated raw-body verification and durable inbox/lease handling.
- [ ] Bind every event to the stored firm, installation, envelope, revision and active dispatch attempt.
- [ ] Reject stale/conflicting events and tolerate duplicate/out-of-order events without reverting newer truth.
- [ ] Add an authenticated polling/reconciliation fallback for delayed/lost callbacks and uncertain sends.
- [ ] Inject crashes, lease expiry, conflicting replays and incomplete provider state.

**Acceptance/tests:** replay never duplicates state/file/outbox effects; old envelope events cannot complete a new attempt; a callback alone cannot mark a claim signed before valid final artifacts exist.

### Task 13 — File final agreement and audit evidence automatically
**Owner:** CMG/storage engineer. **Depends on:** 10, 12. **Deliverable:** private, immutable completed record attached to the correct claim.

- [ ] Verify every required signer and the exact approved document revision are complete.
- [ ] Download only configured-origin artifacts with size/time/type limits; verify signature/integrity, expected hashes and evidence binding.
- [ ] Save original final bytes and audit certificate privately; retain manifest/provider identifiers and controlled permissions.
- [ ] Only after durable storage succeeds, record completion through CMG's existing transition/audit/outbox guarantees.
- [ ] Test failed downloads, partial writes, malformed/truncated PDFs, wrong claim/firm files, missing certificate, duplicate completion and retry after Storage/database failure.

**Acceptance/tests:** signed agreement and audit evidence are both retrievable by permitted staff/homeowner audiences; foreign users are refused; files are not regenerated/flattened after signing; failures remain recoverable and never falsely complete a claim.

### Task 14 — Perform actual phone and desktop signing acceptance
**Owner:** QA plus owner-approved synthetic signers. **Depends on:** 5–13. **Deliverable:** recorded end-to-end browser evidence on the final candidate.

- [ ] Use a working browser environment; do not continue treating the previous sandbox socket failure as passed.
- [ ] Complete one homeowner, then two distinct homeowners on actual supported phones and desktop browsers; cover narrow 390px layout and keyboard accessibility.
- [ ] Test typed and drawn signatures/initials, zoom/scroll, consent accept/decline, all pages and final downloads.
- [ ] Test optional authorization chosen/declined, incomplete fields, wrong signer, back/refresh, lost connection, expiry and recipient correction.
- [ ] Inspect every finished PDF page and certificate for field identity, wording, dates, placement, clipping and preserved signatures. Include a send on one day and completion on another, two homeowners completing on different days, timezone differences and the approved date policy; fixed same-day prefill is insufficient evidence.

**Acceptance/tests:** actual tap/draw/finish/download behavior works; the second homeowner cannot edit the first's fields. A mobile User-Agent or programmatic HTTP success is insufficient.

### Task 15 — Review security, privacy and evidence trust
**Owner:** independent security reviewer; counsel owns legal conclusions. **Depends on:** 4–14. **Deliverable:** reviewed threats, fixes and accepted residual risks.

- [ ] Test direct route/server-action authorization, firm boundaries, CSRF/session controls, signer-link strength/expiry, enumeration, request limits and rate limits.
- [ ] Confirm signing tokens, credentials and documents are absent from logs, referrers, analytics, repository, previews and test artifacts.
- [ ] Review upload/PDF parsing limits, malicious documents, file access, seal-key protection, secret rotation and dependency advisories.
- [ ] Decide whether self-signed seals are acceptable or a trusted certificate/timestamp is needed; verify full-file signatures and altered-file refusal in an independent reader.
- [ ] Test audit modification/deletion/reordering/truncation and independent archival; state limits against a privileged database operator.

**Acceptance/tests:** no open blocking vulnerability; unresolved risks explicitly accepted by responsible owners; no claim that an installation seal alone identifies a homeowner or establishes legal enforceability.

### Task 16 — Finish operational controls and recovery
**Owner:** operations lead plus firm owner. **Depends on:** 4, 10–15. **Deliverable:** tested support/retention/recovery runbook.

- [ ] Approve retention, legal hold, export, deletion, data-request ownership and support/reply handling.
- [ ] Test backup and restore together for database, signed files, certificates, evidence and required keys, without touching another firm.
- [ ] Verify reminder/reconciliation/cleanup jobs, authentication, monitoring, queue age, error alerts and quota behavior.
- [ ] Test revoked/rotated keys, expired certificates, unavailable email/storage/database and missing artifacts; keep manual recovery safe.
- [ ] Define observable service targets, accepted recovery-point/time limits and who responds; no invented backup promise.

**Acceptance/tests:** restore retrieves unchanged signed bytes and matching evidence; holds prevent every destructive cleanup path; partial failure raises an actionable alert; quota exhaustion cannot silently lose agreements.

### Task 17 — Pass the complete combined CMG release checks
**Owner:** CMG release engineer. **Depends on:** 5–16. **Deliverable:** one reviewed candidate with same-commit evidence.

- [ ] Reconcile current develop and release work; review all code/migrations together with SignuDoc disabled and enabled.
- [ ] Run affected tests, root type-check/lint/full unit/build, required dependency audits and the database-backed e-signature/webhook/Storage suites.
- [ ] Run pgTAP/reset only after confirming disposable data and required reset approval.
- [ ] Check SITE_MODE=simple, staff and platform, relevant roles, AAL2, errors/loading states and desktop/mobile UI.
- [ ] Record exact candidate/upstream/dependency/migration hashes and every skipped test; update HANDOFF/RELEASE_STATE accurately.

**Acceptance/tests:** required checks pass on the same candidate; no unrelated CMG regression or unaccepted skip. Tests must prove real persistence and negative access, not only mocked happy paths.

### Task 18 — Prepare an approved protected nonproduction deployment
**Owner:** platform/release lead. **Depends on:** 2–4, 15–17; explicit resource/deploy approval. **Deliverable:** protected synthetic-only pilot environment.

- [ ] Confirm hosting/team, database/store isolation, costs, region, verified sender and exact test recipients.
- [ ] Approve resources/secrets and deployment scope before enabling branch deployment; leave existing experiment suppression intact until that separate decision.
- [ ] Apply reviewed nonproduction migrations, deploy exact versions and prove no production credentials or customer records leaked.
- [ ] Keep outgoing email restricted to the approved synthetic recipients; verify real inbox receipt/replies and provider failures.
- [ ] Repeat synthetic single/dual CMG-driven draft/review/send/sign/file/status flows and inspect evidence after failures.

**Acceptance/tests:** hosted real integration works with synthetic data; invitation and completion receipt are verified; existing PandaDoc production remains untouched. No use of an unapproved paid plan.

### Task 19 — Complete firm legal and operating acceptance
**Owner:** CMG/firm owner and legal counsel; engineering supplies evidence. **Depends on:** 6, 14–18. **Deliverable:** documented approval for the exact real-use scope.

- [ ] Review every applicable agreement category, fee, required disclosures, cancellation/consumer notices, electronic consent and signer authority.
- [ ] Confirm identity-verification level, optional authorization and multi-homeowner treatment fit actual use.
- [ ] Review privacy/vendor terms, certificate/timestamp decision, retention/hold obligations and evidence access.
- [ ] Approve sender/reply/support ownership, spending limit, staff training and incident/recovery procedures.
- [ ] Specify pilot participants, permitted real agreement, recipients, date/window and go/no-go owner.

**Acceptance/tests:** responsible owners approve exact versions and operating decisions; engineering does not supply legal conclusions or sign for customers.

### Task 20 — Run the limited CMG pilot and release decision
**Owner:** CMG operations plus release engineer. **Depends on:** 18–19; exact real-data/send/signing approvals. **Deliverable:** evidence-backed CMG launch recommendation.

- [ ] Start with an explicitly approved small CMG cohort; preserve all in-flight PandaDoc agreements.
- [ ] Have staff review recipients/terms and actual authorized homeowners perform their own signatures.
- [ ] Verify delivery, outstanding-signer view, reminders, final unchanged artifacts, claim status and visibility end-to-end.
- [ ] Check agreed monitoring/recovery criteria and resolve any mismatches before expanding.
- [ ] Obtain written launch approval for the exact app/provider/migration version and rollout window.

**Acceptance/tests:** no lost/duplicate agreement, misassigned signer, cross-claim file or unsupported automatic completion; all required evidence attached; there is a clear release decision, not an assumed launch.

### Task 21 — Launch with controlled rollback and observation
**Owner:** release lead and CMG owner. **Depends on:** 20 and explicit production approval. **Deliverable:** controlled CMG production operation.

- [ ] Verify production targets, usable restore evidence and feature settings; apply compatible migration/app/provider changes in reviewed order.
- [ ] Enable SignuDoc only for the approved firm/new dispatches; keep legacy/in-flight agreements on their original provider.
- [ ] Run approved smoke checks and observe authentication, send/reconcile queues, artifact filing, reminders, privacy and failure alerts.
- [ ] If release triggers fail, disable new dispatches and reconcile existing envelopes before changing routing; do not resend blindly or delete signed evidence.
- [ ] Record exact deployed versions, accepted limitations and handover; keep the former path available as defined.

**Acceptance/tests:** production remains within approved service/recovery criteria; rollback changes future routing without losing or duplicating in-flight documents. New live tests remain scoped and separately approved.

### Task 22 — Make white-label onboarding repeatable
**Owner:** product/platform lead. **Depends on:** successful CMG pilot and chosen support model. **Deliverable:** repeatable per-firm setup and acceptance kit.

- [ ] Parameterize provisioning, least-privilege credentials, branding, domain/email, template versions and support ownership from one maintained codebase.
- [ ] Add a new firm's legally approved agreement wording and role mapping; do not copy CMG wording as automatically suitable.
- [ ] Use a second synthetic firm to test clean onboarding, cross-firm refusal, updates, export, restore, offboarding and incomplete provisioning.
- [ ] Document costs/capacity, update/migration cadence, certificate ownership, incident responsibilities and data-return/deletion policy.
- [ ] Require the same nonproduction, legal, pilot and go-live gates per firm; do not bulk-enable paying firms after CMG alone passes.

**Acceptance/tests:** an engineer can provision the next firm from the checklist without editing another firm's records; failures leave no public unclaimed install or shared secret. Shared multi-firm hosting is a separate architecture decision, not a shortcut.

## Test commands and expected evidence

Use the actual current package scripts; these are the checked conventions, not permission to execute them on production.

| Component | Command/check | Passing evidence |
|---|---|---|
| Archived mapper | Materialize outside repo; node --test prototype/field-map.test.mjs | Eleven archived checks pass; no production interpretation |
| SignuDoc fork | npm ci --ignore-scripts; npm test; npm run test:db; npm run typecheck; npm run lint; npm run build | Exact fork/lockfile SHA and exits recorded; warnings/skips classified |
| Production dependency tree | npm audit --omit=dev --json | Advisory dispositions recorded; threshold alone is not complete security review |
| CMG | npm run type-check; npm run lint; npm test; npm run build | Same candidate, all required checks pass |
| CMG database | npm run db:reset and npm run db:test only on verified disposable data after required approval | Migration/RLS/state/uniqueness tests pass |
| CMG integration | Current CI's database-backed e-signature/webhook/Storage selection, extended for SignuDoc | Actual DB/Storage failure/replay/cross-role cases pass |
| Browser | Approved Playwright/browser suite plus actual phone acceptance | Captured actions/results, actual sizes, no synthetic User-Agent substitution |
| PDFs | Independent pdfsig/reader and page-by-page review | Correct signer fields/terms, intact bytes/signature, trust status honestly recorded |
| Recovery | Restore complete synthetic firm into isolated resources | Matching document/evidence hashes and correct access/queues |

For implementation tasks, follow a red/green cycle: name the failing behavior, run it and capture the expected failure, make the smallest change, run focused tests, then the task's necessary broader checks. Review and commit only that task's files on the authorized branch. Passing a modified assertion or increasing timeout alone does not close a defect.

## Unresolved decisions register

| Decision | Proposed direction | Must be settled before |
|---|---|---|
| Per-firm isolation | Separate installations from one maintained fork | Task 4 |
| Hosting/team/region and operating budget | Use adequate existing capacity if appropriate; no free commercial-hosting assumption | Task 18 |
| Service accounts/authentication/key rotation | Per-firm server-to-server credentials; no shared user cookies | Task 8 |
| Agreement wording/categories/fees/role rules | Firm/counsel-approved immutable versions | Tasks 6, 19 |
| Optional authorization behavior | Preserve true choice; counsel reviews dependencies/date | Task 5 acceptance |
| Signer identity checks and certificate/timestamp trust | Risk-appropriate level; distinguish tamper evidence from identity | Tasks 15, 19 |
| Reminder cadence, maximum attempts, correction/reissue policy | Bounded, deduplicated; stop on terminal state | Task 11 |
| Retention, holds, exports, deletion and backup/recovery | Document and test explicit firm policy | Task 16 |
| Pilot recipients/data/window and who may sign | Owner-approved exact scope; actual signer acts personally | Tasks 18, 20 |
| New provider rollout/fallback and release ownership | Feature flag for new dispatches; preserve in-flight provider | Tasks 20–21 |
| White-label support, resource ownership and offboarding | Explicit responsibility/cost matrix per firm | Task 22 |

Developers can decide routine implementation details within the reviewed design; they must not invent legal policy, spending authorization or customer identity.

## Launch gates

- **Gate A — Reviewable experiment:** Task 1 verified remotely. Allows CMG development intake only.
- **Gate B — Complete local integrated candidate:** Tasks 2–17 pass, including optional consent, actual browser/phone flows, security and recovery. Allows requesting protected hosted testing.
- **Gate C — Protected hosted pilot:** Task 18 passes with approved synthetic scope and isolated resources.
- **Gate D — Permission for limited real CMG pilot:** Task 19 approvals complete. No real agreement is sent solely because Gate C is green.
- **Gate E — CMG production launch:** Task 20 passes and exact production rollout is approved; execute/verify Task 21.
- **Gate F — Repeatable white-label release:** Task 22 independently passes for each new firm, including its own wording, privacy and operating decisions.

No gate substitutes for the next one's approval. Passing local signing tests does not open Gate E.

## Completion tracking

For every task retain: status, owner, dependencies, current candidate SHA, environment, exact fixture/recipient scope, required approval, expected result, actual result, evidence path, blockers and next action. Use NOT STARTED / IN PROGRESS / BLOCKED / VERIFIED / OWNER DECISION; never derive percent complete from elapsed time.

A task is VERIFIED only when its acceptance checks pass. Reuse unchanged valid evidence rather than repeating consumed real sends/signatures. Changes after a pass trigger targeted regression. Record a missing evidence item as blocked, not silently done.

## Plan self-review

- All eight requested product behaviors map to Tasks 6–14 and the CMG pilot.
- Preservation/publication, independent-source updates, optional consent, mobile acceptance, separation, branding/templates, certificate/audit/security, operations/legal, CMG pilot and repeatable rollout each have explicit owners/dependencies/checks.
- Review-focus cases are assigned to concrete tasks.
- The provider contract uses one naming scheme across draft, dispatch, snapshot and completion.
- Real implementation, legal/hosting decisions and rollout remain gated. This task publishes only review material plus experiment-branch deployment suppression.
