# Law-firm handoffs and Airtable updates — implementation record

Date: November 15, 2026.
Authority: the owner approved the conversation design and requested implementation.
Status: local implementation and required local verification passed. Hosted and real Airtable acceptance remain unverified and require approval.

## Approved design

Both features belong in the first customer launch.
Claims can come from any referring company or directly from a homeowner.
A referring company and a receiving law firm are separate relationships.
Airtable is optional. Direct claims must not require a company or connection.

### Law-firm handoff

- Add the optional `With law firm` claim stage.
- Permit a handoff for an active claim with signed representation.
- CMG staff enter the attorney's updates. Add no attorney accounts.
- Permit one active firm per claim and preserve earlier handoffs.
- Track Sent, Accepted, Lawsuit filed, Declined, and Returned.
- Keep existing settlement and closure stages.
- On decline or return, suggest the earlier stage and require staff confirmation of the correct next stage.
- Staff select summary details and original documents for a downloadable package.
- Preserve original signed PDF bytes and other document files.
- Prepare the summary PDF and ZIP locally in the authorized staff browser.
- Split large exports into parts containing at most 100 MiB of selected file content.
- Keep the reviewed package manifest and summary snapshot. Do not automatically store another hosted file copy.
- Preparing a package never marks it Sent. Staff confirm actual external sending.
- Homeowners see legal milestones and the accepted firm's contact details.
- New milestones produce brief homeowner notices with portal links, without private notes or attachments.
- Preserve Owner/assigned-adjuster management authority and AAL2 enforcement.

### Airtable

- Implement a direct, one-way connection from CMG to Airtable.
- Use a guided Connect Airtable button and scoped OAuth authorization.
- Prepare required privacy and terms pages for owner review before activation.
- Propose the current public CMG contact as the registration support address; registration still needs exact approval.
- Owners configure each company's connection, existing table, reserved CMG columns, shared-field defaults, and sending mode.
- Owners and assigned adjusters can override sharing choices and mode for their claim.
- Offer automatic selected updates, review-before-send, and automatic stages/dates with review of other items.
- Explicitly link the correct existing Airtable record before enabling any delivery.
- Send selected stages, milestone dates, agreed settlement amounts, shared messages, and selected claim details.
- Available extra claim details include homeowner contact, property/loss details, carrier/claim number, adjuster contact, and accepted-firm details.
- Keep complete dated history of messages actually sent by CMG in its reserved message column.
- Do not send original files, private staff notes, internal fee fields, credentials, or document access links.
- Do not create/delete deals or columns. Do not copy Airtable changes into CMG.
- Leave unselected cells unchanged. Do not silently clear or truncate external information.
- New connections remain inactive until review and explicit enablement.
- Enabling automatic mode does not release previously held changes without confirmation.
- Use a separate transactional update queue, prompt first attempt, daily recovery, and controlled staff Retry.
- Expose pending, sent, failed, and review-required results.
- Prevent stale retries, duplicate messages, wrong-company writes, and unapproved field expansion.
- Pause delivery on invalid access, record links, changed schema, or unexpected changes to reserved cells.
- Use a separately approved synthetic Airtable table for launch acceptance. A real company connection is not a launch requirement.

## Preserved limits

- Keep the existing cleanup block enabled.
- Preserve all logins, DNS, retained data, old fixtures, packages, and source edits.
- Create no Supabase backup.
- Keep hosting in Rob's account. Make no purchase or transfer.
- Use no Computer Use.
- Do not repeat completed unrelated one-time tests or reopen the historical build investigation.
- Preserve the queued final-email source and schedule through its approved check.
- Obtain separate approval for Git actions, new production dependency installation, database reset, hosted setup/tests, emails, and deployment.
- Do not infer approval for those actions from implementation approval.

## Execution checklist

