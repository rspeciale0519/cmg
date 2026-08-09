# Document Creation & Lifecycle

Sources: `/docs/create-document-from-template`, `/docs/prefill-fields`,
`/docs/choosing-between-variables-and-fields`, `/docs/field-tags`, `/docs/send-document`,
`/reference/handledocumentstatechanged`.

## Creation methods

1. **From a PandaDoc template** (`template_uuid`) — our choice for the LOR. Template is built
   once in the PandaDoc web editor (branding, legal text, roles, fields, variables); the API
   stamps in per-claim data. Template UUID is visible in the template's URL:
   `https://app.pandadoc.com/a/#/templates/{ID}/content`.
2. **From a file upload** (PDF/DocX/RTF, multipart) — fields placed via *field tags* typed into
   the document text, or native PDF form fields (`parse_form_fields: true`).
3. **From a public URL** — same as upload but PandaDoc fetches the file.

### Minimal create-from-template request

```http
POST /public/v1/documents
```
```json
{
  "name": "Letter of Representation — Jane Roe",
  "template_uuid": "ustHNnVaPCD6MzuoNBbZ8L",
  "recipients": [
    { "email": "jane@example.com", "first_name": "Jane", "last_name": "Roe", "role": "Homeowner1" }
  ],
  "tokens": [ { "name": "Claim.Carrier", "value": "Citizens" } ],
  "fields": { "LossDate": { "value": "2026-08-01T00:00:00.000Z" } },
  "metadata": { "claim_id": "<our uuid>" }
}
```

Response returns `id` with `"status": "document.uploaded"`.

## THE async rule

Creation is **asynchronous**. The document is unusable until it reaches `document.draft`
(typically 3–5 s):

- Any operation before draft → **404 document not found**.
- Send before draft → **409 Conflict**.
- Wait strategies: subscribe to `document_state_changed` webhook (fires on `draft`), or poll
  `GET /documents/{id}` (Document Status, 2000 rpm). Retry 409s; back off on 429s.
- If processing fails, the `document_creation_failed` webhook fires with a validation error
  (e.g. `"Role for form field with name='userName' is not provided in payload"`).

## Document statuses

Creation & sending: `document.uploaded` → `document.draft` → `document.sent` → `document.viewed`
Approval workflow (if enabled): `document.waiting_approval` / `document.approved` / `document.rejected`
Payment (if used): `document.waiting_pay` / `document.paid`
Terminal-ish: **`document.completed`** (all signers done), `document.cancelled`,
`document.declined` (recipient declined), `document.expired`.
A completed→draft revert emits `document_updated`.

## Variables (tokens) vs Fields

| | Variables / tokens | Fields |
|---|---|---|
| Direction | One-way push into the doc | Two-way (pre-fill + recipient input) |
| Where | Templates only | Templates and uploaded docs |
| Use for | Names, addresses, claim numbers, policy data baked into text | Signatures, dates, initials, anything the signer fills |
| API | `"tokens": [{"name": "...", "value": "..."}]` | `"fields": {"MergeName": {"value": ...}}` |

- **Signature fields cannot be pre-filled.**
- A field's API key is its **Merge Field name** (set in field properties in the editor).
- Date field values: ISO 8601 (`"2019-02-21T00:00:00.000Z"`); the *display* format comes from
  the template's date-field settings, not the API value.
- LOR rule of thumb: everything the homeowner shouldn't edit → **tokens**; everything they
  provide at signing (signature, date signed, initials) → **fields** assigned to their role.

## Field tags (only if we ever upload our own PDF instead of using a template)

Bracket notation typed into the document text; parsed at upload into interactive fields:

```
[fieldType(*):role:optId_____]      e.g.  [signature:Homeowner1:sig1]
                                          [textfield*:Homeowner1:phone____]
```

- Position parts: type · optional `*` = not required · role · optional field id · optional
  underscores to widen. Separator is `:` only, no trailing colon.
- Types (short): textfield (t), checkbox (c), signature (s), date (d), initials (i),
  dropdown (dd), radio (r), stamp (st).
- Every role used in a tag must exist in the `recipients` array. **Role names cannot contain
  underscores.** Keep `parse_form_fields: false` (default) when using tags.
- Radio: options must share a page, unique ids/values, 2–50 options, no preselection.

## Recipients & roles

- Recipient = `{ email, first_name, last_name, role }`; `role` must match a template role
  (or field-tag role). People not signing can be added as CC (`kind: "contact"` via the
  Add Recipient endpoint).
- Reassignment ("Change Signer") is possible until that signer has signed; forwarding rights
  are controlled at send time (`forwarding_settings`).
- `metadata` (arbitrary key/values) survives the whole lifecycle and comes back in webhooks —
  carry `claim_id` there so webhook handlers never guess.
