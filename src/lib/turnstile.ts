const VERIFY_ENDPOINT =
  "https://challenges.cloudflare.com/turnstile/v0/siteverify";

export type TurnstileResult =
  | { ok: true }
  | { ok: false; reason: "missing-token" | "missing-secret" | "rejected" | "unreachable" };

type SiteverifyResponse = {
  success?: boolean;
  "error-codes"?: string[];
};

/**
 * Server-side Turnstile verification. Fails closed: every path that is not an
 * explicit `success: true` from Cloudflare returns `ok: false`, including a
 * missing token, an unconfigured secret and a network fault (spec §7.4).
 */
export async function verifyTurnstile(
  token: unknown,
  remoteIp?: string | null,
): Promise<TurnstileResult> {
  if (typeof token !== "string" || token.trim().length === 0) {
    return { ok: false, reason: "missing-token" };
  }

  const secret = process.env.TURNSTILE_SECRET_KEY;
  if (!secret) {
    return { ok: false, reason: "missing-secret" };
  }

  const body = new URLSearchParams({ secret, response: token });
  if (remoteIp) {
    body.set("remoteip", remoteIp);
  }

  let response: Response;
  try {
    response = await fetch(VERIFY_ENDPOINT, {
      method: "POST",
      headers: { "content-type": "application/x-www-form-urlencoded" },
      body,
      cache: "no-store",
    });
  } catch {
    return { ok: false, reason: "unreachable" };
  }

  if (!response.ok) {
    return { ok: false, reason: "unreachable" };
  }

  let payload: SiteverifyResponse;
  try {
    payload = (await response.json()) as SiteverifyResponse;
  } catch {
    return { ok: false, reason: "unreachable" };
  }

  return payload.success === true ? { ok: true } : { ok: false, reason: "rejected" };
}
