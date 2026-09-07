import "server-only";

import {
  ESignError,
  MANUAL_ESIGN_STATUS,
  type ESignProvider,
  type LorDispatch,
} from "./types";

/**
 * The no-key fallback (blueprint §"Environment variables"): staff send the
 * Letter of Representation outside the system — email, print, whatever the
 * homeowner can manage — and upload the signed copy against the claim.
 *
 * Nothing about the lifecycle relaxes. The claim still moves to `lor_sent`
 * here, and `lor_sent → lor_signed` still requires a `documents` row of kind
 * `lor_signed`, enforced by `enforce_claim_status_transition()` in the
 * database. The only thing that changes is who carries the paper.
 *
 * Both methods deliberately take no arguments: there is no provider request to
 * make and no provider document to fetch. TypeScript accepts the narrower
 * signatures against `ESignProvider`.
 */
export class ManualSignProvider implements ESignProvider {
  readonly kind = "manual" as const;
  readonly canSendElectronically = false;

  async dispatchLor(): Promise<LorDispatch> {
    return {
      providerDocumentId: null,
      esignStatus: MANUAL_ESIGN_STATUS,
      deliveredByProvider: false,
    };
  }

  async downloadSignedPdf(): Promise<Uint8Array> {
    throw new ESignError(
      "unsupported",
      "manual signing has no provider-side document to download; the signed copy is uploaded by staff",
    );
  }
}
