# Partner directory

Three related surfaces: the owner’s company list, the public contractor page, and the partner portal. The directory itself is `/admin/partners` (owner + AAL2). Public `/contractors` is marketing, not a company index.

## Sub-features

- Public `/contractors` — “For Contractors” marketing, referral steps, CTA to `/file-a-claim`. Open in every SITE_MODE.
- Admin `/admin/partners` — heading “Partner companies.”, `nav[aria-label="Filter companies"]` (All / Active / Inactive), disclosure “Add a company” (`#admin-name` Company, optional contact fields). Owner only.
- Seeded company **Summit Exteriors LLC** (`10000000-0000-4000-a000-000000000001`), contact Tyler Boone / `partner@cmg.test`.
- Partner portal `/partner` — heading “Claims you referred.”, `nav[aria-label="Partner portal"]` (Referred claims, Refer a claim, Company profile). Seeded partner sees `CMG-2026-0001` / `CMG-2026-0002`. Settlement on 0001 stays hidden until `settled` (`claim_partner_summaries`).
- `/partner/refer` — referral form, success “Referral sent.”

## How to get to it (user POV)

**Public:** Primary nav → Contractors.

**Owner directory:** Complete staff-login as `owner@cmg.test`, Workspace → Partners (`/admin/partners`). Adjuster/assistant must 404 here.

**Partner portal:** `SITE_MODE=platform`, `/login` as `partner@cmg.test` / `CmgDev!2026`, land on `/partner`.

## Driving it with Playwright

```bash
./.cursor/skills/verify-cmg/scripts/launch.sh --mode platform --reset
./.cursor/skills/verify-cmg/scripts/drive.sh staff-login
./.cursor/skills/verify-cmg/scripts/drive.sh partner-directory
```

Journey `partner-directory.spec.mjs`:

1. Owner session (storage state or enrollment) → `/admin/partners`.
2. Heading “Partner companies.”, filter nav “Filter companies”, text “Summit Exteriors LLC”, disclosure “Add a company”.
3. Separate test: `/login` as partner → `/partner`, heading “Claims you referred.”, nav “Partner portal”, exact texts `CMG-2026-0001` and `CMG-2026-0002` (both seeded claims belong to Summit; a combined regex matches two nodes and fails strict mode).

Creating a company: open “Add a company”, `#admin-name` a unique name, submit, expect the new row. Only do that write when the change under test is partner CRUD.

## Gotchas

- `/admin/partners` is owner-only. An AAL2 adjuster gets `notFound()` / “Page not found”. Fail if the journey used `adjuster@cmg.test`.
- `/partner` is closed in `simple` and `staff`. Driving the portal in those modes must fail, not redirect-and-pass.
- Seeded partner password is the same `CmgDev!2026`; there is no TOTP on partner accounts. If login lands on `/mfa`, the wrong account was used.
- Partner summaries hide `settlement_amount` until settled. Claim 1 is `settlement_offered` — copy “Settlement reported once the claim settles.” is correct.
- Public `/contractors` does not list Summit Exteriors. Do not assert the company name on that page.
