import "server-only";

import { PandaDocClient } from "./pandadoc-client";
import { ESignError, type ESignProvider, type LorDispatch, type LorRequest } from "./types";

export type PandaDocProviderOptions = {
  client: PandaDocClient;
  /** Two-signer template; the only one strictly required. */
  templateUuid: string | null;
  /** Optional one-signer variant, used when a claim has a single claimant. */
  templateUuidSingle: string | null;
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
  private readonly templateUuid: string | null;
  private readonly templateUuidSingle: string | null;

  constructor(options: PandaDocProviderOptions) {
    this.client = options.client;
    this.templateUuid = options.templateUuid;
    this.templateUuidSingle = options.templateUuidSingle;
  }

  /**
   * One signer prefers the single-signer template when one is configured,
   * because a two-role template with an unfilled `Homeowner2` role is rejected
   * at creation time with a role-not-provided validation error.
   */
  private templateFor(signerCount: number): string {
    const chosen =
      signerCount <= 1
        ? (this.templateUuidSingle ?? this.templateUuid)
        : this.templateUuid;

    if (!chosen) {
      throw new ESignError(
        "not_configured",
        "PANDADOC_LOR_TEMPLATE_UUID is not set; the LOR template must exist before a letter can be created",
      );
    }

    return chosen;
  }

  async dispatchLor(request: LorRequest): Promise<LorDispatch> {
    if (request.signers.length === 0) {
      throw new ESignError("creation_failed", "an LOR needs at least one signer");
    }

    return this.client.withOperationDeadline(async (operation) => {
      const created = await this.client.createDocument({
      name: request.documentName,
      template_uuid: this.templateFor(request.signers.length),
      recipients: request.signers.map((signer) => ({
        email: signer.email,
        first_name: signer.firstName,
        last_name: signer.lastName,
        role: signer.role,
      })),
      tokens: request.tokens.map((token) => ({ name: token.name, value: token.value })),
      /* Round-trips through every webhook, so the handler never has to guess
         which claim an event belongs to. */
      metadata: {
        claim_id: request.claimId,
        dispatch_attempt_token: request.dispatchAttemptToken,
      },
      }, operation);

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
