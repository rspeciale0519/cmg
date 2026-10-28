// @vitest-environment node
import { spawnSync } from "node:child_process";
import { randomBytes, randomUUID } from "node:crypto";
import { afterAll, describe, expect, it, vi } from "vitest";
import type { Database } from "@/types/database-app";

const injected = vi.hoisted(() => ({ client: null as unknown }));

// Supply the request's user client and catch framework navigation. The action,
// mode guard, Auth, RLS, admin client, and audit writer retain their real behavior.
vi.mock("server-only", () => ({}));
vi.mock("next/navigation", () => ({
  redirect: (path: string) => { throw new Error(`redirect:${path}`); },
  notFound: () => { throw new Error("notFound"); },
}));
vi.mock("@/lib/supabase/server", () => ({
  createClient: async () => {
    if (!injected.client) throw new Error("The disposable caller is missing.");
    return injected.client;
  },
}));

const STACK = "CMGPA_private_upload_disposable";
const ORIGIN = "http://127.0.0.1:15521";
const enabled = process.env.CMG_AUTH_SIGNOUT_TEST === "1";
const describeLocal = enabled ? describe : describe.skip;
const originalFetch = globalThis.fetch;
const retained: Record<string, unknown> = {};
const logoutRequests: Array<{ method: string; scope: string | null; status: number }> = [];

function targetGuard() {
  if (!enabled || process.env.CMG_TEST_STACK !== STACK) {
    throw new Error("Explicit signout opt-in and the disposable stack are required.");
  }
  let endpoint: URL;
  try {
    endpoint = new URL(process.env.NEXT_PUBLIC_SUPABASE_URL ?? "about:blank");
  } catch {
    throw new Error("The exact disposable API URL is required.");
  }
  if (endpoint.origin !== ORIGIN || endpoint.pathname !== "/" || endpoint.username || endpoint.password ||
      endpoint.search || endpoint.hash) throw new Error("The exact disposable API URL is required.");
  if (!process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || !process.env.SUPABASE_SECRET_KEY) {
    throw new Error("Disposable local keys must be supplied without loading an environment file.");
  }

  const networkIds: string[] = [];
  for (const [service, internalPort, hostPort] of [["db", "5432/tcp", "15522"], ["kong", "8000/tcp", "15521"]]) {
    const name = `supabase_${service}_${STACK}`;
    // Selected Docker fields contain identity only. Never inspect container Env.
    const format = '{{json .Name}}|{{json .Config.Labels}}|{{json .NetworkSettings.Ports}}|{{json .NetworkSettings.Networks}}|{{json .State.Status}}';
    const result = spawnSync("docker", ["inspect", "--format", format, name], {
      encoding: "utf8", timeout: 10_000, windowsHide: true,
    });
    if (result.status !== 0) throw new Error("Disposable Docker identity could not be checked.");
    const [actualName, labels, ports, networks, state] = result.stdout.trim().split("|")
      .map((value) => JSON.parse(value));
    const bindings = ports[internalPort] as Array<{ HostPort: string }> | undefined;
    const network = networks[`supabase_network_${STACK}`] as { NetworkID?: string } | undefined;
    if (actualName !== `/${name}` || labels["com.supabase.cli.project"] !== STACK ||
        labels["com.docker.compose.project"] !== STACK || state !== "running" ||
        !bindings?.length || bindings.some(({ HostPort }) => HostPort !== hostPort) || !network?.NetworkID) {
      throw new Error("Disposable Docker identity does not match the approved stack.");
    }
    networkIds.push(network.NetworkID);
  }
  if (networkIds[0] !== networkIds[1]) throw new Error("Disposable API and database networks do not match.");
}

const localFetch: typeof fetch = async (input, init) => {
  const url = new URL(typeof input === "string" ? input : input instanceof URL ? input.href : input.url);
  if (url.origin !== ORIGIN || url.username || url.password) {
    throw new Error("A non-disposable request was refused.");
  }
  const method = (init?.method ?? (input instanceof Request ? input.method : "GET")).toUpperCase();
  if (method === "DELETE") throw new Error("Fixture deletion is not authorized.");
  const signal = init?.signal ?? (input instanceof Request ? input.signal : undefined);
  const response = await originalFetch(input, {
    ...init, redirect: "error",
    signal: signal ? AbortSignal.any([signal, AbortSignal.timeout(20_000)]) : AbortSignal.timeout(20_000),
  });
  if (url.pathname === "/auth/v1/logout") {
    // Observe the real response without storing headers, tokens, or request bodies.
    logoutRequests.push({ method, scope: url.searchParams.get("scope"), status: response.status });
  }
  return response;
};

