> Historical experiment report. Its original no-publication statements describe the earlier checkpoint. Rob later authorized publishing the experiment and launch plan. See README.md for the publication receipt and the launch plan for current scope. Test claims retain their original pinned/local limits.

# CMG / SignuDoc feasibility spike
Date: 2026-11-16

## Decision in plain English

SignuDoc is worth continuing as a potential signing engine for CMG's white-label product. The local trial successfully signed synthetic nine-page documents with one and two homeowners, created sealed PDFs and audit certificates, and refused several unauthorized operations.

It is **not ready to replace PandaDoc**. The trial found an actual incompatibility with CMG's optional authorization fields; the service-to-service API and CMG completion connection do not exist yet; mobile/browser acceptance remains blocked by this execution environment. Keep the existing manual PandaDoc workflow working during any further development.

## Exact scope and repository state

- CMG repository: https://github.com/rspeciale0519/cmg
- Created branch: https://github.com/rspeciale0519/cmg/tree/spike/signudoc-white-label-2026-11-16
- Base: develop at 950cb27514ce10c92a1b05a4ef87bee9fc627ca2.
- SignuDoc: version 0.2.1 at bb9bc099151fed39da5de017d9b4cd61b124cbbd.
- Upstream lockfile SHA-256: ea7cb2084dd344a98cb7b7f0712d4439affe4d925b1486f0c948dc71455af51c.
- This is a separate cloud session/work folder, not a confirmed session inside Rob's existing CMG project. Rob explicitly allowed moving the session later.
- The remote experiment branch exists but still has no new commits. This report and test artifacts are local deliverables, not published CMG application code.
- No CMG runtime file, dependency, provider selection, database, Storage object, hosted setting, production deployment or PandaDoc document changed.
- No ASUS/Docker workloads were started or modified. PostgreSQL ran only inside this cloud experiment.
- No real customer agreement, personal data or external signer was used. All signing email was captured to local JSON, not transmitted.
- No paid resource or signing certificate was purchased.

CMG's AGENTS.md specifies develop, Node 22 and npm. Its actual manifest is Next 16.4.3 / React 19.2.8, which overrides older descriptions. SignuDoc targets Node 24, Next 16.4.6 and React 19.3.1. Keep it a separate application initially; do not force its dependencies into CMG.

## Current CMG workflow and extension points

The current code factory selects ManualSignProvider when no PandaDoc key is configured and PandaDocProvider otherwise. ESignMode currently supports only manual and pandadoc. Production's documented workflow downloads a prefilled LOR, uploads it manually to PandaDoc, then files the signed PDF and explicitly records the signed state. That documentation is not a fresh hosted configuration check.

Useful existing components include ESignProvider, LorRequest, beforeSend, dispatch-attempt tokens, deduplication/leases, private file storage and the signed-document transition gate. They can support a new provider without replacing unrelated claim logic.

CMG uses nine-page Single and Dual LOR definitions. Each homeowner has five required initials and four required signatures. There are also optional authorization fields: two in Single and three in Dual. The signing field manifest is a useful mapping input, but coordinate conversion must be visually reviewed on the final approved PDF.

Sources:
- https://github.com/rspeciale0519/cmg/blob/950cb27514ce10c92a1b05a4ef87bee9fc627ca2/src/lib/esign/types.ts
- https://github.com/rspeciale0519/cmg/blob/950cb27514ce10c92a1b05a4ef87bee9fc627ca2/src/lib/esign/provider.ts
- https://github.com/rspeciale0519/cmg/blob/950cb27514ce10c92a1b05a4ef87bee9fc627ca2/src/lib/esign/lor-tag-manifest.json
- https://github.com/rspeciale0519/cmg/blob/950cb27514ce10c92a1b05a4ef87bee9fc627ca2/docs/temp/PANDADOC_SETUP.md

## Licensing and white-label model

The checked SignuDoc LICENSE is MIT. It permits use, modification, distribution, sublicensing and sale while retaining the copyright and license notice. That permits a commercial fork; it does not grant unrestricted rights to third-party trademarks or replace dependency/asset licenses.

