// @vitest-environment node
import { describe, expect, it, vi } from "vitest";
import type { HandlerContext } from "./webhook-handlers";

vi.mock("server-only", () => ({}));

const { handlePdfReady } = await import("./webhook-handlers");
const { fakeSignedPdf, pdfReadyEvent } = await import("./fixtures");

function fixture(outcome: "lost" | "invalid" | "stale") {
  const objects = new Map<string, Uint8Array>();
  const documents = new Set<string>();
  const intents = new Set<string>();
  const claimId = "20000000-0000-4000-a000-0000000000c1";
  const documentId = "local-pdf-test";
  const admin = {
    rpc: async (name: string, args: { p_object_paths?: string[]; p_storage_path?: string }) => {
      if (name === "esign_attempt_is_active") return { data: true, error: null };
      if (name === "enqueue_storage_cleanup_exact") {
        for (const path of args.p_object_paths ?? []) intents.add(path);
        return { data: 1, error: null };
      }
      if (name !== "finalize_esign_pdf") throw new Error(`Unexpected RPC: ${name}`);
      if (outcome === "stale") return { data: { status: "stale" }, error: null };
      documents.add(args.p_storage_path!);
      return outcome === "lost"
        ? { data: null, error: { message: "database response lost" } }
        : { data: null, error: null };
    },
    storage: {
      from: () => ({
        upload: async (path: string, bytes: Uint8Array) => {
          objects.set(path, bytes);
          return { error: null };
        },
        remove: async (paths: string[]) => {
          for (const path of paths) objects.delete(path);
          return { error: null };
        },
      }),
    },
  } as unknown as HandlerContext["admin"];
  const context: HandlerContext = {
    admin,
    provider: {
      kind: "pandadoc",
      canSendElectronically: true,
      dispatchLor: () => Promise.reject(new Error("Live dispatch is forbidden in this suite")),
      downloadSignedPdf: async () => fakeSignedPdf(),
    },
    claim: {
      id: claimId,
      claim_ref: "CMG-2099-0207",
      status: "lor_sent",
      esign_status: "document.completed",
      pandadoc_document_id: documentId,
      esign_active_attempt_token: null,
      esign_dispatch_token: null,
      property_street: "100 Test Way",
      property_street2: null,
      property_city: "Orlando",
      property_state: "Florida",
      property_zip: "32801",
    },
    event: pdfReadyEvent(claimId, documentId),
    eventId: "local-pdf-event",
  };
  return { context, objects, documents, intents };
}

describe("signed PDF cleanup after uncertain finalization", () => {
  it.each(["lost", "invalid"] as const)("preserves signed bytes after a committed %s response", async (outcome) => {
    const { context, objects, documents, intents } = fixture(outcome);

    await expect(handlePdfReady(context)).rejects.toThrow("signed LOR finalization failed");

    expect(documents.size).toBe(1);
    expect(objects.size).toBe(1);
    expect([...documents].every((path) => objects.has(path))).toBe(true);
    expect([...objects.keys()].every((path) => intents.has(path))).toBe(true);
  });

  it("queues an uploaded orphan when the finalization attempt becomes stale", async () => {
    const { context, objects, documents, intents } = fixture("stale");

    expect(await handlePdfReady(context)).toBe("ignored");

    expect(documents.size).toBe(0);
    expect(objects.size).toBe(1);
    expect([...objects.keys()].every((path) => intents.has(path))).toBe(true);
  });
});
