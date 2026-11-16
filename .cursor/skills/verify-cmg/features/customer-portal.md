# Customer portal / uploads

Homeowner surface. Open only in `SITE_MODE=platform`. Seeded `customer@cmg.test` is primary claimant on `CMG-2026-0001`.

## Sub-features

- `/portal` — one claim redirects to `/portal/claims/<id>`; zero claims is “Nothing is on your account yet.”
- Claim overview — kicker `Claim CMG-2026-0001`, title street `1420 Sandhill Crane Dr`, progress ladder. No settlement figure, fee, or policy number.
- Tabs `nav[aria-label="Claim sections"]`: Overview, Activity, Documents.
- Documents `/portal/claims/<id>/documents` — `#field-kind` (default `photo`), `#field-files`, button “Send to CMG”.
- Profile `/portal/profile` via `aria-label="Your account — Marcus Bell"`.
- Chrome: `nav[aria-label="Client portal"]` “My claim”, Sign out.

## How to get to it (user POV)

1. Launch `--mode platform --reset`.
2. `/login` as `customer@cmg.test` / `CmgDev!2026`. No TOTP.
3. Land on `/portal/claims/20000000-0000-4000-a000-000000000001`.
4. Documents tab → choose kind → choose files → “Send to CMG”.
5. In `simple` or `staff`, `/portal` is platform-disabled. That is a closed-surface check, not this feature.

## Driving it with Playwright

```bash
./.cursor/skills/verify-cmg/scripts/launch.sh --mode platform --reset
./.cursor/skills/verify-cmg/scripts/doctor.sh
./.cursor/skills/verify-cmg/scripts/drive.sh customer-portal
```

Journey `customer-portal.spec.mjs`:

1. `/login` → customer credentials → “Sign in”.
2. URL is `/portal/claims/20000000-0000-4000-a000-000000000001`.
3. Expect Client portal nav, Claim sections nav, `CMG-2026-0001`, heading “1420 Sandhill Crane Dr”.
4. Documents tab → `#field-kind`, `#field-files`, “Send to CMG”.

Uploading a real file is an extra side-effect pass: attach a small JPEG under 25 MiB, submit, then assert a `documents` row for that claim with `visibility=customer`. The mapped journey proves the screen is reachable; adding a file is allowed when the change under test is upload.

## Gotchas

- `SITE_MODE=simple` or `staff`: `/portal` never opens. Fail this journey in those modes; do not rewrite it to `/platform-disabled` and call it a pass for “customer portal”.
- Seed must include claimant `user_id` for `customer@cmg.test`. A reset that skipped seed fails with “Nothing is on your account yet.” — report that in this Gotchas list and re-reset.
- Portal uploads are JS prepare/finalize (`usePrivateDocumentUpload`). `<noscript>` says to enable JavaScript. Drive with the browser harness, not a raw POST.
- Rate limit 20 portal uploads per user per hour.
- Financials are unreachable under the customer RLS policy. A missing settlement amount is correct, not a bug.
