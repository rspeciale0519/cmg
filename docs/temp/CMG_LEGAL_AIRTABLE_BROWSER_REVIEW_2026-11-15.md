# Local browser review: legal handoff and Airtable

## Scope

This review used native Browser developer access. It did not use Computer Use.
It used a separate local page at `http://127.0.0.1:4198/`.
The page rendered the actual new components and application styles with synthetic data and mocked actions.
It did not use a signed-in application session or a database.

The harness blocked real server actions, external requests, form navigation, and actual downloads.
Its static server accepted only GET and HEAD for bounded built files on loopback.
The harness request guard passed 28 checks. Its build passed.

The browser tab remains open. The original viewport was restored.
Existing tabs and logins were not changed.

## Results

- Reviewed legal directory, preparation, milestone, package, company connection, claim sharing, update review, homeowner progress, and policy draft views.
- Checked desktop width and 390px. None of the reviewed phone views had horizontal overflow.
- Checked relevant empty, loading, refusal, and success displays using mocked actions.
- Confirmed the package button stays disabled without selected documents.
- Confirmed the package selection and note remain after successful preparation.
- Confirmed Returned to CMG, the entered date, the selected return stage, and the confirmation remain after refusal.
- Confirmed the selected Airtable base and table remain after discovery and saving.
- Confirmed general text fields no longer offer incompatible email columns.
- Confirmed shared-message text and confirmation remain after refusal.
- Confirmed the save button becomes disabled while the synthetic request is pending.
- Confirmed review values use plain status labels and visibly identify a selected cell that will be cleared.
- Confirmed the homeowner card shows actual legal milestones and the accepted firm's contact details.
- Generated a local package using synthetic original bytes. The harness intercepted its final download click; no file was downloaded.
- Generated a four-page Unicode summary using the actual package summary function.
- Inspected images decoded from that PDF, including Unicode text, long-word wrapping, page breaks, and the final line.

These observations found and drove the form-reset and mapping corrections recorded in the implementation reports.
The final static browser run reported no new console warnings or errors.
The available network events showed successful local assets and no failed request.
The network buffer reported truncation, including on the final short navigation. A complete request trace is unverified.

## Harness issues and retained evidence

The development harness briefly refused an unmocked new action. The action guard stopped the bundle before execution.
The harness then received the explicit mock for the new pause action.
Vite's running dependency optimizer also returned stale CommonJS export errors after review-only PDF changes.
The built bundle passed. Serving that immutable bundle resolved the harness issue without changing application source or deleting caches.

The PDF generation click exceeded the browser tool's command wait while synchronous rendering continued.
The next DOM read confirmed four completed pages. The click was not repeated within the same generation session.
The PDF images were inspected through screenshots of the local page.
Early image copies named `unicode-pdf-page-*.png` are incomplete because the tool truncated large DOM strings.
They are not evidence of a malformed application PDF. They remain retained and must not be used as final artifacts.

Evidence directory:
`C:/Users/rob/.codex/visualizations/2026/11/01/01a19512-82bb-71a2-8d71-83374c0d0f60/cmg-law-firm-airtable-ui-review`.

- `BROWSER_REVIEW_RESULT.json`: 30 recorded observations and explicit evidence limits.
- `BUILT_REVIEW_REPORT.md`: bundle hash, build time, and final-source checks.
- `airtable-review-desktop.jpg` and `airtable-review-phone.jpg`: review controls.
- `airtable-company-phone.jpg`, `legal-active-phone.jpg`, and `portal-phone.jpg`: phone layouts.
- `unicode-summary-final.jpg` and `summary-page-*.jpg`: actual generated PDF image review.

## Unverified acceptance

This harness does not prove real application routes, authenticated role checks, all three site modes, RLS, database transactions, queue delivery, or provider access.
Those checks require the remaining isolated database work and separately approved hosted acceptance.
No email, Airtable update, account change, hosted upload, deployment, backup, or cleanup ran.
Cleanup remains blocked.
