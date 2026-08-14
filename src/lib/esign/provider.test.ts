import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

const { createESignProvider, esignCapabilities } = await import("./provider");
const { esignMode, readESignConfig } = await import("./config");
const { ManualSignProvider } = await import("./manual");
const { PandaDocProvider } = await import("./pandadoc");
const { ESignError, MANUAL_ESIGN_STATUS } = await import("./types");

const PANDADOC_VARS = [
  "PANDADOC_API_KEY",
  "PANDADOC_LOR_TEMPLATE_UUID",
  "PANDADOC_LOR_TEMPLATE_UUID_SINGLE",
  "PANDADOC_WEBHOOK_SHARED_KEY",
  "PANDADOC_API_BASE_URL",
  "PANDADOC_POLL_INTERVAL_MS",
  "PANDADOC_POLL_MAX_ATTEMPTS",
] as const;

const saved = new Map<string, string | undefined>();

beforeEach(() => {
  for (const name of PANDADOC_VARS) {
    saved.set(name, process.env[name]);
    delete process.env[name];
  }
});

afterEach(() => {
  for (const name of PANDADOC_VARS) {
    const value = saved.get(name);
    if (value === undefined) delete process.env[name];
    else process.env[name] = value;
  }
});

describe("readESignConfig", () => {
  it("treats blank and whitespace-only values as absent", () => {
    process.env.PANDADOC_API_KEY = "   ";
    process.env.PANDADOC_LOR_TEMPLATE_UUID = "";

    const config = readESignConfig();
    expect(config.apiKey).toBeNull();
    expect(config.templateUuid).toBeNull();
    expect(esignMode(config)).toBe("manual");
  });

  it("defaults the poll to a sandbox-safe interval and rejects nonsense overrides", () => {
    expect(readESignConfig().pollIntervalMs).toBe(2000);
    expect(readESignConfig().pollMaxAttempts).toBe(20);

    process.env.PANDADOC_POLL_INTERVAL_MS = "250";
    process.env.PANDADOC_POLL_MAX_ATTEMPTS = "not-a-number";
    expect(readESignConfig().pollIntervalMs).toBe(250);
    expect(readESignConfig().pollMaxAttempts).toBe(20);

    process.env.PANDADOC_POLL_INTERVAL_MS = "-5";
    expect(readESignConfig().pollIntervalMs).toBe(2000);
  });
});

describe("createESignProvider", () => {
  it("falls back to manual signing when no API key is configured", () => {
    const provider = createESignProvider();

    expect(provider).toBeInstanceOf(ManualSignProvider);
    expect(provider.kind).toBe("manual");
    expect(provider.canSendElectronically).toBe(false);
  });

  it("selects PandaDoc the moment an API key exists", () => {
    process.env.PANDADOC_API_KEY = "sandbox-key";

    const provider = createESignProvider();

    expect(provider).toBeInstanceOf(PandaDocProvider);
    expect(provider.kind).toBe("pandadoc");
    expect(provider.canSendElectronically).toBe(true);
  });

  it("re-reads the environment on every call rather than caching the choice", () => {
    expect(createESignProvider().kind).toBe("manual");
    process.env.PANDADOC_API_KEY = "sandbox-key";
    expect(createESignProvider().kind).toBe("pandadoc");
    delete process.env.PANDADOC_API_KEY;
    expect(createESignProvider().kind).toBe("manual");
  });
});

describe("esignCapabilities", () => {
  it("reports manual mode as ready — staff can always send a letter by hand", () => {
    expect(esignCapabilities()).toEqual({
      mode: "manual",
      canSendElectronically: false,
      ready: true,
      templateConfigured: true,
      webhookConfigured: false,
      blocker: null,
    });
  });

  it("reports PandaDoc ready because the LOR PDFs are bundled", () => {
    process.env.PANDADOC_API_KEY = "sandbox-key";

    const capabilities = esignCapabilities();
    expect(capabilities.mode).toBe("pandadoc");
    expect(capabilities.ready).toBe(true);
    expect(capabilities.templateConfigured).toBe(true);
    expect(capabilities.blocker).toBeNull();
  });

  it("reports the webhook configuration separately from the bundled PDF", () => {
    process.env.PANDADOC_API_KEY = "sandbox-key";
    process.env.PANDADOC_WEBHOOK_SHARED_KEY = "shared";

    expect(esignCapabilities()).toMatchObject({
      mode: "pandadoc",
      ready: true,
      templateConfigured: true,
      webhookConfigured: true,
      blocker: null,
    });
  });
});

describe("ManualSignProvider", () => {
  it("marks the letter as pending a manual signature and claims no delivery", async () => {
    await expect(new ManualSignProvider().dispatchLor()).resolves.toEqual({
      providerDocumentId: null,
      esignStatus: MANUAL_ESIGN_STATUS,
      deliveredByProvider: false,
    });
  });

  it("has nothing to download — the signed copy is uploaded by staff", async () => {
    await expect(new ManualSignProvider().downloadSignedPdf()).rejects.toThrow(ESignError);
    await expect(new ManualSignProvider().downloadSignedPdf()).rejects.toMatchObject({
      code: "unsupported",
    });
  });
});
