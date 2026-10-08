# Full-platform launch checklist

This checklist covers the owner's full-platform goal, including customer and vendor access.
It does not authorize a hosted write, live message, Git action, or Production change.
Use [RELEASE_STATE.md](../RELEASE_STATE.md) for deployment facts and [HANDOFF.md](HANDOFF.md) for test evidence.
Use [BLOCKERS.md](BLOCKERS.md) for owner decisions.

## Evidence rules

Record the commit, environment, role, date, result, and evidence for each test.
Local success does not prove hosted success.
An older passing check does not prove that a changed release passes.
Provider acceptance does not prove inbox delivery.
Record skipped checks and unavailable console or network evidence.
Keep credentials, signed links, and customer data out of this record.

## Engineering and acceptance

| Requirement | Current evidence | Remaining proof |
|---|---|---|
| PR #18 partner directory count | `bugfix/launch-integration-v2` rebuilds PR #18 and PR #19 on current `develop`, which already contains the dependency fixes from PR #21. The fixture conflicts keep the restricted stack allowlist. Query regression cases pass; the authenticated database regression passed on the earlier combined candidate. | CI, Preview, merge, and hosted owner partner-directory acceptance |
| PR #19 private upload transport | Local 25 MiB staff and homeowner uploads passed; hosted migration applied | Hosted upload boundaries and final release checks |
| Upload hydration protection | Regression tests and local browser passed at `d8e55fa` | Hosted staff and homeowner render and interaction checks |
| Dependency audit and local checks | PR #21 merged the dependency fixes into `develop` (Next.js 16.3.8, the lint glob adapter, sharp, and source-map-js). Earlier record: PR #19 at `3922e5a` had green recorded CI. Combined audit, type check, lint, build, and 1,663 unit tests passed; 56 tests skipped. Five files and 113 tests passed in each mode. Approved disposable reset: 1,350 pgTAP assertions and 243 database-backed tests passed; one live provider test skipped. Generated types match. | Combined remote CI on the v2 branch PR |
| Public site | PR #19 at `d8e55fa`: six public routes rendered at 1280px, 390px, and 320px without overflow or broken loaded images. Mobile menu keyboard controls and Services skip link passed at 390px. | Remaining navigation, loading, errors, and approved form acceptance |
| Contact and claim intake | Labels, required controls, and second-policyholder visibility passed. Approved PR #19 hostname addition on 2026-10-05 cleared the verification failure. Both forms held a nonempty verification response without submission. Historical synthetic submissions exist. | Current hosted validation, rate limits, consent, contractor fields, vendor referral links, upload limits, persistence, and email delivery |
| Sign-in and recovery | Historical MFA and recovery passed. Current PR #19 owner sign-in is complete. Resend records owner and homeowner reset messages as Delivered. Login fits desktop and 390px; recovery verification succeeds without submission. | Failed login, sign-out, user-performed recovery, and staff AAL2 enforcement on the final candidate |
| Invitations | Production acceptance on 2026-10-07 passed staff, vendor, existing-homeowner, and new-homeowner invitations, including role assignment and landing routes. Earlier Preview tests also passed, and Resend records the earlier invitations as Delivered. A generic expired-link page appears for `not-a-token`. | Replay refusal, actual expired links, and recovery |
| Owner desk | Current PR #19 owner reads passed dashboard, intake, leads, questions, staff, settings, and audit. New lead filter returns two; claim search empty state passed. Partner directory still fails until the combined fix deploys. | Combined candidate, company detail, and approved write/disposition tests |
| Claim administration | Current PR #19 synthetic claim overview, claimants, documents, activity, financials, history, and completed signed-LOR panel passed read-only checks. | Assignment, fee permissions, legal transitions, and approved writes on combined candidate |
| Staff isolation | Production on 2026-10-07: the invited adjuster sees only assigned claims, owner-only pages return not-found, and `/portal` and `/partner` redirect to `/admin`. Historical adjuster assignment and owner-route refusal passed. Current PR #19 redirects the owner from customer and vendor portals to the staff dashboard. Missing and malformed claim IDs show identical generic not-found text at 390px without overflow or captured warnings/errors. | Assigned and unassigned adjuster access, owner-only actions, direct actions, and final candidate boundaries |
| Homeowner portal | Production on 2026-10-07: invited homeowners see only their own claims, and `/admin` and `/partner` redirect back. A new intake account landed directly on its claim. Synthetic claim, activity, question, and download passed historically. | Profile, uploads over 4.5 MB after the combined fix deploys, signed downloads, and download audit |
| Vendor portal | Production on 2026-10-07: the rep sees only the company's referred claims, without documents, policy, or homeowner contact, and cannot open `/admin` or `/portal`. A referred intake appears under "Claims you referred". | Activity, foreign-company refusal, profile, referral link, and notifications |
| Private files | Local internal staff file excluded from homeowner page and direct API | Hosted visibility, exact bytes, file signature checks, expiry, non-overwrite, retries, and completed records |
| Upload recovery | Local database and cleanup tests passed | Hosted interruption and expiry cleanup; reviewed forward-repair procedure |
| All site modes | Production runs `platform` from 2026-10-07. PR #19 simple Preview closed all six private prefixes. Approved platform Preview at `3922e5a` renders login and redirects unauthenticated admin, portal, partner, and MFA routes to login. | Authenticated roles, affected actions, and final release behavior in `simple`, `staff`, and `platform` |
| Mobile and accessibility | Public, login, invalid-invite, recovery, and form checks passed as recorded. Current owner dashboard, documents, claims, search empty state, settings, staff, queues, audit, and all synthetic claim sections fit measured 390px. Upload controls are disabled before hydration and enabled afterward. Overrides are cleared. | Remaining role layouts, keyboard controls, error recovery, and final combined release |
| Browser diagnostics | Public browser consoles had no captured errors. Public Production and PR #19 root responses carry configured security headers; script nonces match and rotate. | Private routes, full request traces, loading, empty, error, and success states; final release headers |

