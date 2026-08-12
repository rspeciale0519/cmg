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
  SettledNotice,
  type ClaimStatusUpdatePayload,
  type SettledNoticePayload,
} from "./templates/claim-status";
import {
  PartnerStatusUpdate,
  ReferralStaffAlert,
  type PartnerStatusUpdatePayload,
  type ReferralStaffAlertPayload,
} from "./templates/partner";
import {
  QuestionStaffAlert,
  ReplyPosted,
  type QuestionStaffAlertPayload,
  type ReplyPostedPayload,
} from "./templates/thread";
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
  | { template: "settled_notice"; payload: SettledNoticePayload }
  | { template: "partner_status_update"; payload: PartnerStatusUpdatePayload }
  | { template: "referral_staff_alert"; payload: ReferralStaffAlertPayload }
  | { template: "question_staff_alert"; payload: QuestionStaffAlertPayload }
  | { template: "reply_posted"; payload: ReplyPostedPayload }
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
  settled_notice: {
    subject: (payload: SettledNoticePayload) => `${payload.claimRef} has settled.`,
    element: (payload: SettledNoticePayload) => <SettledNotice {...payload} />,
  },
  partner_status_update: {
    /* The referring company's own reference is the claim ref, and the subject
       carries nothing else. A contractor's inbox is shared and searchable by
       whoever holds it, so the homeowner's name stays inside the message. */
    subject: (payload: PartnerStatusUpdatePayload) =>
      `Referral update — ${payload.claimRef}`,
    element: (payload: PartnerStatusUpdatePayload) => <PartnerStatusUpdate {...payload} />,
  },
  referral_staff_alert: {
    subject: (payload: ReferralStaffAlertPayload) =>
      `New referral ${payload.claimRef} — ${payload.companyName}`,
    element: (payload: ReferralStaffAlertPayload) => <ReferralStaffAlert {...payload} />,
  },
  question_staff_alert: {
    subject: (payload: QuestionStaffAlertPayload) =>
      `Question on ${payload.claimRef} — ${payload.homeownerName}`,
    element: (payload: QuestionStaffAlertPayload) => <QuestionStaffAlert {...payload} />,
  },
  reply_posted: {
    subject: (payload: ReplyPostedPayload) => `New note on ${payload.claimRef}`,
    element: (payload: ReplyPostedPayload) => <ReplyPosted {...payload} />,
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

/**
 * Every registered template name. Exported so `render.test.tsx` can assert that
 * its footer guarantee — spec §6's "footer identifies CMG + reason" — covers the
 * whole registry rather than the subset a test author remembered to list.
 */
export const NOTIFICATION_TEMPLATES = Object.keys(TEMPLATES) as NotificationTemplate[];

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
