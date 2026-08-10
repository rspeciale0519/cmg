import { Section, Text } from "@react-email/components";
import { DetailRow, EmailLayout, emailStyles } from "./layout";

export type LeadStaffAlertPayload = {
  name: string;
  phone: string;
  email?: string;
  message?: string;
  submittedAt: string;
};

export function LeadStaffAlert(payload: LeadStaffAlertPayload) {
  return (
    <EmailLayout
      preview={`New review request — ${payload.name}`}
      reason="Sent to the CMG staff inbox because the contact form was submitted on the website."
    >
      <Text style={emailStyles.kicker}>New lead</Text>
      <Text style={emailStyles.heading}>{payload.name} wants a free review.</Text>
      <Text style={emailStyles.paragraph}>
        Call back within one business day. That is the promise made on the form.
      </Text>

      <Section style={{ marginTop: "28px" }}>
        <DetailRow label="Name" value={payload.name} />
        <DetailRow label="Phone" value={payload.phone} />
        {payload.email ? <DetailRow label="Email" value={payload.email} /> : null}
        <DetailRow
          label="What happened"
          value={payload.message ?? "No detail given on the form."}
        />
        <DetailRow label="Submitted" value={payload.submittedAt} />
      </Section>
    </EmailLayout>
  );
}

export type LeadAutoReplyPayload = {
  firstName: string;
};

export function LeadAutoReply(payload: LeadAutoReplyPayload) {
  return (
    <EmailLayout
      preview="Request received — an adjuster will call you within one business day."
      reason="Sent because you requested a free claim review from CMG Property Solutions. This is a transactional reply to that request."
    >
      <Text style={emailStyles.kicker}>Request received</Text>
      <Text style={emailStyles.heading}>An adjuster will call you.</Text>
      <Text style={emailStyles.paragraph}>
        Hi {payload.firstName} — we have your request and an adjuster will call you within
        one business day.
      </Text>
      <Text style={emailStyles.paragraph}>
        If the damage is urgent — water still coming in, structure unsafe — call us now
        rather than waiting for the callback. The line is answered around the clock.
      </Text>
      <Text style={emailStyles.paragraph}>
        There is no fee unless we recover. Nothing is owed for the review itself.
      </Text>
    </EmailLayout>
  );
}