- [x] Reconcile the approved design with current claim, partner, document, and permission architecture.
- [x] Inspect the current checkout and identify unrelated retained edits.
- [x] Request exact branch/checkout and dependency approval.
- [x] Verify current develop and prepare the approved isolated feature checkout.
- [x] Install locked dependencies with Node 22 and approved `fflate` 0.8.3.
- [x] Freeze database and module interfaces before parallel source edits.
- [x] Implement additive legal schema, atomic milestone actions, permissions, and database test source.
- [x] Implement legal staff/customer screens, package preparation, and notification integration.
- [x] Implement Airtable schema, secure OAuth connection, mapping, and configuration screens.
- [x] Implement claim controls, durable delivery, reconciliation, and recovery.
- [x] Implement reviewed public policy drafts and supporting setup documentation.
- [x] Generate database types from the new disposable schema using the project command.
- [x] Pass affected tests and permission/isolation tests.
- [x] Pass required type, lint, full unit, build, audit, and database checks for the final Airtable confirmation repair.
- [x] Verify relevant roles, site modes, desktop/mobile states, and failure behavior.
- [x] Complete independent source security and correctness review; resolve the final Airtable configuration-confirmation finding.
- [ ] Prepare exact hosted setup and synthetic acceptance approvals.
- [x] Record completed local work and remaining launch approvals.

The final Airtable confirmation repair passed focused checks, full unit tests, TypeScript, full lint, and the rebuilt application.
No hosted acceptance, commit, or deployment is claimed.
The exact hosted approval remains open until its current targets and checked commit are known.

## Initial evidence and rulings

- The source checkout is on `codex/cmg-lor-alignment` at `e86a37ec0031f4eb5122d28303ba156f57234463`.
- Its source tree is the previously reviewed candidate. Current tracked edits are retained configuration/instruction/documentation work.
- Local `develop` and `origin/develop` refs are stale. The recorded published merge object is not present locally.
- Branch setup must fetch and verify the recorded published base before creation. A changed base requires review before proceeding.
- Current normal database ports are 15420–15429. Older disposable acceptance records must also be retained.
- PATH resolves Node 24, while the project requires Node 22. Use a verified explicit Node 22 executable.
- Current `recordTransition` writes history and notices after the status write. Legal milestones need an atomic RPC instead.
- Automatic Airtable capture must occur with database changes, including changes outside the normal form handler.
- Airtable row lookup must be table-scoped. Its Get record endpoint alone does not prove membership in the selected table.

## Progress and review log

- November 15: three subagents assigned bounded source/interface/validation preparation. They have no hosted or mutation authority.
- November 15: source and current retained database state remain unchanged. No application tests have been repeated.
- November 15: the user approved both local setup requests. Fetch returned `d685032736260b1eaca57045def9edbd677da93e`, tree `37792621f7570555c548f9d05e11f99bd1675702`, identical to the reviewed candidate tree.
- Created and attached branch `codex/cmg-law-firm-airtable` at the approved scratch checkout. Original edits and packages remain intact.
- Verified the official portable Node 22.22.2 ZIP against its published SHA-256. Installed locked packages and exact `fflate` 0.8.3 in the new checkout.
- npm reported existing React Email deprecation notices and a blocked `unrs-resolver` install script. No script permission was widened.
- Three workers implement legal, Airtable, and policy/database preparation in separate file sets. Root owns document-package generation and cross-module integration.
- Root package partition, summary, permission, and bounded-file-read selections passed 20 tests in four files. An initial sandbox fork startup failed before assertions; escalated runs passed with the unchanged test configuration.
- Requested the exact new local database scope. The user then approved it. Execution evidence follows. Existing retained databases remain untouched.

## Local review results

Three independent workers implemented or reviewed the legal workflow, Airtable integration, and policy/database preparation.
Review corrections include legal-stage document retention, insurer/policy constraints, queue identity, stale source checks, lock order, and uncertain delivery barriers.
Pause and resume controls preserve stored destinations and uncertain work.
Resume requires a full review of current selected data before another external write.
The last separate pause/resume review found no actionable issue. Its SQL assertions passed in the approved isolated database.

The coordinator added package generation, bounded original-file reads, and download permission checks before and after link creation.
Package creation and downloads never record a Sent milestone.
The final package action, reader, and component selection passed 24 tests after review corrections.

