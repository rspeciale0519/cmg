import { beforeEach, describe, expect, it, vi } from "vitest";

const stub = vi.hoisted(() => ({
  userId: "00000000-0000-4000-a000-000000000009",
  otherUserId: "00000000-0000-4000-a000-000000000010",
  claimId: "20000000-0000-4000-a000-0000000000c1",
  otherClaimId: "20000000-0000-4000-a000-0000000000c2",
  token: "A".repeat(43),
  sessionId: "30000000-0000-4000-a000-0000000000c1",
  session: { userId: "00000000-0000-4000-a000-000000000009", role: "adjuster" as string },
  claims: {} as Record<string, { id: string; claim_ref: string; assigned_adjuster_id?: string }>,
  reserved: null as null | { claim_id: string; uploaded_by: string },
  prepare: vi.fn(async () => ({
    status: "idle" as const,
    uploadSession: { id: "30000000-0000-4000-a000-0000000000c1", token: "A".repeat(43), expiresAt: "2026-09-27T20:00:00.000Z", uploads: [] },
  })),
  readSession: vi.fn(async () => null as null | { claim_id: string; uploaded_by: string }),
  finalize: vi.fn(async () => ({ status: "success" as const, message: "done" })),
  prepareLimit: vi.fn(async () => true),
  finalizeLimit: vi.fn(async () => true),
  revalidate: vi.fn(),
  createAdmin: vi.fn(() => ({ marker: "admin" })),
  createClient: vi.fn(async () => ({
    from: () => ({
      select: () => ({
        eq: (_column: string, value: string) => ({
          maybeSingle: async () => ({ data: stub.claims[value] ?? null, error: null }),
        }),
      }),
    }),
  })),
}));

vi.mock("server-only", () => ({}));
vi.mock("next/cache", () => ({ revalidatePath: stub.revalidate }));
vi.mock("@/lib/authz", () => ({
  requireStaff: vi.fn(async () => stub.session),
  requireRole: vi.fn(async () => stub.session),
}));
vi.mock("@/lib/rate-limit", () => ({
  RATE_LIMITS: { portalUploadUser: { scope: "portal-upload:user", max: 20, window: "1 hour" } },
  checkRateLimit: vi.fn(async () => true),
}));
vi.mock("@/lib/supabase/admin", () => ({ createAdminClient: stub.createAdmin }));
vi.mock("@/lib/supabase/server", () => ({ createClient: stub.createClient }));
vi.mock("@/lib/private-upload/rate-limit", () => ({
  checkPrivateUploadPrepareLimit: stub.prepareLimit,
  checkPrivateUploadFinalizeLimit: stub.finalizeLimit,
}));
vi.mock("@/lib/private-upload/session", () => ({
  parsePrivateUploadCapability: (formData: FormData) => {
    if ([...formData.values()].some((value) => typeof value !== "string")) return null;
    const id = formData.get("id");
    const token = formData.get("token");
    return typeof id === "string" && typeof token === "string" ? { id, token } : null;
  },
  preparePrivateUploadSession: stub.prepare,
  privateUploadTokenHash: vi.fn(() => "hashed-token"),
  readPrivateUploadSession: stub.readSession,
}));
vi.mock("@/lib/private-upload/finalize", () => ({
  finalizePrivateUploadSession: stub.finalize,
  privateUploadRetryMessage: "Retry upload.",
}));

const { prepareClaimDocumentUpload, finalizeClaimDocumentUpload } = await import("@/lib/actions/documents");
const { finalizePortalDocumentUpload, preparePortalDocumentUpload } = await import("@/lib/actions/portal-documents");

function prepareForm(claimId = stub.claimId) {
  const form = new FormData();
  form.set("claimId", claimId);
  form.set("kind", "photo");
  form.set("visibility", "customer");
  form.set("uploadManifest", JSON.stringify([{ name: "roof/photo.jpg", size: 32, mime: "IMAGE/JPEG" }]));
  return form;
}

function finalizeForm() {
  const form = new FormData();
  form.set("id", stub.sessionId);
  form.set("token", stub.token);
  return form;
}

