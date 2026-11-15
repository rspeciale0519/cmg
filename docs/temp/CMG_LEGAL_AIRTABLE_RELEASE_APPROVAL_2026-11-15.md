# Legal handoff and Airtable: future release approvals

Prepared November 15, 2026. This record grants no approval.
Do not send an approval request until its pending evidence and exact targets are complete.

## Current facts

- Repository: `rspeciale0519/cmg`.
- Local branch: `codex/cmg-law-firm-airtable`.
- Base commit: `d685032736260b1eaca57045def9edbd677da93e`.
- Integration and Production branch: `develop`.
- Feature changes remain uncommitted. The final commit, pull request number, and Preview URL remain pending.
- Keep hosting in Rob's existing `cmgps` project. Confirm its exact project identity before any hosted action.
- After the third approved reset, all 1,554 pgTAP assertions and seven concurrent database checks passed.
- Final review found an Airtable confirmation race. Forward repair `20261115032000` passed 105 affected SQL assertions and all ten concurrent checks.
- This repair applied incrementally to the same isolated database. It did not reset retained browser fixtures.
- All three approved resets are used. Another reset needs new approval.
- Final build, TypeScript, and full lint passed. Final full unit tests passed: 2,033 passed and 77 skipped, exit zero.
- Actual local role, site-mode, desktop/mobile, package, and final network checks passed. See the actual browser acceptance record.
- Hosted migration history, current deployment, and feature Preview settings have not been checked under this record.

