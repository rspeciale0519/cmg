import "server-only";

import { ESignError } from "./types";

/**
 * Thin typed wrapper over the five PandaDoc endpoints this platform touches.
 * Deliberately not the generated SDK: five calls do not justify a client
 * library, and hand-rolling keeps the 429/409 retry behaviour — the part that
 * actually matters against a 10 req/min sandbox key — visible and testable.
 */

export type FetchLike = (input: string, init?: RequestInit) => Promise<Response>;
export type SleepLike = (ms: number) => Promise<void>;

export type PandaDocDocument = {
  id: string;
  status: string;
  name?: string;
};

export type CreateDocumentRecipient = {
  email: string;
  first_name: string;
  last_name: string;
  role: string;
};

export type CreateDocumentBody = {
  name: string;
  template_uuid: string;
  recipients: CreateDocumentRecipient[];
  tokens: Array<{ name: string; value: string }>;
  metadata: Record<string, string>;
};

export type SendDocumentBody = {
  message?: string;
  subject?: string;
  silent?: boolean;
};

export type PandaDocClientOptions = {
  apiKey: string;
  baseUrl: string;
  pollIntervalMs: number;
  pollMaxAttempts: number;
  fetchImpl?: FetchLike;
  sleep?: SleepLike;
};

const RETRYABLE_STATUSES = new Set([429, 500, 502, 503, 504]);
const MAX_TRANSPORT_ATTEMPTS = 4;

const defaultSleep: SleepLike = (ms) =>
  new Promise((resolve) => {
    setTimeout(resolve, ms);
  });

function readDetail(payload: unknown): string | null {
  if (typeof payload !== "object" || payload === null) return null;
  const record = payload as Record<string, unknown>;
  for (const key of ["detail", "message", "error"]) {
    const value = record[key];
    if (typeof value === "string" && value.length > 0) return value;
  }
  return null;
}

export class PandaDocClient {
  private readonly apiKey: string;
  private readonly baseUrl: string;
  private readonly fetchImpl: FetchLike;
  private readonly sleep: SleepLike;
  readonly pollIntervalMs: number;
  readonly pollMaxAttempts: number;

  constructor(options: PandaDocClientOptions) {
    this.apiKey = options.apiKey;
    this.baseUrl = options.baseUrl.replace(/\/+$/, "");
    this.pollIntervalMs = options.pollIntervalMs;
    this.pollMaxAttempts = options.pollMaxAttempts;
    this.fetchImpl = options.fetchImpl ?? ((input, init) => fetch(input, init));
    this.sleep = options.sleep ?? defaultSleep;
  }

  private backoffMs(attempt: number, response: Response | null): number {
    const retryAfter = response?.headers.get("retry-after");
    if (retryAfter) {
      const seconds = Number.parseInt(retryAfter, 10);
      if (Number.isFinite(seconds) && seconds > 0) return seconds * 1000;
    }
    return this.pollIntervalMs * 2 ** attempt;
  }

  /**
   * One HTTP call plus the transport-level retries: 429 (sandbox throttle,
   * honouring `Retry-After`) and 5xx. 404 and 409 are *not* retried here —
   * they are the async-creation rule showing through and are handled by the
   * callers that know what to do about them.
   */
  private async request(
    path: string,
    init: RequestInit,
    accept: "json" | "binary",
  ): Promise<Response> {
    let lastError: ESignError | null = null;

    for (let attempt = 0; attempt < MAX_TRANSPORT_ATTEMPTS; attempt += 1) {
      let response: Response;
      try {
        response = await this.fetchImpl(`${this.baseUrl}${path}`, {
          ...init,
          headers: {
            Authorization: `API-Key ${this.apiKey}`,
            Accept: accept === "json" ? "application/json" : "application/pdf",
            ...(init.body ? { "Content-Type": "application/json" } : {}),
            ...(init.headers as Record<string, string> | undefined),
          },
          cache: "no-store",
        });
      } catch (cause) {
        lastError = new ESignError(
          "send_failed",
          `PandaDoc request to ${path} failed: ${
            cause instanceof Error ? cause.message : "network error"
          }`,
        );
        await this.sleep(this.backoffMs(attempt, null));
        continue;
      }

      if (response.ok || !RETRYABLE_STATUSES.has(response.status)) {
        return response;
      }

      lastError = new ESignError(
        response.status === 429 ? "rate_limited" : "send_failed",
        `PandaDoc responded ${response.status} for ${path}`,
        response.status,
      );

      if (attempt === MAX_TRANSPORT_ATTEMPTS - 1) break;
      await this.sleep(this.backoffMs(attempt, response));
    }

    throw lastError ?? new ESignError("send_failed", `PandaDoc request to ${path} failed`);
  }

