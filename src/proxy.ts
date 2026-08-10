import type { NextRequest } from "next/server";
import { updateSession } from "@/lib/supabase/proxy";

/**
 * Next 16 renames middleware to `proxy.ts` with a named `proxy` export; a file
 * called `middleware.ts` is not run at all.
 *
 * Two jobs, in this order: refresh the Supabase session on every matched
 * request (without which a Server Component sees an expired token and the user
 * is silently signed out), then gate the three logged-in surfaces. The gate is
 * a first line only — it decides on a path prefix and a role, so it cannot know
 * whether *this* claim belongs to *this* customer. Every page and server action
 * re-authorises through `src/lib/authz.ts`, with RLS beneath that (spec §7.3).
 */
export async function proxy(request: NextRequest) {
  return updateSession(request);
}

export const config = {
  matcher: [
    /**
     * Everything except the build output and static assets. The proxy has to
     * run on marketing routes too — that is where a session gets refreshed
     * while someone reads the site — so the exclusions are about bytes that
     * carry no cookie, not about which routes are public.
     *
     * `_next/static` and `_next/image` are the build and image-optimiser
     * outputs; the extension list covers everything under `public/`, including
     * the three hero videos, where a per-request Supabase round trip would be
     * pure latency on a file that is never personalised.
     */
    "/((?!_next/static|_next/image|favicon\\.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|avif|ico|mp4|webm|woff|woff2|ttf|otf|txt|xml|webmanifest)$).*)",
  ],
};
