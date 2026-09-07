# Data retention

This document separates proposed retention periods from implemented cleanup.
CMG must approve the policy with counsel.
These engineering proposals do not establish legal retention duties.

Public legal approval is required before the simple-mode launch.
Retention automation, export, erasure, and platform access remain separate work.
[HANDOFF.md](temp/HANDOFF.md) records current release evidence and open decisions.

## Proposed policy

The periods below are proposals.
No general retention or archive job currently enforces them.
Legal holds and unresolved delivery or recovery work take priority over proposed deletion dates.

| Records | Proposed period | Proposed next action | Implemented? |
|---|---|---|---|
| `claims`, `claimants`, `claim_financials`, `claim_status_history`, `claim_events` | Seven years after approved closure | Review and archive together | No |
| `documents` and Storage objects | With the claim | Export both rows and file contents | No |
| `consents` | With the related claim; counsel must define detached and lead-only cases | Preserve evidence and withdrawal records | No |
| `audit_log` | Seven years, subject to legal review | Archive without changing recorded events | No |
| `leads` | 24 months after the last update | Review before deletion | No |
| `invites` | 90 days after expiry or acceptance | Review recovery dependencies before deletion | No |
| `notifications_outbox` | 90 days after resolved `sent` or `dead` state | Review before deletion | No |
| `pandadoc_webhook_events` | 90 days after completed processing, subject to replay requirements | Preserve required duplicate-detection evidence | No |
| `esign_dispatch_attempts`, `esign_recipient_completions` | With the claim until policy approval | Preserve reconciliation evidence | No |
| `rate_limits` | A strict age limit needs approval | Current pruning is opportunistic | Partial |
| `storage_cleanup_queue` | Until cleanup and recovery are complete | Mark processed; retain unresolved and dead rows | Worker exists |
| `claim_partner_summaries` | While the claim exists | Maintain the derived projection | Database triggers |
| `profiles`, `partner_companies` | Life of the relationship, subject to policy | Deactivate access | Existing controls |
| `claim_ref_counters` | Retain permanently | Preserve reference uniqueness | Existing counter |

A status change alone does not prove that archive or deletion is legally allowed.
Counsel must define the clock for rejected, reopened, and disputed claims.
Keep the records until an approved policy and procedure apply.

## Claim files and consent evidence

A claim file includes its database records and document bytes.
An archive must preserve both.
A `documents` row alone cannot recover a deleted file.
Do not start cleanup until the archive has been verified.

Consent records retain the submitted text, subject details, and timestamps.
Where present, they also retain the originating IP address.
`guard_consent_immutable()` protects the original record.
Withdrawal uses `withdrawn_at`; it does not remove the original evidence.
A claim or lead deletion can detach consent through its foreign key.
Detached consent therefore needs its own approved retention rule.

A withdrawal record does not prove that every delivery path applies the required contact restrictions.
Confirm those rules before platform activation or any new messaging use.
Do not erase claim evidence automatically after a subject request.

## Audit records

Application users have no UPDATE or DELETE grant on `audit_log`.
Audit retention must preserve event history and attribution.
An approved archive must record its scope and recovery location.
Keep operational records outside client access.

Database administration and service credentials remain privileged.
Do not describe the audit table as immune to privileged database changes.
Any approved repair must preserve evidence of the original event and the repair.

## Email and e-signature records

`notifications_outbox` stores the recipient, template name, payload, delivery state, and retry details.
The worker renders the message when it processes the row.
It does not store only a rendered message body.

Preserve `pending`, `failed`, and unresolved `dead` rows.
A missing Resend key leaves messages queued.
The current claim function bounds delivery attempts, including expired final leases.
Hosted migration status remains a separate verification item in HANDOFF.
A recorded `sent` state means the provider accepted the send request.
It does not prove inbox delivery.

A provider timeout can leave delivery uncertain.
Check provider evidence before retrying such a row.
Do not erase the row to clear a warning.

