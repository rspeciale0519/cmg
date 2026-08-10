import { render } from "@react-email/components";
import type { ReactElement } from "react";
import {
  ESignStaffAlert,
  LorSigned,
  type ESignStaffAlertPayload,
  type LorSignedPayload,
} from "./templates/esign";
import {
  ClaimStatusUpdate,
  type ClaimStatusUpdatePayload,
} from "./templates/claim-status";
import {
  IntakeConfirmation,
  IntakeStaffAlert,
  type IntakeConfirmationPayload,
  type IntakeStaffAlertPayload,
} from "./templates/intake";
import { InviteEmail, type InvitePayload } from "./templates/invite";
import {
  LeadAutoReply,
  LeadStaffAlert,
  type LeadAutoReplyPayload,
  type LeadStaffAlertPayload,
} from "./templates/lead";

export type NotificationMessage =
  | { template: "intake_staff_alert"; payload: IntakeStaffAlertPayload }
  | { template: "intake_confirmation"; payload: IntakeConfirmationPayload }
  | { template: "lead_staff_alert"; payload: LeadStaffAlertPayload }
  | { template: "lead_auto_reply"; payload: LeadAutoReplyPayload }
  | { template: "invite"; payload: InvitePayload }
  | { template: "claim_status_update"; payload: ClaimStatusUpdatePayload }
  | { template: "lor_signed"; payload: LorSignedPayload }
  | { template: "esign_staff_alert"; payload: ESignStaffAlertPayload };

export type NotificationTemplate = NotificationMessage["template"];

type Renderer = {
  subject: (payload: never) => string;
  element: (payload: never) => ReactElement;
};

const TEMPLATES: Record<NotificationTemplate, Renderer> = {
  intake_staff_alert: {
    subject: (payload: IntakeStaffAlertPayload) =>
      `New intake ${payload.claimRef} — ${payload.homeownerName}`,
    element: (payload: IntakeStaffAlertPayload) => <IntakeStaffAlert {...payload} />,
  },
  intake_confirmation: {
    subject: (payload: IntakeConfirmationPayload) =>
      `We have your claim intake — ${payload.claimRef}`,
    element: (payload: IntakeConfirmationPayload) => <IntakeConfirmation {...payload} />,
  },
  lead_staff_alert: {
    subject: (payload: LeadStaffAlertPayload) =>
      `New review request — ${payload.name}`,
    element: (payload: LeadStaffAlertPayload) => <LeadStaffAlert {...payload} />,
  },
  lead_auto_reply: {
    subject: () => "We have your request — CMG Property Solutions",
    element: (payload: LeadAutoReplyPayload) => <LeadAutoReply {...payload} />,
  },
  invite: {
    /* No token in the subject line. The link is the secret and it belongs in
       exactly one place; a subject is quoted in replies, forwarded, and read
       aloud by notification previews on a lock screen. */
    subject: (payload: InvitePayload) =>
      payload.claimRef
        ? `Your CMG claim portal — ${payload.claimRef}`
        : "Your CMG portal invitation",
    element: (payload: InvitePayload) => <InviteEmail {...payload} />,
  },
  claim_status_update: {
    subject: (payload: ClaimStatusUpdatePayload) =>
      `${payload.claimRef} — ${payload.statusLabel}`,
    element: (payload: ClaimStatusUpdatePayload) => <ClaimStatusUpdate {...payload} />,
  },
  lor_signed: {
    subject: (payload: LorSignedPayload) =>
      `Your Letter of Representation is signed — ${payload.claimRef}`,
    element: (payload: LorSignedPayload) => <LorSigned {...payload} />,
  },
  esign_staff_alert: {
    subject: (payload: ESignStaffAlertPayload) =>
      `${payload.claimRef} — ${payload.headline}`,
    element: (payload: ESignStaffAlertPayload) => <ESignStaffAlert {...payload} />,
  },
} as Record<NotificationTemplate, Renderer>;

export function isNotificationTemplate(value: string): value is NotificationTemplate {
  return Object.hasOwn(TEMPLATES, value);
}

export async function renderNotification(
  message: NotificationMessage,
): Promise<{ subject: string; html: string; text: string }> {
  const renderer = TEMPLATES[message.template];
  const element = (renderer.element as (payload: unknown) => ReactElement)(
    message.payload,
  );

  const [html, text] = await Promise.all([
    render(element),
    render(element, { plainText: true }),
  ]);

  return {
    subject: (renderer.subject as (payload: unknown) => string)(message.payload),
    html,
    text,
  };
}
