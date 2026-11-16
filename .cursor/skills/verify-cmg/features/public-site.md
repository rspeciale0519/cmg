# Public site + claim/contact submission

Marketing site and the two public writes. Default proof journey: `public-contact` in `SITE_MODE=simple`.

## Sub-features

- Home (`/`) — hero “Your insurer has an adjuster.”, primary nav, “Start your free claim review” → `/file-a-claim`.
- Services `/services`, contractors `/contractors`, about `/about`.
- Contact `/contact` — `ContactForm` writes `public.leads` + `lead_staff_alert` / `lead_auto_reply` outbox.
- File a claim `/file-a-claim` — `IntakeForm` writes a `new_intake` claim + `intake_staff_alert` / `intake_confirmation`.
- Private prefixes in simple mode redirect to `/platform-disabled`.

## How to get to it (user POV)

1. Open `http://127.0.0.1:3000/`.
2. Use `nav[aria-label="Primary"]` (desktop) or the header control `aria-label="Open menu"` below 1025px.
3. Contact: Primary → Contact, heading “Start your free claim review.”
4. Intake: hero “Start your free claim review” or footer “File a claim”, heading “Letter of Representation.”
5. Confirm `/login` in simple mode lands on “Online claim accounts are not open yet.”

## Driving it with Playwright

```bash
./.cursor/skills/verify-cmg/scripts/launch.sh --mode simple --reset
./.cursor/skills/verify-cmg/scripts/doctor.sh
./.cursor/skills/verify-cmg/scripts/drive.sh public-contact
# optional second write:
./.cursor/skills/verify-cmg/scripts/drive.sh public-intake
```

Contact (`scripts/journeys/public-contact.spec.mjs`):

1. `/` → heading `/Your insurer has an adjuster/i`, `nav[aria-label="Primary"]`.
2. Click Contact.
3. Fill `#field-name`, `#field-phone`, `#field-email`, `#field-message`.
4. Wait for `input[name="cf-turnstile-response"]` to hold a token.
5. Click “Request my free review”.
6. Expect heading “Request received.”
7. `side-effects.sh <that-email>` must show a `leads` row (`status=new`) plus outbox `lead_staff_alert` (`payload.email`) and `lead_auto_reply` (`recipient_email`) for that address, not an earlier drive.

Intake (`public-intake.spec.mjs`): `#field-firstName` … `#field-consent`, radios `hasSecondPolicyholder=no`, `priorRoofClaim=no`, `lorContractType=non_emergency`, `#field-requestedAdjuster=austin-graham`, “Submit intake”, heading “Intake received.” Read the visible claim reference, then assert that `claim_ref` (via `claimants.email`) and outbox rows for that email. Do not accept a prior `100 Verification Way` row.

Contact rate limit: 5 per IP / 3 per email per hour (`src/lib/rate-limit.ts`). Use a unique `*.verify.cmg.test` address per run.

## Gotchas

- Turnstile always-pass keys still load `challenges.cloudflare.com`. If that script cannot load, waitForTurnstile fails — do not fake the token.
- `noValidate` is on both forms; native HTML5 bubbles are not the error UI. Failed submits mark `[aria-invalid="true"]` and a `FormAlert`.
- Empty `RESEND_API_KEY` leaves outbox `pending`. That is the local pass. Live Resend is opt-in and skipped here.
- Contact without email writes a lead and only `lead_staff_alert` (consent requires email).
- Intake is prepare → optional uploads → finalize inside `useIntakeUpload`. Drive the visible button; do not call `/api` helpers.
- Simple mode is the proof default. The same public forms exist in staff and platform; private routes differ.
- Navigating off `/` aborts the hero MP4s (`storm-0{1,2,3}.mp4`, `net::ERR_ABORTED`). That is not a contact-form failure; the drive filters those URLs from `network-errors.json`.
