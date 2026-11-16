---
name: verify-cmg
description: Use when verifying the CMG Property Solutions Next.js public-adjuster web app locally — after UI, auth, SITE_MODE, claim/contact, admin, portal, or partner changes; before calling a change complete; or when you need to launch, doctor, drive, or capture evidence on those web surfaces.
---

# verify-cmg

Project-level verification for **CMG Property Solutions**, the Next.js 16 + Supabase public-adjuster app in this repo. Reach for this skill when a coding agent must prove a change on the real web surfaces (`/`, `/contact`, `/file-a-claim`, `/login`, `/mfa`, `/admin`, `/portal`, `/partner`) instead of stopping at unit tests.

This is a verification procedure, not an application feature. Do not change app code, schema, or secrets to make a journey pass. Do not call hosted Resend or PandaDoc unless the invoking shell opted in.

Helpers live next to this file. From the repo root:

```bash
./.cursor/skills/verify-cmg/scripts/static-gates.sh
./.cursor/skills/verify-cmg/scripts/launch.sh --mode simple --reset
./.cursor/skills/verify-cmg/scripts/doctor.sh
./.cursor/skills/verify-cmg/scripts/drive.sh public-contact
./.cursor/skills/verify-cmg/scripts/cleanup.sh
```

`--reset` rebuilds local Postgres from migrations and `supabase/seed.sql`. Use it only against disposable data. A fresh VM is disposable. A machine holding retained acceptance data is not — see README isolation safeguards.

## 1. Static gates

Run from the repo root, Node 22, `package-lock.json` as the authority. Exact commands:

| Gate | Command |
|---|---|
| TypeScript | `npm run type-check` |
| ESLint | `npm run lint` |
| Vitest | `npm test` |
| Production build | `npm run build` |
| High-severity audit | `npm audit --audit-level=high` |

Database path (disposable local stack only):

```bash
npm run db:reset
npm run db:test
```

`npm run db:reset` applies every migration and `supabase/seed.sql`. Record the command's exit status, not only migration output.

Database-backed Vitest selection from `.github/workflows/ci.yml` (the `database` job). Supply only local stack credentials:

```bash
eval "$(supabase status -o env)"
NEXT_PUBLIC_SUPABASE_URL="$API_URL" SUPABASE_SECRET_KEY="$SECRET_KEY" \
  npx vitest run src/lib/esign src/app/api/pandadoc src/lib/storage-cleanup src/lib/admin/partners.test.ts
```

CI pins Supabase CLI **2.116.0**. Local ports are 15420–15429 (`supabase/config.toml`, `project_id = "CMGPA"`).

Wrapper that records logs under `.cursor/skills/verify-cmg/run/`:

```bash
./.cursor/skills/verify-cmg/scripts/static-gates.sh
./.cursor/skills/verify-cmg/scripts/static-gates.sh --with-db   # db:reset + db:test + the Vitest selection
```

Live PandaDoc stays skipped unless `PANDADOC_LIVE_DRAFT_TEST=1` plus `PANDADOC_API_KEY` and `PANDADOC_DRAFT_TEST_EMAIL` are set in the invoking shell. Report that skip. Do not put those values in `.env.example` or this skill.

Build in CI sets `NEXT_PUBLIC_SUPABASE_URL=http://127.0.0.1:15421` and a placeholder publishable key. A local build uses `.env.local` / the launch overlay.

## 2. Launch

Empty data dir → running instance.

```bash
./.cursor/skills/verify-cmg/scripts/launch.sh --mode simple --reset
./.cursor/skills/verify-cmg/scripts/launch.sh --mode staff --reset
./.cursor/skills/verify-cmg/scripts/launch.sh --mode platform --reset
# Nested Docker only, when user-defined bridges cannot reach Postgres:
VERIFY_CMG_BRIDGE_FORWARD=1 ./.cursor/skills/verify-cmg/scripts/launch.sh --mode simple --reset --bridge-forward
```

`--reset` is the empty-data-dir path. Omit it when the stack is already seeded and disposable-data approval is not in hand.

What launch does:

1. Re-execs under the `docker` group if the daemon is up but this shell cannot talk to it.
2. Copies `.env.example` → `.env.local` **only when `.env.local` is missing**. It does not rewrite an existing file.
3. Starts `npm run db:start` if GoTrue at `http://127.0.0.1:15421/auth/v1/health` is down, and records that this skill started Supabase.
4. Optionally `npm run db:reset` (migrations + seed).
5. Overlays, for this process only: `SITE_MODE`, `NEXT_PUBLIC_SITE_URL=http://127.0.0.1:<port>`, and `API_URL` / `ANON_KEY` / `SECRET_KEY` taken **only** from `supabase status -o env` (no inherited-env fallback). The URL host must be `127.0.0.1` or `localhost` or launch hard-fails. Empty overlays for every outbound/paid vendor key in `.env.example` (`RESEND_API_KEY`, `PANDADOC_API_KEY`, `PANDADOC_WEBHOOK_SHARED_KEY`, `PANDADOC_DRAFT_TEST_EMAIL`, `PANDADOC_LOR_TEMPLATE_UUID`, `PANDADOC_LOR_TEMPLATE_UUID_SINGLE`, `CRON_SECRET`) so Next’s in-process `.env.local` load cannot send or charge. Cloudflare always-pass Turnstile keys are forced whenever the stack URL is local. Live vendors are opt-in: `--live-vendors` or `VERIFY_CMG_LIVE_VENDORS=1`.
6. Starts `npm run dev -- --hostname 127.0.0.1 --port 3000` (or `npm run build && npm run start` with `--prod`). `--port` must be 1024–65535.
7. Waits until **doctor** passes — not until a port accepts TCP.

`--bridge-forward` / `VERIFY_CMG_BRIDGE_FORWARD=1` is **only for nested-Docker cloud VMs** where user-defined `supabase_network_*` bridges cannot reach Postgres. Never use it on a laptop, Rob’s PC, or a shared host. It is opt-in. The iptables rule is scoped to the Supabase network subnet when that network exists, otherwise `-i br+ -o br+` (bridge-to-bridge). It is never a blanket `DOCKER-USER ACCEPT`. Cleanup restores the previous sysctl values and deletes that rule.

Per `SITE_MODE` (from `src/lib/site-mode.ts` and `.env.example`):

| Mode | Public site | `/login` `/mfa` `/admin` | `/invite` `/portal` `/partner` |
|---|---|---|---|
| `simple` (default) | open | redirect `/platform-disabled` | redirect `/platform-disabled` |
| `staff` | open | open (staff + AAL2 for `/admin`) | redirect `/platform-disabled` |
| `platform` | open | open | open |

Invalid or missing `SITE_MODE` selects `simple`. Change mode by restarting launch; Next reads `SITE_MODE` at process start.

Ready means doctor passes: `GET /` is the marketing homepage containing “Your insurer has an adjuster” and “CMG Property Solutions”, not an empty listener.

Seeded local accounts (`supabase/seed.sql`), password `CmgDev!2026` for every row:

| Email | Role | Surfaces |
|---|---|---|
| `owner@cmg.test` | owner | `/admin` after AAL2 |
| `adjuster@cmg.test` | adjuster | `/admin` after AAL2 |
| `assistant@cmg.test` | assistant | `/admin` after AAL2 |
| `customer@cmg.test` | customer | `/portal` (no TOTP) |
| `partner@cmg.test` | partner | `/partner` (Summit Exteriors LLC) |

Staff rows have **no TOTP factor**. First `/admin` visit goes through `/mfa` enrollment. Customer claim `CMG-2026-0001` id `20000000-0000-4000-a000-000000000001`. Launch overlays empty vendor keys so outbox rows stay `pending` (queued, not sent). That is the local side-effect to assert.

## 3. Doctor

Read-only. Does not sign in, submit forms, or reset the database.

```bash
./.cursor/skills/verify-cmg/scripts/doctor.sh
```

Checks, in order:

1. **App up** — `GET http://127.0.0.1:<port>/` is 200 and the body contains the homepage copy above.
2. **Right build** — `started.json` git SHA equals `HEAD`; app log names Next.js.
3. **Port ours** — the PID recorded by launch is alive and that port answers.
4. **Supabase healthy** — `supabase status -o env` only (no inherited URL/key fallback); host must be `127.0.0.1` or `localhost`; GoTrue health + REST with the publishable key.
5. **Vendor keys blank** — `/proc/<pid>/environ` (and children) have empty Resend/PandaDoc/cron keys; Turnstile is the always-pass test pair. Skipped only when `--live-vendors` was recorded.
6. **Auth works (mode-accurate, no session)** —
   - `simple`: `/login` lands on “Online claim accounts are not open yet.”
   - `staff`: `/login` shows “Sign in to your claim.”; `/portal` stays on platform-disabled.
   - `platform`: `/login` shows “Sign in to your claim.”

