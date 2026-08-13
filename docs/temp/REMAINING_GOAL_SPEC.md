# CMG Claims Platform — Remaining Goal Specification

## Objective

Finish the existing CMG Property Solutions claims platform from its current state. Do not restart, re-scaffold, or reproduce completed work. This is a resumable four-stage continuation. Do not claim completion until every final exit criterion below is met.

## Authority and baseline

Read before acting:

1. `AGENTS.md`
2. `.claude/plans/feature-claims-platform.md`
3. `docs/temp/AUTOPILOT_SPEC.md`
4. `docs/temp/CONTINUATION.md`
5. `docs/temp/HANDOFF.md`
6. `docs/temp/BLOCKERS.md`
7. `docs/temp/PROGRESS.md`
8. `docs/ROADMAP.md`
9. `docs/RETENTION.md`

Inspect Git and the current tree. Code and Git override stale documentation.

Audited baseline on 12 August 2026:

- Expected branch: `feature/claims-platform`
- Audited HEAD: `1bb7fb6`, or a later descendant
- The branch has an origin and was already pushed; do not push again
- Type-check, lint, production build, 597 unit tests, 691 pgTAP assertions, and `npm audit` passed
- Customer portal, partner referral list, and authentication/MFA gating worked live
- Marketing accessibility was 100
- Comparable mobile Lighthouse performance remains below the required floor
- CSP is Report-Only
- Phase 6 is functionally incomplete despite the continuation brief

Do not re-prove unchanged baseline work before identifying the current incomplete packet.

## Durable resume protocol

Create and maintain `docs/temp/GOAL_STATE.md` containing:

- Current stage and work packet
- Completed packets and commit hashes
- Last verification results
- Open findings and owner-only blockers
- Next exact action
- Whether Supabase was reset after the latest schema change
- Whether staff MFA must be re-enrolled

At every resumed run, read it, verify it against Git, and resume the first incomplete packet. Update it after each packet, review verdict, checkpoint, and before stopping. Do not repeat a completed review unless its reviewed scope changed.

## Operating rules

- Work only on `feature/claims-platform`.
- Never push, merge, deploy, open a PR, or create hosted/paid resources.
- Never delete files; move obsolete items to root `archive/`.
- Preserve prototypes, original media, and unrelated user changes.
- Use chrome-devtools MCP for browser testing; never Playwright; leave the browser open.
- Check ports before starting a server.
- Read relevant installed Next.js 16 documentation before framework-sensitive changes.
- Keep TypeScript strict, introduce no `any`, and use Zod at external boundaries.
- Keep RLS as the authorization boundary and service-role code in `server-only` modules.
- Do not weaken or game tests, reviews, screenshots, security controls, or performance gates.
- Do not classify owner-independent engineering as a blocker.
- Handwritten TypeScript/TSX source and application test files must be at most 450 physical lines. Generated types are exempt. Split oversized SQL tests. Use additive migrations if any migration has reached a hosted environment.

## Subagents and reviews

Delegate substantial exploration, implementation, and every critique/review to subagents when available. Builders never review their own work. Reviewers and critics must be fresh-context agents with self-contained briefs, actual artifacts, known deliberate behavior, and explicit evidence requirements. Parallel edits must use disjoint files; follow parallel UI work with a fresh smoothing pass.

A finding requires a cited source line, database object, DOM/screenshot fact, test reproduction, or measurement. Preserve verbatim gate verdicts in the transcript and summarize them in `PROGRESS.md` and `GOAL_STATE.md`. If fresh-agent capacity is unavailable, persist state and resume the independent review later rather than self-approving.

## Verification levels

After a focused edit: targeted tests, relevant pgTAP if SQL/RLS changed, and type-check.

After each packet: type-check, lint, unit tests, build, applicable pgTAP, and relevant live browser flow.

At every stage checkpoint and final verification:

1. `npm run type-check`
2. `npm run lint`
3. `npm test`
4. `npm run build`
5. `supabase db reset`
6. `supabase test db`
7. `npm audit`
8. Secret-name grep of `.next/static`
9. Production-mode header verification
10. Representative browser smoke tests

Run database reset before final staff browser evidence, then re-enroll seeded staff MFA. A stage cannot pass with any failed checkpoint command.

