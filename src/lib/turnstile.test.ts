import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { verifyTurnstile } from "./turnstile";

const okResponse = (body: unknown) =>
  ({ ok: true, json: async () => body }) as unknown as Response;

describe("verifyTurnstile", () => {
  beforeEach(() => {
    vi.stubEnv("TURNSTILE_SECRET_KEY", "1x0000000000000000000000000000000AA");
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it("passes when Cloudflare reports success", async () => {
    const fetchMock = vi.fn(async () => okResponse({ success: true }));
    vi.stubGlobal("fetch", fetchMock);

    await expect(verifyTurnstile("token")).resolves.toEqual({ ok: true });
    expect(fetchMock).toHaveBeenCalledOnce();
  });

  it("sends the secret, the token and the remote IP", async () => {
    const fetchMock = vi.fn(async () => okResponse({ success: true }));
    vi.stubGlobal("fetch", fetchMock);

    await verifyTurnstile("token", "203.0.113.9");

    const [url, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe("https://challenges.cloudflare.com/turnstile/v0/siteverify");
    const body = new URLSearchParams(init.body as string);
    expect(body.get("secret")).toBe("1x0000000000000000000000000000000AA");
    expect(body.get("response")).toBe("token");
    expect(body.get("remoteip")).toBe("203.0.113.9");
  });

  it("fails when Cloudflare rejects the token", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => okResponse({ success: false, "error-codes": ["invalid-input-response"] })),
    );

    await expect(verifyTurnstile("garbage")).resolves.toEqual({
      ok: false,
      reason: "rejected",
    });
  });

  it("fails closed on a network error without calling Cloudflare twice", async () => {
    const fetchMock = vi.fn(async () => {
      throw new Error("ECONNRESET");
    });
    vi.stubGlobal("fetch", fetchMock);

    await expect(verifyTurnstile("token")).resolves.toEqual({
      ok: false,
      reason: "unreachable",
    });
    expect(fetchMock).toHaveBeenCalledOnce();
  });

  it("fails closed on a non-200 response", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => ({ ok: false }) as unknown as Response));

    await expect(verifyTurnstile("token")).resolves.toEqual({
      ok: false,
      reason: "unreachable",
    });
  });

  it("fails closed on an unparseable response body", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(
        async () =>
          ({
            ok: true,
            json: async () => {
              throw new Error("not json");
            },
          }) as unknown as Response,
      ),
    );

    await expect(verifyTurnstile("token")).resolves.toEqual({
      ok: false,
      reason: "unreachable",
    });
  });

  it.each([
    ["a missing token", undefined],
    ["an empty token", ""],
    ["a whitespace token", "   "],
    ["a non-string token", 42],
  ])("fails closed on %s without contacting Cloudflare", async (_label, token) => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    await expect(verifyTurnstile(token)).resolves.toEqual({
      ok: false,
      reason: "missing-token",
    });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("fails closed when the secret is not configured", async () => {
    vi.stubEnv("TURNSTILE_SECRET_KEY", "");
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    await expect(verifyTurnstile("token")).resolves.toEqual({
      ok: false,
      reason: "missing-secret",
    });
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
