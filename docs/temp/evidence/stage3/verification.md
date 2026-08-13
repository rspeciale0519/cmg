# Stage 3 verification evidence

Recorded 2026-08-13 against the local production build at
`http://localhost:3011`. Nothing was deployed or connected to a hosted service.

## Craft convergence

- Admin: final two valid fresh rounds returned `MINOR GAPS ONLY`. Exact CSS
  widths 390, 1080, and 1440 showed no document overflow; semantic claim cards
  render below `xl` and the complete table renders at `xl+`. The remaining
  clipped mobile-nav edge remnant is critic-rated minor.
- Customer: final two fresh rounds returned `MINOR GAPS ONLY`. Exact 390 and
  1440 output had no overflow; persistent claim navigation, consent disclosure,
  assigned-adjuster/office-contact wording, focus, loading/empty states, and
  password-manager metadata passed. The remaining desktop profile whitespace
  imbalance is critic-rated minor.
- Partner: three consecutive fresh rounds returned `MINOR GAPS ONLY`. Exact 390
  and 1440 output across list, detail, activity, referral, and profile routes
  remained coherent. The scroll rail is now a bounded 350px container with
  415px internal content while the 390px document stays exactly 390px wide.

Screenshots:

- `docs/temp/media/progress/stage3-admin-claims-mobile.jpeg`
- `docs/temp/media/progress/stage3-customer-overview-mobile.jpeg`
- `docs/temp/media/progress/stage3-partner-list-mobile.jpeg`

## Mobile Lighthouse

Both reports are navigation-mode, mobile-form-factor runs using Lighthouse
simulated throttling against `/` on the production server.

| Run | Performance | Accessibility | FCP | LCP | CLS | TBT |
|---|---:|---:|---:|---:|---:|---:|
| `lighthouse-mobile-run1.json` | 93 | 100 | 1,100 ms | 2,996 ms | 0 | 158 ms |
| `lighthouse-mobile-run2.json` | 90 | 100 | 1,099 ms | 3,083 ms | 0 | 220 ms |

The lower comparable scores are performance **90** and accessibility **100**,
above the required 85/95 floors. The raw reports are stored beside this file.

## CSP and headers

Chrome fetched `/` from the production server and observed:

- enforcing `Content-Security-Policy`; no report-only policy;
- `script-src 'self' 'nonce-…' 'strict-dynamic'` with no script
  `'unsafe-inline'`;
- all 12 rendered scripts carried a nonce;
- Cloudflare challenge script/frame and Supabase HTTP/WebSocket origins remain
  explicitly allowed;
- `frame-ancestors 'none'`, `object-src 'none'`, `base-uri 'self'`, and
  `form-action 'self'`;
- HSTS, `nosniff`, strict-origin referrer policy, and restrictive permissions
  policy;
- successful hydration and no representative Chrome console warnings, errors,
  issues, or CSP violations on marketing, admin, customer, and partner routes.

The local policy deliberately omits `upgrade-insecure-requests` so localhost
assets continue to load; hosted requests retain it. Inline styles remain
allowed because the current Tailwind/React rendering path needs them, while
scripts use the stronger per-request nonce policy.
