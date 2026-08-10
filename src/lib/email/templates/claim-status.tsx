import { Button, Section, Text } from "@react-email/components";
import { EmailLayout, emailStyles, emailTheme } from "./layout";

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
      reason="Sent because CMG Property Solutions is representing you on this claim. Every update to your file is emailed to you."
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
