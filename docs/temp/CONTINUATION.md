# Continuation brief — CMG Property Solutions claims platform

**For whoever picks up this build.** Written 12 Aug 2026 at commit `78ce237` on
branch `feature/claims-platform`.

This is not the owner runbook — that is `HANDOFF.md`, and writing it is one of
the remaining tasks. This document is the engineering handoff: what exists, what
is left, and the things that will waste your first four hours if nobody tells
you.

Read `.claude/plans/feature-claims-platform.md` (the design authority, §4 data
model, §5 lifecycle, §6 flows, §7 security) and `docs/temp/AUTOPILOT_SPEC.md`
(the execution contract, including the gauntlet protocol) before starting. This
brief assumes both.

---

## 1. State at a glance

| | |
|---|---|
| Branch | `feature/claims-platform`, 48 commits, never merged to `develop` or `main` |
| Phases 0–7 | complete, each with a checkpoint commit |
| Phase 8 | partially complete — see §4 |
| Phase 9 | not started |
| `npm run type-check` | exits 0 |
| `npm run lint` | exits 0 |
| `npm test` | 587 tests across 44 files, exits 0 |
| `npm run build` | exits 0 |
| `npx supabase test db` | 691 assertions across 18 files, PASS **on a freshly reset database** |
| `npm audit` | 0 vulnerabilities, production and full tree |

**Stack.** Next.js 16.3.0 (App Router; `src/proxy.ts` replaces `middleware.ts`;
async `cookies()`/`params`), React 19.2.8, TypeScript 6.0.3 strict, Tailwind
v4.3.3 (`@theme` tokens, `@utility`), Supabase (Postgres 17, `@supabase/ssr`
0.12.4), zod 4, Vitest 4, pgTAP.

Version pins that are load-bearing and must not be "updated": TypeScript is held
at `^6.0.3` because typescript-eslint's peer range is `>=4.8.4 <6.1.0`; ESLint is
held at `^9.39.5` because `eslint-plugin-react` calls a context API ESLint 10
removed. Both are documented in `docs/temp/PROGRESS.md` under Phase 0.

---

## 2. Running it

```bash
npm install
npx supabase start          # local Docker Postgres + GoTrue + storage
npx supabase db reset       # applies migrations and seeds
npm run dev                 # http://localhost:3000 (or 3100 if that is taken)
```

`.env.local` already holds working local values. Production Supabase credentials
are present but deliberately prefixed `PROD_*` so they are inert — do not rename
them without understanding that dotenv is later-wins and the app would then write
to production with a service-role key.

### Seeded accounts

All use password `CmgDev!2026`.

| Email | Role | MFA |
|---|---|---|
| `owner@cmg.test` | owner | required |
| `adjuster@cmg.test` | adjuster | required |
| `assistant@cmg.test` | assistant | required |
| `customer@cmg.test` | customer | none |
| `partner@cmg.test` | partner | none |

**Staff MFA is enforced in Postgres, not just in the proxy** —
`private.current_app_role()` returns NULL for a staff member below aal2, so an
aal1 token reads nothing. Do not "simplify" that; it was a real vulnerability
(an aal1 token read every claim and escalated an adjuster to owner).

**`supabase db reset` wipes enrolled TOTP factors.** To get back into `/admin`:
sign in, click "Set up authenticator", read the secret the page prints, then

```bash
node "<scratch>/totp.mjs" <SECRET>
```

`totp.mjs` is a 40-line TOTP implementation left in the session scratchpad; if it
is gone, any TOTP library or `oathtool` does the same job. Enter the `code` it
prints. Re-enrol after every reset.

---

## 3. What exists

| Phase | Shipped |
|---|---|
| 0 | Repo, tooling, design tokens ported verbatim from the prototypes |
| 1 | Schema, RLS deny-by-default, triggers, pgTAP suite |
| 2 | Marketing site (6 routes) + public intake and contact forms |
| 3 | Auth: invites, MFA, route gating, `requireUser/requireRole/requireStaff/requireClaimAccess` |
| 4 | Admin workspace — dashboard, intake queue, leads, questions, claims list, claim detail (6 tabs), partners, staff, audit, settings; PandaDoc e-signature layer behind `ESignProvider` |
| 5 | Customer portal — claims, progress ladder, activity, documents, profile, consents |
| 6 | Partner system — companies, rep invites, projection, portal, `/partner/refer` |
| 7 | Notifications — 13 templates, outbox wired to every event, `/api/cron/outbox` sweeper |
| 8 | *(partial)* security headers, secret-leak proof, `npm audit` |

