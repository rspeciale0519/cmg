# Data retention

What CMG Property Solutions keeps, for how long, and why — table by table.

This document is a policy, not a mechanism: **nothing in the codebase deletes
anything on a schedule today.** Where a table needs a sweeper, that is named
below as an unbuilt task rather than described as if it existed. Two tables
already prune themselves, and those say so.

The shape of the reasoning is the same throughout. A public adjuster's file is
evidence — of what a homeowner agreed to, of what was sent to a carrier, and of
what CMG did on someone's behalf. Florida's statute of limitations for a
property-insurance claim, and the licensing record a public adjuster is expected
to be able to produce, both argue for keeping claim material for years rather
than months. Everything that is *not* claim material should go early, because
holding a stranger's phone number for six years is a liability with no
corresponding benefit.

**Nothing here is legal advice.** The periods below are engineering defaults
chosen to be defensible; CMG's own counsel should confirm them before the first
sweeper is switched on, and the numbers are deliberately easy to change in one
place when they do.

---

## Summary

| Table | Keep | Then | Built? |
|---|---|---|---|
| `claims`, `claimants`, `claim_financials`, `claim_status_history` | 7 years after close | review, then archive | no |
| `documents` + storage objects | 7 years after close | archive with the claim | no |
| `claim_events` | with the claim | archive with the claim | no |
| `consents` | 7 years after the claim closes | archive — never delete while the claim lives | no |
| `audit_log` | 7 years, append-only | archive to cold storage | no |
| `leads` | 24 months from last touch | delete | no |
| `invites` | 90 days after expiry or acceptance | delete | no |
| `notifications_outbox` | 90 days after `sent` or `dead` | delete | no |
| `pandadoc_webhook_events` | 90 days | delete | no |
| `rate_limits` | 24 hours | delete | **yes** — self-pruning |
| `storage_cleanup_queue` | until drained | set `processed_at` | **no** — nothing drains it |
| `claim_partner_summaries` | derived | rebuilt by trigger; never archived | n/a |
| `profiles`, `partner_companies` | life of the relationship | deactivate, do not delete | n/a |
| `claim_ref_counters` | forever | — | n/a |

---

## Claim material — 7 years after the claim closes

`claims`, `claimants`, `claim_financials`, `claim_status_history`,
`claim_events`, `documents` and the storage objects they point at.

Seven years is chosen to sit beyond Florida's five-year limitation period for an
action on a written contract, with room for a claim that closes long after the
loss date. The clock starts at close (`status` reaching `closed` or `rejected`),
not at creation, because a claim that runs for three years is the one most likely
to be argued about afterwards.

These tables are a unit and must be archived as one. A `claims` row without its
`claim_status_history` is a record that something happened without a record of
what; a `documents` row without its storage object is a filename.

**Not built.** When it is, three things matter:

- **Storage objects and rows must go together.** `storage_cleanup_queue` already
  exists for exactly this problem in the other direction (an object whose row is
  gone) — an archival sweeper should enqueue there rather than delete an object
  inline, so a failure is recorded rather than lost. It needs a drainer first;
  see below.
- **`audit_log` is not part of the unit.** It has its own clock and its own rule
  (below). Archiving a claim must not remove the record that it existed.
- **Archive means archive.** Export to cold storage before deletion. A public
  adjuster asked to produce a seven-year-old file and answering "we deleted it on
  schedule" is in a worse position than one who can produce it slowly.

## `consents` — with the claim, and never before it

A consent row carries the checkbox text verbatim, the subject's phone and email,
their IP, and the moment they ticked it. `guard_consent_immutable()` already
prevents it being edited, and a withdrawal is recorded as a withdrawal rather
than as a deletion — the row stays, `withdrawn_at` is set.

That is deliberate and it is the whole point: the value of a consent record is
that it proves what was agreed at a moment in the past. Deleting one when a
homeowner withdraws would destroy the evidence that they had consented before
they withdrew, which is the fact most likely to be needed.

So consents follow the claim's clock and never lead it. A withdrawal stops future
contact; it does not shorten retention.

## `audit_log` — 7 years, append-only, archive rather than delete

The table has no UPDATE and no DELETE policy, and `authenticated` holds no grant
beyond SELECT. That is structural and must not change: an audit trail that can be
edited is not one.

Retention therefore means **archival**, not deletion — export a date range to
cold storage, and only then remove it, if ever. The engineering default is to
keep seven years hot and archive beyond that, but the honest position is that
this table is small (one row per consequential write) and the cheapest correct
answer is to keep all of it until volume argues otherwise.

