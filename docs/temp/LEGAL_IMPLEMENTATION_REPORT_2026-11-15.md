# Legal workflow implementation evidence

Date: November 15, 2026.
Scope: the approved isolated `cmg-law-firm-airtable` checkout only.
Status: local legal implementation, unit checks, database checks, and actual local browser acceptance passed. Hosted acceptance remains unverified.

## Implemented behavior

- Added the optional `with_law_firm` stage without adding it to the ordinary progress ladder.
- Added a law-firm directory with Owner-only writes.
- Added retained handoffs, package snapshots, and immutable actual-date milestones.
- A signed, active claim can start preparation with or without a referring company.
- Owner or assigned adjuster can prepare and manage the handoff. Database helpers retain active-account and AAL2 checks.
- A unique partial index permits one unfinished preparation or handoff for each claim.
- Sent, Accepted, Lawsuit filed, Declined, and Returned use a locked, version-checked database operation.
- A new milestone writes claim stage, history, customer activity, audit, and one email queue record in one transaction.
- Duplicate request IDs return the recorded result. Changed request data and stale versions are refused.
- Decline and return require a confirmed next stage. The current stage at Sent becomes the return suggestion.
- Direct status updates and inserts cannot bypass Sent or return confirmation.
- Normal settlement and closure remain available. Settlement ends an unfinished handoff without inventing a legal milestone.
- An unsent preparation can be cancelled without deleting history or sending a homeowner notice.
- The cancellation action checks authority, version, duplicate request identity, and absence of any milestone.
- Homeowners receive only safe milestone dates and accepted-firm contact details. Private summary and manifest tables remain inaccessible.
- Legal progress preserves the preceding ordinary phase. An early handoff does not invent completed documentation or filing.
- Added Legal handoff and Sharing claim tabs for managers only.
- Legal actions schedule already committed Airtable work through the separate delivery module.

## Package contract

`src/lib/legal/types.ts` exports `LegalPackageSnapshot` for the coordinator's package engine and download component.

The snapshot contains package ID, claim ID, handoff ID, claim reference, preparation time, firm contact snapshot, selected summary entries, reviewed note, and selected document metadata.

Document metadata contains `id`, `name`, `mime`, `sizeBytes`, and `updatedAt`.
It contains no storage path or signed URL.

`prepare_legal_package` locks the claim and selected same-claim documents before storing the snapshot.
It accepts only the seven explicit summary categories.
It rejects empty, duplicate, foreign, or oversized document selections.

`legal_package_document(p_package_id, p_document_id)` returns:

`id, claim_id, original_name, mime, size_bytes, updated_at`

It first checks current management authority and exact persisted-manifest metadata.
The coordinator's action then uses the existing audited document-download path.
Preparation, download, and cancellation do not mark Sent.

## Database files

- `20261115010000_legal_claim_status.sql`: separate enum expansion.
- `20261115011000_legal_handoff_schema.sql`: tables, RLS, grants, immutable records, transition guards, settlement handling.
- `20261115011100_legal_handoff_actions.sql`: guarded firm, handoff, cancellation, package, milestone, and homeowner projection functions.
- `20261115011200_legal_transition_enforcement.sql`: retains existing lifecycle checks and permits transaction-backed legal return transitions.
- `20261115011300_legal_representation_retention.sql`: protects signed representation in the new stage and blocks relabelling after representation.
- `20261115011400_legal_policy_identity.sql`: expands the insurer/policy invariant before replacing its older fixed-stage constraint.
- `46_legal_handoffs.test.sql`: rollback-only synthetic database acceptance cases.
- Updated the existing schema enum expectation and filed-stage transition expectation.
- Added the three Airtable service-only ledgers to the existing no-policy allowlist, as requested by that worker.

The transition guard uses immutable milestone evidence from the current database transaction and actor.
It does not trust a client-settable session flag.
Client roles cannot insert, update, or delete legal tables directly.

The existing `claim_status_update` email template remains unchanged.
The database fixes its portal destination to the CMG application host and exact claim path.
No caller can supply another email destination link.
Existing delivery rules continue to hold this template when the customer portal is closed.

## Focused validation

All test runs used the approved portable Node 22.22.2 executable.

- Legal validation, optional progress, and status vocabulary: 30 tests passed across three files.
- Existing claim-policy and ordinary portal-progress selections: 32 tests passed across two files.
- Legal server actions, including cancellation: 11 tests passed.
- Staff legal forms and homeowner legal progress components: 7 tests passed.
- Focused ESLint over legal modules, actions, forms, route, and tests: passed.
- `git diff --check`: passed.