---

## 4. What is left

In the order I would do it.

### 4.1 Craft gates (gate B) — the largest remaining item

The gauntlet protocol requires, per surface: **2 consecutive rounds judged
equal-or-better, or 3 consecutive rounds naming only minors.**

| Surface | Rounds run | Streak | Status |
|---|---|---|---|
| Marketing | converged in Phase 2 | — | **done** |
| Admin workspace | 9–19 (11 rounds) | 1 minor-only (R19) | needs 2 more minor-only rounds |
| Customer portal + partner | 1–3 | 1 minor-only (R3) | needs 2 more minor-only rounds |

So: **~4 more rounds minimum**, plus a fix pass after each. Realistically 4–8,
because of the pattern in §6.

Every round's findings are fixed and committed; nothing is outstanding from
rounds 1–19 or portal rounds 1–3. Round 3's five minors were fixed in `f1c62dc`
and have **not yet been re-verified by a round 4** — that is the next action.

### 4.2 Phase 8 — hardening and cohesion

Done:
- [x] Security headers / CSP — `next.config.ts`, spec §7.6 in full
- [x] `npm audit` clean (0 vulnerabilities, prod and full tree)
- [x] No secret leakage into the client bundle — no server-only env var name
      appears in `.next/static`

Remaining:
- [ ] **`docs/RETENTION.md`** — data retention policy. Not started. The spec
      names it; the tables it must cover are `claims`, `claimants`, `documents`
      (+ storage objects), `claim_events`, `consents`, `audit_log` (append-only,
      so retention means archival not deletion), `notifications_outbox`,
      `invites` (already single-use, 72h), and `leads`.
- [ ] **Cohesion round** — a gauntlet loop across all four surfaces at once,
      looking for inconsistency *between* them rather than defects within one.
      Must converge on the same rule as gate B.
- [ ] **Lighthouse re-verified** — see the open performance item in §5.
- [ ] **Backend architecture re-review (gate C)** — was running when this brief
      was written; see §7 for its result and any findings it left.

### 4.3 Phase 9 — launch prep

- [ ] `vercel.json` (or `vercel.ts` — note the platform now prefers the latter)
      plus a deploy runbook. Must include the cron schedule for
      `/api/cron/outbox`; the route documents what it expects.
- [ ] `docs/temp/HANDOFF.md` — the owner runbook. Does not exist yet. It must
      carry the unblock steps for every item in `BLOCKERS.md`.
- [ ] `docs/temp/BLOCKERS.md` — exists and is good; re-check it is current at
      the end.

---

## 5. Known issues, not yet fixed

Each of these is real, understood, and deliberately left. None is a blocker for
continuing.

1. **pgTAP asserts absolute row counts.** Any row created through the UI fails a
   dozen assertions until the next `db reset`. Always run
   `npx supabase db reset && npx supabase test db` together, and never trust a
   pgTAP failure until you have reset. Worth converting to relative counts
   before this suite runs in CI against a shared database.

2. **Lighthouse performance is 71 against the spec's ≥85 gate.** The same build
   scores 89 at 2× CPU throttling and 92 at 1×; this host's `benchmarkIndex` is
   roughly half a normal runner's. Accessibility is 100. Re-measure on real
   hardware before treating it as a defect — it is recorded in `PROGRESS.md`
   under Phase 2 with the numbers.

3. **Workspace 404s answer HTTP 200.** `admin/loading.tsx` flushes the shell
   before the page runs, and a status cannot be set after the first byte. Argued
   in `src/app/(admin)/admin/[...unmatched]/page.tsx`. Buying the status back
   costs the skeleton on every slow navigation under `/admin`, for a header
   nothing behind auth and `noindex` reads.

4. **A partner sees a referral before CMG has vetted it.**
   `refresh_claim_partner_summary()` projects on `partner_company_id is not
   null` and asks nothing about status, so a referral appears on the rep's list
   immediately reading "new intake". The copy was made to match the system. If
   the business wants it hidden until accepted, change the trigger, not the
   copy.

