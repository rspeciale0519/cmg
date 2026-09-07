import { describe, expect, it } from "vitest";
import type { ESignCapabilities } from "@/lib/esign/provider";
import {
  buildIntegrations,
  classifyTurnstileKey,
  FEE_PERCENT_DEFAULT,
  LOR_TEMPLATE_ROLES,
  LOR_TEMPLATE_TOKENS,
  type IntegrationEnvironment,
  type SupabaseProbe,
} from "./config";

describe("application settings contract", () => {
  it("keeps the claim fee default within the persisted field's valid range", () => {
    expect(FEE_PERCENT_DEFAULT).toBeGreaterThanOrEqual(0);
    expect(FEE_PERCENT_DEFAULT).toBeLessThanOrEqual(100);
  });

  it("publishes the exact signer roles and tokens required by LOR dispatch", () => {
    expect(LOR_TEMPLATE_ROLES).toEqual(["H1", "H2"]);
    expect(LOR_TEMPLATE_TOKENS).toEqual([
      "Claim.Ref",
      "Claim.Carrier",
      "Claim.PolicyNumber",
      "Claim.ClaimNumber",
      "Claim.LossDate",
      "Claim.Cause",
      "Property.Address",
      "Homeowner1.Name",
      "Homeowner2.Name",
      "Policyholders.Name",
      "Homeowner1.Phone",
      "Homeowner1.Email",
      "Claim.EmergencyMark",
      "Claim.NonEmergencyMark",
      "Claim.SupplementalMark",
      "Adjuster.Name",
      "Fee.Percent",
    ]);
  });
});

const HEALTHY_DB: SupabaseProbe = {
  ok: true,
  latencyMs: 4,
  origin: "127.0.0.1:15421",
  local: true,
  error: null,
};

const MANUAL_ESIGN: ESignCapabilities = {
  mode: "manual",
  canSendElectronically: false,
  ready: true,
  templateConfigured: false,
  webhookConfigured: true,
  blocker: null,
};

function environment(overrides: Partial<IntegrationEnvironment> = {}): IntegrationEnvironment {
  return {
    supabase: HEALTHY_DB,
    resendApiKey: null,
    emailFrom: "CMG <claims@cmgpropertysolutions.net>",
    outboxDue: 0,
    turnstileSiteKey: "1x00000000000000000000AA",
    turnstileSecretKey: "1x0000000000000000000000000000000AA",
    esign: MANUAL_ESIGN,
    ...overrides,
  };
}

function pick(env: IntegrationEnvironment, key: string) {
  const found = buildIntegrations(env).find((integration) => integration.key === key);
  if (!found) throw new Error(`no integration named ${key}`);
  return found;
}

describe("classifyTurnstileKey", () => {
  it("recognises Cloudflare's documented site keys by behaviour digit", () => {
    expect(classifyTurnstileKey("1x00000000000000000000AA")).toBe("test-pass");
    expect(classifyTurnstileKey("2x00000000000000000000AB")).toBe("test-block");
    expect(classifyTurnstileKey("3x00000000000000000000FF")).toBe("test-challenge");
  });

  it("recognises the invisible-widget variants too", () => {
    // Matched on shape, not against a list of literals — the `…BB` pair would
    // be missed by an equality check and reported as a live key.
    expect(classifyTurnstileKey("1x00000000000000000000BB")).toBe("test-pass");
    expect(classifyTurnstileKey("2x00000000000000000000BB")).toBe("test-block");
  });

  it("recognises the longer secret keys", () => {
    expect(classifyTurnstileKey("1x0000000000000000000000000000000AA")).toBe("test-pass");
    expect(classifyTurnstileKey("2x0000000000000000000000000000000AA")).toBe("test-block");
    expect(classifyTurnstileKey("3x0000000000000000000000000000000AA")).toBe(
      "test-challenge",
    );
  });

  it("does not mistake a real key for a test key", () => {
    // Live keys carry entropy straight after the prefix; the detector demands at
    // least eighteen zeros there. A false positive would report a protected
    // production site as unprotected and send someone rotating keys for nothing.
    expect(classifyTurnstileKey("0x4AAAAAAABkMYinukE8nzYd")).toBe("live");
    expect(classifyTurnstileKey("0x4AAAAAAA0000000000000000")).toBe("live");
    expect(classifyTurnstileKey("1x000AA")).toBe("live");
  });

  it("treats absent and blank as absent", () => {
    expect(classifyTurnstileKey(null)).toBe("absent");
    expect(classifyTurnstileKey("")).toBe("absent");
  });

  it("tolerates surrounding whitespace from a copied .env value", () => {
    expect(classifyTurnstileKey("  1x00000000000000000000AA  ")).toBe("test-pass");
  });
});

