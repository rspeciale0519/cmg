# Continuation brief — CMG Property Solutions claims platform

**For whoever picks up this build.** Written 12 Aug 2026 at commit `78ce237` on
branch `feature/claims-platform`.

This is not the owner runbook — that is `HANDOFF.md`, and writing it is one of
the remaining tasks. This document is the engineering handoff: what exists, what
is left, and the things that will waste your first four hours if nobody tells
you.

Read `.claude/plans/feature-claims-platform.md` (the design authority, §4 data
model, §5 lifecycle, §6 flows, §7 security) and `docs/temp/AUTOPILOT_SPEC.md`
(the execution contract, including the gauntlet protocol) before starting. This
brief assumes both.

---

## 1. State at a glance

| | |
|---|---|
| Branch | `feature/claims-platform`, 50 commits, never merged to `develop` or `main` |
| Phases 0–7 | complete, each with a checkpoint commit |
| Phase 8 | partially complete — see §4 |
| Phase 9 | not started |
| `npm run type-check` | exits 0 |
| `npm run lint` | exits 0 |
| `npm test` | 597 tests across 45 files, exits 0 |
| `npm run build` | exits 0 |
| `npx supabase test db` | 691 assertions across 18 files, PASS **on a freshly reset database** |
| `npm audit` | 0 vulnerabilities, production and full tree |

**Stack.** Next.js 16.3.0 (App Router; `src/proxy.ts` replaces `middleware.ts`;
async `cookies()`/`params`), React 19.2.8, TypeScript 6.0.3 strict, Tailwind
v4.3.3 (`@theme` tokens, `@utility`), Supabase (Postgres 17, `@supabase/ssr`
0.12.4), zod 4, Vitest 4, pgTAP.

Version pins that are load-bearing and must not be "updated": TypeScript is held
at `^6.0.3` because typescript-eslint's peer range is `>=4.8.4 <6.1.0`; ESLint is
held at `^9.39.5` because `eslint-plugin-react` calls a context API ESLint 10
removed. Both are documented in `docs/temp/PROGRESS.md` under Phase 0.

---

## 2. Running it

```bash
npm install
npx supabase start          # local Docker Postgres + GoTrue + storage
npx supabase db reset       # applies migrations and seeds
npm run dev                 # http://localhost:3000 (or 3100 if that is taken)
```

`.env.local` already holds working local values. Production Supabase credentials
are present but deliberately prefixed `PROD_*` so they are inert — do not rename
them without understanding that dotenv is later-wins and the app would then write
to production with a service-role key.

### Seeded accounts

All use password `CmgDev!2026`.

| Email | Role | MFA |
|---|---|---|
| `owner@cmg.test` | owner | required |
| `adjuster@cmg.test` | adjuster | required |
| `assistant@cmg.test` | assistant | required |
| `customer@cmg.test` | customer | none |
| `partner@cmg.test` | partner | none |

**Staff MFA is enforced in Postgres, not just in the proxy** —
`private.current_app_role()` returns NULL for a staff member below aal2, so an
aal1 token reads nothing. Do not "simplify" that; it was a real vulnerability
(an aal1 token read every claim and escalated an adjuster to owner).

**`supabase db reset` wipes enrolled TOTP factors.** To get back into `/admin`:
sign in, click "Set up authenticator", read the secret the page prints, then

```bash
node "<scratch>/totp.mjs" <SECRET>
```

`totp.mjs` is a 40-line TOTP implementation left in the session scratchpad; if it
is gone, any TOTP library or `oathtool` does the same job. Enter the `code` it
prints. Re-enrol after every reset.

---

## 3. What exists

