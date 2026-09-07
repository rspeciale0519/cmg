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
 *
 * **The response is 200, not 404, and that is a trade rather than an oversight.**
 * Measured: `/admin/nope` and a missing claim id both answer 200 while `/nope`
 * on the marketing site answers 404. The cause is `admin/loading.tsx` — a
 * Suspense boundary at the `/admin` segment flushes the shell and its skeleton
 * before this page runs, and a status cannot be set after the first byte has
 * gone. The only way to get the 404 status back is to delete the skeleton for
 * every route under `/admin`, which trades a thing every reader sees on every
 * slow navigation for a header nothing in this product reads: the workspace is
 * behind auth and `robots: noindex`, so there is no crawler, no cache and no
 * client code that branches on it. The *page* is still the workspace 404, in
 * the shell, with the right title. Revisit if `/admin` ever needs to be
 * crawlable or cacheable, which would be a larger change than this one.
 */
export const metadata: Metadata = {
  title: "Page not found",
  robots: { index: false, follow: false },
};

export default async function UnmatchedAdminRoute() {
  await requireStaff("/admin");
  notFound();
}
