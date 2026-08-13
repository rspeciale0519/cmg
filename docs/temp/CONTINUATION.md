# Engineering continuation brief

Last reconciled: 2026-08-13 on `feature/claims-platform`.

Stages 1 and 2 are complete locally; Stage 2 checkpoint is `9419994`. The full continuation goal is not.
Resume the first incomplete requirement
from `GOAL_STATE.md` and `REMAINING_GOAL_SPEC.md`; do not restart completed
packets. The archived pre-reconciliation continuation is at
`archive/docs/temp/pre-mvp-final-reconciliation/CONTINUATION.md`.

## First commands after any interruption

```bash
git status --short --branch
npm run type-check
npm run lint
npm test
npx supabase db reset
npx supabase test db
npm run build
```

Expected authoritative results are recorded in `GOAL_STATE.md`. If a check
differs, diagnose the new failure rather than weakening the assertion.

## Local browser state

- Supabase local stack is seeded and healthy.
- The latest production build is served at `http://localhost:3011`.
- Chrome has isolated current-build customer, partner, and owner contexts and
  must remain open unless the owner approves closing it.
- The local owner account was re-enrolled with TOTP after the Stage 2 reset; a
  later clean database reset removes it.

## Next required work

1. Complete Stage 3 admin/customer/partner craft, all-surface cohesion, CSP
   evidence, and comparable mobile Lighthouse floors.
2. Complete Stage 4 final reconciliation, verification, and checkpoint.
3. Owner acceptance may run in parallel, and any material defect it finds must
   be fixed without weakening auth/RLS, data integrity, or security.
4. After explicit authorization only, publish or deploy through the project Git
   and launch workflows.

Do not create paid/hosted resources or publish repository changes without owner
authorization. Do not delete files; archive superseded material.