| Phase | Shipped |
|---|---|
| 0 | Repo, tooling, design tokens ported verbatim from the prototypes |
| 1 | Schema, RLS deny-by-default, triggers, pgTAP suite |
| 2 | Marketing site (6 routes) + public intake and contact forms |
| 3 | Auth: invites, MFA, route gating, `requireUser/requireRole/requireStaff/requireClaimAccess` |
| 4 | Admin workspace — dashboard, intake queue, leads, questions, claims list, claim detail (6 tabs), partners, staff, audit, settings; PandaDoc e-signature layer behind `ESignProvider` |
| 5 | Customer portal — claims, progress ladder, activity, documents, profile, consents |
| 6 | Partner system — companies, rep invites, projection, portal, `/partner/refer` |
| 7 | Notifications — 13 templates, outbox wired to every event, `/api/cron/outbox` sweeper |
| 8 | *(partial)* security headers, secret-leak proof, `npm audit` |

---

## 4. What is left

In the order I would do it.

### 4.1 Craft gates (gate B) — the largest remaining item

The gauntlet protocol requires, per surface: **2 consecutive rounds judged
equal-or-better, or 3 consecutive rounds naming only minors.**

| Surface | Rounds run | Streak | Status |
|---|---|---|---|
| Marketing | converged in Phase 2 | — | **done** |
| Admin workspace | 9–19 (11 rounds) | 1 minor-only (R19) | needs 2 more minor-only rounds |
| Customer portal + partner | 1–3 | 1 minor-only (R3) | needs 2 more minor-only rounds |

So: **~4 more rounds minimum**, plus a fix pass after each. Realistically 4–8,
because of the pattern in §6.

Every round's findings are fixed and committed; nothing is outstanding from
rounds 1–19 or portal rounds 1–3. Round 3's five minors were fixed in `f1c62dc`
and have **not yet been re-verified by a round 4** — that is the next action.

### 4.2 Phase 8 — hardening and cohesion

Done:
- [x] `npm audit` clean (0 vulnerabilities, prod and full tree)
- [x] No secret leakage into the client bundle — no server-only env var name
      appears in `.next/static`
- [x] **`docs/RETENTION.md`** — every table, with the periods argued rather than
      asserted. Read the `storage_cleanup_queue` section: it is where the design
      and the code disagree, and it is §7.2's first minor.

Remaining:
- [ ] **Finish or decide the CSP.** It currently ships as
      `Content-Security-Policy-Report-Only`, and `next.config.ts` says at length
      why: enforcing it blocks Next's inline streaming bootstrap and the app does
      not hydrate. Two ways out — a per-request nonce from `src/proxy.ts` (tight
      policy, but every page becomes dynamic and the marketing site loses the
      prerendering Phase 2 bought), or `'unsafe-inline'` on `script-src` (nothing
      breaks, most of the value is gone, and it contradicts spec §7.6). **This is
      a judgement call, not a task** — make it deliberately. Whichever you pick,
      re-open the app in a browser and check the console: the build passed and
      all seven headers were served correctly while the page was completely
      broken, which is exactly how this was nearly missed.
- [ ] **Cohesion round** — a gauntlet loop across all four surfaces at once,
      looking for inconsistency *between* them rather than defects within one.
      Must converge on the same rule as gate B.
- [ ] **Lighthouse re-verified** — see the open performance item in §5.
- [ ] **Backend architecture re-review (gate C)** — the first review has returned
      MAJORS REMAIN. The major is fixed; §7 has the eleven open minors. Gate C
      needs a fresh-context re-review returning NO MAJORS before it converges.

### 4.3 Phase 9 — launch prep

- [ ] `vercel.json` (or `vercel.ts` — note the platform now prefers the latter)
      plus a deploy runbook. Must include the cron schedule for
      `/api/cron/outbox`; the route documents what it expects.
- [x] `docs/temp/HANDOFF.md` — the owner runbook. Written: nine owner-supplied
      steps in dependency order, covering every item in `BLOCKERS.md`, with the
      six launch-blocking ones separated from the three that have working
      fallbacks. **It has one forward reference you must satisfy** — it tells the
      owner that queued email will not send until the `vercel.json` above exists.
      Update that note when you build it.
- [ ] `docs/temp/BLOCKERS.md` — exists and is good; re-check it is current at
      the end.

---

## 5. Known issues, not yet fixed

Each of these is real, understood, and deliberately left. None is a blocker for
continuing.

