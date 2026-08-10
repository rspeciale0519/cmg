import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { requireStaff } from "@/lib/authz";

export const dynamic = "force-dynamic";

/**
 * `/admin/anything-that-is-not-a-route`.
 *
 * Without this the URL matches no segment in the tree at all, so Next answers
 * from the *root* `not-found.tsx` — the marketing 404, outside the workspace
 * and outside its layout — and there is no `not-found.tsx` anywhere that could
 * intercept it, because interception requires a matched segment. A catch-all
 * that immediately calls `notFound()` is what turns an unrouted path into a
 * miss *inside* `/admin`, where `admin/not-found.tsx` answers it in the shell.
 *
 * `requireStaff()` runs first and is not redundant with the layout's: this page
 * is the thing that decides the URL exists at all, and a signed-out visitor
 * probing `/admin/<guess>` must be sent to `/login` exactly as they are for
 * every real route, rather than being told which guesses are unrouted.
 *
 * Static and dynamic segments outrank a catch-all in Next's matcher, so every
 * real route continues to win.
 */
export const metadata: Metadata = {
  title: "Page not found",
  robots: { index: false, follow: false },
};

export default async function UnmatchedAdminRoute() {
  await requireStaff("/admin");
  notFound();
}
