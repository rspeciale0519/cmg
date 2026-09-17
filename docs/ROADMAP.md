# Development roadmap — CMG Property Solutions

Reconciled 2026-09-17.

## Current phase

[RELEASE_STATE.md](RELEASE_STATE.md) is the single current record of production facts, open pull requests,
migration heads, environment facts, open gates, owner decisions, and the ordered next steps.
Read it first. This roadmap records design direction and history only.

[HANDOFF.md](temp/HANDOFF.md) holds engineering evidence and acceptance checklists.
[BLOCKERS.md](temp/BLOCKERS.md) holds the owner-decision register.
[README.md](../README.md) controls setup and the release procedure.

Current code, tests, manifests, and configuration control implementation facts.
Do not record commit IDs, test totals, or deployment identifiers in this file.

## Design deltas since 2026-08-08

The original design in [`.claude/plans/feature-claims-platform.md`](../.claude/plans/feature-claims-platform.md)
is design history. The following decisions replace parts of it.

- **Direct-to-Storage uploads.** The browser sends intake file bytes straight to private Supabase Storage
  through one-time signed capabilities. Server Actions receive text, file metadata, and session credentials only.
  The advertised allowance stays ten files of 25 MiB each.
- **Bundled LOR PDFs.** The e-signature provider uploads bundled single-signer and dual-signer PDFs
  with `H1` and `H2` roles. PandaDoc template UUIDs are not used.
- **Nullable carrier and an `lor_sent` policy gate.** The carrier field accepts null, and the policy gate
  applies at `lor_sent` rather than earlier in the lifecycle.
- **`rejected` reachable from `under_review` and `lor_sent`.** The status machine allows both transitions.
- **`SITE_MODE`.** One build serves a public simple mode and a private platform mode.
  The first release ships simple mode with the staff admin desk, not the full platform.
- **Loss time removed.** The public intake asks for loss date and cause only.
  Valid times from older clients remain accepted. Omitted times store null.
- **Contractor and agreement-type sections.** The intake carries four optional contractor fields:
  name, company, phone, and email. Homeowner identity and consent stay separate.
  The agreement type selects the matching LOR variant.
- **Vendor referral links.** Each partner company has a unique public intake link.
  The server resolves the code after rate limits, Turnstile, and validation, and stores internal provenance
  in `intake_referral_partner_id`. A link grants no claim access.
- **Partner notifications to the company inbox.** Referral and status notifications go to the partner company
  inbox rather than to individual reps.
- **Fee model.** The CMG standard fee is 20 percent. A per-vendor fee override is a staff-only setting.

## Later phase — customer and partner access

These items wait for a separate owner decision. They are not part of the first release.

- [ ] Approve customer and partner logins independently from the staff admin desk.
- [ ] Confirm account identities, staff MFA, AAL2, role boundaries, and invitation recovery.
- [ ] Verify customer and partner isolation, private documents, and signed-download audits against hosted services.
- [ ] Complete approved single-owner and dual-owner LOR acceptance, webhook replay, and uncertain-send recovery.
- [ ] Confirm final LOR content and `H1` / `H2` field mapping.
- [ ] Implement and approve applicable retention, export, erasure, and legal-hold processes.
- [ ] Repeat affected security, database, browser, and operational acceptance before enabling platform mode.

## Historical phase ledger — retained through 2026-08-13

Everything below is historical. Its passing totals, counts, and completion claims are not current release evidence.
Its commit instructions do not authorize Git or production actions.
Later dated release paragraphs that once sat at the top of this file are in
[the 2026-09-17 archive](../archive/docs/temp/2026-09-17-consolidation/README.md).

### Development Roadmap — CMG Property Solutions

Design authority: [`.claude/plans/feature-claims-platform.md`](../.claude/plans/feature-claims-platform.md)
Execution spec: [`AUTOPILOT_SPEC.md`](../archive/docs/temp/2026-09-17-consolidation/AUTOPILOT_SPEC.md)

Each phase ended with: roadmap updated, then a checkpoint commit on `feature/claims-platform`.

