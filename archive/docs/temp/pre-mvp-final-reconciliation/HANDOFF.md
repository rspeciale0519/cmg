# Owner handoff — CMG Property Solutions claims platform

Everything on this page needs a person with an account, a card, or a domain.
None of it can be done from the codebase, and all of it is required before the
site is live.

**Read this first:** the build is not finished. This document covers the
*owner-supplied* side only. What remains on the engineering side is in
[`CONTINUATION.md`](CONTINUATION.md) — that is the document to hand to whoever
is continuing the build. The two do not overlap.

The detailed reasoning behind each item, and what happens if it is skipped, is
in [`BLOCKERS.md`](BLOCKERS.md). This page is the ordered runbook; that page is
the argument.

---

## Before anything else: nothing is deployed

There is no hosted Supabase project, no Vercel project, no domain pointed
anywhere, and no email domain verified. Development has been entirely local
(Docker Supabase + `next dev`). **No paid resource has been created, on purpose**
— every account below is one you will own and be billed for, so none of them were
opened without you.

That also means every step here is a first-time setup rather than a change to
something existing.

---

## The order to do this in

The steps depend on each other. Doing them out of order mostly wastes time
rather than breaking anything, except where noted.

| # | Step | Blocks | Cost |
|---|---|---|---|
| 1 | Supabase project | everything | free tier works; Pro needed for step 7 |
| 2 | Domain + DNS | email, Turnstile, invite links | you may already own it |
| 3 | Vercel project + environment variables | the site being reachable | free tier works |
| 4 | Resend account + verified domain | every email the system sends | free tier covers early volume |
| 5 | Cloudflare Turnstile keys | **launch blocker** — a red test badge is on two public forms today | free |
| 6 | `CRON_SECRET` | the email queue draining | free, 30 seconds |
| 7 | Supabase Pro settings (leaked passwords, MFA) | a §7.2 hardening control | Pro plan |
| 8 | PandaDoc account + template | electronic signing only; the claim flow works without it | paid, per document |
| 9 | Two photographs | a placeholder box on `/` and `/about` | your time |

Steps 1–6 are launch-blocking. Steps 7–9 are not: the app runs correctly without
them, in a documented fallback, and each one is visible rather than silent.

---

## 1. Supabase project

1. Create a project at supabase.com. Pick the region closest to Florida
   (`us-east-1`).
2. From **Project Settings → API**, copy three values. These are the first three
   environment variables in step 3:
   - Project URL → `NEXT_PUBLIC_SUPABASE_URL`
   - Publishable (anon) key → `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`
   - Secret (service_role) key → `SUPABASE_SECRET_KEY`
3. **`SUPABASE_SECRET_KEY` is server-only and must never be given a
   `NEXT_PUBLIC_` prefix.** It bypasses every access rule in the database. The
   codebase enforces this structurally — the module that reads it is
   `server-only` — but the variable name is yours to set correctly.
4. Push the schema. From the repository root, with the Supabase CLI installed
   and logged in:

   ```bash
   npx supabase link --project-ref <your-project-ref>
   ```

   ```bash
   npx supabase db push
   ```

   This applies every migration in `supabase/migrations/`. It does **not** apply
   `supabase/seed.sql`, which contains demo claims and test accounts and must not
   reach production.

---

## 2. Domain and DNS

You need the production hostname decided before steps 4 and 5, because both mint
credentials that are bound to it.

`.env.example` currently assumes `cmgpropertysolutions.net` (it is in the default
`EMAIL_FROM`). If the live domain differs, that is fine — nothing is hardcoded —
but pick it now.

DNS records get added in step 3 (Vercel) and step 4 (Resend). Nothing to do here
except decide.

---

## 3. Vercel project and environment variables

1. Import the Git repository at vercel.com. Framework preset: Next.js. No build
   command override.
2. Add the domain from step 2 under **Settings → Domains** and follow the DNS
   records it gives you.
