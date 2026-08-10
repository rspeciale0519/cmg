import "server-only";

import { createHash } from "node:crypto";

/**
 * Have I Been Pwned range search, k-anonymity form: only the first five hex
 * characters of the SHA-1 digest leave this process, and the response is a list
 * of suffixes we match locally. The full hash is never transmitted.
 *
 * This exists because Supabase's own leaked-password protection is a hosted
 * Pro-plan setting with no equivalent in `supabase/config.toml` — there is no
 * local toggle to turn on, so the control is implemented app-side here and the
 * platform switch stays a Phase 9 launch item (docs/temp/BLOCKERS.md).
 *
 * Fails OPEN, deliberately. The alternative is that an HIBP outage or an
 * offline dev machine makes it impossible for an invited homeowner to set any
 * password at all. The length and composition rules in
 * `src/lib/validators/password.ts` are the ones that must never be skippable;
 * this is an additional filter on top of them, and a filter that takes the
 * whole flow down with it when a third party is unreachable is worse than the
 * breach it prevents. Every skip is logged.
 */
const HIBP_ENDPOINT = "https://api.pwnedpasswords.com/range";
const TIMEOUT_MS = 2500;

export async function isLeakedPassword(password: string): Promise<boolean> {
  if (process.env.DISABLE_LEAKED_PASSWORD_CHECK === "true") return false;

  const digest = createHash("sha1").update(password, "utf8").digest("hex").toUpperCase();
  const prefix = digest.slice(0, 5);
  const suffix = digest.slice(5);

  try {
    const response = await fetch(`${HIBP_ENDPOINT}/${prefix}`, {
      headers: { "Add-Padding": "true" },
      signal: AbortSignal.timeout(TIMEOUT_MS),
      cache: "no-store",
    });

    if (!response.ok) {
      console.warn("[leaked-password] range lookup unavailable", response.status);
      return false;
    }

    const body = await response.text();
    for (const line of body.split("\n")) {
      const [candidate, count] = line.trim().split(":");
      if (candidate === suffix && Number(count) > 0) return true;
    }

    return false;
  } catch (error) {
    console.warn(
      "[leaked-password] range lookup failed; allowing the password",
      error instanceof Error ? error.message : error,
    );
    return false;
  }
}
