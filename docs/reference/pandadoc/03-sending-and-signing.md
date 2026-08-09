# Sending & Signing

Sources: `/docs/send-document`, `/docs/set-signing-order`, `/docs/embedded-signing`.

## Send endpoint

```http
POST /public/v1/documents/{id}/send
```

Body may be empty `{}` → default notification email to all recipients. Options:

| Param | Purpose |
|---|---|
| `message` | Custom body text in the notification email |
| `subject` | Custom subject (default: "[Sender] sent you '[Document name]'") |
| `silent` | `true` = suppress **all** PandaDoc recipient emails/SMS (use when delivering via embedded signing or your own channel). Doesn't affect approval-workflow notifications |
| `sender` | Override sender (`email` or `membership_id`) |
| `forwarding_settings` | `forwarding_allowed`, `forwarding_with_reassigning_allowed` |
| `selected_approvers` | Pick approver when the template has an approval workflow |

- Success → status `document.sent` (or `document.waiting_approval` if the template has an
  approval workflow — approve, then call send again).
- Sending while still `document.uploaded` → **409** (wait for `document.draft`).
- 403 on sandbox = recipient outside your email domain.
- Each recipient gets a per-recipient **`shared_link`** (in send response / document details) —
  usable if we ever deliver links ourselves with `silent: true`.
- A **Send Reminder** endpoint exists to nudge unsigned recipients.

## Signing order

- `signing_order` integer ≥ 1 per recipient; lower signs first; equal numbers sign **in
  parallel** as one group; next group only after the whole current group completes.
- All-or-nothing: every recipient ordered, or none (mixed → rejected). Remove by setting all
  to `null`.
- Can be set: (a) in the create request, (b) via `PATCH /documents/{id}` while in draft
  (recipients identified by `id` from Document Details; partial updates OK), or (c) in the
  template itself — recommended for standardized flows; documents inherit it.
- **CMG LOR**: Homeowner1 + Homeowner2 sign in parallel (same order number / no order) — no
  reason to serialize spouses.

## Embedded signing (portal-native signing, likely v1.1)

Lets the homeowner sign inside our customer portal without a PandaDoc redirect:

1. Create document → wait for `draft` → **send with `{ "silent": true }`** (doc must be
   `document.sent` before a session can be made).
2. Create a signing session per recipient:
   ```http
   POST /public/v1/documents/{document_id}/session
   { "recipient": "jane@example.com", "lifetime": 90000 }
   ```
   → returns session `id`. `lifetime` is seconds the session link stays valid.
3. Embed with the `pandadoc-signing` npm library:
   ```ts
   import { Signing } from "pandadoc-signing";
   const signing = new Signing("signing-container",
     { sessionId, width: 800, height: 600 }, { region: "com" });
   await signing.open();
   ```
   Events: `document.loaded`, `document.completed`, `document.exception` — use
   `document.completed` for in-app redirect (recipient redirect settings do NOT apply to
   embedded sessions). Legacy path: iframe on `https://app.pandadoc.com/s/{session_id}`.
4. **Signer identity is OUR responsibility** in embedded mode — acceptable for us because the
   portal already authenticates the claimant before we mint a session for *their own* email.

Decision for v1: standard **email delivery** (`silent: false`) — signers include second
policyholders who may have no portal account yet. Embedded signing is a portal enhancement
later (create session only for the logged-in claimant's recipient email).
