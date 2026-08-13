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
  fakeSignedPdf,
  pdfReadyEvent,
  recipientCompletedEvent,
  signedDelivery,
  stateChangedEvent,
} = await import("./fixtures");
const { processPandaDocWebhook } = await import("./webhook");
const { WEBHOOK_LEASE_SECONDS } = await import("./webhook-timing");
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

  it("drives a real claim from lor_sent to lor_signed across the webhook chain", async () => {
    const documentId = `pd-${randomUUID()}`;
    const claim = await seedSent(documentId);
    downloads.length = 0;

    const signed = await post(
      signedDelivery(SHARED_KEY, [
        recipientCompletedEvent(claim.id, documentId, {
          firstName: "Dana",
          lastName: "Roe",
        }),
      ]),
    );
    expect(signed).toEqual({ status: 200, body: { ok: true, applied: 1, ignored: 0, failed: 0 } });

    const stateChanged = await post(
      signedDelivery(SHARED_KEY, [
        stateChangedEvent(claim.id, documentId, "document.completed"),
      ]),
    );
    expect(stateChanged.status).toBe(200);

    const pdfDelivery = signedDelivery(SHARED_KEY, [pdfReadyEvent(claim.id, documentId)]);
    const pdfReady = await post(pdfDelivery);
    expect(pdfReady).toEqual({ status: 200, body: { ok: true, applied: 1, ignored: 0, failed: 0 } });
    expect(downloads).toEqual([documentId]);

    const { data: claimRow } = await admin
      .from("claims")
      .select("status, esign_status, lor_signed_at, pandadoc_document_id")
      .eq("id", claim.id)
      .single();
    expect(claimRow?.status).toBe("lor_signed");
    expect(claimRow?.esign_status).toBe("document.completed");
    expect(claimRow?.lor_signed_at).not.toBeNull();

    const { data: document } = await admin
      .from("documents")
      .select("kind, visibility, mime, size_bytes, storage_path, original_name")
      .eq("claim_id", claim.id)
      .eq("kind", "lor_signed")
      .single();
    expect(document).toMatchObject({
      kind: "lor_signed",
      visibility: "customer",
      mime: "application/pdf",
    });
    expect(document?.storage_path.startsWith(`claims/${claim.id}/`)).toBe(true);
    expect(document?.size_bytes).toBe(fakeSignedPdf().length);

    const { data: object, error: objectError } = await admin.storage
      .from("claim-docs")
      .download(document!.storage_path);
    expect(objectError).toBeNull();
    expect(object).not.toBeNull();
    expect((await object!.arrayBuffer()).byteLength).toBe(fakeSignedPdf().length);

    const { data: outbox } = await admin
      .from("notifications_outbox")
      .select("recipient_email, template, status")
      .in("template", ["lor_signed", "esign_staff_alert"])
      .order("created_at", { ascending: true });
    expect(
      outbox?.some(
        (row: { template: string; recipient_email: string }) =>
          row.template === "lor_signed" && row.recipient_email === claim.claimantEmails[0],
      ),
    ).toBe(true);

    const { data: audit } = await admin
      .from("audit_log")
      .select("action")
      .eq("entity_id", claim.id)
      .in("action", ["esign.recipient_completed", "esign.state_changed", "esign.lor_signed"]);
    expect(audit?.map((row: { action: string }) => row.action).sort()).toEqual([
      "esign.lor_signed",
      "esign.recipient_completed",
      "esign.state_changed",
    ]);

    const { data: dedupeRow } = await admin
      .from("pandadoc_webhook_events")
      .select("event_id, payload_summary")
      .eq("event_id", pdfDelivery.eventId)
      .single();
    expect(dedupeRow?.event_id).toBe(pdfDelivery.eventId);
    expect(dedupeRow?.payload_summary).toMatchObject({ count: 1 });

    const { data: history } = await admin
      .from("claim_status_history")
      .select("from_status, to_status")
      .eq("claim_id", claim.id)
      .eq("to_status", "lor_signed");
    expect(history).toHaveLength(1);
  });

  it("applies a replayed event id exactly once", async () => {
    const documentId = `pd-${randomUUID()}`;
    const claim = await seedSent(documentId);
    downloads.length = 0;

    const delivery = signedDelivery(SHARED_KEY, [pdfReadyEvent(claim.id, documentId)]);

    const first = await post(delivery);
    const second = await post(delivery);
    const third = await post(delivery);

    expect(first.body).toMatchObject({ ok: true, applied: 1 });
    expect(second).toEqual({ status: 200, body: { ok: true, duplicate: true } });
    expect(third).toEqual({ status: 200, body: { ok: true, duplicate: true } });

    expect(downloads).toEqual([documentId]);

    const { data: documents } = await admin
      .from("documents")
      .select("id")
      .eq("claim_id", claim.id)
      .eq("kind", "lor_signed");
    expect(documents).toHaveLength(1);

    const { data: history } = await admin
      .from("claim_status_history")
      .select("id")
      .eq("claim_id", claim.id)
      .eq("to_status", "lor_signed");
    expect(history).toHaveLength(1);

    const { data: audit } = await admin
      .from("audit_log")
      .select("id")
      .eq("entity_id", claim.id)
      .eq("action", "esign.lor_signed");
    expect(audit).toHaveLength(1);
  });

  it("retries an enqueue failure after earlier PDF effects without duplicating them", async () => {
    const documentId = `pd-${randomUUID()}`;
    const claim = await seedSent(documentId);
    const delivery = signedDelivery(SHARED_KEY, [pdfReadyEvent(claim.id, documentId)]);
    eventIds.push(delivery.eventId);
    let failOnce = true;

    const first = await processPandaDocWebhook(
      {
        rawBody: delivery.rawBody,
        signature: delivery.signature,
        eventId: delivery.eventId,
      },
      {
        admin,
        provider: stubProvider,
        sharedKey: SHARED_KEY,
        beforeEnqueue: async () => {
          if (failOnce) {
            failOnce = false;
            throw new Error("injected outbox failure");
          }
        },
      },
    );
    expect(first.status).toBe(500);

    const { data: released } = await admin
      .from("pandadoc_webhook_events")
      .select("payload_summary")
      .eq("event_id", delivery.eventId)
      .single();
    expect(released?.payload_summary).toMatchObject({ _state: "failed" });

    const retry = await post(delivery);
    expect(retry.body).toMatchObject({ ok: true, applied: 1 });

    const [{ data: documents }, { data: history }, { data: events }, { data: outbox }] =
      await Promise.all([
        admin.from("documents").select("id").eq("claim_id", claim.id).eq("kind", "lor_signed"),
        admin.from("claim_status_history").select("id").eq("claim_id", claim.id).eq("to_status", "lor_signed"),
        admin.from("claim_events").select("body").eq("claim_id", claim.id),
        admin.from("notifications_outbox").select("dedupe_key, status, attempts").like("dedupe_key", `${delivery.eventId}:%`),
      ]);
    expect(documents).toHaveLength(1);
    expect(history).toHaveLength(1);
    expect(events?.filter(({ body }) => body.includes("signed Letter of Representation"))).toHaveLength(1);
    expect(events?.filter(({ body }) => body.includes("Representation is confirmed"))).toHaveLength(1);
    expect(outbox).toHaveLength(2);
    expect(outbox?.every((row) => row.status === "pending" && row.attempts === 0)).toBe(true);

    const { data: audit } = await admin
      .from("audit_log")
      .select("id")
      .eq("entity_id", claim.id)
      .eq("action", "esign.lor_signed")
      .contains("meta", { event_id: delivery.eventId });
    expect(audit).toHaveLength(1);
  });

  it("times out a hung PDF download and releases the event without late side effects", async () => {
    const documentId = `pd-${randomUUID()}`;
    const claim = await seedSent(documentId);
    const delivery = signedDelivery(SHARED_KEY, [pdfReadyEvent(claim.id, documentId)]);
    eventIds.push(delivery.eventId);
    let resolveDownload: ((bytes: Uint8Array) => void) | undefined;
    const hungProvider: ESignProvider = {
      ...stubProvider,
      downloadSignedPdf: () => new Promise((resolve) => {
        resolveDownload = resolve;
      }),
    };

    const timedOut = await processPandaDocWebhook(
      {
        rawBody: delivery.rawBody,
        signature: delivery.signature,
        eventId: delivery.eventId,
      },
      {
        admin,
        provider: hungProvider,
        sharedKey: SHARED_KEY,
        downloadTimeoutMs: 20,
      },
    );
    expect(timedOut.status).toBe(500);

    resolveDownload?.(fakeSignedPdf());
    await new Promise((resolve) => setTimeout(resolve, 10));

    const [{ data: ledger }, { data: documents }, { data: outbox }] = await Promise.all([
      admin.from("pandadoc_webhook_events").select("payload_summary").eq("event_id", delivery.eventId).single(),
      admin.from("documents").select("id").eq("claim_id", claim.id).eq("kind", "lor_signed"),
      admin.from("notifications_outbox").select("id").like("dedupe_key", `${delivery.eventId}:%`),
    ]);
    expect(ledger?.payload_summary).toMatchObject({ _state: "failed" });
    expect(documents).toHaveLength(0);
    expect(outbox).toHaveLength(0);
  });

  it("retries a strict audit failure without duplicating completed PDF effects", async () => {
    const documentId = `pd-${randomUUID()}`;
    const claim = await seedSent(documentId);
    const delivery = signedDelivery(SHARED_KEY, [pdfReadyEvent(claim.id, documentId)]);
    eventIds.push(delivery.eventId);
    let failOnce = true;

    const first = await processPandaDocWebhook(
      {
        rawBody: delivery.rawBody,
        signature: delivery.signature,
        eventId: delivery.eventId,
      },
      {
        admin,
        provider: stubProvider,
        sharedKey: SHARED_KEY,
        beforeAudit: async () => {
          if (failOnce) {
            failOnce = false;
            throw new Error("injected audit insert failure");
          }
        },
      },
    );
    expect(first.status).toBe(500);

    const retry = await post(delivery);
    expect(retry.body).toMatchObject({ ok: true, applied: 1 });

    const [{ data: documents }, { data: history }, { data: outbox }, { data: audit }] =
      await Promise.all([
        admin.from("documents").select("id").eq("claim_id", claim.id).eq("kind", "lor_signed"),
        admin.from("claim_status_history").select("id").eq("claim_id", claim.id).eq("to_status", "lor_signed"),
        admin.from("notifications_outbox").select("id").like("dedupe_key", `${delivery.eventId}:%`),
        admin.from("audit_log").select("id").eq("entity_id", claim.id).eq("action", "esign.lor_signed").contains("meta", { event_id: delivery.eventId }),
      ]);
    expect(documents).toHaveLength(1);
    expect(history).toHaveLength(1);
    expect(outbox).toHaveLength(2);
    expect(audit).toHaveLength(1);
  });

  it("reclaims a crashed handler after its lease without losing the delivery", async () => {
    const documentId = `pd-${randomUUID()}`;
    const claim = await seedSent(documentId);
    const delivery = signedDelivery(SHARED_KEY, [
      stateChangedEvent(claim.id, documentId, "document.viewed"),
    ]);
    eventIds.push(delivery.eventId);

    await expect(
      processPandaDocWebhook(
        {
          rawBody: delivery.rawBody,
          signature: delivery.signature,
          eventId: delivery.eventId,
        },
        {
          admin,
          provider: stubProvider,
          sharedKey: SHARED_KEY,
          afterClaim: async () => {
            throw new Error("simulated process death");
          },
        },
      ),
    ).rejects.toThrow("simulated process death");

    const busy = await post(delivery);
    expect(busy).toEqual({
      status: 503,
      body: { ok: false, reason: "event_processing" },
    });

    await admin
      .from("pandadoc_webhook_events")
      .update({ received_at: new Date(Date.now() - (WEBHOOK_LEASE_SECONDS + 1) * 1000).toISOString() })
      .eq("event_id", delivery.eventId);

    const recovered = await post(delivery);
    expect(recovered.body).toMatchObject({ ok: true, applied: 1 });

    const { data: ledger } = await admin
      .from("pandadoc_webhook_events")
      .select("payload_summary")
      .eq("event_id", delivery.eventId)
      .single();
    expect(ledger?.payload_summary).toMatchObject({ _state: "done", _attempts: 2 });
  });

});
