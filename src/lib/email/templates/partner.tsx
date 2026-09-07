import { Button, Section, Text } from "@react-email/components";
import { DetailRow, EmailLayout, emailStyles, emailTheme } from "./layout";

export type ReferralStaffAlertPayload = {
  claimRef: string;
  companyName: string;
  /** "Company — Rep", the shape the intake queue card already uses. */
  referrerName: string;
  /** Absent when the rep's session carries no address — stated, not hidden. */
  referrerEmail?: string;
  homeownerName: string;
  homeownerEmail: string;
  homeownerPhone: string;
  propertyAddress: string;
  lossDate: string;
  cause: string;
  description: string;
};

/**
 * A contractor referred a homeowner.
 *
 * Not the public intake's staff alert reused, because a referral is missing the
 * half of that email that matters most to triage: no carrier, no policy number,
 * no tenure, no attachments, no requested adjuster. `referClaim` declines to ask
 * a rep for any of them — it says "absent, not guessed" and means it — so an
 * `intake_staff_alert` rendered from a referral would be a column of empty
 * detail rows, which reads as data that failed to load rather than as questions
 * nobody was asked.
 *
 * This says what is known, and says plainly what is not, so the person picking
 * it up knows the first call has a purpose.
 */
export function ReferralStaffAlert(payload: ReferralStaffAlertPayload) {
  return (
    <EmailLayout
      preview={`New referral ${payload.claimRef} from ${payload.companyName}`}
      reason="Sent to the CMG staff inbox because a partner submitted a referral on the contractor portal."
    >
      <Text style={emailStyles.kicker}>New referral</Text>
      <Text style={emailStyles.heading}>{payload.claimRef}</Text>
      <Text style={emailStyles.paragraph}>
        {payload.referrerName} referred {payload.homeownerName}. It is in the intake queue
        at status new_intake.
      </Text>

      <Section style={{ marginTop: "28px" }}>
        <DetailRow label="Homeowner" value={payload.homeownerName} />
        <DetailRow label="Email" value={payload.homeownerEmail} />
        <DetailRow label="Phone" value={payload.homeownerPhone} />
        <DetailRow label="Property" value={payload.propertyAddress} />
        <DetailRow label="Loss" value={`${payload.lossDate} · ${payload.cause}`} />
        <DetailRow label="Description" value={payload.description} />
        <DetailRow label="Referred by" value={payload.referrerName} />
        <DetailRow
          label="Referrer email"
          value={payload.referrerEmail ?? "not on file — call the company"}
        />
        <DetailRow
          label="Policy side"
          value="Not supplied — the referring rep is not asked for the carrier, the policy number or the tenure. Collect them from the homeowner before accepting."
        />
      </Section>

      <Text style={emailStyles.paragraph}>
        The homeowner has not been contacted and has given no consent to be texted. The
        first approach is CMG&apos;s to make.
      </Text>
    </EmailLayout>
  );
}

export type PartnerStatusUpdatePayload = {
  /** The company, not the person — the address on file is a shared inbox. */
  companyName: string;
  claimRef: string;
  homeownerName: string;
  /** Display label for the milestone reached, never the enum value. */
  statusLabel: string;
  partnerUrl: string;
};

/**
 * A milestone on a claim a contractor referred.
 *
 * WHAT THIS DELIBERATELY DOES NOT CARRY
 *
 * `claim_partner_summaries` — the projection this partner can read in their own
 * portal — holds the property address, the milestone dates and the settlement
 * amount. None of the three is here, and the omission is the point: that
 * projection is read behind a session, by a signed-in rep of that company, under
 * a policy. An email is read wherever it is forwarded, and a referring
 * contractor's inbox is not an access-control boundary.
 *
 * So this is a pointer, not a report. It names the claim they sent us, the
 * homeowner they know by name already, and the fact that it moved — which is the
 * whole of their legitimate interest — and puts everything else behind the
 * portal link where the policy still applies.
 *
 * The homeowner's own status email is the richer one, and correctly so: it goes
 * to the person whose claim it is.
 */
export function PartnerStatusUpdate(payload: PartnerStatusUpdatePayload) {
  return (
    <EmailLayout
      preview={`${payload.claimRef} reached ${payload.statusLabel.toLowerCase()}.`}
      reason="Sent to your company because CMG Property Solutions is handling a claim your team referred. It reports progress only."
    >
      <Text style={emailStyles.kicker}>Referral update</Text>
      <Text style={emailStyles.heading}>
        {payload.claimRef} reached {payload.statusLabel.toLowerCase()}.
      </Text>

      <Text style={emailStyles.paragraph}>
        A claim {payload.companyName} referred to us has moved on. The detail, and every
        other claim your team has sent, is in your partner portal.
      </Text>

      <Section style={{ marginTop: "28px" }}>
        <DetailRow label="Claim" value={payload.claimRef} />
        <DetailRow label="Homeowner" value={payload.homeownerName} />
        <DetailRow label="Now at" value={payload.statusLabel} />
      </Section>

      <Section style={{ marginTop: "30px" }}>
        <Button
          href={payload.partnerUrl}
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
          Open the partner portal
        </Button>
      </Section>
    </EmailLayout>
  );
}