## Stage 1 — Functional and backend completion

Complete packets in order.

### 1A — Storage cleanup

Build a CRON_SECRET-protected, service-role worker for `storage_cleanup_queue`. Atomically claim a bounded batch, prevent duplicate processing, delete only the exact queued object, mark processed only after success, record attempts and bounded retries, treat already-missing objects idempotently where safe, and add unit plus real-database tests. Make `RETENTION.md` match reality.

### 1B — Webhook and outbox reliability

- Make PandaDoc deduplication crash-safe while preserving concurrent dedupe.
- Give cron delivery explicit `maxDuration`, bounded batch size, and safe limited concurrency.
- Make invite and webhook enqueue failures honest, durable, and recoverable.
- Use trimmed `resendApiKey()` at every deliverability decision.
- Add fault-injection tests for crashes, enqueue failures, timeout-sensitive batches, and duplicates.

### 1C — Public actions and renderer

- Rate-limit intake/contact before Turnstile; test that refused requests spend no verification.
- Guard notification template lookup and safely reject unknown/prototype-chain names.
- Test owner, assigned-adjuster, and refusal paths for `issueClaimantInvite`.
- Drop the fabricated noon default from `claims.loss_time`.
- Enforce lifecycle-required carrier/policy invariants without blocking incomplete partner referrals.

### 1D — Pagination and dead code

- Inventory every growing PostgREST read and add explicit bounds or pagination; no silent 1,000-row truncation.
- Add 1,001-row or query-shape boundary tests.
- Wire the unused storage authorization helpers or archive them with their obsolete tests/documentation.
- Convert pgTAP tests relying on global absolute counts to isolated/relative assertions.

### 1E — Admin e-signature state

Render accurate admin states for manual pending, sent, viewed, recipient completed, completed, declined, voided, expired, and creation failed. Failure states must not merely say “LOR sent.” Provide authorized retry/manual fallback and tests.

### 1F — Settings reconciliation

Compare Settings with the design authority. Implement genuine application settings; for deliberate code/environment configuration, document why and where it changes. Leave no silent scope mismatch.

### 1G — Partner portal completion

Implement partner claim detail, navigation from the list, projection-only summary/milestones, caller-RLS partner/shared activity feed, read-only company profile, pagination, and loading/error/empty/unauthorized states.

Prove via pgTAP and browser evidence that reps see only their company, only permitted events, no documents, policy numbers, claimant contact data, or premature financial data; settlement appears only when allowed.

### 1H — Source modularity

Scan the entire tree and split every oversized handwritten source/test file, including `claims.ts`, admin claims page, `intake-queue.ts`, and `referral.test.ts`, without behavior changes.

Stage 1 exits only when packets 1A–1H, Level C verification, representative customer/partner/staff flows, documentation updates, and a checkpoint commit are complete.

## Stage 2 — Architecture convergence

Give a fresh reviewer the actual server actions, authz/RLS, storage, webhook, outbox, public-write, audit, partner projection, and event artifacts. Review authorization, service-role scope, validation, transactions, idempotency, crash recovery, concurrency, storage consistency, notification loss/duplication, audit, bounded reads, PII, and outward errors.

Verdict must be verbatim: `MAJORS REMAIN`, `NO MAJORS — MINORS REMAIN`, or `NO FINDINGS`. Fix every major with a regression test and re-review using a new critic.

Convergence requires two consecutive no-major rounds, or three consecutive rounds containing only critic-rated minors.

Extend and run the authorization matrix for anon, two customers, two partner companies, assistant, assigned/unassigned adjusters, owner, below-AAL2 staff, and deactivated staff, including new cleanup and partner objects.

Stage 2 exits only after convergence, Level C verification, documentation, and checkpoint commit.

## Stage 3 — Craft, cohesion, CSP, and performance

For admin, customer, and partner separately, use fresh critics on live 1440×900 and 390×844 output plus interactive/error/loading/empty states. Compare with the established major-brand reference set. Each round must force-rank, name one biggest evidence-backed gap, and rate it major/minor. Fix that gap and regressions, then use a new critic.

