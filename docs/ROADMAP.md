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
- [ ] Lighthouse performance ≥ 85 → see `docs/temp/BLOCKERS.md` (host-contended measurement)

## Phase 3 — Auth core ✅
- [x] Invites, login, staff TOTP MFA, `proxy.ts` gating, authz helpers
- [x] pgTAP role suite green — 483 assertions (anon/customer/partner/assistant/adjuster isolation)
- [x] Browser evidence of invite → portal, `/admin` MFA gate, cross-surface refusal, bad tokens

## Phase 4 — Admin + PandaDoc
- [ ] Intake queue, leads inbox, claims table + detail tabs
- [ ] Status machine with legal transitions + `lor_signed` document gate
- [ ] Documents: signed URLs, attachment disposition, audit rows
- [ ] Partner + staff management, audit viewer, settings
- [ ] PandaDocProvider + ManualSignProvider + webhook route
- [ ] Webhook tests: signature valid/tampered/replayed + simulated E2E
- [ ] BACKEND REVIEW GATE converged
- [ ] CRAFT GATE converged (admin dashboard)

## Phase 5 — Customer portal
- [ ] Progress view, activity feed + questions, documents, profile/consent
- [ ] CRAFT GATE converged (customer portal)

## Phase 6 — Partner system
- [x] Partner companies + rep invites, projection trigger (pgTAP verified)
- [x] Partner portal + refer-a-claim form
- [ ] CRAFT GATE converged (partner portal) — 2 rounds run, R2 found 2 majors (fixed); not converged

## Phase 7 — Notifications
- [x] All templates render; outbox wired to every event
- [x] `/api/cron/outbox` sweeper with backoff + dead-letter, tested

## Phase 8 — Hardening + cohesion
- [ ] Security headers/CSP verified; `npm audit` clean or justified
- [ ] No secret leakage into client bundle (grep proof)
- [ ] Full unit + pgTAP suites green; `docs/RETENTION.md`
- [ ] COHESION ROUND converged
- [ ] Lighthouse re-verified

## Phase 9 — Launch prep (owner-gated)
- [ ] `vercel.json` + deploy runbook
- [ ] `docs/temp/HANDOFF.md` complete
- [ ] `docs/temp/BLOCKERS.md` owner-only or empty
