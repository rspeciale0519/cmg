# Actual CMG contract test report

Date: 2026-11-16
Branch: `spike/signudoc-white-label-2026-11-16`

## Result

The real nine-page CMG Single and Dual agreements can pass through SignuDoc's core required-field signing process with synthetic homeowners. This is a successful partial diagnostic, **not a complete CMG integration or launch approval**.

The full CMG field manifests fail: SignuDoc returns HTTP 400, `initials fields are always required`, when CMG's optional authorization fields are included. The subsequent signing diagnostics intentionally exercise only the ordinary required fields. The optional authorization section stays blank and unexecuted. No real agreement should use this reduced mapping.

## What was actually executed

- CMG source and blank legal PDFs from develop commit `950cb27514ce10c92a1b05a4ef87bee9fc627ca2`; SignuDoc v0.2.1 at `bb9bc099151fed39da5de017d9b4cd61b124cbbd`.
- The **actual CMG `buildPrefilledLorPdf` implementation**, not a replacement PDF generator, prepared both original agreements with Avery Synthetic / Blake Synthetic, reserved test email addresses, fictional claim/policy/address information and a fixed test date.
- Every page was marked **SYNTHETIC TEST ONLY - NOT AN EXECUTED AGREEMENT**. Both original PDF assets were verified against their repository Git blob and SHA-256 hashes.
- CMG's existing PDF, prefill, color, authorization and audit-failure tests ran under Node 22.22.2. SignuDoc ran separately against disposable local Postgres and capture-only email. No real email provider or hosted CMG database was connected.
- All 31 downloaded CMG source/configuration files remained byte-for-byte unchanged. The only added CMG test in the isolated snapshot exports the two synthetic prepared agreements.

## Passed checks

| Check | Observed result | Limit |
|---|---|---|
| Targeted CMG tests | **74 passed across six files**: 72 existing tests plus two new actual-asset export cases | Not the entire CMG suite; authorization/service tests mock dependencies |
| Actual Single agreement | Nine pages uploaded unchanged; nine required signer fields completed | Two optional fields unsupported |
| Actual Dual agreement | Nine pages uploaded unchanged; 18 required fields completed by two distinct signers in sequence | Three optional fields unsupported |
| Signer safety | Consent required; partial required-field submission refused; replay refused; second signer not invited before first completed | HTTP checks, not browser taps |
| Document/template access | Anonymous upload/download refused; another verified synthetic sender could not access/edit documents, download results or use another user's template | Per-user isolation in one installation, not proven multi-firm isolation |
| Template mechanism | Save and reuse worked with both layouts | Diagnostic templates contain synthetic prefilled data; production templates must never retain a previous homeowner's data |
| Audit | Hash chains verified; deliberately changed synthetic audit metadata was detected; restoration verified | Does not make the database immutable or replace a security review |
| Final artifacts | Signed agreement and evidence PDF generated for both variants; stored hash found; altered hash rejected | No claim filing or live provider callback exists yet |
| Independent seals | All four artifact seals validated with `pdfsig` | Self-signed issuer unknown; not a trusted homeowner identity certificate |
| All-page PDF inspection | All 18 legal background images preserved exactly; all watermarks remained; zero pixel changes outside padded signing fields compared with each prepared unsigned copy | 2x raster comparison with 10pt padding; not legal or phone acceptance |

The single-signer audit contained nine chained events; the dual-signer audit contained 14. Machine-readable hashes, manifests, logs, source checksums and page-by-page results accompany this report.

## Failed or blocked

1. **Full agreement field support — product incompatibility confirmed.** Single's full manifest has 11 fields and Dual's has 21. Both fail HTTP 400 because optional initials are prohibited. Preserve the homeowner's genuine choice; do not require, prefill, copy, or silently remove this authorization. Implement optionality across schema, editor, signer UI, remaining-field count, submit validation and final rendering, then retest chosen and declined paths for both layouts.
2. **Complete CMG claim workflow — not implemented.** There is no authenticated SignuDoc provider bridge in CMG. The existing claim authorization/preparation tests passed with mocked services, followed by a separate real SignuDoc HTTP diagnostic. This did not exercise a deployed CMG claim screen, an actual hosted CMG session/database, live dispatch ledger, automatic status update, or private claim filing.
3. **Browser/phone signing — environment blocked.** A temporary local app passed its readiness check and two fresh synthetic actual-contract UI envelopes were prepared. The managed browser could not reach that execution environment's loopback server: `net::ERR_CONNECTION_REFUSED` at localhost:3187. Earlier execution-side Chromium aborted at `process_singleton_posix.cc:297: socket() failed: Operation not permitted`. No visual signing journey, 390px emulation, physical phone, touch signing, browser refresh/network-loss path or keyboard acceptance is claimed. A test reporter's project label “chromium” does not mean the HTTP-only scenario launched a browser.
4. **Dates need integrated acceptance.** CMG's existing builder prefills ordinary dates. These diagnostics used a fixed date and completed the same day. Agreement date policy, cross-day completion, time zones and two signers on different days remain unverified.
5. **Release gates remain open.** Firm isolation, secure bridge/service authentication, idempotent dispatch/reconciliation, reminder controls, template approval, signing-key ownership/trust, restore/retention, independent security and counsel review must pass the launch plan. The earlier pinned dependency audit issue is still open; no dependency was silently upgraded.

## Safe next steps for the CMG team

1. Intake this existing branch into the current development process without merging the branch's Vercel suppression blindly.
2. Resolve optional authorization with failing tests first, including blank optional dates and independent choices by two homeowners.
3. Implement the feature-disabled, authenticated provider bridge using CMG's current claim authorization, dispatch/audit/outbox and private-storage safeguards.
4. Repeat these actual-asset tests and add real persistence tests for pending signers, duplicate/lost sends, reminders, callbacks and final filing.
5. Run actual one- and two-homeowner signing through the integrated claim UI in an approved reachable test environment, then on supported physical phones. Inspect every final page and audit certificate.
6. Complete the ordered release gates before requesting a pilot or changing PandaDoc.

## Scope and publication

No production setting, provider default, hosted database, legal wording, PandaDoc workflow or customer record changed. No agreement was sent externally. Temporary test servers were stopped.

The replay source is archived with `.txt` suffixes to avoid CMG's automatic TypeScript/lint/test discovery. Read [replay instructions](README.md) before running it. Captured signing URLs, tokens, cookies, outboxes, private keys, database files and dependency trees are excluded. The actual binary agreements are already CMG repository assets; generated synthetic PDF evidence is supplied separately rather than duplicated into Git history.

See [the ordered launch plan](../../../superpowers/plans/2026-11-16-cmg-signudoc-launch.md) for dependencies, acceptance criteria and release decisions.