#### Phase 0 — Repo bootstrap
- [x] Git repo on `develop`, baseline commit, `feature/claims-platform` branch
- [x] Next.js 16.3 + TypeScript strict + Tailwind v4 scaffold
- [x] Vitest wired and green
- [x] type-check / lint / test / build all exit 0
- [x] `.env.example` covering every env var; `.gitignore` + `.gitattributes`
- [x] `docs/ROADMAP.md`, progress log, GitHub Actions CI workflow

#### Phase 1 — Local Supabase + schema
- [x] `supabase start` healthy
- [x] Migration: all tables, enums, `claim_ref` sequence, status trigger, `check_rate_limit()`, audit triggers, RLS deny-by-default, private `claim-docs` bucket
- [x] `supabase db reset` clean
- [x] Seed: 5 roles + partner company + 2 demo claims
- [x] pgTAP harness green via `supabase test db`
- [x] Design tokens in `@theme` match prototype `:root` exactly
- [x] SCHEMA REVIEW GATE converged (4 rounds: 9 → 3 → 2 → 0 majors)

#### Phase 2 — Marketing site + public intake
- [x] 6 pages ported with header/mobile menu/footer (+ branded 404)
- [x] Hero video rotator (3 transcoded clips, crossfade, reduced-motion fallback)
- [x] ImageSlot placeholders
- [x] SEO: metadata, sitemap, robots, LocalBusiness JSON-LD
- [x] Contact + intake forms end-to-end (Turnstile, rate limit, storage, DB rows)
- [x] Outbox + 4 public email templates
- [x] BRAND-FIDELITY GATE converged — rounds 9 & 10 consecutive NO MAJORS
- [x] CRAFT GATE converged — rounds 5 & 6 no major gap
- [x] Lighthouse a11y ≥ 95 → **100** on Home
- [x] Lighthouse performance ≥ 85 in two comparable mobile navigation runs — **93 / 90**

#### Phase 3 — Auth core
- [x] Invites, login, staff TOTP MFA, `proxy.ts` gating, authz helpers
- [x] pgTAP role suite green (anon/customer/partner/assistant/adjuster isolation)
- [x] Browser evidence of invite → portal, `/admin` MFA gate, cross-surface refusal, bad tokens

#### Phase 4 — Admin + PandaDoc
- [x] Intake queue, leads inbox, claims table + detail tabs
- [x] Status machine with legal transitions + `lor_signed` document gate
- [x] Documents: signed URLs, attachment disposition, audit rows
- [x] Partner + staff management, audit viewer, settings
- [x] PandaDocProvider + ManualSignProvider + webhook route and recovery UX
- [x] Webhook tests: signature, tamper, replay, crash recovery, stale attempts, PDF finalization
- [x] CRAFT GATE converged (admin dashboard)

#### Phase 5 — Customer portal
- [x] Progress view, activity feed + questions, documents, profile/consent
- [x] CRAFT GATE converged (customer portal)

#### Phase 6 — Partner system
- [x] Partner companies + rep invites, projection trigger (pgTAP verified)
- [x] Partner portal + refer-a-claim form + claim detail/activity/company profile
- [x] CRAFT GATE converged (partner portal)

#### Phase 7 — Notifications
- [x] All templates render; outbox wired to every event
- [x] `/api/cron/outbox` sweeper with backoff + dead-letter, tested

#### Phase 8 — Hardening + cohesion
- [x] Six security headers enforced; `npm audit` clean
- [x] CSP enforcing with per-request nonce; production and browser verified
- [x] No secret leakage into client bundle
- [x] Full suites green; storage cleanup worker and retention operations documented
- [x] Stage 1 integrated review converged — final verdict `NO FINDINGS`
- [x] Stage 2 architecture review converged — two consecutive `NO MAJORS` rounds
- [x] COHESION ROUND converged
- [x] Lighthouse re-verified: mobile simulated runs **93/100** and **90/100**

#### Phase 9 — Launch prep (owner-gated)
- [x] `vercel.json` with outbox and storage-cleanup schedules + deploy runbook
- [x] Handoff reconciled with browser checklist, limitations, and owner steps
- [x] Owner-only launch actions and decisions recorded
- [x] New `cmgps` Vercel project connected with Next.js preset
- [x] Hosted simple-mode contact and full intake submissions verified
- [x] PandaDoc account and webhook setup sheet written
