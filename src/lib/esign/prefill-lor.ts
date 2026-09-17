import "server-only";

import { headers } from "next/headers";
import { writeAuditStrict } from "@/lib/audit";
import { requireStaff } from "@/lib/authz";
import { claimCapabilities } from "@/lib/claims/capabilities";
import { clientIpFromHeaders, inetOrNull } from "@/lib/rate-limit";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { collectLorLetter, loadLorClaim, type LorLetterFailureCode } from "./lor-letter";
import { buildPrefilledLorPdf, prefilledLorFileName } from "./lor-prefill";

/**
 * The manual-signing counterpart to `sendLor()`: it produces the letter and
 * hands it to the staff member, and does nothing else.
 *
 * CMG signs LORs through PandaDoc's web app rather than its API, so nothing
 * here creates a provider document. Staff download this PDF, upload it to
 * PandaDoc themselves, and send it from there; the signature and initial tags
 * the prefill leaves untouched are what PandaDoc detects on upload.
 *
 * Deliberately **not** a send:
 *
 *   * the claim's status is not advanced — `under_review → lor_sent` still
 *     belongs to `dispatchLorForClaim`, which is what records that a letter
 *     actually went out;
 *   * the dispatch lease is not claimed, so downloading the letter twice is
 *     free and can never consume the one-shot ownership a real send needs.
 *
 * Everything else is the same rule as a send. The authorization is the two
 * checks `sendLor()` makes, in the same order and with the same single
 * refusal message, and the content gates are `collectLorLetter()` — the same
 * function the dispatch path is refused by — so a letter naming no carrier, no
 * policy number, no agreement type, no recorded fee, or no claimant cannot be
 * produced here either.
 */

export type PrefilledLorFailureCode =
  | LorLetterFailureCode
  | "not_authorized"
  | "generate_failed";

export type PrefilledLorResult =
  | {
      ok: true;
      claimRef: string;
      filename: string;
      /** The PDF itself. Base64 because a server action returns JSON, not a stream. */
      pdfBase64: string;
      /** What the browser must do with it. Never inline: this is a legal document. */
      disposition: "attachment";
    }
  | { ok: false; code: PrefilledLorFailureCode; message: string };

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** One answer for "no such claim", "a claim you cannot see", and "a claim you
 *  may see but not manage" — the wording `sendLor()` uses, for the §7.9 reason
 *  it uses it. */
const REFUSED =
  "That claim is not available to send a Letter of Representation on.";

const GENERATE_FAILED =
  "The letter could not be prepared. Try again, and tell an administrator if it keeps failing.";

export async function prefillLorForClaim(
  claimId: string,
  now: Date = new Date(),
): Promise<PrefilledLorResult> {
  const session = await requireStaff();

  // A malformed id reaches Postgres as a uuid cast error rather than an empty
  // result — a different response shape, and therefore its own small oracle.
  if (!UUID.test(claimId)) {
    return { ok: false, code: "not_authorized", message: REFUSED };
  }

  const supabase = await createClient();
  const { data: visible } = await supabase
    .from("claims")
    .select("id, assigned_adjuster_id")
    .eq("id", claimId)
    .maybeSingle();

  if (!visible) {
    return { ok: false, code: "not_authorized", message: REFUSED };
  }

  const { canManage } = claimCapabilities(
    { userId: session.userId, role: session.role },
    { assignedAdjusterId: visible.assigned_adjuster_id },
  );

  if (!canManage) {
    return { ok: false, code: "not_authorized", message: REFUSED };
  }

  const admin = createAdminClient();
  const claim = await loadLorClaim(admin, visible.id);
  if (!claim) {
    return { ok: false, code: "claim_not_found", message: REFUSED };
  }

  const letter = await collectLorLetter(admin, claim);
  if (!letter.ok) return letter;

  let pdf: Uint8Array;
  try {
    pdf = await buildPrefilledLorPdf(
      { signers: letter.signers, tokens: letter.tokens },
      now,
    );
  } catch (error) {
    console.error("[esign] prefilled LOR build failed", error);
    return { ok: false, code: "generate_failed", message: GENERATE_FAILED };
  }

  const filename = prefilledLorFileName(claim.claim_ref);

  /* Written before the bytes are handed over, and required rather than
     best-effort, for the reason `issueDocumentDownload` writes its own row
     first: this is the only record that a completed agreement carrying a
     homeowner's terms left the system, and who took it. The meta names the
     claim, the signer count and the fee, never a signer's contact details —
     `audit_log` is readable by every owner. */
  try {
    await writeAuditStrict(admin, {
      actorId: session.userId,
      action: "esign.lor_prefilled",
      entity: "claims",
      entityId: claim.id,
      meta: {
        claim_ref: claim.claim_ref,
        filename,
        signer_count: letter.signers.length,
        fee_percent: letter.feePercent,
        lor_contract_type: claim.lor_contract_type,
        claim_status: claim.status,
        disposition: "attachment",
      },
      ip: inetOrNull(clientIpFromHeaders(await headers())),
    });
  } catch (error) {
    console.error("[esign] prefilled LOR audit failed", error);
    return { ok: false, code: "generate_failed", message: GENERATE_FAILED };
  }

  return {
    ok: true,
    claimRef: claim.claim_ref,
    filename,
    pdfBase64: Buffer.from(pdf).toString("base64"),
    disposition: "attachment",
  };
}
