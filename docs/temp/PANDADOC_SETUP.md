# PandaDoc setup for CMG

Production uses the manual prefilled-PDF signing path in `SITE_MODE=staff`.
The PandaDoc API path is not part of the current manual release.
Do not activate platform mode until the approved invitation flows pass local and hosted Preview acceptance.
[HANDOFF.md](HANDOFF.md) contains current account, deployment, migration, and verification evidence.
This guide describes setup requirements, not proof that a hosted environment meets them.

Current PR #19 Preview reports API and webhook keys as configured.
It therefore selects the PandaDoc API provider, unlike Production's selected manual path.
`src/lib/esign/config.ts` treats absent or blank key values as unconfigured.
Manual Preview acceptance needs separately approved branch-only overrides for both keys and redeployment.
Verify manual mode and disabled webhook configuration after that deployment.
Keep Production settings and shared Preview key values unchanged.
Do not send an API document to test the manual flow.

## Bundled LOR documents

Both signing paths use the bundled PDFs below.
The optional API provider uploads them to PandaDoc without a template UUID.
For the selected manual path, staff upload the downloaded, prefilled PDF themselves.

| Signers | Bundled file | PandaDoc roles |
|---|---|---|
| One | `src/lib/esign/templates/CMG_LOR-2026-PandaDoc-Single.pdf` | `H1` |
| Two | `src/lib/esign/templates/CMG_LOR-2026-PandaDoc-Dual.pdf` | `H1`, `H2` |

Internal roles `Homeowner1` and `Homeowner2` map to `H1` and `H2`.
[src/lib/esign/lor-pdf.ts](../../src/lib/esign/lor-pdf.ts) controls fields and recipients.
Signatures and initials remain blank for each signer.
Date text uses the dispatch date in `America/New_York`.
It is not proof of the signature date.

The retained source is `temp/docs/CMG_Blank-LOR-2026.pdf`.
`scripts/build-lor-tagged-pdfs.py` builds both variants under `temp/docs/`.
Its Python libraries are `pypdfium2`, `pypdf`, and `reportlab`.
`--manifest src/lib/esign/lor-tag-manifest.json` exports the tag coordinates and needs none of them.
Regenerate that manifest whenever the script's coordinate tables change.
PDF regeneration is a separate asset task.
Review every regenerated page before replacing a bundled PDF.
Do not install missing libraries or change approved legal text without approval.

## Manual prefilled-PDF signing

Use this path when CMG has no PandaDoc API access.
It needs no `PANDADOC_API_KEY` and no webhook.
Leave the provider in manual mode; nothing in the application calls PandaDoc.

The representation panel shows **Download letter for signing** in manual mode.
The download applies the same refusals a send applies.
It refuses a claim with no carrier, no policy number, no agreement type, no saved fee, or no claimants.
It records an `esign.lor_prefilled` audit row for every download.
It does not advance the claim status and does not consume the dispatch lease.

