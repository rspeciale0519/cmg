# Owner decision register

Reconciled 2026-10-07. This file lists only current owner-controlled decisions.
Rewrite it in place. Do not add dated layers.
The superseded layered version is in [the 2026-09-17 archive](../../archive/docs/temp/2026-09-17-consolidation/BLOCKERS.md).

Use [RELEASE_STATE.md](../RELEASE_STATE.md) for production facts, open PRs, and the ordered next steps.
Use [HANDOFF.md](HANDOFF.md) for engineering evidence. Engineering checks are not owner blockers.
Use [README.md](../../README.md#simple-mode-production-runbook) for the release procedure.

This record requests no approval and authorizes no action.

## Settled — do not ask again

- Direct browser uploads to private Supabase Storage. The architecture is approved and deployed.
- `app.cmgpropertysolutions.net` as the temporary public host. It stays the demo host until CMG pays for commercial hosting.
- Preservation of existing root, `www`, and Microsoft 365 DNS records.
- The approved test recipients and the applied hosted migrations.
- No Supabase backup. Recovery for the applied migrations is reviewed forward repair. Immediate restoration is unverified.
- PandaDoc e-signing ships in the first release, through a manual prefilled-PDF flow.
- The CMG standard fee is 20 percent. A per-vendor fee is a staff-only setting.
- PRs #1 through #17 and #21 are merged.
- On 2026-09-23, the owner decided that admins must be able to invite staff, vendors, and homeowners.
- On 2026-10-07, after hosted invitation acceptance, the owner switched Production to `SITE_MODE=platform`.

## 1. Release sequence

The owner fixed this order. Later items must not move earlier.

1. Complete local and hosted Preview acceptance of staff, vendor, and homeowner invitations. Done.
2. Approve the Production change to `SITE_MODE=platform` after those checks and a review of pending customer messages. Done on 2026-10-07.
3. Send one real Letter of Representation through PandaDoc's web app.
4. Approve the public copy. This is second-to-last.
5. Apply the SEO origin fix and cut `app.` over to `www.`. This is last.

Customer and partner logins are open in Production.

**Owner action:** approve the merge of `bugfix/launch-integration-v2` after its checks pass. Confirm any change to this order.

Production now needs the combined launch fix. Staff and homeowner uploads above Vercel's 4.5 MB request limit fail until it deploys.
The owner partner directory also shows no companies until it deploys.
`bugfix/launch-integration-v2` rebuilds PRs #18 and #19 and the later launch repairs on current `develop`.
Its migration is already applied in Production. After it merges, PRs #18 and #19 can close as superseded.
The earlier `bugfix/launch-integration` branch is also superseded. HANDOFF records its approvals, commit, push, and failed Preview.
PR #20 (password show/hide and invite hint) is merged and live.
PR changes, remote merges, Preview configuration, and Production changes remain separately controlled.


## 2. Public business and legal approval

Public copy carries business assertions that only CMG and its legal adviser can approve.
The named items are the statistics, the testimonial and its attribution, "Se habla español",
"licensed and bonded in every state", and the partner payment promises.
Privacy terms, consent wording, and the retention position need the same approval.

**Owner action:** approve the exact deployed copy and the public data-handling terms.
See [RETENTION.md](../RETENTION.md) for implemented behavior and proposed policy.

## 3. PandaDoc configuration

The current flow uploads bundled PDFs with `H1` and `H2` signer roles.
It does not use template UUIDs, and it does not need the "11 tokens" that an older record described.

| Item | Requirement |
|---|---|
| `PANDADOC_API_KEY` | Optional. The manual prefilled-PDF path works without it. |
| `PANDADOC_WEBHOOK_SHARED_KEY` | Required for HMAC verification once webhook events are used. |
| Webhook subscription | `document_state_changed`, `recipient_completed`, `document_completed_pdf_ready`, and `document_creation_failed`. |
| Legal review | Both bundled PDFs, `CMG_LOR-2026-PandaDoc-Single.pdf` and `CMG_LOR-2026-PandaDoc-Dual.pdf`. |
| Manual path | Staff prefill the bundled PDF and complete signing outside the API, which avoids API fees. |

**Owner action:** rotate the old preview PandaDoc webhook key if it is still active.
Approve any live draft or send test separately. A live test must never run automatically.
The shared Preview environment carries configured API and webhook keys.
The provider selects PandaDoc when `PANDADOC_API_KEY` contains a nonblank value.
It selects manual signing only when that value is absent or blank.
Manual acceptance requires separately approved branch-only overrides and redeployment.
The recommended overrides disable both PandaDoc keys for the test branch and leave Production unchanged.
Do not remove shared Preview values or expose their contents.
A combined-branch Preview also needs its own approved site-mode, URL, and hostname configuration for private hosted tests.
See [PANDADOC_SETUP.md](PANDADOC_SETUP.md).

## 4. Commercial hosting and repository protection

The Vercel team uses Hobby. Vercel's [fair-use rules](https://vercel.com/docs/limits/fair-use-guidelines)
require Pro or Enterprise for commercial use. CMG's public site falls inside that scope, including simple mode.
`develop` is unprotected, and GitHub requires an eligible plan for private-repository protection.

Recommendation: use Vercel Pro and GitHub Pro for the current personal repository owner.
Vercel's [Pro plan](https://vercel.com/docs/plans/pro-plan) lists a $20 monthly platform fee, one deploying seat, and usage charges beyond included allowances.
GitHub's [plan guide](https://docs.github.com/en/get-started/learning-about-github/githubs-plans) includes private protected branches in personal GitHub Pro.
These primary sources were checked on 2026-10-05. No plan purchase or permission change occurred.
Confirm billing responsibility and usage limits before purchase.

**Owner action:** approve a commercial Vercel plan before commercial launch.
Approve a supported private-repository plan, then approve the branch-protection change separately.
Keep the repository private. Manual review is not branch protection.

## 5. Provider verification

Resend verified the sending domain, and a synthetic staff alert was delivered.
The owner restored Resend access in Chrome on 2026-10-05.
Read-only provider records show Delivered for both staff and vendor invitations, the 2026-09-15 lead receipt and alert, and the homeowner invite.
Owner and homeowner reset messages and the synthetic question alert are also Delivered.
No message was sent or retried during this review. No new Resend login is needed for these completed reads.
The September 21–October 5 Metrics window reports eight emails, 100% deliverability, zero bounces, and zero complaints.
The Webhooks page shows no configured webhook. CMG does not receive later delivery events.
The sender sets no explicit `replyTo`; receipt of replies at the sender mailbox remains unverified.
Recommendation: approve the daily operator procedure in [HANDOFF.md](HANDOFF.md#current-email-provider-delivery-evidence) and name its CMG operator.
Confirm a monitored reply mailbox before launch. Do not change mail routing or recipient details without exact approval.

**Owner action:** confirm inbox receipt for the 2026-09-15 lead. Provider delivery does not prove receipt in the inbox.
The Vercel connector verified the current Production deployment and project on 2026-10-04.
It could not read billing details or build logs.
Use an authorized Vercel session to complete those checks.
The current browser session can read request logs and enabled cron schedules.
The last-hour Production cron window has no records; older windows require Pro.
Scheduled execution remains unverified.

The approved PR #19 branch-only Preview overrides and its Turnstile hostname addition are complete; HANDOFF records them.
Remaining hosted upload boundaries stay open until the combined fix deploys.

The Supabase connector denied access, but the existing browser session supplied authorized read-only evidence.
Migration versions match; pending mail and unprocessed cleanup counts are zero.
No new Supabase permission is needed for these completed reads.
Repeat relevant checks before approved release writes.
Do not send passwords or service keys in chat.

## 6. Open operational questions

- **Cron delay.** The outbox runs daily at 14:00 UTC and Storage cleanup at 14:17 UTC.
  Hobby scheduling can miss the configured minute, and a backlog can take several days.
  Confirm that this delay meets CMG's requirements. A faster schedule needs a commercial plan first.
- **DMARC.** The domain publishes `v=DMARC1; p=none;`. Decide whether to move to `quarantine` or `reject`.
  Any change must preserve Microsoft 365 mail routing.
- **Stray root folders.** The owner will delete them.

## 7. Production data controls

The hosted database holds real records. Never treat it as empty or disposable.
Never seed or reset production.

**Owner action:** approve each production migration, repair, backup, or restore separately.
Approve each hosted test submission and live message separately. Do not create a Supabase backup under the current decision.
If a backup is later required, confirm that it covers private object bytes, not only database metadata.
An invalid existing document path can stop migration validation; a repair needs reviewed metadata and Storage evidence.
Do not authorize automatic renaming, deletion, quarantine, or constraint removal as a default response.

## 8. Separate Git and deployment approvals

Approval for one action never approves another.
Commit, push, PR description change, branch protection, merge, deployment, and domain change stay separate.
A merge to `develop` can start a Production deployment automatically.
Engineering sessions push branches and open PRs only with approval. The owner runs merges.
HANDOFF records the earlier approved commits and pushes for PRs #18 and #19 and the first combined branch.

## 9. Customer and partner access

All three invitation flows passed hosted acceptance, and Production customer and partner routes are open since 2026-10-07.
Do not create a first owner merely because an old record says no accounts exist.
Confirm existing identities and roles through an approved process.
Retention automation, export, erasure, and legal holds need separate implementation and approval.
The manual request procedure in [RETENTION.md](../RETENTION.md) is a proposal, not an approved operating process.
Choose effective operator controls or separate hold enforcement before relying on a manual legal hold.
Approve the procedure with counsel, then authorize its synthetic completeness and access tests.
Define any email category that consent withdrawal must stop.
Current claim messages are transactional, and the worker does not filter by `withdrawn_at`.
Do not assume that this alone proves an existing marketing send defect.

## 10. Optional authentic photography

Home and About retain labeled image placeholders.
CMG can supply approved photos and usage rights.
Do not use generated or misleading images as evidence of CMG people or work.
Photography does not block launch unless CMG makes it a requirement.
