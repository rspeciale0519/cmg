import type { DocumentKind } from "@/lib/claims/documents";

/**
 * The kinds a homeowner may file, and the same four `documents_insert` admits
 * from a customer.
 *
 * The list is short for one reason: `kind` is not a label, it is the key to the
 * `lor_sent → lor_signed` gate — the transition trigger asks only whether a
 * `documents` row of kind `lor_signed` exists on the claim. A homeowner who
 * could write that value could assert that CMG holds a signed letter of
 * representation over themselves and advance their own claim. `contract`,
 * `estimate` and `denial` are absent for a milder version of the same reason: a
 * denial letter appearing on the file because the homeowner labelled a PDF that
 * way is a fact about the carrier that nobody at CMG asserted.
 *
 * In its own module rather than beside the action that enforces it, because a
 * `"use server"` file may export only async functions — a constant declared
 * there is a build error, not a style preference. The upload form and the upload
 * action both import from here, so the list the page offers and the list the
 * server accepts cannot come apart.
 */
export const PORTAL_DOCUMENT_KINDS = [
  { value: "photo", label: "Photo of the damage" },
  { value: "declarations", label: "Policy declarations page" },
  { value: "correspondence", label: "Letter or email from the carrier" },
  { value: "other", label: "Something else" },
] as const satisfies ReadonlyArray<{ value: DocumentKind; label: string }>;

export function isPortalDocumentKind(value: string): value is DocumentKind {
  return PORTAL_DOCUMENT_KINDS.some((kind) => kind.value === value);
}

/**
 * What a homeowner should understand a document on their claim to be.
 *
 * Not `DOCUMENT_KIND_LABEL`, which is the workspace's vocabulary — "LOR —
 * unsigned" is precise for an adjuster and means nothing to the person being
 * represented. The two labels for the letter of representation say what it does
 * rather than what stage it is at, because that is the fact a homeowner opening
 * their documents list wants.
 *
 * Every kind is present, including the ones a customer cannot upload: staff can
 * mark any document `visibility = 'customer'`, so an estimate or a denial letter
 * legitimately appears in this list even though it can only arrive from the
 * other direction.
 */
export const PORTAL_KIND_LABEL: Record<DocumentKind, string> = {
  declarations: "Policy declarations",
  photo: "Photo",
  contract: "Agreement with CMG",
  lor_unsigned: "Letter of representation — to sign",
  lor_signed: "Letter of representation — signed",
  estimate: "Estimate",
  denial: "Carrier denial letter",
  correspondence: "Correspondence",
  other: "Document",
};
