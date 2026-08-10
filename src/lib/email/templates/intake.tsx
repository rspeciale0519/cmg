import { Section, Text } from "@react-email/components";
import { DetailRow, EmailLayout, emailStyles } from "./layout";

export type IntakeStaffAlertPayload = {
  claimRef: string;
  homeownerName: string;
  email: string;
  phone: string;
  propertyAddress: string;
  carrier: string;
  policyNumber: string;
  claimNumber?: string;
  lossDate: string;
  lossTime: string;
  cause: string;
  description: string;
  secondPolicyholder?: string;
  requestedAdjuster: string;
  referrer?: string;
  referrerEmail?: string;
  documentCount: number;
};

export function IntakeStaffAlert(payload: IntakeStaffAlertPayload) {
  return (
    <EmailLayout
      preview={`New intake ${payload.claimRef} — ${payload.homeownerName}`}
      reason="Sent to the CMG staff inbox because a new claim intake was submitted on the website."
    >
      <Text style={emailStyles.kicker}>New intake</Text>
      <Text style={emailStyles.heading}>{payload.claimRef}</Text>
      <Text style={emailStyles.paragraph}>
        {payload.homeownerName} submitted a Letter of Representation intake. It is sitting
        in the queue at status new_intake.
      </Text>

      <Section style={{ marginTop: "28px" }}>
        <DetailRow label="Homeowner" value={payload.homeownerName} />
        <DetailRow label="Email" value={payload.email} />
        <DetailRow label="Phone" value={payload.phone} />
        {payload.secondPolicyholder ? (
          <DetailRow label="Second on policy" value={payload.secondPolicyholder} />
        ) : null}
        <DetailRow label="Property" value={payload.propertyAddress} />
        <DetailRow label="Carrier" value={payload.carrier} />
        <DetailRow label="Policy number" value={payload.policyNumber} />
        {payload.claimNumber ? (
          <DetailRow label="Claim number" value={payload.claimNumber} />
        ) : null}
        <DetailRow label="Loss" value={`${payload.lossDate} at ${payload.lossTime} · ${payload.cause}`} />
        <DetailRow label="Description" value={payload.description} />
        <DetailRow label="Requested adjuster" value={payload.requestedAdjuster} />
        {payload.referrer ? <DetailRow label="Referred by" value={payload.referrer} /> : null}
        {payload.referrerEmail ? (
          <DetailRow label="Referrer email" value={payload.referrerEmail} />
        ) : null}
        <DetailRow
          label="Attachments"
          value={
            payload.documentCount === 1
              ? "1 file uploaded"
              : `${payload.documentCount} files uploaded`
          }
        />
      </Section>
    </EmailLayout>
  );
}

export type IntakeConfirmationPayload = {
  firstName: string;
  claimRef: string;
  propertyAddress: string;
};

export function IntakeConfirmation(payload: IntakeConfirmationPayload) {
  return (
    <EmailLayout
      preview="We have your intake — the Letter of Representation is next."
      reason="Sent because you submitted a claim intake to CMG Property Solutions. This is a transactional message about your claim."
    >
      <Text style={emailStyles.kicker}>Intake received</Text>
      <Text style={emailStyles.heading}>We have your claim details.</Text>
      <Text style={emailStyles.paragraph}>
        Hi {payload.firstName} — thanks for sending those over. Your file reference is{" "}
        <strong style={{ color: "#EBDAAF" }}>{payload.claimRef}</strong>. Quote it if you
        call us.
      </Text>
      <Text style={emailStyles.paragraph}>
        We&apos;ll prepare the Letter of Representation and email it for signature to every
        party on the policy. Once all parties have signed, the claim moves to your adjuster
        — and the referring rep, if any, gets a copy.
      </Text>

      <Section style={{ marginTop: "28px" }}>
        <DetailRow label="Your reference" value={payload.claimRef} />
        <DetailRow label="Property" value={payload.propertyAddress} />
      </Section>

      <Text style={emailStyles.paragraph}>
        If the damage is getting worse — water still coming in, structure unsafe — call us
        now. The line is answered around the clock.
      </Text>
    </EmailLayout>
  );
}
