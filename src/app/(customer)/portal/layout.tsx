import type { Metadata } from "next";
import type { ReactNode } from "react";
import { PortalFrame } from "@/components/portal/frame";
import { requireRole } from "@/lib/authz";
import { displayName, portalProfile } from "@/lib/portal/queries";

/**
 * `noindex` on the whole surface through the template, not per page: a portal
 * screen that forgot it would be one crawler visit away from a claim reference
 * in a search result.
 */
export const metadata: Metadata = {
  title: { template: "%s · Your CMG claim", default: "Your CMG claim" },
  robots: { index: false, follow: false },
};

export default async function PortalLayout({ children }: { children: ReactNode }) {
  // The gate for every screen beneath this one. `proxy.ts` already turns a
  // signed-out or wrong-role request away at the edge; this is the second copy,
  // in the layer that runs even if a route matcher is edited, and it is what
  // makes `session` available without each page re-deriving it.
  const session = await requireRole("customer");
  const profile = await portalProfile();

  return (
    <PortalFrame
      identity={{ name: displayName(profile, session.email), email: session.email }}
    >
      {children}
    </PortalFrame>
  );
}