3. Set the environment variables below on **Production and Preview**.
   `.env.example` in the repository root is the authoritative list — it carries a
   comment per variable explaining what reads it and what happens when it is
   absent.

   | Variable | Where it comes from | Scope |
   |---|---|---|
   | `NEXT_PUBLIC_SUPABASE_URL` | step 1 | client |
   | `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | step 1 | client |
   | `SUPABASE_SECRET_KEY` | step 1 | **server only** |
   | `NEXT_PUBLIC_SITE_URL` | your domain, absolute, no trailing slash | client |
   | `RESEND_API_KEY` | step 4 | **server only** |
   | `EMAIL_FROM` | step 4, must match the verified domain | server |
   | `EMAIL_STAFF_INBOX` | where intake and contact alerts land | server |
   | `NEXT_PUBLIC_TURNSTILE_SITE_KEY` | step 5 | client |
   | `TURNSTILE_SECRET_KEY` | step 5 | **server only** |
   | `CRON_SECRET` | step 6 | **server only** |
   | `PANDADOC_*` (four) | step 8 | **server only** |

   Anything marked client is compiled into the browser bundle, so **changing one
   requires a rebuild, not just a redeploy.**

4. `NEXT_PUBLIC_SITE_URL` is used to build invite links and every link inside an
   email. If it is wrong, invitations point somewhere that does not exist.

> **Not yet built:** `vercel.json` (or `vercel.ts`) does not exist in the
> repository, so the cron schedule in step 6 has nothing to attach to yet. That
> file is Phase 9 engineering work, listed in `CONTINUATION.md` §4.3. You can
> complete steps 1–5 before it lands.

---

## 4. Resend, and the domain it sends from

Nothing has ever emailed anybody from this system. Every message written by the
application — invitations, status updates, questions, staff alerts — is queued in
the database and waits for this step.

1. Create a Resend account and add your domain under **Domains**.
2. Add the DKIM and SPF records Resend gives you to the domain's DNS, and wait
   for verification.
3. Create an API key → `RESEND_API_KEY`.
4. Set `EMAIL_FROM` to an address **on the verified domain**. A mismatch is
   rejected at send time.
5. Set `EMAIL_STAFF_INBOX` to whoever should receive new intake and contact
   notifications.

**With no key, nothing is lost.** The outbox queues every message and the sweeper
declines to claim any of them, so once a key exists the backlog drains on the
next tick. What you should not do is set the key to an empty or whitespace value
— see `CONTINUATION.md` §7.2 item 5 for a rough edge there that is not yet fixed.

---

## 5. Cloudflare Turnstile — the launch blocker

**Today, `/contact` and `/file-a-claim` display a red badge reading "For testing
only. If seen, report to site owner" directly above their submit buttons.** That
badge is drawn by Cloudflare and cannot be removed from the code. It is there
because the repository ships Cloudflare's public always-passes test keys so the
forms work in development.

It also means **both public forms currently accept every submission**, with no
bot protection at all.

1. Cloudflare dashboard → **Turnstile** → *Add widget*. Mode: **Managed**.
   Hostnames: your production domain, plus any preview domain that needs working
   forms.
2. `NEXT_PUBLIC_TURNSTILE_SITE_KEY` = the Site Key.
   `TURNSTILE_SECRET_KEY` = the Secret Key, server-only.
3. **Rebuild** (the site key is a client variable), then load both forms and
   confirm the red badge is gone.

A missing key is safe — the form visibly refuses to submit. A *test* key is the
dangerous case, because everything looks and behaves normally.

---

## 6. `CRON_SECRET` and the email schedule

Generate a secret:

```bash
openssl rand -base64 32
```

Set it as `CRON_SECRET` on Vercel. Vercel Cron sends it as
`Authorization: Bearer <value>` by itself once the variable exists on the
project, so no additional configuration is needed on the schedule.

`/api/cron/outbox` expects to run **every five minutes** (`*/5 * * * *`). Without
the secret the route refuses every request with 503 and logs why — deliberately,
because the alternative would leave the sweeper open to anyone who guesses the
path.

Until the `vercel.json` from step 3's note exists, the schedule cannot be
attached and **queued email will not send.** You can verify the route by hand
before then.

---

## 7. Supabase Pro: leaked passwords and MFA

Both are properties of the hosted project and neither can be set from the
repository.

1. **Authentication → Passwords → Prevent use of leaked passwords.** Requires
   Pro. The application already checks passwords against Have I Been Pwned on
   invite acceptance (`src/lib/auth/leaked-password.ts`, k-anonymity — only five
   characters of the hash ever leave), so this is a second layer covering
   password changes made outside the app.
2. **Authentication → Multi-Factor Authentication** — confirm TOTP is enabled.
   Staff MFA is enforced in the database itself, not just in the UI, so this must
   be available on the plan you choose or staff cannot reach `/admin` at all.

---

## 8. PandaDoc (optional — there is a working fallback)

The e-signature layer is complete and runs today in **manual mode**: staff send
the letter of representation themselves and upload the signed copy. The claim
lifecycle, the `lor_signed` gate and the signed-document requirement all work
without PandaDoc. Nothing is blocked by skipping this.

If you want electronic signing, `BLOCKERS.md` §4 has the full runbook — the
account, the two-signer template with its exact role and token names, the
sandbox key, and the webhook subscription. It is the longest of these items and
the only one billed per document (roughly one per claim).

The four variables are all server-only. When they are set correctly the admin
interface switches from the manual controls to the electronic ones by itself.

---

## 9. Two photographs

`/` and `/about` each render a labelled empty frame where a photograph belongs.
The craft review called this the single most damaging element against a
major-brand read.

- **Home:** storm damage, or an adjuster inspecting a property.
- **About:** the CMG field team, or the licensed adjuster on site.

Landscape, 4:3 or wider, at least 1600px on the long edge. Dark or low-key images
sit best on the site's charcoal canvas.

Stock imagery was deliberately not substituted: the About frame is captioned as
CMG's own staff, and a stock photo there would be a false claim about the
business. `BLOCKERS.md` §1 has the two-line code change once the files exist.

---

## What you should expect to see when it is working

- `/contact` and `/file-a-claim` submit, with a normal Cloudflare check and no
  red badge.
- A test intake produces a claim in `/admin`, an email to `EMAIL_STAFF_INBOX`,
  and an acknowledgement to the submitter — within five minutes, not instantly,
  because delivery goes through the sweeper.
- A staff invitation arrives, and accepting it walks through TOTP enrolment
  before `/admin` is reachable.
- `/admin/settings` shows live probes for Supabase, Resend, Turnstile and
  PandaDoc. That page is the fastest way to tell which of the steps above have
  actually taken effect.

If something on that list does not happen, `/admin/settings` will usually say
which credential is the reason.
