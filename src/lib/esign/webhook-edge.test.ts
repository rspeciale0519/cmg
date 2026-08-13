// @vitest-environment node
import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import type { ESignProvider } from "./types";

vi.mock("server-only", () => ({}));

/* These suites make a dozen round trips to a Docker-hosted Postgres and its
   storage API. Under `npm test`, which runs 25 files in parallel, that can
   exceed the 5 s default on a loaded machine — a scheduling fact, not a defect
   in the code under test. */
vi.setConfig({ testTimeout: 30_000, hookTimeout: 30_000 });

const {
  creationFailedEvent,
  fakeSignedPdf,
  pdfReadyEvent,
  recipientCompletedEvent,
  signedDelivery,
  stateChangedEvent,
} = await import("./fixtures");
const { signWebhookBody } = await import("./signature");
const { processPandaDocWebhook } = await import("./webhook");
const support = await import("./test-support");
type TestAdmin = Awaited<ReturnType<typeof support.testAdminClient>>;

/**
 * The webhook pipeline against the running local database. Only the PandaDoc
 * HTTP download is stubbed; the dedupe primary key, the `lor_signed` gate, the
 * storage bucket, the outbox and the audit trigger are all real.
 */
const available = await support.localSupabaseAvailable();
if (!available) {
  console.warn(
    "[esign] local Supabase is not reachable — database-backed webhook suite skipped",
  );
}

const describeDb = available ? describe : describe.skip;

const SHARED_KEY = "webhook-shared-key-for-the-suite";

const downloads: string[] = [];
const stubProvider: ESignProvider = {
  kind: "pandadoc",
  canSendElectronically: true,
  dispatchLor: () => Promise.reject(new Error("dispatchLor is not part of this suite")),
  downloadSignedPdf: (documentId: string) => {
    downloads.push(documentId);
    return Promise.resolve(fakeSignedPdf());
  },
};

