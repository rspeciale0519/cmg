// @vitest-environment node
import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
vi.setConfig({ testTimeout: 30_000, hookTimeout: 30_000 });

const { creationFailedEvent, signedDelivery, stateChangedEvent } = await import("./fixtures");
const { processPandaDocWebhook } = await import("./webhook");
const { staffInbox } = await import("@/lib/email/outbox");
const support = await import("./test-support");
type TestAdmin = Awaited<ReturnType<typeof support.testAdminClient>>;

const available = await support.localSupabaseAvailable();
const describeDb = available ? describe : describe.skip;
const SHARED_KEY = "reconciliation-webhook-key";

describeDb("ambiguous PandaDoc dispatch reconciliation", () => {
  let admin: TestAdmin;
  const claims: Array<{ id: string; claimRef: string }> = [];
  const deliveries: string[] = [];

  async function sending() {
    const claim = await support.seedClaim(admin, { status: "under_review" });
    claims.push({ id: claim.id, claimRef: claim.claimRef });
    const requestId = randomUUID();
    const token = randomUUID();
    const documentId = `pd-${randomUUID()}`;
    const claimed = await admin.rpc("claim_esign_dispatch", {
      p_claim_id: claim.id,
      p_request_id: requestId,
      p_claim_token: token,
      p_mode: "pandadoc",
      p_lease_seconds: 120,
    });
    expect((claimed.data as Record<string, unknown>).status).toBe("claimed");
    const marked = await admin.rpc("mark_esign_dispatch_sending", {
      p_request_id: requestId,
      p_claim_token: token,
      p_provider_document_id: documentId,
    });
    expect(marked.data).toBe(true);
    return { ...claim, requestId, token, documentId };
  }

  async function post(events: unknown[]) {
    const delivery = signedDelivery(SHARED_KEY, events);
    deliveries.push(delivery.eventId);
    return processPandaDocWebhook(delivery, { admin, sharedKey: SHARED_KEY });
  }

  beforeAll(() => {
    process.env.RESEND_API_KEY = "";
    admin = support.testAdminClient();
  });

  afterAll(async () => {
    for (const claim of claims) await support.cleanupClaim(admin, claim.id, claim.claimRef);
    await support.cleanupWebhookEvents(admin, deliveries);
  });

  it("settles exact creation failure without a false sent transition", async () => {
    const claim = await sending();
    const delivery = signedDelivery(SHARED_KEY, [
      creationFailedEvent(claim.id, claim.documentId, "template failed", claim.token),
    ]);
    deliveries.push(delivery.eventId);
    const result = await processPandaDocWebhook(delivery, {
      admin,
      sharedKey: SHARED_KEY,
    });
    expect(result.status).toBe(200);

    const { data: row } = await admin.from("claims")
      .select("status, esign_status, esign_dispatch_token, pandadoc_document_id")
      .eq("id", claim.id).single();
    expect(row).toEqual({
      status: "under_review",
      esign_status: "document.creation_failed",
      esign_dispatch_token: null,
      pandadoc_document_id: claim.documentId,
    });
    const { count } = await admin.from("claim_status_history")
      .select("id", { count: "exact", head: true })
      .eq("claim_id", claim.id).eq("to_status", "lor_sent");
    expect(count).toBe(0);

    const { data: feed } = await admin.from("claim_events").select("body")
      .eq("claim_id", claim.id).eq("visibility", "internal");
    expect(feed).toContainEqual({
      body: expect.stringContaining("template failed"),
    });
    const { data: alerts } = await admin.from("notifications_outbox")
      .select("template, payload").like("dedupe_key", `${delivery.eventId}%`);
    expect(alerts).toHaveLength(1);
    expect(alerts?.[0]).toMatchObject({
      template: "esign_staff_alert",
      payload: { detail: "template failed" },
    });
    const { count: audits } = await admin.from("audit_log")
      .select("id", { count: "exact", head: true })
      .eq("entity_id", claim.id).eq("action", "esign.creation_failed");
    expect(audits).toBe(1);

    const replay = await processPandaDocWebhook(delivery, {
      admin,
      sharedKey: SHARED_KEY,
    });
    expect(replay.body).toMatchObject({ ok: true, duplicate: true });
    const { count: replayAlerts } = await admin.from("notifications_outbox")
      .select("id", { count: "exact", head: true })
      .like("dedupe_key", `${delivery.eventId}%`);
    expect(replayAlerts).toBe(1);
    const { count: replayAudits } = await admin.from("audit_log")
      .select("id", { count: "exact", head: true })
      .eq("entity_id", claim.id).eq("action", "esign.creation_failed");
    expect(replayAudits).toBe(1);

    const retryRequest = randomUUID();
    const retryToken = randomUUID();
    const retry = await admin.rpc("claim_esign_dispatch", {
      p_claim_id: claim.id,
      p_request_id: retryRequest,
      p_claim_token: retryToken,
      p_mode: "pandadoc",
      p_lease_seconds: 120,
    });
    expect((retry.data as Record<string, unknown>).status).toBe("claimed");
    const retryDocument = `pd-retry-${randomUUID()}`;
    const marked = await admin.rpc("mark_esign_dispatch_sending", {
      p_request_id: retryRequest,
      p_claim_token: retryToken,
      p_provider_document_id: retryDocument,
    });
    expect(marked.data).toBe(true);
    const { data: retried } = await admin.from("claims")
      .select("pandadoc_document_id, esign_active_attempt_token")
      .eq("id", claim.id).single();
    expect(retried).toEqual({
      pandadoc_document_id: retryDocument,
      esign_active_attempt_token: retryToken,
    });

    const secondDelivery = signedDelivery(SHARED_KEY, [
      creationFailedEvent(claim.id, retryDocument, "template failed", retryToken),
    ]);
    deliveries.push(secondDelivery.eventId);
    expect((await processPandaDocWebhook(secondDelivery, {
      admin,
      sharedKey: SHARED_KEY,
    })).status).toBe(200);

    const { data: bothFeed } = await admin.from("claim_events").select("body")
      .eq("claim_id", claim.id).eq("visibility", "internal")
      .like("body", "%template failed%");
    expect(bothFeed).toHaveLength(2);
    const { count: bothAlerts } = await admin.from("notifications_outbox")
      .select("id", { count: "exact", head: true })
      .in("dedupe_key", [
        `${delivery.eventId}:esign_staff_alert:${staffInbox().toLowerCase()}`,
        `${secondDelivery.eventId}:esign_staff_alert:${staffInbox().toLowerCase()}`,
      ]);
    expect(bothAlerts).toBe(2);
    const { count: bothAudits } = await admin.from("audit_log")
      .select("id", { count: "exact", head: true })
      .eq("entity_id", claim.id).eq("action", "esign.creation_failed");
    expect(bothAudits).toBe(2);
  });

  it("retains non-proof, then reconciles delivery once and accepts replay", async () => {
    const claim = await sending();
    const pending = await post([
      stateChangedEvent(claim.id, claim.documentId, "document.uploaded", claim.token),
    ]);
    expect(pending.body).toMatchObject({ ignored: 1, failed: 0 });
    const { data: stillLocked } = await admin.from("claims")
      .select("status, esign_dispatch_token").eq("id", claim.id).single();
    expect(stillLocked).toEqual({ status: "under_review", esign_dispatch_token: claim.token });

    const sent = stateChangedEvent(claim.id, claim.documentId, "document.sent", claim.token);
    expect((await post([sent])).status).toBe(200);
    expect((await post([sent])).status).toBe(200);
    const { data: reconciled } = await admin.from("claims")
      .select("status, esign_status, esign_dispatch_token").eq("id", claim.id).single();
    expect(reconciled).toEqual({
      status: "lor_sent",
      esign_status: "document.sent",
      esign_dispatch_token: null,
    });
    const { count } = await admin.from("claim_status_history")
      .select("id", { count: "exact", head: true })
      .eq("claim_id", claim.id).eq("to_status", "lor_sent");
    expect(count).toBe(1);
  });

  it("rejects mismatched token and document without releasing ownership", async () => {
    const claim = await sending();
    const mismatch = await post([
      stateChangedEvent(claim.id, `wrong-${claim.documentId}`, "document.sent", randomUUID()),
    ]);
    expect(mismatch.body).toMatchObject({ ignored: 1, failed: 0 });
    const { data: row } = await admin.from("claims")
      .select("status, esign_dispatch_token, pandadoc_document_id")
      .eq("id", claim.id).single();
    expect(row).toEqual({
      status: "under_review",
      esign_dispatch_token: claim.token,
      pandadoc_document_id: claim.documentId,
    });
  });
});