5. **No screen corrects a claim's carrier after accept — resolved, but check
   the sibling.** `PolicyForm` now does this. There is still no way to correct
   the *loss date or cause* after accept.

6. **`claims.loss_time` still defaults to noon.** The NOT NULL is gone and
   `referClaim` passes an explicit null, but any future caller that omits the
   column gets a fabricated 12:00. Consider dropping the default.

7. **A `shared` staff note emails the homeowner but not the partner.** Partners
   are emailed on status milestones only, which is what the spec lists — but the
   asymmetry is worth a decision rather than an accident.

8. **`claims.esign_status` has no UI reader.** The webhook handler writes
   `document.declined`, `document.voided` and `document.creation_failed`, and
   nothing renders them. Harmless while the provider is Manual; under a real
   PandaDoc key a dead signature request would surface only as one internal line
   on the Activity tab while the pill still reads "LOR sent".

9. **No real email has ever been sent.** There is no Resend key and none was
   created. `resendSender` is exercised only by unit tests with an injected
   sender. Claim, backoff, dead-letter and concurrency are all verified against
   the real database.

---

## 6. How to run a craft round — read this before you write the brief

Twelve rounds' worth of hard-won process. The single most important finding:

> **Every round that opens an axis nobody has examined finds a major on the first
> pass. Every re-tread finds minors.**

Axes already opened and closed: layout at 390/1440/320 · the whole colour system
at rest and in hovered/focus-within rows · the keyboard and the sticky column ·
the adjuster and assistant roles · deep links into paged and filtered states ·
`prefers-reduced-motion` · the accessibility tree · back/forward after a server
action · error and not-found boundaries · double-submit · large default font ·
interrupted submissions · controlled radios versus React's post-action reset ·
printing · the PandaDoc layer in manual mode · the ten lifecycle statuses ·
`<title>` and metadata · time and timezone rendering.

Axes **not** yet opened: RTL / `dir="rtl"` · a very long session (listener and
router-cache growth, `aria-live` repetition) · upload failure mid-flight · the
marketing site read against the two portals as one product · text selection and
copy-paste out of a table · two staff members editing the same row concurrently.

**Rules that made the rounds work:**

- The critic must be a **fresh-context subagent**, never the person who wrote the
  code. Give it a self-contained brief.
- Tell it what earlier rounds fixed, so it verifies rather than re-reports.
- Tell it what is **known and deliberate** (there is a list in each recent round
  brief — column headers at `ink/40`, the em-dash absence mark, the pipeline's
  dimmed empty stages, the Questions nav item's absent badge, the 200-status
  404s). Otherwise you will re-litigate them every round.
- Demand a number, a quoted DOM fact, or a quoted line of source per finding.
  "A finding without evidence is not a finding" is in every brief and it works.
- Never coach the critic toward a clean verdict, and never suppress a finding to
  close a gate.

### Harness facts that will otherwise cost you hours

These are properties of the automation environment, not defects:

1. **Screenshots do not work** — the browser pane is hidden. Measure with
   `javascript_tool` (`getBoundingClientRect`, `getComputedStyle`, canvas
   compositing for contrast) and `read_page`.
2. **Streamed content does not reveal itself.** `requestAnimationFrame` never
   fires, so a full page load can sit on "Loading" with the real content inside
   a `<div hidden>`. After every full navigation run:
   ```js
   (() => { window.$RT = performance.now(); const p = window.$RB || []; window.$RB = []; if (p.length) window.$RV(p); return !document.body.firstElementChild.hidden; })()
   ```
   React does **not** hydrate content in that hidden container, so to test any
   client behaviour, navigate by **clicking in-app links** instead.
3. **The router cache serves stale markup** after a source edit. Use a full URL
   when you need certainty.
4. **`document.hasFocus()` is false**, so `:focus-visible` never matches. Read
   the CSS rule rather than trying to observe a ring.
5. **CSS transitions are frozen**, so `getComputedStyle` returns the
   *pre-transition* value for any transitioned property. Clone the node in place
   and measure the clone.
6. **Contrast maths:** computed colours are `oklab(...)` with alpha and panels
   have translucent fills, so string-parsing gives wrong ratios. Composite the
   whole ancestor background stack through a `<canvas>`. A working helper is in
   several round briefs in the transcript.

