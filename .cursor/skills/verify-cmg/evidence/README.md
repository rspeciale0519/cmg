# Verification evidence

Proof from a `verify-cmg` drive lives here. Cleanup must not delete this directory.

Each run writes a timestamped subdirectory:

```
evidence/<utc-stamp>-<journey>/
  meta.json
  desktop.png
  mobile-390.png
  console.json
  network-errors.json
  side-effects.json
  playwright.json
```

Do not commit personal data from a live submission. Local seed and synthetic
`*.test` addresses used by the harness are fine to keep as proof of a disposable
stack. Hosted or owner-provided data stays out of git.