## Operations and release

| Requirement | Current evidence | Release gate |
|---|---|---|
| Migration compatibility | Authorized browser review matched all 36 versions and names through `20260927120000` | Stored SQL and schema checks before relevant approved release writes |
| Email and cleanup queues | Browser filters verified zero pending or failed mail and zero unprocessed cleanup jobs. Five retired test messages remain dead. | Rechecked before the 2026-10-07 activation; recheck before each release; never resend those messages |
| Cron and provider operation | Both schedules are enabled; recent Production cron logs are empty. Restored Chrome Resend access verifies Delivered staff/vendor invitations, homeowner invite, resets, lead receipt/alert, and question alert. | Inbox receipt, approved delay, endpoint authorization, successful scheduled execution, and cleanup evidence |
| Email operations | Resend Metrics reports eight emails, 100% deliverability, zero bounces, and zero complaints for September 21–October 5. No webhook is configured. CMG records send acceptance and supplies no explicit reply address. A daily operator procedure is proposed in HANDOFF. | Named operator, procedure approval, monitored reply-path verification, and recovery checks; no automatic resend of dead synthetic messages |
| Manual PandaDoc signing | Prefilled download and signed-document status gate passed. The guide includes send recording and a separate signed-state action. PR #19 Preview selects the API provider; it does not match manual Production signing. | Approved branch-only manual configuration and redeployment; web-upload field recognition, both signer variants, approved real send, signing, signed-file upload, claim state, and access |
| PandaDoc API path | Not selected for first release. Current Preview reports API and webhook configuration. A nonblank API key selects PandaDoc; no separate provider switch exists. | Keep Production manual; separately approve Preview-only key overrides before manual acceptance. Do not send through the API. |
| Hosting and repository | Hobby hosting and unprotected private integration branch recorded | Commercial hosting and supported repository protection decisions, then approved configuration |
| Privacy and retention | Corrected no-backup preflight and manual request proposal; export tooling and enforced holds remain absent | Owner and legal approval, synthetic completeness tests, and workable operator controls or approved implementation |
| Public copy and LOR PDFs | Legal approval remains open | Exact copy and both PDF variants approved second-to-last |
| Production deployment | Production deploys from `develop` in platform mode; the combined fix is not yet merged | Separate merges and deployment approval, matching commit and environment, and green current checks |
| Platform activation | The owner switched Production to `platform` on 2026-10-07 after PRs #16 and #17 merged and the old outbox rows were confirmed safe. Hosted invitation acceptance passed. | Remaining rows in this checklist |
| Domain and SEO | `app.` remains the temporary host | Approved SEO and domain work last; preserve every existing DNS record unless an exact change is approved |
| Recovery | Backups declined; immediate restore unverified | Reviewed forward repair, compatible code recovery, and clear operator steps; no backup or database reset |
| Final records | This checklist is open | Current release records, exact passed and skipped checks, unresolved gates, and owner acceptance |

The earlier combined candidate on `bugfix/launch-integration` failed its automatic Preview during Inter font compilation after restoring the Production build cache.
A stale build cache was suspected but not confirmed. HANDOFF records the details.
The candidate is now rebuilt on current `develop` as `bugfix/launch-integration-v2`. Watch its Preview for the same font error.
Combined GitHub CI runs on its PR. Hosted acceptance, merge, and Production deployment remain open.

## Completion rule

Do not mark the goal complete while a required row lacks evidence or an approved operational procedure.
Optional photography does not block launch unless the owner makes it a requirement.
Do not treat the historical simple-mode roadmap as approval to omit full-platform acceptance.
