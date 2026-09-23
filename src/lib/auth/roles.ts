import type { Database } from "@/types/database-app";
import {
  isSurfaceOpen,
  PLATFORM_DISABLED_PATH,
  siteMode,
  type SiteMode,
} from "@/lib/site-mode";

export type AppRole = Database["public"]["Enums"]["app_role"];

export const APP_ROLES = [
  "owner",
  "adjuster",
  "assistant",
  "customer",
  "partner",
] as const satisfies readonly AppRole[];

/** Spec §4: the three roles that hold a CMG staff account. */
export const STAFF_ROLES = [
  "owner",
  "adjuster",
  "assistant",
] as const satisfies readonly AppRole[];

export function isAppRole(value: unknown): value is AppRole {
  return (
    typeof value === "string" && (APP_ROLES as readonly string[]).includes(value)
  );
}

export function isStaffRole(role: AppRole): boolean {
  return (STAFF_ROLES as readonly AppRole[]).includes(role);
}

/**
 * The three logged-in surfaces. Each is a route-group prefix in `src/app` and a
 * gate in `proxy.ts`; keeping the mapping here means the proxy, the authz
 * helpers and the post-login redirect cannot drift apart.
 */
export const SURFACES = {
  admin: { prefix: "/admin", roles: STAFF_ROLES, requiresAal2: true },
  customer: { prefix: "/portal", roles: ["customer"], requiresAal2: false },
  partner: { prefix: "/partner", roles: ["partner"], requiresAal2: false },
} as const satisfies Record<
  string,
  { prefix: string; roles: readonly AppRole[]; requiresAal2: boolean }
>;

export type Surface = keyof typeof SURFACES;

/**
 * Prefix match on a path *segment*, not on characters: `/partners-are-great`
 * must not be gated by the `/partner` rule, and `/portal` must gate
 * `/portal/claims/…`.
 */
export function surfaceForPath(pathname: string): Surface | null {
  for (const [name, surface] of Object.entries(SURFACES)) {
    if (
      pathname === surface.prefix ||
      pathname.startsWith(`${surface.prefix}/`)
    ) {
      return name as Surface;
    }
  }
  return null;
}

/** The surface each role owns, ignoring whether this mode opens it. */
export function surfaceForRole(role: AppRole): Surface {
  if (isStaffRole(role)) return "admin";
  if (role === "partner") return "partner";
  return "customer";
}

/**
 * Where a signed-in role is sent — and, in staff mode, where they are refused.
 *
 * Staff mode opens `/login` and `/mfa` but not `/portal` or `/partner`, so a
 * homeowner or a referring contractor can still authenticate and then has
 * nowhere to go. Sending them to their own prefix anyway would bounce them off
 * the proxy's mode gate to `/platform-disabled` on a second request — the right
 * destination by accident, and one hop of a redirect chain that a future prefix
 * change could close into a loop. Answered here instead, once, in the function
 * every caller already uses to decide a destination: the proxy, the login page,
 * the sign-in action, `acceptInvite` and the MFA flow.
 *
 * In `simple` mode this is unreachable — nobody can sign in — and in `platform`
 * mode every surface is open, so production behaviour is unchanged.
 */
export function landingPathFor(role: AppRole, mode?: SiteMode): string {
  const surface = surfaceForRole(role);
  const prefix = SURFACES[surface].prefix;
  return isSurfaceOpen(prefix, mode ?? siteMode())
    ? prefix
    : PLATFORM_DISABLED_PATH;
}

export function roleMayEnter(role: AppRole, surface: Surface): boolean {
  return (SURFACES[surface].roles as readonly AppRole[]).includes(role);
}

/**
 * Sanitises a `?next=` value into a same-origin path or nothing.
 *
 * The rejected shapes are all real redirect vectors rather than tidiness:
 * `//evil.test` and `/\evil.test` are protocol-relative URLs that browsers
 * resolve against another host, and an absolute `https://evil.test` needs no
 * explanation. Anything that is not a single leading slash followed by a
 * non-slash, non-backslash character is refused outright, so the caller falls
 * back to the role's own landing page.
 */
export function safeNextPath(raw: string | null | undefined): string | null {
  if (typeof raw !== "string" || raw.length === 0) return null;
  if (!raw.startsWith("/")) return null;
  if (raw.startsWith("//") || raw.startsWith("/\\")) return null;
  if (raw.includes("\\")) return null;
  return raw;
}
