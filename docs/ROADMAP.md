# Development Roadmap — CMG Property Solutions

Design authority: [`.claude/plans/feature-claims-platform.md`](../.claude/plans/feature-claims-platform.md)
Execution spec: [`docs/temp/AUTOPILOT_SPEC.md`](temp/AUTOPILOT_SPEC.md)

Each phase ends with: roadmap updated → checkpoint commit on `feature/claims-platform`.

## Phase 0 — Repo bootstrap
- [x] Git repo on `develop`, baseline commit, `feature/claims-platform` branch
- [x] Next.js 16.3 + TypeScript strict + Tailwind v4 scaffold
- [x] Vitest wired and green
- [x] type-check / lint / test / build all exit 0
- [x] `.env.example` covering every env var; `.gitignore` + `.gitattributes`
- [x] `docs/ROADMAP.md`, `docs/temp/PROGRESS.md`, GitHub Actions CI workflow

## Phase 1 — Local Supabase + schema
- [x] `supabase start` healthy
- [x] Migration: all tables, enums, `claim_ref` sequence, status trigger, `check_rate_limit()`, audit triggers, RLS deny-by-default, private `claim-docs` bucket
- [x] `supabase db reset` clean
- [x] Seed: 5 roles + partner company + 2 demo claims
- [x] pgTAP harness green via `supabase test db` (429 assertions, 9 files)
- [x] Design tokens in `@theme` match prototype `:root` exactly
- [x] SCHEMA REVIEW GATE converged (4 rounds: 9 → 3 → 2 → 0 majors)

## Phase 2 — Marketing site + public intake
- [x] 6 pages ported with header/mobile menu/footer (+ branded 404)
- [x] Hero video rotator (3 transcoded clips, crossfade, reduced-motion fallback)
- [x] ImageSlot placeholders
- [x] SEO: metadata, sitemap, robots, LocalBusiness JSON-LD
- [x] Contact + intake forms end-to-end (Turnstile, rate limit, storage, DB rows)
- [x] Outbox + 4 public email templates
- [x] BRAND-FIDELITY GATE converged — rounds 9 & 10 consecutive NO MAJORS
- [x] CRAFT GATE converged — rounds 5 & 6 no major gap, ranked 3rd of 4 vs Stripe/Linear/Vercel
- [x] Lighthouse a11y ≥ 95 → **100** on Home
- [x] Lighthouse performance ≥ 85 in two comparable mobile navigation runs — **93 / 90**

## Phase 3 — Auth core ✅
- [x] Invites, login, staff TOTP MFA, `proxy.ts` gating, authz helpers
- [x] pgTAP role suite green — 483 assertions (anon/customer/partner/assistant/adjuster isolation)
- [x] Browser evidence of invite → portal, `/admin` MFA gate, cross-surface refusal, bad tokens

## Phase 4 — Admin + PandaDoc
- [x] Intake queue, leads inbox, claims table + detail tabs
- [x] Status machine with legal transitions + `lor_signed` document gate
- [x] Documents: signed URLs, attachment disposition, audit rows
- [x] Partner + staff management, audit viewer, settings
- [x] PandaDocProvider + ManualSignProvider + webhook route and recovery UX
- [x] Webhook tests: signature, tamper, replay, crash recovery, stale attempts, PDF finalization
- [x] Consolidated backend/security stabilization complete for MVP scope
- [x] CRAFT GATE converged (admin dashboard) — final rounds `MINOR GAPS ONLY`

## Phase 5 — Customer portal
- [x] Progress view, activity feed + questions, documents, profile/consent
- [x] CRAFT GATE converged (customer portal) — final rounds `MINOR GAPS ONLY`

## Phase 6 — Partner system
- [x] Partner companies + rep invites, projection trigger (pgTAP verified)
- [x] Partner portal + refer-a-claim form + claim detail/activity/company profile
- [x] CRAFT GATE converged (partner portal) — three `MINOR GAPS ONLY` rounds

## Phase 7 — Notifications
- [x] All templates render; outbox wired to every event
- [x] `/api/cron/outbox` sweeper with backoff + dead-letter, tested

## Phase 8 — Hardening + cohesion
- [x] Six security headers enforced; `npm audit` clean (0 vulns, prod and full tree)
- [x] CSP enforcing with per-request nonce; production and browser verified
- [x] No secret leakage into client bundle (no server-only var name in `.next/static`)
- [x] Full suites green (725 Vitest / 915 pgTAP); storage cleanup worker and retention operations documented
- [x] Stage 1 integrated review converged — final correction verdict `NO FINDINGS`
- [x] Consolidated effectiveness, safety, security, database, build, and browser stabilization complete
- [x] Stage 2 architecture review converged — two consecutive `NO MAJORS` rounds; full authorization matrix green
- [x] COHESION ROUND converged — `MINOR GAPS ONLY`, `MINOR GAPS ONLY`
- [x] Lighthouse re-verified: mobile simulated runs **93/100** and **90/100**

## Phase 9 — Launch prep (owner-gated)
- [x] `vercel.json` with outbox and storage-cleanup schedules + deploy runbook
- [x] `docs/temp/HANDOFF.md` reconciled with browser checklist, limitations, and owner steps
- [x] `docs/temp/BLOCKERS.md` contains owner-only launch actions and decisions
