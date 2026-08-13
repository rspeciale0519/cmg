# CMG continuation goal state

Last reconciled: 2026-08-13
Branch: `feature/claims-platform`
HEAD before Stage 2 checkpoint: `fc52969`

## Current position

- Stage 1 — Functional and backend completion: **complete**
- Stage 2 — Architecture convergence: **complete; two consecutive `NO MAJORS` rounds**
- Current packet: Stage 2 checkpoint documentation and commit
- Stage 1 final fresh correction verdict: `NO FINDINGS`.
- Review sequence was evidence-driven: initial `MAJORS REMAIN` found the
  PandaDoc lease race; successive fresh reviews caught post-send unlock,
  reconciliation liveness/lifecycle, failure-effect, per-attempt dedupe, and
  line-cap defects. Each was fixed with regressions. The final reviewer found
  no remaining material or minor defect in the corrected scope.
- Next exact action: create the Stage 2 checkpoint, then begin Stage 3 live craft,
  cohesion, CSP, and mobile Lighthouse work.
- Supabase was reset after the latest schema change: **yes** — all 21 migrations
  through `20260815220000_accept_intake_owner_guard.sql` replayed cleanly.
- Staff MFA after the latest reset: **re-enrolled locally** for owner browser
  evidence at `http://localhost:3011`; another reset will require enrollment.

## Packet ledger

- [x] 1A storage cleanup worker and retention truthfulness
- [x] 1B crash-safe webhook/outbox/invitation reliability
- [x] 1C public action ordering, renderer guard, and lifecycle invariants
- [x] 1D exhaustive pagination/search, helper retirement, isolated pgTAP
- [x] 1E actionable admin e-sign state and recovery
- [x] 1F settings reconciliation and fee default
- [x] 1G partner detail/activity/profile/referral experience
- [x] 1H repository-wide handwritten source/test modularity
- [x] Integrated fresh review converged — final correction verdict `NO FINDINGS`
- [x] Stage 1 Level C verification
- [x] Current-build customer/partner/staff browser evidence after the final reset
- [x] Stage 1 documentation reconciliation
- [x] Stage 1 checkpoint commit — `7a21209`

Packets 1A–1H and their converged e-sign correction are checkpointed together at
`7a21209`. Historical phase commits through `1bb7fb6` remain intact.

## Latest verification

- `npm run type-check`: pass
- `npm run lint`: pass
- `npm test`: 70 files / 712 tests pass
- `npm run build`: pass
- clean `npx supabase db reset`: pass, 18 migrations
- `npx supabase test db`: 25 files / 787 assertions pass
- `npm audit --audit-level=high`: zero vulnerabilities
- `.next/static` server-secret-name scan: zero hits
- production headers/CSP: enforcing nonce CSP, all 12 scripts nonced
- Chrome after the final reset: customer claim overview, partner list/detail/
  activity/profile with settlement privacy, and owner MFA/admin dashboard passed;
  durable observations are in `docs/temp/evidence/stage1/browser-evidence.md`
- `git diff --check`: pass

## Stage 2 review ledger

- Round 1 verdict: `MAJORS REMAIN`.
- Material findings: non-atomic intake acceptance; non-transactional public PII
  writes with unreliable rollback; upload compensation that can leave unqueued
  sensitive bytes; swallowed required audit failures; stranded auth users after
  invite provisioning faults; client-writeable internal dedupe keys; and
  client-readable e-sign lease tokens.
- Authorization audit otherwise found substantive coverage for anon, two
  customers, two partner companies, assistant, assigned/unassigned adjuster,
  owner, and below-AAL2 staff. The active packet also adds explicit e-sign
  service-boundary grants, deactivated-staff reads, webhook-completion denial,
  and non-partner profile assertions.
- Subsequent fresh reviews found and drove fixes for permanent cleanup-path
  fencing, invite reservation/supersession recovery, expired-marker recovery,
  token-safe admin claims search, and the nullable owner guard.
- Final convergence verdicts: `NO MAJORS`, `NO MAJORS`.
- Authorization coverage includes anon, two customers, two partner companies,
  assistant, assigned/unassigned adjuster, owner, below-AAL2 staff,
  deactivated staff, and authenticated callers with no profile.
- Stage 2 Level C: type-check pass; lint pass; 718 Vitest pass; build pass;
  clean reset pass; 915 pgTAP pass; audit 0; client secret-name scan 0; enforcing
  CSP/headers pass; marketing/customer/partner/owner browser smoke pass.

## Open required stages

1. Stage 3 admin/customer/partner craft convergence, all-surface cohesion,
   enforcing CSP confirmation, and two comparable mobile Lighthouse runs with
   lower performance ≥85 and accessibility ≥95; Level C and checkpoint.
2. Stage 4 truthful final launch documentation, final Level C/browser evidence,
   and checkpoint.

The prior MVP-only handoff incorrectly called the mandatory Stage 2/3 review,
craft, cohesion, and Lighthouse gates optional. Those documents must be
reconciled before the relevant checkpoint; they do not redefine the persistent
goal.

## Owner-only blockers

Production Supabase/plan/backups, Vercel/env/domain/TLS, Resend/DNS, real
Turnstile keys, PandaDoc credentials/templates if electronic signing is chosen,
authentic photos, business/legal copy approval, and push/merge/deploy authority.
These do not block remaining local reviews, craft work, performance work, or
checkpoint commits.

## External-state guardrail

No push, merge, deploy, PR, hosted resource, paid resource, or DNS change is
authorized. Never delete files; archive superseded artifacts.
