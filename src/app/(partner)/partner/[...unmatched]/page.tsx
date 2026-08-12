import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { requireRole } from "@/lib/authz";

export const dynamic = "force-dynamic";

/**
 * `/partner/anything-that-is-not-a-route`.
 *
 * A `not-found.tsx` can only answer a `notFound()` raised inside its own
 * segment, and an unrouted path matches no segment at all — so without this the
 * partner's own 404 was unreachable and Next answered from the *root*
 * `not-found.tsx`: the marketing 404, with the public header, a "File a claim"
 * button, "Call 24/7 · 407-488-5728", and copy addressed to a homeowner about a
 * claim that is not theirs. Adding `not-found.tsx` alone did not fix it, and
 * saying so is the point — the catch-all is the half that makes it reachable,
 * which is why `/admin` has both.
 *
 * `requireRole` runs first, so a signed-out visitor probing `/partner/<guess>`
 * is sent to `/login` exactly as they are for the real route, rather than being
 * told which guesses are unrouted.
 *
 * Static and dynamic segments outrank a catch-all in Next's matcher, so
 * `/partner` itself continues to win.
 */
export const metadata: Metadata = {
  title: "Page not found",
  robots: { index: false, follow: false },
};

export default async function UnmatchedPartnerRoute() {
  await requireRole("partner");
  notFound();
}
