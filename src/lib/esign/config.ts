import "server-only";

import type { ESignMode } from "./types";
import {readSignuDocSettings,type SignuDocSettings} from "./signudoc/config";

/**
 * Every PandaDoc value is server-only (spec §7.8). None of them is ever read
 * through `NEXT_PUBLIC_*`, so none of them can reach a client bundle.
 *
 * Read at call time rather than at module scope: the factory must be able to
 * see an environment that changed after import, which is what makes the
 * provider swap testable and what makes a key added to Vercel take effect on
 * the next request rather than the next deploy.
 */
export type ESignConfig = {
  signudoc?:SignuDocSettings;
  apiKey: string | null;
  templateUuid: string | null;
  templateUuidSingle: string | null;
  webhookSharedKey: string | null;
  baseUrl: string;
  /**
   * Sandbox keys are capped at 10 requests/minute for the whole workspace, and
   * the draft poll is the greediest thing we do — hence configurable, and
   * defaulted to a deliberately gentle 2 s rather than the blueprint's
   * production-oriented 500 ms.
   */
  pollIntervalMs: number;
  pollMaxAttempts: number;
};

const DEFAULT_BASE_URL = "https://api.pandadoc.com/public/v1";
const DEFAULT_POLL_INTERVAL_MS = 2000;
const DEFAULT_POLL_MAX_ATTEMPTS = 20;

function trimmedEnv(name: string): string | null {
  const value = process.env[name];
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function positiveIntEnv(name: string, fallback: number): number {
  const raw = trimmedEnv(name);
  if (raw === null) return fallback;
  const parsed = Number.parseInt(raw, 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

export function readESignConfig(): ESignConfig {
  return {
    signudoc:readSignuDocSettings(),
    apiKey: trimmedEnv("PANDADOC_API_KEY"),
    templateUuid: trimmedEnv("PANDADOC_LOR_TEMPLATE_UUID"),
    templateUuidSingle: trimmedEnv("PANDADOC_LOR_TEMPLATE_UUID_SINGLE"),
    webhookSharedKey: trimmedEnv("PANDADOC_WEBHOOK_SHARED_KEY"),
    baseUrl: trimmedEnv("PANDADOC_API_BASE_URL") ?? DEFAULT_BASE_URL,
    pollIntervalMs: positiveIntEnv("PANDADOC_POLL_INTERVAL_MS", DEFAULT_POLL_INTERVAL_MS),
    pollMaxAttempts: positiveIntEnv("PANDADOC_POLL_MAX_ATTEMPTS", DEFAULT_POLL_MAX_ATTEMPTS),
  };
}

/** `pandadoc` when an API key is present, `manual` otherwise. */
export function esignMode(config: ESignConfig = readESignConfig()): ESignMode {
  return config.signudoc?.enabled ? "signudoc" : config.apiKey === null ? "manual" : "pandadoc";
}