1. **pgTAP asserts absolute row counts.** Any row created through the UI fails a
   dozen assertions until the next `db reset`. Always run
   `npx supabase db reset && npx supabase test db` together, and never trust a
   pgTAP failure until you have reset. Worth converting to relative counts
   before this suite runs in CI against a shared database.

2. **Lighthouse performance is 71 against the spec's ≥85 gate.** The same build
   scores 89 at 2× CPU throttling and 92 at 1×; this host's `benchmarkIndex` is
   roughly half a normal runner's. Accessibility is 100. Re-measure on real
   hardware before treating it as a defect — it is recorded in `PROGRESS.md`
   under Phase 2 with the numbers.

3. **Workspace 404s answer HTTP 200.** `admin/loading.tsx` flushes the shell
   before the page runs, and a status cannot be set after the first byte. Argued
   in `src/app/(admin)/admin/[...unmatched]/page.tsx`. Buying the status back
   costs the skeleton on every slow navigation under `/admin`, for a header
   nothing behind auth and `noindex` reads.

4. **A partner sees a referral before CMG has vetted it.**
   `refresh_claim_partner_summary()` projects on `partner_company_id is not
   null` and asks nothing about status, so a referral appears on the rep's list
   immediately reading "new intake". The copy was made to match the system. If
   the business wants it hidden until accepted, change the trigger, not the
   copy.

5. **No screen corrects a claim's carrier after accept — resolved, but check
   the sibling.** `PolicyForm` now does this. There is still no way to correct
   the *loss date or cause* after accept.

6. **`claims.loss_time` still defaults to noon.** The NOT NULL is gone and
   `referClaim` passes an explicit null, but any future caller that omits the
   column gets a fabricated 12:00. Consider dropping the default.

7. **A `shared` staff note emails the homeowner but not the partner.** Partners
   are emailed on status milestones only, which is what the spec lists — but the
   asymmetry is worth a decision rather than an accident.

8. **`claims.esign_status` has no UI reader.** The webhook handler writes
   `document.declined`, `document.voided` and `document.creation_failed`, and
   nothing renders them. Harmless while the provider is Manual; under a real
   PandaDoc key a dead signature request would surface only as one internal line
   on the Activity tab while the pill still reads "LOR sent".

9. **No real email has ever been sent.** There is no Resend key and none was
   created. `resendSender` is exercised only by unit tests with an injected
   sender. Claim, backoff, dead-letter and concurrency are all verified against
   the real database.

---

## 6. How to run a craft round — read this before you write the brief

Twelve rounds' worth of hard-won process. The single most important finding:

> **Every round that opens an axis nobody has examined finds a major on the first
> pass. Every re-tread finds minors.**

Axes already opened and closed: layout at 390/1440/320 · the whole colour system
at rest and in hovered/focus-within rows · the keyboard and the sticky column ·
the adjuster and assistant roles · deep links into paged and filtered states ·
`prefers-reduced-motion` · the accessibility tree · back/forward after a server
action · error and not-found boundaries · double-submit · large default font ·
interrupted submissions · controlled radios versus React's post-action reset ·
printing · the PandaDoc layer in manual mode · the ten lifecycle statuses ·
`<title>` and metadata · time and timezone rendering.

Axes **not** yet opened: RTL / `dir="rtl"` · a very long session (listener and
router-cache growth, `aria-live` repetition) · upload failure mid-flight · the
marketing site read against the two portals as one product · text selection and
copy-paste out of a table · two staff members editing the same row concurrently.

**Rules that made the rounds work:**

- The critic must be a **fresh-context subagent**, never the person who wrote the
  code. Give it a self-contained brief.
- Tell it what earlier rounds fixed, so it verifies rather than re-reports.
- Tell it what is **known and deliberate** (there is a list in each recent round
  brief — column headers at `ink/40`, the em-dash absence mark, the pipeline's
  dimmed empty stages, the Questions nav item's absent badge, the 200-status
  404s). Otherwise you will re-litigate them every round.
