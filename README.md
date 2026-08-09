# CMG Property Solutions

Marketing site and secure claims platform for CMG Property Solutions — licensed Florida
public adjusters (Austin Graham, license #G086165).

## Stack

Next.js 16 (App Router) · React 19 · TypeScript 6 (strict) · Tailwind CSS v4 ·
Supabase (Postgres 17, Auth, Storage) · Resend · PandaDoc e-signature · Cloudflare Turnstile

## Getting started

```bash
npm install
cp .env.example .env.local   # fill in values; see notes inside
npm run db:start             # local Supabase via Docker (Docker Desktop must be running)
npm run dev
```

## Scripts

| Script | Purpose |
|---|---|
| `npm run dev` | Development server |
| `npm run build` / `start` | Production build / serve |
| `npm run type-check` | `tsc --noEmit` |
| `npm run lint` | ESLint |
| `npm test` | Vitest unit tests |
| `npm run db:start` / `db:stop` | Local Supabase stack |
| `npm run db:reset` | Re-apply migrations + seed |
| `npm run db:test` | pgTAP suite (RLS and schema) |
| `npm run db:types` | Regenerate `src/types/database.ts` |

## Layout

```
src/app/          routes: marketing, auth, admin, portal, partner, api
src/components/   shared UI
src/lib/          supabase clients, authz, validators, esign, email
supabase/         migrations, seed, pgTAP tests
design/           original Claude Design prototypes (visual source of truth)
docs/             roadmap, PandaDoc reference, progress log, handoff
```

## Documentation

- Design authority: [`.claude/plans/feature-claims-platform.md`](.claude/plans/feature-claims-platform.md)
- Roadmap: [`docs/ROADMAP.md`](docs/ROADMAP.md)
- Progress log: [`docs/temp/PROGRESS.md`](docs/temp/PROGRESS.md)
- PandaDoc integration: [`docs/reference/pandadoc/`](docs/reference/pandadoc/README.md)
