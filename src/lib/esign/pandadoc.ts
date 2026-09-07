import "server-only";

import { PandaDocClient } from "./pandadoc-client";
import { buildLorPdfFields, loadLorPdf, lorPdfName, pandaDocRecipients } from "./lor-pdf";
import { ESignError, type ESignProvider, type LorDispatch, type LorRequest } from "./types";

export type PandaDocProviderOptions = {
  client: PandaDocClient;
  loadPdf?: (signerCount: number) => Promise<Uint8Array>;
};

/**
 * Transport half of the PandaDoc flow (blueprint §"sendLor implementation
 * steps"): create from template → poll to `document.draft` → send.
 *
 * The claim record is untouched here. `sendLor()` owns persistence, so a
 * transport failure leaves no half-updated claim behind.
 */
export class PandaDocProvider implements ESignProvider {
  readonly kind = "pandadoc" as const;
  readonly canSendElectronically = true;

  private readonly client: PandaDocClient;
  private readonly loadPdf: (signerCount: number) => Promise<Uint8Array>;

  constructor(options: PandaDocProviderOptions) {
    this.client = options.client;
    this.loadPdf = options.loadPdf ?? loadLorPdf;
  }

  async dispatchLor(request: LorRequest): Promise<LorDispatch> {
    if (request.signers.length === 0) {
      throw new ESignError("creation_failed", "an LOR needs at least one signer");
    }

    return this.client.withOperationDeadline(async (operation) => {
      const pdf = await this.loadPdf(request.signers.length);
      const created = await this.client.createDocumentFromPdf(
        pdf,
        lorPdfName(request.signers.length),
        {
          name: request.documentName,
          recipients: pandaDocRecipients(request),
          fields: buildLorPdfFields(request),
          parse_form_fields: false,
          metadata: {
            claim_id: request.claimId,
            dispatch_attempt_token: request.dispatchAttemptToken,
          },
        },
        operation,
      );

      await this.client.waitForDraft(created.id, operation);

      if (request.beforeSend) {
        await request.beforeSend(created.id);
      }
      this.client.assertBeforeSend(operation);

      const sent = await this.client.sendDocument(created.id, {
        message:
          request.message ??
          "Please review and sign the Letter of Representation for your claim.",
        silent: false,
      }, operation);

      return {
        providerDocumentId: created.id,
        esignStatus: sent.status || "document.sent",
        deliveredByProvider: true,
      };
    });
  }

  downloadSignedPdf(providerDocumentId: string): Promise<Uint8Array> {
    return this.client.downloadProtected(providerDocumentId);
  }
}
