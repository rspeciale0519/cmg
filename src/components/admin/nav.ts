import type { AppRole } from "@/lib/auth/roles";

export type AdminNavItem = {
  readonly href: string;
  readonly label: string;
  /** Which staff roles see the destination at all (spec §9). */
  readonly roles: readonly AppRole[];
  /** Key into the counts the layout fetches; absent items show no badge. */
  readonly badge?: "intake" | "leads";
};

const ALL_STAFF: readonly AppRole[] = ["owner", "adjuster", "assistant"] as const;
const OWNER_ONLY: readonly AppRole[] = ["owner"] as const;

/**
 * Nine destinations, in the order the work runs: what arrived, what it became,
 * then the reference material. Partners, Staff, Audit and Settings are §9's
 * owner surfaces and are filtered out for everyone else rather than rendered
 * disabled — a control that is never usable is not information.
 *
 * Questions sits with the other two inboxes because that is what it is: a
 * homeowner asking something and waiting. It had no destination at all until
 * this round — the dashboard showed four of them and there was nowhere to send
 * anyone for the fifth — and a queue reachable only from one panel on one page
 * is a queue most of whose rows nobody will ever see. It carries no badge: the
 * two above it count work that is unstarted, and a question's equivalent is
 * "unanswered", which cannot be computed across claims without an unbounded
 * read. A number that is nearly right is worse here than no number.
 */
export const ADMIN_NAV: readonly AdminNavItem[] = [
  { href: "/admin", label: "Dashboard", roles: ALL_STAFF },
  { href: "/admin/intake", label: "Intake", roles: ALL_STAFF, badge: "intake" },
  { href: "/admin/leads", label: "Leads", roles: ALL_STAFF, badge: "leads" },
  { href: "/admin/questions", label: "Questions", roles: ALL_STAFF },
  { href: "/admin/claims", label: "Claims", roles: ALL_STAFF },
  { href: "/admin/partners", label: "Partners", roles: OWNER_ONLY },
  { href: "/admin/staff", label: "Staff", roles: OWNER_ONLY },
  { href: "/admin/audit", label: "Audit", roles: OWNER_ONLY },
  { href: "/admin/settings", label: "Settings", roles: OWNER_ONLY },
] as const;

export function navFor(role: AppRole): AdminNavItem[] {
  return ADMIN_NAV.filter((item) => item.roles.includes(role));
}

/**
 * Segment-wise prefix match, and `/admin` is exact. Without the exact case the
 * dashboard would read as active on every page in the workspace, since every
 * path starts with it.
 */
export function isAdminRouteActive(pathname: string, href: string): boolean {
  if (href === "/admin") return pathname === "/admin";
  return pathname === href || pathname.startsWith(`${href}/`);
}

export const ROLE_LABEL: Record<AppRole, string> = {
  owner: "Owner",
  adjuster: "Adjuster",
  assistant: "Assistant",
  customer: "Homeowner",
  partner: "Partner",
};
