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

- Read the sources that apply to the current task.
- Current code, tests, manifests, and configuration override old documentation.
- Use `README.md` for setup and production deployment.
- Use `docs/RELEASE_STATE.md` for the current release state, open pull requests, migration heads, and open gates.
- Use `docs/ROADMAP.md` for design direction and history.
- Use `docs/temp/HANDOFF.md` for engineering evidence and browser acceptance.
- Use `docs/temp/BLOCKERS.md` for owner-only decisions.
- Use `docs/RETENTION.md` for data-retention requirements.
- Treat `.claude/plans/feature-claims-platform.md` as design history when current evidence disagrees.

## Task scope and skills

- Select skills for the requested operation, not only for a shared technology name.
- Load supporting skill documents when the current task needs them.
- Follow the global browser-tool order when browser skills suggest different tools.
- Continue authorized local work through implementation, required checks, and fixes for failures caused by the change.
- Stop at completion, a genuine blocker, or an action that requires approval under the global agreement.

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

## Database changes

- Add a timestamped migration for every schema or policy change.
- Do not edit an existing migration.
- Keep migrations forward-safe and provide a recovery path.
- Add or update pgTAP tests for schema, RLS, role, trigger, or function changes.
- Keep TypeScript and database enforcement aligned.
- Regenerate `src/types/database.ts` with `npm run db:types`.
- Do not hand-edit `src/types/database.ts`.
- Confirm disposable local data and obtain explicit reset approval before `npm run db:reset`.
- Follow the isolation safeguards in `README.md` when the local database contains retained acceptance data.

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

- Use `package.json` for command definitions and `README.md` for local setup and command usage.
- The default application port is 3000. A launcher can select another free port.
- Local Supabase uses the 15420 through 15429 host-port block.

## Completion checks

- For documentation-only or comment-only changes, verify references and facts against current sources. Run `git diff --check`.
- For application changes, run affected tests, then `npm run type-check`, `npm run lint`, `npm test`, and `npm run build`.
- For database, authentication, or storage changes, also run `npm run db:reset` and `npm run db:test` after reset approval.
- If reset approval or a disposable database is unavailable, report the database checks as incomplete.
- Run the database-backed Vitest selection in `.github/workflows/ci.yml` for affected e-signature, webhook, cleanup, or partner-directory work.
- For dependency or release changes, run `npm audit --audit-level=high`.
- Test affected application behavior in `SITE_MODE=simple`, `SITE_MODE=staff`, and `SITE_MODE=platform`.
- For UI changes, check affected routes at desktop width and 390px.
- Check the relevant roles, site modes, loading states, errors, console, and network requests.
- Repeat successful checks only when later changes or unresolved concerns affect their validity.
- Report all skipped credential-dependent checks.
- Do not report a green result while local checks or required CI checks fail.

## Git and deployment

- Base project branches on `develop`.
- Target project pull requests at `develop`.
- GitHub Actions currently checks pull requests and pushes for both `develop` and `main`.
- Skill defaults, including `fullpush`, do not authorize staging unrelated files or promoting `develop` into `main`.
- Keep separate authorization for each Git action under the global agreement.
- Follow the production runbook in `README.md`.
- Do not encode temporary commit IDs, test totals, migration heads, preview URLs, or local test ports here.