PandaDoc event IDs, payload hashes, leases, dispatch attempts, and recipient records support duplicate detection and recovery.
Removing those records can permit old events to run again.
Do not assume that a provider can no longer replay an old event.
Define archive and replay rules before adding a cleanup job.
Keep unresolved attempts and related evidence regardless of age.

## Implemented rate-limit pruning

`check_rate_limit()` attempts cleanup on approximately one percent of limiter calls.
It removes older history for the current key after ten of that rule's windows.
It also removes rows whose window started more than seven days earlier.

Cleanup depends on later calls and the random check.
The code does not guarantee deletion within 24 hours or seven days.
Rows can remain when traffic stops.
A strict retention deadline needs a separate approved mechanism.

See [the database implementation](../supabase/migrations/20260809120000_initial_schema.sql)
and [application rate-limit rules](../src/lib/rate-limit.ts).

## Implemented Storage cleanup

Deleted document rows add exact object paths to `storage_cleanup_queue`.
Uploads also register cleanup intent before writing bytes.
The document insert settles that intent when the database transaction commits.
Uncommitted uploads remain eligible for later cleanup.

`/api/cron/storage-cleanup` requires `CRON_SECRET`.
The worker claims a bounded batch through `claim_storage_cleanup_batch()`.
Concurrent workers use database locks to divide due work.
Each claim sets a five-minute lease.
Settlement checks the row ID and attempt number.
This prevents a stale worker from replacing a newer result.

The worker marks `processed_at` after Storage reports successful removal.
An already-absent object can complete successfully.
Error responses remain failures.
Retry delays are one, five, 25, and 125 minutes.
The attempt limit is five.
A final failure or expired final lease moves the record to `dead_at`.
Dead records remain for operator recovery.

These delays are minimum wait times.
They are not execution schedules.
[vercel.json](../vercel.json) schedules outbox processing daily at 14:00 UTC.
It schedules Storage cleanup daily at 14:17 UTC.
Daily batches can delay retries or cleanup until later days.
Hobby execution can vary within the scheduled hour.
See [Vercel cron limits](https://vercel.com/docs/cron-jobs/usage-and-pricing).

Verify active production jobs and queue age after deployment.
A local worker test does not prove that cron is configured.
An Instant Rollback does not update active cron jobs.
Recheck schedules and authorization after rollback.
See [Vercel cron rollback behavior](https://vercel.com/docs/cron-jobs/manage-cron-jobs).

## Backup and recovery

Database backups do not contain Storage file contents.
Use a separate object backup with the database backup.
See [Supabase backup scope](https://supabase.com/docs/guides/platform/backups).

Before an approved production migration:

1. Confirm the target project and pending migrations.
2. Obtain production backup and write approvals.
3. Back up database data and Storage objects.
4. Verify the backup and restore procedure.
5. Record recovery identifiers in HANDOFF without secrets.

Never seed or reset production.
Do not delete recovery ledgers during a release.
Follow the [README recovery order](../README.md#recovery-order) if a release fails.
Coordinate database and object restore points before reopening submissions or cleanup.

## Subject requests and platform activation

There is no self-service export or erasure workflow.
CMG must handle requests through an approved manual process until those features exist.
Do not promise deletion that conflicts with an approved hold or retention duty.
Do not deny a request based only on the engineering periods in this file.

Before platform activation:

1. Approve retention periods, legal holds, and subject-request procedures.
2. Define exports that include database records and document bytes.
3. Test export completeness and access control.
4. Define erasure, backup expiry, provider data, and audit requirements with counsel.
5. Test approved cleanup and recovery against a hosted test environment.
6. Verify owner MFA, AAL2, roles, customer isolation, and partner isolation.
7. Complete hosted e-signature, webhook, email, and storage checks.
8. Record results before requesting activation.

Keep `SITE_MODE=simple` until those activation gates pass.
