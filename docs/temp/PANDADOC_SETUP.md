# PandaDoc setup for CMG

Last checked: 2026-08-13.

The CMG code is ready for PandaDoc. The PandaDoc account, templates, and API
values do not exist in this project yet. Complete the steps below in order.

## 1. Confirm API access

1. Sign in to the CMG PandaDoc account.
2. Confirm that the plan includes API access.
3. Create a sandbox API key for the first test.
4. Keep the key owner as a stable CMG administrator.

## 2. Build two LOR templates

Create one template for one signer and one template for two signers.

Use these role names exactly:

- `Homeowner1`
- `Homeowner2`

Use these token names exactly:

- `Claim.Ref`
- `Claim.Carrier`
- `Claim.PolicyNumber`
- `Claim.ClaimNumber`
- `Claim.LossDate`
- `Claim.Cause`
- `Property.Address`
- `Homeowner1.Name`
- `Homeowner2.Name`
- `Adjuster.Name`
- `Fee.Percent`

Add signature, signed-date, and initials fields for each role. Make both roles
sign in parallel in the two-signer template. Copy both template UUIDs.

## 3. Create the webhook

1. Create a PandaDoc webhook subscription.
2. Use this production path after the final domain is active:
   `https://FINAL-DOMAIN/api/pandadoc/webhook`
3. Subscribe to document state, recipient completion, completed-PDF-ready, and
   document-creation-failed events.
4. Copy the webhook shared key.

## 4. Add Vercel values

Add these server-only values to Production, Preview, and Development:

- `PANDADOC_API_KEY`
- `PANDADOC_LOR_TEMPLATE_UUID` for the two-signer template
- `PANDADOC_LOR_TEMPLATE_UUID_SINGLE` for the one-signer template
- `PANDADOC_WEBHOOK_SHARED_KEY`

Do not add `NEXT_PUBLIC_` to any PandaDoc value. Redeploy after the values are
saved.

## 5. Run the sandbox test

1. Set `SITE_MODE=platform` in a private Preview environment.
2. Use signer addresses that PandaDoc sandbox permits.
3. Open an `under_review` test claim with carrier and policy data.
4. Send the LOR from the admin claim page.
5. Confirm sent and viewed states.
6. Sign with every required signer.
7. Confirm the signed PDF appears in the claim documents.
8. Confirm the claim moves to `lor_signed` once.
9. Replay one webhook. Confirm that no duplicate document, email, feed item, or
   status history appears.
10. Test declined, expired, creation-failed, and uncertain-send recovery states.

## 6. Move to production

1. Obtain the PandaDoc production API key.
2. Approve the final legal LOR text and the fee token behavior.
3. Replace the sandbox key with the production key in Vercel Production.
4. Point the production webhook to the final HTTPS domain.
5. Run one controlled live claim from send through signed PDF filing.

The manual-signing workflow stays available if PandaDoc is not configured. Do
not enable electronic sending until all four PandaDoc values and both templates
are correct.
