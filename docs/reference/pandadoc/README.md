# PandaDoc Integration Reference

Knowledge base for integrating PandaDoc e-signature into the CMG Property Solutions claims
platform (Letter of Representation signing). Compiled 2026-08-08 from
https://developers.pandadoc.com via Firecrawl.

## Files

| File | Contents |
|------|----------|
| [01-platform-basics.md](01-platform-basics.md) | Accounts/workspaces, API keys, sandbox vs production, rate limits, security, SDKs |
| [02-document-lifecycle.md](02-document-lifecycle.md) | Creation methods, async pattern, statuses, variables vs fields, prefill, field tags |
| [03-sending-and-signing.md](03-sending-and-signing.md) | Send endpoint, silent mode, signing order, embedded signing sessions |
| [04-webhooks.md](04-webhooks.md) | Subscriptions, events, HMAC verification, dedup, delivery rules |
| [05-download-completed.md](05-download-completed.md) | Getting the signed PDF into our storage |
| [06-cmg-integration-blueprint.md](06-cmg-integration-blueprint.md) | **Our** LOR flow end-to-end: provider design, schema, env vars, webhook route, test plan |

## One-minute summary

- REST API at `https://api.pandadoc.com/public/v1`, header `Authorization: API-Key {key}`.
- **Document creation is asynchronous**: create → status `document.uploaded` → wait for
  `document.draft` (webhook or polling; using it early = 404, sending early = 409) → send.
- Our LOR flow: create doc **from a PandaDoc template** (tokens for claim data, signature
  fields per homeowner role) → send (PandaDoc emails the signers) → webhooks tell us when each
  recipient signs and when the completed PDF is ready → we download the sealed PDF via
  `/download-protected` into Supabase Storage → claim auto-advances to `lor_signed`.
- Webhook security: HMAC-SHA256 of the raw body with a shared key, delivered as `?signature=`;
  dedupe on the `X-PandaDoc-Webhook-Event-Id` header; respond < 400 within 20 s.
- Dev happens on a **free Sandbox key** (10 req/min, watermarked PDFs, recipients must share
  the sender's email domain). Production key requires a PandaDoc Enterprise/API contract —
  **Austin needs a PandaDoc plan with API access before launch** (billed per document created).