describe("private document upload actions", () => {
  beforeEach(() => {
    stub.session = { userId: stub.userId, role: "adjuster" };
    stub.claims = {};
    stub.reserved = null;
    stub.prepare.mockClear();
    stub.readSession.mockReset().mockImplementation(async () => stub.reserved);
    stub.finalize.mockClear();
    stub.prepareLimit.mockReset().mockResolvedValue(true);
    stub.finalizeLimit.mockReset().mockResolvedValue(true);
    stub.createAdmin.mockClear();
    stub.createClient.mockClear();
    stub.revalidate.mockClear();
  });

  it("refuses staff preparation for a claim hidden by caller RLS", async () => {
    const result = await prepareClaimDocumentUpload({ status: "idle" }, prepareForm());

    expect(result.status).toBe("error");
    expect(stub.prepare).not.toHaveBeenCalled();
    expect(stub.createAdmin).not.toHaveBeenCalled();
  });

  it("passes only normalized client metadata and server-selected document fields to reservation", async () => {
    stub.claims[stub.claimId] = { id: stub.claimId, claim_ref: "CMG-2026-0001", assigned_adjuster_id: stub.userId };

    const result = await prepareClaimDocumentUpload({ status: "idle" }, prepareForm());

    expect(result.status).toBe("idle");
    expect(stub.prepare).toHaveBeenCalledWith(
      { marker: "admin" }, stub.claimId, stub.userId,
      [{ name: "roof/photo.jpg", size: 32, mime: "image/jpeg" }], "photo", "customer",
    );
  });

  it("refuses injected storage paths in the metadata manifest", async () => {
    stub.claims[stub.claimId] = { id: stub.claimId, claim_ref: "CMG-2026-0001", assigned_adjuster_id: stub.userId };
    const form = prepareForm();
    form.set("uploadManifest", JSON.stringify([{
      name: "photo.jpg", size: 32, mime: "image/jpeg", storage_path: "claims/other/file.jpg",
    }]));

    const result = await prepareClaimDocumentUpload({ status: "idle" }, form);

    expect(result.status).toBe("error");
    expect(stub.prepare).not.toHaveBeenCalled();
  });

  it("refuses finalization when the reservation belongs to another user", async () => {
    stub.reserved = { claim_id: stub.claimId, uploaded_by: stub.otherUserId };

    const result = await finalizeClaimDocumentUpload(finalizeForm());

    expect(result.status).toBe("error");
    expect(stub.createClient).not.toHaveBeenCalled();
    expect(stub.finalize).not.toHaveBeenCalled();
  });

  it("rechecks claim access before finalizing a staff reservation", async () => {
    stub.reserved = { claim_id: stub.claimId, uploaded_by: stub.userId };
    stub.claims[stub.otherClaimId] = { id: stub.otherClaimId, claim_ref: "CMG-2026-0002" };

    const result = await finalizeClaimDocumentUpload(finalizeForm());

    expect(result.status).toBe("error");
    expect(stub.finalize).not.toHaveBeenCalled();
  });

  it("rechecks homeowner claim access before finalizing a portal reservation", async () => {
    stub.session = { userId: stub.userId, role: "customer" };
    stub.reserved = { claim_id: stub.claimId, uploaded_by: stub.userId };

    const result = await finalizePortalDocumentUpload(finalizeForm());

    expect(result.status).toBe("error");
    expect(stub.finalize).not.toHaveBeenCalled();
  });

  it("rechecks the reservation claim from storage instead of accepting a client claim id", async () => {
    stub.reserved = { claim_id: stub.otherClaimId, uploaded_by: stub.userId };
    stub.claims[stub.otherClaimId] = { id: stub.otherClaimId, claim_ref: "CMG-2026-0002" };
    const form = finalizeForm();
    form.set("claimId", stub.claimId);

    const result = await finalizeClaimDocumentUpload(form);

    expect(result.status).toBe("success");
    expect(stub.finalize).toHaveBeenCalledWith(
      { marker: "admin" }, expect.anything(), stub.sessionId, stub.token, stub.userId, stub.otherClaimId,
    );
  });
  it("refuses homeowner upload preparation for an inaccessible claim before admin access", async () => {
    stub.session = { userId: stub.userId, role: "customer" };
    const result = await preparePortalDocumentUpload({ status: "idle" }, prepareForm(stub.otherClaimId));
    expect(result.status).toBe("error");
    const missing = await preparePortalDocumentUpload({ status: "idle" }, prepareForm("20000000-0000-4000-a000-0000000000c3"));
    expect(missing.status).toBe("error");
    expect(result.message).toBe(missing.message);
    expect(result.message).toBe("That file is not on your claim, or it is no longer there.");
    expect(stub.createAdmin).not.toHaveBeenCalled();
    expect(stub.prepare).not.toHaveBeenCalled();
  });

  it("reserves a homeowner upload for an accessible claim", async () => {
    stub.session = { userId: stub.userId, role: "customer" };
    stub.claims[stub.claimId] = { id: stub.claimId, claim_ref: "CMG-2026-0001" };
    const result = await preparePortalDocumentUpload({ status: "idle" }, prepareForm());
    expect(result.status).toBe("idle");
    expect(stub.createAdmin).toHaveBeenCalledTimes(1);
    expect(stub.prepare).toHaveBeenCalledWith(
      { marker: "admin" }, stub.claimId, stub.userId,
      [{ name: "roof/photo.jpg", size: 32, mime: "image/jpeg" }], "photo", "customer",
    );
  });
});
