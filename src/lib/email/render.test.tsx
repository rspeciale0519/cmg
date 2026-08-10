import { describe, expect, it } from "vitest";
import { isNotificationTemplate, renderNotification } from "./render";

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
    ];

    for (const message of messages) {
      const { html, text } = await renderNotification(message);
      expect(html).toContain("CMG Property Solutions");
      expect(text).toContain("License # G086165");
      expect(text).toMatch(/Sent (to the CMG staff inbox )?because/);
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
});
