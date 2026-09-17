# Owner decision register

Reconciled 2026-09-17. This file lists only current owner-controlled decisions.
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
- PR #2 may be merged. The owner runs the merge.

## 1. Release sequence

The owner fixed this order. Later items must not move earlier.

1. Merge PR #2 and check the deployment.
2. Land PR #3, PR #4, the per-vendor fee schema branch, and the test-coverage branch.
3. Build the manual prefilled-PDF PandaDoc path.
4. Open the staff admin desk for CMG staff.
5. Approve the public copy. This is second-to-last.
6. Apply the SEO origin fix and cut `app.` over to `www.`. This is last.

Customer and partner logins wait for a separate owner decision.

**Owner action:** confirm any change to this order before engineering work moves.

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
See [PANDADOC_SETUP.md](PANDADOC_SETUP.md).

## 4. Commercial hosting and repository protection

The Vercel team uses Hobby. Vercel's [fair-use rules](https://vercel.com/docs/limits/fair-use-guidelines)
require Pro or Enterprise for commercial use. CMG's public site falls inside that scope, including simple mode.
`develop` is unprotected, and GitHub requires an eligible plan for private-repository protection.

**Owner action:** approve a commercial Vercel plan before commercial launch.
Approve a supported private-repository plan, then approve the branch-protection change separately.
Keep the repository private. Manual review is not branch protection.

## 5. Provider verification

Resend verified the sending domain, and a synthetic staff alert was delivered.
Inbox verification for the 2026-09-15 lead is still pending the owner's Resend sign-in.

**Owner action:** sign in to Resend and confirm inbox receipt for that lead.
Sign in to Vercel again to inspect execution logs; the browser session and CLI credentials expired.

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
Approve each hosted test submission and live message separately.
If a backup is later required, confirm that it covers private object bytes, not only database metadata.
An invalid existing document path can stop migration validation; a repair needs reviewed metadata and Storage evidence.
Do not authorize automatic renaming, deletion, quarantine, or constraint removal as a default response.

## 8. Separate Git and deployment approvals

Approval for one action never approves another.
Commit, push, PR description change, branch protection, merge, deployment, and domain change stay separate.
A merge to `develop` can start a Production deployment automatically.

## 9. Deferred until customer and partner access opens

Private authentication, invitations, customer access, and partner access remain deferred.
Do not create a first owner merely because an old record says no accounts exist.
Confirm existing identities and roles through an approved process.
Retention automation, export, erasure, and legal holds need separate implementation and approval.

## 10. Optional authentic photography

Home and About retain labeled image placeholders.
CMG can supply approved photos and usage rights.
Do not use generated or misleading images as evidence of CMG people or work.
Photography does not block launch unless CMG makes it a requirement.
