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
- [ ] `supabase start` healthy
- [ ] Migration: all tables, enums, `claim_ref` sequence, status trigger, `check_rate_limit()`, audit triggers, RLS deny-by-default, private `claim-docs` bucket
- [ ] `supabase db reset` clean
- [ ] Seed: 5 roles + partner company + 2 demo claims
- [ ] pgTAP harness green via `supabase test db`
- [ ] Design tokens in `@theme` match prototype `:root` exactly
- [ ] SCHEMA REVIEW GATE converged

## Phase 2 — Marketing site + public intake
- [ ] 6 pages ported with header/mobile menu/footer
- [ ] Hero video rotator (3 transcoded clips, crossfade, reduced-motion fallback)
- [ ] ImageSlot placeholders
- [ ] SEO: metadata, sitemap, robots, LocalBusiness JSON-LD
- [ ] Contact + intake forms end-to-end (Turnstile, rate limit, storage, DB rows)
- [ ] Outbox + 3 public email templates
- [ ] BRAND-FIDELITY GATE converged (1440px + 390px)
- [ ] CRAFT GATE converged (marketing)
- [ ] Lighthouse: performance ≥ 85, a11y ≥ 95

## Phase 3 — Auth core
- [ ] Invites, login, staff TOTP MFA, `proxy.ts` gating, authz helpers
- [ ] pgTAP role suite green (anon/customer/partner/assistant/adjuster isolation)
- [ ] Browser evidence of invite → portal and `/admin` MFA gate

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
- [ ] Partner companies + rep invites, projection trigger (pgTAP verified)
- [ ] Partner portal + refer-a-claim form
- [ ] CRAFT GATE converged (partner portal)

## Phase 7 — Notifications
- [ ] All templates render; outbox wired to every event
- [ ] `/api/cron/outbox` sweeper with backoff + dead-letter, tested

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
