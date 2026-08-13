import { beforeEach, describe, expect, it, vi } from "vitest";

const stub = vi.hoisted(() => ({
  auditFails: false,
  audited: vi.fn(),
  document: {
    id: "29000000-0000-4000-a000-000000000001",
    claim_id: "20000000-0000-4000-a000-000000000001",
    storage_path: "claims/20000000-0000-4000-a000-000000000001/evidence.pdf",
    original_name: "evidence.pdf",
    mime: "application/pdf",
    kind: "other",
    visibility: "customer",
  },
}));

vi.mock("server-only", () => ({}));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("next/headers", () => ({ headers: vi.fn(async () => new Headers()) }));
vi.mock("next/navigation", () => ({ redirect: vi.fn(), notFound: vi.fn() }));
vi.mock("@/lib/authz", () => ({
  requireStaff: vi.fn(async () => ({
    userId: "00000000-0000-4000-a000-000000000002",
    role: "adjuster",
  })),
  requireRole: vi.fn(async () => ({
    userId: "00000000-0000-4000-a000-000000000004",
    role: "customer",
  })),
}));
vi.mock("@/lib/rate-limit", () => ({
  RATE_LIMITS: { portalUploadUser: {} },
  checkRateLimit: vi.fn(async () => true),
  clientIpFromHeaders: vi.fn(() => "203.0.113.29"),
  inetOrNull: vi.fn((value: string) => value),
}));
vi.mock("@/lib/audit", () => ({
  writeAuditStrict: vi.fn(async (_admin: unknown, event: unknown) => {
    stub.audited(event);
    if (stub.auditFails) throw new Error("audit unavailable");
  }),
}));
vi.mock("@/lib/supabase/server", () => ({
  createClient: vi.fn(async () => ({
    from: () => ({
      select: () => ({
        eq: () => ({ maybeSingle: async () => ({ data: stub.document, error: null }) }),
      }),
    }),
  })),
}));
vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: vi.fn(() => ({
    storage: {
      from: () => ({
        createSignedUrl: async () => ({
          data: { signedUrl: "https://storage.example.test/signed-secret" },
          error: null,
        }),
      }),
    },
  })),
}));

const { issueDocumentDownload } = await import("./documents");
const { issuePortalDownload } = await import("./portal-documents");

function form(): FormData {
  const data = new FormData();
  data.set("documentId", stub.document.id);
  return data;
}

beforeEach(() => {
  vi.clearAllMocks();
  stub.auditFails = false;
});

describe.each([
  ["admin", issueDocumentDownload],
  ["portal", issuePortalDownload],
] as const)("%s signed download", (_surface, action) => {
  it("returns the bearer URL only after its required audit succeeds", async () => {
    const result = await action({ status: "idle" }, form());

    expect(result.status).toBe("success");
    expect(result.url).toBe("https://storage.example.test/signed-secret");
    expect(stub.audited).toHaveBeenCalledWith(
      expect.objectContaining({ action: "document.signed_url_issued" }),
    );
  });

  it("withholds the minted bearer URL when its required audit fails", async () => {
    stub.auditFails = true;

    const result = await action({ status: "idle" }, form());

    expect(result.status).toBe("error");
    expect(result.url).toBeUndefined();
    expect(JSON.stringify(result)).not.toContain("signed-secret");
  });
});