The downloaded PDF replaces supported data tags with the available claim values.
It keeps every initial and signature tag: `i1`–`i4`, `i8`, `s5`–`s7`, `s9` for `H1`.
A two-signer letter also keeps `j1`–`j4`, `j8`, `t5`–`t7`, `t9` for `H2`.
The API uses role-qualified tags; successful recognition in the manual web upload remains unverified.
PandaDoc's [web upload guide](https://support.pandadoc.com/en/articles/9714598-field-tags-recognition) requires field placement and recipient assignment.
Its [API tag guide](https://developers.pandadoc.com/docs/field-tags) describes a separate role-qualified format.
Do not infer manual field recognition from a passing local tag test.

Obtain approval for the exact claim, document, signers, and PandaDoc destination before uploading a real letter.
Obtain separate approval before sending it or changing its hosted claim state.
Staff must check every signer, agreement category, fee, date, and printed value before sending.
Long values can be shortened during prefilling; unsupported characters can be removed.
Stop when a printed value does not correctly identify the person, policy, property, or agreement term.
Do not treat the printed download date as the signature date.

Procedure:

1. Open the approved claim as its owner or assigned adjuster.
2. Confirm that the claim is ready for representation and has the required policy, agreement, fee, and claimant data.
3. Select **Download letter for signing**.
4. Check every page and every printed value.
5. Upload the approved PDF to PandaDoc as a new document.
6. Inspect every signature and initial field for each signer before continuing.
7. Assign the `H1` fields to the primary policyholder.
8. Assign the `H2` fields to the second policyholder when present.
9. Confirm that every required field is assigned to the correct signer.
10. Stop if tags remain visible, fields are missing, or the assignments are wrong.
11. Send the document only after the separate send approval.
12. Confirm the provider's send result before recording the send in CMG.
13. With hosted-write approval, select **Mark letter as sent** in CMG.
14. Confirm `lor_sent` and the recorded send activity.
15. Wait until every required signer completes the document.
16. Download the final signed PDF from PandaDoc.
17. Check all signatures and retain the provider's completion evidence.
18. Upload the approved final PDF under Documents as **LOR — signed** (`lor_signed`).
19. Select the approved visibility: **CMG only** or **Homeowner can see**.
20. Confirm the stored document and download its bytes through the authorized CMG account.
21. With status-change approval, select **LOR signed** and submit **Move to lor signed**.
22. Confirm `lor_signed`, its timestamp, status history, activity, and any required email evidence.

Uploading a manual signed letter does not automatically advance the claim.
The status action and database gate require a stored `lor_signed` document before that transition.
Status changes can create customer and partner notifications; approve the intended recipients before a live test.
Manual signing does not report viewed, declined, expired, or signed provider states to CMG automatically.
If a send result is uncertain, inspect PandaDoc before another send or status change.
Keep the signed PDF unchanged; do not regenerate or flatten it.
This procedure does not authorize a legal signature or decide whether the agreement is legally sufficient.

## Optional API account and environment preparation

The following sections apply only when CMG separately approves the API path.
They are not requirements to use the selected manual signing flow.

1. Confirm PandaDoc API access with the account owner.
2. Confirm current sandbox recipient restrictions with PandaDoc.
3. Obtain approval before creating provider resources or sending test documents.
4. Keep the API key owner under CMG control.
5. Obtain legal approval for both PDFs, agreement categories, fee values, and date fields.
6. Set the required keys only in the approved environment.
7. Redeploy after changing Vercel environment values.

| Setting | Purpose |
|---|---|
| `PANDADOC_API_KEY` | Server-only API access |
| `PANDADOC_WEBHOOK_SHARED_KEY` | Server-only HMAC verification |
| `PANDADOC_API_BASE_URL` | Optional API endpoint override |
| `PANDADOC_POLL_INTERVAL_MS` | Optional polling interval; default 2000 |
| `PANDADOC_POLL_MAX_ATTEMPTS` | Optional poll count; default 20 |

`PANDADOC_LOR_TEMPLATE_UUID` and `PANDADOC_LOR_TEMPLATE_UUID_SINGLE` are legacy optional settings.
The current bundled-PDF flow does not use them.
Do not add `NEXT_PUBLIC_` to PandaDoc keys.
An API key alone does not prove webhook readiness or hosted integration success.

## Approved draft test

Normal test discovery does not require `.env.local`.
The test checks the shell opt-in before reading that file.
A missing file is allowed.
Other file-loading errors still fail the test.

The live suite requires all three values:

| Value | Source |
|---|---|
| `PANDADOC_LIVE_DRAFT_TEST=1` | Invoking shell only |
| `PANDADOC_API_KEY` | Shell or optional `.env.local` |
| `PANDADOC_DRAFT_TEST_EMAIL` | Shell or optional `.env.local` |

Do not store the opt-in in `.env.local`, CI, or Vercel.
Obtain explicit approval before each live run.
The test creates a real single-signer draft.
It does not send the draft or delete it.
Each repeated run can create another draft.

Run this only after approval and credential setup:

```powershell
$cmgPreviousDraftOptIn = $env:PANDADOC_LIVE_DRAFT_TEST
try {
  $env:PANDADOC_LIVE_DRAFT_TEST = "1"
  npx vitest run src/lib/esign/pandadoc-draft.live.test.ts
} finally {
  $env:PANDADOC_LIVE_DRAFT_TEST = $cmgPreviousDraftOptIn
}
```

The automated assertion checks `document.draft`.
It does not verify field placement, legal wording, signatures, email delivery, or completed-PDF filing.
Review the draft in PandaDoc before any separate send test.
Record the result and any approved draft cleanup in HANDOFF.

## Manual hosted acceptance

Use the procedure above after its separate upload, send, and hosted-write approvals.
Verify one-signer and two-signer field placement before the first real send.
Check all three agreement categories and the saved fee against the reviewed document.
Use required Signature fields, not text fields, for signatures.
PandaDoc's [field guide](https://support.pandadoc.com/en/articles/9714583-fields-new-experience) explains that distinction.
Record the environment, commit, signer count, field review, send result, final document, status, and access checks in HANDOFF.
Keep private names, document content, signed links, and passwords out of repository evidence.
A provider draft, a stored PDF, or a staff status label alone does not prove completed signing.
Check homeowner visibility and foreign-claim refusal without disclosing the document to another account.
No live signing acceptance is claimed by this guide.

## Optional API hosted acceptance

Run this phase only after separate platform and external-write approvals.
Use isolated test data and approved signer addresses.

1. Set `SITE_MODE=platform` only in the approved test environment.
2. Verify staff MFA and AAL2 before opening staff actions.
3. Confirm the hosted schema and private Storage rules.
4. Configure the webhook on the approved HTTPS hostname.
5. Subscribe to `document_state_changed`, `recipient_completed`, `document_completed_pdf_ready`, and `document_creation_failed`.
6. Verify one-signer and two-signer PDF field placement.
7. Check all three agreement categories and fee values.
8. Send each approved test LOR from an eligible `under_review` claim.
9. Confirm sent, viewed, declined, expired, and creation-failed behavior.
10. Complete every required signature.
11. Confirm the signed PDF appears once in private claim storage.
12. Confirm the claim advances to `lor_signed` once.
13. Verify replay, concurrency, delayed-webhook, and uncertain-send recovery.
14. Confirm no duplicate document, notification, feed item, or status history.
15. Verify customer and partner access boundaries.
16. Record exact results before requesting platform activation.

The webhook path is `/api/pandadoc/webhook`.
Simple mode returns 404 before processing the body.
Staff and platform modes reach raw-body HMAC verification before event handling.
Production is recorded as manual; recheck the approved environment before any API activation.
The event ledger records leases and completed work.
Do not clear ledger rows or retry an uncertain send without checking provider state.

## Production activation

Production key changes, webhook changes, deployments, and live sends each require approval.
Keep Production in `SITE_MODE=staff` until the approved invitation checks pass and the owner approves the mode change.
Track retention, export, erasure, and legal holds as separate release work in RELEASE_STATE.
The manual provider remains available in platform mode without a PandaDoc API key.

See the [current integration blueprint](../reference/pandadoc/06-cmg-integration-blueprint.md) for source mappings.
