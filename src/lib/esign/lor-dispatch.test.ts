// @vitest-environment node
import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

/* These suites make a dozen round trips to a Docker-hosted Postgres and its
   storage API. Under `npm test`, which runs 25 files in parallel, that can
   exceed the 5 s default on a loaded machine — a scheduling fact, not a defect
   in the code under test. */
vi.setConfig({ testTimeout: 30_000, hookTimeout: 30_000 });

const { ManualSignProvider } = await import("./manual");
const { PandaDocProvider } = await import("./pandadoc");
const { PandaDocClient } = await import("./pandadoc-client");
const { dispatchLorForClaim } = await import("./lor-dispatch");
const support = await import("./test-support");
type TestAdmin = Awaited<ReturnType<typeof support.testAdminClient>>;

/**
 * `dispatchLorForClaim()` end to end against the running local database, with only the
 * PandaDoc HTTP layer faked. The database work is real: the status machine,
 * the history row, the feed entry and the audit trigger all run.
 */
const available = await support.localSupabaseAvailable();
if (!available) {
  console.warn(
    "[esign] local Supabase is not reachable — database-backed LOR dispatch suite skipped",
  );
}

const describeDb = available ? describe : describe.skip;

type Call = { url: string; init: RequestInit };

const json = (status: number, body: unknown, headers: Record<string, string> = {}) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json", ...headers },
  });

const isCreate = (call: Call) => call.url.endsWith("/documents") && call.init.method === "POST";
const isStatus = (call: Call) => call.init.method === "GET";

function createData(call: Call): Record<string, unknown> {
  const body = new TextDecoder().decode(call.init.body as Uint8Array);
  const marker = "Content-Type: application/json\r\n\r\n";
  const start = body.indexOf(marker) + marker.length;
  const end = body.indexOf("\r\n--", start);
  return JSON.parse(body.slice(start, end)) as Record<string, unknown>;
}

function pandadoc(responder: (call: Call) => Response) {
  const calls: Call[] = [];
  const slept: number[] = [];

  const provider = new PandaDocProvider({
    client: new PandaDocClient({
      apiKey: "sandbox-key",
      baseUrl: "https://api.pandadoc.test/public/v1",
      pollIntervalMs: 5,
      pollMaxAttempts: 6,
      fetchImpl: (url, init) => {
        const call = { url, init: init ?? {} };
        calls.push(call);
        return Promise.resolve(responder(call));
      },
      sleep: (ms) => {
        slept.push(ms);
        return Promise.resolve();
      },
    }),
    loadPdf: () => Promise.resolve(new TextEncoder().encode("%PDF-test")),
  });

  return { provider, calls, slept };
}

/** Surfaces the failure code in the message when a "should succeed" call does not. */
function expectOk(result: Awaited<ReturnType<typeof dispatchLorForClaim>>) {
  if (!result.ok) throw new Error(`dispatchLorForClaim failed: ${result.code} — ${result.message}`);
  return result;
}

/* `claims.pandadoc_document_id` is UNIQUE, so a fixed literal here is a
   landmine: one stranded fixture from an earlier run makes the test fail
   forever for a reason that has nothing to do with the code. */
const docId = (label: string) => `${label}-${randomUUID()}`;

const happyPath = (documentId: string) => (call: Call) => {
  if (isCreate(call)) return json(201, { id: documentId, status: "document.uploaded" });
  if (isStatus(call)) return json(200, { id: documentId, status: "document.draft" });
  return json(200, { id: documentId, status: "document.sent" });
};

