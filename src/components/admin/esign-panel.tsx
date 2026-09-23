"use client";

import Link from "next/link";
import { useActionState, useState, useTransition } from "react";
import { downloadPrefilledLor, submitLorRecovery } from "@/lib/actions/esign";
import { idleState, resilient } from "@/lib/actions/types";
import { adminESignState, type AdminESignTone } from "@/lib/esign/admin-state";
import { cx } from "@/lib/cx";
import { ActionFeedback, AdminButton, SubmitButton } from "./form-controls";

const DOWNLOAD_FAILED =
  "The letter could not be prepared. Reload the claim and try again.";

/**
 * Save the returned bytes as a file rather than opening them.
 *
 * A server action answers with a value, not a response, so there is no
 * `Content-Disposition` header to set: the anchor's `download` attribute is
 * what makes the browser treat the PDF as an attachment instead of handing it
 * to an inline viewer.
 */
function saveAsAttachment(pdfBase64: string, filename: string): void {
  const binary = atob(pdfBase64);
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index);
  }

  const url = URL.createObjectURL(new Blob([bytes], { type: "application/pdf" }));
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  // Revoked on the next turn, not inline: a browser that has not yet started
  // reading the object URL when `click()` returns saves an empty file.
  setTimeout(() => URL.revokeObjectURL(url), 0);
}

const TONE: Record<AdminESignTone, string> = {
  neutral: "border-ink/15 bg-ink/[0.025] text-ink/72",
  active: "border-accent/35 bg-accent/[0.06] text-ink/82",
  success: "border-[#6E9A73]/40 bg-[#6E9A73]/[0.08] text-ink/82",
  failure: "border-[#E08C6A]/55 bg-[#E08C6A]/[0.08] text-ink/88",
};

export function ESignPanel({
  claimId,
  requestId,
  claimStatus,
  esignStatus,
  providerDocumentId,
  canManage,
  electronicReady,
  electronicBlocker,
  providerMode,
}: {
  claimId: string;
  requestId: string;
  claimStatus: string;
  esignStatus: string | null;
  providerDocumentId: string | null;
  canManage: boolean;
  electronicReady: boolean;
  electronicBlocker: string | null;
  /** `manual` when no PandaDoc API key is configured. */
  providerMode: "manual" | "pandadoc";
}) {
  const [state, action] = useActionState(resilient(submitLorRecovery), idleState);
  const [downloading, startDownload] = useTransition();
  const [downloadError, setDownloadError] = useState<string | null>(null);
  const display = adminESignState(esignStatus, claimStatus);
  const canStart = display.key === "not_started" && claimStatus === "under_review";
  // A failure can leave the claim at either dispatchable status: a declined or
  // expired request sits at lor_sent, while a creation failure never advanced
  // the claim past under_review. Both are retryable in the database and in
  // dispatch, so both get the recovery controls.
  const canRecover =
    (claimStatus === "lor_sent" || claimStatus === "under_review") && display.recoverable;
  const showActions = canManage && (canStart || canRecover);
  /* Without an API key the platform cannot send the letter itself, so the
     electronic button would only ever render disabled. Manual mode shows the
     steps staff actually take instead: download, send from PandaDoc, then
     record the send. */
  const manualMode = providerMode === "manual";
  /* Without an API key nobody sends the letter for CMG, so the desk needs the
     paper itself. Offered wherever a letter is still the next thing to happen —
     including while a manual request is already pending, which is exactly when
     staff go looking for the file to upload to PandaDoc. */
  const showPrefilledDownload =
    canManage &&
    providerMode === "manual" &&
    (canStart || canRecover || display.key === "manual_pending");

  const requestDownload = () => {
    setDownloadError(null);
    startDownload(async () => {
      try {
        const result = await downloadPrefilledLor(claimId);
        if (!result.ok) {
          setDownloadError(result.message);
          return;
        }
        saveAsAttachment(result.pdfBase64, result.filename);
      } catch {
        setDownloadError(DOWNLOAD_FAILED);
      }
    });
  };

  return (
    <div>
      <div className={cx("border px-[14px] py-[13px]", TONE[display.tone])}>
        <p className="text-[13px] font-medium leading-[1.4]">{display.label}</p>
        <p className="mt-[5px] text-[12.5px] leading-[1.6] text-current/75">
          {display.detail}
        </p>
        {providerDocumentId ? (
          <p className="mt-[7px] font-mono text-[10.5px] text-current/55">
            Provider document {providerDocumentId}
          </p>
        ) : null}
      </div>

      {display.key === "manual_pending" ? (
        <p className="mt-[12px] text-[12.5px] leading-[1.6] text-ink/62">
          When every signer has completed the letter, upload it as a signed LOR in{" "}
          <Link className="text-accent underline underline-offset-2" href={`/admin/claims/${claimId}/documents`}>
            Documents
          </Link>
          .
        </p>
      ) : null}

      {showPrefilledDownload ? (
        <div className="mt-[13px]">
          <AdminButton
            type="button"
            onClick={requestDownload}
            disabled={downloading}
            aria-busy={downloading || undefined}
          >
            {downloading ? "Preparing…" : "Download letter for signing"}
          </AdminButton>
          <p className="mt-[9px] text-[12px] leading-[1.55] text-ink/58">
            The letter arrives filled in, with the signature tags left in place.
            Upload it to PandaDoc, assign the signers, and send it from there.
          </p>
          {downloadError ? (
            <p role="alert" className="mt-[7px] text-[12px] leading-[1.55] text-[#E08C6A]">
              {downloadError}
            </p>
          ) : null}
        </div>
      ) : null}

      {showActions ? (
        <form action={action} className="mt-[13px]">
          <input type="hidden" name="claimId" value={claimId} />
          <input type="hidden" name="requestId" value={requestId} />
          <div className="flex flex-wrap gap-2">
            {manualMode ? null : (
              <SubmitButton
                name="intent"
                value="electronic"
                pendingLabel="Sending…"
                disabled={!electronicReady}
              >
                {canStart ? "Send for e-signature" : "Retry e-signature"}
              </SubmitButton>
            )}
            <SubmitButton
              name="intent"
              value="manual"
              variant="secondary"
              pendingLabel={manualMode ? "Recording…" : "Switching…"}
            >
              {manualMode ? "Mark letter as sent" : "Use manual signing"}
            </SubmitButton>
          </div>
          {manualMode ? (
            <p className="mt-[9px] text-[12px] leading-[1.55] text-ink/58">
              Use this after you send the letter from PandaDoc. The claim moves to LOR sent.
            </p>
          ) : null}
          {!manualMode && !electronicReady && electronicBlocker ? (
            <p className="mt-[9px] text-[12px] leading-[1.55] text-ink/58">
              Electronic sending is unavailable: {electronicBlocker}
            </p>
          ) : null}
          <ActionFeedback state={state} />
        </form>
      ) : null}

      {!canManage && canRecover ? (
        <p className="mt-[11px] text-[12px] leading-[1.55] text-ink/58">
          The owner or assigned adjuster must restart this request or switch it to manual signing.
        </p>
      ) : null}
    </div>
  );
}
