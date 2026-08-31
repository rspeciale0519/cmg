# Stage 2 production browser evidence

> Historical notice added 2026-08-30.
> This record preserves earlier work; it does not define current release state or authorize commands.
> Use [HANDOFF.md](../../HANDOFF.md) for current evidence and [ROADMAP.md](../../../ROADMAP.md) for current scope.
> Earlier dates, totals, environment claims, and completion verdicts are not current acceptance evidence.

Recorded 2026-08-13 against `http://localhost:3011` after the final clean local
database reset. Chrome remains open in isolated CMG contexts.

- Marketing `/` rendered its full navigation, hero, claims/services content,
  contact information, and footer. No console warning or error was reported.
- Customer `customer@cmg.test` opened the seeded claim overview with timeline,
  insurer/loss facts, assigned adjuster contact, activity/document counts, and
  question entry point. Staff-only financial, audit, and policy-number data did
  not appear.
- Partner `partner@cmg.test` opened the referred-claims list. The settled claim
  showed `$128,400`; the settlement-offered claim withheld the amount and said
  it will be reported after settlement.
- Owner `owner@cmg.test` completed fresh local TOTP enrollment and opened the
  AAL2 claims list. The fixed safe projection returned both seeded claims,
  claimant/property summaries, statuses, adjuster and partner names, search and
  filters, without exposing e-sign lease tokens.
- Enforcing `Content-Security-Policy` used a nonce and `strict-dynamic`;
  Report-Only was absent. X-Frame-Options, Referrer-Policy, and Permissions-
  Policy were present.
- No application console error appeared. Customer, partner, and owner surfaces
  emitted only the existing non-blocking preloaded-logo warning.
