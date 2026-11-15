# Local closed invitation implementation

## Current launch-source result — November 11, 2026

The seven-file patch is integrated locally on `codex/cmg-lor-alignment`, whose committed head remains `32c00f8`.
That branch descends from current remote `develop` at `4c52c8a` and includes the approved letter, reply-address, and daily recovery changes.
Only the seven added paths from `f86b38e` were copied. Its older ancestry was not merged or published.
The original isolated commit remains intact. The index is empty; no new Git action ran.

Independent review found a nested main landmark in the new page.
The page now returns a section because AdminShell already supplies the main landmark.
The other five source/test files retain the reviewed invitation implementation.
The Preview, Owner/AAL2, site-mode, token-only, and duplicate-click safeguards remain unchanged.

Validation used existing locked dependencies, Next.js 16.4.3, Vitest 4.1.12, and Node.js 22.22.2:

- Focused selection: 20 tests passed. Each simple/staff/platform selection also passed 20 tests.
- `npm run type-check` and `npm run lint`: passed. Page-only lint passed after the landmark correction.
- `npm test`: 1,884 passed and 67 skipped; 139 files passed and 17 skipped. Exit zero, 416.64 seconds.
- The first sandbox full run stopped without reported results. The permitted local run completed successfully; no third run occurred.
- `npm run build`: passed after the landmark correction, including TypeScript and the new route.
- The build used localhost placeholder configuration. No hosted credentials or live tests were enabled.
- `npm audit --audit-level=high`: passed. Four low and seven moderate findings remain; no high or critical finding.
- No package, lockfile, CSS, font configuration, migration, database policy, or existing invitation action changed.

The native browser rendered the actual new page and form inside a synthetic main shell at widths 1280 and 390.
It showed one main landmark, no nested main, and no horizontal overflow.
The two synthetic submissions produced the expected refusals, cleared their token inputs, and disabled both buttons.
Captured warning/error logs were empty. All 15 captured network events had no failed response or request; the trace was not truncated.
The harness used fake guards and a fake action, with no backend or real tokens. Application CSS was not loaded.
These results do not prove authenticated Preview behavior or the full styled admin layout.
Viewport overrides were cleared. The signed-in tabs were not navigated, closed, or modified. No Computer Use ran.

Evidence is retained in session scratch folders `cmg-final-source-checks-2026-11-10` and `cmg-final-invitation-ui-2026-11-10`.
No disposable database reset was approved or run. Credential-dependent and live cases remain skipped.
The exact combined source still needs GitHub CI, a Ready Preview, and the two separately approved hosted acceptance requests.
Do not repeat completed one-time tests or reopen the old historical build investigation.

Next proposed action: commit these seven files locally as `Integrate closed invitation checks with current launch source`.
Commit, push, PR update, Preview settings/build, new login, token reads, and hosted tests remain separate approvals.
Preserve all unrelated edits, data, DNS, and logins. Keep cleanup blocked. Create no backup.

## Earlier isolated-branch evidence

The records below describe the older `f86b38e` checkout and its validation attempts.
They do not override the current-source result above or authorize a repeat.

- [x] Create approved isolated branch from develop.
- [x] Add Preview-only Owner page and token-only action.
- [x] Verify page/action guards and one-attempt form locally: 20 tests passed after private installation.
- [ ] Run type, lint, full unit suite and build.
- [x] Record rendered-check and database-check limits.
- [x] Review final diff and record the next separate approval.

No hosted test, token read, commit, push, deployment, or cleanup is authorized. Preserve logins.

## Final local result

Offline private dependency installation succeeded from the normal local cache. Original packages are preserved.
The package manifest and lockfile have no diff from the approved branch base.
Focused suite: 20 tests passed across three new test files.
Type checking and lint passed.
Full unit suite, using task-local TEMP/TMP: 110 files passed and 12 skipped; 1630 tests passed and 55 skipped. Exit zero.
The full run includes the new 20 tests; do not add the totals together.
The earlier default-temp failures and interrupted run are superseded by that successful run.
No live-provider or credentialed database checks were enabled. No database reset was approved or run.
Default local build failed fetching Inter from Google Fonts under the sandbox.
A separately permitted local build outside the sandbox failed when Turbopack started the worker for unchanged globals.css: the Node process exited before connection, with exit code zero.
No font/CSS/configuration source was changed. The closed historical hosted build investigation was not reopened.
Therefore the required build check remains failed and the patch is not fully validated for publication.
Rendered form-component checks passed in the synthetic harness at 1280px and 390px, with no horizontal overflow, correct settled refusal statuses, disabled used buttons, and an empty captured warning/error log.
The viewport override was reset. Full network tracing and credentialed Preview-route checks remain unverified.
The independent security review's static metadata finding was fixed and re-reviewed. The final source review found no further account-changing path through the token-only wrapper.
All six new source/test files passed a direct trailing-whitespace check; git diff --check also passed.

Next proposed Git action: commit only the six files under src/app/(admin)/admin/closed-invitation-checks and this evidence file locally, titled Prepare closed invitation acceptance checks.
That local commit needs separate approval. No push, PR, deployment, new Owner login, private token read, or hosted test is included.
Hosted tests still require a reviewed Preview destination, session-preservation plan, exact fixture/token-read approval, and final request approval.

## Approved offline installation and resumed checks

The owner approved private offline installation and preservation of the original packages.
The exact checkout junction and its original target were checked before nonrecursive Directory.Delete removed only the junction.
The main checkout's Next package remains present at version 16.3.5. The isolated node_modules is now a private directory, not a link.
The first offline install failed because the sandbox cache lacked zod-validation-error 4.0.2.
The normal local npm cache contained that exact tarball. Retrying offline with that cache installed 502 packages successfully.
Both commands used --ignore-scripts --offline --no-audit --no-fund. No dependency download, version upgrade, manifest change, or lockfile change occurred.

