import { describe, expect, it, vi } from "vitest";
import { strFromU8, unzipSync } from "fflate";
import { buildPackageVolume, partitionPackageDocuments, safeZipDocumentName } from "./package";
import type { LegalPackageSnapshot } from "./types";

const snapshot: LegalPackageSnapshot = {
  id: "package-test", claimId: "claim-test", handoffId: "handoff-test",
  claimRef: "CMG-2026-0001", createdAt: "2026-11-15T12:00:00Z",
  firm: { name: "Synthetic firm", contactName: "Test contact", email: "test@example.test", phone: "" },
  summary: [{ label: "Property", value: "Synthetic property" }], summaryNote: "Reviewed summary only.",
  documents: [
    { id: "doc-1", name: "signed.pdf", mime: "application/pdf", sizeBytes: 3, updatedAt: "2026-11-15T12:00:00Z" },
    { id: "doc-2", name: "photo.jpg", mime: "image/jpeg", sizeBytes: 2, updatedAt: "2026-11-15T12:00:00Z" },
  ],
};

describe("legal package preparation", () => {
  it("keeps originals intact and includes only the selected volume", async () => {
    const loadDocument = vi.fn(async (doc: { id: string }) => doc.id === "doc-1" ? new Uint8Array([1, 2, 3]) : new Uint8Array([4, 5]));
    const result = await buildPackageVolume(snapshot, 0, {
      loadDocument, createSummaryPdf: async () => new Uint8Array([37, 80, 68, 70]), maxContentBytes: 3,
    });
    const files = unzipSync(result.bytes);
    expect(files["documents/001-signed.pdf"]).toEqual(new Uint8Array([1, 2, 3]));
    expect(Object.keys(files)).not.toContain("documents/002-photo.jpg");
    expect(loadDocument).toHaveBeenCalledTimes(1);
    expect(files["case-summary.pdf"]).toEqual(new Uint8Array([37, 80, 68, 70]));
    expect(strFromU8(files["case-summary.txt"])).toContain("Reviewed summary only.");
    expect(JSON.parse(strFromU8(files["manifest.json"]))).toMatchObject({ part: 1, parts: 2, documents: [{ id: "doc-1", name: "signed.pdf" }] });
    expect(result.filename).toBe("CMG-2026-0001-legal-package-test-part-1-of-2.zip");
  });

  it("allows the exact size boundary and splits the next document", () => {
    expect(partitionPackageDocuments(snapshot.documents, 5)).toHaveLength(1);
    expect(partitionPackageDocuments(snapshot.documents, 4).map(part => part.length)).toEqual([1, 1]);
  });

  it("refuses missing, oversized, duplicate, and invalid-size documents", () => {
    expect(() => partitionPackageDocuments([], 5)).toThrow();
    expect(() => partitionPackageDocuments(snapshot.documents, 2)).toThrow();
    expect(() => partitionPackageDocuments([snapshot.documents[0], snapshot.documents[0]], 10)).toThrow();
    for (const sizeBytes of [0, -1, Number.NaN, 1.5]) {
      expect(() => partitionPackageDocuments([{ ...snapshot.documents[0], sizeBytes }], 10)).toThrow();
    }
  });

  it("makes safe unique paths without changing original file bytes", () => {
    expect(safeZipDocumentName(0, "../../CON.pdf")).toBe("documents/001-__CON.pdf");
    expect(safeZipDocumentName(1, "../../CON.pdf")).not.toBe(safeZipDocumentName(0, "../../CON.pdf"));
    expect(safeZipDocumentName(0, "合同.pdf")).toContain("合同.pdf");
  });

  it("refuses changed size and never returns a partial archive", async () => {
    await expect(buildPackageVolume(snapshot, 0, {
      loadDocument: async () => new Uint8Array([1]), createSummaryPdf: async () => new Uint8Array([1]),
    })).rejects.toThrow("changed");
  });

  it("stops on a file error without loading later files", async () => {
    const loadDocument = vi.fn(async () => { throw new Error("Unavailable"); });
    await expect(buildPackageVolume(snapshot, 0, { loadDocument, createSummaryPdf: async () => new Uint8Array([1]) })).rejects.toThrow("Unavailable");
    expect(loadDocument).toHaveBeenCalledTimes(1);
  });

  it("rejects an invalid volume and a cancelled operation before loading", async () => {
    const loadDocument = vi.fn(async () => new Uint8Array([1]));
    const dependencies = { loadDocument, createSummaryPdf: async () => new Uint8Array([1]) };
    await expect(buildPackageVolume(snapshot, 99, dependencies)).rejects.toThrow();
    const controller = new AbortController(); controller.abort();
    await expect(buildPackageVolume(snapshot, 0, { ...dependencies, signal: controller.signal })).rejects.toThrow();
    expect(loadDocument).not.toHaveBeenCalled();
  });
});
