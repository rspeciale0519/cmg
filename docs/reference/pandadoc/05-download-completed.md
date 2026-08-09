# Downloading the Completed (Signed) Document

Sources: `/docs/how-to-download-completed-document`, `/reference/download-document`.

## Recommended flow (webhook-driven)

1. Subscribe to **`document_completed_pdf_ready`** — fires once the completed PDF has been
   generated and sealed into PandaDoc's e-vault.
2. Handler extracts `data.id` (and our `data.metadata.claim_id`).
3. Download the **protected** PDF:

```http
GET /public/v1/documents/{document_id}/download-protected
Authorization: API-Key {key}
```

- `/download-protected` returns the **digitally sealed** PDF — always the same bytes, includes
  the signature certificate; this is the legally meaningful copy. Rate limit 300 rpm.
- `/download` (100 rpm) renders a PDF of any document and supports watermark options — not
  needed for our flow (could serve `lor_unsigned` previews, though we can also just keep the
  PDF we get at send time).
- Handle the response as binary; stream to Supabase Storage
  (`claims/{claim_id}/{uuid}.pdf`, `documents.kind = 'lor_signed'`, `visibility = 'customer'`).

## Fallback (no webhook)

Poll `GET /documents/{id}` until `status == "document.completed"`, then download. Only for
dev/testing — production uses the webhook.

## Notes

- Sandbox-key downloads carry a watermark.
- Store PandaDoc's document id on the claim; never rely on re-listing documents to find it.
- After storing, delete nothing on PandaDoc's side (retention there is a plus), but our
  Supabase copy is the system-of-record copy for the claim file.
