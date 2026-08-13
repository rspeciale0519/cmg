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
  operationTimeoutMs?: number;
};

export type PandaDocOperation = {
  signal: AbortSignal;
  deadlineAt: number;
};

const RETRYABLE_STATUSES = new Set([429, 500, 502, 503, 504]);
const MAX_TRANSPORT_ATTEMPTS = 4;
const MAX_RETRY_DELAY_MS = 10_000;
export const PANDADOC_DISPATCH_TIMEOUT_MS = 90_000;

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
  readonly operationTimeoutMs: number;

  constructor(options: PandaDocClientOptions) {
    this.apiKey = options.apiKey;
    this.baseUrl = options.baseUrl.replace(/\/+$/, "");
    this.pollIntervalMs = options.pollIntervalMs;
    this.pollMaxAttempts = options.pollMaxAttempts;
    this.operationTimeoutMs = Math.min(
      Math.max(options.operationTimeoutMs ?? PANDADOC_DISPATCH_TIMEOUT_MS, 1),
      PANDADOC_DISPATCH_TIMEOUT_MS,
    );
    this.fetchImpl = options.fetchImpl ?? ((input, init) => fetch(input, init));
    this.sleep = options.sleep ?? defaultSleep;
  }

  private backoffMs(attempt: number, response: Response | null): number {
    const retryAfter = response?.headers.get("retry-after");
    if (retryAfter) {
      const seconds = Number.parseInt(retryAfter, 10);
      if (Number.isFinite(seconds) && seconds > 0) {
        return Math.min(seconds * 1000, MAX_RETRY_DELAY_MS);
      }
    }
    return Math.min(this.pollIntervalMs * 2 ** attempt, MAX_RETRY_DELAY_MS);
  }

  async withOperationDeadline<T>(
    work: (operation: PandaDocOperation) => Promise<T>,
  ): Promise<T> {
    const controller = new AbortController();
    const deadlineAt = Date.now() + this.operationTimeoutMs;
    const timer = setTimeout(() => controller.abort(), this.operationTimeoutMs);
    try {
      return await work({ signal: controller.signal, deadlineAt });
    } finally {
      clearTimeout(timer);
    }
  }

  private timeoutError(deliveryUncertain = false): ESignError {
    return new ESignError(
      "send_failed",
      deliveryUncertain
        ? "PandaDoc send timed out; delivery may have been accepted."
        : "PandaDoc dispatch exceeded its safe operation deadline.",
      undefined,
      deliveryUncertain,
    );
  }

  assertBeforeSend(operation: PandaDocOperation): void {
    if (operation.signal.aborted || Date.now() >= operation.deadlineAt) {
      throw this.timeoutError(false);
    }
  }

  private async readJson(
    response: Response,
    operation: PandaDocOperation,
    deliveryUncertain = false,
  ): Promise<unknown> {
    try {
      return await this.withinOperation(
        response.json(),
        operation,
        deliveryUncertain,
      );
    } catch (cause) {
      if (!deliveryUncertain || (cause instanceof ESignError && cause.deliveryUncertain)) {
        throw cause;
      }
      throw new ESignError(
        "send_failed",
        `PandaDoc accepted the send but returned an unreadable response: ${
          cause instanceof Error ? cause.message : "invalid response"
        }`,
        response.status,
        true,
      );
    }
  }

  private async withinOperation<T>(
    promise: Promise<T>,
    operation: PandaDocOperation,
    deliveryUncertain = false,
  ): Promise<T> {
    if (operation.signal.aborted || Date.now() >= operation.deadlineAt) {
      throw this.timeoutError(deliveryUncertain);
    }
    return new Promise<T>((resolve, reject) => {
      const abort = () => reject(this.timeoutError(deliveryUncertain));
      operation.signal.addEventListener("abort", abort, { once: true });
      promise.then(resolve, reject).finally(() => {
        operation.signal.removeEventListener("abort", abort);
      });
    });
  }

  private pause(ms: number, operation: PandaDocOperation): Promise<void> {
    const remaining = Math.max(operation.deadlineAt - Date.now(), 0);
    return this.withinOperation(this.sleep(Math.min(ms, remaining)), operation);
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
    operation: PandaDocOperation,
    sendMayBeAccepted = false,
  ): Promise<Response> {
    let lastError: ESignError | null = null;

    for (let attempt = 0; attempt < MAX_TRANSPORT_ATTEMPTS; attempt += 1) {
      let response: Response;
      try {
        response = await this.withinOperation(this.fetchImpl(`${this.baseUrl}${path}`, {
          ...init,
          headers: {
            Authorization: `API-Key ${this.apiKey}`,
            Accept: accept === "json" ? "application/json" : "application/pdf",
            ...(init.body ? { "Content-Type": "application/json" } : {}),
            ...(init.headers as Record<string, string> | undefined),
          },
          cache: "no-store",
          signal: operation.signal,
        }), operation, sendMayBeAccepted);
      } catch (cause) {
        if (cause instanceof ESignError && cause.deliveryUncertain) throw cause;
        if (sendMayBeAccepted) {
          throw new ESignError(
            "send_failed",
            `PandaDoc send to ${path} had no definitive response: ${
              cause instanceof Error ? cause.message : "network error"
            }`,
            undefined,
            true,
          );
        }
        lastError = new ESignError(
          "send_failed",
          `PandaDoc request to ${path} failed: ${
            cause instanceof Error ? cause.message : "network error"
          }`,
        );
        if (attempt === MAX_TRANSPORT_ATTEMPTS - 1) break;
        await this.pause(this.backoffMs(attempt, null), operation);
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

      if (sendMayBeAccepted && response.status !== 429) {
        throw new ESignError(lastError.code, lastError.message, response.status, true);
      }

      if (attempt === MAX_TRANSPORT_ATTEMPTS - 1) break;
      await this.pause(this.backoffMs(attempt, response), operation);
    }

    throw lastError ?? new ESignError("send_failed", `PandaDoc request to ${path} failed`);
  }

  private async failure(
    response: Response,
    code: ESignError["code"],
    what: string,
    operation?: PandaDocOperation,
  ): Promise<ESignError> {
    let detail: string | null = null;
    try {
      const payload = operation
        ? await this.withinOperation(response.json(), operation)
        : await response.json();
      detail = readDetail(payload);
    } catch {
      detail = null;
    }
    return new ESignError(
      code,
      `${what} failed (${response.status})${detail ? `: ${detail}` : ""}`,
      response.status,
    );
  }

  async createDocument(
    body: CreateDocumentBody,
    operation: PandaDocOperation,
  ): Promise<PandaDocDocument> {
    const response = await this.request("/documents", {
      method: "POST",
      body: JSON.stringify(body),
    }, "json", operation);

    if (!response.ok) {
      throw await this.failure(response, "creation_failed", "PandaDoc document creation", operation);
    }

    return await this.readJson(response, operation) as PandaDocDocument;
  }

  /** `null` on 404 — the documented answer while creation is still in flight. */
  async getDocument(
    documentId: string,
    operation: PandaDocOperation,
  ): Promise<PandaDocDocument | null> {
    const response = await this.request(
      `/documents/${documentId}`,
      { method: "GET" },
      "json",
      operation,
    );

    if (response.status === 404) return null;
    if (!response.ok) {
      throw await this.failure(response, "creation_failed", "PandaDoc document status", operation);
    }

    return await this.readJson(response, operation) as PandaDocDocument;
  }

  /**
   * Creation is asynchronous: the document is unusable — 404 on read, 409 on
   * send — until it reaches `document.draft`.
   */
  async waitForDraft(
    documentId: string,
    operation: PandaDocOperation,
  ): Promise<PandaDocDocument> {
    for (let attempt = 0; attempt < this.pollMaxAttempts; attempt += 1) {
      const document = await this.getDocument(documentId, operation);

      if (document?.status === "document.draft") return document;

      if (document && document.status !== "document.uploaded") {
        throw new ESignError(
          "creation_failed",
          `PandaDoc document ${documentId} reached ${document.status} instead of document.draft`,
        );
      }

      await this.pause(this.pollIntervalMs, operation);
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
    operation: PandaDocOperation,
  ): Promise<PandaDocDocument> {
    for (let attempt = 0; attempt < this.pollMaxAttempts; attempt += 1) {
      const response = await this.request(`/documents/${documentId}/send`, {
        method: "POST",
        body: JSON.stringify(body),
      }, "json", operation, true);

      if (response.ok) {
        return await this.readJson(response, operation, true) as PandaDocDocument;
      }

      if (response.status !== 409) {
        throw await this.failure(response, "send_failed", "PandaDoc send", operation);
      }

      await this.pause(this.pollIntervalMs, operation);
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
      { signal: new AbortController().signal, deadlineAt: Number.POSITIVE_INFINITY },
    );

    if (!response.ok) {
      throw await this.failure(response, "download_failed", "PandaDoc protected download");
    }

    return new Uint8Array(await response.arrayBuffer());
  }
}