- Demand a number, a quoted DOM fact, or a quoted line of source per finding.
  "A finding without evidence is not a finding" is in every brief and it works.
- Never coach the critic toward a clean verdict, and never suppress a finding to
  close a gate.

### Harness facts that will otherwise cost you hours

These are properties of the automation environment, not defects:

1. **Screenshots do not work** — the browser pane is hidden. Measure with
   `javascript_tool` (`getBoundingClientRect`, `getComputedStyle`, canvas
   compositing for contrast) and `read_page`.
2. **Streamed content does not reveal itself.** `requestAnimationFrame` never
   fires, so a full page load can sit on "Loading" with the real content inside
   a `<div hidden>`. After every full navigation run:
   ```js
   (() => { window.$RT = performance.now(); const p = window.$RB || []; window.$RB = []; if (p.length) window.$RV(p); return !document.body.firstElementChild.hidden; })()
   ```
   React does **not** hydrate content in that hidden container, so to test any
   client behaviour, navigate by **clicking in-app links** instead.
3. **The router cache serves stale markup** after a source edit. Use a full URL
   when you need certainty.
4. **`document.hasFocus()` is false**, so `:focus-visible` never matches. Read
   the CSS rule rather than trying to observe a ring.
5. **CSS transitions are frozen**, so `getComputedStyle` returns the
   *pre-transition* value for any transitioned property. Clone the node in place
   and measure the clone.
6. **Contrast maths:** computed colours are `oklab(...)` with alpha and panels
   have translucent fills, so string-parsing gives wrong ratios. Composite the
   whole ancestor background stack through a `<canvas>`. A working helper is in
   several round briefs in the transcript.

---

## 7. Backend architecture review (gate C)

The review that was running when this brief was first written has returned.
**Verdict: MAJORS REMAIN — one major, eleven minors.** The major is fixed and
committed (`eff63ea`); the minors are open and are the list below.

Provenance, because it changes how much you should trust each line: items **1,
3, 5, 6 and 7** were re-checked against the source before being written down, and
their file and line numbers were read rather than relayed. Items **2, 4, 8, 9,
10 and 11** are the review's own wording and have not been independently
confirmed — verify before acting.

Gate C is therefore **not converged**: the protocol needs a re-review from a
fresh context that returns NO MAJORS. Re-run it after working the list.

### 7.1 The major — fixed

**Multi-file upload could leave a `documents` row whose bytes had been deleted.**
`uploadClaimDocument` and `uploadPortalDocument` each uploaded one object and
committed its row per iteration, while the rollback list `stored` accumulated
across the whole loop. A failure on file three removed the bytes of files one and
two and deleted no rows. The claim then showed three documents, two of which
produced a signed URL against a missing object — and
`issueDocumentDownload` wrote `document.signed_url_issued` into `audit_log` on
the way, so the trail asserted the file had been released. There is no repair
from the UI once the claim is past the gate, because `documents_delete` refuses
an `lor_signed` row by then.

Fixed by adopting the shape `submitIntake` already used: upload every object,
then insert every row in **one** statement. One statement is one transaction, so
on failure no row survived — which is what makes removing the whole batch of
objects correct rather than merely careful.

`src/lib/actions/upload-rollback.test.ts` pins it for both surfaces. It models
the bucket as a set of paths and the table as an array of rows and asserts from
the rows outward — every surviving row's `storage_path` must still name a live
object. The insert double accepts a single row as well as an array on purpose,
so the test is not itself asserting the fix: **run against the pre-fix code it
fails 2 of 10, both `expected [ …, … ] to have a length of +0 but got 2`.** That
was verified, not assumed.

### 7.2 The minors — open, in the order I would take them

The first four are behavioural. The rest are hardening.

1. **Nothing drains `storage_cleanup_queue`.** The delete trigger fills it and
   `docs/RETENTION.md` describes it as self-draining. It is not: no code removes
   the objects it names. Every deleted document's bytes stay in the bucket
   forever. Either build the drainer (a route like `/api/cron/outbox`, service
   role, delete-on-success) or correct RETENTION.md — but do not leave the
   document saying a mechanism exists when it does not.

