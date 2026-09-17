# Development roadmap — CMG Property Solutions

Current update — 2026-09-16: contractor details and vendor intake links are committed locally as `b5cfca5`.
The public form no longer asks for loss time. Older time values remain compatible.
Vendor links record internal attribution without granting claim access. Homeowner-only intake remains supported.
Commit `b5cfca5` is pushed with owner approval. PR #2 verify, database, Vercel, and CodeRabbit checks pass for this head.
Native Preview public layout and private-route closure checks pass.
The owner approved all four pending hosted migrations without a backup. They applied successfully in one transaction.
Production has 33 migrations through `20260916020100`. Schema and access-control checks pass.
Local validation passes 1,072 application tests and 1,287 database assertions, with one live PandaDoc test skipped.
Type checks, lint, build, and audit pass. Lint retains two existing warnings.
Public layout checks cover 320, 390, and 1280 pixels. Simple-mode private-route closure passes.
Submission success, authenticated screens, and latest hosted acceptance remain incomplete for the new feature.
Production remains simple. DNS is unchanged, and the owner prohibits a Supabase backup.
HANDOFF contains current evidence. Earlier dated entries below are historical.

Current update — 2026-09-15: Production remains in simple mode. PR #1 is merged; PR #2 contains the pushed dependency and reference-capacity fixes.
PR #2 checks pass at `8be147c`, but the capacity migration and updated Production release still need approval.
Native Preview acceptance found missing feedback for runtime Turnstile failures. A local widget fix adds an accessible message and preserves retry recovery.
The owner approved committing this patch and its release records. Push approval and remote checks for this patch remain pending.
The approved Preview hostname is configured. Native contact submission passed, with a stored lead and two sent outbox entries; delivery verification remains open.
Owner launch decisions and later platform acceptance also remain open.
The dated records below describe earlier checkpoints and do not supersede HANDOFF.

Current update — 2026-09-13: full-platform acceptance is active at the owner's request.
All 29 hosted migrations are applied after explicit approval without a backup.
A later migration fixes annual reference truncation. It is applied locally; all 1,254 pgTAP assertions pass. It is not deployed to Production.
Contact email delivery and one small private claim upload passed; full hosted role and signing acceptance remain incomplete.
Preview platform activation is deployed and Ready. The earlier simple-only roadmap below describes the previous release phase.
Database assertions and the full regression rerun pass. The approved dependency patch clears the audit. Full browser role acceptance remains open.
Current acceptance evidence and test changes remain local and uncommitted.

Last reconciled: 2026-09-07.
The next release targets `SITE_MODE=simple`.
It is not launched or approved for release.
The reviewed implementation commit is `4516a82`; current release-record updates are pushed to `origin/feature/claims-platform`. Release acceptance remains incomplete.
Private platform activation remains a separate phase.

Current code, tests, manifests, and configuration control implementation facts.
[README.md](../README.md) controls setup and the release procedure.
[HANDOFF.md](temp/HANDOFF.md) records current evidence and engineering checks.
[BLOCKERS.md](temp/BLOCKERS.md) records owner-controlled decisions.
The original design and previous phase ledger are historical records.
They do not authorize checkpoint commits or production actions.

## Current phase — Simple-mode release readiness

The public release includes marketing, contact, intake, public notification email, and storage cleanup.
Private login, MFA, invitations, portals, administration, and the PandaDoc webhook remain closed in simple mode.
Existing platform implementation is retained for later activation.

The user approved direct browser uploads to private Supabase Storage, and the local candidate implements them.
The allowance remains ten files of 25 MiB each.
File bytes bypass Server Actions; confirmation verifies private objects before one atomic intake transaction.
The client preserves its session during retries and follows bounded file-verification progress.
Cleanup protects outstanding capabilities and rechecks retained paths for late objects.
Focused client checks passed three files and 50 tests in each site mode; scoped lint passed.
Broader direct-upload validation is recorded in HANDOFF.

The current candidate passes full Vitest in both site modes: 98 files and 1,046 tests per run, with one opt-in live test skipped, after the final mobile widget adjustment.
The affected form and Turnstile selection then passed four files and 51 tests in each site mode.
Both production builds pass after the upload, focus, and smooth-scroll changes.
The root layout now declares the Next.js smooth-scroll contract, and its regression test passes.
The mobile Turnstile widget uses the compact size below 420px, with a passing regression test.

An earlier platform-mode full run was incomplete while Docker was stopped. After Docker recovered and the local database was reset, the current platform and simple runs each passed 98 files and 1,046 tests.

After Docker recovered, the approved local reset removed stale fixtures. The fresh local pgTAP run passed all 38 files and 1,250 assertions.

The following checkpoint predates the direct-upload addition.
Full simple-mode tests passed 89 files and 884 tests, with one live file and test skipped.
Final type-check and lint passed.
Before the fourth migration, the platform CI selection passed 29 files and 200 tests, with one live skip.