THIRD_PARTY_NOTICES.md separately lists Great Vibes, Noto Sans, modified Noto Sans CJK and Liberation font assets under SIL OFL, PDF.js worker under Apache 2.0, and Foxit/PDFium-derived font notices. Preserve those notices and bundled license texts in redistributed builds; separately review any assets or dependencies added later.

The current app has one install-wide organization configuration and branding, with per-user envelope/template ownership. There is no verified per-firm tenancy model. HOSTED_MODE is not evidence of secure multi-firm separation.

Recommendation: one versioned signing codebase, deployed as one isolated signing installation per adjusting firm:
- separate application configuration, database/owner, document store and encryption/sealing secrets;
- separate verified sender identity and branding;
- separate CMG-to-signing credentials and envelope mappings;
- per-firm access, backups, retention and restore tests.

Multiple projects can use a common hosting account when appropriate, but account membership, credentials and operational access must still be scoped. Different domains or user IDs alone do not create database isolation.

A shared multi-firm installation is a later project: tenant identifiers and enforcement would be required throughout auth, queries, templates, branding, object storage, exports, deletion, reminders, verification, migration/backup operations and integration callbacks. It needs dedicated negative tests across every path.

Licensing sources:
- https://github.com/NYLLON-SOFTWARE/SignuDoc/blob/bb9bc099151fed39da5de017d9b4cd61b124cbbd/LICENSE
- https://github.com/NYLLON-SOFTWARE/SignuDoc/blob/bb9bc099151fed39da5de017d9b4cd61b124cbbd/THIRD_PARTY_NOTICES.md
- https://github.com/NYLLON-SOFTWARE/SignuDoc/blob/bb9bc099151fed39da5de017d9b4cd61b124cbbd/src/lib/branding.ts

## What the current SignuDoc actually provides

The current source includes upload, envelope, signer, field, send, template, signing and download HTTP routes, plus reusable templates and install-wide branding. Therefore "no API" is too broad. Those routes currently authenticate interactive verified-sender sessions. They are not an implemented, supported CMG machine API or a CMG webhook bridge.

It can run as a separate Next.js/Node 24 service with Postgres and durable private storage. On Vercel it expects private Blob and can use Neon; local development can use local disk and captured email. It can run away from Vercel with its documented local-storage driver, HTTPS, Postgres and an operator-managed scheduler. It cannot be installed merely by uploading files to CMG's website directory.

## Tests actually executed

| Check | Actual result |
|---|---|
| Upstream unit tests | 286 passed; 0 failed; 0 skipped |
| Upstream real Postgres tests | 150 passed; 0 failed; 0 skipped |
| Synthetic CMG field mapper | 11 passed; 0 failed |
| CMG API integration scenario | Passed; exercises both one- and two-homeowner nine-page fixtures |
| Clean, unmodified upstream production build | Exit 0; not deployed |
| Clean upstream typecheck | Exit 0 before spike-only harness was added |
| Clean upstream lint | Exit 0; five existing React hook warnings, zero errors |
| Production dependency audit | Exit 1: one moderate affected package (node-forge); zero high/critical |
| PDF signature verification with pdfsig | Both signed PDFs valid; whole file signed; issuer unknown because certificate is self-signed |
| Browser end-to-end acceptance | Blocked at Chromium startup: forbidden Unix socket operation; not a pass |
| Mobile signing/desktop interactive acceptance | Unverified; mobile User-Agent HTTP requests are not visual/mobile proof |
| Cross-firm isolated deployments | Design/source assessment only; no pair of deployed firms tested |
| Hosted providers, real email, trusted certificate/time authority | Not tested or used |

The upstream build initially could not fetch its public Google font because the test allowlist omitted this environment's proxy/certificate settings. Preserving those supported settings fixed it. Binding the server explicitly to localhost avoided blocked network-interface enumeration. The actual browser remained blocked by the sandbox's Unix socket restriction; no security settings were weakened.

### What the CMG-specific trial proves

The trial uses real SignuDoc HTTP handlers and local Postgres, not a fake envelope state machine. Its fixed connection points at 127.0.0.1:55437/cmg_signudoc_e2e; service ports are 3187/3188. A narrowly allowlisted environment prevents hosted database/email/storage credentials from being inherited. Email uses the capture driver. PostgreSQL and the test servers stop at the end.

