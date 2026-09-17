# CMG PandaDoc integration

The current LOR flow uploads bundled PDFs to PandaDoc.
It does not require a PandaDoc template UUID.
`SITE_MODE=simple` keeps PandaDoc webhook processing disabled.
Platform activation remains a separate release.

[HANDOFF.md](../../temp/HANDOFF.md) contains current release evidence and unresolved risks.
[PandaDoc setup](../../temp/PANDADOC_SETUP.md) contains the approved test procedure.
The [original platform plan](../../../.claude/plans/feature-claims-platform.md) records earlier design decisions.
Current code and tests take priority.

## Sources of truth

| Source | Responsibility |
|---|---|
| [types.ts](../../../src/lib/esign/types.ts) | `ESignProvider`, requests, dispatch results, and errors |
| [provider.ts](../../../src/lib/esign/provider.ts) | PandaDoc or manual provider selection |
| [lor-dispatch.ts](../../../src/lib/esign/lor-dispatch.ts) | Validation, dispatch ownership, and claim effects |
| [pandadoc.ts](../../../src/lib/esign/pandadoc.ts) | Create from PDF, wait for draft, and send |
| [lor-letter.ts](../../../src/lib/esign/lor-letter.ts) | Claim read, content gates, and letter tokens |
| [lor-pdf.ts](../../../src/lib/esign/lor-pdf.ts) | Bundled files, fields, and signer roles |
| [lor-prefill.ts](../../../src/lib/esign/lor-prefill.ts) | Local tag substitution for the manual prefilled PDF |
| [prefill-lor.ts](../../../src/lib/esign/prefill-lor.ts) | Authorized download of the prefilled letter |
| [pandadoc-client.ts](../../../src/lib/esign/pandadoc-client.ts) | API requests, deadlines, and provider errors |
| [webhook.ts](../../../src/lib/esign/webhook.ts) | HMAC, event leases, claim resolution, and dispatch reconciliation |
| [webhook-handlers.ts](../../../src/lib/esign/webhook-handlers.ts) | Recipient, document state, and completed-PDF handling |

The provider interface exposes `dispatchLor()` and `downloadSignedPdf()`.
It also exposes `kind` and `canSendElectronically`.
Claim authorization and database effects belong outside the transport provider.

## PDF and role mapping

| Claimants | Bundled PDF | External roles |
|---|---|---|
| One | `CMG_LOR-2026-PandaDoc-Single.pdf` | `H1` |
| Two | `CMG_LOR-2026-PandaDoc-Dual.pdf` | `H1`, `H2` |

Both files reside in `src/lib/esign/templates/`.
Next.js file tracing includes these PDFs in server output.
The internal roles remain `Homeowner1` and `Homeowner2`.
`pandaDocRecipients()` maps them to `H1` and `H2`.

| PDF field IDs | Application values |
|---|---|
| `ph`, `accepted` | `Policyholders.Name` |
| `carrier`, `policy`, `claimno` | Carrier, policy number, and claim number |
| `property`, `lossdate`, `cause` | Property address, loss date, and cause |
| `fee`, `adjuster` | Fee percent and adjuster name |
| `phone`, `email` | Primary policyholder contact details |
| `em`, `ne`, `su` | Selected agreement category |
| `d1` through `d8`, `d9a`, `d9b` | Dispatch date in `America/New_York` |
| `i1`, `i2`, `i3`, `i4`, `i8` | Blank `H1` initials |
| `s5`, `s6`, `s7`, `s9` | Blank `H1` signatures |
| `j1`, `j2`, `j3`, `j4`, `j8` | Blank `H2` initials in the dual PDF |
| `t5`, `t6`, `t7`, `t9` | Blank `H2` signatures in the dual PDF |

Prefilled date text is not evidence of the signature time.
Legal review must cover these fields and both agreement variants.
The selected `lor_contract_type` determines the emergency, non-emergency, or supplemental mark.
Dispatch refuses a missing agreement category.

The source PDF is `temp/docs/CMG_Blank-LOR-2026.pdf`.
`scripts/build-lor-tagged-pdfs.py` produces both variants under `temp/docs/`.
It does not update the bundled copies automatically.
Review regenerated pages before replacing release assets.
Do not change approved legal wording as part of routine setup.

`scripts/build-lor-tagged-pdfs.py --manifest src/lib/esign/lor-tag-manifest.json` exports the tag coordinates.
The manifest is the only tag source the application reads.
Regenerate it whenever the script's coordinate tables change.
`lor-prefill.test.ts` compares the manifest against both bundled PDFs.

## Manual prefilled-PDF signing

This path needs no PandaDoc API key and no webhook.
It is the release path while CMG signs through the PandaDoc web app.
The provider stays `manual`, so nothing in the application calls PandaDoc.

`prefillLorForClaim()` authorizes the caller and applies the content gates.
It uses `requireStaff()` and `claimCapabilities().canManage`, exactly as `sendLor()` does.
It refuses `missing_policy`, `missing_lor_type`, `missing_fee`, and `no_claimants`.
It writes an `esign.lor_prefilled` audit row before it releases the bytes.
It does not advance the claim status and does not claim the dispatch lease.
Staff can therefore download the letter as often as the desk needs.

