import "server-only";

import { readFile } from "node:fs/promises";
import path from "node:path";
import type { LorRequest, LorRole } from "./types";

export type PandaDocField = { value: string; role: "H1" | "H2" };

const PDF_NAMES = {
  single: "CMG_LOR-2026-PandaDoc-Single.pdf",
  dual: "CMG_LOR-2026-PandaDoc-Dual.pdf",
} as const;

const TEXT_FIELDS: Record<string, string> = {
  ph: "Policyholders.Name",
  carrier: "Claim.Carrier",
  policy: "Claim.PolicyNumber",
  property: "Property.Address",
  lossdate: "Claim.LossDate",
  cause: "Claim.Cause",
  fee: "Fee.Percent",
  claimno: "Claim.ClaimNumber",
  accepted: "Policyholders.Name",
  adjuster: "Adjuster.Name",
  phone: "Homeowner1.Phone",
  email: "Homeowner1.Email",
  em: "Claim.EmergencyMark",
  ne: "Claim.NonEmergencyMark",
  su: "Claim.SupplementalMark",
};

const H1_INITIALS = ["i1", "i2", "i3", "i4", "i8"] as const;
const H1_SIGNATURES = ["s5", "s6", "s7", "s9"] as const;
const H2_INITIALS = ["j1", "j2", "j3", "j4", "j8"] as const;
const H2_SIGNATURES = ["t5", "t6", "t7", "t9"] as const;
const DATE_FIELDS = ["d1", "d2", "d3", "d4", "d5", "d6", "d7", "d8", "d9a", "d9b"];

const pandaRole = (role: LorRole): "H1" | "H2" =>
  role === "Homeowner1" ? "H1" : "H2";

export function formatDispatchDate(value: Date): string {
  return new Intl.DateTimeFormat("en-US", {
    month: "2-digit",
    day: "2-digit",
    year: "numeric",
    timeZone: "America/New_York",
  }).format(value);
}

/** Only the two members the field map reads, so the manual prefill path — which
 *  has no dispatch attempt and no provider document — can call it too. */
export type LorFieldSource = Pick<LorRequest, "signers" | "tokens">;

export function buildLorPdfFields(
  request: LorFieldSource,
  dispatchDate: Date = new Date(),
): Record<string, PandaDocField> {
  const tokenValues = new Map(request.tokens.map((token) => [token.name, token.value]));
  const fields: Record<string, PandaDocField> = {};

  for (const [fieldId, tokenName] of Object.entries(TEXT_FIELDS)) {
    fields[fieldId] = { value: tokenValues.get(tokenName) ?? "", role: "H1" };
  }
  for (const fieldId of DATE_FIELDS) {
    fields[fieldId] = { value: formatDispatchDate(dispatchDate), role: "H1" };
  }
  // Optional authorization is a separate consent choice. Never prefill its
  // initials or date, including when the ordinary download dates are stamped.
  for (const fieldId of [...H1_INITIALS, ...H1_SIGNATURES, "ia2", "da2"]) {
    fields[fieldId] = { value: "", role: "H1" };
  }
  if (request.signers.some((signer) => signer.role === "Homeowner2")) {
    for (const fieldId of [...H2_INITIALS, ...H2_SIGNATURES, "ja2"]) {
      fields[fieldId] = { value: "", role: "H2" };
    }
  }
  return fields;
}

export function pandaDocRecipients(request: LorRequest) {
  return request.signers.map((signer) => ({
    email: signer.email,
    first_name: signer.firstName,
    last_name: signer.lastName,
    role: pandaRole(signer.role),
  }));
}

export function lorPdfName(signerCount: number): string {
  return signerCount > 1 ? PDF_NAMES.dual : PDF_NAMES.single;
}

export function loadLorPdf(signerCount: number): Promise<Buffer> {
  return readFile(
    path.join(process.cwd(), "src", "lib", "esign", "templates", lorPdfName(signerCount)),
  );
}
