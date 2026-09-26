# PandaDoc setup for CMG

Production uses the manual prefilled-PDF signing path in `SITE_MODE=staff`.
The PandaDoc API path is not part of the current manual release.
Do not activate platform mode until the approved invitation flows pass local and hosted Preview acceptance.
[HANDOFF.md](HANDOFF.md) contains current account, deployment, migration, and verification evidence.
This guide describes setup requirements, not proof that a hosted environment meets them.

## Bundled LOR documents

The current provider uploads a PDF to PandaDoc.
It does not create the LOR from a PandaDoc template UUID.

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

The downloaded PDF carries every claim value in place of its data tag.
It keeps every initial and signature tag: `i1`–`i4`, `i8`, `s5`–`s7`, `s9` for `H1`.
A two-signer letter also keeps `j1`–`j4`, `j8`, `t5`–`t7`, `t9` for `H2`.
PandaDoc detects those tags when staff upload the file.

Procedure:

1. Open the claim in the workspace and download the letter.
2. Upload the PDF to PandaDoc as a new document.
3. Check that PandaDoc created the `H1` fields, and the `H2` fields on a two-signer letter.
4. Assign `H1` to the primary policyholder.
5. Assign `H2` to the second policyholder when the letter has one.
6. Send the document from PandaDoc.
7. Download the completed PDF from PandaDoc after every signature.
8. Upload it to the claim's Documents tab with kind `lor_signed`.

The claim advances to `lor_signed` through the existing database gate.
Check every page before sending, because the download is not reviewed by anyone else.
The printed date is the download date, not the signature date.

## Account and environment preparation

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

## Hosted platform acceptance

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
Platform mode verifies the raw-body HMAC before event handling.
The event ledger records leases and completed work.
Do not clear ledger rows or retry an uncertain send without checking provider state.

## Production activation

Production key changes, webhook changes, deployments, and live sends each require approval.
Keep Production in `SITE_MODE=staff` until the approved invitation checks pass and the owner approves the mode change.
Track retention, export, erasure, and legal holds as separate release work in RELEASE_STATE.
The manual provider remains available in platform mode without a PandaDoc API key.

See the [current integration blueprint](../reference/pandadoc/06-cmg-integration-blueprint.md) for source mappings.
