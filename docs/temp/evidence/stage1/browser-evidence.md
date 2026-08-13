# Stage 1 current-build browser evidence

Recorded 2026-08-13 against the production build served at
`http://localhost:3010`, after the final clean local database reset. Chrome was
left open. All observations came from isolated DevTools browser contexts.

## Customer

- Signed in as `customer@cmg.test` and opened the seeded claim overview.
- The page rendered the customer-visible claim facts, progress timeline,
  activity/document/question counts, and staff contact information.
- No staff-only policy, financial, audit, or partner-company data appeared.
- The console contained no application error; the only observation was a
  non-blocking logo preload warning.

## Partner

- Signed in as `partner@cmg.test` and opened the referral list, claim detail,
  activity, and profile routes.
- The settled referral displayed `Settled at $128,400`; the
  `settlement_offered` referral withheld the amount and explained that it is
  reported only after settlement.
- Claim detail exposed the permitted summary and milestones, not policy number,
  claimant contact details, documents, or pre-settlement financial data.
- Activity showed only partner/shared events. Profile showed the signed-in
  representative's company contact fields read-only.
- The console contained no application error; the only observation was a
  non-blocking logo preload warning.

## Owner/staff

- Signed in as `owner@cmg.test` after the reset, completed local TOTP enrollment,
  and reached the admin dashboard at AAL2.
- Dashboard navigation and the primary staff work areas rendered for the owner.
- The claim overview route loaded from the dashboard navigation. E-sign failure
  and ambiguity behavior is additionally covered by the reviewed unit,
  integration, and pgTAP suites because the seeded claims do not manufacture a
  provider failure during browser smoke testing.

## Supporting production evidence

- `10-production-headers.log` records the enforcing nonce CSP and security
  headers from this production server.
- Customer and partner screenshots and accessibility snapshots were captured in
  the live DevTools transcript. The browser integration would not persist an
  image path inside the project, so this file records the durable DOM-level
  observations without claiming a saved screenshot artifact.
