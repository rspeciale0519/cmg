# Build progress — CMG Property Solutions

Newest first. Detailed final evidence is in `GOAL_STATE.md`; owner acceptance
and production setup are in `HANDOFF.md` and `BLOCKERS.md`.

## 2026-08-13 — Stage 1 converged and checkpoint-ready

- Final e-sign correction review verdict: `NO FINDINGS`. The converged design
  bounds provider work below its lease, records provider identity before send,
  never auto-retries an ambiguous external send, reconciles only delivery-proof
  webhooks, handles creation failure without a false sent transition, and keys
  operational effects per attempt. The final fresh verdict is `NO FINDINGS`.
- Fresh integrated review verdict: `MAJORS REMAIN`. One blocker was found:
  PandaDoc HTTP/retry work can outlive the 120-second dispatch lease, allowing
  overlapping ownership and duplicate externally sent LORs. A bounded timing
  fix and over-lease regression closed that raw race, but the fresh repair
  review also returned `MAJORS REMAIN`: post-2xx parsing and post-send claim
  persistence could still unlock a sent attempt, and ambiguous sends lacked a
  safe reconciliation path. Those are repaired, but its next fresh review also
  returned `MAJORS REMAIN` because every exact webhook was treated as delivery
  proof, including `document_creation_failed`, which could falsely record a
  sent transition. Typed reconciliation, exact per-attempt effects, and the
  source-size corrections were completed and independently re-reviewed.
- Completed storage cleanup, webhook/outbox durability, public safety and
  lifecycle fixes, exhaustive paging/search, e-sign recovery, settings,
  partner detail/activity/profile, and repository modularity.
- Added enforcing nonce CSP, Vercel schedules for outbox and storage cleanup,
  and a dependency-ordered production runbook.
- Clean migration replay applied all migrations through the partner portal.
- Final automated evidence: type-check, lint, 712 Vitest tests, 787 pgTAP
  assertions, production build, zero high-severity dependency vulnerabilities,
  and zero server-secret names in built client assets.
- Current-build Chrome acceptance after the clean reset covered customer claim
  overview, partner list/detail/activity/profile and settlement privacy, and
  owner MFA/admin. Earlier marketing desktop/390px checks drove fixes for
  localhost CSP redirect upgrading and legacy represented-claim e-sign controls.
- Stage 1 checkpoint commit: `7a21209` (`feat(stage-1): complete functional
  backend continuation`). Nothing was pushed.
- This evidence does not finish the full continuation goal. Stages 2–4 remain
  required.
- No push, PR, merge, deploy, domain/DNS, or hosted/paid resource was created.

Historical progress before reconciliation is preserved at
`archive/docs/temp/pre-mvp-final-reconciliation/PROGRESS.md`.
