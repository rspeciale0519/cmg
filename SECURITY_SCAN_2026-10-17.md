# Security scan — 2026-10-17

Independent review of the CMG Property Solutions repository, following Anthropic’s security-guidance method: a broad sweep, then an adversarial pass whose only job was to disprove each candidate. Findings that did not survive that pass are listed at the end as closed. Attack tests used local unit tests and Node’s URL parser only. Nothing was run against production, billed, emailed, or written to a hosted database.

This report records the 2026-10-17 scan. Its test counts, source locations, and findings describe that scan unless a candidate update appears below.

**Candidate update:** The owner approved global sign-out after a portal password change. The candidate implements this change and checks file signatures in both legacy upload actions. Disposable database checks passed: 44 pgTAP files and 1,350 assertions.

**Candidate checks:** The approved dependency updates use Next.js 16.4.3, Zod 4.6.6, and Vitest 4.1.12. The updated dependency audit reports zero vulnerabilities. Full unit tests passed: 1,750 passed and 57 skipped across 139 files. Database-backed Vitest passed 254 tests, with one live PandaDoc test skipped. Type checks, lint, and the production build passed.

The candidate is not deployed. Exact-candidate hosted acceptance and release approval remain required.

The original scan found no live secret in the tree or reachable Git history. This file does not contain secret values.

**Original scan results:** Vitest reported 1,694 passed and 56 skipped. The database suites were skipped because Docker/Supabase was unavailable in that environment. The dependency audit reported zero vulnerabilities. Type-check, lint, and production build passed for that earlier state.

---

## High

### H1. Login and MFA could send a signed-in person to another website

**Status:** Fixed in this PR.

A crafted `?next=` value with a hidden tab or line break (`/%09//evil.test`) passed the old sanitiser. Browsers then treat it as “go to evil.test”. This worked on `/login` for someone already signed in, and on `/mfa` after they completed their authenticator.

- **Where:** `src/lib/auth/roles.ts:117` (was 113). Used from `src/app/(auth)/login/page.tsx:45` and `src/app/(auth)/mfa/page.tsx:23`.
- **Proof (before):** Node WHATWG parsing of the old accepted string:

  ```
  "/\t//evil.test" → origin https://evil.test
  "/\n//evil.test" → origin https://evil.test
  old safeNextPath("/\t//evil.test") → "/\t//evil.test"  (allowed)
  ```

- **Proof (after):** `npx vitest run src/lib/auth/roles.test.ts` — 14 passed, including the decoded `/%09/` and `/%0a/` cases.
- **Fix:** Reject control characters and whitespace, reject backslash, and require `new URL(value, dummy).origin` to stay on the dummy origin.

---

## Medium

### M1. An uploaded filename could break a download header or HTML

**Status:** Fixed in this PR.

Original filenames are shown in the UI and passed to Storage as the download name. Quotes, angle brackets, and `filename=` pieces were kept. That can split a `Content-Disposition` header or inject markup if a future screen stops escaping.

- **Where:** `src/lib/validators/files.ts:60`.
- **Proof:** `safeOriginalName('roof.pdf"; filename="evil.exe')` used to keep the quotes. After the fix, vitest asserts they are stripped (`src/lib/validators/files.test.ts`, “strips quotes and header delimiters”).
- **Fix:** Drop `" ' \` ; = < >` in addition to path segments and control characters.

### M2. The emailed password-reset link had no rate limit

**Status:** Fixed in this PR.

`/login`, forgot-password, MFA, and invite-accept all rate-limit. `/auth/confirm` did not. The token is too long to guess, but one IP could hammer GoTrue `verifyOtp` without bound.

- **Where:** `src/app/(auth)/auth/confirm/route.ts:58`.
- **Proof:** New tests in `src/app/(auth)/auth/confirm/route.test.ts` — over-limit requests get the same expired-link redirect as a bad token and never call Auth; malformed tokens do not spend the budget. 25 tests passed.
- **Fix:** 10 well-formed attempts per IP per 15 minutes, fail closed, same generic notice.

### M3. Server Actions would accept a 256 MiB request body

**Status:** Fixed in this PR.

The UI uploads files straight to Storage. The framework still allowed a 256 MiB Server Action body, which matches a leftover multipart upload function. Vercel caps production at 4.5 MB; a local or self-hosted process would buffer the whole body.

- **Where:** `next.config.ts:46`.
- **Proof:** Config previously set `bodySizeLimit: "256mb"`. Production build succeeds with `"2mb"`. Remaining actions send form fields and file metadata only.
- **Fix:** Cap at 2 MB.

### M4. Changing a password in the homeowner portal leaves other devices signed in

**Status:** Owner-approved fix implemented in the candidate; not deployed.

**Original finding:** Portal password changes left other sessions active. The success message stated that other devices stayed signed in.

- **Where:** `src/lib/actions/portal.ts:294`.
- **Original evidence:** The success message explicitly stated that other devices stayed signed in.
- **Candidate fix:** After a successful password change, call `signOut({ scope: "global" })` and redirect to `/login`. Existing access tokens can remain valid until expiry. If sign-out fails, report that the password changed but device sign-out could not be confirmed.

---

## Low

### L1. PandaDoc puts the webhook signature in the URL

**Status:** Vendor constraint. No code change.

PandaDoc delivers HMAC as `?signature=`. Proxies and access logs can store that query string.

