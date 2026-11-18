# Actual local browser acceptance — November 15, 2026

The completed checks below used the actual built application and the separate local database.
Local role, site-mode, layout, and final network checks passed.
This record does not claim hosted or real-provider acceptance.

## Environment and sessions

- Browser: native Browser with developer access. No Computer Use ran.
- Built application: port `4199`.
- Supabase API: `http://127.0.0.1:15621`.
- Database project: `CMGPA_legal_airtable_disposable`.
- Synthetic session domain: `cmg-law-airtable-da0d9a07524fd188.localhost`.
- Five fresh roles: Owner, assigned adjuster, Assistant, customer, and partner.

The separate synthetic role sessions preserved the user's existing logins.
All five synthetic sessions were transferred once.
No customer data, real email, or real-provider call was used.

## Owner and law-firm form

The Owner created a synthetic law firm.
The invalid-email check passed.
The pending state appeared during submission.
The form retained its entered values after a refused submission.

## Direct claim and legal package

The assigned adjuster used direct claim `0007`.
The adjuster prepared a legal package with **Homeowners** unchecked.
The package ZIP downloaded successfully.
Downloading left the handoff at **Preparing**.
It did not record the package as sent.

The ZIP contained:

- The selected original PDF.
- A PDF summary.
- A text summary.
- A manifest.

The original PDF remained unchanged after packaging.
Its size was **905 bytes**.
Its SHA-256 was:

```text
bdcab92cb455191f375436a6e0caad2f5c0d14ebba02c13458d894844009ae11
```

The inspected ZIP remains at:

```text
C:/Users/rob/.codex/visualizations/2026/11/01/01a19512-82bb-71a2-8d71-83374c0d0f60/cmg-law-firm-airtable-ui-review/actual-legal-package.zip
```

The original downloaded ZIP also remains in Downloads.
No file cleanup ran.

## Legal milestones and customer view

The local **Sent**, **Accepted**, **Lawsuit**, and **Returned** actions passed.
The return action selected **Documenting**.
The claim retained all four legal milestones and its package after the return.

The customer saw only the permitted milestones and contact details after acceptance.
The customer did not see the private summary note.

## Role boundaries

| Role and request | Observed result |
| --- | --- |
| Assistant opens Legal | 404 |
| Assistant opens Sharing | 404 |
| Unassigned adjuster opens Legal | 404 |
| Adjuster opens company Airtable settings | 404 |
| Partner opens the admin Legal route | Redirected to the partner view |

## Referral independence and paused Airtable setup

Direct claim sharing required no company connection.
The generic referred-claim sharing page worked with Airtable disabled.
The Owner's **Connect** control stayed disabled until service setup.
These checks did not connect to Airtable or change an external record.

Referred claim `0008` started an unsent legal preparation.
The cancellation action passed.
The preparation history remained after cancellation.

## Layout, console, and viewport evidence

The desktop Legal screen was inspected.
The actual Legal, company, and homeowner screens were also inspected at a verified `390px` viewport.
Their screenshots showed no body overflow.

The first native viewport control did not resize the intended tab.
CDP emulation then set the correct viewport, which was verified before inspection.
That emulation was cleared afterward.

All five role consoles had no warnings or errors in the completed checks.
The final customer-page reload captured 28 successful HTTP 200 responses and no failed requests.
That capture was complete, with no truncated events or unread buffer entries.
It covers that reload, assets, and prefetches; it is not a full trace of the earlier workflow.

Screenshots remain in the sibling `cmg-law-firm-airtable-ui-review` directory:

- `actual-legal-desktop.jpg`
- `actual-legal-mobile-390.jpg`
- `actual-company-mobile-390.jpg`
- `actual-homeowner-mobile-390.jpg`

The earlier `actual-legal-mobile.jpg` is a retained 1280px capture, not mobile proof.

## Local helper correction

The initial helper used a no-referrer setting that produced `Origin: null`.
The server refused two requests before the handoff started.
The local page metadata was corrected to permit a same-origin request.
The application server guards did not change.

## Site modes and retained state

The same successful build passed all three runtime mode checks:

- `platform`: the approved synthetic role workflows and restrictions above passed.
- `staff`: the adjuster Legal route worked; customer and partner portals redirected to `/platform-disabled`.
- `simple`: Legal and company integration settings redirected to `/platform-disabled`.

The app returned to `platform` on port `4199` after those checks.
The existing synthetic Owner and customer sessions still worked.
The five synthetic role tabs and static review tab remain open for later work.
Temporary viewport overrides were cleared.
The completed session-transfer helper on port `4200` stopped after all five transfers.
Stopping that helper did not clear any browser session.

The later Airtable record-proof repair changed no visible layout or legal workflow.
Its authenticated provider path needs separate real-provider acceptance after setup approval.

After the final repaired build passed, the app restarted on port `4199` in `platform` mode.
The existing synthetic Owner and customer sessions opened their legal views and retained history without another sign-in.
Neither page recorded a new console warning or error during that check.
One Playwright DOM snapshot timed out after the Owner reload.
The documented native accessibility read confirmed the same healthy page. No form was submitted again.
Final screenshot: `actual-legal-final.jpg` in the retained screenshot directory.
Current local app process: `45308`; tool session: `71893`.

## Remaining acceptance

Actual local browser acceptance is complete for this source.
Hosted acceptance and real Airtable OAuth, record mapping, and delivery remain unverified.
Those actions require exact approval under the release approval record.

Keep all synthetic records, package files, and browser sessions.
Keep hosted cleanup blocked and all existing user logins preserved.
No hosted change, real email, provider activation, or deployment is authorized by this record.
