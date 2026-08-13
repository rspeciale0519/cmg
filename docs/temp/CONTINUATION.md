# Engineering continuation brief

Last reconciled: 2026-08-13 on `feature/claims-platform`.

Stages 1–4 are complete locally. Checkpoints are `7a21209` (Stage 1), `9419994`
(Stage 2), and `bb958a0` (Stage 3); the final Stage 4 documentation checkpoint
is the only remaining local action when this paragraph is read. Do not restart
completed packets. The archived pre-reconciliation continuation is at
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
- The Stage 3 clean reset removed local MFA factors. Re-enroll the seeded owner
  before the final authenticated staff browser smoke.

## Next required work

1. Create/confirm the final Stage 4 documentation checkpoint.
2. Owner acceptance may continue, and any material defect it finds must be fixed
   without weakening auth/RLS, data integrity, or security.
3. After explicit authorization only, publish or deploy through the project Git
   and launch workflows described in README/HANDOFF/BLOCKERS.

Do not create paid/hosted resources or publish repository changes without owner
authorization. Do not delete files; archive superseded material.