The trial verifies:
- unauthenticated draft creation is denied;
- verified synthetic sender can upload, map fields and send a synthetic document;
- another verified sender cannot modify or download its envelope or use its template;
- required fields map to the correct homeowner across all nine pages;
- unsupported optional initials are rejected rather than silently required;
- template save and reuse work;
- the second homeowner is not invited before the first finishes;
- consent is required before signing and incomplete submissions are refused;
- a completed signer cannot replay the submission;
- a dual envelope does not complete after only one signer;
- the final PDF and audit certificate are private to authorized sender/token paths;
- finished-file fingerprints match the public verifier, altered bytes do not;
- the actual upstream audit-chain verifier accepts original records, detects a committed synthetic metadata edit, and accepts the restored record.

This is per-sender ownership testing inside one synthetic install, not proof of cross-firm isolation or resistance to a privileged database operator.

The fixtures deliberately say "NOT A LEGAL AGREEMENT" and contain no CMG legal text or claim data. They omit the optional authorization fields only to exercise the ordinary required signing flow. They must never become production templates.

### Files retained

evidence/cmg-api-results.json records final hashes and event counts:
- Single: nine required fields, nine audit events, completed.
- Dual: eighteen required fields, fourteen audit events, completed.

There are unsigned, signed and certificate PDFs for both fixtures. A rendered dual page 7 confirms two separately stamped names. pdfsig output confirms valid cryptographic signatures but not independently trusted identities.

## Specific blockers before real use

1. **Optional authorization semantics.** fieldPlacementSchema currently refuses optional signature/initials/date fields. Full CMG mapping fails closed. Preserve optionality, including its date, with reviewed UI/server/PDF handling; alternatively obtain an approved document/workflow change. Never silently require it, turn an initial into plain text, or remove it from a real agreement.
2. **No production bridge yet.** This spike has a mapper and local HTTP test driver, not a deployed machine API, new CMG provider, webhook consumer or automatic claim transition.
3. **Human/browser acceptance missing.** Complete one- and two-homeowner flows in working desktop and 390px mobile browsers, typed and drawn signing, optional authorization accepted/declined, wrong signer, interruption/recovery, expiry and refusal states. Review every page of the approved agreement for cropping and misplaced fields.
4. **Delivery and crash safety.** Rehearse lost send responses, duplicates, concurrent attempts, delayed callbacks and recovery. Do not resend when acceptance is uncertain.
5. **Dependency finding.** node-forge 1.4.2 has four advisory entries grouped as one affected production package, max severity moderate; npm reports 1.4.3 as a non-major fix. The tested code uses RSA/CMS, so the named Ed25519/TLS findings are not proof of exploitability in CMG. Triage/update and rerun cryptographic/regression tests before release; no version was changed in this spike.
6. **Audit/trust/retention.** A hash chain in the same database is not an independent notarization or protection from an administrator recomputing the whole chain. Archive signed bytes and audit evidence independently, define hold/deletion/recovery rules, and review trusted timestamp/certificate needs. Neither an install seal nor a captured email proves signer identity or legal sufficiency.
7. **Hosted deployment safety.** SignuDoc's production build can apply migrations automatically; preview/production separation must be configured deliberately. Never point its public-schema migrations at CMG's database. CMG's own docs also warn about shared Preview signing keys.
8. **Approvals.** Legal agreement wording/use, signer identity/consent, real delivery, spending, credentials, deployment and live workflow replacement remain unapproved by this investigation.

## Proposed CMG connection

Start with a separate SignuDoc service and a versioned, authenticated bridge. Do not share browser cookies, sign in as users in the background, or give CMG a hosting administrator token as the integration.

1. CMG checks owner/assigned staff permission and AAL2, reads trusted claim data, and selects the firm and approved template server-side.
2. It validates complete claimants, agreement type, saved fee, policy, addresses, and source-PDF/template version/hash.
3. It reserves a durable dispatch attempt and idempotency key before transport.
4. A per-firm authenticated bridge creates a draft, assigns roles, prefills trusted data, places fields, and returns its immutable envelope identifier. Draft creation and sending are distinct.
5. Persist the envelope mapping and before-send intent before the irreversible send. A timeout moves to "uncertain"; reconcile the same envelope rather than create/send another.
6. Signed callbacks (or authenticated polling initially) verify issuer, audience, timestamp, request identity and body integrity. Durable database uniqueness/replay records and request-body hashing bind retries to the same operation. TLS and per-firm secret management remain required.
7. Completion means all required signers and fields are complete and the final sealed PDF/certificate are available and verified. "Sent" or one completed homeowner is insufficient.
8. Copy unchanged final bytes into CMG's private claim storage, retain both hashes and audit data, and atomically/idempotently record the signed state using existing transition/outbox safeguards.
9. Reconcile provider and CMG state after interruption. Keep the manual path available per firm without automatically abandoning in-flight envelopes.

