import type { ESignCapabilities } from "@/lib/esign/provider";

/**
 * The Settings screen's model, kept pure so every judgement it makes about the
 * environment can be tested against a fabricated environment rather than the one
 * the test happens to run in.
 *
 * WHY NOTHING HERE IS STORED IN THE DATABASE
 *
 * Spec §9 lists Settings as "org info, fee default, LOR template fields". None
 * of the three is workspace data, and a table would have made the screen lie
 * about two of them:
 *
 *   * Org info feeds `src/lib/site.ts`, which is consumed by the six marketing
 *     pages — all statically prerendered. Reading it from Postgres would either
 *     make those pages dynamic (losing the static render the build gates on) or
 *     leave an editor whose saves never reach the site anyone reads. Changing
 *     the licence number is a deploy, and the screen says so.
 *   * The LOR template is a PandaDoc template UUID in `PANDADOC_LOR_TEMPLATE_UUID`,
 *     a server-only secret (§7.8). A settings row cannot hold it without moving
 *     a credential out of the environment and into a table.
 *   * The fee default is the one that could be stored — but the surface that
 *     would consume it, the per-claim Financials tab, is outside this phase's
 *     scope, so a persisted value would change nothing anyone can see. A field
 *     that saves and has no effect is worse than one that is honestly read-only.
 *
 * So this screen is a configuration console: it reports where each value lives,
 * what it currently is, and what changing it takes. Everything on it is derived
 * from real runtime state.
 */

/**
 * CMG's standard contingency fee. Not invented for this screen — it is the
 * figure recorded on both seeded claims (`claim_financials.fee_percent = 10.00`)
 * and is the reference an adjuster starts from. The binding number for any given
 * claim is the one on that claim's Financials tab; this is the default a new
 * agreement is written against.
 */
export const FEE_PERCENT_DEFAULT = 10;

export type IntegrationState = "ready" | "attention" | "absent";

export type IntegrationFact = {
  label: string;
  value: string;
  /** Renders muted — for "not set" and other absences. */
  quiet?: boolean;
};

export type Integration = {
  key: string;
  name: string;
  state: IntegrationState;
  /** What is true right now, in one clause. */
  headline: string;
  /** What that means, and what to do about it if anything. */
  detail: string;
  facts: IntegrationFact[];
};

export type TurnstileKeyKind =
  | "absent"
  | "test-pass"
  | "test-block"
  | "test-challenge"
  | "live";

/**
 * Cloudflare's documented dummy keys are a digit, an `x`, a run of zeros and two
 * letters — `1x00000000000000000000AA` as a sitekey,
 * `1x0000000000000000000000000000000AA` as a secret. The leading digit is the
 * behaviour: 1 always passes, 2 always fails, 3 forces an interactive challenge.
 *
 * Matched on shape rather than on a list of literals, so the invisible-widget
 * variants (`…BB`) and any future pair are caught too. A real key cannot collide
 * with this: live keys carry entropy immediately after the `0x` prefix, and this
 * demands at least eighteen zeros there.
 */
export function classifyTurnstileKey(key: string | null): TurnstileKeyKind {
  if (!key) return "absent";

  const match = /^([0-9])x0{18,}[A-Z]{2}$/.exec(key.trim());
  if (!match) return "live";

  if (match[1] === "1") return "test-pass";
  if (match[1] === "2") return "test-block";
  return "test-challenge";
}

const TURNSTILE_BEHAVIOUR: Record<TurnstileKeyKind, string> = {
  absent: "not set",
  "test-pass": "test key — always passes",
  "test-block": "test key — always blocks",
  "test-challenge": "test key — always challenges",
  live: "live key",
};

export type SupabaseProbe = {
  ok: boolean;
  /** Round-trip in milliseconds for the query that was actually run. */
  latencyMs: number | null;
  /** Host and port only — never the key, never the path. */
  origin: string | null;
  local: boolean;
  error: string | null;
};

export type IntegrationEnvironment = {
  supabase: SupabaseProbe;
  resendApiKey: string | null;
  emailFrom: string | null;
  turnstileSiteKey: string | null;
  turnstileSecretKey: string | null;
  esign: ESignCapabilities;
};

/**
 * The panel, derived entirely from what was measured or read a moment ago.
 * Nothing here is a hardcoded list of "integrations we have" — an entry's state
 * is a function of its inputs, so a key added to the environment changes this
 * screen on the next request.
 */
export function buildIntegrations(env: IntegrationEnvironment): Integration[] {
  return [
    supabaseIntegration(env.supabase),
    resendIntegration(env.resendApiKey, env.emailFrom),
    turnstileIntegration(env.turnstileSiteKey, env.turnstileSecretKey),
    esignIntegration(env.esign),
  ];
}

