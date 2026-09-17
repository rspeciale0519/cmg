import { describe, expect, it } from "vitest";
import {
  isNotificationTemplate,
  NOTIFICATION_TEMPLATES,
  renderNotification,
} from "./render";

const intakeStaffPayload = {
  claimRef: "CMG-2026-0042",
  homeownerName: "Dana Whitfield",
  email: "dana@example.com",
  phone: "407-555-0119",
  propertyAddress: "1420 Palmetto Row, Orlando, Florida 32801",
  carrier: "Citizens Property Insurance",
  policyNumber: "FL-88213-A",
  claimNumber: "CLM-771",
  lossDate: "2026-07-14",
  lossTime: "16:30",
  cause: "Wind / hail",
  description: "Roof damage with leaks inside the home.",
  secondPolicyholder: "Marcus Whitfield (marcus@example.com)",
  requestedAdjuster: "Austin Graham",
  referrer: "Palmetto Roofing — Joel Reyes",
  referrerEmail: "joel@palmettoroofing.example",
  documentCount: 2,
};

describe("renderNotification", () => {
  it("renders separate contractor details without an invented loss time", async () => {
    const { text } = await renderNotification({ template: "intake_staff_alert", payload: {
      ...intakeStaffPayload, lossTime: undefined,
      contractorName: "Test Contractor", contractorCompany: "Test Roofing",
      contractorPhone: "4075550101", contractorEmail: "contractor@example.com",
    } });
    expect(text).toContain("Test Contractor");
    expect(text).toContain("Test Roofing");
    expect(text).toContain("contractor@example.com");
    expect(text).toContain("dana@example.com");
    expect(text).not.toContain("undefined");
    expect(text).not.toContain("16:30");
  });

  it("renders the staff intake alert", async () => {
    const { subject, html, text } = await renderNotification({
      template: "intake_staff_alert",
      payload: intakeStaffPayload,
    });

    expect(subject).toBe("New intake CMG-2026-0042 — Dana Whitfield");
    expect(html).toContain("<!DOCTYPE html");
    expect(html).toContain("CMG-2026-0042");
    expect(html).toContain("Citizens Property Insurance");
    expect(html).toContain("Marcus Whitfield");
    expect(html).toContain("2 files uploaded");
    expect(text).toContain("Dana Whitfield");
  });

  it("omits the optional rows the staff alert was not given", async () => {
    const { html } = await renderNotification({
      template: "intake_staff_alert",
      payload: {
        ...intakeStaffPayload,
        claimNumber: undefined,
        secondPolicyholder: undefined,
        referrer: undefined,
        referrerEmail: undefined,
        documentCount: 1,
      },
    });

    expect(html).not.toContain("Second on policy");
    expect(html).not.toContain("Referred by");
    expect(html).toContain("1 file uploaded");
  });

  it("renders the homeowner intake confirmation and addresses them by first name", async () => {
    const { subject, html, text } = await renderNotification({
      template: "intake_confirmation",
      payload: {
        firstName: "Dana",
        claimRef: "CMG-2026-0042",
        propertyAddress: "1420 Palmetto Row, Orlando, Florida 32801",
      },
    });

    expect(subject).toBe("We have your claim intake — CMG-2026-0042");
    /* Asserted against the plain-text render: React's server renderer splits
       adjacent text nodes with `<!-- -->`, so prose continuity is only
       observable there. */
    expect(text).toContain("Hi Dana");
    expect(text).not.toContain("Whitfield");
    expect(html).toContain("CMG-2026-0042");
  });

  it("renders the staff lead alert", async () => {
    const { subject, html } = await renderNotification({
      template: "lead_staff_alert",
      payload: {
        name: "Dana Whitfield",
        phone: "407-555-0119",
        email: "dana@example.com",
        message: "Ceiling staining after the storm.",
        submittedAt: "2026-08-09T14:02:00.000Z",
      },
    });

    expect(subject).toBe("New review request — Dana Whitfield");
    expect(html).toContain("407-555-0119");
    expect(html).toContain("Ceiling staining after the storm.");
  });

  it("says so plainly when a lead left no detail", async () => {
    const { html } = await renderNotification({
      template: "lead_staff_alert",
      payload: {
        name: "Dana Whitfield",
        phone: "407-555-0119",
        submittedAt: "2026-08-09T14:02:00.000Z",
      },
    });

    expect(html).toContain("No detail given on the form.");
  });

  it("renders the lead auto-reply", async () => {
    const { subject, html, text } = await renderNotification({
      template: "lead_auto_reply",
      payload: { firstName: "Dana" },
    });

    expect(subject).toBe("We have your request — CMG Property Solutions");
    expect(text).toContain("Hi Dana");
    expect(text).toContain("one business day");
    expect(html).toContain("An adjuster will call you.");
  });

  it("renders the settled notice with the figure when one is recorded", async () => {
    const { subject, html, text } = await renderNotification({
      template: "settled_notice",
      payload: {
        firstName: "Dana",
        claimRef: "CMG-2026-0042",
        settlementAmount: "$48,200.00",
        portalUrl: "https://example.test/portal",
      },
    });

    expect(subject).toBe("CMG-2026-0042 has settled.");
    expect(text).toContain("Hi Dana");
    expect(html).toContain("$48,200.00");
    expect(html).toContain("Settlement");
  });

  it("omits the settlement row entirely when no figure is on the file", async () => {
    const { html } = await renderNotification({
      template: "settled_notice",
      payload: {
        firstName: "Dana",
        claimRef: "CMG-2026-0042",
        portalUrl: "https://example.test/portal",
      },
    });

    // A blank or a $0.00 beside the word "settled" would be worse than silence.
    expect(html).not.toContain("Settlement");
    expect(html).toContain("CMG-2026-0042");
  });

  /**
   * `referClaim` writes a claim and, before this phase, told nobody — a referral's
   * only arrival signal was a number on a queue somebody had to think to open.
   * The template states the gap in the record rather than rendering it as blanks:
   * a rep is never asked for the carrier or the policy number, so an empty row
   * would read as data that failed to load.
   */
  it("names what a referral does not carry instead of showing it as blank", async () => {
    const { subject, html } = await renderNotification({
      template: "referral_staff_alert",
      payload: {
        claimRef: "CMG-2026-0042",
        companyName: "Palmetto Roofing",
        referrerName: "Palmetto Roofing — Joel Reyes",
        referrerEmail: "joel@palmettoroofing.example",
        homeownerName: "Dana Whitfield",
        homeownerEmail: "dana@example.com",
        homeownerPhone: "407-555-0119",
        propertyAddress: "1420 Palmetto Row, Orlando, Florida 32801",
        lossDate: "2026-07-14",
        cause: "Wind / hail",
        description: "Ridge cap gone, water in the hallway.",
      },
    });

    expect(subject).toBe("New referral CMG-2026-0042 — Palmetto Roofing");
    expect(html).toContain("Not supplied");
    expect(html).toContain("Palmetto Roofing — Joel Reyes");
    expect(html).toContain("407-555-0119");
  });

  it("says to call the company when the rep's session carries no address", async () => {
    const { html } = await renderNotification({
      template: "referral_staff_alert",
      payload: {
        claimRef: "CMG-2026-0042",
        companyName: "Palmetto Roofing",
        referrerName: "Palmetto Roofing",
        homeownerName: "Dana Whitfield",
        homeownerEmail: "dana@example.com",
        homeownerPhone: "407-555-0119",
        propertyAddress: "Orlando",
        lossDate: "2026-07-14",
        cause: "Wind / hail",
        description: "Roof damage.",
      },
    });

    expect(html).toContain("not on file — call the company");
  });

  it("renders the staff question alert and quotes the question in full", async () => {
    const question =
      "The adjuster mentioned a supplement for the soffits — is that already in the estimate you filed?";

    const { subject, html } = await renderNotification({
      template: "question_staff_alert",
      payload: {
        claimRef: "CMG-2026-0042",
        homeownerName: "Dana Whitfield",
        question,
        assignedTo: "Austin Graham",
        claimUrl: "https://example.test/admin/claims/abc",
      },
    });

    expect(subject).toBe("Question on CMG-2026-0042 — Dana Whitfield");
    expect(html).toContain("Austin Graham");
    expect(html).toContain("soffits");
  });

  it("says nobody is assigned rather than leaving the row blank", async () => {
    const { html } = await renderNotification({
      template: "question_staff_alert",
      payload: {
        claimRef: "CMG-2026-0042",
        homeownerName: "Dana Whitfield",
        question: "Any news?",
        claimUrl: "https://example.test/admin/claims/abc",
      },
    });

    expect(html).toContain("Nobody yet");
  });

  it("renders the customer reply notice with the entry quoted", async () => {
    const { subject, html, text } = await renderNotification({
      template: "reply_posted",
      payload: {
        firstName: "Dana",
        claimRef: "CMG-2026-0042",
        body: "The carrier acknowledged receipt this morning.",
        portalUrl: "https://example.test/portal",
      },
    });

    expect(subject).toBe("New note on CMG-2026-0042");
    expect(text).toContain("Hi Dana");
    expect(html).toContain("The carrier acknowledged receipt this morning.");
  });

  /**
   * The partner template is the one with a disclosure rule attached, so the rule
   * is asserted rather than left to the reviewer. A referring contractor's inbox
   * is not an access-control boundary: the address, the money and the dates live
   * behind the portal link, where the policy still applies.
   */
  it("tells a referring partner what moved and nothing more", async () => {
    const { subject, html } = await renderNotification({
      template: "partner_status_update",
      payload: {
        companyName: "Palmetto Roofing",
        claimRef: "CMG-2026-0042",
        homeownerName: "Dana Whitfield",
        statusLabel: "Filed",
        partnerUrl: "https://example.test/partner",
      },
    });

    expect(subject).toBe("Referral update — CMG-2026-0042");
    expect(html).toContain("Palmetto Roofing");
    expect(html).toContain("Filed");
    expect(html).toContain("https://example.test/partner");

    // The homeowner's name stays out of a subject line that a shared inbox indexes.
    expect(subject).not.toContain("Whitfield");
  });

  it("every template carries the CMG identification and a reason line", async () => {
    const messages = [
      { template: "intake_staff_alert" as const, payload: intakeStaffPayload },
      {
        template: "intake_confirmation" as const,
        payload: { firstName: "Dana", claimRef: "CMG-2026-0042", propertyAddress: "Orlando" },
      },
      {
        template: "lead_staff_alert" as const,
        payload: { name: "Dana", phone: "407-555-0119", submittedAt: "now" },
      },
      { template: "lead_auto_reply" as const, payload: { firstName: "Dana" } },
      {
        template: "claim_status_update" as const,
        payload: {
          firstName: "Dana",
          claimRef: "CMG-2026-0042",
          statusLabel: "Filed",
          statusMeaning: "Submitted to the carrier.",
          portalUrl: "https://example.test/portal",
        },
      },
      {
        template: "settled_notice" as const,
        payload: {
          firstName: "Dana",
          claimRef: "CMG-2026-0042",
          portalUrl: "https://example.test/portal",
        },
      },
      {
        template: "partner_status_update" as const,
        payload: {
          companyName: "Palmetto Roofing",
          claimRef: "CMG-2026-0042",
          homeownerName: "Dana Whitfield",
          statusLabel: "Filed",
          partnerUrl: "https://example.test/partner",
        },
      },
      {
        template: "referral_staff_alert" as const,
        payload: {
          claimRef: "CMG-2026-0042",
          companyName: "Palmetto Roofing",
          referrerName: "Palmetto Roofing — Joel Reyes",
          referrerEmail: "joel@palmettoroofing.example",
          homeownerName: "Dana Whitfield",
          homeownerEmail: "dana@example.com",
          homeownerPhone: "407-555-0119",
          propertyAddress: "1420 Palmetto Row, Orlando, Florida 32801",
          lossDate: "2026-07-14",
          cause: "Wind / hail",
          description: "Ridge cap gone, water in the hallway.",
        },
      },
      {
        template: "question_staff_alert" as const,
        payload: {
          claimRef: "CMG-2026-0042",
          homeownerName: "Dana Whitfield",
          question: "Any news?",
          claimUrl: "https://example.test/admin/claims/abc",
        },
      },
      {
        template: "reply_posted" as const,
        payload: {
          firstName: "Dana",
          claimRef: "CMG-2026-0042",
          body: "Filed this morning.",
          portalUrl: "https://example.test/portal",
        },
      },
      {
        template: "lor_signed" as const,
        payload: { firstName: "Dana", claimRef: "CMG-2026-0042" },
      },
      {
        template: "esign_staff_alert" as const,
        payload: {
          claimRef: "CMG-2026-0042",
          headline: "Both signers have completed.",
          detail: "Signed copy stored against the claim.",
        },
      },
      {
        template: "invite" as const,
        payload: {
          firstName: "Dana",
          inviteUrl: "https://example.test/invite/abc",
          audience: "customer" as const,
          claimRef: "CMG-2026-0042",
          expiresInHours: 168,
        },
      },
    ];

    /* Spec §6: "Transactional only; footer identifies CMG + reason." Asserted
       against the registry and not against this list, because a template added
       without a reason line would otherwise pass simply by not being listed
       here — the failure mode is an omission, so the test has to notice one. */
    expect(messages.map((message) => message.template).sort()).toEqual(
      [...NOTIFICATION_TEMPLATES].sort(),
    );

    for (const message of messages) {
      const { html, text } = await renderNotification(message);
      expect(html, message.template).toContain("CMG Property Solutions");
      expect(text, message.template).toContain("License # G086165");
      expect(text, message.template).toMatch(
        /Sent (to the CMG staff inbox |to your company )?because/,
      );
    }
  });
});

describe("isNotificationTemplate", () => {
  it("recognises the four public-form templates", () => {
    for (const name of [
      "intake_staff_alert",
      "intake_confirmation",
      "lead_staff_alert",
      "lead_auto_reply",
    ]) {
      expect(isNotificationTemplate(name)).toBe(true);
    }
  });

  it("rejects anything else", () => {
    expect(isNotificationTemplate("drop_table")).toBe(false);
    expect(isNotificationTemplate("toString")).toBe(false);
  });

  it.each(["drop_table", "toString", "constructor", "__proto__"])(
    "refuses the untrusted runtime template name %s before renderer lookup",
    async (template) => {
      await expect(
        renderNotification({ template, payload: {} } as never),
      ).rejects.toThrow("Unknown notification template");
    },
  );
});
