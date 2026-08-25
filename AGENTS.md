<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

# CMG Property Solutions

These rules add repository facts to the global working agreement.

## Repository

- This repository contains one application. It is not a monorepo.
- Use Node.js 22 and npm.
- Treat `package-lock.json` as the dependency authority.
- Use `develop` as the default, integration, and production branch.
- The stack is Next.js 16.3, React 19, TypeScript, Tailwind CSS, Supabase, Resend, PandaDoc, and Turnstile.
- Python files under `scripts/` prepare PandaDoc PDF assets.

## Sources of truth

- Current code, tests, manifests, and configuration override old documentation.
- Use `README.md` for setup and production deployment.
- Use `docs/ROADMAP.md` for current product progress.
- Use `docs/temp/HANDOFF.md` for browser acceptance.
- Use `docs/temp/BLOCKERS.md` for owner-only launch actions.
- Use `docs/RETENTION.md` for data-retention requirements.
- Treat `.claude/plans/feature-claims-platform.md` as design history when current evidence disagrees.

## Architecture

- `src/app/` contains marketing, authentication, admin, customer, partner, and API routes.
- `src/components/` contains shared and surface-specific components.
- `src/lib/` contains actions, authorization, validation, Supabase clients, email, storage, and e-signature logic.
- Use the `@/*` alias for imports from `src/`.
- Use existing kebab-case file names, PascalCase components, and camelCase functions.

## Security and data

- Use the user-scoped Supabase client for authenticated data access.
- Keep RLS active as the primary data boundary.
- Use `createAdminClient()` only in server-only system flows that require the service role.
- Protect staff routes and actions with `requireStaff()`.
- Protect owner-only routes and actions with `requireOwner()`.
- Preserve AAL2 enforcement and indistinguishable not-found responses.
- Validate external input with the existing Zod schemas.
- Keep public submission order as rate limit, Turnstile, validation, then persistence.
- Preserve existing atomic RPC, audit, outbox, retry, and storage-cleanup guarantees.
- Keep user-facing failures generic.
- Keep secrets and personal data out of logs, URLs, client code, and error responses.
- Preserve e-signature leases, deduplication, and ambiguous-send protections.
- Test affected behavior in both `SITE_MODE=simple` and `SITE_MODE=platform`.

## Database changes

- Add a timestamped migration for every schema or policy change.
- Do not edit an existing migration.
- Keep migrations forward-safe and provide a recovery path.
- Add or update pgTAP tests for schema, RLS, role, trigger, or function changes.
- Keep TypeScript and database enforcement aligned.
- Regenerate `src/types/database.ts` with `npm run db:types`.
- Do not hand-edit `src/types/database.ts`.
- Confirm that the local database contains disposable data before `npm run db:reset`.

## Files and tests

- Co-locate Vitest files as `*.test.ts` or `*.test.tsx`.
- Put database tests in `supabase/tests/` with numbered `*.test.sql` names.
- Keep live third-party tests explicit and opt-in.
- Do not require `.env.local` during test discovery or CI.
- Check opt-in variables before reading optional environment files.
- Do not edit `.next/`, `node_modules/`, `out/`, `coverage/`, `*.tsbuildinfo`, or `next-env.d.ts`.
- Do not edit `supabase/.branches/` or `supabase/.temp/`.
- Treat `design/` as reference material unless the task explicitly targets it.
- Treat `docs/temp/` as retained project evidence, not disposable scratch data.
- Preserve the managed Next.js block in this file.

## Commands

- Start the local database with `npm run db:start`.
- Start the application with `npm run dev`.
- The default application port is 3000. A launcher can select another free port.
- Local Supabase uses the 15420 through 15429 host-port block.
- Run TypeScript checks with `npm run type-check`.
- Run lint checks with `npm run lint`.
- Run Vitest with `npm test`.
- Run the production build with `npm run build`.
- Reset the local database with `npm run db:reset`.
- Run pgTAP with `npm run db:test`.
- Regenerate database types with `npm run db:types`.
- CI also runs database-backed Vitest suites after starting Supabase.

## Completion checks

- For application changes, run the affected tests first.
- Then run `npm run type-check`, `npm run lint`, `npm test`, and `npm run build`.
- For database, authentication, or storage changes, also run `npm run db:reset` and `npm run db:test`.
- Run the CI database-backed Vitest selection for affected e-signature, webhook, or cleanup work.
- For dependency or release changes, run `npm audit --audit-level=high`.
- For UI changes, check affected routes at desktop width and 390px.
- Check the relevant roles, site modes, loading states, errors, console, and network requests.
- Report all skipped credential-dependent checks.
- Do not report a green result while local checks or required CI checks fail.

## Git and deployment

- Base project branches on `develop`.
- GitHub Actions checks pull requests and pushes for `develop`.
- Follow the production runbook in `README.md`.
- Do not encode temporary commit IDs, test totals, migration heads, preview URLs, or local test ports here.
