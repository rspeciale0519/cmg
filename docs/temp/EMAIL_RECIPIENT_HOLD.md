# Notification holds and release gate

This change is local and is not approved for hosted release. A hold preserves the notification and its recipient. It does not approve delivery.

The v2 claim limit applies separately to expired leases, exhausted rows, and deliveries. One call can touch at most three times its limit. Delivery candidates cannot be starved by an exhausted or expired backlog. Callers must account for the larger bounded workload.

## Before a hosted release

Obtain separate approval for the exact migration, sender shutdown, queue review, deployment, and recovery actions. Stop all senders that share the queue, including old deployments and scheduled jobs. Stop direct password-reset delivery too. Account for all in-flight work and provider results before continuing. Review queued recipient snapshots and policy settings. The migration denies the legacy claim function, but it cannot stop a sender that already claimed work.

After the migration and application deployment, verify the policy and sender versions before restarting delivery. Keep prohibited recipients and unresolved addresses held. A suspended sender can resume after a pre-send check, so do not change policy or release a hold until all earlier senders have stopped. PandaDoc and mailbox forwarding are outside this control and need separate review.

## Review a hold

Do not clear holds in bulk, retarget recipients, reset attempts, or send again automatically. For each notification, review its recipient, payload, attempt count, age, lease, status, audit history, and provider history. A provider timeout or expired lease can mean the email was sent. If its outcome is uncertain, retain the hold until the owner approves an exact recovery. A row older than the configured maximum age can become dead on a later attempt. A row at the attempt limit also needs an explicit forward correction.

E-signature webhook deduplication can include the recipient. Review the dedupe key and event history before any recipient correction or replay. A different recipient can create a separate notification. Preserve the original record and avoid duplicate messages. Future policy changes and each correction require separate approval.

## Safe stop, 2026-10-29

The change is incomplete and uncommitted. Do not deploy or use it as a production control. No test process is running in this agent. The last focused run passed 173 tests across six files. Later edits added a settings test and a timeout-signal assertion; those changes need a new run. The last type-check passed before those later edits. The last lint run passed before the cancellation and settings changes. The local database policy regression passed 34 assertions in a rolled-back transaction with the current function definitions. Test 44 previously passed 13 assertions. A separate reviewer is checking the four legacy database test files. Full tests, build, three site modes, database suite, and final adversarial review remain incomplete. The package install reported 4 low, 2 moderate, 3 high, and 1 critical vulnerability; no final audit has run.

The disposable database contains an earlier version of this uncommitted migration. Later guard and input-validation changes ran only in rollback transactions. The generated database types came from the earlier local schema. Do not reset the database or alter retained fixtures. Resume by inspecting the local stack and existing work. Apply any needed local function update only under the previously approved zero-row guard. Regenerate types through the Supabase CLI when schema signatures change. Then finish the affected checks and required broader validation.

The database token cannot cancel a provider call that has already started. Cancellation stops a late provider call when the application timeout has fired before the provider call starts. Active and uncertain queued sends prevent policy and recipient changes through the added guards. Direct password-reset sends have no queue lease. Policy changes and recovery therefore require all sender processes to be stopped and reconciled first.

The modified files are `src/app/api/cron/outbox/route.ts`, `src/lib/auth/password-reset-delivery.ts`, `src/lib/email/delivery.test.ts`, `src/lib/email/delivery.ts`, `src/lib/email/outbox.test.ts`, `src/lib/email/outbox.ts`, `src/lib/settings/config.test.ts`, `src/lib/settings/config.ts`, `src/lib/settings/status.ts`, `src/types/database-app.ts`, `src/types/database.ts`, and database tests 17, 32, 35, and 43. New files are this note, `src/lib/email/outbox-fenced.test.ts`, `src/lib/email/staff-recipient.test.ts`, `supabase/migrations/20261029192505_unresolved_staff_recipient.sql`, and database tests 44 and 45.