The coordinator checked the public [Vercel cron limits](https://vercel.com/docs/schedules/cron-jobs/usage-and-pricing) today.
Hobby permits 100 cron jobs per project, once per day, with execution within the configured hour.
The new `15 15 * * *` schedule meets those schedule limits. Function usage limits still apply.
This public check does not verify Rob's current account settings. No paid upgrade is approved.

## 1. Local commit approval

Use the exact file list and completed checks in `CMG_LEGAL_AIRTABLE_LOCAL_COMMIT_APPROVAL_2026-11-15.md`.
Request one local commit on `codex/cmg-law-firm-airtable`.
Proposed title: `Add legal handoffs and optional Airtable updates`.
Record the resulting commit and source tree IDs.
Preserve all unrelated edits, branches, packages, and local fixtures.
This approval must exclude pushing, pull requests, deployment, and hosted tests.

## 2. Hosted migration and Preview approval

Complete this approval before any push that can start an automatic Preview build.
First prepare the exact Supabase project ID, current migration head, Vercel project ID, branch scope, and Preview address.
Do not infer those targets from historical release entries.
If Preview shares the existing CMG database, state that these migrations also change the database used by Production.
The code deployment and database change are separate effects.

Request the reviewed migration set below, in ascending order, followed by the exact branch Preview setup and one automatic build.
Attach the final migration hashes and checked commit before asking.
Stop on unexpected hosted history, changed source, a migration error, or failed checks.
Do not reset the hosted database or skip a failed migration.

| Order | Migration |
| --- | --- |
| 1 | `20261115010000_legal_claim_status.sql` |
| 2 | `20261115011000_legal_handoff_schema.sql` |
| 3 | `20261115011100_legal_handoff_actions.sql` |
| 4 | `20261115011200_legal_transition_enforcement.sql` |
| 5 | `20261115011300_legal_representation_retention.sql` |
| 6 | `20261115011400_legal_policy_identity.sql` |
| 7 | `20261115020000_airtable_schema.sql` |
| 8 | `20261115020100_airtable_capture.sql` |
| 9 | `20261115020200_airtable_controls.sql` |
| 10 | `20261115020300_airtable_delivery.sql` |
| 11 | `20261115020400_airtable_oauth.sql` |
| 12 | `20261115020500_airtable_pause.sql` |
| 13 | `20261115030000_legal_airtable_foreign_key_indexes.sql` |
| 14 | `20261115031000_legal_after_lock_authority.sql` |
| 15 | `20261115032000_airtable_record_proof_guard.sql` |

Apply and verify the enum migration before SQL that uses `with_law_firm`.
Apply all new schema before deploying the application that uses it.
Keep `AIRTABLE_ENABLED=false` in Production and the initial Preview.
Use `SITE_MODE=platform` for approved private Preview acceptance.
Bind `NEXT_PUBLIC_SITE_URL` to the actual approved Preview address.
List each environment change explicitly. Do not copy or expose existing secret values.
Keep the policy publication flag unset until its separate approval.
No application form submission, new login, upload, email, or provider call is included here.

## 3. Push and draft review approval

Request the exact checked commit push to `origin/codex/cmg-law-firm-airtable`.
Request one draft pull request targeting `develop` in `rspeciale0519/cmg`.
Include the prepared title, description, test evidence, known limits, and migration order.
Allow the normal GitHub checks against a temporary database.
Allow the automatic Preview only after approval 2 is complete.
If the push can deploy before that prerequisite, stop. Do not change deployment settings without exact approval.
This approval excludes merge, Production code deployment, and hosted application tests.

## 4. Policy, OAuth, and synthetic acceptance approvals

Prepare separate exact scopes for registration/setup and test execution.
A real referring company or its Airtable records is not required for acceptance.
Use an approved synthetic CMG company and an approved synthetic Airtable base, table, fields, and existing records.
Record their IDs, chosen field values, action counts, expected results, and retention limits before asking.
Fixture creation requires its own listed approval. The application cannot create Airtable records or columns.

### Registration and setup

- Obtain approval for the Privacy and Terms text and its public URLs.
- Publishing this policy version requires `CMG_PUBLIC_POLICIES_APPROVED=2026-11-15`.
- Confirm the registration owner, support address, exact callback, and synthetic base access.
- The callback must use HTTPS and end in `/api/integrations/airtable/callback`.
- Request only `data.records:read`, `data.records:write`, and `schema.bases:read`.
- Prepare `AIRTABLE_CLIENT_ID`, `AIRTABLE_CLIENT_SECRET`, `AIRTABLE_REDIRECT_URI`, and `AIRTABLE_TOKEN_ENCRYPTION_KEY` through approved secret entry.
- The encryption key must contain 32 random bytes encoded as base64. Keep it stable and server-side.
- Do not print secrets or store them in this record.
- Keep Airtable disabled until OAuth registration and policy publication have exact approval.
- Then request `AIRTABLE_ENABLED=true` for the exact acceptance Preview only. Production remains false.
- Obtain any required Owner sign-in approval separately. Preserve existing logins unless an exact exception is approved.

### Synthetic acceptance

Prepare a bounded execution list for the approved synthetic records.
Include OAuth consent, selected base/table discovery, compatible column mapping, and exact record-link confirmation.
Check the three sending modes and confirm that unselected cells remain unchanged.
Check shared-message history, stale-review refusal, controlled retry, and pause/resume review.
Use safe synthetic provider failures only under an explicit scope. Never expand permissions to force a test to pass.
Record whether each action can make an immediate write or leave work for automatic recovery.
Stopping observation does not cancel an already authorized queued request.
Retain all records and provider results. Reconcile uncertain results before any further write.

Preview legal checks need their own exact claim, account, document, and action scope.
Preparing or downloading a package does not send it to a law firm.
Recording a legal milestone creates a homeowner notice in the shared email queue.
The existing Production job can send that notice even when the action occurred in Preview.
Do not record hosted test milestones without separate approval for the exact messages and recipients.
No email send, manual email-worker run, signature, or external law-firm handoff is implicit in any approval above.

## 5. Production merge and deployment approval

After exact-source CI, Preview acceptance, and provider acceptance pass, prepare the final release record.
Request marking the specific draft review ready and merging its checked commit into `develop` as separate listed actions.
Include the automatic Production deployment in Rob's verified existing project.
Verify that all required migrations already exist before the merge.
List any Production policy or Airtable setting changes separately.
Production Airtable activation requires completed synthetic acceptance and explicit activation approval.
No real company connection is required. Each future real connection needs its own approved scope.

The deployment adds `/api/cron/airtable` at `15 15 * * *` UTC.
It leaves the existing email and cleanup schedules unchanged.
With Airtable disabled, that route returns a paused result and performs no delivery.
When enabled, successful saves can start delivery immediately. Daily recovery can process eligible queued requests.
The existing email job continues under its current rules. No new test message is authorized by deployment alone.

Prepare bounded post-release page checks on the exact new deployment.
Submit no forms unless separately approved. Stop if sign-in is required or the result is unexpected.

## Risks, recovery, and fixed limits

Wrong mappings or record links can expose selected claim data outside CMG.
Review exact synthetic destinations and selected values before enabling delivery.
Unknown provider outcomes require readback and review, not blind replay.
Lost encryption access can require reconnecting the affected company. Do not replace the key casually.

New enum values and saved legal records can make old application code incompatible.
Do not promise a safe one-click rollback after a claim uses `with_law_firm`.
Prefer a reviewed forward repair and approved Airtable pause controls.
Pause can stop future work; it cannot undo an external write already accepted or reliably stop one already in flight.
Retain schema, messages, queue records, legal history, package snapshots, files, and audit evidence.
Do not delete data or reverse migrations as a recovery shortcut.

Keep cleanup blocked, DNS unchanged, and every existing login preserved.
Create no Supabase backup. Perform no hosted reset, hosting purchase, account transfer, or Computer Use.
Keep completed unrelated one-time tests closed. Retain the existing final-email check as a separate task.

Source references: [README](../../README.md#legal-handoff-and-optional-airtable-sharing),
[implementation contract](CMG_LAW_FIRM_AIRTABLE_CONTRACT_2026-11-15.md),
[implementation status](CMG_LAW_FIRM_AIRTABLE_IMPLEMENTATION_2026-11-15.md),
[local browser method](CMG_LOCAL_BROWSER_FIXTURE_METHOD_2026-11-15.md).
