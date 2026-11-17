# CMG SignuDoc experiment — start here

This branch contains the actual synthetic experiment source, evidence and an ordered launch plan. It does not activate a signing provider.

- Branch: `spike/signudoc-white-label-2026-11-16`
- CMG base: `950cb27514ce10c92a1b05a4ef87bee9fc627ca2` (develop).
- SignuDoc source: `bb9bc099151fed39da5de017d9b4cd61b124cbbd` (v0.2.1).
- [Launch plan — 22 ordered tasks and six release gates](../../superpowers/plans/2026-11-16-cmg-signudoc-launch.md)
- [Feasibility assessment](FEASIBILITY_REPORT.md)
- [Exact experiment results](evidence/cmg-api-results.json)
- [Verification summary](evidence/verification-summary.json)
- [Actual CMG contract tests — 74 targeted CMG checks, real-template HTTP signing, blockers](actual-contracts/RESULTS.md)
- [Actual-contract replay instructions and evidence](actual-contracts/README.md)

## Latest implementation checkpoint

**Steps 1 and 2 are implemented and locally server-tested.** Read [current results and remaining gates](CMG_CONNECTION_RESULTS.md) and [service source/setup](../../../integrations/signudoc/README.md) first. Optional authorization now works; the authenticated CMG provider, review-before-send controls, status/reminders and private artifact filing are built. The feature is disabled. Browser/phone acceptance is deferred, and full Supabase-stack/type regeneration plus other release gates remain incomplete.

The earlier actual-contract report below is retained as diagnostic history; its optional-field and missing-bridge blockers have been superseded by this implementation. It is not the current status report.

## Product requirements

From a claim, select the firm-approved agreement and prefill homeowner/claim data; let the adjuster review all pages, terms and recipients before sending; show which homeowners remain outstanding; support controlled reminders; automatically file the unchanged signed PDF and audit evidence privately with the claim. One- and two-homeowner signing must work on actual phones. Every firm needs its own branding, wording and reusable versioned templates with strong data separation.

## What to intake

The required-field mapper, eleven native Node checks, real HTTP integration scenario and audit verifier are retained under `source/`. They are archived as `.txt` snapshots so CMG's TypeScript/lint/test discovery cannot execute the SignuDoc-specific harness. This is replayable test source, not just a proposal. `source/SHA256SUMS.json` identifies the original bytes.

Run the passive materializer with a NEW EMPTY directory outside the CMG repository:

    python docs/experiments/signudoc/materialize_spike.py /path/outside/cmg/signudoc-review

It only copies the preserved source into that directory; it does not install, start, reset, sign, send or deploy anything. Read the materialized README before running tests. Those tests deliberately reset a disposable local test schema and must never use retained or hosted data. The recorded database/server ports are 55437 and 3187/3188. Node 24 is for the separate SignuDoc test; do not change CMG's Node 22 requirement.

The original unsigned/signed synthetic PDFs and full ZIP are retained in the originating task; exact file hashes and independent signature-verification outputs are here. They are reproducible from the preserved harness. No customer agreement, real credential, captured signing-link outbox, session trace, database binary or dependency tree is committed.

## CMG agent intake

1. Read this README, the assessment and the complete launch plan before coding.
2. Reconcile current develop/release work; do not overwrite it or introduce a second competing workflow.
3. Keep existing PandaDoc/manual behavior and in-flight agreements intact.
4. Intake the current implementation and pinned patches; resolve the current results report’s runtime, generated-type, security, browser and release gates. Local success does not prove production readiness.
5. Current code is authoritative. The older plan includes historical proposed interfaces; the current service uses one authenticated POST endpoint and a leased poller.
6. Obtain the appropriate resource, hosted-testing, real-send/signature and production approvals at the named gates.

## Deployment suppression

The only root configuration change is `vercel.json` -> `git.deploymentEnabled` -> this exact experiment branch = false. Existing crons and all other configuration are preserved. Official reference: https://vercel.com/docs/project-configuration/git-configuration#gitdeploymentenabled

Do not remove that block or blindly merge/cherry-pick the entire experiment into develop. Publishing research does not authorize Preview/Production deployment. No pull request is opened by this task; the CMG team can review/intake the branch deliberately.

## Initial publication receipt — historical

Initial publication commit: [890f907](https://github.com/rspeciale0519/cmg/commit/890f907e5e488f2c779643115f42636d93f7d929). All 24 published files were independently read back and matched exactly. The branch comparison contains only the documented experiment/plan files and the exact-branch Vercel deployment block. Develop remains at 950cb27514ce10c92a1b05a4ef87bee9fc627ca2.

The passive materializer passed restore, source-checksum, nonempty-target refusal and in-repository-target refusal checks. The restored mapper passed all eleven tests. No CMG application code, dependencies, migrations or runtime provider settings changed; root application tests were not rerun for this documentation/archive-only publication. No merge, pull request, deployment command or real send occurred. GitHub had no commit-status entries at the readback checkpoint; the no-deployment claim relies on the documented branch-specific suppression, not a completed hosted acceptance test.
