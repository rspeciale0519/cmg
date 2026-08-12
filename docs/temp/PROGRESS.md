# Build Progress — CMG Property Solutions

Live log for the autonomous build. Newest first. Roadmap:
[`docs/ROADMAP.md`](../ROADMAP.md) · Blockers: [`BLOCKERS.md`](BLOCKERS.md)

---

## Phase 6 — Partner system ✅ (craft gate open)

**Shipped** — the last missing piece was `/partner/refer`. Companies, rep invites and the
`claim_partner_summaries` projection all landed in Phase 4; the portal itself in Phase 5.

A rep sends the homeowner and the loss and nothing else — spec §6's "staff completes details
on accept" — behind Turnstile and a per-account rate limit, inserted with the service-role
client after an app-level authz check, with `public.partner_referral_company()` delegating to
the private helper so "which company may this rep act for" has exactly one definition.

**No consent row is written, and the absence is the decision.** A consent carries the
checkbox text verbatim, the subject's phone and email, their IP and the moment they ticked
it, and `guard_consent_immutable()` treats it as evidence. The homeowner is not at this form.
A row minted from a contractor's submission would look exactly like evidence while being
evidence of nothing.

**Four columns lost their NOT NULL** — `carrier`, `policy_number`, `carrier_tenure`,
`loss_time` — because a contractor on somebody else's roof does not know any of them. The
alternative was a sentinel, and `carrier_tenure`'s three labels are all lengths of time, so
any of them asserts on the homeowner's behalf a fact nobody collected. `loss_time` was
already fabricating: NOT NULL DEFAULT noon, so the triage card printed "· 12:00 PM" for a
storm nobody gave a time for.

**The gap that relaxation opened, and how it closed.** The migration closed it at accept, and
assumed accept was the only door out of `new_intake`. It is not — the status picker offers
`under_review`, the claim detail layout reads no status, and from there `lor_sent` was legal.
A Letter of Representation would have gone to a carrier with the carrier and policy number
blank. Reproduced live before the fix. Now gated in three places (the disabled pill with its
reason, the server action, and `enforce_claim_status_transition()`), and `PolicyForm` on the
claim Overview is the screen where the details are entered — and corrected, which the
workspace had no way to do at all.

**Two defects found in passing and fixed:** `SelectField` never re-applied an echoed
`defaultValue` (React updates `defaultSelected` for inputs and textareas, not for an
uncontrolled select), so a refused referral came back with Cause of loss silently changed
from "Wind / hail" to "Wind" while the server's echo said otherwise. And accept had no way to
collect the policy side at all, which would have made a referral impossible to complete.

**Checks** — 549 unit tests, **666 pgTAP assertions across 17 files**, type-check, lint and
build all exit 0 on a freshly reset database.

**Known, recorded rather than fixed:** the pgTAP suite asserts absolute row counts, so any
row created through the UI fails a dozen assertions until the next `db reset`. Worth
converting to relative counts before the suite is run in CI against a shared database.

---

## Phase 4 — Admin workspace 🔶 (craft gate open)

**Shipped** — the full staff workspace: dashboard with a pipeline ladder, intake queue,
leads, questions, the claims list, a claim's six tabs (Overview, Claimants, Documents,
Activity, Financials, History), partner companies and their detail, staff, the audit
viewer, and settings — plus the PandaDoc e-signature layer.

**Phase 5** (customer portal) is also shipped, at `88bb28c`. Its own craft gate has not
been run yet; the two contrast fixes that were obviously shared were applied to it in
passing (`claim-tabs` counts, `frame`, `error`, activity timestamps).

### Craft gate — rounds 9 to 15

Convergence is two consecutive clean rounds, or three consecutive minor-only. **Not
reached.** The log matters more than the verdicts, because it shows *why*:

| Round | Verdict | What it went looking at |
|---|---|---|
| 9 | major | horizontal scroll strips |
| 10 | 3 major, 4 minor | layout at 390 |
| 11 | 1 major, 7 minor | colour, and control ids |
| 12 | 4 minor | (re-check of the colour pass) |
| 13 | 7 minor | behaviour: refusals, boundaries, no-op saves |
| 14 | 2 major, 4 minor | **keyboard** — a new axis |
| 15 | 1 major, 6 minor | **the adjuster and the assistant** — a new axis |

Rounds 12 and 13 are the shape of a converging surface. Rounds 14 and 15 are not
regressions: each is the first round to look at an axis nobody had looked at, and each
found a real major there on the first pass. Colour and layout are now measured clean at
390 and 1440 — the only text under 4.5:1 anywhere in the workspace is the three cases
argued in writing in the source (column headers, the em-dash absence mark, the pipeline's
dimmed empty stages), and no interactive target is under 24px on any route.

**The two majors worth remembering**, because both were invisible to every earlier round:

- **The sticky first column painted over focused controls.** Tab moves focus into an
  off-screen column, the browser scrolls it into the scrollport and stops — as far as
  scrolling is concerned it is visible — and then the sticky cell, opaque and above it,
  covers it. On `/admin/partners` at 390 that was 100% of the control and its focus ring.
  Fixed with `scroll-padding-inline-start` told the sticky column's width, plus
  rebalancing the one table whose identity column was 75% of the phone.
- **An adjuster who reassigned her own claim was stranded.** The write is allowed against
  the pre-update row; the row then leaves her view, and the success message rendered onto
  the workspace 404. She is now redirected to the list, and told beforehand.

### What the next round should do

Run round 16. If it is minor-only, rounds 17 and 18 decide the gate. The axes still least
examined are the **portal** and **partner** surfaces (phases 5 and 6 have had no craft gate
at all), long/awkward data against real rows rather than injected text, and the intake
Accept form, which the seed leaves empty so no round has seen it rendered.

---

## Phase 3 — Auth core ✅

**Shipped** — Next 16 `proxy` gating (`/admin` needs staff role **and** aal2; `/portal` customer;
`/partner` partner), `requireUser/requireRole/requireStaff/requireClaimAccess` server guards,
invite issuance and acceptance, login/logout, staff TOTP enrolment and challenge, HIBP
leaked-password checking, rate limits on auth paths, and minimal authenticated shells for the
three portals.

**Invite lifecycle** — 32-byte token, only its SHA-256 digest stored, 72h single-use. Unknown,
redeemed, expired and malformed tokens all collapse to one generic response (no enumeration).
Role comes from the invite row, never the form. An invite mailed to an address that already has
an account links the role and burns the token but does **not** set a password — otherwise any
invitation becomes a takeover of whatever address it was sent to.

**Three defects worth recording:**
- **`proxy.ts` at the repo root is silently ignored when the app lives in `src/`.** The spec said
  root; it 404'd on nested paths instead of redirecting. Found by probing a nested route rather
  than trusting that the file was picked up.
- **`config.toml` had TOTP enrol and verify disabled**, so `mfa.enroll()` returned 422 and no
  staff account could ever reach aal2. The MFA gate would have passed its own test by locking
  the building.
- **The existing isolation tests were partly vacuous.** The seed had exactly one customer and one
  partner company, so every "sees only their own" assertion was equally satisfied by
  `using (true)`. A second homeowner with a portal account and a second partner company with its
  own rep were added, and isolation is now asserted in both directions.

**Invite burn ordering** — compare-and-set on `accepted_at` executed *before* account creation.
The reverse order can mint two accounts from one invitation, and nothing undoes that.

**Checks** — `type-check`, `lint`, `test` (132), `build` all exit 0 with `ƒ Proxy` registered;
`supabase test db` **483/483**; six marketing routes still static; the service-role key appears
in zero files under `.next`.

---

## Phase 2 — Marketing site + public intake ✅ (perf gate: see below)