  private async failure(
    response: Response,
    code: ESignError["code"],
    what: string,
  ): Promise<ESignError> {
    let detail: string | null = null;
    try {
      detail = readDetail(await response.json());
    } catch {
      detail = null;
    }
    return new ESignError(
      code,
      `${what} failed (${response.status})${detail ? `: ${detail}` : ""}`,
      response.status,
    );
  }

  async createDocument(body: CreateDocumentBody): Promise<PandaDocDocument> {
    const response = await this.request("/documents", {
      method: "POST",
      body: JSON.stringify(body),
    }, "json");

    if (!response.ok) {
      throw await this.failure(response, "creation_failed", "PandaDoc document creation");
    }

    return (await response.json()) as PandaDocDocument;
  }

  /** `null` on 404 — the documented answer while creation is still in flight. */
  async getDocument(documentId: string): Promise<PandaDocDocument | null> {
    const response = await this.request(`/documents/${documentId}`, { method: "GET" }, "json");

    if (response.status === 404) return null;
    if (!response.ok) {
      throw await this.failure(response, "creation_failed", "PandaDoc document status");
    }

    return (await response.json()) as PandaDocDocument;
  }

  /**
   * Creation is asynchronous: the document is unusable — 404 on read, 409 on
   * send — until it reaches `document.draft`.
   */
  async waitForDraft(documentId: string): Promise<PandaDocDocument> {
    for (let attempt = 0; attempt < this.pollMaxAttempts; attempt += 1) {
      const document = await this.getDocument(documentId);

      if (document?.status === "document.draft") return document;

      if (document && document.status !== "document.uploaded") {
        throw new ESignError(
          "creation_failed",
          `PandaDoc document ${documentId} reached ${document.status} instead of document.draft`,
        );
      }

      await this.sleep(this.pollIntervalMs);
    }

    throw new ESignError(
      "draft_timeout",
      `PandaDoc document ${documentId} was still not in document.draft after ${this.pollMaxAttempts} polls`,
    );
  }

  /** Retries 409 — the document was still finishing creation when we asked. */
  async sendDocument(
    documentId: string,
    body: SendDocumentBody,
  ): Promise<PandaDocDocument> {
    for (let attempt = 0; attempt < this.pollMaxAttempts; attempt += 1) {
      const response = await this.request(`/documents/${documentId}/send`, {
        method: "POST",
        body: JSON.stringify(body),
      }, "json");

      if (response.ok) return (await response.json()) as PandaDocDocument;

      if (response.status !== 409) {
        throw await this.failure(response, "send_failed", "PandaDoc send");
      }

      await this.sleep(this.pollIntervalMs);
    }

    throw new ESignError(
      "send_failed",
      `PandaDoc document ${documentId} stayed in conflict through ${this.pollMaxAttempts} send attempts`,
    );
  }

  /**
   * The digitally sealed copy — same bytes every time, signature certificate
   * included. This is the legally meaningful PDF, not `/download`.
   */
  async downloadProtected(documentId: string): Promise<Uint8Array> {
    const response = await this.request(
      `/documents/${documentId}/download-protected`,
      { method: "GET" },
      "binary",
    );

    if (!response.ok) {
      throw await this.failure(response, "download_failed", "PandaDoc protected download");
    }

    return new Uint8Array(await response.arrayBuffer());
  }
}
