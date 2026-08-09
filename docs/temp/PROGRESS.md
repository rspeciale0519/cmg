# Build Progress — CMG Property Solutions

Live log for the autonomous build. Newest first. Roadmap:
[`docs/ROADMAP.md`](../ROADMAP.md) · Blockers: [`BLOCKERS.md`](BLOCKERS.md)

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
