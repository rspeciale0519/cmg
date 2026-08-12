"use client";

import { useActionState } from "react";
import { saveClaimPolicy } from "@/lib/actions/claims";
import { idleState, resilient } from "@/lib/actions/types";
import { humanizeEnum, NOT_SUPPLIED } from "@/lib/format";
/* `intake-options`, not `@/lib/validators/claims` — that module builds the zod
   schema, and a client component importing from it ships zod to the browser. */
import { CARRIER_TENURE_OPTIONS } from "@/lib/validators/intake-options";
import { Fact, FactList } from "./data-table";
import {
  ActionFeedback,
  AdminField,
  AdminInput,
  AdminSelect,
  SubmitButton,
} from "./form-controls";

/**
 * Who the claim is against, and the only screen that can say so after accept.
 *
 * These three columns are nullable since Phase 6 because §6 does not ask a
 * referring contractor for them, and `acceptIntake` collects them on the way out
 * of the queue. It is not the only way out: the status picker will take a
 * referral to `under_review` without opening the accept form, and a claim that
 * arrives there with no carrier used to have nowhere to acquire one — the
 * Overview printed all three read-only.
 *
 * So it renders whether or not the fields are set. A wrong policy number is a
 * likelier defect than a missing one, because it is taken down a phone line and
 * it does not announce itself, and correcting it must not require a route
 * through the intake queue the claim has already left.
 */
export function PolicyForm({
  claimId,
  carrier,
  policyNumber,
  carrierTenure,
  canManage,
}: {
  claimId: string;
  carrier: string | null;
  policyNumber: string | null;
  carrierTenure: string | null;
  canManage: boolean;
}) {
  const [state, formAction] = useActionState(resilient(saveClaimPolicy), idleState);

  // An assistant reads the claim and writes none of it (§4). They keep the
  // values — the same three facts the panel showed before it could be edited —
  // rather than a form `claims_update_manage` would refuse.
  if (!canManage) {
    return (
      <>
        <FactList columns={3}>
          {/* Said in words rather than left blank: an empty cell beside a filled
              one reads as a rendering fault, and the reader's next move depends
              on knowing which it is. */}
          <Fact label="Carrier">
            {carrier ?? <span className="text-ink/58">{NOT_SUPPLIED}</span>}
          </Fact>
          <Fact label="Policy number">
            {policyNumber ? (
              <span className="tabular-nums">{policyNumber}</span>
            ) : (
              <span className="text-ink/58">{NOT_SUPPLIED}</span>
            )}
          </Fact>
          <Fact label="With this carrier">
            {carrierTenure ? (
              humanizeEnum(carrierTenure)
            ) : (
              <span className="text-ink/58">{NOT_SUPPLIED}</span>
            )}
          </Fact>
        </FactList>
        <p className="mt-[13px] text-[12px] leading-[1.55] text-ink/58">
          The carrier and policy are recorded by the owner and by the adjuster the
          claim is assigned to.
        </p>
      </>
    );
  }

  const missing = !carrier || !policyNumber;

  return (
    <form action={formAction} noValidate>
      <input type="hidden" name="claimId" value={claimId} />

      {/* Only when something is absent, and it names the consequence rather than
          the field: the operator can see which box is empty, and what they
          cannot see is that the letter of representation is held behind it. */}
      {missing ? (
        <p className="mb-[13px] border-l-2 border-accent/50 py-[2px] pl-[10px] text-[12.5px] leading-[1.6] text-ink/62">
          This came in as a partner referral, so the referring rep was never asked
          for the policy. The letter of representation is addressed to the carrier
          and cites the policy number, so it cannot be sent until both are here.
        </p>
      ) : null}

      <div className="grid gap-4 sm:grid-cols-3">
        <AdminField name="carrier" label="Carrier" error={state.fieldErrors?.carrier}>
          {/* Echoed first, stored second — a refusal has to leave what was typed
              on screen, and React 19's post-action reset lands on whichever
              default is current. */}
          <AdminInput
            name="carrier"
            maxLength={120}
            defaultValue={state.values?.carrier ?? carrier ?? ""}
            error={state.fieldErrors?.carrier}
            placeholder="Insurance company"
          />
        </AdminField>

        <AdminField
          name="policyNumber"
          label="Policy number"
          error={state.fieldErrors?.policyNumber}
        >
          <AdminInput
            name="policyNumber"
            maxLength={80}
            defaultValue={state.values?.policyNumber ?? policyNumber ?? ""}
            error={state.fieldErrors?.policyNumber}
            className="tabular-nums"
          />
        </AdminField>

        <AdminField
          name="carrierTenure"
          label="With this carrier"
          error={state.fieldErrors?.carrierTenure}
        >
          <AdminSelect
            name="carrierTenure"
            defaultValue={state.values?.carrierTenure ?? carrierTenure ?? ""}
            error={state.fieldErrors?.carrierTenure}
          >
            <option value="" disabled>
              How long…
            </option>
            {CARRIER_TENURE_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </AdminSelect>
        </AdminField>
      </div>

      <div className="mt-[14px]">
        <SubmitButton variant="secondary" pendingLabel="Saving…">
          {missing ? "Record policy details" : "Save policy details"}
        </SubmitButton>
      </div>

      <ActionFeedback state={state} />
    </form>
  );
}
