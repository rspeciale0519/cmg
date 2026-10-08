/**
 * Which of the private route prefixes this deployment answers, and which
 * notification templates it is allowed to put on the wire.
 *
 * THREE MODES, ONE RULE
 *
 *   simple    — nothing private. The marketing site, the public forms, and the
 *               four public-form emails.
 *   staff     — the CMG claims desk only: `/login`, `/mfa`, `/admin`, and the
 *               three password-recovery routes that belong to `/login`. The
 *               customer portal, the partner portal and invitation redemption
 *               stay closed, so staff can run claims and e-signing before those
 *               surfaces have had hosted acceptance testing.
 *   platform  — everything.
 *
 * See docs/RELEASE_STATE.md for the current production mode.
 *
 * The rule the rest of the codebase asks about is never "which mode is this"
 * but "is *this* surface open". `isPathOpen`, `isSurfaceOpen` and
 * `deliverableTemplates` are the only three questions, and a fourth mode would
 * be a row in `PRIVATE_PREFIXES` rather than a new comparison somewhere.
 */
export type SiteMode = "simple" | "platform" | "staff";

export const PLATFORM_DISABLED_PATH = "/platform-disabled";

/**
 * Every private prefix, with the modes that open it. `simple` appears nowhere,
 * which is the point: simple mode is the row that is absent from every list.
 */
const PRIVATE_PREFIXES = [
  { prefix: "/login", openIn: ["platform", "staff"] },
  /* Password recovery is part of signing in, so it opens exactly when `/login`
     does. A build with no login has no password to recover, and a recovery
     link that worked in simple mode would mint a session nothing can use. */
  { prefix: "/forgot-password", openIn: ["platform", "staff"] },
  { prefix: "/auth/confirm", openIn: ["platform", "staff"] },
  { prefix: "/reset-password", openIn: ["platform", "staff"] },
  { prefix: "/mfa", openIn: ["platform", "staff"] },
  { prefix: "/admin", openIn: ["platform", "staff"] },
  { prefix: "/invite", openIn: ["platform"] },
  { prefix: "/portal", openIn: ["platform"] },
  { prefix: "/partner", openIn: ["platform"] },
] as const satisfies readonly { prefix: string; openIn: readonly SiteMode[] }[];

export const PLATFORM_PATH_PREFIXES: readonly string[] = PRIVATE_PREFIXES.map(
  (entry) => entry.prefix,
);

/** The four templates a public marketing build is allowed to send. */
export const PUBLIC_FORM_TEMPLATES = [
  "intake_staff_alert",
  "intake_confirmation",
  "lead_staff_alert",
  "lead_auto_reply",
] as const;

/**
 * What staff mode adds: the three alerts addressed to the CMG staff inbox.
 *
 * Deliberately *not* every claim-lifecycle template. `claim_status_update`,
 * `settled_notice`, `reply_posted` and `partner_status_update` each render a
 * button into `/portal` or `/partner`, and `invite` renders one into
 * `/invite` — all three prefixes are closed in staff mode, so delivering any of
 * them would mail a homeowner or a referring contractor a link that lands on
 * `/platform-disabled`. `lor_signed` is the same trap in prose: it tells the
 * homeowner "a copy is in your portal". A notification whose call to action
 * cannot be followed is worse than one that waits — the row stays `pending` and
 * `/admin/settings` reports it as owed.
 *
 * The three that remain go to `EMAIL_STAFF_INBOX` and link, at most, into
 * `/admin` — which is exactly the surface staff mode opens.
 */
export const STAFF_ALERT_TEMPLATES = [
  "question_staff_alert",
  "referral_staff_alert",
  "esign_staff_alert",
] as const;

/**
 * Simple mode is the safe default. A missing, empty, unknown or malformed value
 * must never open a private surface by accident, so the only two strings that
 * select anything are the exact trimmed lowercase mode names.
 */
export function siteMode(value = process.env.SITE_MODE): SiteMode {
  const normalized = value?.trim().toLowerCase();
  if (normalized === "platform") return "platform";
  if (normalized === "staff") return "staff";
  return "simple";
}

function matches(pathname: string, prefix: string): boolean {
  return pathname === prefix || pathname.startsWith(`${prefix}/`);
}

/** True for any private prefix, whatever the mode. */
export function isPlatformPath(pathname: string): boolean {
  return PRIVATE_PREFIXES.some((entry) => matches(pathname, entry.prefix));
}

/**
 * "Is this path reachable in the current mode?"
 *
 * True for every path that is not private at all, so the caller does not have
 * to ask `isPlatformPath` first. False only for a private prefix this mode
 * keeps closed.
 */
export function isPathOpen(
  pathname: string,
  mode: SiteMode = siteMode(),
): boolean {
  const entry = PRIVATE_PREFIXES.find((candidate) =>
    matches(pathname, candidate.prefix),
  );
  if (!entry) return true;
  return (entry.openIn as readonly SiteMode[]).includes(mode);
}

/** "Is the surface rooted at this prefix open?" — the same question by prefix. */
export function isSurfaceOpen(
  prefix: string,
  mode: SiteMode = siteMode(),
): boolean {
  return isPathOpen(prefix, mode);
}

/**
 * "Does this mode have any private surface at all?"
 *
 * The question `getSession` asks. A build with nothing private has no login, so
 * it can have no session, and reading one would be a Supabase client that can
 * never do anything, constructed on every request.
 */
export function isAnyPrivateSurfaceOpen(mode: SiteMode = siteMode()): boolean {
  return PRIVATE_PREFIXES.some((entry) =>
    (entry.openIn as readonly SiteMode[]).includes(mode),
  );
}

/**
 * The templates this mode may put on the wire, or `undefined` for "no filter".
 *
 * `undefined` rather than the full list on purpose: the callers turn it into an
 * `.in("template", …)` clause, and an explicit list of every template would be
 * a second place to remember whenever a template is added.
 */
export function deliverableTemplates(
  mode: SiteMode = siteMode(),
): readonly string[] | undefined {
  if (mode === "platform") return undefined;
  if (mode === "staff") {
    return [...PUBLIC_FORM_TEMPLATES, ...STAFF_ALERT_TEMPLATES];
  }
  return PUBLIC_FORM_TEMPLATES;
}
