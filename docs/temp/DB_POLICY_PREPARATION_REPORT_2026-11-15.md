# Database and policy preparation

Prepared November 15, 2026, in the isolated `cmg-law-firm-airtable` checkout.

Coordinator update: the user later approved the separate database scope.
Startup, all three permitted resets, 1,554 SQL assertions, 279 database-backed checks, and seven concurrent checks passed.
Raw database types generated without manual edits. Actual local browser acceptance also passed.
All reset allowances are used. Hosted actions and public policy publication remain unapproved.
The preparation-only notes below are retained history.

## Result

The separate database approval scope and staging helper are prepared.
The privacy and website terms are local drafts.
No database setup, reset, hosted request, deployment, or browser action ran during this preparation.

## Database approval

Use `CMG_LEGAL_AIRTABLE_DISPOSABLE_DB_APPROVAL_2026-11-15.md` for the exact approval request.

The proposed project is `CMGPA_legal_airtable_disposable` on ports `15620–15629`.
The proposed directory is the new sibling `cmg-law-firm-airtable-db`.
Preparation found no matching Docker container, named volume, or listener in that port block.
Recheck these conditions immediately before setup.

The scope permits a new local stack, at most three resets, database tests, and generated TypeScript types.
Tests can remove only their captured synthetic fixtures in this new stack.
The two retained stacks on `15420–15429` and `15520–15529` stay intact.
The new stack and its remaining synthetic data must remain after testing.

Use Supabase CLI `2.116.0` and portable Node `22.22.2`.
Always pass the exact new work directory to Supabase.
Do not use ordinary checkout reset or type-generation scripts against retained data.

The staging helper is `scripts/prepare-legal-airtable-db.ps1`.
It checks the exact source path, refuses an existing target, and rejects source links.
It copies SQL inputs only and records their hashes.
It changes only the copied project identity, port block, local redirect, and provider settings.
It does not copy environment files or credentials.
It has no database, Docker, deletion, or service-start command.
It has not run.

## Policy drafts

New routes:

- `src/app/(marketing)/privacy/page.tsx`
- `src/app/(marketing)/terms/page.tsx`

Shared copy and presentation:

- `src/lib/policies/content.ts`
- `src/lib/policies/availability.ts`
- `src/components/marketing/policy-page.tsx`

Both routes return not-found unless their review gate permits access.
Local development can show drafts with `CMG_POLICY_DRAFTS=true`.
The draft flag cannot expose them on Vercel or under the production runtime.
Draft pages display a visible owner-review notice.

Future publication requires `CMG_PUBLIC_POLICIES_APPROVED=2026-11-15`.
That exact revision requires owner approval before any hosted setting change.
No footer or sitemap link was added.
Both pages remain marked noindex.

The drafts describe actual and planned claim, account, provider, law-firm, and optional Airtable information flows.
They use the existing site contact from `src/lib/site.ts`.
They add no fee terms, liability waiver, legal guarantee, fixed retention schedule, or representation-contract change.
They do not replace a legal review.

## Validation

- Policy availability: 14 tests passed with Node 22.
- The initial missing-module test failed before implementation, as expected.
- Policy routes: 8 tests passed with Node 22 and the unchanged normal fork configuration outside the restricted sandbox.
- Two sandbox fork runs and one command-level thread run started no tests because workers timed out.
- The successful route run retained all assertions, test timeouts, and environment settings.
- Scoped ESLint passed for both routes, the shared component, copy, gate, and tests.
- The final staging helper has zero PowerShell parse errors.
- Helper SHA256: `0AE4459047C111968463378F90F8239156CB97876BEEC1005EE6EE58AF3F28A2`.
- `git diff --check` passed.
- No browser rendering, console, network, full build, or database validation was performed by this preparation task.

The root task owns full application checks and desktop/mobile browser verification.
Database execution remains blocked until the exact approval is received.

## Reviewed guidance

The installed Next.js guides for pages, `notFound`, and `connection` were read before implementation.
Existing marketing components and utility styles were reused.
The CSS reference was read before presentation changes: https://good-css.com.

Airtable's OAuth guide requires public terms, privacy, and support contact information for use outside development.
Source: https://airtable.com/developers/web/api/oauth-reference.

## Next action

Request the exact separate database approval.
Continue local application review while that request is pending.
Keep hosted policy publication, OAuth registration, hosted migrations, and external updates under separate approvals.
