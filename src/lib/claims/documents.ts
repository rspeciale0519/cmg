import type { Database } from "@/types/database-app";

export type DocumentKind = Database["public"]["Enums"]["document_kind"];
export type DocumentVisibility = Database["public"]["Enums"]["document_visibility"];

export const DOCUMENT_KINDS: readonly DocumentKind[] = [
  "declarations",
  "photo",
  "contract",
  "lor_unsigned",
  "lor_signed",
  "estimate",
  "denial",
  "correspondence",
  "other",
] as const;

export const DOCUMENT_KIND_LABEL: Record<DocumentKind, string> = {
  declarations: "Declarations page",
  photo: "Photo",
  contract: "Contract",
  lor_unsigned: "LOR — unsigned",
  lor_signed: "LOR — signed",
  estimate: "Estimate",
  denial: "Denial letter",
  correspondence: "Correspondence",
  other: "Other",
};

/**
 * The two kinds that arm the `lor_sent → lor_signed` gate. `documents_insert`
 * and `documents_update_staff` both refuse them to anyone who is not the owner
 * or the assigned adjuster, so the picker greys them out for an assistant
 * rather than letting the write fail after the bytes have already landed.
 */
export const REPRESENTATION_KINDS: readonly DocumentKind[] = [
  "lor_unsigned",
  "lor_signed",
] as const;

export function isDocumentKind(value: string): value is DocumentKind {
  return (DOCUMENT_KINDS as readonly string[]).includes(value);
}

export function isRepresentationKind(kind: DocumentKind): boolean {
  return (REPRESENTATION_KINDS as readonly DocumentKind[]).includes(kind);
}

export function isDocumentVisibility(value: string): value is DocumentVisibility {
  return value === "internal" || value === "customer";
}

export const DOCUMENT_VISIBILITY_LABEL: Record<DocumentVisibility, string> = {
  internal: "CMG only",
  customer: "Homeowner can see",
};

const UNITS = ["B", "KB", "MB"] as const;

export function formatBytes(bytes: number): string {
  let value = bytes;
  let unit = 0;
  while (value >= 1024 && unit < UNITS.length - 1) {
    value /= 1024;
    unit += 1;
  }
  return `${value >= 10 || unit === 0 ? Math.round(value) : value.toFixed(1)} ${UNITS[unit]}`;
}
