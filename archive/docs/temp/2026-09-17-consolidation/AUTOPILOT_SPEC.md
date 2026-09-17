# AUTOPILOT SPEC — CMG Claims Platform Build

> Historical notice added 2026-08-30.
> This record preserves earlier work; it does not define current release state or authorize commands.
> Use [HANDOFF.md](HANDOFF.md) for current evidence and [ROADMAP.md](../../../../docs/ROADMAP.md) for current scope.
> Earlier dates, totals, environment claims, and completion verdicts are not current acceptance evidence.

Execution spec for the autonomous `/goal` run. The **design authority** is
[`.claude/plans/feature-claims-platform.md`](../../../../.claude/plans/feature-claims-platform.md)
(data model §4, lifecycle §5, flows §6, security §7, surfaces §8–11). PandaDoc specifics:
[`docs/reference/pandadoc/`](../../../../docs/reference/pandadoc/README.md) (blueprint = file 06). This file
defines CHECKPOINTS and EXIT CRITERIA only — route choices (component decomposition, file
layout beyond the spec's topology sketch, implementation order inside a phase) are the run's.

## GOAL

Build the complete CMG Property Solutions system per the design spec: marketing site + secure
claims platform (admin / customer / partner portals) on Next.js 16 + Tailwind 4 + local
Supabase, PandaDoc e-sign integration (manual fallback), Resend outbox, all security controls
implemented and proven by tests. **Quality bar: high-end, major-brand front-end craft**
(Stripe/Linear/Vercel tier) on every user-facing surface, and reviewed-until-clean
architecture on the schema and backend — enforced by the GAUNTLET PROTOCOL below, not by
self-assessment. Deployment itself is owner-gated (Phase 9 prepares it; it is NOT executed
autonomously).

## SUBAGENT STRATEGY (mandatory working style)

- **Delegate heavy work to subagents; the orchestrator stays lean.** Substantial
  implementation chunks (a page set, a portal, the schema migration, the webhook layer),
  exploration, and ALL reviews/critiques run as Agent-tool subagents. The orchestrator's job:
  slice work, brief agents with precise inputs (spec sections, file paths, tokens), integrate
  results, run the checks, commit checkpoints.
- **Builders never judge their own work.** Every gate below uses a FRESH-context critic or
  reviewer subagent that receives artifacts (screenshots, rendered pages, migration SQL,
  route code) — never the builder's summary or chat history.
- **UI work loads the `frontend-design:frontend-design` skill** (builder side) so craft input
  is high before critique begins; schema/SQL work loads
  `supabase:supabase-postgres-best-practices` (builder side) before the reviewer ever sees it.
- **Parallelize independent slices** (e.g. distinct pages, distinct portals) across concurrent
  subagents when they touch disjoint files; after any multi-agent wave on one surface, run a
  smoothing pass: one fresh agent makes the pieces cohere (unify spacing/naming/patterns —
  not redesign).
- Keep per-agent briefs self-contained: agents don't inherit this conversation.

## CURRENT STATE (verified 2026-08-09 — do not rediscover)

- CWD `C:\Users\rob\Documents\Websites\- Customers\CMGPA`, Windows 11, PowerShell primary.
- **Not a git repo yet.** No package.json, no node_modules — greenfield scaffold.
- Toolchain installed: node 22.22.2, npm 11.6.2, git 2.49, ffmpeg 8.1, Docker 29.5.3
  (daemon may need starting: launch Docker Desktop and wait for it before `supabase start`),
  supabase CLI (scoop shim).
- Prototypes (source of visual truth, DO NOT modify): `Home.dc.html`, `Services.dc.html`,
  `Contractors.dc.html`, `About.dc.html`, `Contact.dc.html`, `File.dc.html` at repo root +
  `_ds/nocturne-*/styles.css` (tokens/components) + `logo-cmg-mark.png`. `support.js`,
  `image-slot.js`, `_ds/*/_ds_bundle.js` are prototype runtime — port the rendered result, not
  these scripts. Page-level `:root` overrides in each .dc.html define the real palette (gold
  `#D4B36A` on charcoal `#26292C` etc.) — they override the base Nocturne values.
- Videos `temp/media/`: storm-001.mp4 (720p/10s/2.7MB), storm-002.mp4 (720p/10s/3.0MB),
  storm-003.mp4 (4K/16.8s/47MB). Transcode all three to ≤3MB 720p muted MP4 + poster jpg →
  `public/videos/`. `damage-001.mp4` is NOT used. Business-card photo in `uploads/` unused.
- Verified current versions: next 16.3.0 (middleware = `proxy.ts`, request APIs async),
  react 19.2.8, tailwindcss 4.3.3, @supabase/ssr 0.12.4 (`getClaims()` pattern),
  supabase-js 2.112.2, resend 6.18.1, zod 4.4.3.
- Supabase: user has a cloud account but **no CMG project — dev is local Docker only**.
- Credentials that DO NOT exist yet (owner-gated): PandaDoc account/sandbox key/template
  UUIDs, RESEND_API_KEY, real Turnstile keys, hosted Supabase, Vercel project, GitHub remote.
  Cloudflare Turnstile official **test keys** work for dev: sitekey
  `1x00000000000000000000AA`, secret `1x0000000000000000000000000000000AA`.
- Site constants (from prototypes/footer): phone 407-488-5728,
  email Austin@CMGPropertySolutions.net, Orlando FL, license #G086165.
- Git workflow commands available: `/git-workflow-planning:start feature claims-platform`
  (needs repo + clean tree; run AFTER initial commit on `develop`),
  `/git-workflow-planning:checkpoint <n> <desc>` per phase, NEVER run `finish` autonomously
  (no remote exists; it pushes/opens a PR — that's a HANDOFF item).

## PHASES — complete in order; each ends with: roadmap update → checkpoint commit

### Phase 0 — Repo bootstrap
EXIT CRITERIA (each evidenced in-transcript):
- Git repo initialized with `develop` as default branch; initial commit of pre-existing files;
  `/git-workflow-planning:start feature claims-platform` succeeded; `git branch --show-current`
  prints `feature/claims-platform`.
- Next.js 16.3 + TypeScript strict + Tailwind v4 scaffold; Vitest wired;
  `npm run type-check`, `npm run lint`, `npm run build` all exit 0 (output shown).
- `.env.example` lists every env var from spec §7.8 with comments; `.gitignore` covers
  `.env.local`, `node_modules`, `.next`.
- `docs/ROADMAP.md` created from these phases; `docs/temp/PROGRESS.md` created (see
  PROGRESS PROTOCOL); GitHub Actions CI workflow file exists (type-check/lint/test/build).

### Phase 1 — Local Supabase + schema
EXIT CRITERIA:
- `supabase start` healthy (output shown). Migration(s) implement spec §4 in full: all tables
  incl. `claim_financials`, `claim_partner_summaries` + triggers, `pandadoc_webhook_events`,
  enums, `claim_ref` per-year sequence (CMG-YYYY-NNNN), status-transition trigger,
  `check_rate_limit()`, audit triggers, RLS enabled deny-by-default on every table, private
  `claim-docs` bucket. `supabase db reset` runs clean (shown).
- Seed: owner/adjuster/assistant/customer/partner users + partner company + 2 demo claims.
- pgTAP harness runs via `supabase test db` with ≥ smoke coverage; exit 0 shown.
- Tokens for the design system in `@theme` (globals) match prototype `:root` values exactly.
- **SCHEMA REVIEW GATE**: fresh-context reviewer subagent (loaded with
  `supabase:supabase-postgres-best-practices`) audits the full migration + RLS + triggers +
  indexes against the design spec §4 and Postgres best practices; majors fixed and
  re-reviewed until a round reports only minors (verdicts in-transcript).

### Phase 2 — Marketing site + public intake (quality-gated)
EXIT CRITERIA:
- All 6 pages ported (routes `/`, `/services`, `/contractors`, `/about`, `/contact`,
  `/file-a-claim`), sticky blurred header + mobile menu, hero video rotator (3 transcoded
  clips, crossfade, poster, reduced-motion/save-data fallback to animated gradient),
  ImageSlot placeholders, footer, SEO (per-page metadata, sitemap, robots, LocalBusiness
  JSON-LD), Inter via next/font.
- Contact + intake forms work end-to-end against local stack: Turnstile (test keys) verified
  server-side, rate limits enforced (second rapid submit rejected — shown), zod validation,
  files stored to bucket, claim/claimants/consents/lead rows created (DB query output shown),
  outbox mechanism + 3 public email templates render (unit test).
- **BRAND-FIDELITY GATE** (GAUNTLET PROTOCOL, lens A) passed for 1440px and 390px.
- **CRAFT GATE** (GAUNTLET PROTOCOL, lens B) passed for the marketing site: blind-structured
  A/B vs major-brand reference screenshots, looped until converged.
- Lighthouse via chrome-devtools MCP on `/`: performance ≥ 85 (mobile emulation), a11y ≥ 95
  (scores shown).
- Type-check/lint/test/build all exit 0.

### Phase 3 — Auth core
EXIT CRITERIA:
- Invite issuance + `/invite/[token]` accept (hashed single-use 72h tokens), login,
  staff TOTP enroll + challenge, `proxy.ts` role + aal2 gating, `requireRole()` helpers.
- pgTAP role suite green (output shown) proving at minimum: anon reads nothing; customer
  cannot read another claim/documents/events; partner reads only own-company
  `claim_partner_summaries` + partner-visible events, never documents/policy columns;
  assistant cannot update status or read `claim_financials`; adjuster limited to assigned.
- Browser evidence via chrome-devtools: invite → set password → portal shows only own claim;
  `/admin` blocked pre-MFA, allowed post-enroll.
- All standard checks exit 0.

### Phase 4 — Admin + PandaDoc
EXIT CRITERIA:
- Intake queue (accept→invites/reject), leads inbox, claims table + detail tabs (overview/
  status advance with legal-transition enforcement incl. the `lor_signed`-requires-document
  gate, claimants, documents with 5-min signed URLs + attachment disposition + audit rows,
  activity feed with visibility, financials owner/adjuster-only, history), partner + staff
  management, audit viewer, settings.
- `PandaDocProvider` per blueprint (create-from-template → poll draft → send; tokens,
  metadata.claim_id) + `ManualSignProvider` fallback + `/api/pandadoc/webhook` implementing
  raw-body HMAC verify (timing-safe), event-id dedupe, idempotent handlers, PDF-ready →
  storage → auto-advance. Without real keys: unit tests cover signature verify (valid /
  tampered / replayed) and a **simulated E2E** — synthetic signed webhook posts drive a claim
  `lor_sent → lor_signed` with PDF row created (test output shown). Real sandbox E2E becomes a
  HANDOFF item unless keys appear in `.env.local` mid-run (then run it).
- **BACKEND REVIEW GATE**: fresh-context reviewer subagent audits the server-action/authz/
  webhook/storage layer (authorization on every mutation, input validation coverage,
  idempotency, error handling, audit coverage) against spec §6–7; majors fixed and
  re-reviewed until only minors (verdicts in-transcript).
- **CRAFT GATE for the admin dashboard** (GAUNTLET lens B, dashboard reference set):
  looped until converged.
- Invite email template; standard checks exit 0; pgTAP still green.

### Phase 5 — Customer portal
EXIT CRITERIA: claim overview with 5-step progress mapping, activity feed + ask-a-question
(rate-limited), documents (view customer-visible + upload), profile/consent management.
Browser evidence of the happy path; **CRAFT GATE for the customer portal** (lens B, looped
until converged); checks green.

### Phase 6 — Partner system
EXIT CRITERIA: partner company CRUD + rep invites (owner), projection trigger verified by
pgTAP (settlement visible only once settled), partner portal (referred claims + milestones +
partner-visible feed), refer-a-claim form creating a pre-linked intake. Browser evidence;
**CRAFT GATE for the partner portal** (lens B, looped until converged); checks green.

### Phase 7 — Notifications
EXIT CRITERIA: every template from spec §6 exists and unit-renders; outbox wired to all
events (status change, Q&A both directions, LOR milestones, settled); `/api/cron/outbox`
sweeper with CRON_SECRET + backoff + dead-letter, covered by tests. Checks green.

### Phase 8 — Hardening + cohesion
EXIT CRITERIA:
- Security headers/CSP per spec §7.6 verified (curl -I output shown); `npm audit` reviewed
  (high/critical: fixed or justified in PROGRESS.md); no `NEXT_PUBLIC_` secret leakage
  (grep of build output shown); full unit + pgTAP suites green; `docs/RETENTION.md` written.
- **COHESION ROUND** (GAUNTLET rules): one fresh-context critic reviews screenshots of every
  surface (marketing + all three logged-in areas) for design-system coherence; majors fixed,
  repeated until only minors.
- Lighthouse re-run on `/` ≥ same floors.

### Phase 9 — Launch prep (owner-gated; no deploys)
EXIT CRITERIA: `vercel.json` (crons) + deploy runbook in README; `docs/temp/HANDOFF.md`
complete — owner steps for: GitHub remote + push + PR (`/git-workflow-planning:finish`),
hosted Supabase Pro (link/push/auth config/leaked-password/backups), Vercel (project, env,
crons, domain), Resend domain DNS, real Turnstile keys, PandaDoc (account, template build
per blueprint §Prerequisites, sandbox E2E, production key), stat-band/testimonial copy
confirmation, photos for ImageSlots, LOR legal text. BLOCKERS.md contains only owner-level
items or is empty. Final roadmap fully checked; final checkpoint committed.

## HARD CONSTRAINTS (hold at every phase)

1. Global CLAUDE.md rules apply: never delete user-authored files (archive/ instead);
   prototypes and `temp/media` originals untouched; browser work via chrome-devtools MCP
   (never Playwright); files ≤ ~450 LOC; no explanatory-comment noise.
2. Git: work only on `feature/claims-platform`; roadmap update then
   `/git-workflow-planning:checkpoint <phase> <desc>` at every phase end; if a gate fails,
   fix and re-run the same checkpoint before proceeding; never touch `main`; never push.
3. Security invariants: service-role/secret keys only in `server-only` modules (grep proof in
   Phase 8); every new table RLS-enabled deny-by-default in the same migration; every public
   write Turnstile + rate-limit + zod guarded; no PII in URLs or logs; UUID filenames in
   storage; signed URLs 5-min TTL + attachment disposition; no secrets in git.
4. Design: the prototypes are the **floor, not the ceiling**. Brand palette, typography
   direction, page structure, and copy stay verbatim (copy changes are an owner item);
   craft — spacing rhythm, hierarchy, states (hover/focus/empty/loading/error), motion,
   responsive polish — must be elevated to the GAUNTLET bar and may exceed the prototypes.
5. External services: never create paid/hosted resources (Supabase cloud, Vercel, PandaDoc,
   domain, GitHub repo) — HANDOFF items. If `.env.local` gains real keys mid-run, use them.
6. Windows environment: PowerShell-compatible commands; paths contain spaces — quote them.

## GAUNTLET PROTOCOL (all quality gates)

Builders never judge their own work; every gate is a FRESH-context subagent whose verbatim
verdict lands in the transcript. All gates loop: fix majors → re-judge with a fresh critic →
repeat. **Converged / "agents happy"** = 2 consecutive rounds with ours judged equal-or-better
(A/B lenses) or no majors, or 3 consecutive rounds naming only gaps the critic itself rates
minor. A gate never passes on the builder's opinion.

**Lens A — Brand fidelity (marketing, Phase 2).** Render the prototype `.dc.html` (local
static serve) and the Next.js page at 1440×900 and 390×844; screenshot both; critic gets the
pairs and names deviations in palette/copy/structure, rated major/minor. Craft improvements
beyond the prototype are NOT deviations (see HARD CONSTRAINT 4).

**Lens B — Craft elevation (every user-facing surface).** Bar = real major-brand work, not a
rubric. First craft round of each surface: pick 2–3 publicly reachable references and justify
in one sentence — marketing set from the tier of stripe.com / linear.app / vercel.com (dark,
premium, restrained); dashboard/portal set from the tier of ui.shadcn.com/examples/dashboard,
linear.app product pages, stripe.com dashboard imagery — then screenshot the LIVE references
with chrome-devtools at the same viewports. Each round: critic receives our screenshots + the
reference screenshots (blind-structured: forced ranking even though references may be
recognizable), must (a) rank ours against the set for visual craft, (b) name the SINGLE
biggest gap (hierarchy, spacing rhythm, type scale, color discipline, states, motion,
density), rated major/minor. Builder fixes that gap; loop to convergence. Interactive states
(hover/focus/empty/loading/error) are in scope — critic sees state screenshots for at least
one representative screen per surface.

**Lens C — Architecture review (schema Phase 1, backend Phase 4).** Reviewer subagent
(schema: loaded with `supabase:supabase-postgres-best-practices`) audits the real artifacts
(migration SQL, policies, server actions, webhook route) against design spec §4–§7 and names
concrete findings rated major/minor; majors fixed, re-reviewed to convergence. Findings must
cite file/line or object names — vague verdicts are re-run.

## PROGRESS PROTOCOL

Maintain `docs/temp/PROGRESS.md` (newest-first log: phase, what shipped, check results,
screenshots saved under `docs/temp/media/progress/`, open questions) — update at minimum at
every phase boundary and whenever a critic round or blocker lands. Owner-blockers go to
`docs/temp/BLOCKERS.md` with what's blocked, why owner-level, and the exact unblock step;
blocked work is routed around, never silently dropped.

## DEFINITION OF DONE

All Phase 0–9 EXIT CRITERIA evidenced in-transcript in order; **every GAUNTLET gate
(brand-fidelity, all craft gates, schema + backend reviews, cohesion) converged**; full check
suite (type-check, lint, vitest, build, `supabase test db`) green at the final checkpoint;
HANDOFF.md + PROGRESS.md current; BLOCKERS.md empty or owner-only. Honesty clause: never
weaken, mock around, or game a stated check or critic round (no cherry-picked screenshots,
no coached critics); a documented honest failure in BLOCKERS.md with owner-only resolution
satisfies the affected criterion once all owner-independent work is done.
