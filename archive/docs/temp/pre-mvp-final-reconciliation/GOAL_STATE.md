# Goal state — remaining CMG claims-platform work

Last reconciled: 2026-08-12
Branch: `feature/claims-platform`
Starting commit for this continuation: `1bb7fb6`

This is the durable resume ledger for `docs/temp/REMAINING_GOAL_SPEC.md`. The
codebase and Git history remain the source of truth; verify both before trusting
this file after any interruption.

## Current position

- Stage 1 — Functional and backend completion: **in progress**
- Current sequence: **feature-first completion before consolidated stabilization**
- Exact next action: finish source modularity, validate deployment cron/runbook
  configuration, then run one comprehensive safety, functional, database,
  production-build, and browser stabilization pass. Optional visual gauntlets
  and repeated review loops are deferred.
- No Stage 1 packet has yet been checkpointed by this continuation run.

## Verified baseline

- Branch was `feature/claims-platform` at `1bb7fb6` with no tracked changes.
- `docs/temp/REMAINING_GOAL_SPEC.md` is the new detailed execution authority and
  was untracked when this continuation began.
- Prior independent audit verified: type-check, lint, 597 unit tests, production
  build, 691 pgTAP assertions, and `npm audit` all passed.
- Existing open evidence: CSP remains report-only; comparable mobile Lighthouse
  performance remains below the required floor; admin/customer/partner/cohesion
  craft gates and backend convergence remain open.

## Packet ledger

### Stage 1 — Functional and backend completion

- [x] 1A Storage cleanup worker — fresh review round 1: `VERDICT: MAJORS
  REMAIN`; both majors fixed. Fresh review round 2: `VERDICT: NO MAJORS`.
  Verified: clean database reset; packet Vitest 14/14; full pgTAP 716/716;
  type-check and targeted lint passed. Minor retained for stage review: the
  route's per-run `dead` count excludes expired-final-lease terminalizations,
  though their database state and total claim/transition bound are correct.
- [x] 1B PandaDoc webhook and outbox reliability — review rounds 1–3 returned
  `VERDICT: MAJORS REMAIN`; crash-effect, audit, settlement, enqueue-fault,
  response-budget, and lease-overlap majors were fixed. Fresh round 4:
  `VERDICT: NO MAJORS`. Verified: clean migration reset; targeted final Vitest
  58/58 (plus earlier invitation/action regressions); full pgTAP 731/731;
  type-check and targeted lint passed. Minor retained for Stage review: invite
  supersession/new-invite/outbox persistence spans separate statements.
- [x] 1C Public-action ordering, renderer guard, carrier/loss-time invariants —
  fresh review: `VERDICT: NO MAJORS`. Verified: type-check; focused unit tests
  26/26; focused lifecycle pgTAP 9/9 before two additional blank-string
  assertions; targeted lint and diff check passed. A later clean full run exposed
  that tab-only policy values bypassed one-argument `btrim`; the constraint now
  requires a POSIX non-whitespace character and awaits clean-reset reproof.
- [x] 1D Pagination, dead storage helpers, non-brittle pgTAP fixtures — review
  rounds 1–5: `VERDICT: MAJORS REMAIN`; fail-open/null-page handling,
  generated search types, missed collection/embed reads, seed-global pgTAP
  literals, and touched-file line caps were fixed. Fresh round 6: `VERDICT: NO
  MAJORS`. Verified: exhaustive persisted read inventory; 1,001-row and
  query-shape regressions; full unit suite 639/639; clean database reset; full
  pgTAP 740/740; type-check and lint. Final extraction checks passed 33/33 and
  all ordinary Packet 1D source modules are <=450 lines.
- [x] 1E Admin e-sign status and recovery UX — accurate states, authorized
  initial/retry/manual actions, one-shot serialized dispatch attempts,
  attempt-token/current-document webhook guards, persisted recipient progress,
  and CAS-protected PDF/lifecycle finalization. Verified: type-check, build,
  focused non-DB 71/71, live supersession 4/4, corrected schema/security pgTAP
  123/123 on a clean reset.
- [x] 1F Settings truthfulness and diagnostics — genuine 10% fee starting
  value when a claim has no recorded fee; exact PandaDoc role/token/env
  contract and truthful deploy/code edit locations; no fake controls. Verified:
  focused tests 27/27, type-check, targeted lint, diff check.
- [x] 1G Partner claim detail, feed, and company profile — paginated list and
  navigation, projection-only detail/milestones, caller-RLS partner/shared
  activity, read-only own-company profile, settlement gating, and complete
  loading/empty/error/not-found states. Verified: type-check, focused unit 4/4,
  two-company/security pgTAP 18/18, scoped lint, diff check.
- [x] 1H Source-file modularity and oversized test/SQL splits — all handwritten
  source/tests under `src` and `supabase/tests` are <=450 LOC; generated DB
  types exempt. Original oversized SQL suites preserved under archive; exact
  statement sequences and plans retained. Verified: focused Vitest 41/41,
  focused pgTAP 398/398, type-check, focused lint, global LOC audit, diff check.
- [ ] Stage 1 fresh review, Level C verification, documentation reconciliation,
  and checkpoint commit

### Stage 2 — Architecture convergence

- [ ] Fresh schema/RLS review loop converged
- [ ] Fresh backend review loop converged
- [ ] Authorization matrix and browser role-boundary evidence complete
- [ ] Level C verification, documentation reconciliation, and checkpoint commit

### Stage 3 — Craft, cohesion, CSP, and performance

- [ ] Admin craft gate converged
- [ ] Customer portal craft gate converged
- [ ] Partner portal craft gate converged
- [ ] Cross-surface cohesion gate converged
- [ ] CSP deliberately resolved and browser-verified
- [ ] Comparable mobile Lighthouse floors met and evidenced
- [ ] Level C verification, documentation reconciliation, and checkpoint commit

### Stage 4 — Launch preparation and final reconciliation

- [ ] Vercel cron configuration and deploy runbook complete
- [ ] HANDOFF/BLOCKERS/ROADMAP/PROGRESS/CONTINUATION reconciled
- [ ] Final complete verification and evidence inventory complete
- [ ] Final checkpoint commit created without push, PR, merge, deploy, or hosted
  resource creation

## Guardrails and known owner-only inputs

- Never push, merge, deploy, open a PR, or create paid/hosted resources.
- Never delete files; archive obsolete material.
- Builders do not review their own work; required reviews use fresh context.
- Browser verification uses chrome-devtools MCP, never Playwright.
- Owner-only launch inputs currently include production photographs, real
  Turnstile credentials, hosted Supabase/plan settings, Resend/domain setup,
  PandaDoc account/template/webhook credentials, deployment credentials, and
  business/legal copy confirmations described by the authoritative spec.

## Interruption protocol

Before stopping unexpectedly, replace the “Exact next action” line above with one
specific command, file, test, or review brief that resumes the first incomplete
packet. Never mark a packet complete until its required implementation, tests,
independent review, and packet verification are all present.
