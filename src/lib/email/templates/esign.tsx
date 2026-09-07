import { Section, Text } from "@react-email/components";
import { DetailRow, EmailLayout, emailStyles } from "./layout";

export type LorSignedPayload = {
  firstName: string;
  claimRef: string;
  propertyAddress?: string;
};

export function LorSigned(payload: LorSignedPayload) {
  return (
    <EmailLayout
      preview="Your Letter of Representation is signed and on file."
      reason="Sent because the Letter of Representation for your claim has been signed. This is a transactional message about your claim."
    >
      <Text style={emailStyles.kicker}>Representation confirmed</Text>
      <Text style={emailStyles.heading}>Your letter is signed.</Text>
      <Text style={emailStyles.paragraph}>
        Hi {payload.firstName} — the Letter of Representation for{" "}
        <strong style={{ color: "#EBDAAF" }}>{payload.claimRef}</strong> is signed and
        filed against your claim. A copy is in your portal.
      </Text>
      <Text style={emailStyles.paragraph}>
        Your adjuster can now speak to the carrier on your behalf. The next step is
        documenting the loss.
      </Text>

      <Section style={{ marginTop: "28px" }}>
        <DetailRow label="Your reference" value={payload.claimRef} />
        {payload.propertyAddress ? (
          <DetailRow label="Property" value={payload.propertyAddress} />
        ) : null}
      </Section>
    </EmailLayout>
  );
}

export type ESignStaffAlertPayload = {
  claimRef: string;
  headline: string;
  detail: string;
  esignStatus?: string;
};

/**
 * One staff-facing template for the whole e-signature surface: a signer
 * finished, a document was declined or expired, creation failed. The headline
 * carries the specifics so the shape stays stable as PandaDoc adds statuses.
 */
export function ESignStaffAlert(payload: ESignStaffAlertPayload) {
  return (
    <EmailLayout
      preview={`${payload.claimRef} — ${payload.headline}`}
      reason="Sent to the CMG staff inbox because a Letter of Representation changed state."
    >
      <Text style={emailStyles.kicker}>E-signature</Text>
      <Text style={emailStyles.heading}>{payload.claimRef}</Text>
      <Text style={emailStyles.paragraph}>{payload.headline}</Text>

      <Section style={{ marginTop: "28px" }}>
        <DetailRow label="Detail" value={payload.detail} />
        {payload.esignStatus ? (
          <DetailRow label="Provider status" value={payload.esignStatus} />
        ) : null}
      </Section>
    </EmailLayout>
  );
}