That checkpoint contained 27 local migrations and 23 recorded hosted migrations.
The two upload migrations bring the repository total to 29, with six following the last recorded hosted migration.
An earlier full pgTAP run failed suite 32 assertion 20; all other 1,014 assertions passed.
The fourth migration applied locally, and focused suites 32 and 35 then passed 84 assertions.
The full rerun passed 36 files and 1,075 assertions after that migration.

Type generation exited 0 with an unchanged SHA256.
The platform CI rerun after the fourth migration passed 29 files and 200 tests, with one live skip.
HANDOFF records the failure, the passing old-function control, and the limits of the planner tests.

The first local reset failed, and an earlier retry was denied without execution.
The later explicitly approved local reset passed.
Post-reset pgTAP passed 38 files and 1,250 assertions.
Post-reset simple-mode CI passed 30 files and 205 tests, with one live skip.
Post-reset platform CI also passed 30 files and 205 tests, with one live skip.
Type regeneration passed with an unchanged SHA256.

The post-reset type-check passed with exit 0.
Those approved local reset checks are complete and include the two upload migrations.

- [x] Record the current branch, PR, failed CI run, Ready Preview, and existing Production deployment.
- [x] Record hosted migration counts, RLS, bucket limits, account counts, and queue counts without reading identities.
- [x] Reconcile setup, PDF integration, retention, cron, backup, rollback, and approval documentation.
- [x] Complete application fixes and exact test audit cleanup, with simple-mode and affected platform tests.
- [x] Validate simple-mode data, action, and page guards plus exact-length webhook UUID checks.
- [x] Complete the explicitly approved local reset: all 27 migrations and seed, exit 0, without a health timeout.
- [x] Complete post-reset pgTAP: 36 files and 1,075 assertions, exit 0.
- [x] Verify local migration history, RLS, and the private document bucket after reset.
- [x] Complete the post-reset simple-mode CI selection: 29 files and 200 tests, one live skip.
- [x] Complete the post-reset platform CI selection and type regeneration.
- [x] Complete the post-reset type-check: exit 0.
- [x] Complete type generation and full pgTAP after the fourth migration.
- [x] Complete the platform CI rerun after the fourth migration.
- [x] Record final static file, source-size, dependency, workflow, and credential-pattern checks.
- [x] Complete public acceptance at desktop, 390px, and 320px on the pushed Preview candidate; simple-mode private-route closure passed after redeployment.
- [x] Obtain upload architecture approval and implement direct private uploads for ten files of 25 MiB each.
- [x] Validate client upload, progress, and retry behavior: three files and 50 tests in each site mode.
- [ ] Complete hosted upload boundary acceptance after that transport work.
- [ ] Obtain separate approval for Vercel Pro commercial hosting and GitHub private-repository protection.
- [ ] Resolve owner-controlled service, domain, legal, backup, repository-plan, and publication decisions.
- [x] Obtain commit approval and create the local release commit.
- [x] Obtain separate push approval and push the reviewed commits.
- [x] Require passing checks on the approved remote head; the verified Preview redeployment is Ready in simple mode.
- [ ] Back up the database and Storage before approved forward migrations.
- [ ] Verify migration results without seeding production.
- [x] Obtain separate merge and deployment approvals; merge PR #1 into `develop` and deploy Production.
- [x] Obtain separate domain approval and configure `app.cmgpropertysolutions.net` without changing existing root, `www`, or Microsoft 365 records.
- [x] Set Vercel `NEXT_PUBLIC_SITE_URL` to `https://app.cmgpropertysolutions.net` and verify the Resend sending domain without changing existing Microsoft 365 records.
- [ ] Verify the deployed commit, public workflows, email, queues, cron schedules, DNS, TLS, and rollback compatibility.

No current validation item inherits a pass from the historical ledger.
Production now uses merged commit `383a99936ca7536f7e5522ea71387c2b788763df`.
Vercel Ready status does not complete release acceptance.
The upload architecture decision is complete, and the advertised allowance remains unchanged.
Hosted upload publication and boundary acceptance remain open.

The owner explicitly declined a hosted Supabase database backup.
Recovery and PITR readiness remain unverified, so production migrations remain blocked until the recovery decision is revisited.

The Vercel team currently uses Hobby.
Vercel's [fair-use rules](https://vercel.com/docs/limits/fair-use-guidelines) require Pro or Enterprise for commercial use.
Vercel Pro is recommended for CMG; no purchase or plan change is approved or completed.
GitHub's private-repository protection plan remains a separate owner decision.
The implemented upload transport does not approve either plan change.

## Later phase — Private platform activation

- [ ] Approve platform activation independently from the simple public release.
- [ ] Confirm account identities, staff MFA, AAL2, role boundaries, and invitation recovery.
- [ ] Verify customer and partner isolation, private documents, and signed-download audits against hosted services.
- [ ] Complete approved PandaDoc single-owner and dual-owner PDF acceptance, webhook replay, and uncertain-send recovery.
- [ ] Confirm final LOR content and `H1` / `H2` field mapping.
- [ ] Implement and approve applicable retention, export, erasure, and legal-hold processes.
- [ ] Repeat affected security, database, browser, and operational acceptance before enabling platform mode.

