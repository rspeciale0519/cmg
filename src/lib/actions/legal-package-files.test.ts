import { beforeEach, describe, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({ requireStaff: vi.fn(), rpc: vi.fn(), download: vi.fn() }));
vi.mock("@/lib/authz", () => ({ requireStaff: mocks.requireStaff }));
vi.mock("@/lib/supabase/server", () => ({ createClient: async () => ({ rpc: mocks.rpc }) }));
vi.mock("./documents", () => ({ issueDocumentDownload: mocks.download }));
import { issueLegalPackageDownload } from "./legal-package-files";

const packageId = "11111111-1111-4111-8111-111111111111";
const documentId = "22222222-2222-4222-8222-222222222222";
function request() { const form = new FormData(); form.set("packageId", packageId); form.set("documentId", documentId); return form; }
beforeEach(() => {
  vi.clearAllMocks(); mocks.requireStaff.mockResolvedValue({ userId: "manager" });
  mocks.rpc.mockResolvedValue({ data: [{ id: documentId, size_bytes: 23 }], error: null });
  mocks.download.mockResolvedValue({ status: "success", url: "https://storage.example.test/signed", filename: "test.pdf" });
});
describe("package document access", () => {
  it("checks package membership before using the audited document download", async () => {
    const result = await issueLegalPackageDownload({ status: "idle" }, request());
    expect(mocks.requireStaff).toHaveBeenCalledWith("/admin");
    expect(mocks.rpc).toHaveBeenCalledWith("legal_package_document", { p_package_id: packageId, p_document_id: documentId });
    expect(mocks.download.mock.calls[0][1].get("documentId")).toBe(documentId);
    expect(result).toMatchObject({ status: "success", sizeBytes: 23 });
  });
  it.each([
    { data: null, error: null },
    { data: [], error: null },
    { data: [{ id: documentId, size_bytes: 23 }], error: { code: "42501" } },
    { data: [{ id: packageId, size_bytes: 23 }], error: null },
  ])("does not issue links after a refused manifest check", async value => {
    mocks.rpc.mockResolvedValue(value);
    expect((await issueLegalPackageDownload({ status: "idle" }, request())).status).toBe("error");
    expect(mocks.download).not.toHaveBeenCalled();
  });
  it("refuses malformed identifiers before database access", async () => {
    const form = request(); form.set("documentId", "../../file");
    expect((await issueLegalPackageDownload({ status: "idle" }, form)).status).toBe("error");
    expect(mocks.rpc).not.toHaveBeenCalled();
  });
  it("preserves audit or storage refusal instead of returning success", async () => {
    mocks.download.mockResolvedValue({ status: "error", message: "Not available" });
    expect(await issueLegalPackageDownload({ status: "idle" }, request())).toEqual({ status: "error", message: "Not available" });
  });
  it.each([
    { data: [], error: null },
    { data: null, error: { code: "42501" } },
    { data: [{ id: documentId, size_bytes: 24 }], error: null },
    { data: [{ id: documentId, size_bytes: 23, updated_at: "new-revision" }], error: null },
  ])("withholds the link if authority or the manifest changes during issuance", async (latest) => {
    mocks.rpc.mockResolvedValueOnce({ data: [{ id: documentId, size_bytes: 23 }], error: null }).mockResolvedValueOnce(latest);
    const result = await issueLegalPackageDownload({ status: "idle" }, request());
    expect(mocks.download).toHaveBeenCalledTimes(1);
    expect(result.status).toBe("error");
    expect(result.url).toBeUndefined();
  });
});
