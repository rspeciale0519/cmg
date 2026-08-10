import "server-only";

import { esignMode, readESignConfig, type ESignConfig } from "./config";
import { ManualSignProvider } from "./manual";
import { PandaDocProvider } from "./pandadoc";
import { PandaDocClient, type FetchLike, type SleepLike } from "./pandadoc-client";
import type { ESignMode, ESignProvider } from "./types";

/**
 * What the admin UI needs in order to render the right controls: whether the
 * platform can send the letter itself, and if not, why not.
 */
export type ESignCapabilities = {
  mode: ESignMode;
  canSendElectronically: boolean;
  /** True when a send would actually reach PandaDoc today. */
  ready: boolean;
  templateConfigured: boolean;
  /** Inbound webhooks are refused outright without the shared key. */
  webhookConfigured: boolean;
  /** Non-null when `ready` is false; safe to show to staff (no secrets). */
  blocker: string | null;
};

export function esignCapabilities(
  config: ESignConfig = readESignConfig(),
): ESignCapabilities {
  const mode = esignMode(config);
  const templateConfigured =
    config.templateUuid !== null || config.templateUuidSingle !== null;
  const webhookConfigured = config.webhookSharedKey !== null;

  if (mode === "manual") {
    return {
      mode,
      canSendElectronically: false,
      ready: true,
      templateConfigured,
      webhookConfigured,
      blocker: null,
    };
  }

  return {
    mode,
    canSendElectronically: true,
    ready: templateConfigured,
    templateConfigured,
    webhookConfigured,
    blocker: templateConfigured
      ? null
      : "No PandaDoc LOR template is configured (PANDADOC_LOR_TEMPLATE_UUID).",
  };
}

export type CreateESignProviderOptions = {
  config?: ESignConfig;
  /** Test seam for the PandaDoc HTTP layer. */
  fetchImpl?: FetchLike;
  sleep?: SleepLike;
};

/**
 * The factory: `PandaDocProvider` when `PANDADOC_API_KEY` is set, otherwise
 * `ManualSignProvider`. Nothing else selects between them, and the choice is
 * re-made per call so a key added to the environment takes effect on the next
 * request.
 */
export function createESignProvider(
  options: CreateESignProviderOptions = {},
): ESignProvider {
  const config = options.config ?? readESignConfig();

  if (config.apiKey === null) {
    return new ManualSignProvider();
  }

  return new PandaDocProvider({
    client: new PandaDocClient({
      apiKey: config.apiKey,
      baseUrl: config.baseUrl,
      pollIntervalMs: config.pollIntervalMs,
      pollMaxAttempts: config.pollMaxAttempts,
      fetchImpl: options.fetchImpl,
      sleep: options.sleep,
    }),
    templateUuid: config.templateUuid,
    templateUuidSingle: config.templateUuidSingle,
  });
}

if (process.env.NODE_ENV === "development") {
  const capabilities = esignCapabilities();
  console.info(
    `[esign] provider=${capabilities.mode} ready=${capabilities.ready} webhook-key=${
      capabilities.webhookConfigured ? "set" : "absent"
    }${capabilities.blocker ? ` blocker="${capabilities.blocker}"` : ""}`,
  );
}
