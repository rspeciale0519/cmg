"use client";

import { useActionState } from "react";
import { recheckIntegrations } from "@/lib/actions/settings";
import { idleState, resilient } from "@/lib/actions/types";
import { SubmitButton } from "./form-controls";

/**
 * The panel is measured on render, so it is already current when the page
 * loads. This exists for the one workflow it does not cover: someone changing an
 * environment variable and wanting to know whether it took, without hunting for
 * a reload that does not come out of the router cache.
 *
 * The result is the panel itself redrawing, so the button says nothing when it
 * succeeds — a "Rechecked" toast beside four rows that just updated would be
 * narrating what the reader can see.
 */
export function RecheckButton() {
  const [state, formAction] = useActionState(resilient(recheckIntegrations), idleState);

  return (
    <form action={formAction}>
      <SubmitButton variant="quiet" pendingLabel="Checking…">
        Recheck
      </SubmitButton>
      {state.status === "error" && state.message ? (
        <span role="alert" className="ml-2 text-[12px] text-[#E8A98D]">
          {state.message}
        </span>
      ) : null}
    </form>
  );
}
