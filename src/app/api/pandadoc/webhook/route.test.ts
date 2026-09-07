// @vitest-environment node
import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

/* These suites make a dozen round trips to a Docker-hosted Postgres and its
   storage API. Under `npm test`, which runs 25 files in parallel, that can
   exceed the 5 s default on a loaded machine — a scheduling fact, not a defect
   in the code under test. */
vi.setConfig({ testTimeout: 30_000, hookTimeout: 30_000 });

const { signedDelivery, stateChangedEvent } = await import("@/lib/esign/fixtures");
const { WEBHOOK_EVENT_ID_HEADER } = await import("@/lib/esign/webhook");
const support = await import("@/lib/esign/test-support");
type TestAdmin = Awaited<ReturnType<typeof support.testAdminClient>>;
const { POST, maxDuration } = await import("./route");
const { WEBHOOK_ROUTE_MAX_DURATION_SECONDS } = await import("@/lib/esign/webhook-timing");

/**
 * Route-level wiring only: that the raw body reaches verification unparsed,
 * that the signature is lifted from `?signature=` and the event id from the
 * `X-PandaDoc-Webhook-Event-Id` header, and that the status comes back
 * unchanged. The pipeline's own behaviour is proved in
 * `src/lib/esign/webhook.test.ts`.
 */
const available = await support.localSupabaseAvailable();
if (!available) {
  console.warn("[esign] local Supabase is not reachable — webhook route suite skipped");
}

const describeDb = available ? describe : describe.skip;

const SHARED_KEY = "route-suite-shared-key";
const ENDPOINT = "https://cmg.test/api/pandadoc/webhook";

describeDb("POST /api/pandadoc/webhook", () => {
  let admin: TestAdmin;
  const claims: Array<{ id: string; claimRef: string }> = [];
  const eventIds: string[] = [];
  const auditIds: number[] = [];
  let previousKey: string | undefined;
  let previousMode: string | undefined;

  it("exports the bounded platform duration pinned by the timing invariant", () => {
    expect(maxDuration).toBe(WEBHOOK_ROUTE_MAX_DURATION_SECONDS);
    expect(maxDuration).toBeLessThanOrEqual(15);
  });

  const request = (
    body: string,
    signature: string | null,
    eventId: string | null,
    ip = "203.0.113.42",
  ) =>
    new Request(signature === null ? ENDPOINT : `${ENDPOINT}?signature=${signature}`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        ...(eventId ? { [WEBHOOK_EVENT_ID_HEADER]: eventId } : {}),
        "x-forwarded-for": ip,
      },
      body,
    });

  beforeAll(async () => {
    previousKey = process.env.PANDADOC_WEBHOOK_SHARED_KEY;
    previousMode = process.env.SITE_MODE;
    process.env.PANDADOC_WEBHOOK_SHARED_KEY = SHARED_KEY;
    process.env.SITE_MODE = "platform";
    process.env.RESEND_API_KEY = "";
    admin = support.testAdminClient();
  });

  afterAll(async () => {
    if (previousKey === undefined) delete process.env.PANDADOC_WEBHOOK_SHARED_KEY;
    else process.env.PANDADOC_WEBHOOK_SHARED_KEY = previousKey;
    if (previousMode === undefined) delete process.env.SITE_MODE;
    else process.env.SITE_MODE = previousMode;

    await support.cleanupFixtures(admin, claims, eventIds, auditIds);
  });

  it("verifies, dedupes and applies a correctly signed delivery", async () => {
    const documentId = `pd-${randomUUID()}`;
    const claim = await support.seedClaim(admin, { status: "lor_sent" });
    claims.push({ id: claim.id, claimRef: claim.claimRef });
    await admin
      .from("claims")
      .update({ pandadoc_document_id: documentId })
      .eq("id", claim.id);

    const delivery = signedDelivery(SHARED_KEY, [
      stateChangedEvent(claim.id, documentId, "document.viewed"),
    ]);
    eventIds.push(delivery.eventId);

    const first = await POST(request(delivery.rawBody, delivery.signature, delivery.eventId));
    expect(first.status).toBe(200);
    await expect(first.json()).resolves.toMatchObject({ ok: true, applied: 1 });

    const replay = await POST(request(delivery.rawBody, delivery.signature, delivery.eventId));
    expect(replay.status).toBe(200);
    await expect(replay.json()).resolves.toEqual({ ok: true, duplicate: true });

    const { data: row } = await admin
      .from("claims")
      .select("esign_status")
      .eq("id", claim.id)
      .single();
    expect(row?.esign_status).toBe("document.viewed");
  });

  it("answers 403 when the body no longer matches the signature", async () => {
    const delivery = signedDelivery(SHARED_KEY, [
      stateChangedEvent(randomUUID(), "pd-tampered", "document.completed"),
    ]);

    const response = await support.captureWebhookRejectionAudit(admin, auditIds, (ip) =>
      POST(
        request(
          delivery.rawBody.replace("document.completed", "document.declined"),
          delivery.signature,
          delivery.eventId,
          ip,
        ),
      ),
    );

    expect(response.status).toBe(403);
    await expect(response.json()).resolves.toEqual({
      ok: false,
      reason: "invalid_signature",
    });

    const { data: dedupeRow } = await admin
      .from("pandadoc_webhook_events")
      .select("event_id")
      .eq("event_id", delivery.eventId)
      .maybeSingle();
    expect(dedupeRow).toBeNull();
  });

  it("answers 403 when the signature parameter is absent entirely", async () => {
    const delivery = signedDelivery(SHARED_KEY, [
      stateChangedEvent(randomUUID(), "pd-nosig", "document.completed"),
    ]);

    const response = await support.captureWebhookRejectionAudit(admin, auditIds, (ip) =>
      POST(request(delivery.rawBody, null, delivery.eventId, ip)),
    );
    expect(response.status).toBe(403);
  });

  it("answers 400 when the event id header is missing", async () => {
    const delivery = signedDelivery(SHARED_KEY, [
      stateChangedEvent(randomUUID(), "pd-noid", "document.completed"),
    ]);

    const response = await POST(request(delivery.rawBody, delivery.signature, null));
    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({
      ok: false,
      reason: "missing_event_id",
    });
  });
});
