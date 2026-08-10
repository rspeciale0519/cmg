import { render } from "@react-email/components";
import type { ReactElement } from "react";
import {
  IntakeConfirmation,
  IntakeStaffAlert,
  type IntakeConfirmationPayload,
  type IntakeStaffAlertPayload,
} from "./templates/intake";
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
  | { template: "lead_auto_reply"; payload: LeadAutoReplyPayload };

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
