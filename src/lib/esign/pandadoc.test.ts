// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

const { PandaDocClient, PANDADOC_DISPATCH_TIMEOUT_MS } = await import("./pandadoc-client");
const { ESIGN_DISPATCH_LEASE_SECONDS } = await import("./dispatch-ledger");
const { PandaDocProvider } = await import("./pandadoc");
const { ESignError } = await import("./types");
const { sendLorRequestFixture } = await import("./fixtures");

type Call = { url: string; init: RequestInit };

const json = (status: number, body: unknown, headers: Record<string, string> = {}) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json", ...headers },
  });

const slept: number[] = [];

function providerFrom(
  responder: (call: Call, index: number) => Response | Promise<Response>,
  operationTimeoutMs?: number,
) {
  const calls: Call[] = [];
  const client = new PandaDocClient({
    apiKey: "sandbox-key",
    baseUrl: "https://api.pandadoc.test/public/v1",
    pollIntervalMs: 5,
    pollMaxAttempts: 6,
    fetchImpl: (url, init) => {
      const call = { url, init: init ?? {} };
      calls.push(call);
      return Promise.resolve(responder(call, calls.length - 1));
    },
    sleep: (ms) => {
      slept.push(ms);
      return Promise.resolve();
    },
    operationTimeoutMs,
  });

  return {
    calls,
    provider: new PandaDocProvider({
      client,
      templateUuid: "two-signer-template",
      templateUuidSingle: "one-signer-template",
    }),
  };
}

const isCreate = (call: Call) => call.url.endsWith("/documents") && call.init.method === "POST";
const isSend = (call: Call) => call.url.endsWith("/send");
const isStatus = (call: Call) => call.init.method === "GET";

beforeEach(() => {
  slept.length = 0;
});