function check(error: unknown, operation: string) {
  // SDK errors can contain capabilities. Report the failed operation only.
  if (error) throw new Error(`Disposable signout check failed: ${operation}.`);
}

afterAll(() => {
  injected.client = null;
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
  if (Object.keys(retained).length) {
    // Retain synthetic fixtures. Only non-secret evidence leaves process memory.
    console.info("[auth-signout] retained disposable fixture", JSON.stringify(retained));
  }
});

describeLocal("ordinary signout against disposable Auth and Postgres", () => {
  it("signs out globally, clears the caller, refuses the second refresh, and records one audit", async () => {
    targetGuard();
    vi.stubGlobal("fetch", localFetch);
    vi.stubEnv("SITE_MODE", "platform");
    const [{ createClient }, { signOut }] = await Promise.all([
      import("@supabase/supabase-js"), import("./auth"),
    ]);
    const options = { auth: { persistSession: false, autoRefreshToken: false }, global: { fetch: localFetch } };
    const admin = createClient<Database>(ORIGIN, process.env.SUPABASE_SECRET_KEY!, options);
    const caller = createClient<Database>(ORIGIN, process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!, options);
    const other = createClient<Database>(ORIGIN, process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!, options);

    const tag = randomUUID();
    const email = `auth-signout-${tag}@example.invalid`;
    const password = `Aa7!${randomBytes(24).toString("hex")}`;
    retained.stack = STACK;
    retained.fixtureTag = tag;
    const created = await admin.auth.admin.createUser({ email, password, email_confirm: true });
    check(created.error, "synthetic customer creation");
    if (!created.data.user) throw new Error("Synthetic customer was not created.");
    const userId = created.data.user.id;
    retained.userId = userId;

    const callerLogin = await caller.auth.signInWithPassword({ email, password });
    const otherLogin = await other.auth.signInWithPassword({ email, password });
    check(callerLogin.error, "caller sign-in");
    check(otherLogin.error, "second sign-in");
    expect(callerLogin.data.user?.id).toBe(userId);
    expect(otherLogin.data.user?.id).toBe(userId);
    const callerRefresh = callerLogin.data.session?.refresh_token;
    const otherRefresh = otherLogin.data.session?.refresh_token;
    if (!callerRefresh || !otherRefresh) throw new Error("Two disposable sessions are required.");
    // Boolean assertions prevent token disclosure if session creation regresses.
    expect(callerRefresh !== otherRefresh).toBe(true);
    const profile = await caller.from("profiles").select("id,role,is_active").eq("id", userId).single();
    check(profile.error, "caller profile under RLS");
    expect(profile.data).toEqual({ id: userId, role: "customer", is_active: true });
    injected.client = caller;

    await expect(signOut()).rejects.toThrow("redirect:/login");
    expect(logoutRequests).toEqual([{ method: "POST", scope: "global", status: 204 }]);
    const currentSession = await caller.auth.getSession();
    check(currentSession.error, "caller session after signout");
    expect(currentSession.data.session === null).toBe(true);

    // Global signout revokes refresh tokens. Existing access JWTs can remain
    // valid until expiry, so immediate JWT invalidation is not asserted here.
    const refreshed = await other.auth.refreshSession({ refresh_token: otherRefresh });
    expect(refreshed.error?.status).toBe(400);
    expect(refreshed.error?.code).toBe("refresh_token_not_found");
    expect(refreshed.data.session === null).toBe(true);

    const audit = await admin.from("audit_log").select("id,actor_id,action,entity,entity_id")
      .eq("actor_id", userId).eq("action", "auth.sign_out");
    check(audit.error, "persisted signout audit");
    expect(audit.data).toHaveLength(1);
    expect(audit.data?.[0]).toMatchObject({
      actor_id: userId, action: "auth.sign_out", entity: "auth", entity_id: userId,
    });
    retained.auditId = audit.data![0].id;
    retained.logoutRequest = logoutRequests[0];
    retained.redirect = "/login";
    retained.callerSessionCleared = currentSession.data.session === null;
    retained.secondRefreshErrorCode = refreshed.error?.code;
    retained.auditCount = audit.data?.length;
  }, 60_000);
});
