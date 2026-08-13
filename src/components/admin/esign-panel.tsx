"use client";

import Link from "next/link";
import { useActionState } from "react";
import { submitLorRecovery } from "@/lib/actions/esign";
import { idleState, resilient } from "@/lib/actions/types";
import { adminESignState, type AdminESignTone } from "@/lib/esign/admin-state";
import { cx } from "@/lib/cx";
import { ActionFeedback, SubmitButton } from "./form-controls";

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
}: {
  claimId: string;
  requestId: string;
  claimStatus: string;
  esignStatus: string | null;
  providerDocumentId: string | null;
  canManage: boolean;
  electronicReady: boolean;
  electronicBlocker: string | null;
}) {
  const [state, action] = useActionState(resilient(submitLorRecovery), idleState);
  const display = adminESignState(esignStatus, claimStatus);
  const canStart = display.key === "not_started" && claimStatus === "under_review";
  const canRecover = claimStatus === "lor_sent" && display.recoverable;
  const showActions = canManage && (canStart || canRecover);

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

      {showActions ? (
        <form action={action} className="mt-[13px]">
          <input type="hidden" name="claimId" value={claimId} />
          <input type="hidden" name="requestId" value={requestId} />
          <div className="flex flex-wrap gap-2">
            <SubmitButton
              name="intent"
              value="electronic"
              pendingLabel="Sending…"
              disabled={!electronicReady}
            >
              {canStart ? "Send for e-signature" : "Retry e-signature"}
            </SubmitButton>
            <SubmitButton
              name="intent"
              value="manual"
              variant="secondary"
              pendingLabel="Switching…"
            >
              Use manual signing
            </SubmitButton>
          </div>
          {!electronicReady && electronicBlocker ? (
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
