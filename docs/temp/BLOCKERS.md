# Blockers

Items that cannot be resolved in code and need the owner to supply something.

---

## 1. Photography for the two `ImageSlot` placeholders (owner-supplied)

**Status:** open — blocks a major-brand read on `/` and `/about`.

**What's blocked**

Two `ImageSlot` components ship as visible placeholders because no photographs
exist for them:

| Route    | File                                | Placeholder label            |
| -------- | ----------------------------------- | ---------------------------- |
| `/`      | `src/app/(marketing)/page.tsx:160`   | "Storm damage inspection"    |
| `/about` | `src/app/(marketing)/about/page.tsx:121` | "The CMG field team"     |

Each renders a bordered 4:3 box with corner ticks and a centred caption — a
labelled empty frame, not a photograph.

**Why it is owner-level, not a code problem**

The prototypes (`design/prototypes/Home.dc.html`, `About.dc.html`) specify an
`<image-slot>` in both positions with the instruction "Drop a photo — storm
damage or an inspection; dark backgrounds blend best". The slot is the design;
the asset is the missing input. Nothing in the codebase can produce a
photograph of CMG's field team or of a real inspection, and substituting stock
imagery would misrepresent the business — the About slot in particular is
captioned as CMG's own staff.

**Assessment from the craft review**

Named "the single most damaging element against a major-brand read", and the
root cause of the right-hand voids on those two sections: each placeholder
sits in the right-hand column of a two-column band, so the band's second
anchor is currently an empty frame.

**Exact unblock step**

1. Owner supplies two photographs:
   - **Home:** storm damage or an adjuster inspecting a property. Landscape,
     4:3 or wider, min 1600px on the long edge. Dark or low-key images sit
     best on the `#26292c` canvas.
   - **About:** the CMG field team (or the licensed adjuster on site). Same
     format constraints.
2. Drop them in `public/images/`.
3. Change each call site from the label-only form to the image form — the
   component already supports it and needs no edit:

   ```tsx
   // src/app/(marketing)/page.tsx
   <ImageSlot src="/images/storm-inspection.jpg" alt="Storm damage inspection" />

   // src/app/(marketing)/about/page.tsx
   <ImageSlot src="/images/cmg-field-team.jpg" alt="The CMG field team" />
   ```

   `ImageSlot`'s prop types (`src/components/ui/image-slot.tsx`) already
   require `alt` whenever `src` is given, so the swap cannot ship without
   alt text.

**Damage reduction applied in the meantime**

None beyond what the layout already does. The two bands are `items-center`
two-column grids that collapse to a single column below 300px track width, so
the pages hold without the imagery — but on desktop the placeholder is
unavoidably visible. Removing the slots entirely was rejected: it would
delete a prototype-specified structure, and the sections would then have no
second anchor at all.

---

## 2. Cloudflare Turnstile test keys are wired in — must not ship

**Status:** open — **launch blocker.** Visible on `/contact` and
`/file-a-claim`.

**What's blocked**

Both forms currently render Cloudflare's *test* widget, which paints a red
badge reading **"For testing only. If seen, report to site owner"** directly
above the submit button. It is visible to every visitor on:

| Route           | Where                                                   |
| --------------- | ------------------------------------------------------- |
| `/contact`      | above "Send message" — `src/components/forms/contact-form.tsx` |
| `/file-a-claim` | above "Submit intake" — `src/components/forms/intake-form.tsx` |

Both render `<TurnstileWidget>` (`src/components/forms/turnstile.tsx`), which
reads its site key from the environment. The badge is drawn by Cloudflare, not
by this codebase, and cannot be styled or suppressed from here — it is how
Cloudflare marks a test key in use.

**Why it is owner-level, not a code problem**

The values in `.env.example` are Cloudflare's documented always-passes test
pair:

```
NEXT_PUBLIC_TURNSTILE_SITE_KEY="1x00000000000000000000AA"
TURNSTILE_SECRET_KEY="1x0000000000000000000000000000000AA"
```