describe("PandaDocProvider.dispatchLor", () => {
  it("creates from the template with roles, tokens and metadata.claim_id", async () => {
    const { provider, calls } = providerFrom((call) => {
      if (isCreate(call)) return json(201, { id: "doc-1", status: "document.uploaded" });
      if (isStatus(call)) return json(200, { id: "doc-1", status: "document.draft" });
      return json(200, { id: "doc-1", status: "document.sent" });
    });

    const request = sendLorRequestFixture();
    const dispatch = await provider.dispatchLor(request);

    expect(dispatch).toEqual({
      providerDocumentId: "doc-1",
      esignStatus: "document.sent",
      deliveredByProvider: true,
    });

    const create = JSON.parse(String(calls[0].init.body));
    expect(create.template_uuid).toBe("two-signer-template");
    expect(create.metadata).toEqual({
      claim_id: request.claimId,
      dispatch_attempt_token: request.dispatchAttemptToken,
    });
    expect(create.recipients.map((r: { role: string }) => r.role)).toEqual([
      "Homeowner1",
      "Homeowner2",
    ]);
    expect(create.tokens).toContainEqual({ name: "Claim.Ref", value: request.claimRef });
    expect(
      (calls[0].init.headers as Record<string, string>).Authorization,
    ).toBe("API-Key sandbox-key");
  });

  it("prefers the single-signer template for a one-claimant policy", async () => {
    const { provider, calls } = providerFrom((call) => {
      if (isCreate(call)) return json(201, { id: "doc-1", status: "document.uploaded" });
      if (isStatus(call)) return json(200, { id: "doc-1", status: "document.draft" });
      return json(200, { id: "doc-1", status: "document.sent" });
    });

    const request = sendLorRequestFixture();
    await provider.dispatchLor({ ...request, signers: [request.signers[0]] });

    expect(JSON.parse(String(calls[0].init.body)).template_uuid).toBe("one-signer-template");
  });

  it("polls until the async creation reaches document.draft before sending", async () => {
    let statusCalls = 0;
    const { provider, calls } = providerFrom((call) => {
      if (isCreate(call)) return json(201, { id: "doc-1", status: "document.uploaded" });
      if (isStatus(call)) {
        statusCalls += 1;
        /* 404 is what PandaDoc answers while creation is still in flight. */
        if (statusCalls === 1) return json(404, { detail: "Not found" });
        if (statusCalls === 2) return json(200, { id: "doc-1", status: "document.uploaded" });
        return json(200, { id: "doc-1", status: "document.draft" });
      }
      return json(200, { id: "doc-1", status: "document.sent" });
    });

    await provider.dispatchLor(sendLorRequestFixture());

    expect(statusCalls).toBe(3);
    expect(calls.filter(isSend)).toHaveLength(1);
    /* Send happens only after the last poll. */
    expect(calls.findIndex(isSend)).toBeGreaterThan(calls.findLastIndex(isStatus));
  });

  it("gives up with draft_timeout rather than sending into a 409 forever", async () => {
    const { provider } = providerFrom((call) => {
      if (isCreate(call)) return json(201, { id: "doc-1", status: "document.uploaded" });
      return json(200, { id: "doc-1", status: "document.uploaded" });
    });

    await expect(provider.dispatchLor(sendLorRequestFixture())).rejects.toMatchObject({
      code: "draft_timeout",
    });
  });

  it("retries a 409 on send and succeeds on the next attempt", async () => {
    let sendCalls = 0;
    const { provider } = providerFrom((call) => {
      if (isCreate(call)) return json(201, { id: "doc-1", status: "document.uploaded" });
      if (isStatus(call)) return json(200, { id: "doc-1", status: "document.draft" });
      sendCalls += 1;
      if (sendCalls === 1) return json(409, { detail: "Document is not in draft" });
      return json(200, { id: "doc-1", status: "document.sent" });
    });

    const dispatch = await provider.dispatchLor(sendLorRequestFixture());

    expect(sendCalls).toBe(2);
    expect(dispatch.esignStatus).toBe("document.sent");
  });

  it("backs off on a 429 for the interval PandaDoc asks for, then succeeds", async () => {
    let createCalls = 0;
    const { provider } = providerFrom((call) => {
      if (isCreate(call)) {
        createCalls += 1;
        if (createCalls === 1) {
          return json(429, { detail: "Request was throttled" }, { "retry-after": "3" });
        }
        return json(201, { id: "doc-1", status: "document.uploaded" });
      }
      if (isStatus(call)) return json(200, { id: "doc-1", status: "document.draft" });
      return json(200, { id: "doc-1", status: "document.sent" });
    });

    const dispatch = await provider.dispatchLor(sendLorRequestFixture());

    expect(createCalls).toBe(2);
    expect(dispatch.providerDocumentId).toBe("doc-1");
    expect(slept).toContain(3000);
  });

  it("aborts the whole dispatch before its lease and cannot send after timeout", async () => {
    expect(PANDADOC_DISPATCH_TIMEOUT_MS).toBeLessThan(
      ESIGN_DISPATCH_LEASE_SECONDS * 1000,
    );
    vi.useFakeTimers();
    try {
      let releaseStatus: ((response: Response) => void) | undefined;
      const statusResponse = new Promise<Response>((resolve) => {
        releaseStatus = resolve;
      });
      const { provider, calls } = providerFrom((call) => {
        if (isCreate(call)) return json(201, { id: "doc-timeout", status: "document.uploaded" });
        if (isStatus(call)) return statusResponse;
        return json(200, { id: "doc-timeout", status: "document.sent" });
      }, 90);

      const dispatch = expect(
        provider.dispatchLor(sendLorRequestFixture()),
      ).rejects.toMatchObject({
        code: "send_failed",
        deliveryUncertain: false,
      });
      await vi.advanceTimersByTimeAsync(91);
      await dispatch;

      releaseStatus?.(json(200, { id: "doc-timeout", status: "document.draft" }));
      await vi.runAllTimersAsync();
      expect(calls.filter(isSend)).toHaveLength(0);
    } finally {
      vi.useRealTimers();
    }
  });

  it("treats a send with no response as uncertain instead of retrying it", async () => {
    let sendCalls = 0;
    const { provider } = providerFrom((call) => {
      if (isCreate(call)) return json(201, { id: "doc-ambiguous", status: "document.uploaded" });
      if (isStatus(call)) return json(200, { id: "doc-ambiguous", status: "document.draft" });
      sendCalls += 1;
      return Promise.reject(new Error("connection reset after request upload"));
    });

    await expect(provider.dispatchLor(sendLorRequestFixture())).rejects.toMatchObject({
      code: "send_failed",
      deliveryUncertain: true,
    });
    expect(sendCalls).toBe(1);
  });

  it("treats a stalled 2xx send body as uncertain and never sends twice", async () => {
    vi.useFakeTimers();
    try {
      let sendCalls = 0;
      const stalled = new ReadableStream<Uint8Array>({ start: () => undefined });
      const { provider } = providerFrom((call) => {
        if (isCreate(call)) return json(201, { id: "doc-stalled", status: "document.uploaded" });
        if (isStatus(call)) return json(200, { id: "doc-stalled", status: "document.draft" });
        sendCalls += 1;
        return new Response(stalled, {
          status: 200,
          headers: { "content-type": "application/json" },
        });
      }, 90);

      const outcome = expect(
        provider.dispatchLor(sendLorRequestFixture()),
      ).rejects.toMatchObject({ deliveryUncertain: true });
      await vi.advanceTimersByTimeAsync(91);
      await outcome;
      expect(sendCalls).toBe(1);
    } finally {
      vi.useRealTimers();
    }
  });

  it("treats an invalid 2xx send body as uncertain and never retries send", async () => {
    let sendCalls = 0;
    const { provider } = providerFrom((call) => {
      if (isCreate(call)) return json(201, { id: "doc-invalid", status: "document.uploaded" });
      if (isStatus(call)) return json(200, { id: "doc-invalid", status: "document.draft" });
      sendCalls += 1;
      return new Response("{", {
        status: 200,
        headers: { "content-type": "application/json" },
      });
    });

    await expect(provider.dispatchLor(sendLorRequestFixture())).rejects.toMatchObject({
      deliveryUncertain: true,
    });
    expect(sendCalls).toBe(1);
  });

  it("does not call send when beforeSend consumes the remaining deadline", async () => {
    vi.useFakeTimers();
    try {
      const { provider, calls } = providerFrom((call) => {
        if (isCreate(call)) return json(201, { id: "doc-before-send", status: "document.uploaded" });
        if (isStatus(call)) return json(200, { id: "doc-before-send", status: "document.draft" });
        return json(200, { id: "doc-before-send", status: "document.sent" });
      }, 90);
      const request = sendLorRequestFixture();
      request.beforeSend = async () => {
        await vi.advanceTimersByTimeAsync(91);
      };

      await expect(provider.dispatchLor(request)).rejects.toMatchObject({
        deliveryUncertain: false,
      });
      expect(calls.filter(isSend)).toHaveLength(0);
    } finally {
      vi.useRealTimers();
    }
  });

  it("surfaces a creation failure with the validation detail PandaDoc returned", async () => {
    const { provider } = providerFrom(() =>
      json(400, { detail: "Role for form field with name='userName' is not provided in payload" }),
    );

    await expect(provider.dispatchLor(sendLorRequestFixture())).rejects.toBeInstanceOf(
      ESignError,
    );
    await expect(provider.dispatchLor(sendLorRequestFixture())).rejects.toMatchObject({
      code: "creation_failed",
      message: expect.stringContaining("Role for form field"),
    });
  });

  it("refuses to build a letter with no configured template", async () => {
    const { PandaDocClient: Client } = await import("./pandadoc-client");
    const provider = new PandaDocProvider({
      client: new Client({
        apiKey: "k",
        baseUrl: "https://api.pandadoc.test/public/v1",
        pollIntervalMs: 1,
        pollMaxAttempts: 1,
        fetchImpl: () => Promise.reject(new Error("should not be called")),
      }),
      templateUuid: null,
      templateUuidSingle: null,
    });

    await expect(provider.dispatchLor(sendLorRequestFixture())).rejects.toMatchObject({
      code: "not_configured",
    });
  });

  it("downloads the sealed copy from /download-protected", async () => {
    const pdf = new Uint8Array([0x25, 0x50, 0x44, 0x46]);
    const calls: string[] = [];
    const client = new PandaDocClient({
      apiKey: "sandbox-key",
      baseUrl: "https://api.pandadoc.test/public/v1",
      pollIntervalMs: 1,
      pollMaxAttempts: 1,
      fetchImpl: (url) => {
        calls.push(url);
        return Promise.resolve(new Response(pdf, { status: 200 }));
      },
    });
    const provider = new PandaDocProvider({
      client,
      templateUuid: "t",
      templateUuidSingle: null,
    });

    await expect(provider.downloadSignedPdf("doc-1")).resolves.toEqual(pdf);
    expect(calls[0]).toBe(
      "https://api.pandadoc.test/public/v1/documents/doc-1/download-protected",
    );
  });
});
