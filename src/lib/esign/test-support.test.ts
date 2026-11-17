// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const stub = vi.hoisted(() => ({
  query: vi.fn<() => Promise<{error: unknown}>>(async () => ({ error: null })),
  createClient: vi.fn(),
}));

vi.mock("@supabase/supabase-js", () => ({ createClient: stub.createClient }));

const { localSupabaseAvailable, testAdminClient } = await import("./test-support");

beforeEach(() => {
  vi.clearAllMocks();
  vi.stubEnv("CMG_DATABASE_TEST_REQUIRED", "");
  vi.stubEnv("SUPABASE_SECRET_KEY", "test-only-key");
  stub.query.mockResolvedValue({ error: null });
  stub.createClient.mockReturnValue({
    from: () => ({ select: () => ({ limit: stub.query }) }),
  });
});

afterEach(() => vi.unstubAllEnvs());

describe("local database test target", () => {
  it.each([
    "http://127.0.0.1:15421",
    "http://localhost:15421/",
    "http://[::1]:15421",
  ])("allows the loopback endpoint %s", async (url) => {
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", url);

    expect(await localSupabaseAvailable()).toBe(true);
    expect(stub.createClient).toHaveBeenCalledWith(
      url,
      "test-only-key",
      expect.objectContaining({ auth: { persistSession: false, autoRefreshToken: false } }),
    );
    expect(stub.query).toHaveBeenCalledOnce();
  });

  it.each([
    "https://example.supabase.co",
    "http://192.0.2.1:15421",
    "http://localhost.example.test:15421",
    "http://localhost:15421/proxy",
    "http://localhost:15421/?target=remote",
    "http://localhost:15421/#remote",
    "http://user:password@localhost:15421",
    "ftp://localhost:15421",
    "invalid-url",
  ])("rejects %s before creating a client", async (url) => {
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", url);

    expect(testAdminClient).toThrow("database tests require a loopback Supabase URL");
    await expect(localSupabaseAvailable()).rejects.toThrow(
      "database tests require a loopback Supabase URL",
    );
    expect(stub.createClient).not.toHaveBeenCalled();
    expect(stub.query).not.toHaveBeenCalled();
  });

  it("reports an unavailable local stack without changing the target", async () => {
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "http://127.0.0.1:15421");
    stub.query.mockRejectedValueOnce(new Error("connection refused"));

    expect(await localSupabaseAvailable()).toBe(false);
    expect(stub.createClient).toHaveBeenCalledOnce();
  });
});

describe("explicit complete database verification", () => {
  it.each(["transport", "query"])("fails instead of skipping when the %s probe fails", async mode => {
    vi.stubEnv("CMG_DATABASE_TEST_REQUIRED", "1");
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "http://127.0.0.1:15421");
    if(mode === "transport")stub.query.mockRejectedValueOnce(new Error("private provider detail"));
    else stub.query.mockResolvedValueOnce({error:{message:"private provider detail"}});
    await expect(localSupabaseAvailable()).rejects.toThrow("Required local database verification is unavailable.");
  });
  it("fails before a client is created when required local credentials are missing", async () => {
    vi.stubEnv("CMG_DATABASE_TEST_REQUIRED", "1");
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", undefined);
    vi.stubEnv("SUPABASE_SECRET_KEY", undefined);
    await expect(localSupabaseAvailable()).rejects.toThrow("Required local database verification is unavailable.");
    expect(stub.createClient).not.toHaveBeenCalled();
  });
});