- **Where:** `src/app/api/pandadoc/webhook/route.ts:66`.
- **Recommended fix:** Keep HMAC verification (already timing-safe). If PandaDoc adds a header, prefer it. Rotate the shared key if logs may have stored old URLs. Owner already has a rotation item for the old Preview key.

### L2. Two unused upload actions still skip magic-byte checks

**Status:** Signature checks implemented in both legacy actions in the candidate; not deployed.

**Original finding:** The callable legacy actions checked MIME type without checking file signatures. The live UI used prepare/finalize with signature checks.

- **Where:** `src/lib/actions/documents.ts:57`, `src/lib/actions/portal-documents.ts:65`.
- **Candidate fix:** Both actions call `verifyFileSignature` for every file before any upload starts. The 2 MB action body limit remains active.

### L3. Content-Security-Policy allows inline styles

**Status:** Info/low. Tailwind/Next often need this.

- **Where:** `src/lib/security/csp.ts:33` (`style-src 'self' 'unsafe-inline'`).
- **Recommended fix:** Move to hashed or nonce’d styles when the design system allows.

### L4. The browser may talk to any `*.supabase.co` project

**Status:** Residual XSS-exfil control, not a standalone hole.

- **Where:** `src/lib/security/csp.ts:39`.
- **Recommended fix:** Pin `connect-src` to the real project origin.

---

## Info (checked, no exploitable hole)

| Topic | Result |
|---|---|
| Live secrets in the tree or git history | None. Paths-only scan; no `sk_live_`, PEM, or JWT-like blobs in tracked files. |
| Service-role key in the client bundle | `createAdminClient` is `server-only`. Browser client uses the publishable key. |
| RLS off / `USING (true)` | Not present. Core tables enable RLS; upload-session tables revoke `anon`/`authenticated`. |
| IDOR / BOLA | Actions read through the caller’s Supabase client. Zero rows → one generic “not yours” sentence. Existing portal test: “refuses a claim that is not the caller’s”. |
| Privilege escalation to owner | Owner invites cannot mint `owner`; promotion is an aal2 owner RPC with a last-owner lock. |
| Auth bypass on `/api/cron/*` | Missing `CRON_SECRET` returns 503. Timing-safe bearer compare. |
| PandaDoc webhook | HMAC over raw body, fail-closed if the key is missing, event-id lease, replay → 200 duplicate. |
| Stripe / card tampering | No Stripe integration. |
| SQL injection | App uses the Supabase client and RPCs, not string SQL. |
| XSS | The only `dangerouslySetInnerHTML` is static JSON-LD with `<>&` escaped. |
| SSRF | Storage fetches must match the configured Supabase origin. |
| CSRF | Next 16.3.8 includes the `Origin: null` fix (CVE-2026-27978). Missing `Origin` is still allowed by the framework. |
| CORS `*` | Not present. |
| `Math.random` for tokens | Production tokens use `randomBytes` / `randomUUID`. |
| Turnstile | Missing secret fails closed. |
| CI | `pull_request` (not `pull_request_target`), `permissions: contents: read`. |
| Headers | HSTS, `X-Frame-Options: DENY`, `nosniff`, COOP, CSP nonce, `poweredByHeader: false`. |
| npm audit | 0 high/critical. |

---

## Attack tests (local / fixtures only)

Attempted as accounts A (homeowner), B (other homeowner / partner), and admin (staff), using existing unit tests and Node — not production.

| Attack | Result |
|---|---|
| Open redirect after login/MFA (`/%09//evil.test`) | **Hit, then fixed.** Parser resolved to `https://evil.test` before the sanitiser change. |
| Ask a question on someone else’s claim | **Blocked.** `askQuestion` maps a missing RLS row to one generic sentence. |
| Partner reads another company’s claim | **Blocked by design.** `requirePartnerClaim` reads `claim_partner_summaries` under the caller’s JWT. |
| Customer reads internal documents | **Blocked.** `documents_select` requires `visibility = 'customer'` for homeowners. |
| Adjuster reads an unassigned claim | **Blocked.** `is_staff_for_claim` is assignment-scoped. |
| Invite token takeover of an existing account | **Blocked.** Existing accounts keep their role; the token does not set a new password. |
| Cron without secret | **Blocked.** 503. |
| Unsigned PandaDoc webhook | **Blocked.** 403 `invalid_signature`. |
| Replay with same event id | **Blocked.** Duplicate 200. |
| Brute-force recovery `token_hash` | Impractical (32–128 hex). Rate limit added anyway. |
| Full RLS A/B/admin on a live local stack | **Original scan:** Skipped because Docker/Supabase was unavailable. **Candidate update:** Disposable database checks passed across 44 pgTAP files and 1,350 assertions. |

---

## Owner actions (do not do these in this PR)

1. **If any production or Preview log ever printed a PandaDoc webhook URL, rotate `PANDADOC_WEBHOOK_SHARED_KEY`.** This file does not contain that value. Rotation is already listed in `docs/temp/BLOCKERS.md`.
2. Confirm Production Turnstile, cron, and Resend values are live keys, not the Cloudflare always-pass examples from `.env.example`.
3. Confirm Production still has no Stripe keys and no backups (the latter is an existing owner decision, not a code defect).

Do not merge this PR as a production deploy from this scan. Do not rotate credentials from this environment.
