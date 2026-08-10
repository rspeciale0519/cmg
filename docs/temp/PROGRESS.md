# Build Progress — CMG Property Solutions

Live log for the autonomous build. Newest first. Roadmap:
[`docs/ROADMAP.md`](../ROADMAP.md) · Blockers: [`BLOCKERS.md`](BLOCKERS.md)

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
