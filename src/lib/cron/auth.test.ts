import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { authorizeCronRequest } from "./auth";

const SECRET = "a-long-shared-secret-value";

function headers(authorization?: string): Headers {
  return new Headers(authorization ? { authorization } : {});
}

describe("authorizeCronRequest", () => {
  beforeEach(() => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    process.env.CRON_SECRET = SECRET;
  });

  afterEach(() => {
    vi.restoreAllMocks();
    delete process.env.CRON_SECRET;
  });

  it("admits the secret it holds, presented as a bearer token", () => {
    expect(authorizeCronRequest(headers(`Bearer ${SECRET}`))).toEqual({ ok: true });
  });

  it("accepts the scheme in any case, because clients vary", () => {
    expect(authorizeCronRequest(headers(`bearer ${SECRET}`)).ok).toBe(true);
    expect(authorizeCronRequest(headers(`BEARER ${SECRET}`)).ok).toBe(true);
  });

  it("refuses a request with no Authorization header", () => {
    expect(authorizeCronRequest(headers())).toMatchObject({ ok: false, status: 401 });
  });

  it("refuses the wrong secret", () => {
    expect(
      authorizeCronRequest(headers("Bearer not-the-secret")),
    ).toMatchObject({ ok: false, status: 401 });
  });

  it("refuses a secret that is merely a prefix of the real one", () => {
    expect(
      authorizeCronRequest(headers(`Bearer ${SECRET.slice(0, -1)}`)),
    ).toMatchObject({ ok: false, status: 401 });
  });

  it("refuses another scheme carrying the right value", () => {
    expect(authorizeCronRequest(headers(`Basic ${SECRET}`))).toMatchObject({
      ok: false,
      status: 401,
    });
  });

  it("refuses a bearer header with nothing after it", () => {
    expect(authorizeCronRequest(headers("Bearer"))).toMatchObject({ ok: false, status: 401 });
    expect(authorizeCronRequest(headers("Bearer   "))).toMatchObject({ ok: false, status: 401 });
  });

  /* The case that matters. A deployment that forgot the variable must refuse
     everything and say so — the alternative default turns one missing
     environment variable into an endpoint anyone can drive. */
  it("refuses every request, loudly, when no secret is configured", () => {
    delete process.env.CRON_SECRET;

    expect(authorizeCronRequest(headers(`Bearer ${SECRET}`))).toMatchObject({
      ok: false,
      status: 503,
    });
    expect(console.error).toHaveBeenCalled();
  });

  it("treats an empty or blank secret as no secret at all", () => {
    process.env.CRON_SECRET = "   ";
    expect(authorizeCronRequest(headers("Bearer    "))).toMatchObject({
      ok: false,
      status: 503,
    });
  });
});