Suggested versioned bridge surface, not implemented here:
- POST /internal/cmg/v1/envelopes (draft, idempotency key required)
- POST /internal/cmg/v1/envelopes/{id}/send (distinct durable attempt)
- GET /internal/cmg/v1/envelopes/{id} (authoritative state)
- GET /internal/cmg/v1/envelopes/{id}/artifacts (private final bytes/certificate)
- signed completion/failure notifications to a dedicated CMG endpoint with replay protection.

Map claim IDs only from a previously stored firm/envelope association, not from caller-supplied metadata alone. Keep signing URLs/tokens, documents and auth material out of logs and analytics. Never fetch arbitrary callback/download URLs; use a configured origin and verified envelope mapping.

CMG changes will likely need a generic provider identity/envelope mapping because fields currently include PandaDoc-specific names. Add a forward-safe migration and database authorization tests rather than overwriting existing PandaDoc fields. Do not select a new provider merely because a key happens to be present.

## Operating costs and alternatives

Open source removes per-seat software licensing; it does not remove hosting, email, storage, backups, certificate or maintenance costs.

- Local captured-email prototype: no purchased resources; existing cloud execution used.
- Commercial Vercel hosting: current legal terms restrict Hobby to personal/noncommercial use. Pro currently has a $20/month platform fee including one deployer and $20 usage credit; extra seats/resources can cost more. An existing Pro team's available capacity might avoid another base subscription, but this account's billing/capacity was not inspected. A separate project per firm does not automatically mean a separate $20 account fee.
- Neon Free currently lists 1 GB database storage and 100 CU-hours/month/project, subject to its other limits. Private document storage and backup retention must be budgeted separately.
- Resend Free currently lists 3,000 emails/month and 100/day. Invitations, verification, reminders, and completed copies all count; do not equate emails with envelopes.
- Vercel Blob charges/limits depend on the team's plan and storage/operation/transfer usage. Measure the actual documents and retention; no promise of unlimited free capacity.
- Trusted document-signing certificate/timestamp services may have separate fees. The default self-signed seal gives tamper evidence but not automatic reader trust.
- Existing VPS alternative: Node 24 service, dedicated Postgres and private persistent file storage can avoid a new platform subscription if capacity/security/backups are adequate. Requires capacity validation and isolation from current websites/email first; no VPS access/settings were used in this spike.
- One maintained codebase should configure firm branding/templates and deployment settings, rather than manually maintaining a divergent code fork for every client.

Pricing/policy sources checked 2026-11-16:
- https://vercel.com/legal/terms (Hobby restriction)
- https://vercel.com/docs/plans/pro-plan
- https://neon.com/pricing
- https://resend.com/pricing
- https://vercel.com/docs/vercel-blob/usage-and-pricing

The SignuDoc README's "$0" marketing estimate is not a complete commercial operating budget.

## Next bounded phase

1. Review this result and choose separate per-firm installs as the initial architecture, or explicitly approve a larger tenancy project.
2. Resolve the optional authorization incompatibility in a pinned fork and prove both choosing and declining it preserve the correct legal document.
3. Patch/triage the dependency advisory and establish the pinned update/notice process.
4. Add a narrowly authenticated bridge plus a feature-disabled CMG provider, with durable attempt/replay/reconciliation tests and isolated database migrations.
5. Finish real desktop/mobile synthetic acceptance and failure/expiry/recovery testing.
6. Review counsel/operational controls and actual costs, then request specific approval for a protected nonproduction deployment and approved test recipients.
7. Only after successful hosted acceptance, approve any production migration and controlled firm-by-firm switch. Leave existing PandaDoc envelopes and their evidence intact.

No production switch is recommended based solely on the passing local backend trial.
