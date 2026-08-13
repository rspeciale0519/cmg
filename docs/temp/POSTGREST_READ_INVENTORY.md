# PostgREST growing-read inventory — Packet 1D

Audited 2026-08-12 after searching every `.from(`, `.rpc(`, `.select(`,
one-to-many embed, and direct `fetch` under `src/`. The classifications below
state why the server's 1,000-row response ceiling cannot silently turn a
complete result into a partial one.

## Exhaustively paged collections

`collectPostgrestPages()` issues stable, explicit, non-overlapping `.range()`
requests and throws on any page error; partial rows never reach a caller.

- Partner referral summaries; customer claims, consent records, and status history.
- Admin actor options and the owner-only account-directory RPC.
- Adjuster and partner-company option lists.
- Complete staff roster used by last-owner/MFA facts; pending staff invites.
- Pending partner and claim-specific claimant invites.
- Claimant summaries for bounded admin claim windows.
- Unlinked claimants invited when intake is accepted.

The 1,001-row regression is `src/lib/supabase/collect-pages.test.ts`; it also
proves a second-page failure throws. `loadClaimantSummaries()` replaced all
one-to-many `claimants(...)` data embeds on the dashboard, claims list, and
intake queue. No one-to-many data embed remains.

Claims search uses the `claim_search_text(claims)` computed field. Claimant
aggregation and matching stay in PostgreSQL, so request size is constant rather
than expanding into an `id.in.(...)` URL proportional to every match.

## Explicit windows and excerpts

- Cursor/offset pages: admin audit, partners, partner reps/claims, staff, claims,
  intake, leads, questions, claim activity/documents/history, customer
  activity/documents.
- Dashboard triage, questions, recent work, and uninvited claimants are labelled
  excerpts with explicit limits and separate exact counts.
- The claim shell reads one ordered claimant for its display name and separately
  requests an exact count.
- LOR dispatch orders by primary/created/id and limits to the two supported
  signer roles; `lor-query-shape.test.ts` pins that query.
- Existence probes use `.limit(1)` or `maybeSingle()`.

## Naturally bounded reads

- `head: true, count: "exact"` requests return no collection data.
- `claim_status_counts()` returns at most one row per finite status enum;
  `allowed_claim_transitions()` is bounded by that enum.
- Audit actor/claim lookups use IDs from the current page only.
- Mutation `.select()` results are bounded by a unique-ID predicate or a
  caller array already capped by file/form validators.
- UUID/unique-column `.single()`/`.maybeSingle()` reads and many-to-one FK embeds
  are single-row by schema.
- Partner company rep/claim embeds are aggregate `count` values, not child arrays.

## Completeness evidence

- `rg -n '\.from\(|\.rpc\(|\.select\(' src`
- `rg -n 'claimants\(' src`
- `rg -n 'fetch\(' src`

The final search found no manual internal `/rest/v1` request. Remaining `fetch`
calls target external HIBP, Turnstile, or PandaDoc APIs. Tests and fixture support
were classified separately from production reads.

## Database-test isolation

Positive authorization assertions now address explicit fixture IDs or compare
baseline/delta/authoritative queries. Whole-table zero counts remain where zero
is the RLS-denial invariant. `04_rls_roles.test.sql` creates unrelated sentinel
claim, claimant, financial, event, document, and lead rows inside its rollback
transaction; the scoped assertions must still pass. Last-owner suites establish
their one-owner premise transactionally. The cleanup-queue suite parks unrelated
due rows for its rollback transaction so a live row cannot consume its batch.