Native developer access reviewed real components inside an isolated local harness with synthetic data and mocked actions.
The harness refuses real server actions and blocks external requests.
This evidence does not prove application routes, authentication, RLS, or real provider behavior.
Browser checks found form resets that lost visible selections after action results.
New tests reproduced those failures before correction.
A shared native reset listener preserves the reviewed selections; React's JSX reset handler did not prevent these commit-phase resets.
The final legal form file passed nine tests and focused lint.
Airtable mapping controls now restrict destination types to the source field's meaning.

## Combined validation status

- Initial full ESLint: passed. Final changed-file lint also passed.
- The final combined ESLint command in session `79330` completed with exit code zero. Later focused proxy/CSP lint also passed.
- High-threshold npm audit: passed, with 4 low and 8 moderate findings. No high or critical finding was reported.
- The low findings involve the existing deepmerge/react-email chain. No fix was available.
- The moderate findings involve minimatch through the existing lint dependency chain. The suggested forced change downgrades the Next lint package.
- No forced dependency update was applied.
- The initial type diagnostic failed on missing new schema. After raw generation and nullable SQL adapter updates, the full type check passed.
- New stack startup and two approved resets passed. All 1,554 pgTAP assertions passed across 48 files after a forward migration added 14 foreign-key indexes.
- Raw database types generated successfully; SHA-256 `947603FD55F2AC91B40404519A4BA18D0E981BECED96AD1A983F6D019257A9D3`. The raw file was not hand-edited.
- Database-backed CI selection passed: 279 tests, zero failures, one explicit live PandaDoc skip. All 11 mandatory database-backed files passed.
- The first CI attempt stopped during sandbox preflight. A bounded diagnostic proved Docker access was blocked there. Exact identity checks and the same selection passed with required local access.
- The proxy and CSP selection passed all 22 tests. Reserved `.localhost` hosts support separate synthetic browser sessions; hosted CSP remains unchanged.
- Final independent review found three lock-wait authority gaps in new legal RPCs. All three new regressions failed before repair.
- Forward migration `20261115031000_legal_after_lock_authority.sql` repairs those checks after row-lock waits. Independent review confirmed signatures, grants, and other behavior remain unchanged.
- Reset 3 passed. Final pgTAP passed all 1,554 assertions. The improved concurrent selection passed seven tests with no skips.
- All three reset allowances are now used. The new database remains retained.
- Full application build passed, including TypeScript and seven static pages. Feature and private routes remain dynamic.
- Pre-record-proof-repair integrated unit run: 2,030 passed, zero failed, and 73 skipped; 160 files passed and 18 skipped. Exit code zero, duration 707.08 seconds.
- Credential-dependent and explicit acceptance tests remain skipped in the credential-free unit run. Database-backed CI and seven concurrent checks passed separately.
- The seventh concurrent case was added during the full run after that opt-in file had been collected. Its separate green database run and build validate that added test; no application source changed.
- First full unit run: 2,008 passed, 5 failed, and 67 skipped; 155 files passed, 2 failed, and 17 skipped.
- Four failures were new mapping assertions. The unchanged intake-retention test exceeded its 5,000 ms deadline.
- Source changed while that first run was in progress. Its result is retained as a failure, not a release pass.
- The subsequent five-file run hit three worker-start timeouts. Its node-environment delivery and pause-action files passed 14 tests.
- A separate mapping run then passed all 10 tests. Its environment setup took 55.12 seconds; assertions took 75 milliseconds.
- The final two-file form run passed all 10 tests, including the unchanged intake retention test and four Airtable form regressions.
- In total, the five focused files passed 34 tests across those completed runs. Source, deadlines, and the shared worker configuration were unchanged during diagnosis.
- No stale task test process remained. Available physical memory was about 1.7 GiB of 31.7 GiB during the startup diagnosis.
- Vitest's unchanged worker-start deadline is 60 seconds and includes environment setup. The evidence supports slow local startup; it does not prove a permanent environment repair.
- That earlier failed integrated result was superseded by the 2,030-test pass. The final record-proof repair later passed the 2,033-test run below.