Fail the drive if doctor fails. Do not point a browser at a random process on 3000.

## 4. Drive

No Playwright in `package.json`. Drive uses an npx pin, not a committed dependency:

```bash
./.cursor/skills/verify-cmg/scripts/drive.sh public-contact
./.cursor/skills/verify-cmg/scripts/drive.sh public-intake
./.cursor/skills/verify-cmg/scripts/drive.sh staff-login          # SITE_MODE=staff or platform
./.cursor/skills/verify-cmg/scripts/drive.sh admin-claims         # staff/platform + AAL2
./.cursor/skills/verify-cmg/scripts/drive.sh customer-portal      # SITE_MODE=platform
./.cursor/skills/verify-cmg/scripts/drive.sh partner-directory    # SITE_MODE=platform
```

`drive.sh` runs doctor, then installs `@playwright/test@1.56.1` only under `.cursor/skills/verify-cmg/scripts/` (gitignored `node_modules`, never the app `package.json`) and runs:

```bash
npx --prefix .cursor/skills/verify-cmg/scripts playwright install chromium
npx --prefix .cursor/skills/verify-cmg/scripts playwright test \
  --config .cursor/skills/verify-cmg/scripts/playwright.config.mjs --grep '<journey>'
```

Journeys are real user paths. There are no test-only HTTP endpoints. Stable selectors from this repo:

| Surface | Path | Selectors |
|---|---|---|
| Marketing nav | `/` | `nav[aria-label="Primary"]`, `data-testid="desktop-nav"`, home `aria-label="CMG Property Solutions — home"` |
| Contact | `/contact` | `#field-name` “Full name”, `#field-phone`, `#field-email`, `#field-message` “What happened?”, button “Request my free review”, success heading “Request received.” |
| Intake | `/file-a-claim` | `#field-firstName` … `#field-consent`, radios `hasSecondPolicyholder` / `priorRoofClaim` / `lorContractType`, `#field-requestedAdjuster`, button “Submit intake”, success “Intake received.” |
| Login | `/login` | `#field-email`, `#field-password`, button “Sign in”, heading “Sign in to your claim.” |
| MFA | `/mfa` | button “Set up authenticator”, text “Or enter this key by hand”, `p.font-mono` secret, `#field-code`, “Verify and finish setup” |
| Admin | `/admin` | `a[aria-label="CMG claims desk"]`, `nav[aria-label="Workspace"]`, heading “Claims desk.” |
| Claims list | `/admin/claims` | heading “Claims.”, `#claim-search`, `#admin-status`, `ul[aria-label^="Claims, sorted by"]` (viewport `< xl` only; desktop uses the table) |
| Intake queue | `/admin/intake` | heading “Intake queue.” |
| Leads | `/admin/leads` | heading “Leads.” |
| Partners | `/admin/partners` | heading “Partner companies.”, `nav[aria-label="Filter companies"]`, disclosure “Add a company”, `#admin-name` |
| Customer portal | `/portal/claims/<id>` | `nav[aria-label="Client portal"]`, `nav[aria-label="Claim sections"]`, tabs Overview / Activity / Documents, `#field-kind`, `#field-files`, button “Send to CMG” |
| Partner portal | `/partner` | heading “Claims you referred.”, `nav[aria-label="Partner portal"]`, links “Refer a claim” / “Company profile” |
| Closed private | `/platform-disabled` | heading “Online claim accounts are not open yet.” |

Turnstile: wait for `input[name="cf-turnstile-response"]` to hold a token (always-pass visible widget with the example keys). Do not stub or bypass CAPTCHA.

Feature recipes: [features/README.md](features/README.md).

If a seed precondition is missing (for example a staff TOTP already enrolled with an unknown secret), **fail the journey** and write the reason in that feature’s Gotchas. Do not skip MFA, do not hit a private RPC as a shortcut, do not invent a test login page.

