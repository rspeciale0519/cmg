import { Button, Section, Text } from "@react-email/components";
import { EmailLayout, emailStyles, emailTheme } from "./layout";

export type PasswordResetPayload = {
  /**
   * Absolute `/auth/confirm?token_hash=…&type=recovery` URL. It is a bearer
   * credential for one password change, so it exists only in this message.
   */
  resetUrl: string;
  expiresInMinutes: number;
};

export function PasswordResetEmail(payload: PasswordResetPayload) {
  return (
    <EmailLayout
      preview={`Reset your CMG password. This link expires in ${payload.expiresInMinutes} minutes.`}
      reason="Sent because someone asked to reset the password for this address at CMG Property Solutions. If it was not you, ignore this email — your password stays the same and the link expires on its own."
    >
      <Text style={emailStyles.kicker}>Password reset</Text>
      <Text style={emailStyles.heading}>Reset your password.</Text>

      <Text style={emailStyles.paragraph}>
        Use the button below to choose a new password for your CMG account. If your
        account uses an authenticator app, you will also need a code from that app.
      </Text>

      <Section style={{ marginTop: "30px" }}>
        <Button
          href={payload.resetUrl}
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
          Choose a new password
        </Button>
      </Section>

      <Text style={{ ...emailStyles.paragraph, fontSize: "13px" }}>
        This link works once and expires in {payload.expiresInMinutes} minutes. Do not
        forward this email. If the link has expired, request a new one from the sign-in
        page.
      </Text>
    </EmailLayout>
  );
}