The initial red checks found the missing validation module and missing optional progress behavior.
An initial sandbox run later timed out while starting one Vitest worker.
The repeated selection passed outside the process sandbox with unchanged test configuration.

Three first-run action assertions failed because their test request UUID used an invalid UUID variant.
The fixture was corrected. All 11 action tests then passed.

No database command, migration, reset, hosted request, browser action, email, upload, sign-in, Git mutation, or cleanup ran in this subtask.

## Remaining verification

- Apply migrations and run pgTAP only in the separately approved disposable database.
- Generate `src/types/database.ts` with the project command. Do not hand-edit it.
- Add nullable RPC argument overrides for `save_law_firm.p_firm_id` and `record_legal_milestone.p_return_status` in `database-app.ts` after generation.
- Complete combined type, lint, full unit, build, dependency, and database checks.
- Verify actual route rendering, roles, all three site modes, desktop and 390px layouts, loading/error states, console, and network behavior.
- Complete independent review of database permissions, transaction order, and Airtable capture interactions.

The first independent review found the existing representation-deletion helper lacked the new stage.
The forward retention migration adds it and blocks signed-letter relabelling by user sessions.
The existing service-context correction exception remains unchanged.
New pgTAP cases cover both deletion and relabelling refusal.

The coordinator confirmed that an offer can be recorded while a law firm still handles the claim.
An offer retains the active handoff, contact details, and legal history.
Actual settlement closes the handoff. The staff and homeowner legal panels remain visible after an offer.

Cross-consumer review found the old insurer/policy constraint also omitted the new stage.
The forward replacement permits missing identity only in the three existing pre-representation states.
It validates the new constraint before replacing the old constraint.
Four new pgTAP cases cover null and blank insurer and policy values during the legal stage.

The status vocabulary feeds claim filters, cursor validation, cards, and dashboard counts.
The dashboard renders the legal count through its existing branch-status list.
The partner summary copies the new status and still withholds settlement figures until settlement or closure.
The ordinary e-sign dispatcher accepts only its existing pre-signing states.
Its finalizer refuses later claim stages, including the new legal stage, so late completion cannot regress the claim.
The e-sign display already treats the new stage as past representation.
No additional fixed-stage consumer gap was found during this source review.

Rendered component tests are not browser acceptance.
Database test source is not proof that its assertions pass.

## Browser-discovered form reset corrections

The coordinator found that React's action reset cleared visible package checkboxes after preparation.
The component's selected state still enabled another submission, which could then omit those documents.
The same reset changed a returned milestone back to Accepted after a refusal.

Five new tests reproduced package success/refusal resets, milestone refusal, and inactive-law-firm loss after empty or transport refusals.
The tests use real React form actions and native reset behavior.
They also inspect the next submitted FormData, rather than checking component state alone.

A JSX `onReset` handler did not fix the issue.
React disables its synthetic event handlers while its commit phase resets forms.
The shared `retainFormInputs` ref callback installs a native reset listener with removal on unmount.
Package and milestone forms use that callback.
The existing handoff ID/version key replaces the milestone form after a saved milestone.
The law-firm checkbox now distinguishes submitted values from initial values, including an omitted unchecked field.

The final focused file passed all nine tests after extraction of the shared callback.
Focused ESLint of the legal form and its test passed.
The shared callback still needs the coordinator's combined lint and type checks.
The limited diff check passed.
One intermediate run timed out on an existing test during concurrent checks; test timeouts were unchanged.
The coordinator must complete the browser recheck and final combined validation.

## Separate local browser origin

The coordinator approved a narrow loopback-host correction for new local browser sessions.
The proxy now treats reserved `.localhost` subdomains as local application hosts.
Supabase source validation, Server Actions origins, authentication, and site-mode rules remain unchanged.
Nine proxy tests exercise the real CSP path with the session updater mocked.
Two new local-host cases failed before the correction. All nine passed after it.
Hosted names and suffix lookalikes keep the hosted policy.
Focused ESLint of the proxy, test, and CSP module passed.
The combined test command could not start the existing CSP test worker. That selection needs a later rerun.
No browser session, server, fixture, database, or hosted request ran in this preparation step.

## Risks and recovery

The new application code requires the additive migrations before use.
Existing source cannot interpret claims already in the new stage.
Do not restore old application code after real legal work starts without a compatible recovery release.

If a release fails, freeze new legal writes in a corrective release and retain all tables, enum values, files, and history.
Use a forward fix after review. Do not delete legal records or invent a returned milestone to simplify rollback.
Any hosted recovery change needs separate approval.

Cleanup remains blocked. Existing logins, DNS, retained data, and packages remain unchanged.
