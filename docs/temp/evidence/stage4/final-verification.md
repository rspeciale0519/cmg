# Stage 4 final verification evidence

Recorded 2026-08-13 on `feature/claims-platform`. No push, PR, merge, deployment,
hosted resource, paid resource, or DNS change was made.

## Automated gates

- `npm run type-check`: pass.
- `npm run lint`: pass.
- `npm test`: 75 files / 725 tests pass. One first run exposed an invalid
  concurrency-test fixture path; the fixture now uses the claim-owned path
  required by the production constraint, the focused 4-test suite passed, and
  the complete rerun passed.
- `npm run build`: pass on Next.js 16.3 production output.
- `npm run db:reset`: pass; 21 migrations through `20260815220000` plus the
  disposable development seed replayed cleanly.
- `npm run db:test`: 31 files / 915 assertions pass.
- `npm audit --audit-level=high`: zero vulnerabilities.
- built-client server-secret-name scan: zero hits.
- handwritten TS/TSX source/application tests over 450 lines: zero.
- `git diff --check`: pass.

## Production browser and operational smoke

- Marketing `/contact` at exact 390px: Turnstile test widget hydrated; empty
  submission produced an announced two-field summary, marked both fields,
  focused `name`, preserved zero document overflow, and logged no console issue.
- Customer after the final reset: seeded login reached the claim overview with
  My claim, Overview, Activity (5), and Documents (2); zero overflow.
- Partner after the final reset: seeded login reached two referred claims and
  all list/refer/profile navigation; zero overflow.
- Owner after the final reset: login was stopped at the MFA gate, a fresh local
  TOTP factor was enrolled, and the AAL2 dashboard plus Admin Settings loaded.
- Admin Settings truthfully reported local Supabase, Resend unconfigured,
  Turnstile test keys, and the secured Manual e-sign provider/fallback. The only
  console message was the known non-blocking logo preload warning.
- Cron auth: missing outbox bearer = 401; wrong cleanup bearer = 401; configured
  local bearer returned 200 for both bounded sweepers.
- CSP/headers and Lighthouse evidence are in the Stage 3 evidence directory.

## Deployment readiness

- `vercel.json` schedules `/api/cron/outbox` every five minutes and
  `/api/cron/storage-cleanup` hourly at minute 17.
- Both cron routes export `maxDuration = 60`; PandaDoc webhook exports
  `maxDuration = 15`.
- The root README is the dependency-ordered deployment, smoke, rollback, and
  dead-row monitoring runbook.
- `HANDOFF.md` is the owner acceptance checklist; `BLOCKERS.md` contains only
  owner-controlled external actions and decisions.
