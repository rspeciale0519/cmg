import { render } from "@react-email/components";
import {
  PasswordResetEmail,
  type PasswordResetPayload,
} from "./templates/password-reset";

/**
 * Renders the password-reset email for DIRECT delivery.
 *
 * This template is deliberately absent from the `render.tsx` registry, from
 * `notifications_outbox` and from `deliverableTemplates()`. Every outbox row
 * keeps its payload after delivery, and the payload here would be the reset
 * link — a bearer credential that sets a new password. Storing it would put a
 * live credential in an ordinary table that staff can read and backups keep.
 * So the link is rendered in memory, sent once through Resend, and dropped. If
 * delivery fails, the person asks for another link; nothing retries it.
 *
 * The mode filter that `deliverableTemplates()` applies to the outbox is applied
 * by the caller instead: the request action sends only when the account's own
 * surface is open in the current `SITE_MODE`.
 */
export async function renderPasswordResetEmail(
  payload: PasswordResetPayload,
): Promise<{ subject: string; html: string; text: string }> {
  const element = <PasswordResetEmail {...payload} />;
  const [html, text] = await Promise.all([
    render(element),
    render(element, { plainText: true }),
  ]);

  // No link and no address in the subject: a subject shows on lock screens and
  // is quoted in replies.
  return { subject: "Reset your CMG password", html, text };
}
