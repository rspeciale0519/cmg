# Admin claim management

The CMG claims desk after staff + AAL2. Open in `SITE_MODE=staff` or `platform`.

## Sub-features

- Dashboard `/admin` — heading “Claims desk.”, pipeline ladder, “Waiting on triage”, invite excerpt.
- Intake `/admin/intake` — heading “Intake queue.” Public `/file-a-claim` rows land here as `new_intake`.
- Leads `/admin/leads` — heading “Leads.” Contact-form rows. Owner/assistant can change status; adjuster is read-only.
- Claims `/admin/claims` — heading “Claims.”, `#claim-search`, `#admin-status`. Seeded `CMG-2026-0001` and `CMG-2026-0002`.
- Claim file `/admin/claims/<id>` — tabs Overview, Claimants, Documents, Activity, Financials (not assistants), History (`nav[aria-label="Claim sections"]`).
- Owner-only: `/admin/partners`, `/admin/staff`, `/admin/audit`, `/admin/settings`. Adjuster hitting those URLs gets the workspace 404.

## How to get to it (user POV)

1. Complete [staff-login.md](staff-login.md) so the session is AAL2.
2. Open `/admin` or follow “CMG claims desk”.
3. Workspace nav: Dashboard, Intake, Leads, Questions, Claims (owner also Partners, Staff, Audit, Settings).
4. Claims → search `CMG-2026-0001` in `#claim-search` (URL `?q=`, 260ms debounce).
5. Open the row to the claim file. Documents uses the same private-upload path as the portal, with staff kinds.

## Driving it with Playwright

```bash
./.cursor/skills/verify-cmg/scripts/launch.sh --mode staff --reset
./.cursor/skills/verify-cmg/scripts/drive.sh staff-login
./.cursor/skills/verify-cmg/scripts/drive.sh admin-claims
```

Journey `admin-claims.spec.mjs` uses `run/storage-owner.json` when present; otherwise it performs enrollment itself. It then:

1. `/admin` — “CMG claims desk”, “Workspace”, “Claims desk.”
2. Workspace → Claims — heading “Claims.”, `#claim-search` = `CMG-2026-0001`, expect that reference on the page.
3. Workspace → Intake — “Intake queue.”
4. Workspace → Leads — “Leads.”

Accepting an intake (`/admin/intake`) assigns an adjuster and, in `platform` mode, invites the homeowner. In `staff` mode invite mail is held because `/invite` is closed. Drive acceptance only when that side effect is the thing under test; the mapped journey stops at seeing the queues.

## Gotchas

- Without AAL2 the dashboard never renders; `/mfa` is the page. Fail if still on `/mfa` after the journey’s enrollment step.
- `#claim-search` does not submit on Enter; it `router.replace`s after 260ms. Wait on the reference text.
- `ul[aria-label^="Claims, sorted by"]` is `xl:hidden` and the table is `hidden xl:block`. Both copies of `CMG-2026-0001` stay in the DOM. Assert `.filter({ visible: true })` (expect count 1), not a bare `getByText`.
- Seeded claims are `settlement_offered` / `settled`, so `/admin/intake` is empty until a new public intake. An empty intake queue with heading “Intake queue.” / “The queue is clear.” is success for a fresh seed, not a skip.
- Owner-only routes 404 for adjuster/assistant. Do not treat that 404 as a broken desk.