## 5. Evidence

Capture, for every driven feature:

- Screenshots at **desktop (1280×800)** and **390px** (`*-desktop.png`, `*-mobile-390.png`).
- Console errors and pageerrors (`console.json`). Filter by this navigation; do not call a console clean from leftover Preview noise.
- Network status ≥400 and failed requests (`network-errors.json`). Cloudflare Turnstile script noise is expected on first paint; application 4xx/5xx on `/contact`, `/file-a-claim`, `/login`, `/admin`, `/portal` is not.
- Database rows the user path wrote (`side-effects.json` via `side-effects.sh <email>`): `public.leads` for that email, `public.claims` joined through `claimants.email`, `public.notifications_outbox` where `recipient_email` or `payload.email` is that address. Do not accept an unrelated recent claim or staff-alert row.
- Outbox: with empty `RESEND_API_KEY`, contact writes `lead_staff_alert` + `lead_auto_reply` (when email present) as `pending`. Intake writes `intake_staff_alert` + `intake_confirmation`. Status `pending` is a pass locally. Live Resend is opt-in and reported skipped.

Proof lives in `.cursor/skills/verify-cmg/evidence/<utc>-<journey>/`. Cleanup deletes PID files under `run/` only. It must not delete `evidence/`.

Proof standard:

- Real user path (browser, public routes, real server actions).
- No test-only endpoints.
- Side effects checked in Postgres, not only UI copy.
- Hosted submissions need separate approval (README browser safeguards). This skill is local.

```bash
./.cursor/skills/verify-cmg/scripts/side-effects.sh verify-contact@verify.cmg.test
```

## 6. Cleanup

```bash
./.cursor/skills/verify-cmg/scripts/cleanup.sh
```

Stops **only** what launch recorded: the app PID (after `/proc/<pid>/cmdline` contains `npm` or `next`; a mismatch drops the stale record and does not kill) and its children, then `npm run db:stop` **only if this skill started Supabase**. Never `pkill node`, `killall next`, or `docker kill` by image/name. If `--bridge-forward` was used, cleanup deletes the scoped `DOCKER-USER` rule and restores sysctl.

After cleanup, confirm `ls .cursor/skills/verify-cmg/evidence/` still lists the proof directories.

## 7. Helpers

All scripts are executable. Repo-root invocations:

| Script | Invocation |
|---|---|
| Static gates | `./.cursor/skills/verify-cmg/scripts/static-gates.sh` |
| Static gates + DB | `./.cursor/skills/verify-cmg/scripts/static-gates.sh --with-db` |
| Launch | `./.cursor/skills/verify-cmg/scripts/launch.sh --mode simple --reset` |
| Launch + nested-Docker bridge (cloud VM only) | `./.cursor/skills/verify-cmg/scripts/launch.sh --mode simple --reset --bridge-forward` |
| Launch production-like | `./.cursor/skills/verify-cmg/scripts/launch.sh --mode simple --prod` |
| Doctor | `./.cursor/skills/verify-cmg/scripts/doctor.sh` |
| Drive | `./.cursor/skills/verify-cmg/scripts/drive.sh public-contact` |
| Side effects | `./.cursor/skills/verify-cmg/scripts/side-effects.sh <email>` |
| TOTP for `/mfa` | `node .cursor/skills/verify-cmg/scripts/totp.mjs <base32-secret>` |
| Cleanup | `./.cursor/skills/verify-cmg/scripts/cleanup.sh` |

Runtime pid/log files: `.cursor/skills/verify-cmg/run/` (gitignored). Evidence: `.cursor/skills/verify-cmg/evidence/` (kept).

## Common mistakes

- Treating `curl localhost:3000` as ready — doctor must pass.
- Driving `/admin` at AAL1 or in `simple` mode.
- Resetting a local database that holds retained acceptance data.
- Filling Turnstile with a fake token or skipping the widget.
- Asserting only the success heading without `leads` / `notifications_outbox` rows.
- Killing every `node` process on the machine.
- Running live PandaDoc or Resend from this skill by default (`VERIFY_CMG_LIVE_VENDORS` is off).
- Using `--bridge-forward` on a laptop or shared host.
- Encoding temporary SHAs, test totals, or local ports into `AGENTS.md`.