---

## 7. Backend architecture review (gate C)

*(Filled in below when the review that was running at the time of writing
returned. If this section still says "pending", re-run it — the brief used is
reproducible from §6's rules plus the scope in `AUTOPILOT_SPEC.md`.)*

**Status:** see §7.1.

---

## 8. Conventions you must not break

These were each bought with a real defect. Breaking one silently reintroduces it.

1. **RLS is the boundary; TypeScript produces sentences.** Every action reads and
   writes through the *caller's* client so a policy decides. Service-role is used
   only for tables with no policy for `authenticated` by design (`audit_log`,
   `notifications_outbox`) and for the public forms. A TS check that becomes
   load-bearing is a bug.

2. **Every refusal echoes what was submitted.** React 19 resets a
   `<form action>` when the action *resolves*, not when it succeeds — so without
   `FormState.values` a refusal silently erases the operator's typing.
   `submittedValues()` and the `values` field exist for this.

3. **Every `useActionState` call site wraps its action in `resilient()`.**
   `useActionState` does not catch; a rejected promise is re-thrown during render
   and blows the page to the error boundary, losing the work. 31 call sites go
   through the wrapper. It re-throws Next's `redirect()`/`notFound()`, which
   signal by throwing.

4. **A controlled radio does not survive the post-action reset.** React clears
   `.checked` and does not re-render. Mirror the selection into a hidden input
   (see `status-advance.tsx` and `event-composer.tsx`), and give the radios a
   name nothing reads.

5. **An uncontrolled `<select>` needs `key={defaultValue}`** to re-apply an
   echoed default. React does this for inputs and textareas but not selects.

6. **`cx()` concatenates; it does not merge.** Two single-class Tailwind colour
   utilities are equal specificity, so emit order decides. Never let a call site
   pass a colour that competes with a component's own — use a prop (see
   `Td`'s `tone`).

7. **Contrast floor is 4.5:1 for text under 18.66px, measured in the *lit*
   state** — rows light on hover and stay lit on `focus-within`. Three
   exceptions are argued in writing in the source; everything else meets it.

8. **Date comparisons go through `America/New_York`.** `businessToday()` in
   `src/lib/validators/loss-date-bounds.ts`. A UTC day made the intake form
   accept a next-day loss date for four hours every evening.

9. **`audit_log` is append-only.** No update or delete policy exists. Never add
   one.

10. **Comments explain *why*, in prose, and only where the reason is not obvious
    from the code.** This codebase's comments are unusually dense with rationale
    — that is deliberate, and it is why several defects were caught by a critic
    noticing a comment claimed something the code did not do. Do not add
    explanatory comments to self-evident lines, and do not let a comment outlive
    the behaviour it describes.

---

## 9. Owner-gated blockers

`docs/temp/BLOCKERS.md` carries the full detail and exact unblock steps. In
short, four items need the owner and cannot be resolved in code:

1. **Two photographs** for the `ImageSlot` placeholders on `/` and `/about`.
2. **Real Cloudflare Turnstile keys** — the test pair is wired in and paints a
   red "For testing only" badge on `/contact` and `/file-a-claim`, and accepts
   every submission. **Launch blocker.**
3. **Supabase leaked-password protection and MFA** — hosted Pro-plan settings.
4. **PandaDoc account, template and webhook subscription** — the e-signature
   layer runs in `ManualSignProvider` fallback until then, which is a supported
   mode, not a broken one.

Add to that list, from Phase 7:

5. **A Resend API key**, plus a verified sending domain. Without it the outbox
   enqueues correctly and the sweeper reports `unconfigured` rather than
   pretending to send.
6. **`CRON_SECRET`** set in the deployment environment, and a cron schedule
   pointing at `/api/cron/outbox` with `Authorization: Bearer $CRON_SECRET`.
   The endpoint answers 503 rather than opening if the secret is unset.

---

## 10. If you change one thing first

Run **craft round 4 on the portal and partner surfaces**, because round 3's five
fixes are committed but unverified, and an unverified fix is the one thing this
process has repeatedly caught being half-right — round 18 found that round 17's
fix restored the note but not the radio selection, while the alert said "What you
typed is still here."
