import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { requireRole } from "@/lib/authz";

export const dynamic = "force-dynamic";

/**
 * `/portal/anything-that-is-not-a-route`.
 *
 * The portal's own 404 could only answer a `notFound()` raised inside the
 * segment; an unrouted path matches no segment, so it fell through to the root
 * `not-found.tsx` — the marketing 404, with the public header and a "File a
 * claim" button offered to someone who has already filed one and is signed in
 * to follow it. `/admin` has carried this catch-all since its own 404 was
 * written; `/portal` and `/partner` were missed.
 *
 * `requireRole` runs first so a signed-out visitor probing `/portal/<guess>`
 * lands on `/login` like everyone else, and the copy of the 404 below it names
 * no resource — §7.9 requires that a portal account cannot tell "not yours"
 * from "not there".
 */
export const metadata: Metadata = {
  title: "Page not found",
  robots: { index: false, follow: false },
};

export default async function UnmatchedPortalRoute() {
  await requireRole("customer");
  notFound();
}
