// @vitest-environment node
import { spawnSync } from "node:child_process";
import { createHmac, randomBytes, randomInt, randomUUID } from "node:crypto";
import { setTimeout as delay } from "node:timers/promises";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database-app";

const injected = vi.hoisted(() => ({ client: null as SupabaseClient<Database> | null }));
// Replace framework context only. Guards, Auth, rate limits, actions, and RLS
// remain real. This does not exercise Next.js action POSTs or browser cookies.
vi.mock("server-only", () => ({}));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("next/headers", () => ({ headers: async () => new Headers() }));
vi.mock("next/navigation", () => ({
  notFound: () => { throw new Error("framework:not-found"); },
  redirect: (path: string) => { throw new Error(`framework:redirect:${path}`); },
}));
vi.mock("@/lib/supabase/server", () => ({
  createClient: async () => {
    if (!injected.client) throw new Error("A synthetic caller is required.");
    return injected.client;
  },
}));

const STACK = "CMGPA_private_upload_disposable";
const ORIGIN = "http://127.0.0.1:15521";
const describeLocal = process.env.CMG_ACCESS_MATRIX_TEST === "1" ? describe : describe.skip;
const originalFetch = globalThis.fetch;
const retained: Record<string, unknown> = {};
const requests: Array<{ method: string; path: string }> = [];
let fixtureSetup = false;
let blockedRequests = 0;

function parsedUrl(value: string) {
  try {
    return new URL(value);
  } catch {
    throw new Error("The disposable request URL is invalid.");
  }
}

