import { strToU8, zipSync } from "fflate";
import type { LegalPackageDocument, LegalPackageSnapshot } from "./types";

export const MAX_PACKAGE_CONTENT_BYTES = 100 * 1024 * 1024;

export function partitionPackageDocuments(
  documents: readonly LegalPackageDocument[],
  maximum = MAX_PACKAGE_CONTENT_BYTES,
): LegalPackageDocument[][] {
  if (!Number.isSafeInteger(maximum) || maximum < 1 || documents.length === 0) {
    throw new Error("Select at least one document for the package.");
  }
  const seen = new Set<string>();
  const parts: LegalPackageDocument[][] = [];
  let part: LegalPackageDocument[] = [];
  let size = 0;
  for (const document of documents) {
    if (seen.has(document.id) || !document.id || !Number.isSafeInteger(document.sizeBytes)
      || document.sizeBytes < 1 || document.sizeBytes > maximum) {
      throw new Error("A document is repeated or has an unsupported size. Review the package again.");
    }
    seen.add(document.id);
    if (size + document.sizeBytes > maximum) {
      parts.push(part); part = []; size = 0;
    }
    part.push(document); size += document.sizeBytes;
  }
  if (part.length) parts.push(part);
  return parts;
}

export function safeZipDocumentName(index: number, original: string): string {
  const name = Array.from(original.normalize("NFC")
    .replace(/\.\./g, "").replace(/[\\/:*?"<>|\u0000-\u001f\u007f]/g, "_")
    .replace(/^[. ]+|[. ]+$/g, "")).slice(0, 160).join("") || "document";
  return `documents/${String(index + 1).padStart(3, "0")}-${name}`;
}

export function packageSummaryText(
  snapshot: LegalPackageSnapshot,
  part: number,
  parts: number,
  documents: readonly LegalPackageDocument[],
): string {
  return [
    "CMG Property Solutions — Claim handoff",
    `Claim: ${snapshot.claimRef}`,
    `Package: ${snapshot.id}`,
    `Prepared: ${snapshot.createdAt}`,
    `Part ${part} of ${parts}`,
    "",
    `Law firm: ${snapshot.firm.name}`,
    `Contact: ${snapshot.firm.contactName}`,
    `Email: ${snapshot.firm.email}`,
    `Phone: ${snapshot.firm.phone}`,
    "",
    ...snapshot.summary.flatMap(entry => [entry.label, entry.value, ""]),
    ...(snapshot.summaryNote ? ["Reviewed handoff summary", snapshot.summaryNote, ""] : []),
    "Original documents in this part",
    ...documents.map(document => `${document.name} (${document.sizeBytes} bytes)`),
    "",
    "Preparing this package does not confirm sending, acceptance, or a lawsuit.",
  ].join("\n");
}

export type PackageDependencies = {
  loadDocument: (document: LegalPackageDocument, signal?: AbortSignal) => Promise<Uint8Array>;
  createSummaryPdf: (text: string) => Promise<Uint8Array>;
  signal?: AbortSignal;
  onProgress?: (completed: number, total: number) => void;
  maxContentBytes?: number;
};

export async function buildPackageVolume(
  snapshot: LegalPackageSnapshot,
  volumeIndex: number,
  dependencies: PackageDependencies,
): Promise<{ filename: string; bytes: Uint8Array }> {
  dependencies.signal?.throwIfAborted();
  const volumes = partitionPackageDocuments(snapshot.documents, dependencies.maxContentBytes);
  if (!Number.isInteger(volumeIndex) || volumeIndex < 0 || volumeIndex >= volumes.length) {
    throw new Error("That package part is not available.");
  }
  const documents = volumes[volumeIndex];
  const files: Record<string, Uint8Array> = {};
  let completed = 0;
  for (const document of documents) {
    dependencies.signal?.throwIfAborted();
    const bytes = await dependencies.loadDocument(document, dependencies.signal);
    dependencies.signal?.throwIfAborted();
    if (bytes.byteLength !== document.sizeBytes) {
      throw new Error("A selected file changed. Review and prepare the package again.");
    }
    const originalIndex = snapshot.documents.findIndex(item => item.id === document.id);
    files[safeZipDocumentName(originalIndex, document.name)] = bytes;
    dependencies.onProgress?.(++completed, documents.length);
  }
  const text = packageSummaryText(snapshot, volumeIndex + 1, volumes.length, documents);
  files["case-summary.pdf"] = await dependencies.createSummaryPdf(text);
  // The UTF-8 copy keeps the exact reviewed text searchable and accessible,
  // including characters that the PDF standard fonts cannot represent.
  files["case-summary.txt"] = strToU8(text);
  files["manifest.json"] = strToU8(JSON.stringify({
    packageId: snapshot.id, claimRef: snapshot.claimRef, preparedAt: snapshot.createdAt,
    part: volumeIndex + 1, parts: volumes.length,
    documents: documents.map(document => ({
      id: document.id, name: document.name, mime: document.mime, sizeBytes: document.sizeBytes,
      recordedAt: document.updatedAt,
      archivePath: safeZipDocumentName(snapshot.documents.findIndex(item => item.id === document.id), document.name),
    })),
  }, null, 2));
  dependencies.signal?.throwIfAborted();
  const safeReference = snapshot.claimRef.replace(/[^a-zA-Z0-9_-]/g, "_");
  const safeId = snapshot.id.replace(/[^a-zA-Z0-9_-]/g, "_").slice(0, 64);
  return {
    filename: `${safeReference}-legal-${safeId}-part-${volumeIndex + 1}-of-${volumes.length}.zip`,
    // Original PDFs/images are already compressed. Store their unchanged bytes.
    bytes: zipSync(files, { level: 0 }),
  };
}
