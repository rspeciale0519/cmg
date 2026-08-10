import type { Database } from "@/types/database";

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

export function landingPathFor(role: AppRole): string {
  if (isStaffRole(role)) return SURFACES.admin.prefix;
  if (role === "partner") return SURFACES.partner.prefix;
  return SURFACES.customer.prefix;
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
