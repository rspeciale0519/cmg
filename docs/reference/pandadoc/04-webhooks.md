# Webhooks

Sources: `/docs/webhook-setup`, `/docs/webhook-events`, `/docs/webhook-verification`,
`/docs/webhook-deduplication`, `/reference/handledocumentstatechanged`.

## Subscriptions

Create via Developer Dashboard (API Configuration → Webhooks) or API:

```http
POST /public/v1/webhook-subscriptions
```
```json
{
  "name": "CMG claims platform",
  "url": "https://<our-domain>/api/pandadoc/webhook",
  "triggers": ["document_state_changed", "recipient_completed", "document_completed_pdf_ready", "document_creation_failed"],
  "payload": ["fields", "tokens"],
  "active": true
}
```

- HTTPS endpoint required. Local dev: tunnel (ngrok / cloudflared / localtunnel).
- Max **300 subscriptions per workspace**; subscriptions are per-workspace.
- Manage via list/details/update/delete endpoints + **Update Shared Key** endpoint (rotation).

## Events we care about

| Event | Fires when | Our use |
|---|---|---|
| `document_state_changed` | Any status transition (incl. → `draft`) | Advance LOR state machine; detect draft-ready; detect declined/expired |
| `recipient_completed` | One signer finished (`action_by`, `action_date` in payload) | Feed entry "Jane Roe signed the LOR" + notify staff |
| `document_completed_pdf_ready` | Completed PDF sealed & saved to PandaDoc e-vault | Trigger `/download-protected` → store in Supabase → claim → `lor_signed` |
| `document_creation_failed` | Async creation failed (validation etc.) | Surface error to admin; keep claim in `under_review` |
| `document_updated` | Document reverted to draft | Log/alert (shouldn't happen in our flow) |

## Payload shape

Always a **JSON array** (may batch multiple events):

```json
[ { "event": "document_state_changed", "data": { "id": "...", "status": "document.completed",
    "metadata": { "claim_id": "..." }, "recipients": [ ... ], "template": { ... }, ... } } ]
```

- `data` mirrors the Document Details response; `fields`/`tokens`/`products`/`pricing` included
  only if selected in the subscription's `payload` config. Basic info + `recipients` always sent.
- `metadata` round-trips — our `claim_id` arrives in every event.
- Caveat: `recipients[].shared_link` may be empty in webhook payloads (async) — call Document
  Details if a link is needed.

## Verification (MANDATORY in our handler)

- Every delivery is signed: **HMAC-SHA256 of the raw HTTP body** (UTF-8) with the
  subscription's **shared key**, hex-encoded, appended as a **query parameter**:
  `POST https://our-endpoint/api/pandadoc/webhook?signature=a1b2c3...`
- Verify against the **raw body** (before any JSON parsing), timing-safe compare:

```ts
import crypto from "node:crypto";

export function verifyPandaDocSignature(sharedKey: string, rawBody: string, signature: string) {
  const expected = crypto.createHmac("sha256", sharedKey).update(rawBody).digest("hex");
  const a = Buffer.from(expected, "hex");
  const b = Buffer.from(signature, "hex");
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}
```

- Failure → log for security monitoring, return **403**, do not process.
- Shared key lives in env (`PANDADOC_WEBHOOK_SHARED_KEY`); rotate periodically via the
  Update Shared Key endpoint.
- Defense in depth: optionally check source IP against the US allowlist
  (`52.12.31.116`, `52.37.240.175`, `35.167.41.246`).

## Deduplication (MANDATORY)

- Header `X-PandaDoc-Webhook-Event-Id` (UUID) identifies a delivery. **Same** across automatic
  and manual retries of one delivery; **different** for each event type produced by one
  underlying change. This header — not document id or payload hash — is the dedupe key.
- Pattern: atomic insert-if-absent of the event id (unique constraint) in the same transaction
  as the side effects; if already present → return 200 and skip. Missing header → log, reject.

## Delivery rules

- POST, `Content-Type: application/json`, `User-Agent: PandaDoc Webhooks`.
- Timeouts: 5 s connect, **20 s read** — respond fast, keep processing light or enqueue.
- Success = any status **< 400** (return 200; return success even for recognized duplicates).
- Failure (≥ 400 or transport error) → **3 automatic retries**, exponential backoff; manual
  retry available in the dashboard's Webhooks History tab.
- **410 Gone → immediate subscription deactivation** (never return 410 casually).
- Soft deactivation: 7 trailing days with ≥ 1 failure and zero successes.