`buildPrefilledLorPdf()` replaces each data tag's drawn string with the claim value.
It leaves every initial and signature tag exactly as drawn.
A covered tag is not enough: PandaDoc reads invisible text on upload.
Values wider than their tag are condensed, then truncated with `...`.

Staff procedure:

1. Open the claim and download the letter from the representation panel.
2. Upload the PDF to PandaDoc as a new document.
3. Confirm PandaDoc detected the `H1` tags, and the `H2` tags on a two-signer letter.
4. Assign `H1` to the primary policyholder and `H2` to the second policyholder.
5. Send the document from PandaDoc.
6. Download the completed PDF from PandaDoc after every signature.
7. Upload it to the claim's Documents tab with kind `lor_signed`.

The claim advances to `lor_signed` through the existing database gate.
That gate still requires a `documents` row of kind `lor_signed`.
Prefilled date text is not evidence of the signature time.

## Environment

| Variable | Current use |
|---|---|
| `SITE_MODE` | Keep `simple` until platform activation is approved |
| `PANDADOC_API_KEY` | Selects PandaDoc instead of the manual provider |
| `PANDADOC_WEBHOOK_SHARED_KEY` | Verifies inbound HMAC signatures |
| `PANDADOC_API_BASE_URL` | Optional API URL override |
| `PANDADOC_POLL_INTERVAL_MS` | Optional polling interval; default 2000 ms |
| `PANDADOC_POLL_MAX_ATTEMPTS` | Optional poll count; default 20 |
| `PANDADOC_LOR_TEMPLATE_UUID`, `PANDADOC_LOR_TEMPLATE_UUID_SINGLE` | Legacy optional configuration; unused by current PDF dispatch |

Keep PandaDoc credentials server-only.
Confirm account access and provider limits before any live test.
An available API key does not prove that the complete workflow is ready.
A missing webhook key prevents completed signatures from returning through the webhook.
Vercel environment changes require redeployment.
See [Vercel environment behavior](https://vercel.com/docs/environment-variables).

## Dispatch sequence

1. Authorize the staff caller and require AAL2.
2. Verify claim access, status, policy facts, agreement category, and signers.
3. Claim dispatch ownership through the database ledger.
4. Load the single or dual PDF.
5. Create the PandaDoc document with recipients, mapped fields, and `parse_form_fields: false`.
6. Include the claim ID and dispatch attempt token in provider metadata.
7. Wait for `document.draft` within the operation deadline.
8. Record provider identity and send intent before sending.
9. Send with `silent: false`.
10. Record the outcome through the dispatch and claim state controls.

The transport uses a 90-second operation deadline.
Its retry logic does not justify sending another LOR after an uncertain result.
Preserve the dispatch attempt and reconcile with provider evidence first.
The manual provider leaves delivery to staff in platform mode.

## Webhook sequence

The route is `/api/pandadoc/webhook`.
Simple mode returns 404 before reading the body.
Platform mode processes the following sequence:

1. Read the original body.
2. Verify its HMAC-SHA256 signature using `PANDADOC_WEBHOOK_SHARED_KEY`.
3. Validate `X-PandaDoc-Webhook-Event-Id`.
4. Claim the event ID and payload hash through the event ledger.
5. Parse events and resolve the claim.
6. Verify the active dispatch attempt.
7. Apply idempotent event effects.
8. Mark completed work or release failed work for recovery.

Signature failure returns 403.
A completed duplicate returns 200.
A concurrent active lease returns 503.
An event ID with a different payload hash returns 409.
These outcomes preserve retry and duplicate-detection state.

| Event | Current handling |
|---|---|
| `recipient_completed` | Record recipient completion and related effects |
| `document_state_changed` | Track provider state and reconcile dispatch |
| `document_completed_pdf_ready` | Download the protected PDF and complete claim filing |
| `document_creation_failed` | Record failure and recovery state |

Completed PDFs use private `claim-docs` storage.
The document row uses `kind=lor_signed` and `visibility=customer`.
Status advancement requires the signed document.
Storage, provider calls, and database work do not form one external transaction.
Database leases, idempotent operations, and exact cleanup paths support recovery.

## Required verification

Run normal unit tests without live opt-in.
Run the CI database-backed selection only against disposable local data.
No routine check should create a real PandaDoc document.

The draft test needs shell-only `PANDADOC_LIVE_DRAFT_TEST=1`.
It also needs `PANDADOC_API_KEY` and `PANDADOC_DRAFT_TEST_EMAIL`.
After opt-in, an optional `.env.local` can supply credentials.
A missing local file is allowed.
The test creates a real single-signer draft and does not send it.
Obtain approval before running it.

The draft assertion checks only `document.draft`.
Hosted acceptance must also cover field placement, both signer counts, legal text, email, completed PDFs, and access control.
Test duplicate events, concurrent processing, creation failure, terminal states, delayed events, and uncertain sends.
Keep test results and skips in HANDOFF.

## Activation and recovery gates

Keep the platform disabled during the simple-mode release.
Require owner MFA, AAL2, role checks, and hosted integration acceptance before activation.
Complete retention, export, erasure, and legal-hold work before activation.
Public legal approval remains required before launching the public forms.

Back up both database data and Storage objects before approved production migrations.
Never seed production.
Preserve provider and database ledgers during recovery.
Use the [README release and recovery order](../../../README.md#simple-mode-production-runbook).
Recheck cron jobs after deployment or rollback.