Resumed checks:
- Focused page/action/form suite: 3 files and 20 tests passed.
- npm run type-check: passed, exit zero.
- npm run lint: passed, exit zero.
- npm test: still running at this update; the existing pandadoc-draft.discovery.test.ts reported failures. No full-suite pass is claimed.
- npm run build: failed because next/font could not fetch Inter from Google Fonts. The earlier dependency-junction error is resolved.
- The closed historical hosted build investigation was not reopened. No font or app configuration change was made.
- A separate localhost Vite harness used the actual form component with a synthetic action, no accounts, and no hosted services.
- The native browser timed out reaching that harness, then rejected the generated data-URL error page under its URL policy.
- The sandbox socket check also returned a forbidden-access error. Running only the synthetic harness outside the sandbox did not complete browser verification.
- Both harness processes were stopped. The agent-created error tab was retained; the original signed-in tabs were not navigated, closed, or changed.
- Desktop/390px, browser console/network, and authenticated page verification remain unverified. No Computer Use or browser-policy workaround occurred.
- Disposable database/reset approval remains absent. No database check or reset ran.

The older link-based failures below are historical and do not supersede these resumed results.

## Later local verification

The interrupted full suite reported ten failures in the unchanged PandaDoc discovery safety test.
A focused reproduction showed ERR_MODULE_NOT_FOUND for its temporary setup.mjs under the sandbox path containing #.
Setting TEMP and TMP only for the test process to the task-local cmg-local-test-temp folder resolved all ten discovery tests.
No test assertion or source file was changed for that fix. Those discovery tests forbid network calls and use dummy credentials.
The complete unit suite was restarted with that same temporary-folder setting and --bail 1. Its result is pending at this update.

The local harness was confirmed to return HTTP 200 from outside the sandbox.
A fresh native Browser tab then loaded the actual form component with a synthetic action successfully.
Desktop width 1280 and mobile width 390 had no horizontal overflow.
Each synthetic submission settled to the fixture refusal; its button remained disabled afterward. Both statuses and both disabled buttons were verified.
The local tab's captured warning/error log was empty. Full network tracing was not collected.
The viewport override was reset. Signed-in tabs were neither navigated nor closed.
The synthetic harness remains available on http://127.0.0.1:4198 for local review, with no hosted requests or real tokens.
Proof is retained in cmg-invitation-ui-local-2026-11-10/desktop-result.png, mobile-result.png, and result.json under session scratch.
This is rendered form-component verification only. The real Preview route, credentials, rate counters, and invitation fixtures remain untested.
The earlier failed local connection statements describe prior attempts; the successful fresh-tab result supersedes the local component-viewport gap.

## Implementation and review

Branch codex/cmg-closed-invitation-checks was created from develop at 88f86eeb76e21aaeb9b1dde0e777b8e864e1222f.
This is an isolated checkout. The original launch worktree and its edits remain intact.
The new route is /admin/closed-invitation-checks.
Both page and action reject non-Preview environments and require Owner access.
The invitation surface must also be open. The action forwards only one token and fixed idle state to unchanged acceptInvite.
It returns only status/message, stripping any additional result fields.
Each form allows one normal UI submission per mount. Reload/direct Owner requests are not a persistent one-attempt boundary; operator limits remain authoritative.
The page metadata conceals the route outside Preview, when invitations are closed, or when the actor lacks the Owner role.
An independent read-only security review found the static-title issue. It confirmed the corrected guarded metadata resolves that finding.
No account-change or sign-in path was found through the blank-name/password wrapper.
Tests were added for page/action guards, metadata refusal, input stripping, malformed tokens, and one-use UI behavior.

## Validation limits

Existing Next.js 16.3.5 dependencies were linked from the main checkout to avoid installing packages.
The default focused Vitest run failed before assertions because its fork worker timed out.
Threads and an unsandboxed threads run also timed out before collection. A preserve-symlinks attempt was stopped without a completed result.
Do not report these test assertions as passing.
The TypeScript CLI returned exit code zero when its session was polled/stopped, but no diagnostic output was captured; repeat after dependency setup is corrected.
An additional direct TypeScript API check timed out and reset its REPL kernel. It did not interact with browsers.
Lint was stopped without a completed diagnostic result. Full unit tests were not run after the focused worker failure.
The required build failed with: Symlink [project]/node_modules is invalid, it points out of the filesystem root.
This is a new local dependency-link failure, not the closed historical hosted build investigation.
No build guard, test assertion, package manifest, lockfile, or dependency version was changed to bypass validation.
Rendered desktop/390px checks remain incomplete. No credentialed local or hosted browser visit was attempted.
Database reset and tests were not run because disposable-data/reset approval is absent. No database schema or policy changed.

## Next exact local approval

Replace only this checkout's node_modules junction with private dependencies from its unchanged package-lock.json.
Use npm ci --ignore-scripts --offline. Do not upgrade or add packages.
First verify the junction path is inside this isolated checkout and its target is the main checkout's node_modules.
Remove only the junction itself, without recursion or traversing its target. Preserve the original dependencies.
If offline cache content is unavailable, stop before downloading and report the missing prerequisite.
This installation requires approval under the user's working agreement for production dependencies.
After setup, resume focused tests, type/lint/full tests/build, final diff review, and safe rendered verification.
No commit, push, deployment, hosted test, login change, token read, backup, DNS change, or cleanup-worker action is included.