PandaDoc template UUIDs are not required by the current bundled-PDF flow.
Live draft tests require separate approval and an invoking-shell opt-in.
No live test should run automatically.
Public legal approval remains required before the earlier simple-mode launch.

## Historical phase ledger — retained through 2026-08-13

The original checklist below records earlier implementation work and checks.
Its passing totals and completion claims are historical, not current release evidence.
Its commit instructions do not authorize new Git actions.

### Development Roadmap — CMG Property Solutions

Design authority: [`.claude/plans/feature-claims-platform.md`](../.claude/plans/feature-claims-platform.md)
Execution spec: [`docs/temp/AUTOPILOT_SPEC.md`](temp/AUTOPILOT_SPEC.md)

Each phase ends with: roadmap updated → checkpoint commit on `feature/claims-platform`.

#### Phase 0 — Repo bootstrap
- [x] Git repo on `develop`, baseline commit, `feature/claims-platform` branch
- [x] Next.js 16.3 + TypeScript strict + Tailwind v4 scaffold
- [x] Vitest wired and green
- [x] type-check / lint / test / build all exit 0
- [x] `.env.example` covering every env var; `.gitignore` + `.gitattributes`
- [x] `docs/ROADMAP.md`, `docs/temp/PROGRESS.md`, GitHub Actions CI workflow

#### Phase 1 — Local Supabase + schema
- [x] `supabase start` healthy
- [x] Migration: all tables, enums, `claim_ref` sequence, status trigger, `check_rate_limit()`, audit triggers, RLS deny-by-default, private `claim-docs` bucket
- [x] `supabase db reset` clean
- [x] Seed: 5 roles + partner company + 2 demo claims
- [x] pgTAP harness green via `supabase test db` (429 assertions, 9 files)
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
- [x] CRAFT GATE converged — rounds 5 & 6 no major gap, ranked 3rd of 4 vs Stripe/Linear/Vercel
- [x] Lighthouse a11y ≥ 95 → **100** on Home
- [x] Lighthouse performance ≥ 85 in two comparable mobile navigation runs — **93 / 90**

#### Phase 3 — Auth core ✅
- [x] Invites, login, staff TOTP MFA, `proxy.ts` gating, authz helpers
- [x] pgTAP role suite green — 483 assertions (anon/customer/partner/assistant/adjuster isolation)
- [x] Browser evidence of invite → portal, `/admin` MFA gate, cross-surface refusal, bad tokens

#### Phase 4 — Admin + PandaDoc
- [x] Intake queue, leads inbox, claims table + detail tabs
- [x] Status machine with legal transitions + `lor_signed` document gate
- [x] Documents: signed URLs, attachment disposition, audit rows
- [x] Partner + staff management, audit viewer, settings
- [x] PandaDocProvider + ManualSignProvider + webhook route and recovery UX
- [x] Webhook tests: signature, tamper, replay, crash recovery, stale attempts, PDF finalization
- [x] Consolidated backend/security stabilization complete for MVP scope
- [x] CRAFT GATE converged (admin dashboard) — final rounds `MINOR GAPS ONLY`

#### Phase 5 — Customer portal
- [x] Progress view, activity feed + questions, documents, profile/consent
- [x] CRAFT GATE converged (customer portal) — final rounds `MINOR GAPS ONLY`

#### Phase 6 — Partner system
- [x] Partner companies + rep invites, projection trigger (pgTAP verified)
- [x] Partner portal + refer-a-claim form + claim detail/activity/company profile
- [x] CRAFT GATE converged (partner portal) — three `MINOR GAPS ONLY` rounds

#### Phase 7 — Notifications
- [x] All templates render; outbox wired to every event
- [x] `/api/cron/outbox` sweeper with backoff + dead-letter, tested

#### Phase 8 — Hardening + cohesion
- [x] Six security headers enforced; `npm audit` clean (0 vulns, prod and full tree)
- [x] CSP enforcing with per-request nonce; production and browser verified
- [x] No secret leakage into client bundle (no server-only var name in `.next/static`)
- [x] Full suites green (725 Vitest / 915 pgTAP); storage cleanup worker and retention operations documented
- [x] Stage 1 integrated review converged — final correction verdict `NO FINDINGS`
- [x] Consolidated effectiveness, safety, security, database, build, and browser stabilization complete
- [x] Stage 2 architecture review converged — two consecutive `NO MAJORS` rounds; full authorization matrix green
- [x] COHESION ROUND converged — `MINOR GAPS ONLY`, `MINOR GAPS ONLY`
- [x] Lighthouse re-verified: mobile simulated runs **93/100** and **90/100**

#### Phase 9 — Launch prep (owner-gated)
- [x] `vercel.json` with outbox and storage-cleanup schedules + deploy runbook
- [x] `docs/temp/HANDOFF.md` reconciled with browser checklist, limitations, and owner steps
- [x] `docs/temp/BLOCKERS.md` contains owner-only launch actions and decisions
- [x] New `cmgps` Vercel project connected to `rspeciale0519/cmg` with Next.js preset
- [x] Hosted simple-mode contact and full intake submissions verified
- [x] PandaDoc account/template/webhook setup sheet written