function supabaseIntegration(probe: SupabaseProbe): Integration {
  const facts: IntegrationFact[] = [
    {
      label: "Endpoint",
      value: probe.origin ?? "not set",
      quiet: probe.origin === null,
    },
    {
      label: "Round trip",
      value: probe.latencyMs === null ? "no answer" : `${probe.latencyMs} ms`,
      quiet: probe.latencyMs === null,
    },
  ];

  if (!probe.ok) {
    return {
      key: "supabase",
      name: "Supabase",
      state: "attention",
      headline: "The database did not answer.",
      detail:
        probe.error ??
        "Every screen in the workspace reads through this. Check that the stack is running and that the URL and publishable key are set.",
      facts,
    };
  }

  return {
    key: "supabase",
    name: "Supabase",
    state: "ready",
    headline: probe.local
      ? "Answering — local Docker stack."
      : "Answering — hosted project.",
    detail: probe.local
      ? "This environment is pointed at the local stack, so nothing here touches production data. The query was run as your own session, so row-level security applied to it."
      : "The query was run as your own session, so row-level security applied to it.",
    facts,
  };
}

function resendIntegration(apiKey: string | null, from: string | null): Integration {
  const facts: IntegrationFact[] = [
    { label: "From address", value: from ?? "not set", quiet: from === null },
  ];

  if (!apiKey) {
    return {
      key: "resend",
      name: "Resend",
      state: "absent",
      headline: "No API key, so no mail leaves the system.",
      detail:
        "Notifications are still written to the outbox and still retried, so nothing is lost — they just are not delivered. Invitations fall back to a link the screen hands you to pass on yourself. Set RESEND_API_KEY to turn delivery on.",
      facts,
    };
  }

  return {
    key: "resend",
    name: "Resend",
    state: "ready",
    headline: "Configured — notifications are delivered.",
    detail:
      "The outbox attempts delivery immediately after each write and the cron sweep retries anything that failed, backing off up to five times before marking it dead.",
    facts,
  };
}

function turnstileIntegration(
  siteKey: string | null,
  secretKey: string | null,
): Integration {
  const site = classifyTurnstileKey(siteKey);
  const secret = classifyTurnstileKey(secretKey);

  const facts: IntegrationFact[] = [
    {
      label: "Site key",
      value: TURNSTILE_BEHAVIOUR[site],
      quiet: site === "absent",
    },
    {
      label: "Secret key",
      value: TURNSTILE_BEHAVIOUR[secret],
      quiet: secret === "absent",
    },
  ];

  if (site === "absent" || secret === "absent") {
    return {
      key: "turnstile",
      name: "Turnstile",
      state: "attention",
      headline: "Incomplete, so the public forms refuse every submission.",
      detail:
        "Verification fails closed: a missing secret is treated as a failed challenge, so intake and contact submissions are rejected. Set both NEXT_PUBLIC_TURNSTILE_SITE_KEY and TURNSTILE_SECRET_KEY.",
      facts,
    };
  }

  if (site !== "live" || secret !== "live") {
    return {
      key: "turnstile",
      name: "Turnstile",
      state: "attention",
      headline: "Running on Cloudflare's test keys.",
      detail:
        "These are the documented dummy keys. They behave predictably for development and give the intake and contact forms no bot protection whatsoever. Swap in the real pair from the Cloudflare dashboard before the site takes public traffic.",
      facts,
    };
  }

  return {
    key: "turnstile",
    name: "Turnstile",
    state: "ready",
    headline: "Live keys — the public forms are protected.",
    detail:
      "Every intake, contact and referral submission is verified server-side before anything is written, and a failed verification is refused rather than logged.",
    facts,
  };
}

function esignIntegration(esign: ESignCapabilities): Integration {
  const facts: IntegrationFact[] = [
    { label: "Provider", value: esign.mode === "pandadoc" ? "PandaDoc" : "Manual" },
    {
      label: "LOR template",
      value: esign.templateConfigured ? "configured" : "not set",
      quiet: !esign.templateConfigured,
    },
    {
      label: "Webhook key",
      value: esign.webhookConfigured ? "configured" : "not set",
      quiet: !esign.webhookConfigured,
    },
  ];

  if (esign.mode === "manual") {
    return {
      key: "esign",
      name: "E-signature",
      state: "absent",
      headline: "Manual mode — CMG sends the letter itself.",
      detail:
        "With no PANDADOC_API_KEY the manual provider is active. Staff send the Letter of Representation outside the system and upload the signed copy, which still satisfies the gate on advancing a claim to LOR signed. Nothing is blocked; the step is just not automated.",
      facts,
    };
  }

  if (!esign.ready) {
    return {
      key: "esign",
      name: "E-signature",
      state: "attention",
      headline: "PandaDoc key present, but sending is blocked.",
      detail:
        esign.blocker ??
        "The provider is configured but cannot send. Check the template UUID.",
      facts,
    };
  }

  return {
    key: "esign",
    name: "E-signature",
    state: esign.webhookConfigured ? "ready" : "attention",
    headline: esign.webhookConfigured
      ? "PandaDoc — letters are sent and signatures come back automatically."
      : "PandaDoc can send, but signatures will not come back.",
    detail: esign.webhookConfigured
      ? "Sending creates the document from the template and emails every signer. The signed PDF returns by webhook and advances the claim on its own."
      : "Without PANDADOC_WEBHOOK_SHARED_KEY the webhook endpoint refuses every delivery, so a completed signature never reaches the claim. Set the shared key to close the loop.",
    facts,
  };
}