If a sweeper is ever built for this table it must be service-role only, must
itself write an audit entry recording what range it removed, and must be
impossible to invoke from any user surface.

## `leads` — 24 months from last touch

A lead is a stranger's name, phone number and message. It is not claim material,
and most leads never become claims. Twenty-four months from `updated_at` covers a
realistic re-engagement window and a full storm season on either side.

A lead that *became* a claim is a different thing: `leads.status = 'converted'`
means the material now lives on the claim, and the lead row can go on the shorter
clock without losing anything.

**Not built.** A monthly job deleting `where updated_at < now() - interval '24
months'` is the whole of it.

## `invites` — 90 days after expiry or acceptance

An invite holds an email address and a SHA-256 digest of a single-use token. The
token is already dead after 72 hours or one use, so the row's remaining value is
purely diagnostic: "we did send them an invitation". Ninety days is enough for
that conversation.

`audit_log` independently records every issuance, so deleting the row does not
lose the fact.

## `notifications_outbox` — 90 days after `sent` or `dead`

A row holds a recipient address and the rendered body of a message. Once it has
been sent, its value is diagnostic and short-lived. A `dead` row is worth keeping
a little longer than a sent one — it is the record of a message CMG owed somebody
and never delivered — but ninety days covers the investigation.

Rows in `pending` are never swept, whatever their age. A backlog is a symptom to
be fixed, not tidied away.

## `pandadoc_webhook_events` — 90 days

Delivery deduplication by `X-PandaDoc-Webhook-Event-Id`. Its only job is to
recognise a replay, and PandaDoc does not replay events months later. Ninety days
is generous.

## Already self-managing

- **`rate_limits`** — windows are pruned as they are read; nothing accumulates
  beyond a day.

## `storage_cleanup_queue` — the queue nobody empties

This is the one place where the design and the code disagree, and it is written
here rather than quietly fixed because it is a *retention* fact: **the bytes of
every deleted document are still in the bucket.**

`tg_enqueue_storage_cleanup()`, on the `documents_enqueue_storage_cleanup`
trigger, fires after delete and writes the object's path here. That is the
correct shape — the row is deleted through the caller's own client under RLS, and
the object must then be removed by something holding the service role, because
`storage.objects` carries no policy for `authenticated`. The queue is the handoff
between the two, and the table is built for a retrying worker: it carries
`processed_at`, `attempts` and `last_error`, and there is a partial index on the
unprocessed rows.

Nothing reads it. There is no drainer, no cron route, no sweeper — the only code
in the repository that touches the table is a test fixture's teardown. A
homeowner or an operator who removes a document sees it leave the list,
`audit_log` records the deletion, and the file itself stays in `claim-docs`
indefinitely under a UUID nobody can reach from the app.

The exposure is bounded — the bucket is private, every read is a signed URL
minted behind an authorization check, and there is no path from a deleted row
back to its object — so this is a retention failure rather than a disclosure one.
It still means "delete" does not currently mean delete, which is the sentence
that matters if anyone is ever asked.

Building the drainer is small and is the single highest-value item in this
document: a service-role route in the shape of `/api/cron/outbox` that reads the
unprocessed rows, removes each object, and stamps `processed_at` — incrementing
`attempts` and recording `last_error` on failure, so a failing delete stays
visible as a growing queue rather than disappearing.

## Not retention questions

- **`claim_partner_summaries`** is a projection, rebuilt by trigger from the
  claim. It is never archived; if a claim is archived, its projection goes with
  it automatically.
- **`profiles` and `partner_companies`** are relationships, not events. Ending
  one is `is_active = false` or `status = 'inactive'`, never a delete —
  `guard_partner_company_delete()` already refuses to delete a company that has
  reps, and deleting a profile would orphan the authorship of everything that
  person did. A departed staff member's name on a three-year-old status change is
  part of the record.
- **`claim_ref_counters`** is a sequence. Deleting a row would re-issue a claim
  reference that already exists.

---

## Subject requests

A homeowner asking what CMG holds about them, or asking for it to be removed, is
answered by hand today; there is no self-service export or erasure. Two things
constrain the answer and should be said out loud to anyone who asks:

- Claim material cannot be erased on request while the claim is live or within
  the retention period, because CMG is a party to it and holds it as its own
  business record.
- `audit_log` cannot be edited by anyone, including CMG. An erasure request
  cannot be satisfied by rewriting history; it is satisfied, where it applies at
  all, by removing the material the log points at.

Building an export is a reasonable Phase-10 task. Building an erasure button is
not, until counsel has drawn the line above precisely.
