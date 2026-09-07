// @vitest-environment node
import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import type { ESignProvider } from "./types";

vi.mock("server-only", () => ({}));
vi.setConfig({ testTimeout: 30_000, hookTimeout: 30_000 });

const {
  creationFailedEvent,
  fakeSignedPdf,
  pdfReadyEvent,
  recipientCompletedEvent,
  signedDelivery,
  stateChangedEvent,
} = await import("./fixtures");
const { processPandaDocWebhook } = await import("./webhook");
const support = await import("./test-support");
type TestAdmin = Awaited<ReturnType<typeof support.testAdminClient>>;

const available = await support.localSupabaseAvailable();
const describeDb = available ? describe : describe.skip;
const SHARED_KEY = "supersession-webhook-key";

describeDb("PandaDoc attempt supersession", () => {
  let admin: TestAdmin;
  const claims: Array<{ id: string; claimRef: string }> = [];
  const deliveries: string[] = [];
  let downloads = 0;
  const provider: ESignProvider = {
    kind: "pandadoc",
    canSendElectronically: true,
    dispatchLor: () => Promise.reject(new Error("not used")),
    downloadSignedPdf: async () => {
      downloads += 1;
      return fakeSignedPdf();
    },
  };

  async function sent() {
    const claim = await support.seedClaim(admin, { status: "lor_sent" });
    claims.push({ id: claim.id, claimRef: claim.claimRef });
    const documentId = `pd-${randomUUID()}`;
    const token = randomUUID();
    await admin.from("claims").update({
      pandadoc_document_id: documentId,
      esign_active_attempt_token: token,
      esign_status: "document.sent",
    }).eq("id", claim.id);
    return { ...claim, documentId, token };
  }

  async function post(events: unknown[]) {
    const delivery = signedDelivery(SHARED_KEY, events);
    deliveries.push(delivery.eventId);
    return processPandaDocWebhook(delivery, {
      admin,
      provider,
      sharedKey: SHARED_KEY,
    });
  }

  beforeAll(() => {
    process.env.RESEND_API_KEY = "";
    admin = support.testAdminClient();
  });

  afterAll(async () => {
    await support.cleanupFixtures(admin, claims, deliveries);
  });

  it("ignores every stale prior-document effect after retry", async () => {
    const claim = await sent();
    const oldDocument = `pd-old-${randomUUID()}`;
    const oldToken = randomUUID();
    downloads = 0;
    const result = await post([
      stateChangedEvent(claim.id, oldDocument, "document.viewed", oldToken),
      stateChangedEvent(claim.id, oldDocument, "document.declined", oldToken),
      creationFailedEvent(claim.id, oldDocument, "old attempt failed", oldToken),
      pdfReadyEvent(claim.id, oldDocument, oldToken),
    ]);

    expect(result.body).toMatchObject({ applied: 0, ignored: 4, failed: 0 });
    expect(downloads).toBe(0);
    const { data: row } = await admin.from("claims")
      .select("status, esign_status, pandadoc_document_id")
      .eq("id", claim.id).single();
    expect(row).toEqual({
      status: "lor_sent",
      esign_status: "document.sent",
      pandadoc_document_id: claim.documentId,
    });
    const { count: documents } = await admin.from("documents")
      .select("id", { count: "exact", head: true }).eq("claim_id", claim.id);
    expect(documents).toBe(0);
    const { count: outbox } = await admin.from("notifications_outbox")
      .select("id", { count: "exact", head: true })
      .like("dedupe_key", `${deliveries.at(-1)}%`);
    expect(outbox).toBe(0);
    const { count: audits } = await admin.from("audit_log")
      .select("id", { count: "exact", head: true })
      .eq("entity_id", claim.id).eq("action", "esign.stale_webhook_ignored");
    expect(audits).toBe(4);
  });

  it("ignores an old provider event after manual fallback cleared the document id", async () => {
    const claim = await sent();
    const oldDocument = claim.documentId;
    const oldToken = claim.token;
    await admin.from("claims").update({
      pandadoc_document_id: null,
      esign_active_attempt_token: null,
      esign_status: "manual_pending",
    }).eq("id", claim.id);

    const result = await post([
      stateChangedEvent(claim.id, oldDocument, "document.declined", oldToken),
    ]);
    expect(result.body).toMatchObject({ applied: 0, ignored: 1, failed: 0 });
    const { data: row } = await admin.from("claims")
      .select("esign_status, pandadoc_document_id").eq("id", claim.id).single();
    expect(row).toEqual({ esign_status: "manual_pending", pandadoc_document_id: null });
  });

  it("counts two recipient completions in one delivery and cannot regress to viewed", async () => {
    const claim = await sent();
    const result = await post([
      recipientCompletedEvent(claim.id, claim.documentId, {
        firstName: "Dana", lastName: "Roe",
      }, claim.token),
      recipientCompletedEvent(claim.id, claim.documentId, {
        firstName: "Robin", lastName: "Roe",
      }, claim.token),
    ]);
    expect(result.body).toMatchObject({ applied: 2, failed: 0 });

    await post([
      stateChangedEvent(claim.id, claim.documentId, "document.viewed", claim.token),
    ]);
    const { data: row } = await admin.from("claims")
      .select("esign_status").eq("id", claim.id).single();
    expect(row?.esign_status).toBe("recipient.completed:2:2");
    const { count: completions } = await admin.from("esign_recipient_completions")
      .select("recipient_hash", { count: "exact", head: true })
      .eq("claim_id", claim.id).eq("document_id", claim.documentId);
    expect(completions).toBe(2);
  });

  it("gives one of two concurrent dispatch requests ownership and dedupes a replay", async () => {
    const claim = await support.seedClaim(admin, { status: "under_review" });
    claims.push({ id: claim.id, claimRef: claim.claimRef });
    const first = randomUUID();
    const second = randomUUID();
    const [a, b] = await Promise.all([
      admin.rpc("claim_esign_dispatch", {
        p_claim_id: claim.id, p_request_id: first, p_claim_token: randomUUID(),
        p_mode: "pandadoc", p_lease_seconds: 120,
      }),
      admin.rpc("claim_esign_dispatch", {
        p_claim_id: claim.id, p_request_id: second, p_claim_token: randomUUID(),
        p_mode: "pandadoc", p_lease_seconds: 120,
      }),
    ]);
    const aStatus = (a.data as Record<string, unknown>).status;
    const bStatus = (b.data as Record<string, unknown>).status;
    const statuses = [aStatus, bStatus].sort();
    expect(statuses).toEqual(["busy", "claimed"]);

    const replay = await admin.rpc("claim_esign_dispatch", {
      p_claim_id: claim.id,
      p_request_id: aStatus === "claimed" ? first : second,
      p_claim_token: randomUUID(), p_mode: "pandadoc",
      p_lease_seconds: 120,
    });
    expect((replay.data as Record<string, unknown>).status).not.toBe("claimed");
  });
});
