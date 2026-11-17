# CMG's isolated SignuDoc service

SignuDoc remains a separate Node 24 application; CMG remains its existing Node 22 application. This directory preserves maintained patches against the exact upstream revision in PINNED_UPSTREAM.json. It does not start or deploy a service or change the live provider.

## Step 1: optional authorization — implemented and server-tested

Apply patches in listed order to a clean checkout of the pinned public upstream repository. Preserve LICENSE.upstream and upstream's third-party notices.

The first patch lets senders retain optional signatures, initials and dates. Ordinary signing fields remain required by default. An optional date stays blank unless its signer explicitly selects it; the date value itself is supplied by the server. Optional signature/initial entries can be cleared before submission.

Evidence records 290 passing unit tests, 150 passing Postgres tests, TypeScript/build success, and lint success with five existing warnings. The new tests failed before the change.

The actual nine-page CMG contracts completed five capture-only HTTP cases: Single declined/accepted; Dual declined/accepted; Dual with the first homeowner declining and the second accepting optional authorization. The full 11/21-field manifests were used. Checks inspected persisted optional values, consent, required fields, sequential signing, access refusals, replay, hashes and audit tampering. All 45 final pages retained original legal images and watermarks; declined optional areas remained visually unchanged. All ten artifact seals validated, with self-signed/unknown certificate issuers.

This is server-side evidence. Browser/mobile acceptance is deferred at Rob's request and remains required before live use. The existing same-day/date-policy limitation and security/legal/operational release gates remain open.

## Step 2: CMG connection — in progress

The authenticated CMG connection will be implemented next, preserving claim authorization, dispatch ownership, ambiguous-send safeguards and private document filing. The existing PandaDoc/manual defaults remain unchanged unless the experimental feature is deliberately configured later.

See ../../docs/experiments/signudoc/IMPLEMENTATION.md and the launch plan for status. The existing experiment branch has Vercel Git deployments disabled. Nothing in this directory authorizes a hosted test, production activation, real agreement, real message, merge or deployment.
