import "server-only";

import { countOutboxOwed, resendApiKey } from "@/lib/email/outbox";
import { esignCapabilities } from "@/lib/esign";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import {
  buildIntegrations,
  type Integration,
  type SupabaseProbe,
} from "./config";

/**
 * Collects the environment as it actually is, right now, and hands it to the
 * pure builder.
 *
 * The distinction this file exists to keep: nothing below decides what an
 * integration *means*. It measures and reads, and `buildIntegrations` judges.
 * That is what makes the judgements testable without a database, a network or a
 * process environment.
 */
export async function loadIntegrations(): Promise<Integration[]> {
  const [supabase, esign, outboxDue] = await Promise.all([
    probeSupabase(),
    Promise.resolve(esignCapabilities()),
    /* Through the service-role client, because `notifications_outbox` grants
       nothing to `authenticated` — not even to the owner reading this page. The
       count is a number, never a row, so no recipient address crosses into the
       render. */
    countOutboxOwed(createAdminClient()),
  ]);

  return buildIntegrations({
    supabase,
    resendApiKey: resendApiKey(),
    emailFrom: nonEmpty(process.env.EMAIL_FROM),
    outboxDue,
    turnstileSiteKey: nonEmpty(process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY),
    turnstileSecretKey: nonEmpty(process.env.TURNSTILE_SECRET_KEY),
    esign,
  });
}

/**
 * An empty string in `.env` is how "not configured" is written in practice —
 * `RESEND_API_KEY=""` reads back as a defined empty string, and treating that as
 * present is how a screen ends up reporting mail delivery that does not exist.
 */
function nonEmpty(value: string | undefined): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

/**
 * A real query, not a ping.
 *
 * `fetch(url)` against the REST root would prove a socket opened, which is not
 * what this panel claims. Reading one row through the caller's own client
 * exercises the whole path the workspace depends on — PostgREST, the session
 * cookie, the JWT, and RLS deciding the row — so "answering" here means the same
 * thing it means on every other screen.
 *
 * The measured query is the caller's own profile: it is a primary-key lookup, it
 * is guaranteed to be visible to them under `profiles_select_self_or_staff`, and
 * it costs the database nothing.
 */
async function probeSupabase(): Promise<SupabaseProbe> {
  const url = nonEmpty(process.env.NEXT_PUBLIC_SUPABASE_URL);
  let origin: string | null = null;
  let local = false;

  if (url) {
    try {
      const parsed = new URL(url);
      // Host and port only. The key is never in the URL, but a path or query
      // could carry one in a misconfigured environment, and this panel is a
      // screenshot away from a support ticket.
      origin = parsed.host;
      local = ["127.0.0.1", "localhost", "[::1]"].includes(parsed.hostname);
    } catch {
      origin = "malformed URL";
    }
  }

  if (!url) {
    return {
      ok: false,
      latencyMs: null,
      origin: null,
      local: false,
      error:
        "NEXT_PUBLIC_SUPABASE_URL is not set, so nothing in the workspace can read or write.",
    };
  }

  const started = performance.now();

  try {
    const supabase = await createClient();
    const { data: claims } = await supabase.auth.getClaims();
    const userId = claims?.claims?.sub;

    const { error } = await supabase
      .from("profiles")
      .select("id")
      .eq("id", typeof userId === "string" ? userId : "")
      .maybeSingle();

    const latencyMs = Math.round(performance.now() - started);

    if (error) {
      return {
        ok: false,
        latencyMs,
        origin,
        local,
        error: `The database answered with an error: ${error.message}`,
      };
    }

    return { ok: true, latencyMs, origin, local, error: null };
  } catch (cause) {
    return {
      ok: false,
      latencyMs: null,
      origin,
      local,
      error:
        cause instanceof Error
          ? `The database could not be reached: ${cause.message}`
          : "The database could not be reached.",
    };
  }
}