**Shipped**
- All six routes ported from the prototypes, copy verbatim, every route prerendering static.
  Sticky blurred header with a mobile drawer (transition, scrim, scroll lock with scrollbar
  compensation, `inert`, focus trap, hamburger morph), footer, hero with three crossfading
  clips, `ImageSlot` placeholders, SEO (per-page metadata, sitemap, robots, LocalBusiness
  JSON-LD), and a branded 404.
- Public form pipeline proven end to end against the local stack: Turnstile verified
  server-side and failing closed, per-IP **and** per-email rate limits through the database
  limiter, zod validation shared client/server, private-bucket uploads with UUID filenames,
  a transactional intake with compensating rollback, and an email outbox that degrades
  gracefully with no Resend key. Verified by creating a real claim (`CMG-2026-0003`) with
  claimants, consents and a stored document, plus reproduced rate-limit, Turnstile and
  file-type/size rejections.
- Assets: three hero clips transcoded 47MB/4K → 2.33MB total; favicon 35KB → 4.7KB.

**The two design gates — 10 rounds, ~20 independent critics**

Every round used fresh-context critics that never saw the builder's reasoning, comparing
real rendered pages: Lens A against the prototypes, Lens B against live screenshots of
Stripe, Linear and Vercel.

| | R1 | R2 | R3 | R4 | R5 | R6 | R7 | R8 | R9 | R10 |
|---|---|---|---|---|---|---|---|---|---|---|
| **Lens A** majors | 4 | 2 | 2 | 0 | 1 | 1 | 1 | 1 | **0** | **0** |
| **Lens B** rank / majors | 4th, major | 4th, major | 4th, major | 4th, major | 3rd, **none** | 3rd, **none** | — | — | — | — |

Both converged: Lens A on two consecutive clean rounds, Lens B on two consecutive rounds
with no major gap, ranked 3rd of 4 — ahead of Vercel.

**What the gates actually caught** — findings no amount of self-review would have produced:
- **The invalid form-field border never rendered.** `INVALID_CLASS` and `border-ink/16` had
  identical specificity and `cx()` is a bare join with no tailwind-merge, so stylesheet emit
  order won. A user failing validation on the 25-field intake saw no field-level signal at
  all. The same audit found three more silently-dead overrides.
- **The intake shipped two required questions pre-answered "No"**, including "Have you ever
  filed a claim for the roof at this property?" — on a Letter of Representation intake, where
  `required` could never fire and the conditional follow-up never surfaced.
- **The header sat off the content spine.** No `max-width`, so the same logo component rendered
  at x=56 in the header and x=88.5 in the footer, drifting unboundedly to ~272px at 1920.
- **The interior page glow was missing from two of five routes** — a seam between two agents
  that built those pages in the same wave.
- Two text tiers below WCAG AA; the LCP element absent from the prerendered HTML entirely.

**Three conflicts had to be arbitrated** where fidelity and craft genuinely disagreed. The
testimonial measure went to craft (the prototype's `30ch` sat on a figure where `ch` resolved
against a 15px size nothing in it renders at — a mockup bug, not an editorial choice). The
closing-CTA alignment and the `/about` region grid went to fidelity. Each is documented in
code with a one-line revert.

**Checks** — `type-check`, `lint`, `test` (132), `build` all exit 0; `supabase test db` 429/429;
six routes static; no console errors; no horizontal overflow at 390.

**Performance gate** — accessibility **100** on Home (≥95 required ✅). Performance did not
reach 85 on this machine; see `docs/temp/BLOCKERS.md` for the measured numbers, the calibrated
controls, and the honest split between host contention and real remaining work.

---

## Phase 1 — Local Supabase + schema ✅

**Shipped**
- 18 tables, 13 enums, `claim_ref` per-year sequence (`CMG-YYYY-NNNN`), status-transition
  trigger enforcing the §5 lifecycle including the `lor_signed`-requires-a-document gate,
  `check_rate_limit()`, audit triggers, the partner projection table, and a private
  `claim-docs` bucket. RLS deny-by-default on every table.
