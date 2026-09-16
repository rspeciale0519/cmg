# Contractor intake and vendor links — 2026-09-16

## Local implementation

The shared intake now has four optional contractor fields: name, company, phone, and email.
Homeowner contact, confirmation email, policyholder identity, and consent remain separate.
The form no longer asks for loss time. The API still accepts valid older time values.
New submissions without time store null. Existing loss times remain unchanged.

Each partner company receives a unique random UUID referral code.
Owners can copy its link from the company detail page.
Every link opens the same public intake form, without a vendor directory or different fields.
After rate limits, Turnstile, and validation, the server resolves the code to an active company.
Missing codes permit direct homeowner intake. Invalid, unknown, and inactive codes stop preparation.
Public contractor details and submitted partner IDs cannot select the internal vendor mapping.

The claim stores internal provenance in `intake_referral_partner_id`.
The existing `partner_company_id` access assignment remains separate and unchanged.
Staff see the source vendor in claim details and intake alert emails.
Possession of a referral link grants no account access or claim visibility.
A shared public link identifies a source; it does not prove the submitter works for that vendor.
Deactivation stops new reservations. An existing immutable reservation can finish during its existing lifetime.

## Database rollout and recovery

Three new additive migrations are local only:

- `20260916010000_intake_contractor_details.sql`
- `20260916020000_vendor_intake_links.sql`
- `20260916020100_vendor_intake_link_index.sql`

Apply the migrations before deploying the application. New staff queries require their columns.
The earlier pending claim-reference capacity migration remains a separate hosted release requirement.
Old application versions can run with the added nullable claim columns and defaulted vendor code.
Recovery uses the previous application release while retaining these columns and recorded data.
Use a reviewed forward repair for database defects. An immediate restore is not verified.
The vendor foreign key prevents deleting companies with recorded referral provenance.
Use the existing inactive status to end a relationship while retaining history.

No hosted database change, DNS change, backup, commit, push, merge, or deployment occurred for this feature.

## Verification

- Type checks pass after generated database types were refreshed from the isolated migrated database.
- Lint passes with two existing unused-parameter warnings in `intake-rollback.test.ts`.
- The production build passes with the new vendor link implementation.
- Platform-mode focused tests pass: 9 files, 200 tests. The expanded action-gate suite also passes all 16 tests.
- Isolated database reset passes. All 41 database suites pass, with 1,287 assertions after all migrations.
- SQL tests exercise contractor data and trusted referral provenance through no-file and one-file finalization.
- SQL tests confirm anonymous and partner accounts cannot enumerate vendors or gain claim access from referral attribution.
- Owner link-code reads require MFA. The database tests confirm both refusal without MFA and access with MFA.
- The native browser shows separate optional contractor fields at 1280 and 390 pixels, without horizontal overflow.
- Browser entry accepts the four contractor fields. Loss date and cause remain; loss time is absent.
- A vendor URL renders the same seven public form sections. The public page shows no vendor directory.

The first full test run passed 1,061 tests but failed fixture cleanup because sandboxed Docker access was unavailable.
Five exact synthetic sessions and 13 manifest rows from that run were removed after identity and object checks.
No user claim or stored object was removed.
The full simple-mode rerun with Docker access passes: 100 files and 1,072 tests.
One live PandaDoc test is skipped because it requires explicit live-service configuration.
The full run includes the available local database-backed e-signature, webhook, and storage-cleanup suites.
The isolated test database was stopped with `--no-backup`; its disposable volumes were removed.
The local preview server was stopped after browser inspection. The shared local database was not migrated.

## Remaining acceptance

Local Turnstile verification prevents a new browser submission in the current environment.
New authenticated vendor-link and claim-detail screens still need rendered browser verification against a migrated database.
Hosted acceptance, provider email delivery, and inbox receipt remain unverified for this feature.
The owner deferred Resend sign-in until returning to the office.
Live PandaDoc and other prior launch blockers remain as recorded in `BLOCKERS.md`.
Do not treat these local checks as completion of the full-platform goal.
