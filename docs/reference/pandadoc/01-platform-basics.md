# PandaDoc Platform Basics

Sources: `/reference/about`, `/docs/tldr`, `/reference/auth-overview`,
`/reference/api-key-authentication-process`, `/reference/sandbox-key`, `/reference/limits`,
`/reference/security`, `/docs/organizations-workspaces-api-keys`, `/reference/sdk`.

## API fundamentals

- Base URL: `https://api.pandadoc.com/public/v1` (mostly v1; some newer endpoints are v2).
- One API version only; REST, JSON, standard HTTP codes.
- HTTPS required for every request **and** every configured URL (webhooks included).
- OpenAPI spec: https://openapi.pandadoc.com/scalar/ · Markdown page index: `/llms.txt`.
- Max request body **2 MB**; max uploaded PDF **50 MB** (413 above that).

## Authentication

Two header schemes:

```http
Authorization: API-Key {{api_key}}     # API-key auth (what we use)
Authorization: Bearer {{oauth_token}}  # OAuth 2.0 (multi-tenant apps acting per-user)
```

Keys are generated on the Developer Dashboard: `app.pandadoc.com/a/#/settings/api-dashboard`
(Configuration page). OAuth exists for acting on behalf of many users' accounts — not needed
for a single-firm integration like CMG.

### Key ownership rules (important)

- A key is **tied to the user who generated it** and inherits that user's role/permissions.
  Owner must be a workspace **Admin** at creation; if their role changes, the key's scope
  changes with it.
- **If the owning user is removed from the workspace, the key is deactivated.** Best practice:
  generate keys from a dedicated, stable service account, not a personal account.
- Keys are **workspace-scoped** (an Organization contains Workspaces; documents/templates/
  contacts live in a workspace). Org-Admin-owned keys additionally reach org-level endpoints.
- All API actions are attributed to the key owner in PandaDoc's own audit logs.
- Rate limits are **per user** — multiple keys owned by one user share one limit.
- Rotate keys periodically.

## Sandbox vs Production

| | Sandbox key | Production key |
|---|---|---|
| Cost | Free (no charge per call) | Contract; **billed per document created**, volume discounts |
| Availability | Business & Enterprise plans (including trial) | Enterprise/API plan, activated by PandaDoc team (contact sales/support) |
| Rate limit | **10 req/min for any endpoint** | Per-endpoint table below |
| Output | PDFs watermarked, documents prefixed `[DEV]` | Clean |
| Sending | **Recipient email domain must match sender's domain** | Unrestricted |

Same environment, different key. Once production is enabled, sandbox limits are raised for
continuous testing.

## Rate limits (Production / OAuth keys)

Sliding 60-second window, per user, per endpoint (not cumulative). Exceeding → **429**
(implement backoff). Retry **409** on send-before-draft.

| API action | RPM |
|---|---|
| Create from template (document) | 500 |
| Create from PDF (document) | 300 |
| Send document | 400 |
| Document details | 600 |
| Template details | 300 |
| List / Status / Delete | 2000 |
| Download document | 100 |
| Download **protected** document | 300 |
| Any endpoint with Sandbox key | 10 |

## Security facts

- Webhook source IPs to allowlist (US servers): `52.12.31.116/32`, `52.37.240.175/32`,
  `35.167.41.246/32`. (EU app has different IPs; we're US.)
- Signed documents are generated on-demand with permissions, not stored openly; documents
  encrypted at rest on PandaDoc's side.

## SDKs

- Official server SDKs: [Node](https://github.com/PandaDoc/pandadoc-api-node-client),
  Python, Java, PHP.
- Browser-side: `pandadoc-signing` npm library for embedded signing sessions; a broader
  JavaScript SDK exists for embedding the editor.
- Our take: we call only ~5 endpoints — a thin typed `fetch` wrapper is preferred over the
  generated Node client (see blueprint doc).
