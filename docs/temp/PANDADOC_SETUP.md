# PandaDoc setup for CMG

Production uses the manual prefilled-PDF signing path. The owner recorded `SITE_MODE=platform` activation on 2026-10-07.
The PandaDoc API path is not part of the current manual release.
Do not repeat or undo the completed platform activation. Any further Production change needs separate approval after acceptance.
[HANDOFF.md](HANDOFF.md) contains current account, deployment, migration, and verification evidence.
This guide describes setup requirements, not proof that a hosted environment meets them.

The earlier PR #19 Preview reported API and webhook keys as configured.
PR #23 and combined PR #24 have their approved branch-only blank-key overrides and Ready rebuilds.
`src/lib/esign/config.ts` treats absent or blank key values as unconfigured.
Its authenticated Settings panel confirms Manual, bundled PDF, and webhook key not set.
Do not repeat the completed setup approval or redeploy. Revised manual field recognition now passes for both signer variants.
Keep Production settings and shared Preview key values unchanged.
Do not send an API document to test the manual flow.

The original Single synthetic draft failed because black tag text remained visible under the fields.
That unsent draft is retained. The original Dual file was not uploaded; its unchanged-file approval does not cover revised bytes.
The owner approved an isolated local repair on `bugfix/manual-signing-tag-visibility`, based on current `develop` commit `1b7f7f9`.
The local repair preserves bundled assets, data values, legal text, and API bytes.
The first white-glyph repair leaves small gaps in underlying lines and was rejected locally.
The second local output uses scoped non-painting tag text. All eighteen rendered pages preserve the printed lines and original text.
Both revised hashes and regression evidence are recorded in HANDOFF.
Type checking, lint, the normal build, and 124 focused tests in each site mode pass.
The final full unit run passes 1,682 tests, with 56 database/live tests skipped because the needed local services are unavailable.

The owner then approved the exact revised Single `589d1a8f` and Dual `613747b4` files as two new unsent drafts.
Both were uploaded once in the existing CMG workspace on 2026-10-19. The tag text is no longer visible.
Single draft `GxuADmbyQZ5rJDCtZXnpH5` has five Initials and four Signature fields, on the expected pages.
Dual draft `9o6Qkr27Yyu5MvhgyRMo9N` has ten Initials and eight Signature fields, two per page.
All twenty-seven fields are required. A fresh reopen retains nine and eighteen fields, with Draft status and no Connecting or Syncing state.
Both drafts assign all fields to the current account. Intended signer assignment is not verified.
Both Add recipient searches require **Create as new contact** for the approved test addresses.
No contact was saved because that write was excluded. PandaDoc's [recipient guide](https://support.pandadoc.com/en/articles/9714650-add-and-manage-recipients) describes this contact step.
Single's page 7 rectangle reaches the last affidavit line area. Dual's two page 7 rectangles overlap each other and reach that area.
Text remains visible through the editor boxes. Completed-signature appearance was not tested.
Before signing, each box must sit on its intended INSURED line, clear of text and other fields.
At that point, correction and separate assignment needed approval for those existing drafts and two saved test contacts.
Those draft-only checks needed no upload. The later local layout correction below now requires new-file approval.
No contact, finalization, email, signature, deletion, or CMG write occurred.
At that stage, no Git action or deployment was approved for the local repair.
The owner later approved a local printed-value correction, including the generator, coordinate manifest, and both shared PDF assets.
The v3 local outputs correct twelve data baselines per variant, including dates, page 1 values, and the page 9 adjuster.
All eighteen background images, legal text, printed values, and signer positions remain unchanged apart from the measured data moves.
The new coordinate checks refuse stale assets. Focused, three-mode, type, lint, build, and page-comparison checks pass.
The fresh full unit run passes 1,686 tests in 121 files; 56 database/live tests in thirteen files skip.
Docker is unavailable, so database/live coverage remains incomplete. No schema, hosted data, API implementation, or service setting changed.
The owner separately approved the six-file commit, exact v3 provider batch, push, and draft PR.
Signed commit `56cff18` is published in draft PR #25 targeting `develop`, with exactly six files.
CI run `39349972823` passes type check, lint, build, audit, 1,686 unit tests, 1,350 pgTAP assertions, and 253 database-backed tests.
Unit skips 56 database/live tests. The database selection skips one live PandaDoc test. The automatic Preview is Ready.
No merge, Production change, legal acceptance, send, or signature is approved.
The two v3 drafts now retain nine and eighteen required fields after reopening. Both hidden-tag checks pass.
Only the three page 7 boxes were resized and moved. They remain clear of legal text, labels, dates, and each other after reopening.
All three edited fields remain required. Both editor views are restored to 100 percent.
PandaDoc rejects `cmg-test-1@example.invalid` and disables Save. Root canceled contact creation; no contact was saved.
The owner then approved CMG Synthetic Signer 1 (`4miodio@gmail.com`) and CMG Synthetic Signer 2 (`robspeciale@gmail.com`).
Signer 1 is saved once and reused. Single saves all nine fields for signer 1; the current account is CC.
The two-recipient plan counted the current account and blocked adding signer 2. No upgrade was purchased.
The owner separately approved replacing only the current account's Dual draft recipient entry with signer 2.
Signer 2 is now saved once. The replacement transferred exactly nine right/lower fields and preserved all nine left/upper signer 1 fields.
The current account is not retained as a third CC recipient. Saved account and existing contact details remain unchanged.
Each Dual signer has five initials and four signatures, one field on each page. All eighteen individual Required checks pass.
Field types, positions, and sizes stay unchanged. The saved reload retains all eighteen assignments and unchanged geometry.
Both synthetic drafts remain unsent and unsigned. No new upload occurred. Recovery uses a reviewed draft correction; the provider has no Undo for replacement.
Keep every older draft and fixture. Legal review and completed signed appearance remain open.
Push, PR, finalization, email, signatures, purchases, deletion, CMG database writes, Production changes, and DNS changes remain excluded.
Do not send mail, save contacts, purchase access, or change a CMG record without separate exact approval.
See HANDOFF for file hashes, render limits, and the remaining full signing test.

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
The API uses role-qualified tags. The revised manual outputs pass synthetic web recognition and separate recipient assignment in the retained v3 drafts.
This does not verify a real claim's Preview download, legal acceptance, completed signatures, or filing.
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
16. Record exact results before requesting the next Production release.

The webhook path is `/api/pandadoc/webhook`.
Simple mode returns 404 before processing the body.
Staff and platform modes reach raw-body HMAC verification before event handling.
Production is recorded as manual; recheck the approved environment before any API activation.
The event ledger records leases and completed work.
Do not clear ledger rows or retry an uncertain send without checking provider state.

## Production activation

Production key changes, webhook changes, deployments, and live sends each require approval.
Production platform activation is recorded as complete. Keep Production unchanged during remaining acceptance unless the owner approves an exact change.
Track retention, export, erasure, and legal holds as separate release work in RELEASE_STATE.
The manual provider remains available in platform mode without a PandaDoc API key.

See the [current integration blueprint](../reference/pandadoc/06-cmg-integration-blueprint.md) for source mappings.
