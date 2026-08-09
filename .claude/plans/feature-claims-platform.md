# CMG Property Solutions — Website + Claims Platform Design Spec

**Date:** 2026-08-08 · **Status:** Awaiting approval · **Plan type:** feature → branch `feature/claims-platform`

A complete Next.js website and secure claims-processing platform for CMG Property Solutions
(Austin Graham, licensed Florida public adjuster, license #G086165). Converts the Claude Design
handoff bundle (6 dark gold-on-charcoal prototypes) into a production marketing site, and adds
an invite-only claims platform with admin, customer, and partner portals.

---

## 1. Decisions log (locked with Rob)

| # | Decision | Choice |
|---|----------|--------|
| 1 | Scope | Everything in one build: marketing site + admin + customer portal + partner portal, phased |
| 2 | Styling | Tailwind CSS v4, tokens ported 1:1 from prototype `:root` palette |
| 3 | Forms backend | Supabase (DB + Storage) **and** Resend email notifications |
| 4 | Supabase mode | Local Docker stack during dev; hosted project + Vercel at launch |
| 5 | Hero media | storm-001/002/003.mp4 transcoded to ~720p web weight, crossfading rotation |
| 6 | Missing photos | Reusable styled `ImageSlot` placeholder component |
| 7 | Claim lifecycle | 10-status pipeline + Denied→Reopened branch (§5) |
| 8 | Customer accounts | Invite-only, issued by staff after accepting an intake |
| 9 | E-signature | **PandaDoc** behind the `ESignProvider` interface (ManualSignProvider = no-key fallback). Full study: [docs/reference/pandadoc/](../../docs/reference/pandadoc/README.md) |
| 10 | SMS | Not in v1; consent captured + stored so Twilio can be added without re-consent |
| 11 | Messaging | Per-claim activity feed (status entries, notes, Q&A), email-notified |
| 12 | Auth hardening | Staff MFA (TOTP) required; Turnstile on public forms; leaked-password protection + strength policy |
| 13 | Partner visibility | Status + milestones + settlement amount (once settled). No documents, no policy numbers, no homeowner contact details |
| 14 | Staff roles | Owner, Adjuster, Assistant |
| 15 | Hosting | Vercel + hosted Supabase at launch |

**Non-goals for v1:** payment processing, actual SMS sending, automated e-sign vendor,
user-configurable pipeline stages, Spanish localization, carrier API integrations,
analytics/reporting dashboards, partner portal admin tiers.

---

## 2. Stack

| Layer | Choice | Version pin at scaffold |
|-------|--------|------------------------|
| Framework | Next.js (App Router, TypeScript, `proxy.ts` convention) | 16.3.x |
| UI | React | 19.2.x |
| Styling | Tailwind CSS v4 (`@theme` tokens) | 4.3.x |
| DB/Auth/Storage | Supabase (Postgres 17) — local CLI/Docker in dev | supabase-js 2.112.x, @supabase/ssr 0.12.x |
| Email | Resend + React Email | resend 6.x |
| Validation | Zod | 4.x |
| Bot defense | Cloudflare Turnstile (free) | — |
| E-signature | PandaDoc API (`api.pandadoc.com/public/v1`, API-Key auth, thin fetch wrapper) | — |
| Fonts | Inter via `next/font` (self-hosted) | — |
| Unit tests | Vitest | latest |
| RLS tests | pgTAP via `supabase test db` | — |

Notes:
- Next 16: middleware is `proxy.ts`; request APIs (`cookies()`, `params`) are async.
- Supabase env naming: `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`,
  `SUPABASE_SECRET_KEY` (server-only). Local CLI's generated keys map onto these names.
- Browser verification during dev uses chrome-devtools MCP (no Playwright).

---

## 3. Application topology

Single Next.js app, route groups per surface:

```
app/
  (marketing)/            public, statically rendered
    page.tsx                      /            Home
    services/page.tsx             /services
    contractors/page.tsx          /contractors
    about/page.tsx                /about
    contact/page.tsx              /contact
    file-a-claim/page.tsx         /file-a-claim  (intake)
  (auth)/
    login/page.tsx                /login
    invite/[token]/page.tsx       /invite/:token  (accept invite, set password)
    mfa/page.tsx                  /mfa            (TOTP enroll + challenge, staff)
  (admin)/admin/...               staff only, aal2 required
  (customer)/portal/...           customers
  (partner)/partner/...           partner reps
  api/
    cron/outbox/route.ts          email sweeper (CRON_SECRET-gated)
    pandadoc/webhook/route.ts     HMAC-verified, deduped PandaDoc event handler
proxy.ts                          session refresh + role gate + aal2 gate
lib/
  supabase/{client,server,proxy}.ts
  authz.ts                        requireRole()/requireClaimAccess() helpers
  status-machine.ts               legal transitions map
  esign/{provider.ts,pandadoc.ts,manual.ts}  ESignProvider + PandaDoc impl + fallback
  validators/*.ts                 zod schemas (shared client/server)
  email/{outbox.ts,templates/*}   React Email templates
components/                       design-system components (Tailwind)
supabase/
  migrations/*.sql
  tests/*.sql                     pgTAP RLS suite
  seed.sql                        dev seed
public/videos/storm-{1,2,3}.mp4 + hero-poster.jpg
```

**Data-access rule:** Server Components and Server Actions use the *user's* Supabase client
(JWT → RLS enforced). The service-role (secret key) client lives only in `server-only` modules
and is used exclusively for: public intake ingestion, lead ingestion, invite issuance/acceptance,
outbox processing, PandaDoc webhook processing, and partner-projection maintenance fallbacks. Every service-role write is
zod-validated and audit-logged. No REST/GraphQL API layer for v1 beyond the two `api/` routes.

---

## 4. Data model (schema `public`; every table RLS-enabled, deny-by-default)

- **profiles** — `id (=auth.users.id)`, `role enum('owner','adjuster','assistant','customer','partner')`,
  `first_name`, `last_name`, `phone`, `partner_company_id?`, timestamps. Created by trigger on signup;
  role is written only by service-role/invite flow (never self-selected).
- **partner_companies** — `name`, `status enum('active','inactive')`, contact fields.
- **leads** — contact-form submissions: `name`, `phone`, `email?`, `message?`, `status
  enum('new','contacted','converted','dismissed')`, `ip`, `created_at`.
- **claims** — `id uuid`, `claim_ref text unique` (e.g. `CMG-2026-0041`, from per-year sequence),
  `status claim_status`, property address fields, `carrier`, `policy_number`, `carrier_tenure`,
  `prior_roof_claim bool`, `prior_outcome?`, `claim_number?`, `loss_date`, `loss_time`,
  `cause enum`, `description`, `assigned_adjuster_id? → profiles`, `partner_company_id?`,
  `referrer_name?`, `referrer_email?`, `denied_at?`, `settled_at?`, timestamps.
- **claim_financials** — `claim_id (unique)`, `settlement_amount? numeric`, `fee_percent? numeric`,
  `updated_by`, `updated_at`. Separate table because RLS is row-level, not column-level: money is
  readable/writable **only** by owner and the assigned adjuster. Assistants, customers, and
  partners have no policy on it; partners learn the settlement figure solely through the
  projection table once settled.
- **claimants** — `claim_id`, `first_name`, `last_name`, `email`, `phone?`, `initials`,
  `is_primary bool`, `user_id? → auth.users` (linked when invite accepted). Unique `(claim_id, email)`.
- **claim_status_history** — `claim_id`, `from_status?`, `to_status`, `changed_by`, `note?`, `created_at`.
- **claim_events** — activity feed: `claim_id`, `type enum('status','note','question','reply','document','system')`,
  `body`, `author_id?`, `visibility enum('internal','customer','partner','shared')`
  (`shared` = customer + partner), `created_at`.
- **documents** — `claim_id`, `storage_path` (uuid-named), `original_name`, `kind
  enum('declarations','photo','contract','lor_unsigned','lor_signed','estimate','denial','correspondence','other')`,
  `mime`, `size_bytes`, `uploaded_by?`, `visibility enum('internal','customer')`, `created_at`.
- **consents** — `claim_id?`, `lead_id?`, `email`, `phone?`, `kind enum('sms','email')`,
  `consent_text` snapshot, `granted_at`, `ip`.
- **invites** — `email`, `role`, `claim_id?`, `partner_company_id?`, `token_hash` (SHA-256; raw token
  only in the email link), `expires_at` (72h), `accepted_at?`, `invited_by`, `created_at`.
- **audit_log** — append-only: `actor_id?`, `action`, `entity`, `entity_id`, `meta jsonb`, `ip?`, `created_at`.
  Written by DB triggers (claims, documents, claim_status_history mutations) + explicit app writes
  (signed-URL issuance, invite events, auth-sensitive actions). No UPDATE/DELETE policies exist on it.
- **notifications_outbox** — `recipient_email`, `template`, `payload jsonb`, `status
  enum('pending','sent','failed','dead')`, `attempts`, `last_error?`, `next_attempt_at`, timestamps.
- **claim_partner_summaries** — projection maintained by triggers on `claims` + `claim_financials`:
  `claim_id`, `partner_company_id`, `homeowner_name` (display only), `property_street`, `property_city`,
  `status`, `lor_signed_at?`, `filed_at?`, `settled_at?`, `settlement_amount?` (populated **only** when
  status ∈ settled/closed), `updated_at`. Partners can read only this table — the whitelist is
  structural, so a policy bug on `claims` cannot leak columns to partners.
- **rate_limits** — `key text`, `window_start`, `count`; maintained by
  `check_rate_limit(p_key, p_max, p_window)` SECURITY DEFINER function.
- **pandadoc_webhook_events** — `event_id uuid primary key`, `received_at`, `payload_summary
  jsonb`. Dedupe ledger for webhook deliveries; service-role only (no client policies).
  Plus on **claims**: `pandadoc_document_id text unique null`, `esign_status text null`.

**Storage:** single private bucket `claim-docs`. Paths: `claims/{claim_id}/{uuid}.{ext}` and
`intake/{intake_uuid}/{uuid}.{ext}` (re-parented on accept). No public access; no client-direct
uploads in v1 — all uploads pass through server actions (validated: mime allowlist
pdf/jpg/png/webp/heic/docx, ≤ 25 MB each, ≤ 10 files per submission). Downloads via 5-minute
signed URLs issued server-side after an authz check, always with attachment disposition (an
uploaded HTML/SVG/PDF must download, never render in the app's origin); each issuance audit-logged.

### Access matrix (enforced by RLS + `requireRole()` in actions)

| Entity | Owner | Adjuster | Assistant | Customer | Partner |
|---|---|---|---|---|---|
| claims | all CRUD | assigned: read/update | all: read-only | own (via claimants.user_id): read | — |
| status / assignment | ✔ | assigned ✔ | ✖ | ✖ | ✖ |
| claim_financials | ✔ | assigned ✔ | ✖ (no policy) | ✖ | via summary once settled |
| claimants | ✔ | assigned ✔ | read | own: read | — |
| documents | ✔ | assigned ✔ | ✔ (upload/read) | own claim, `visibility='customer'`: read + upload | ✖ |
| claim_events | ✔ | assigned ✔ | ✔ (notes) | visibility ∈ customer/shared: read; create `question` | visibility ∈ partner/shared: read |
| claim_partner_summaries | read | read | read | ✖ | own company: read |
| leads | ✔ | read | ✔ | ✖ | ✖ |
| partner_companies / invites / profiles(admin) | owner only | ✖ | ✖ | ✖ | ✖ |
| audit_log | owner read | ✖ | ✖ | ✖ | ✖ |

---

## 5. Claim lifecycle

`new_intake → under_review → lor_sent → lor_signed → documenting → filed → negotiating →
settlement_offered → settled → closed`
Branch: `denied` (reachable from filed/negotiating/settlement_offered) → `reopened` → negotiating.
Terminal: `closed`. Also `rejected` (staff declines an intake; claim archived, no invite ever sent).

- Transitions validated by `status-machine.ts` **and** a DB trigger (double enforcement).
- Every transition: history row + feed event (visibility `shared` for milestone statuses,
  `customer` otherwise) + outbox email to primary claimant; partner-visible transitions also
  notify the referring rep.
- Gate: `lor_sent → lor_signed` requires a `documents` row of kind `lor_signed`.
- Customer 5-step progress mapping: Received (new_intake/under_review) → Representation
  (lor_sent/lor_signed) → Documenting (documenting) → With carrier
  (filed/negotiating/settlement_offered/denied/reopened) → Resolved (settled/closed).

---

## 6. Key flows

**Public intake (`/file-a-claim`)** — the prototype's 6-section form, ported faithfully
(homeowner + optional second person, policy + prior-claim branch, loss details, address,
referral fields, docs upload, SMS/email consent). Server action: Turnstile verify →
`check_rate_limit(ip)` + `check_rate_limit(email)` → zod parse → service-role transaction:
claim(`new_intake`) + claimants + consents (+ files to `intake/…`, docs rows) → outbox:
staff alert + homeowner confirmation → audit. Success panel per prototype. No account created.

**Contact (`/contact`)** — Turnstile → rate limit → `leads` insert → staff alert + auto-reply.

**Accept & invite** — Staff opens intake queue → Accept (assign adjuster, optionally link/create
partner company from referral fields) or Reject. Accept triggers invites to every claimant email:
single-use 72h token link → `/invite/:token` → set password (strength-validated; HIBP where
available) → account created with role `customer`, `claimants.user_id` linked → lands in portal
seeing only their claim. Partner reps are invited the same way by the owner from partner management.

**LOR (PandaDoc)** — Admin clicks "Send LOR" → `PandaDocProvider.sendLor()`: create document
from the CMG LOR **PandaDoc template** (roles Homeowner1/Homeowner2 in parallel; claim data as
tokens; `metadata.claim_id`), poll to `document.draft` (creation is async; 404/409 before
draft), then `POST …/send` — PandaDoc emails every claimant for signature. Status → `lor_sent`;
`claims.pandadoc_document_id` + `esign_status` recorded. Webhooks then drive the rest:
`recipient_completed` → feed entry per signer; `document_completed_pdf_ready` → download the
sealed PDF via `/download-protected` into Supabase Storage (`kind='lor_signed'`) → auto-
transition `lor_sent → lor_signed` + notifications; `document.declined/expired` → staff alert;
`document_creation_failed` → admin error surface. Webhook handler: raw-body HMAC-SHA256 verify
(shared key, `?signature=` param, timing-safe) → dedupe on `X-PandaDoc-Webhook-Event-Id` via
insert-if-absent (`pandadoc_webhook_events`) → idempotent processing → 200 in <20s. No
PandaDoc key configured → `ManualSignProvider` fallback (staff sends outside the system and
uploads the signed copy, which still satisfies the `lor_signed` gate). Details:
[docs/reference/pandadoc/06-cmg-integration-blueprint.md](../../docs/reference/pandadoc/06-cmg-integration-blueprint.md).

**Activity feed** — Customers post questions (rate-limited); staff replies (choose visibility).
Both directions enqueue notification emails. Partners see only `partner`/`shared` entries.

**Partner referral** — `/partner/refer`: rep submits homeowner + loss basics → creates
`new_intake` claim pre-linked to their company → staff completes details on accept.

**Notifications** — Templates: intake confirmation, staff intake alert, lead alert + auto-reply,
invite, status update (customer), partner status update, new question (staff), reply posted
(customer), LOR signed confirmation, settled notice. Delivery: enqueue to outbox in the same
transaction, attempt immediate send post-commit, `api/cron/outbox` sweeps retries
(exponential backoff, max 5 → `dead`). Transactional only; footer identifies CMG + reason.

---

## 7. Security model

1. **RLS everywhere, deny-by-default.** No table without policies; anon role has zero grants on
   `public` (public forms write via service-role server actions only). pgTAP suite asserts, per
   role: customer cannot read others' claims/docs/events; partner reads only own-company
   summaries and partner-visible events; assistant cannot update status/settlement; adjuster
   sees assigned only; anon sees nothing.
2. **Auth.** Supabase Auth (email/password). Staff must enroll TOTP; `proxy.ts` + server checks
   require `aal2` for `(admin)` routes. Password policy: ≥ 12 chars + zxcvbn-style strength check
   app-side; Supabase leaked-password protection toggled on at launch (Pro). Invite tokens:
   32-byte random, stored hashed, single-use, 72h expiry. Session cookies via @supabase/ssr
   (httpOnly, Secure, SameSite=Lax); `getClaims()` on the server for every gated request.
3. **Authorization is two-layer:** `requireRole()`/`requireClaimAccess()` guards in every server
   action *plus* RLS beneath. UUIDs for all ids; `claim_ref` is display-only.
4. **Public-surface defense:** Turnstile server-verified on intake/contact/referral; Postgres
   rate limits per IP and per email; zod validation; file mime/size allowlists; uploaded
   filenames replaced with UUIDs; generic outward error messages.
5. **Storage:** private bucket only; short-TTL signed URLs after authz; issuance audited;
   no client-direct upload/download paths in v1.
6. **Headers (next.config):** CSP `default-src 'self'`; `script-src 'self'
   https://challenges.cloudflare.com` (+ dev unsafe-eval only in dev); `frame-src
   https://challenges.cloudflare.com`; `frame-ancestors 'none'`; `media-src 'self'`; `img-src
   'self' data: blob:`; `connect-src 'self' https://*.supabase.co wss://*.supabase.co
   https://challenges.cloudflare.com`; HSTS preload; `Referrer-Policy:
   strict-origin-when-cross-origin`; minimal Permissions-Policy; `X-Content-Type-Options: nosniff`.
7. **Audit.** Append-only `audit_log` (no update/delete policies); triggers on claim/document/
   status mutations; app-level entries for document access, invites, MFA events, role changes.
   Owner-only viewer at `/admin/audit`.
8. **Secrets & keys.** `SUPABASE_SECRET_KEY`, `RESEND_API_KEY`, `TURNSTILE_SECRET_KEY`,
   `CRON_SECRET`, `PANDADOC_API_KEY`, `PANDADOC_WEBHOOK_SHARED_KEY`,
   `PANDADOC_LOR_TEMPLATE_UUID` server-only (never `NEXT_PUBLIC_*`); `.env.local` git-ignored
   with committed `.env.example`; Vercel env at launch. Server Actions rely on Next's origin
   checking (CSRF) plus explicit input validation. PandaDoc webhook endpoint verifies HMAC +
   dedupes before any processing (optionally also source-IP allowlist 52.12.31.116,
   52.37.240.175, 35.167.41.246).
9. **PII hygiene.** No PII in URLs or logs; emails address recipients by first name only;
   generic 404s for unauthorized ids (no existence oracle); daily backups + PITR (Pro) at launch;
   `docs/RETENTION.md` documents keep/purge policy for Florida public-adjusting records.

---

## 8. Marketing site (pixel-faithful port)

- **Tokens:** prototype `:root` palette (bg `#26292C`, surface `#33373A`, text `#F0EDE7`, accent
  `#D4B36A`, accent-2 `#A5875F`, full 100–900 ramps, section browns) as Tailwind v4 `@theme`
  variables; Inter 400/500/600/700 via `next/font`; Nocturne component classes (btn/input/field/
  radio/tag/card) recreated as shared components with identical metrics.
- **Pages:** Home, Services, Contractors, About, Contact, File-a-claim — structure, copy, spacing
  (`clamp()` values), dividers, section browns, FAQ `<details>`, sticky blurred header, mobile
  menu (client component), phone/email pulled from one `site.ts` config (default 407-488-5728 /
  Austin@CMGPropertySolutions.net).
- **Hero:** layered gradients + drift/rain/flash keyframes per prototype, plus `<HeroVideoRotator>`:
  3 transcoded clips (~720p, ≤ 3 MB each, muted, no audio track), 1s opacity crossfade on
  `ended`/timer, `poster` first frame, `preload="metadata"` for queued clips; disabled under
  `prefers-reduced-motion` and `saveData` (falls back to animated gradient).
- **ImageSlot:** on-brand placeholder (accent hairline frame + label) for the Home split and About
  team photos; real photo = drop file in `/public/images` + one prop change.
- **SEO/a11y/perf:** per-page metadata + OG, sitemap.xml, robots.txt, LocalBusiness JSON-LD
  (license number, Orlando FL, phone), semantic landmarks, skip-link, focus-visible styles,
  44px+ touch targets, WCAG AA contrast check on gold-on-charcoal text sizes; static rendering,
  self-hosted fonts, `next/image` for stills. Budget: LCP < 2.5s mobile, CLS < 0.05.

## 9. Admin dashboard (`/admin`)

Intake queue (accept/reject with reason) · Leads inbox · Claims table (filter by status/adjuster/
partner; search by ref/name/address) · Claim detail tabs: Overview (status advance + history),
Claimants (+ resend invite), Documents (upload/kind/visibility/signed-URL download), Activity
(post note/reply + visibility picker), Financials (settlement, fee % — owner/adjuster only),
History · Partners (companies CRUD, rep invites) — owner · Staff management (invite adjuster/
assistant, deactivate, reset MFA) — owner · Audit viewer — owner · Settings (org info, fee
default, LOR template fields) — owner. Assistant sees everything read-only except documents/
notes; no financials.

## 10. Customer portal (`/portal`)

Claim overview with 5-step progress + current-status explainer · Activity feed + ask-a-question ·
Documents (customer-visible; upload additional photos/docs) · Multi-claim support out of the box ·
Profile (name/phone edit, password change, consent view/withdraw with audit trail).

## 11. Partner portal (`/partner`)

Referred-claims table from `claim_partner_summaries` (ref, homeowner display name, address,
status, milestone dates, settlement when settled) · claim detail = summary + partner-visible feed
entries · Refer-a-claim form · Company profile (read-only v1).

---

## 12. Build phases

1. **Foundation** — `git init` (develop default), scaffold Next 16 + TS + Tailwind v4, tokens +
   base components, `supabase init/start`, migration 0001 (schema, enums, triggers, RLS,
   functions), seed (owner/adjuster/assistant/partner demo + sample claim), transcode videos
   (ffmpeg → `public/videos`), `.env.example`, Vitest + pgTAP harness, CI (type-check/lint/test/build).
2. **Marketing site** — 6 pages + hero rotator + ImageSlot; intake + contact server actions
   end-to-end (Turnstile, rate limits, storage); outbox mechanism + the three public-form
   templates (intake confirmation, staff alert, lead alert/auto-reply); SEO files.
3. **Auth core** — login, invite accept, staff MFA enroll/challenge, `proxy.ts` gating,
   authz helpers, pgTAP role suite green.
4. **Admin** — queue, claims, status machine + gates, documents + signed URLs,
   PandaDocProvider (send LOR, webhook route, signed-PDF ingestion; sandbox key + tunnel in
   dev) + ManualSignProvider fallback, feed, financials, staff mgmt, audit viewer, invite
   email template (accept flow sends real invites from here on).
5. **Customer portal** — progress, feed Q&A, documents, profile/consent.
6. **Partner system** — companies, rep invites, projection trigger, portal, referral form.
7. **Notifications** — remaining React Email templates (status updates, feed Q&A, LOR, settled),
   sweeper cron hardening, all portal events wired.
8. **Hardening** — headers/CSP, a11y pass, perf pass (Lighthouse via chrome-devtools MCP),
   full pgTAP + unit suite, dependency audit, RETENTION.md.
9. **Launch** — create hosted Supabase project (Pro), `supabase link` + `db push`, storage bucket,
   auth config (SMTP via Resend domain, leaked-password protection, MFA), Vercel project + env +
   crons, DNS (site + Resend domain records), PandaDoc production key + production webhook
   subscription/shared key + template UUIDs in env, smoke tests, seed owner account, backups
   verified.

Each phase ends with the Rule 7/8 checkpoint workflow (roadmap update → `/git-workflow-planning:checkpoint`).
`docs/ROADMAP.md` is created in phase 1 from this phase list.

---

## 13. Open items (non-blocking)

- PandaDoc account setup (Rob/Austin): Business/Enterprise account or trial → Sandbox API key,
  webhook subscription + shared key, and the LOR template built in the PandaDoc editor
  (roles/tokens/fields per the blueprint doc). Production key = Enterprise/API contract with
  PandaDoc sales before launch (billed per document created). Sandbox limits during dev:
  10 req/min, [DEV]-prefixed watermarked docs, signers restricted to the sender's email domain.
- Real photos for the two ImageSlots — Rob/Austin to supply.
- LOR template wording — template built with placeholder legal text; Austin supplies final
  language before launch.
- Supabase Pro plan + `cmgpropertysolutions.net` DNS access needed at phase 9 (Resend domain
  verification + Vercel domain).
- Stat-band numbers ($86M+, 2,400+ claims, 45 yrs) and testimonial are prototype copy — confirm
  with Austin before launch.
