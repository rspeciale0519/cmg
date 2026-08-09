# Build Progress — CMG Property Solutions

Live log for the autonomous build. Newest first. Roadmap:
[`docs/ROADMAP.md`](../ROADMAP.md) · Blockers: [`BLOCKERS.md`](BLOCKERS.md)

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