describeDb("dispatchLorForClaim against the local database", () => {
  let admin: TestAdmin;
  const created: Array<{ id: string; claimRef: string }> = [];

  const seed = async (status: "under_review" | "lor_sent" = "under_review") => {
    const claim = await support.seedClaim(admin, { status });
    created.push({ id: claim.id, claimRef: claim.claimRef });
    return claim;
  };

  beforeAll(async () => {
    /* No key, no accidental delivery: the outbox stays queued. */
    process.env.RESEND_API_KEY = "";
    admin = support.testAdminClient();
  });

  /* pgTAP runs against this same live database and asserts against the seed,
     so the suite has to leave nothing of its own behind. */
  afterAll(async () => {
    for (const claim of created) {
      await support.cleanupClaim(admin, claim.id, claim.claimRef);
    }
  });

  it("sends, persists the provider document, advances the claim and leaves a trail", async () => {
    const claim = await seed();
    const documentId = docId("lor");
    const { provider, calls } = pandadoc(happyPath(documentId));

    const result = expectOk(await dispatchLorForClaim({ claimId: claim.id }, { admin, provider }));

    expect(result).toMatchObject({
      ok: true,
      mode: "pandadoc",
      providerDocumentId: documentId,
      esignStatus: "document.sent",
      transitioned: true,
      deliveredByProvider: true,
      recipients: claim.claimantEmails,
    });

    const { data: row } = await admin
      .from("claims")
      .select("status, esign_status, pandadoc_document_id")
      .eq("id", claim.id)
      .single();

    expect(row).toEqual({
      status: "lor_sent",
      esign_status: "document.sent",
      pandadoc_document_id: documentId,
    });

    const create = createData(calls.find(isCreate)!);
    expect(create.metadata).toEqual({
      claim_id: claim.id,
      dispatch_attempt_token: expect.any(String),
    });
    expect(create.recipients).toEqual([
      expect.objectContaining({ email: claim.claimantEmails[0], role: "H1" }),
      expect.objectContaining({ email: claim.claimantEmails[1], role: "H2" }),
    ]);
    expect(create.fields).toMatchObject({
      carrier: { value: "Citizens", role: "H1" },
      lossdate: { value: "07/01/2026", role: "H1" },
      ph: { value: expect.stringContaining("Dana"), role: "H1" },
      email: { value: claim.claimantEmails[0], role: "H1" },
      ne: { value: "X", role: "H1" },
      em: { value: "", role: "H1" },
      su: { value: "", role: "H1" },
      fee: { value: "10%", role: "H1" },
      property: {
        value: expect.stringContaining("Orlando, Florida 32801"),
        role: "H1",
      },
    });

    const { data: history } = await admin
      .from("claim_status_history")
      .select("from_status, to_status")
      .eq("claim_id", claim.id);
    expect(history).toContainEqual({ from_status: "under_review", to_status: "lor_sent" });

    const { data: events } = await admin
      .from("claim_events")
      .select("type, visibility, body")
      .eq("claim_id", claim.id);
    expect(events).toContainEqual({
      type: "status",
      visibility: "shared",
      body: expect.stringContaining("Letter of Representation sent for signature"),
    });

    const { data: audit } = await admin
      .from("audit_log")
      .select("action, meta")
      .eq("entity_id", claim.id)
      .eq("action", "esign.lor_sent");
    expect(audit).toHaveLength(1);
    expect(audit?.[0].meta).toMatchObject({
      mode: "pandadoc",
      provider_document_id: documentId,
      transitioned: true,
    });
  });

  it("waits out the asynchronous creation before sending", async () => {
    const claim = await seed();
    const documentId = docId("poll");
    let statusCalls = 0;

    const { provider, calls } = pandadoc((call) => {
      if (isCreate(call)) return json(201, { id: documentId, status: "document.uploaded" });
      if (isStatus(call)) {
        statusCalls += 1;
        if (statusCalls === 1) return json(404, { detail: "Not found" });
        if (statusCalls === 2) return json(200, { id: documentId, status: "document.uploaded" });
        return json(200, { id: documentId, status: "document.draft" });
      }
      return json(200, { id: documentId, status: "document.sent" });
    });

    const result = await dispatchLorForClaim({ claimId: claim.id }, { admin, provider });

    expect(result.ok).toBe(true);
    expect(statusCalls).toBe(3);
    expect(calls.findIndex((call) => call.url.endsWith("/send"))).toBe(calls.length - 1);
  });

  it("retries a 409 from send and still records one clean send", async () => {
    const claim = await seed();
    const documentId = docId("conflict");
    let sendCalls = 0;

    const { provider } = pandadoc((call) => {
      if (isCreate(call)) return json(201, { id: documentId, status: "document.uploaded" });
      if (isStatus(call)) return json(200, { id: documentId, status: "document.draft" });
      sendCalls += 1;
      if (sendCalls === 1) return json(409, { detail: "Document is not in draft" });
      return json(200, { id: documentId, status: "document.sent" });
    });

    await expect(dispatchLorForClaim({ claimId: claim.id }, { admin, provider })).resolves.toMatchObject({
      ok: true,
      providerDocumentId: documentId,
    });
    expect(sendCalls).toBe(2);

    const { data: row } = await admin
      .from("claims")
      .select("status")
      .eq("id", claim.id)
      .single();
    expect(row?.status).toBe("lor_sent");
  });

  it("backs off for the interval a 429 asks for, then completes", async () => {
    const claim = await seed();
    const documentId = docId("throttled");
    let createCalls = 0;

    const { provider, slept } = pandadoc((call) => {
      if (isCreate(call)) {
        createCalls += 1;
        if (createCalls === 1) {
          return json(429, { detail: "Request was throttled" }, { "retry-after": "2" });
        }
        return json(201, { id: documentId, status: "document.uploaded" });
      }
      if (isStatus(call)) return json(200, { id: documentId, status: "document.draft" });
      return json(200, { id: documentId, status: "document.sent" });
    });

    await expect(dispatchLorForClaim({ claimId: claim.id }, { admin, provider })).resolves.toMatchObject({
      ok: true,
    });
    expect(createCalls).toBe(2);
    expect(slept).toContain(2000);
  });

  it("records a retryable creation failure without advancing the claim, and audits it", async () => {
    const claim = await seed();
    const { provider } = pandadoc(() =>
      json(400, { detail: "Role for form field with name='userName' is not provided in payload" }),
    );

    const result = await dispatchLorForClaim({ claimId: claim.id }, { admin, provider });

    expect(result).toMatchObject({ ok: false, code: "provider_error" });
    expect(result.ok ? "" : result.message).toContain("Role for form field");

    const { data: row } = await admin
      .from("claims")
      .select("status, esign_status, pandadoc_document_id")
      .eq("id", claim.id)
      .single();
    expect(row).toEqual({
      status: "under_review",
      esign_status: "document.creation_failed",
      pandadoc_document_id: null,
    });

    const { data: audit } = await admin
      .from("audit_log")
      .select("action")
      .eq("entity_id", claim.id)
      .eq("action", "esign.lor_send_failed");
    expect(audit).toHaveLength(1);
  });

  it("advances the claim in manual mode with no provider document", async () => {
    const claim = await seed();

    const result = await dispatchLorForClaim(
      { claimId: claim.id },
      { admin, provider: new ManualSignProvider() },
    );

    expect(result).toMatchObject({
      ok: true,
      mode: "manual",
      providerDocumentId: null,
      esignStatus: "manual_pending",
      deliveredByProvider: false,
    });

    const { data: row } = await admin
      .from("claims")
      .select("status, esign_status, pandadoc_document_id")
      .eq("id", claim.id)
      .single();
    expect(row).toEqual({
      status: "lor_sent",
      esign_status: "manual_pending",
      pandadoc_document_id: null,
    });

    const { data: events } = await admin
      .from("claim_events")
      .select("body")
      .eq("claim_id", claim.id);
    expect(
      events?.some((event: { body: string }) => event.body.includes("outside the system")),
    ).toBe(true);
  });

  it("re-sends from lor_sent without a second transition", async () => {
    const claim = await seed("lor_sent");
    const { error: prepareError } = await admin
      .from("claims")
      .update({ esign_status: "document.creation_failed" })
      .eq("id", claim.id);
    expect(prepareError).toBeNull();
    const { provider } = pandadoc(happyPath(docId("resend")));

    const result = expectOk(await dispatchLorForClaim({ claimId: claim.id }, { admin, provider }));

    expect(result).toMatchObject({ ok: true, transitioned: false });

    const { data: history } = await admin
      .from("claim_status_history")
      .select("to_status")
      .eq("claim_id", claim.id)
      .eq("to_status", "lor_sent");
    expect(history).toHaveLength(0);
  });

  it("keeps a successfully sent document locked when claim persistence fails", async () => {
    const claim = await seed();
    const documentId = docId("persist-failed-after-send");
    const first = pandadoc(happyPath(documentId));

    await expect(dispatchLorForClaim(
      { claimId: claim.id },
      {
        admin,
        provider: first.provider,
        beforePersist: () => Promise.reject(new Error("injected persistence outage")),
      },
    )).resolves.toMatchObject({ ok: false, code: "request_in_progress" });

    const { data: locked } = await admin
      .from("claims")
      .select("status, esign_status, pandadoc_document_id, esign_dispatch_token")
      .eq("id", claim.id)
      .single();
    expect(locked).toMatchObject({
      status: "under_review",
      esign_status: "document.sending",
      pandadoc_document_id: documentId,
      esign_dispatch_token: expect.any(String),
    });

    await admin
      .from("claims")
      .update({ esign_dispatch_started_at: new Date(Date.now() - 121_000).toISOString() })
      .eq("id", claim.id);
    const second = pandadoc(happyPath(docId("must-not-send")));
    const secondDispatch = vi.spyOn(second.provider, "dispatchLor");

    await expect(dispatchLorForClaim(
      { claimId: claim.id },
      { admin, provider: second.provider },
    )).resolves.toMatchObject({ ok: false, code: "request_in_progress" });
    expect(secondDispatch).not.toHaveBeenCalled();
    expect(first.calls.filter((call) => call.url.endsWith("/send"))).toHaveLength(1);
  });

});