A surface converges after two consecutive no-major rounds or three consecutive minor-only rounds. Cover all roles and primary routes/states. Preserve screenshots under `docs/temp/media/progress/`.

Then run a fresh all-surface cohesion gate across marketing, admin, customer, and partner for typography, spacing, colors, navigation, vocabulary, statuses, forms, focus, errors, loading, empty states, and responsiveness using the same convergence rule.

For CSP, read installed Next.js 16 nonce/CSP guidance. Prefer enforcing nonce-based protection, investigate route-scoped policies so static marketing need not become dynamic unnecessarily, and do not choose script `'unsafe-inline'` merely to silence failures. Required result: enforcing `Content-Security-Policy`, successful hydration, working Turnstile/Supabase/media, no representative CSP console violations, curl/browser evidence, and documented tradeoffs.

Run mobile Lighthouse navigation audits on production output. Required floors: performance ≥85 and accessibility ≥95. Record URL, mode, throttling, LCP, CLS, and two comparable final runs; use the lower score. Do not substitute desktop or unthrottled traces. Diagnose and fix owner-independent bottlenecks.

Stage 3 exits only after all craft/cohesion gates, CSP, Lighthouse, Level C verification, evidence, documentation, and checkpoint commit pass.

## Stage 4 — Launch preparation

Do not deploy.

- Add supported Vercel configuration with `/api/cron/outbox` every five minutes, the cleanup schedule, and required duration settings.
- Add a dependency-ordered README runbook covering Git/PR decision, hosted Supabase, migrations without dev seed, production owner bootstrap, auth/MFA, leaked-password protection, storage, backups/PITR, Vercel env/crons, Resend/DNS, Turnstile, PandaDoc, domain, smoke tests, rollback, and monitoring dead queue rows.
- Rewrite `HANDOFF.md` with every owner action, including actual Git state, hosted services, credentials, backups, photos, stat/testimonial approval, final LOR wording, and domain confirmation.
- Make `BLOCKERS.md` owner-only: credentials, purchases, hosted resources, DNS, legal/copy approval, photos, push/merge/deploy authorization. Each entry needs impact, owner-only reason, fallback, steps, validation, and launch-blocking status.
- Reconcile ROADMAP, PROGRESS, CONTINUATION, HANDOFF, BLOCKERS, GOAL_STATE, RETENTION, and README with code, Git, routes, commits, tests, deployment state, and limitations.
- Run final Level C verification plus production browser checks for marketing/forms, customer, all partner routes, MFA/admin, e-sign failure, errors/not-found, console, headers, and CSP.

Stage 4 exits only after deployment configuration, runbook, truthful documentation, final verification, and checkpoint commit are complete. Nothing is pushed.

## Stop and session boundaries

Do not stop because the task is long or context is compacted. Persist `GOAL_STATE.md` and stop only when complete, genuinely owner-blocked, or repeated infrastructure failure prevents progress.

A blocker must fail three attempts/resumed runs, exhaust safe alternatives, have independent work routed around it, and include recovery steps. If a gate takes six fresh rounds in one run, persist all results and resume that same gate later; do not waive it or proceed.

## Final exit criteria

Do not declare completion until:

- All admin/customer/partner requirements are implemented.
- Partner detail/feed/profile and actionable admin e-sign failures exist.
- Storage cleanup drains objects.
- Notifications are crash-safe, bounded, and honest.
- Growing reads are bounded/paginated.
- Backend review and full authorization matrix converge/pass.
- MFA, RLS, server-only secrets, enforcing CSP, dependency audit, and client-bundle checks pass.
- Marketing quality remains intact; admin/customer/partner craft and cohesion converge.
- Mobile Lighthouse performance is ≥85 and accessibility ≥95.
- Handwritten TS/TSX source/application tests are ≤450 lines.
- Type-check, lint, unit tests, build, fresh reset, pgTAP, audit, headers, and production browser flows pass.
- Vercel config, cron schedules, runbook, and all documentation are complete and consistent.
- BLOCKERS is owner-only.
- No hosted resource, push, merge, deployment, PR, or paid resource was created.

Final response must report work by stage, verbatim gate outcomes, exact checks, browser/Lighthouse/CSP evidence, checkpoint commits, owner-only launch actions, and confirmation that nothing external was published or created.
