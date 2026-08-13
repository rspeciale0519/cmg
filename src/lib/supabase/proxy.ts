import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import {
  isAppRole,
  landingPathFor,
  roleMayEnter,
  SURFACES,
  surfaceForPath,
  type AppRole,
} from "@/lib/auth/roles";
import type { Database } from "@/types/database";
import {
  isPlatformPath,
  isSimpleMode,
  PLATFORM_DISABLED_PATH,
} from "@/lib/site-mode";

/**
 * Paths the proxy runs over but never gates. `/api/pandadoc/webhook` is on this
 * list because the caller is PandaDoc, which holds no session and authenticates
 * by HMAC over the raw body (spec §6) — a redirect to `/login` would be a 3xx
 * where the vendor expects a 200 and would silently break e-signature.
 */
const UNGATED_PREFIXES = ["/api/pandadoc/webhook", "/api/cron"] as const;

function isUngated(pathname: string): boolean {
  return UNGATED_PREFIXES.some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`),
  );
}

/**
 * `NextResponse.redirect` starts a fresh response, so the `Set-Cookie` headers
 * `getClaims()` may have just written for a rotated refresh token live only on
 * the response we are about to discard. Dropping them logs the user out on the
 * next request — the same class of bug as putting code between
 * `createServerClient` and `getClaims`, and just as intermittent, because it
 * only bites on the request where the token actually rotated.
 */
function redirectPreservingSession(
  request: NextRequest,
  carrier: NextResponse,
  to: string,
): NextResponse {
  const url = request.nextUrl.clone();
  const [pathname, search] = to.split("?");
  url.pathname = pathname;
  url.search = search ? `?${search}` : "";

  const redirect = NextResponse.redirect(url);
  for (const cookie of carrier.cookies.getAll()) {
    redirect.cookies.set(cookie);
  }
  return redirect;
}

export async function updateSession(request: NextRequest): Promise<NextResponse> {
  const pathname = request.nextUrl.pathname;

  if (isSimpleMode() && isPlatformPath(pathname)) {
    const url = request.nextUrl.clone();
    url.pathname = PLATFORM_DISABLED_PATH;
    url.search = "";
    return NextResponse.redirect(url);
  }

  let supabaseResponse = NextResponse.next({ request });

  const supabase = createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          for (const { name, value } of cookiesToSet) {
            request.cookies.set(name, value);
          }
          supabaseResponse = NextResponse.next({ request });
          for (const { name, value, options } of cookiesToSet) {
            supabaseResponse.cookies.set(name, value, options);
          }
        },
      },
    },
  );

  // Nothing between createServerClient and this call. Anything here — an env
  // read, a log line, an early return — races the token refresh and produces
  // random logouts that reproduce on no particular request.
  const { data } = await supabase.auth.getClaims();

  const claims = data?.claims ?? null;
  if (isUngated(pathname)) return supabaseResponse;

  const surface = surfaceForPath(pathname);

  // `/mfa` is authenticated but deliberately below the aal2 bar: it is where a
  // staff account goes to *acquire* aal2, so gating it on aal2 is a closed loop.
  if (pathname === "/mfa" && !claims) {
    return redirectPreservingSession(
      request,
      supabaseResponse,
      `/login?next=${encodeURIComponent(pathname)}`,
    );
  }

  if (!surface) return supabaseResponse;

  if (!claims) {
    const next = `${pathname}${request.nextUrl.search}`;
    return redirectPreservingSession(
      request,
      supabaseResponse,
      `/login?next=${encodeURIComponent(next)}`,
    );
  }

  // The role is read from `public.profiles` under the caller's own JWT, not
  // from the token. A JWT claim is a snapshot taken at sign-in and is stale
  // until the next refresh, so a deactivated account or a role that has just
  // been changed would keep its old access for up to an hour. This read costs
  // one round trip and only on the three gated surfaces — `isUngated` and the
  // `!surface` return above mean a marketing request never makes it.
  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", claims.sub)
    .maybeSingle();

  const role: AppRole | null = isAppRole(profile?.role) ? profile.role : null;

  if (!role || !roleMayEnter(role, surface)) {
    // Not "403 you are a customer": a wrong-surface request is answered by
    // sending the caller to the surface that is theirs, and a session with no
    // readable profile (deactivated, or never provisioned) is treated as no
    // session at all.
    return redirectPreservingSession(
      request,
      supabaseResponse,
      role ? landingPathFor(role) : "/login",
    );
  }

  if (SURFACES[surface].requiresAal2 && claims.aal !== "aal2") {
    const next = `${pathname}${request.nextUrl.search}`;
    return redirectPreservingSession(
      request,
      supabaseResponse,
      `/mfa?next=${encodeURIComponent(next)}`,
    );
  }

  return supabaseResponse;
}
