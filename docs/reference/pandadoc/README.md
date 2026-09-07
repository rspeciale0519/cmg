# PandaDoc integration reference

The current CMG LOR flow uploads bundled PDFs to PandaDoc.
Template UUIDs are not required.
PandaDoc remains deferred while `SITE_MODE=simple`.

Use the [current integration blueprint](06-cmg-integration-blueprint.md) for code mappings.
Use [PandaDoc setup](../../temp/PANDADOC_SETUP.md) for configuration and approved live tests.
Use [HANDOFF.md](../../temp/HANDOFF.md) for current release evidence and open risks.

## Reference files

Files 01 through 05 contain API notes collected on 2026-08-08.
They are historical reference material.
They do not establish current account access, pricing, provider limits, or CMG release readiness.
Check current [PandaDoc developer documentation](https://developers.pandadoc.com/) before changing the integration.

| File | Scope |
|---|---|
| [01-platform-basics.md](01-platform-basics.md) | Historical account, API key, sandbox, and security notes |
| [02-document-lifecycle.md](02-document-lifecycle.md) | Historical document creation and lifecycle notes |
| [03-sending-and-signing.md](03-sending-and-signing.md) | Historical sending and signing notes |
| [04-webhooks.md](04-webhooks.md) | Historical webhook API notes |
| [05-download-completed.md](05-download-completed.md) | Historical completed-PDF download notes |
| [06-cmg-integration-blueprint.md](06-cmg-integration-blueprint.md) | Current source mapping, PDF flow, and verification requirements |

## Current contract

The single-signer PDF uses PandaDoc role `H1`.
The dual-signer PDF uses `H1` and `H2`.
Internal `Homeowner1` and `Homeowner2` roles map to those external roles.
`src/lib/esign/lor-pdf.ts` controls the mapping.

The provider creates a draft from a bundled PDF.
It waits for `document.draft` before sending.
Signed events and completed PDFs return through the verified webhook.
Database leases and duplicate-detection records protect dispatch and recovery.

A missing API key selects the manual provider in platform mode.
A configured key does not prove that legal approval or hosted acceptance is complete.
Production environment changes require redeployment.

## Live tests and activation

Normal test discovery works without `.env.local`.
An approved live draft test requires shell-only `PANDADOC_LIVE_DRAFT_TEST=1`.
It also requires `PANDADOC_API_KEY` and `PANDADOC_DRAFT_TEST_EMAIL`.
The test creates a real draft and does not send it.
Do not run it automatically.

Keep private MFA, AAL2, role, PandaDoc, retention, export, and erasure checks as platform activation gates.
Public legal approval remains a simple-mode launch prerequisite.
