import { describe, expect, it } from "vitest";
import { renderPasswordResetEmail } from "./password-reset";
import { isNotificationTemplate, NOTIFICATION_TEMPLATES } from "./render";
import { site } from "@/lib/site";

const resetUrl =
  "https://app.cmg.test/auth/confirm?token_hash=0123456789abcdef0123456789abcdef0123456789abcdef01234567&type=recovery";

describe("renderPasswordResetEmail", () => {
  it("renders the branded layout with the link as the call to action", async () => {
    const { subject, html, text } = await renderPasswordResetEmail({
      resetUrl,
      expiresInMinutes: 60,
    });

    expect(subject).toBe("Reset your CMG password");
    expect(html).toContain("<!DOCTYPE html");
    expect(html).toContain("Reset your password.");
    expect(html).toContain("Choose a new password");
    // The same href attribute escaping React Email applies to every template.
    expect(html).toContain(resetUrl.replace("&", "&amp;"));
    expect(text).toContain(resetUrl);
    expect(text).toContain("expires in 60 minutes");
  });

  it("carries the footer that identifies CMG and the reason, like every template", async () => {
    const { text } = await renderPasswordResetEmail({ resetUrl, expiresInMinutes: 60 });

    expect(text).toContain(site.name);
    expect(text).toContain(site.phone);
    expect(text).toMatch(/Sent because someone asked to reset the password/);
    expect(text).toMatch(/If it was not you, ignore this email/);
  });

  it("keeps the link and the token out of the subject", async () => {
    const { subject } = await renderPasswordResetEmail({ resetUrl, expiresInMinutes: 60 });

    expect(subject).not.toContain("token");
    expect(subject).not.toContain("http");
  });

  it("mentions the authenticator code so a staff member is not surprised by it", async () => {
    const { text } = await renderPasswordResetEmail({ resetUrl, expiresInMinutes: 60 });

    expect(text).toMatch(/authenticator app/);
  });

  /**
   * The template is kept out of the outbox registry on purpose: an outbox row
   * keeps its payload, and this payload is a live credential.
   */
  it("is not an outbox notification template", () => {
    expect(isNotificationTemplate("password_reset")).toBe(false);
    expect(NOTIFICATION_TEMPLATES.some((name) => name.includes("password"))).toBe(false);
  });
});
