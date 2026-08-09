# CMG Integration Blueprint — PandaDoc LOR Flow

How PandaDoc plugs into the claims platform designed in
[`.claude/plans/feature-claims-platform.md`](../../../.claude/plans/feature-claims-platform.md).
This replaces the v1 "manual send + upload signed copy" plan wherever a PandaDoc key is
configured; the ManualSignProvider remains as the no-key fallback.

## Prerequisites (account side — Austin/Rob)

1. PandaDoc **Business or Enterprise** account (trial works for dev) → generate **Sandbox key**
   in the Developer Dashboard (`app.pandadoc.com/a/#/settings/api-dashboard`).
2. Key owner should be a stable admin account (key dies if the owning user is removed).
3. Build the **LOR template** in the PandaDoc editor:
   - Roles: `Homeowner1`, `Homeowner2` (role names: no underscores).
   - **Tokens** (variables) for data we push: `Claim.Ref`, `Claim.Carrier`, `Claim.PolicyNumber`,
     `Claim.LossDate`, `Claim.Cause`, `Property.Address`, `Homeowner1.Name`, `Homeowner2.Name`,
     `Adjuster.Name`, `Fee.Percent`, plus whatever the final legal text needs.
   - **Fields** per role: signature, date-signed, initials (merge-field names like
     `H1.Signature`, `H1.DateSigned`, `H1.Initials`, same for H2).
   - Both roles unordered / same `signing_order` → spouses sign in parallel.
   - Template with only `Homeowner1` filled works for single-claimant policies **if** the
     template keeps `Homeowner2` fields optional — simplest: maintain TWO template UUIDs
     (1-signer and 2-signer) and pick by claimant count. Decision at template-build time.
4. Create the **webhook subscription** (dashboard or API) → copy the **shared key**.
5. Before launch: sales conversation for **Production key** (Enterprise/API contract; billed
   per document created — one LOR per claim ≈ one billed document).

## Environment variables (all server-only)

```
PANDADOC_API_KEY=                 # sandbox in dev, production at launch
PANDADOC_LOR_TEMPLATE_UUID=       # 2-signer template
PANDADOC_LOR_TEMPLATE_UUID_SINGLE=# 1-signer template (optional, see above)
PANDADOC_WEBHOOK_SHARED_KEY=      # HMAC shared key for /api/pandadoc/webhook
```

No `NEXT_PUBLIC_` PandaDoc values exist. Missing `PANDADOC_API_KEY` → ESignProvider factory
returns ManualSignProvider (graceful degradation, admin UI shows the manual path).

## Provider interface mapping

```ts
// lib/esign/provider.ts
interface ESignProvider {
  kind: "pandadoc" | "manual";
  sendLor(input: {
    claim: Claim; claimants: Claimant[];      // 1 or 2 signers
    fee: { percent: number };
    sentBy: StaffProfile;
  }): Promise<{ providerDocumentId: string }>;
  // webhook route calls these:
  verifyAndParseWebhook(rawBody: string, signature: string, eventId: string):
    Promise<PandaDocEvent[] | "invalid">;
  downloadSignedPdf(providerDocumentId: string): Promise<ReadableStream>;
}
```

### `sendLor` implementation steps (PandaDocProvider)

1. `POST /documents` with `template_uuid`, `recipients` (role ↔ claimant mapping),
   `tokens` (claim data), `metadata: { claim_id }`, name `LOR — {claim_ref}`.
2. Poll `GET /documents/{id}` until `document.draft` (500 ms interval, ~20 tries, backoff on
   429; abort → surface error). (We poll rather than wait for the webhook so the admin gets a
   synchronous success/failure in the UI; the `document_creation_failed` webhook is the async
   safety net.)
3. `POST /documents/{id}/send` with a short message; `silent: false` (PandaDoc emails signers).
4. Persist: `claims.pandadoc_document_id = id`; claim status → `lor_sent`; feed event
   (`shared`): "Letter of Representation sent for signature."
5. Optionally `GET /documents/{id}/download` → store as `lor_unsigned` for the claim file.

### Webhook route `app/api/pandadoc/webhook/route.ts`

Order of operations (must-follow):

1. Read **raw body** (`await req.text()`) — never parse first.
2. Verify HMAC-SHA256 (`?signature=` query param, shared key, timing-safe). Fail → 403 + audit.
3. Dedupe: `X-PandaDoc-Webhook-Event-Id` → `pandadoc_webhook_events` insert-if-absent
   (unique PK) in the same transaction as side effects; duplicate → 200, stop.
4. Parse array; for each event, resolve claim via `data.metadata.claim_id`
   (fallback: `claims.pandadoc_document_id = data.id`); unknown → log, continue.
5. Apply (idempotent, service-role, audited):
   - `recipient_completed` → feed event "{action_by} signed" + staff notification.
   - `document_state_changed`:
     - `document.completed` → nothing yet (wait for PDF-ready)
     - `document.declined` / `document.expired` / `document.cancelled` → flag claim, notify staff
     - creation-side states → update esign tracking column
   - `document_completed_pdf_ready` → `GET /download-protected` → Supabase Storage
     `claims/{claim_id}/…pdf` + `documents` row (`kind='lor_signed'`, `visibility='customer'`)
     → claim transition `lor_sent → lor_signed` (status machine) → notifications (customer +
     partner-visible milestone).
   - `document_creation_failed` → admin alert with `data.error.detail`.
6. Return 200 fast (< 20 s budget; our work is small — do it inline, transactionally).

### Schema additions to the platform spec

- `claims.pandadoc_document_id text unique null`
- `claims.esign_status text null`   -- provider-side status mirror for admin UI
- `pandadoc_webhook_events` (`event_id uuid primary key`, `received_at`, `payload_summary jsonb`)
  — RLS: no client access (service-role only)

## Sandbox testing plan

- Sandbox key: **10 req/min total** — keep polling gentle (the 500 ms × 20 poll burns the
  budget; in dev, poll at 2 s).
- Sandbox can only email **recipients on the sender's own email domain** → test signers must be
  aliases on the account's domain (e.g. `austin+h1@…`, `austin+h2@…`). Gmail-style `+` aliases
  on the same domain work.
- Docs get `[DEV]` prefix + watermarked PDFs — expected, ignore in dev assertions.
- Local webhooks: run `cloudflared tunnel` (or ngrok) → tunnel URL into a dev webhook
  subscription. Keep a separate subscription per environment.
- E2E happy path to verify: intake → accept → Send LOR → both sandbox signers sign →
  webhook chain → signed PDF lands in Supabase → claim shows `lor_signed` → partner sees the
  milestone; plus: decline path, dedupe (manual retry from dashboard), bad-signature 403.

## Spec deltas this document implies

1. Decision #9 becomes: **PandaDoc** behind `ESignProvider` (ManualSignProvider = no-key fallback).
2. pdf-lib LOR generation is **dropped from v1** — the PandaDoc template replaces it (the
   `lib/pdf/` module dies; less code, no template-drift between two renderings).
3. `api/esign/webhook` route → `api/pandadoc/webhook` (implemented, not 501).
4. Status gate unchanged: `lor_sent → lor_signed` still requires the `lor_signed` document —
   now attached automatically by the webhook (manual upload path still satisfies it).
5. CSP `connect-src` unchanged (API calls are server-side); if embedded signing is added later,
   allow `https://app.pandadoc.com` in `frame-src` on the portal page that hosts it.
6. Launch checklist additions: production key contract, production webhook subscription +
   shared key, template UUIDs configured, Resend unaffected.
