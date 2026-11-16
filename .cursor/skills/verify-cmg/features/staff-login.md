# Staff login with MFA / AAL2

Staff cannot open `/admin` at password AAL1. `requireStaff()` redirects to `/mfa` until TOTP is verified.

## Sub-features

- `/login` — `LoginForm`, fields `#field-email` / `#field-password`, “Sign in”, “Forgot password?” → `/forgot-password`.
- `/mfa` — first visit: “Set up two-step verification.” + “Set up authenticator”. Later: “Enter your code.”
- Enrollment shows a QR (`alt="QR code for enrolling this account in your authenticator app"`) and the base32 secret under “Or enter this key by hand”.
- `/admin` after AAL2 — `a[aria-label="CMG claims desk"]`, `nav[aria-label="Workspace"]`.
- `/login` in `simple` is closed (platform-disabled). This feature requires `staff` or `platform`.

## How to get to it (user POV)

1. Launch with `--mode staff` or `--mode platform`.
2. Open `/login`. Heading “Sign in to your claim.”
3. Sign in as `owner@cmg.test` / `CmgDev!2026` (from `supabase/seed.sql`).
4. Land on `/mfa`. Seeded staff have **no** verified TOTP, so the page is enrollment, not challenge.
5. Set up authenticator, enter the 6-digit code, reach `/admin` heading “Claims desk.”

## Driving it with Playwright

```bash
./.cursor/skills/verify-cmg/scripts/launch.sh --mode staff --reset
./.cursor/skills/verify-cmg/scripts/doctor.sh
./.cursor/skills/verify-cmg/scripts/drive.sh staff-login
```

Journey `scripts/journeys/staff-login.spec.mjs`:

1. `/login` → fill `#field-email` `owner@cmg.test`, `#field-password` `CmgDev!2026`, “Sign in”.
2. Expect `/mfa`.
3. Click “Set up authenticator”.
4. Read `p.font-mono`, generate a code with `node .cursor/skills/verify-cmg/scripts/totp.mjs <secret>`.
5. Fill `#field-code`, “Verify and finish setup”.
6. Expect `/admin`, link “CMG claims desk”, nav “Workspace”, heading “Claims desk.”
7. Write `run/storage-owner.json` for later admin journeys.

Login budgets: 20 per IP / 10 per email per 15 minutes. MFA verify: 10 per user per 15 minutes.

## Gotchas

- Seed does not enroll TOTP. The first-run path is enrollment. If a previous drive enrolled the factor and the secret was not kept, `/mfa` asks for a live authenticator code this harness does not hold. **Fail** and re-run `launch.sh --reset` on disposable data. Do not disable AAL2.
- Customer and partner accounts have no TOTP and must not be used to prove `/admin`.
- In `staff` mode a successful customer sign-in still lands on `/platform-disabled` (`landingPathFor`).
- `requireStaff` 404s non-staff rather than 403 (indistinguishable not-found).
- Do not sign in through GoTrue from the shell and paste cookies unless that is what the page did; the journey is the form.