describeDb("PandaDoc webhook pipeline", () => {
  let admin: TestAdmin;
  const claims: Array<{ id: string; claimRef: string }> = [];
  const eventIds: string[] = [];

  const post = (delivery: { rawBody: string; signature: string; eventId: string }) => {
    eventIds.push(delivery.eventId);
    return processPandaDocWebhook(
      {
        rawBody: delivery.rawBody,
        signature: delivery.signature,
        eventId: delivery.eventId,
        ip: "203.0.113.42",
      },
      { admin, provider: stubProvider, sharedKey: SHARED_KEY },
    );
  };

  const seedSent = async (documentId: string) => {
    const claim = await support.seedClaim(admin, { status: "lor_sent" });
    claims.push({ id: claim.id, claimRef: claim.claimRef });
    await admin
      .from("claims")
      .update({ pandadoc_document_id: documentId, esign_status: "document.sent" })
      .eq("id", claim.id);
    return claim;
  };

  beforeAll(async () => {
    process.env.RESEND_API_KEY = "";
    admin = support.testAdminClient();
  });

  /* pgTAP runs against this same live database and asserts against the seed,
     so the suite has to leave nothing of its own behind. */
  afterAll(async () => {
    for (const claim of claims) {
      await support.cleanupClaim(admin, claim.id, claim.claimRef);
    }
    await support.cleanupWebhookEvents(admin, eventIds);
  });

  it("rejects reuse of a completed event id with different signed bytes", async () => {
    const documentId = `pd-${randomUUID()}`;
    const claim = await seedSent(documentId);
    const first = signedDelivery(SHARED_KEY, [
      stateChangedEvent(claim.id, documentId, "document.viewed"),
    ]);
    eventIds.push(first.eventId);
    await post(first);

    const rawBody = JSON.stringify([
      stateChangedEvent(claim.id, documentId, "document.declined"),
    ]);
    const conflict = await processPandaDocWebhook(
      {
        rawBody,
        signature: signWebhookBody(SHARED_KEY, rawBody),
        eventId: first.eventId,
      },
      { admin, provider: stubProvider, sharedKey: SHARED_KEY },
    );

    expect(conflict).toEqual({
      status: 409,
      body: { ok: false, reason: "event_id_conflict" },
    });
  });

  it("deduplicates an exact terminal replay but preserves distinct failure events", async () => {
    const documentId = `pd-${randomUUID()}`;
    const claim = await seedSent(documentId);
    const first = signedDelivery(SHARED_KEY, [
      stateChangedEvent(claim.id, documentId, "document.declined"),
    ]);
    const second = signedDelivery(SHARED_KEY, [
      stateChangedEvent(claim.id, documentId, "document.declined"),
    ]);

    await post(first);
    await post(first);
    await post(second);

    const { data: rows } = await admin.from("claim_events")
      .select("external_event_key")
      .eq("claim_id", claim.id)
      .like("external_event_key", "%:terminal-failure-feed");
    expect(rows).toHaveLength(2);
    expect(new Set(rows?.map((row) => row.external_event_key)).size).toBe(2);
  });

  it("processes two different event ids raised by one underlying change", async () => {
    const documentId = `pd-${randomUUID()}`;
    const claim = await seedSent(documentId);
    downloads.length = 0;

    const stateChanged = await post(
      signedDelivery(SHARED_KEY, [
        stateChangedEvent(claim.id, documentId, "document.completed"),
      ]),
    );
    const pdfReady = await post(
      signedDelivery(SHARED_KEY, [pdfReadyEvent(claim.id, documentId)]),
    );

    expect(stateChanged.body).toMatchObject({ ok: true, applied: 1 });
    expect(pdfReady.body).toMatchObject({ ok: true, applied: 1 });

    const { data: claimRow } = await admin
      .from("claims")
      .select("status")
      .eq("id", claim.id)
      .single();
    expect(claimRow?.status).toBe("lor_signed");
  });

  it("rejects a tampered body with 403 and processes nothing", async () => {
    const documentId = `pd-${randomUUID()}`;
    const claim = await seedSent(documentId);

    const events = [recipientCompletedEvent(claim.id, documentId, {
      firstName: "Mallory",
      lastName: "Tamper",
    })];
    const rawBody = JSON.stringify(events);
    const signature = signWebhookBody(SHARED_KEY, rawBody);
    const eventId = randomUUID();

    const outcome = await processPandaDocWebhook(
      {
        rawBody: rawBody.replace("Mallory", "Mallor!"),
        signature,
        eventId,
        ip: "203.0.113.42",
      },
      { admin, provider: stubProvider, sharedKey: SHARED_KEY },
    );

    expect(outcome).toEqual({ status: 403, body: { ok: false, reason: "invalid_signature" } });

    const { data: dedupeRow } = await admin
      .from("pandadoc_webhook_events")
      .select("event_id")
      .eq("event_id", eventId)
      .maybeSingle();
    expect(dedupeRow).toBeNull();

    const { data: feed } = await admin
      .from("claim_events")
      .select("id")
      .eq("claim_id", claim.id);
    expect(feed).toHaveLength(0);
  });

  it("rejects a signature made with the wrong shared key", async () => {
    const delivery = signedDelivery("attacker-key", [
      stateChangedEvent(randomUUID(), "pd-x", "document.completed"),
    ]);

    const outcome = await processPandaDocWebhook(
      { rawBody: delivery.rawBody, signature: delivery.signature, eventId: delivery.eventId },
      { admin, provider: stubProvider, sharedKey: SHARED_KEY },
    );

    expect(outcome.status).toBe(403);
  });

  it("rejects a delivery with no event id header", async () => {
    const delivery = signedDelivery(SHARED_KEY, [
      stateChangedEvent(randomUUID(), "pd-y", "document.completed"),
    ]);

    for (const eventId of [null, "", "not-a-uuid"]) {
      const outcome = await processPandaDocWebhook(
        { rawBody: delivery.rawBody, signature: delivery.signature, eventId },
        { admin, provider: stubProvider, sharedKey: SHARED_KEY },
      );
      expect(outcome).toEqual({ status: 400, body: { ok: false, reason: "missing_event_id" } });
    }
  });

  it("survives a malformed payload without throwing, and never answers 410", async () => {
    for (const rawBody of ["not json at all", "{}", "null", "[]"]) {
      const eventId = randomUUID();
      eventIds.push(eventId);

      const outcome = await processPandaDocWebhook(
        { rawBody, signature: signWebhookBody(SHARED_KEY, rawBody), eventId },
        { admin, provider: stubProvider, sharedKey: SHARED_KEY },
      );

      expect(outcome.status).toBeLessThan(400);
      expect(outcome.status).not.toBe(410);
    }
  });

  it("ignores an event whose claim_id matches nothing", async () => {
    const outcome = await post(
      signedDelivery(SHARED_KEY, [
        pdfReadyEvent(randomUUID(), `pd-${randomUUID()}`),
        stateChangedEvent(randomUUID(), `pd-${randomUUID()}`, "document.completed"),
      ]),
    );

    expect(outcome).toEqual({ status: 200, body: { ok: true, applied: 0, ignored: 2, failed: 0 } });
  });

  it("ignores an event type it has no handler for", async () => {
    const documentId = `pd-${randomUUID()}`;
    const claim = await seedSent(documentId);

    const outcome = await post(
      signedDelivery(SHARED_KEY, [
        { event: "document_updated", data: { id: documentId, metadata: { claim_id: claim.id } } },
      ]),
    );

    expect(outcome).toEqual({ status: 200, body: { ok: true, applied: 0, ignored: 1, failed: 0 } });
  });

  it("falls back to pandadoc_document_id when metadata carries no claim id", async () => {
    const documentId = `pd-${randomUUID()}`;
    const claim = await seedSent(documentId);

    const outcome = await post(
      signedDelivery(SHARED_KEY, [
        { event: "document_state_changed", data: { id: documentId, status: "document.viewed" } },
      ]),
    );

    expect(outcome.body).toMatchObject({ applied: 1 });

    const { data: row } = await admin
      .from("claims")
      .select("esign_status")
      .eq("id", claim.id)
      .single();
    expect(row?.esign_status).toBe("document.viewed");
  });

  it("flags a declined document for staff without touching the claim status", async () => {
    const documentId = `pd-${randomUUID()}`;
    const claim = await seedSent(documentId);

    await post(
      signedDelivery(SHARED_KEY, [
        stateChangedEvent(claim.id, documentId, "document.declined"),
      ]),
    );

    const { data: row } = await admin
      .from("claims")
      .select("status, esign_status")
      .eq("id", claim.id)
      .single();
    expect(row).toEqual({ status: "lor_sent", esign_status: "document.declined" });

    const { data: events } = await admin
      .from("claim_events")
      .select("visibility, body")
      .eq("claim_id", claim.id);
    expect(events).toContainEqual({
      visibility: "internal",
      body: expect.stringContaining("declined"),
    });

    const { data: audit } = await admin
      .from("audit_log")
      .select("action")
      .eq("entity_id", claim.id)
      .eq("action", "esign.document_failed");
    expect(audit).toHaveLength(1);
  });

  it("surfaces the detail from a failed asynchronous creation", async () => {
    const documentId = `pd-${randomUUID()}`;
    const claim = await seedSent(documentId);

    await post(
      signedDelivery(SHARED_KEY, [
        creationFailedEvent(
          claim.id,
          documentId,
          "Role for form field with name='userName' is not provided in payload",
        ),
      ]),
    );

    const { data: row } = await admin
      .from("claims")
      .select("esign_status")
      .eq("id", claim.id)
      .single();
    expect(row?.esign_status).toBe("document.creation_failed");

    const { data: events } = await admin
      .from("claim_events")
      .select("body")
      .eq("claim_id", claim.id);
    expect(
      events?.some((event: { body: string }) => event.body.includes("Role for form field")),
    ).toBe(true);
  });
});
