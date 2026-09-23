import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { writeAudit } from "@/lib/audit";
import { isWellFormedTokenHash, RECOVERY_EXPIRED_PATH } from "@/lib/auth/recovery";
import { clientIpFromHeaders, inetOrNull } from "@/lib/rate-limit";
import { isPathOpen, PLATFORM_DISABLED_PATH } from "@/lib/site-mode";
import { createAdminClient } from "@/lib/supabase/admin";
import type { Database } from "@/types/database-app";

/**
 * The emailed recovery link lands here: `?token_hash=<hex>&type=recovery`.
 *
 * The token is verified server-side with the user-scoped SSR client, so the
 * recovery session is written to cookies on this response and the token never
 * reaches client code. The response is always a redirect: `/reset-password`
 * on success, and one generic "expired or already used" notice for a missing,
 * malformed, repeated, unknown, expired or already-consumed token. Nothing from
 * the query string is reflected.
 */
function redirectTo(request: NextRequest, target: string): NextResponse {
  const [pathname, search] = target.split("?");
  const url = request.nextUrl.clone();
  url.pathname = pathname;
  url.search = search ? `?${search}` : "";

  const response = NextResponse.redirect(url, 303);
  // The request URL holds a one-time credential. Neither it nor the redirect
  // that consumed it should be cached or quoted in a Referer.
  response.headers.set("Cache-Control", "no-store");
  response.headers.set("Referrer-Policy", "no-referrer");
  return response;
}

/** Exactly one value per parameter; a repeated parameter is refused. */
function single(params: URLSearchParams, name: string): string | null {
  const values = params.getAll(name);
  return values.length === 1 ? values[0] : null;
}

export async function GET(request: NextRequest): Promise<NextResponse> {
  if (!isPathOpen("/auth/confirm")) {
    return redirectTo(request, PLATFORM_DISABLED_PATH);
  }

  const params = request.nextUrl.searchParams;
  const tokenHash = single(params, "token_hash");
  const type = single(params, "type");

  if (type !== "recovery" || !tokenHash || !isWellFormedTokenHash(tokenHash)) {
    return redirectTo(request, RECOVERY_EXPIRED_PATH);
  }

  const success = redirectTo(request, "/reset-password");

  // Bound to this request and to the success response directly, so the
  // session cookies `verifyOtp` writes are on the response that is returned.
  const supabase = createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          for (const { name, value, options } of cookiesToSet) {
            success.cookies.set(name, value, options);
          }
        },
      },
    },
  );

  let verified: Awaited<ReturnType<typeof supabase.auth.verifyOtp>>;
  try {
    verified = await supabase.auth.verifyOtp({
      type: "recovery",
      token_hash: tokenHash,
    });
  } catch (cause) {
    console.error(
      "[auth/confirm] verification threw",
      cause instanceof Error ? cause.name : "unknown",
    );
    return redirectTo(request, RECOVERY_EXPIRED_PATH);
  }

  const { data, error } = verified;
  if (error || !data.session || !data.user) {
    return redirectTo(request, RECOVERY_EXPIRED_PATH);
  }

  await writeAudit(createAdminClient(), {
    actorId: data.user.id,
    action: "auth.password_reset_link_verified",
    entity: "auth",
    entityId: data.user.id,
    ip: inetOrNull(clientIpFromHeaders(request.headers)),
  });

  return success;
}