- Deterministic seed: one user per role, a partner company, two demo claims at different
  lifecycle stages.
- **429 pgTAP assertions across 9 files**, all green on a clean `supabase db reset`.

**Schema review gate — 4 independent rounds, 14 majors found and fixed**

Every round used a fresh-context reviewer that never saw the builder's reasoning. The builder's
own verification had declared round 1's schema sound; the reviewer reproduced nine real holes
against the live database.

| Round | Majors | Notable finds |
|---|---|---|
| 1 | 9 | Adjusters read every unassigned claim's PII/documents; customers could rewrite their own consent snapshots; rate-limit budgets defeated by window collision; client-direct storage bypassed the audited signed-URL path; adjusters could re-attribute a claim to any partner company |
| 2 | 3 | *All introduced by round 1's fixes.* Owner could never delete a consent-bearing claim (failed only for real users — passed under service-role testing); a deactivated owner could re-enable themselves |
| 3 | 2 | Three-valued-logic bypass in `reassign_claim`: `if not can_manage_claim(...)` where the helper returns NULL for deactivated accounts, so `NOT NULL` isn't TRUE and control fell through to the UPDATE — proven end-to-end over HTTP with a deactivated account |
| 4 | **0** | Gate converged. 10 genuine minors, fixed in a cleanup pass |

The pattern worth recording: rounds 2 and 3 found defects *created by the previous round's
fixes*, and two of them passed service-role testing while failing for real users. A single
review pass would have shipped all of them.

**Recovered after a session disconnect** — the round-4 cleanup had landed its test file and
rewritten comments but not the one-line FK change they described (`profiles.partner_company_id`
still `on delete set null` where the test asserted `on delete restrict`). The failing assertion
named the discrepancy precisely, which is what a non-vacuous suite buys.

**Checks** — `supabase db reset` clean, `supabase test db` 429/429, plus `type-check`, `lint`,
`test`, `build` all exit 0.

---

## Phase 0 — Repo bootstrap ✅

**Shipped**
- Git repo initialized on `develop`; handoff bundle committed, then branched to
  `feature/claims-platform`.
- Prototypes relocated to `design/prototypes/` (relative asset refs intact, so they still
  render standalone for the fidelity gate). Root now belongs to the Next.js app.
- Next.js 16.3.0 + React 19.2.8 + TypeScript 6.0.3 (strict) + Tailwind v4.3.3 scaffold,
  written by hand because `create-next-app` refuses a non-empty root.
- Design tokens ported into `@theme` in `src/app/globals.css` — values verbatim from the
  prototypes' page-level `:root` override, plus hero keyframes and reduced-motion handling.
- Vitest 4 wired (3 passing tests), ESLint flat config, GitHub Actions CI, `.env.example`
  documenting every environment variable the platform will need.

**Checks** — all exit 0: `type-check`, `lint`, `test` (3/3), `build` (3 static routes).

**Dependency reality vs. plan** — three version assumptions broke and were corrected against
the registry rather than guessed around:
- TypeScript 7.0.2 is `latest`, but **typescript-eslint does not support TS 7**. Pinned to
  **6.0.3**, the newest release inside typescript-eslint's `>=4.8.4 <6.1.0` peer range.
- ESLint 10.8.1 is `latest`, but `eslint-plugin-react` (bundled inside `eslint-config-next`
  16.3.0) calls a context API ESLint 10 removed. Pinned to **9.39.5**.
- `eslint-config-next` 16.3 ships native flat config, so `FlatCompat` wrapping produced a
  circular-structure crash. Its exports are spread directly instead.

**Environment note** — the repo path contains a space (`- Customers`), which breaks Vitest's
default `forks` pool on Windows (worker bootstrap times out at 60s). Config uses
`pool: "threads"`.

**Open questions** — none blocking. Owner-gated items (PandaDoc account, Resend key, real
Turnstile keys, hosted Supabase, Vercel, GitHub remote) are tracked for Phase 9 handoff.