function targetGuard() {
  if (process.versions.node.split(".")[0] !== "22" || process.env.CMG_TEST_STACK !== STACK) {
    throw new Error("Node 22 and the exact disposable stack are required.");
  }
  const endpoint = parsedUrl(process.env.NEXT_PUBLIC_SUPABASE_URL ?? "about:blank");
  if (endpoint.origin !== ORIGIN || endpoint.pathname !== "/" || endpoint.username || endpoint.password ||
      endpoint.search || endpoint.hash) throw new Error("The exact disposable API URL is required.");
  if (!process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || !process.env.SUPABASE_SECRET_KEY) {
    throw new Error("Supply disposable local keys without loading an environment file.");
  }
  const networkIds: string[] = [];
  for (const [service, internalPort, hostPort] of [["db", "5432/tcp", "15522"], ["kong", "8000/tcp", "15521"]]) {
    const name = `supabase_${service}_${STACK}`;
    // Never inspect Env, which contains credentials.
    const format = '{{json .Name}}|{{json .Config.Labels}}|{{json .NetworkSettings.Ports}}|{{json .NetworkSettings.Networks}}|{{json .State.Status}}';
    const result = spawnSync("docker", ["inspect", "--format", format, name], {
      encoding: "utf8", timeout: 10_000, windowsHide: true,
    });
    if (result.status !== 0) throw new Error("Disposable Docker identity could not be checked.");
    const [actualName, labels, ports, networks, state] = result.stdout.trim().split("|").map((value) => JSON.parse(value));
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

const localFetch: typeof fetch = (input, init) => {
  const url = parsedUrl(typeof input === "string" ? input : input instanceof URL ? input.href : input.url);
  const method = (init?.method ?? (input instanceof Request ? input.method : "GET")).toUpperCase();
  const forbidden = url.origin !== ORIGIN || url.username || url.password || method === "DELETE" ||
    url.pathname.startsWith("/storage/") ||
    (url.pathname === "/rest/v1/notifications_outbox" && method !== "GET" && method !== "HEAD") ||
    (url.pathname.startsWith("/rest/v1/rpc/") &&
      !["/rest/v1/rpc/check_rate_limit", "/rest/v1/rpc/reassign_claim"].includes(url.pathname)) ||
    (url.pathname.startsWith("/auth/v1/admin/") && !fixtureSetup);
  if (forbidden) {
    blockedRequests += 1;
    throw new Error("A request outside the disposable access test was refused.");
  }
  requests.push({ method, path: url.pathname });
  const signal = init?.signal ?? (input instanceof Request ? input.signal : undefined);
  return originalFetch(input, {
    ...init, redirect: "error",
    signal: signal ? AbortSignal.any([signal, AbortSignal.timeout(20_000)]) : AbortSignal.timeout(20_000),
  });
};

function check(error: unknown, operation: string) {
  // Never report SDK errors, request URLs, passwords, keys, or tokens.
  if (error) throw new Error(`Disposable access check failed: ${operation}.`);
}

function form(values: Record<string, string>) {
  const data = new FormData();
  for (const [key, value] of Object.entries(values)) data.set(key, value);
  return data;
}

function totp(secret: string) {
  const alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";
  const bits = [...secret.replace(/=+$/, "").toUpperCase()]
    .map((character) => alphabet.indexOf(character).toString(2).padStart(5, "0")).join("");
  const key = Buffer.from(bits.match(/.{8}/g)?.map((octet) => Number.parseInt(octet, 2)) ?? []);
  const counter = Buffer.alloc(8);
  counter.writeBigUInt64BE(BigInt(Math.floor(Date.now() / 30_000)));
  const digest = createHmac("sha1", key).update(counter).digest();
  return String((digest.readUInt32BE(digest[digest.length - 1] & 0x0f) & 0x7fffffff) % 1_000_000).padStart(6, "0");
}

type Caller = { id: string; email: string; client: SupabaseClient<Database> };
const idle = { status: "idle" as const, message: "" };
let admin: SupabaseClient<Database>;
let createClient: typeof import("@supabase/supabase-js").createClient;
let guards: typeof import("@/lib/authz");
let claims: typeof import("./claims");
let partners: typeof import("./partners");
let portal: typeof import("./portal");
let documents: typeof import("./portal-documents");
let adjuster: Caller;
let homeowner: Caller;
let vendor: Caller;
const ids = { company: randomUUID(), ownClaim: randomUUID(), foreignClaim: randomUUID(),
  ownConsent: randomUUID(), foreignConsent: randomUUID(), internalDocument: randomUUID(), foreignDocument: randomUUID() };
const options = { auth: { persistSession: false, autoRefreshToken: false }, global: { fetch: localFetch } };

async function account(role: "adjuster" | "customer" | "partner", tag: string): Promise<Caller> {
  const email = `access-${tag}-${randomUUID()}@example.invalid`;
  const password = `Aa7!${randomBytes(24).toString("hex")}`;
  const created = await admin.auth.admin.createUser({ email, password, email_confirm: true });
  check(created.error, "synthetic account creation");
  if (!created.data.user) throw new Error("The synthetic account was not created.");
  const id = created.data.user.id;
  (retained.userIds as string[]).push(id);
  const profile = await admin.from("profiles").update({ role,
    partner_company_id: role === "partner" ? ids.company : null }).eq("id", id);
  check(profile.error, "synthetic role setup");
  const client = createClient<Database>(ORIGIN, process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!, options);
  const login = await client.auth.signInWithPassword({ email, password });
  check(login.error, "synthetic sign-in");
  expect(login.data.user?.id).toBe(id);
  return { id, email, client };
}

async function claim(id: string, assignedTo: string) {
  let claimRef = "";
  for (let attempt = 0; attempt < 5; attempt += 1) {
    const candidate = `CMG-2098-${randomInt(1000, 10000)}`;
    const found = await admin.from("claims").select("id").eq("claim_ref", candidate).maybeSingle();
    check(found.error, "synthetic claim reference lookup");
    if (!found.data) { claimRef = candidate; break; }
  }
  if (!claimRef) throw new Error("An unused synthetic claim reference was not found.");
  const result = await admin.from("claims").insert({ id, claim_ref: claimRef, status: "under_review",
    assigned_adjuster_id: assignedTo, partner_company_id: ids.company,
    property_street: "1 Disposable Access Way", property_city: "Orlando", property_state: "Florida",
    property_zip: "32801", carrier: "Fixture Carrier", policy_number: `ACCESS-${id}`,
    carrier_tenure: "three_plus_years", loss_date: "2026-07-01", cause: "hurricane",
    description: "Disposable direct-action access fixture" });
  check(result.error, "synthetic claim creation");
}

async function snapshot() {
  const results = await Promise.all([
    admin.from("claims").select("id,status,assigned_adjuster_id,updated_at").in("id", [ids.ownClaim, ids.foreignClaim]).order("id"),
    admin.from("partner_companies").select("id,status,updated_at").eq("id", ids.company),
    admin.from("documents").select("id,claim_id,storage_path,visibility,updated_at").in("id", [ids.internalDocument, ids.foreignDocument]).order("id"),
    admin.from("claim_events").select("id,claim_id,body").in("claim_id", [ids.ownClaim, ids.foreignClaim]).order("id"),
    admin.from("consents").select("*").in("id", [ids.ownConsent, ids.foreignConsent]).order("id"),
    admin.from("audit_log").select("id,action,entity_id,actor_id").in("entity_id", Object.values(ids)).order("id"),
  ]);
  results.forEach((result) => check(result.error, "fixture readback"));
  return results.map((result) => result.data);
}

async function asCaller(caller: Caller, role: "adjuster" | "customer" | "partner") {
  injected.client = caller.client;
  const session = await guards.getSession();
  expect(session).toMatchObject({ userId: caller.id, role });
}

afterAll(() => {
  injected.client = null;
  fixtureSetup = false;
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
  if (retained.stack) console.info("[access-matrix] retained disposable fixtures", JSON.stringify(retained));
});

describeLocal("direct actions against disposable Auth and user-scoped RLS", () => {
  beforeAll(async () => {
    targetGuard();
    vi.stubGlobal("fetch", localFetch);
    vi.stubEnv("SITE_MODE", "platform");
    vi.stubEnv("RESEND_API_KEY", "");
    ({ createClient } = await import("@supabase/supabase-js"));
    [guards, claims, partners, portal, documents] = await Promise.all([
      import("@/lib/authz"), import("./claims"), import("./partners"), import("./portal"), import("./portal-documents"),
    ]);
    admin = createClient<Database>(ORIGIN, process.env.SUPABASE_SECRET_KEY!, options);
    retained.stack = STACK;
    retained.ids = ids;
    retained.userIds = [];
    fixtureSetup = true;
    const company = await admin.from("partner_companies").insert({ id: ids.company, name: `Access fixture ${ids.company}`, status: "active" });
    check(company.error, "synthetic company creation");
    adjuster = await account("adjuster", "adjuster");
    const otherAdjuster = await account("adjuster", "other-adjuster");
    homeowner = await account("customer", "homeowner");
    const otherHomeowner = await account("customer", "other-homeowner");
    vendor = await account("partner", "vendor");
    const factor = await adjuster.client.auth.mfa.enroll({ factorType: "totp" });
    check(factor.error, "synthetic MFA enrollment");
    if (!factor.data?.totp.secret) throw new Error("The synthetic MFA secret is missing.");
    const remaining = 30_000 - Date.now() % 30_000;
    if (remaining < 3_000) await delay(remaining + 100);
    const verified = await adjuster.client.auth.mfa.challengeAndVerify({ factorId: factor.data.id, code: totp(factor.data.totp.secret) });
    check(verified.error, "synthetic MFA verification");
    await claim(ids.ownClaim, adjuster.id);
    await claim(ids.foreignClaim, otherAdjuster.id);
    const claimantRows = [
      { claim_id: ids.ownClaim, user_id: homeowner.id, email: homeowner.email, is_primary: true },
      { claim_id: ids.ownClaim, user_id: otherHomeowner.id, email: otherHomeowner.email, is_primary: false },
      { claim_id: ids.foreignClaim, user_id: otherHomeowner.id, email: otherHomeowner.email, is_primary: true },
    ].map((row) => ({ ...row, first_name: "Access", last_name: "Fixture", initials: "AF" }));
    check((await admin.from("claimants").insert(claimantRows)).error, "synthetic claimant creation");
    check((await admin.from("consents").insert([
      { id: ids.ownConsent, claim_id: ids.ownClaim, email: homeowner.email, kind: "email", consent_text: "Synthetic access consent" },
      { id: ids.foreignConsent, claim_id: ids.ownClaim, email: otherHomeowner.email, kind: "email", consent_text: "Synthetic other-party consent" },
    ])).error, "synthetic consent creation");
    check((await admin.from("documents").insert([
      { id: ids.internalDocument, claim_id: ids.ownClaim, visibility: "internal" as const },
      { id: ids.foreignDocument, claim_id: ids.foreignClaim, visibility: "customer" as const },
    ].map((row) => ({ ...row, storage_path: `claims/${row.claim_id}/${row.id}.pdf`, original_name: "access-fixture.pdf",
      mime: "application/pdf", size_bytes: 4, kind: "other" as const })))).error, "synthetic document metadata creation");
    fixtureSetup = false;
  }, 120_000);

  it("refuses an adjuster's foreign reassignment with the same answer as a missing claim", async () => {
    await asCaller(adjuster, "adjuster");
    expect(await guards.requireStaff()).toMatchObject({ userId: adjuster.id, aal: "aal2" });
    expect((await guards.requireClaimAccess(ids.ownClaim)).claim.id).toBe(ids.ownClaim);
    const before = await snapshot();
    const foreign = await claims.reassignClaimAdjuster(idle, form({ claimId: ids.foreignClaim, adjusterId: adjuster.id }));
    const missing = await claims.reassignClaimAdjuster(idle, form({ claimId: randomUUID(), adjusterId: adjuster.id }));
    expect(foreign.status).toBe("error");
    expect(foreign.message).toContain("not available to you");
    expect(foreign).toEqual(missing);
    expect(await snapshot()).toEqual(before);
  });

  it("refuses a non-owner's company status change before any mutation", async () => {
    await asCaller(adjuster, "adjuster");
    const before = await snapshot();
    await expect(partners.setPartnerCompanyStatus(idle, form({ companyId: ids.company, status: "inactive" })))
      .rejects.toThrow("framework:not-found");
    expect(await snapshot()).toEqual(before);
  });

  it("refuses a homeowner's foreign question without creating an event or notification", async () => {
    await asCaller(homeowner, "customer");
    expect((await guards.requireClaimAccess(ids.ownClaim)).claim.id).toBe(ids.ownClaim);
    const before = await snapshot();
    const body = "Synthetic foreign question must not be saved.";
    const foreign = await portal.askQuestion(idle, form({ claimId: ids.foreignClaim, body }));
    const missing = await portal.askQuestion(idle, form({ claimId: randomUUID(), body }));
    expect(foreign.status).toBe("error");
    expect(foreign.message).toContain("find that claim");
    expect(foreign).toEqual(missing);
    expect(await snapshot()).toEqual(before);
    const counter = await admin.from("rate_limits").select("count").eq("key", `portal-question:user:${homeowner.id}`).single();
    check(counter.error, "question rate counter");
    expect(counter.data?.count).toBe(2);
    retained.questionRateCount = counter.data?.count;
  });

  it("refuses foreign and internal downloads identically to a missing document", async () => {
    await asCaller(homeowner, "customer");
    const before = await snapshot();
    const answers = [];
    for (const documentId of [ids.foreignDocument, ids.internalDocument, randomUUID()]) {
      answers.push(await documents.issuePortalDownload(idle, form({ documentId })));
    }
    expect(answers[0].status).toBe("error");
    expect(answers[0]).toEqual(answers[1]);
    expect(answers[1]).toEqual(answers[2]);
    expect(await snapshot()).toEqual(before);
    expect(requests.some(({ path }) => path.startsWith("/storage/"))).toBe(false);
  });

  it("refuses a vendor calling staff and homeowner actions", async () => {
    await asCaller(vendor, "partner");
    const before = await snapshot();
    const calls = [
      () => claims.reassignClaimAdjuster(idle, form({ claimId: ids.ownClaim, adjusterId: vendor.id })),
      () => partners.setPartnerCompanyStatus(idle, form({ companyId: ids.company, status: "inactive" })),
      () => portal.askQuestion(idle, form({ claimId: ids.ownClaim, body: "Synthetic vendor question must not be saved." })),
      () => documents.issuePortalDownload(idle, form({ documentId: ids.internalDocument })),
      () => portal.withdrawConsent(idle, form({ consentId: ids.ownConsent })),
    ];
    for (const call of calls) await expect(call()).rejects.toThrow("framework:not-found");
    expect(await snapshot()).toEqual(before);
  });

  it("withdraws only the caller's consent once and preserves the other claimant's evidence", async () => {
    await asCaller(homeowner, "customer");
    const before = await snapshot();
    const foreign = await portal.withdrawConsent(idle, form({ consentId: ids.foreignConsent }));
    const missing = await portal.withdrawConsent(idle, form({ consentId: randomUUID() }));
    expect(foreign.status).toBe("error");
    expect(foreign).toEqual(missing);
    expect(await snapshot()).toEqual(before);
    const ownBefore = await admin.from("consents").select("*").eq("id", ids.ownConsent).single();
    check(ownBefore.error, "original consent evidence");
    expect((await portal.withdrawConsent(idle, form({ consentId: ids.ownConsent }))).status).toBe("success");
    const ownAfter = await admin.from("consents").select("*").eq("id", ids.ownConsent).single();
    check(ownAfter.error, "withdrawn consent evidence");
    expect(ownAfter.data?.withdrawn_at).toEqual(expect.any(String));
    expect({ ...ownAfter.data, withdrawn_at: null }).toEqual(ownBefore.data);
    const audits = await admin.from("audit_log").select("id,actor_id,action").eq("entity_id", ids.ownConsent).eq("action", "consents.update");
    check(audits.error, "consent withdrawal audit");
    expect(audits.data).toHaveLength(1);
    expect(audits.data?.[0].actor_id).toBe(homeowner.id);
    retained.consentAuditId = audits.data?.[0].id;
    const after = await snapshot();
    expect(after.slice(0, 4)).toEqual(before.slice(0, 4));
    expect(after[4]?.find((row) => row.id === ids.foreignConsent))
      .toEqual(before[4]?.find((row) => row.id === ids.foreignConsent));
    expect((await portal.withdrawConsent(idle, form({ consentId: ids.ownConsent }))).status).toBe("error");
    expect(await snapshot()).toEqual(after);
    expect(blockedRequests).toBe(0);
    expect(requests.some(({ method, path }) => path === "/rest/v1/notifications_outbox" && method === "POST")).toBe(false);
  });
});