2. **The PandaDoc dedupe marker is committed before the work it protects.**
   `pandadoc_webhook_events` gets its row first, so a handler that then throws
   has already told the next delivery of the same event that it was handled.
   PandaDoc retries; the retry is dropped. Write the marker after the work, or
   make it a claim (insert `processing`, update to `done`) so a crash is
   distinguishable from a success.

3. **The outbox sweeper claims 25 and sends serially with no `maxDuration`.**
   `/api/cron/outbox` has `runtime = "nodejs"` and `dynamic = "force-dynamic"`
   and no duration cap. Twenty-five sequential Resend calls on a slow provider
   can exceed the platform default; the lease is 300s, so a timed-out batch
   re-sends after the lease expires. Set `maxDuration` explicitly and size the
   batch against it, or send concurrently with a small pool.

4. **`issueInvite` reports success when the enqueue failed.** The invite row is
   written, the email is queued, and a queue failure is swallowed — the operator
   is told the invitation was sent. `referClaim` already solved this shape: it
   returns success (the claim is committed) with a message that says the alert
   could not be queued. Copy that. Same defect on the webhook's staff alert,
   which is lost silently with nothing on screen at all.

5. **`RESEND_API_KEY` is read untrimmed in three places.**
   `src/lib/email/outbox.ts:44` trims it, with a comment explaining that
   `RESEND_API_KEY=""` is how "not configured" is written. `invite.ts:113`,
   `partners.ts:370` and `staff.ts:315` use bare `Boolean(process.env.…)`. A key
   set to whitespace makes those three claim deliverability while the outbox
   declines to send, so the invite link is *not* handed back on screen and the
   mail never leaves. Export the trimmed helper and use it in all four.

6. **Turnstile is verified before the rate limit on the two public forms.**
   `intake.ts` (turnstile line 44, rate limit line 54) and `contact.ts` (33, 43)
   spend a Cloudflare verification on a submission they are about to refuse.
   `referral.ts` has it the right way round at lines 79 and 95, and
   `referral.test.ts` already asserts it — "does not spend a verification request
   on a submission it has already refused". Reorder the two, copy the test.

7. **`renderNotification` indexes `TEMPLATES` without a guard.**
   `src/lib/email/render.tsx:150`. `isNotificationTemplate` exists two lines above
   and uses `Object.hasOwn`; the renderer does not use it, so a template name
   reaching it off the enum path would return a prototype member. Callers read
   `template` from an enum-constrained column today, so this is defence in depth
   — but `validators/files.ts` documents the identical prototype-chain hole being
   live once, which is why it is on the list.

8. **`issueClaimantInvite`'s `canManage` branch is untested.** The authorization
   decision has no unit test and no pgTAP coverage.

9. **The storage helper functions are tested but never called.** Dead code with a
   test suite reads as covered surface. Either wire them or archive them.

10. **`claims.carrier` invariants live only in comments.** The columns are
    nullable since the partner-referral migration, and what may be null when is
    stated in prose. The `lor_sent` gate is enforced in
    `enforce_claim_status_transition()`; the rest is convention.

11. **Reads are unbounded against PostgREST's `max_rows = 1000`.** Several list
    queries have no explicit `.range()`, so at 1001 rows they silently return the
    first thousand and the page says nothing. The paginated lists are fine; the
    unpaginated ones are the exposure.

### 7.3 What the review confirmed as sound

Worth recording so a later round does not re-litigate it: RLS as the boundary
with service-role confined to tables that carry no `authenticated` policy by
design; the claim-then-send outbox RPC with `for update skip locked`; the
signed-URL two-step (authorize under RLS, then mint, then audit); the status
machine and its `lor_signed` document gate; and the append-only `audit_log`.

---

## 8. Conventions you must not break

These were each bought with a real defect. Breaking one silently reintroduces it.

