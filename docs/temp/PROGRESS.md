# Build progress — CMG Property Solutions

Newest first. Detailed final evidence is in `GOAL_STATE.md`; owner acceptance
and production setup are in `HANDOFF.md` and `BLOCKERS.md`.

## 2026-08-13 — Stage 3 craft and cohesion converged

- Admin and customer each finished with two consecutive `MINOR GAPS ONLY`
  verdicts; partner finished with three consecutive `MINOR GAPS ONLY` verdicts.
- All-surface cohesion across marketing/admin/customer/partner converged with
  `MINOR GAPS ONLY`, then `MINOR GAPS ONLY` at exact 390 and 1440 CSS widths.
- Added semantic admin claim cards below `xl`, persistent customer claim
  navigation, compact consent disclosures, trustworthy office-contact labels,
  password-manager metadata, and bounded mobile navigation rails.
- Two comparable mobile simulated Lighthouse navigation runs scored 93/100
  and 90/100 (performance/accessibility); lower scores clear the 85/95 floors.
- Enforcing nonce CSP and representative Chrome consoles passed without CSP
  violations. Evidence and screenshots live under `docs/temp/evidence/stage3`
  and `docs/temp/media/progress`.
- Level C passed: type-check, lint, 725 Vitest tests, build, clean 21-migration
  reset, 915 pgTAP assertions, zero dependency vulnerabilities, zero client
  secret-name hits, source-size cap, and diff check.

## 2026-08-13 — Stage 2 architecture converged

- Verbatim final fresh-review verdicts: `NO MAJORS`, then `NO MAJORS`.
- Repaired atomicity and durability across public PII submissions, intake
  acceptance, required audits, invitation issue/accept/recovery, and failed
  upload cleanup. Exact-path pre-upload intents now close process-crash and
  compensation gaps without permitting a cleanup worker to delete a committed
  document.
- Hardened server-owned webhook dedupe keys and e-sign lease tokens. The admin
  claims list now uses a fixed, token-free, AAL2/active-staff projection with
  consistent search, exact filtered counts, and bounded keyset pagination.
- Closed the final nullable-owner guard bypass: AAL1, deactivated, and
  missing-profile callers are denied by a total predicate; an AAL2 active owner
  remains the positive control.
- Final checkpoint evidence: type-check passed; full lint passed; 71 Vitest
  files / 718 tests passed; production build passed; clean reset applied 21
  migrations through `20260815220000`; 31 pgTAP files / 915 assertions passed;
  dependency audit found zero vulnerabilities; built-client secret-name scan
  found zero hits.
- Production-mode Chrome smoke passed for marketing, customer, partner, and
  owner/AAL2 claims list. Enforcing nonce CSP and security headers were present;
  no application console errors were observed. The only browser warning was
  the existing non-blocking logo-image preload notice.
- Nothing was pushed, merged, deployed, or connected to a hosted resource.
- Stage 2 checkpoint commit: `9419994` (`feat(stage-2): converge architecture
  and authorization`).

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

## 2026-08-13 — Stage 2 architecture convergence round 1

- Verbatim fresh-review verdict: `MAJORS REMAIN`.
- The review found atomicity/durability defects in intake acceptance, public PII
  submissions, failed-upload cleanup, required explicit audits, and invite
  provisioning recovery. The separate authorization audit also found that
  authenticated writes could supply internal external-event keys and that
  claim reads exposed server-only e-sign lease tokens.
- A single bounded repair packet is active with additive database boundaries,
  fault/concurrency regressions, and the missing deactivated-staff/e-sign grant
  matrix cells. A new critic will review the corrected scope; no finding is
  waived.