They exist so the forms are exercisable in development without a Cloudflare
account. They also mean **the verification currently accepts every submission**,
so the forms have no live bot protection. Real keys can only be minted from the
owner's own Cloudflare dashboard against the production hostname; nothing in the
repo can generate them.

**Exact unblock step**

1. In the Cloudflare dashboard → **Turnstile** → *Add widget*, create a widget
   for the production hostname (and any preview hostnames that need to submit).
   Widget mode "Managed" matches how the code renders it.
2. Set these two environment variables in every deployed environment
   (production, preview, and any staging) — this is the complete list; no other
   Turnstile variable is read anywhere in the codebase:

   | Variable | Value | Scope |
   | --- | --- | --- |
   | `NEXT_PUBLIC_TURNSTILE_SITE_KEY` | the widget's **Site Key** | client — inlined into the bundle at build time, so the build must be re-run after changing it |
   | `TURNSTILE_SECRET_KEY` | the widget's **Secret Key** | server only — never prefix with `NEXT_PUBLIC_` |

   Read at `src/components/forms/turnstile.tsx:79` and
   `src/lib/turnstile.ts:26` respectively.
3. Redeploy, then load `/contact` and `/file-a-claim` and confirm the red
   "For testing only" badge is gone and the widget shows the normal Cloudflare
   check.

**If the keys are missing entirely**

The widget does not fail open. With no site key, `TurnstileWidget` renders an
error paragraph in place of the check and the form cannot be submitted; with no
secret key, `verifyTurnstile` rejects server-side. So a missing key is a visibly
broken form, not a silently unprotected one — but a *test* key is the dangerous
case, because the form looks and behaves normally while accepting everything.

---

## 3. Supabase leaked-password protection + MFA are hosted-plan settings

**Status:** open — owner action at launch (Phase 9). Not blocking Phase 3.

**What is blocked**

Two of the spec §7.2 auth controls have no equivalent in `supabase/config.toml`
and therefore cannot be switched on by anything in this repository:

| Control | Local state | What the platform needs |
| --- | --- | --- |
| Leaked-password protection (HIBP) | no config key exists in the CLI's `[auth]` block | Dashboard → Authentication → Passwords → *Prevent use of leaked passwords* (Pro plan) |
| MFA (TOTP) | enabled locally via `[auth.mfa.totp]` in `supabase/config.toml` | MFA is a Pro-plan feature on hosted projects; confirm it is available on the plan chosen at launch |

**Why owner-level**

Both are properties of the hosted project, which does not exist yet (§ CURRENT
STATE: "no CMG project — dev is local Docker only"), and the plan that carries
them is a paid one. Nothing in code can set them.

**What is already covered in code, so this is a hardening gap and not a hole**

- `src/lib/auth/leaked-password.ts` implements the HIBP range API check
  (k-anonymity: only the first five characters of the SHA-1 digest are sent) and
  runs on every invite acceptance. It deliberately fails **open** on network
  error or non-200, so an HIBP outage cannot make it impossible to set a
  password; each skip is logged. The platform setting is the belt to this
  brace, because it also covers password changes made outside this app.
- `minimum_password_length = 12` and
  `password_requirements = "lower_upper_letters_digits"` are set in
  `supabase/config.toml`, so GoTrue itself enforces the §7.2 floor on any path
  that sets a password. `src/lib/validators/password.ts` mirrors those rules and
  adds the strength checks (character variety, weak fragments, keyboard runs,
  repeated units, email-derived passwords).

**Exact unblock step**

1. After the hosted project exists and is on Pro, enable *Prevent use of leaked
   passwords* in Authentication → Passwords.
2. Confirm Authentication → Multi-Factor Authentication shows TOTP enabled; the
   `[auth.mfa.totp]` block in `supabase/config.toml` is pushed by
   `supabase link` + config push, but the plan gate is separate.
3. Leave `src/lib/auth/leaked-password.ts` in place — it covers the invite path
   with a clear message before the account is created, which the platform check
   cannot do.