1. **RLS is the boundary; TypeScript produces sentences.** Every action reads and
   writes through the *caller's* client so a policy decides. Service-role is used
   only for tables with no policy for `authenticated` by design (`audit_log`,
   `notifications_outbox`) and for the public forms. A TS check that becomes
   load-bearing is a bug.

2. **Every refusal echoes what was submitted.** React 19 resets a
   `<form action>` when the action *resolves*, not when it succeeds — so without
   `FormState.values` a refusal silently erases the operator's typing.
   `submittedValues()` and the `values` field exist for this.

3. **Every `useActionState` call site wraps its action in `resilient()`.**
   `useActionState` does not catch; a rejected promise is re-thrown during render
   and blows the page to the error boundary, losing the work. 31 call sites go
   through the wrapper. It re-throws Next's `redirect()`/`notFound()`, which
   signal by throwing.

4. **A controlled radio does not survive the post-action reset.** React clears
   `.checked` and does not re-render. Mirror the selection into a hidden input
   (see `status-advance.tsx` and `event-composer.tsx`), and give the radios a
   name nothing reads.

5. **An uncontrolled `<select>` needs `key={defaultValue}`** to re-apply an
   echoed default. React does this for inputs and textareas but not selects.

6. **`cx()` concatenates; it does not merge.** Two single-class Tailwind colour
   utilities are equal specificity, so emit order decides. Never let a call site
   pass a colour that competes with a component's own — use a prop (see
   `Td`'s `tone`).

7. **Contrast floor is 4.5:1 for text under 18.66px, measured in the *lit*
   state** — rows light on hover and stay lit on `focus-within`. Three
   exceptions are argued in writing in the source; everything else meets it.

8. **Date comparisons go through `America/New_York`.** `businessToday()` in
   `src/lib/validators/loss-date-bounds.ts`. A UTC day made the intake form
   accept a next-day loss date for four hours every evening.

9. **`audit_log` is append-only.** No update or delete policy exists. Never add
   one.

10. **Comments explain *why*, in prose, and only where the reason is not obvious
    from the code.** This codebase's comments are unusually dense with rationale
    — that is deliberate, and it is why several defects were caught by a critic
    noticing a comment claimed something the code did not do. Do not add
    explanatory comments to self-evident lines, and do not let a comment outlive
    the behaviour it describes.

---

## 9. Owner-gated blockers

`docs/temp/BLOCKERS.md` carries the full detail and exact unblock steps. In
short, four items need the owner and cannot be resolved in code:

1. **Two photographs** for the `ImageSlot` placeholders on `/` and `/about`.
2. **Real Cloudflare Turnstile keys** — the test pair is wired in and paints a
   red "For testing only" badge on `/contact` and `/file-a-claim`, and accepts
   every submission. **Launch blocker.**
3. **Supabase leaked-password protection and MFA** — hosted Pro-plan settings.
4. **PandaDoc account, template and webhook subscription** — the e-signature
   layer runs in `ManualSignProvider` fallback until then, which is a supported
   mode, not a broken one.

Add to that list, from Phase 7:

5. **A Resend API key**, plus a verified sending domain. Without it the outbox
   enqueues correctly and the sweeper reports `unconfigured` rather than
   pretending to send.
6. **`CRON_SECRET`** set in the deployment environment, and a cron schedule
   pointing at `/api/cron/outbox` with `Authorization: Bearer $CRON_SECRET`.
   The endpoint answers 503 rather than opening if the secret is unset.

---

## 10. If you change one thing first

Two candidates, and they answer different questions.

**To move the build forward:** run **craft round 4 on the portal and partner
surfaces.** Round 3's five fixes are committed but unverified, and an unverified
fix is the one thing this process has repeatedly caught being half-right — round
18 found that round 17's fix restored the note but not the radio selection, while
the alert said "What you typed is still here."

**To close the most consequential open defect:** build the
**`storage_cleanup_queue` drainer** (§7.2, item 1). It is perhaps an hour's work,
and until it exists, deleting a document removes the row and leaves the file. Of
everything on these lists it is the only item where the product does something
other than what it tells the person using it.