The final native browser review recorded 30 observations at desktop and 390px.
It verified the corrected forms, empty/error/loading/success states, selected package creation, and actual Unicode PDF output.
The final static-component run reported no new console warnings or errors. Its network buffer was incomplete.
The later actual-app customer reload supplied a complete successful trace, as recorded below.
See `CMG_LEGAL_AIRTABLE_BROWSER_REVIEW_2026-11-15.md` for exact evidence and harness limits.

## Final local verification

Final review found that company settings could change during a provider read after record confirmation.
The repaired action sends the sealed connection identity and configuration revision into the existing RPC.
The forward migration checks both under the connection lock and rechecks current authority after waits.
It preserves the first-update review barrier, RPC signature, grants, and existing migration files.
Three action regressions passed. Independent review found no remaining issue in this repair.
The new migration applied incrementally without a reset. SQL files 47/48 passed 105 assertions.
All ten concurrent database checks passed with no skips. Existing local browser records remain retained.
TypeScript, full lint, and the complete application build passed after this final repair.
The final diagnostic unit run passed 2,033 tests and skipped 77; 161 files passed and 18 skipped, covering all 179 discovered files.
It exited zero after 1,640.74 seconds, with unchanged assertions, timeouts, and the one-worker Windows configuration.
No other validation job ran alongside that final suite.

The first post-repair full run exited 1 after reporting 1,999 passes, zero failed assertions, and 77 skips.
Its JSON report omitted the unchanged `use-intake-upload.test.ts` file entirely.
That report's `success: true` is not a complete-suite pass; 178 of 179 files were present.
The omitted file then passed all 34 tests in 20.43 seconds under the same environment and unchanged limits.
The original missing-file cause is not established. The later complete diagnostic run passed and supersedes that incomplete run for this source.
Available physical memory during the run was about 1.56 GiB; this is context, not proof of cause.

Read-only inspection confirmed a reporting limit in installed Vitest 4.1.12.
Its JSON reporter ignores unhandled errors and the run-end reason when calculating `success` (`index.UpGiHP7g.js:3538–3552`).
The runner excludes specifications without a collected test module from the final module list (`cli-api.B0Pz1_R7.js:12668–12674`).
It separately sets exit code 1 for unhandled errors (`cli-api.B0Pz1_R7.js:13980–13981`).
These paths explain how the report can omit a file and show success while the process fails.
They do not identify this run's underlying error; its JSON contains no unhandled-error record.

The omitted file uses the same mocked upload actions and storage client as related passing form tests.
Its imports contain no observed top-level provider request or database access.
No assertion, timeout, dependency, or test configuration changed during this diagnosis.
The default reporter prints unhandled errors; the coordinator started one final full run with that reporter and retained tool output.

The approved database scope permits only the new `CMGPA_legal_airtable_disposable` stack on ports `15620–15629`.
All three permitted resets are used. Another reset requires new approval.
Neither retained local database is included.

The generated nullable function contracts are reviewed and the full type check passed.
The final permission repairs, integrated unit run, and build passed.
The final unit run passed 2,033 tests and skipped 77 explicit opt-in tests.
The separately executed concurrent selection passed all ten tests without skips.
Full and final scoped lint passed. The audit retained four low and eight moderate findings, with no high or critical finding.
Actual native-browser checks passed for five roles, all three site modes, desktop and 390px layouts, package download, errors, and retained inputs.
The package retained the original PDF bytes. Local milestones and return-to-Documenting history passed.
The complete final customer reload trace contained 28 HTTP 200 responses and no failed requests.
See `CMG_LEGAL_AIRTABLE_ACTUAL_BROWSER_2026-11-15.md` for exact evidence and limits.
The final rebuilt app started on port `4199` in `platform` mode.
Existing synthetic Owner and customer sessions still opened their legal views, with retained history and no new console warnings or errors.
One Playwright DOM read timed out; the documented native accessibility read confirmed the same healthy page without another form action.

No hosted acceptance, commit, push, deployment, email, DNS change, backup, hosting change, or cleanup has run for these features.
