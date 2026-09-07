# Packet 1D retired claim search helper

`claimSearchClause` was removed from the shared
`src/lib/claims/search.ts` module during Packet 1D, along with its obsolete unit
tests. It built a client-side PostgREST `or` expression and accepted claimant IDs
collected by a separate query. That design could require an arbitrarily large ID
list and could silently miss claimant-name matches when the preliminary read hit
PostgREST's row ceiling.

Production search now filters on the database-side `claim_search_text(claims)`
computed field introduced by
`supabase/migrations/20260815160000_claim_search_computed_field.sql`. Its query
shape is covered by `src/lib/claims/search-query-shape.test.ts`, while SQL behavior
and authorization are covered by `supabase/tests/21_claim_search.test.sql`.
