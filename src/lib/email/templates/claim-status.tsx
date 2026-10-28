import { Button, Section, Text } from "@react-email/components";
import { DetailRow, EmailLayout, emailStyles, emailTheme } from "./layout";

export type ClaimStatusUpdatePayload = {
  firstName: string;
  claimRef: string;
  /** Display label, not the enum value — the homeowner never sees `lor_sent`. */
  statusLabel: string;
  /** One sentence on what the new status means for them. */
  statusMeaning: string;
  /** Spec §5's five-step customer mapping, when the status has one. */
  phase?: string;
  /** The staff member's note, when they left one. Never invented. */
  note?: string;
  portalUrl: string;
};

/**
 * Sent on every transition a homeowner is entitled to see. Addresses by first
 * name only (spec §7.9) and carries no policy number, carrier or address — the
 * claim reference is the handle, and the portal is where the detail lives.
 */
export function ClaimStatusUpdate(payload: ClaimStatusUpdatePayload) {
  return (
    <EmailLayout
      preview={`${payload.claimRef} is now ${payload.statusLabel.toLowerCase()}.`}
      reason="Sent because CMG Property Solutions recorded a status update for your claim."
    >
      <Text style={emailStyles.kicker}>Claim update</Text>
      <Text style={emailStyles.heading}>
        {payload.claimRef} is now {payload.statusLabel.toLowerCase()}.
      </Text>

      <Text style={emailStyles.paragraph}>
        Hi {payload.firstName} — {payload.statusMeaning}
      </Text>

      {payload.note ? (
        <Text
          style={{
            ...emailStyles.paragraph,
            borderLeft: `2px solid ${emailTheme.accent}`,
            paddingLeft: "16px",
          }}
        >
          {payload.note}
        </Text>
      ) : null}

      {payload.phase ? (
        <Text style={{ ...emailStyles.paragraph, fontSize: "13px" }}>
          Stage: {payload.phase}
        </Text>
      ) : null}

      <Section style={{ marginTop: "30px" }}>
        <Button
          href={payload.portalUrl}
          style={{
            display: "inline-block",
            padding: "15px 26px",
            border: `1px solid ${emailTheme.accent}`,
            color: emailTheme.accent,
            fontSize: "15px",
            fontWeight: 500,
            textDecoration: "none",
          }}
        >
          Open my claim
        </Button>
      </Section>
    </EmailLayout>
  );
}

export type SettledNoticePayload = {
  firstName: string;
  claimRef: string;
  /** Already formatted as currency by the caller. Absent when none is recorded. */
  settlementAmount?: string;
  note?: string;
  portalUrl: string;
};

/**
 * Settlement gets its own template rather than another `ClaimStatusUpdate`.
 *
 * Every other transition is a step in a process the homeowner is waiting out.
 * This one is the answer they have been waiting for, it is the only one that
 * carries a figure, and it is the only one where the next move is theirs to
 * understand rather than ours to make. A generic "your claim is now settled"
 * with a one-line meaning underneath would have been the same shape as
 * "documenting" — and the shape is what people read first.
 *
 * The amount is included only when `claim_financials` actually holds one. An
 * email that says "settled" beside a blank or a zero is worse than one that says
 * settled and sends them to the portal for the number.
 */
export function SettledNotice(payload: SettledNoticePayload) {
  return (
    <EmailLayout
      preview={`${payload.claimRef} has settled.`}
      reason="Sent because CMG Property Solutions recorded your claim as settled."
    >
      <Text style={emailStyles.kicker}>Settled</Text>
      <Text style={emailStyles.heading}>Your claim has settled.</Text>

      <Text style={emailStyles.paragraph}>
        Hi {payload.firstName} — {payload.claimRef} is agreed with the carrier. What
        remains is payment and closing the file, and we will keep you posted through
        both.
      </Text>

      {payload.note ? (
        <Text
          style={{
            ...emailStyles.paragraph,
            borderLeft: `2px solid ${emailTheme.accent}`,
            paddingLeft: "16px",
          }}
        >
          {payload.note}
        </Text>
      ) : null}

      <Section style={{ marginTop: "28px" }}>
        <DetailRow label="Your reference" value={payload.claimRef} />
        {payload.settlementAmount ? (
          <DetailRow label="Settlement" value={payload.settlementAmount} />
        ) : null}
      </Section>

      <Text style={emailStyles.paragraph}>
        Your fee agreement applies to the recovery. The figures as we hold them are on
        your claim in the portal.
      </Text>

      <Section style={{ marginTop: "30px" }}>
        <Button
          href={payload.portalUrl}
          style={{
            display: "inline-block",
            padding: "15px 26px",
            border: `1px solid ${emailTheme.accent}`,
            color: emailTheme.accent,
            fontSize: "15px",
            fontWeight: 500,
            textDecoration: "none",
          }}
        >
          Open my claim
        </Button>
      </Section>
    </EmailLayout>
  );
}
