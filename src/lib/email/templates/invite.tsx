import { Button, Section, Text } from "@react-email/components";
import { EmailLayout, emailStyles, emailTheme } from "./layout";

export type InvitePayload = {
  firstName: string;
  /** Absolute `/invite/:token` URL. The raw token exists only here and in the row's digest. */
  inviteUrl: string;
  audience: "customer" | "partner" | "staff";
  /** `CMG-2026-0041` on a claim invite; absent for partner and staff invites. */
  claimRef?: string;
  /** Company name on a partner invite. */
  companyName?: string;
  expiresInHours: number;
};

const OPENING: Record<InvitePayload["audience"], string> = {
  customer: "Your claim portal is ready.",
  partner: "Your referral portal is ready.",
  staff: "Your CMG staff account is ready.",
};

function Body({ payload }: { payload: InvitePayload }) {
  if (payload.audience === "customer") {
    return (
      <>
        <Text style={emailStyles.paragraph}>
          Hi {payload.firstName} — CMG Property Solutions is now representing you
          {payload.claimRef ? ` on claim ${payload.claimRef}` : ""}. Set a password and
          you can follow the claim from start to finish: where it stands, what we have
          filed, and every document on the file.
        </Text>
        <Text style={emailStyles.paragraph}>
          You will also be able to ask your adjuster a question in writing and get the
          answer on the same page.
        </Text>
      </>
    );
  }

  if (payload.audience === "partner") {
    return (
      <Text style={emailStyles.paragraph}>
        Hi {payload.firstName} — you can now track the claims
        {payload.companyName ? ` ${payload.companyName}` : " your company"} refers to CMG:
        status, milestone dates, and the settlement figure once a claim settles.
      </Text>
    );
  }

  return (
    <Text style={emailStyles.paragraph}>
      Hi {payload.firstName} — set a password to activate your CMG staff account. You will
      be asked to set up an authenticator app immediately afterwards; the admin area cannot
      be opened without it.
    </Text>
  );
}

export function InviteEmail(payload: InvitePayload) {
  return (
    <EmailLayout
      preview={`${OPENING[payload.audience]} This invitation expires in ${payload.expiresInHours} hours.`}
      reason="Sent because CMG Property Solutions invited you to this portal. If you were not expecting it, ignore this email and the invitation will expire on its own."
    >
      <Text style={emailStyles.kicker}>Invitation</Text>
      <Text style={emailStyles.heading}>{OPENING[payload.audience]}</Text>

      <Body payload={payload} />

      <Section style={{ marginTop: "30px" }}>
        <Button
          href={payload.inviteUrl}
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
          Set my password
        </Button>
      </Section>

      <Text style={{ ...emailStyles.paragraph, fontSize: "13px" }}>
        This link works once and expires in {payload.expiresInHours} hours. If it has
        already expired, ask us to send a new one — we cannot reopen an old link.
      </Text>
    </EmailLayout>
  );
}