describe("buildIntegrations — Turnstile", () => {
  it("flags test keys for attention and says the forms are unprotected", () => {
    const turnstile = pick(environment(), "turnstile");
    expect(turnstile.state).toBe("attention");
    expect(turnstile.headline).toMatch(/test keys/i);
    expect(turnstile.facts).toContainEqual({
      label: "Site key",
      value: "test key — always passes",
      quiet: false,
    });
  });

  it("flags a half-configured pair as refusing every submission", () => {
    // Verification fails closed, so a missing secret rejects real homeowners
    // rather than letting bots through — the opposite failure from the one the
    // wording would otherwise imply.
    const turnstile = pick(
      environment({ turnstileSecretKey: null }),
      "turnstile",
    );
    expect(turnstile.state).toBe("attention");
    expect(turnstile.headline).toMatch(/refuse every submission/i);
  });

  it("reports a live pair as ready", () => {
    const turnstile = pick(
      environment({
        turnstileSiteKey: "0x4AAAAAAABkMYinukE8nzYd",
        turnstileSecretKey: "0x4AAAAAAABkMYinukE8nzYdSECRETVALUE",
      }),
      "turnstile",
    );
    expect(turnstile.state).toBe("ready");
  });

  it("catches a live site key paired with a leftover test secret", () => {
    const turnstile = pick(
      environment({ turnstileSiteKey: "0x4AAAAAAABkMYinukE8nzYd" }),
      "turnstile",
    );
    expect(turnstile.state).toBe("attention");
  });
});

describe("buildIntegrations — Resend", () => {
  it("reports an absent key as mail queued but not delivered", () => {
    const resend = pick(environment(), "resend");
    expect(resend.state).toBe("absent");
    expect(resend.detail).toMatch(/nothing is lost/i);
  });

  it("reports a configured key as delivering", () => {
    const resend = pick(environment({ resendApiKey: "re_live_key" }), "resend");
    expect(resend.state).toBe("ready");
  });

  /* The panel used to say the queue was "still retried" without a key. The
     sweeper deliberately does not retry in that state — it claims nothing, so
     that a missing key cannot spend five attempts a row and bury the backlog in
     `dead`. This pins the copy to the behaviour. */
  it("does not claim an unconfigured queue is being retried", () => {
    const resend = pick(environment(), "resend");
    expect(resend.detail).not.toMatch(/still retried/i);
    expect(resend.detail).toMatch(/leaves them alone/i);
  });

  it("counts the backlog so an owner sees the size of what is waiting", () => {
    expect(pick(environment({ outboxDue: 47 }), "resend").facts).toContainEqual(
      expect.objectContaining({ label: "Waiting to send", value: "47 notifications" }),
    );
    expect(pick(environment({ outboxDue: 1 }), "resend").facts).toContainEqual(
      expect.objectContaining({ value: "1 notification" }),
    );
  });

  it("says the backlog could not be read rather than reporting it as zero", () => {
    expect(pick(environment({ outboxDue: null }), "resend").facts).toContainEqual(
      expect.objectContaining({ value: "could not be read" }),
    );
  });
});

describe("buildIntegrations — Supabase", () => {
  it("reports a healthy local stack with its measured round trip", () => {
    const supabase = pick(environment(), "supabase");
    expect(supabase.state).toBe("ready");
    expect(supabase.headline).toMatch(/local Docker stack/);
    expect(supabase.facts).toContainEqual({
      label: "Round trip",
      value: "4 ms",
      quiet: false,
    });
  });

  it("distinguishes a hosted project from the local stack", () => {
    const supabase = pick(
      environment({
        supabase: { ...HEALTHY_DB, local: false, origin: "abc.supabase.co" },
      }),
      "supabase",
    );
    expect(supabase.headline).toMatch(/hosted project/);
  });

  it("surfaces the failure reason when the database does not answer", () => {
    const supabase = pick(
      environment({
        supabase: {
          ok: false,
          latencyMs: null,
          origin: "127.0.0.1:15421",
          local: true,
          error: "The database could not be reached: fetch failed",
        },
      }),
      "supabase",
    );
    expect(supabase.state).toBe("attention");
    expect(supabase.detail).toMatch(/fetch failed/);
  });
});

describe("buildIntegrations — e-signature", () => {
  it("reports manual mode as a working fallback rather than a fault", () => {
    const esign = pick(environment(), "esign");
    expect(esign.state).toBe("absent");
    expect(esign.headline).toMatch(/Manual mode/);
    expect(esign.detail).toMatch(/Nothing is blocked/);
  });

  it("reports the bundled PandaDoc LOR PDF", () => {
    const esign = pick(
      environment({
        esign: {
          mode: "pandadoc",
          canSendElectronically: true,
          ready: true,
          templateConfigured: true,
          webhookConfigured: true,
          blocker: null,
        },
      }),
      "esign",
    );
    expect(esign.facts).toContainEqual({ label: "LOR template", value: "bundled PDF" });
  });

  it("flags a sending-capable PandaDoc with no webhook key", () => {
    // The subtle half-configured state: letters go out and signatures never come
    // back, so the claim silently sits in lor_sent forever.
    const esign = pick(
      environment({
        esign: {
          mode: "pandadoc",
          canSendElectronically: true,
          ready: true,
          templateConfigured: true,
          webhookConfigured: false,
          blocker: null,
        },
      }),
      "esign",
    );
    expect(esign.state).toBe("attention");
    expect(esign.headline).toMatch(/will not come back/);
  });

  it("reports a fully wired PandaDoc as ready", () => {
    const esign = pick(
      environment({
        esign: {
          mode: "pandadoc",
          canSendElectronically: true,
          ready: true,
          templateConfigured: true,
          webhookConfigured: true,
          blocker: null,
        },
      }),
      "esign",
    );
    expect(esign.state).toBe("ready");
  });
});

describe("buildIntegrations", () => {
  it("returns every integration in a stable order", () => {
    expect(buildIntegrations(environment()).map((i) => i.key)).toEqual([
      "supabase",
      "resend",
      "turnstile",
      "esign",
    ]);
  });
});
