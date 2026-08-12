import { describe, expect, it } from "vitest";
import { CAUSE_OPTIONS } from "./intake-options";
import { REFERRAL_FIELDS, referralSchema } from "./referral";

/**
 * The referral is the intake's shape with a different actor, so most of what
 * this schema does is already pinned by `intake.test.ts`. What is only pinned
 * here is the *difference*: which fields exist at all, and that the date bound
 * the public form got wrong once is the same bound on this one.
 */

const valid = {
  firstName: "Dana",
  lastName: "Whitfield",
  email: "dana@example.com",
  phone: "407-555-0119",
  street: "1420 Palmetto Row",
  street2: "",
  city: "Orlando",
  state: "Florida",
  zip: "32801",
  lossDate: "2026-07-14",
  cause: "wind_hail",
  description: "South slope stripped, and the ceiling in the back bedroom is wet.",
  turnstileToken: "test-token",
};

const errorFor = (input: Record<string, unknown>, field: string) => {
  const result = referralSchema.safeParse(input);
  expect(result.success).toBe(false);
  if (result.success) return undefined;
  return result.error.issues.find((issue) => issue.path[0] === field);
};

/** Today in Florida, which is what the schema compares against. */
const businessToday = () =>
  new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/New_York",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());

const shift = (days: number) => {
  const [year, month, day] = businessToday().split("-").map(Number);
  const at = new Date(Date.UTC(year, month - 1, day + days));
  return at.toISOString().slice(0, 10);
};

describe("referralSchema — a complete referral", () => {
  it("accepts one", () => {
    expect(referralSchema.safeParse(valid).success).toBe(true);
  });

  it("treats an empty second address line as absent rather than as an empty string", () => {
    const result = referralSchema.safeParse(valid);
    expect(result.success).toBe(true);
    if (result.success) expect(result.data.street2).toBeUndefined();
  });

  it("keeps the second address line when there is one", () => {
    const result = referralSchema.safeParse({ ...valid, street2: "Unit 4" });
    expect(result.success).toBe(true);
    if (result.success) expect(result.data.street2).toBe("Unit 4");
  });
});

/**
 * The whole point of the referral form: a contractor is not asked for the policy
 * side, so a submission carrying nothing about it must still parse. If a
 * required carrier were ever added here, this is the test that fails.
 */
describe("referralSchema — what a rep is not asked", () => {
  it("has no carrier, policy number, carrier tenure, prior-claim or consent field", () => {
    const result = referralSchema.safeParse(valid);
    expect(result.success).toBe(true);
    if (!result.success) return;

    const keys = Object.keys(result.data);
    for (const absent of [
      "carrier",
      "policyNumber",
      "carrierTenure",
      "priorRoofClaim",
      "priorOutcome",
      "claimNumber",
      "consent",
      "initials",
      "lossTime",
    ]) {
      expect(keys).not.toContain(absent);
    }
  });

  it("refuses a submission with no verification token, so the challenge cannot be skipped by omission", () => {
    expect(errorFor({ ...valid, turnstileToken: "" }, "turnstileToken")).toBeDefined();
  });
});

describe("referralSchema — the homeowner", () => {
  it("names the homeowner in the message, not the person filling the form in", () => {
    expect(errorFor({ ...valid, firstName: "  " }, "firstName")?.message).toBe(
      "Homeowner's first name is required.",
    );
  });

  it("requires an email we can reach the homeowner on", () => {
    expect(errorFor({ ...valid, email: "dana@example" }, "email")).toBeDefined();
  });

  it("requires seven digits of phone number", () => {
    expect(errorFor({ ...valid, phone: "407-55" }, "phone")).toBeDefined();
  });
});

describe("referralSchema — the loss", () => {
  it("refuses a cause that is not one of the database's labels", () => {
    expect(errorFor({ ...valid, cause: "meteor" }, "cause")).toBeDefined();
  });

  it("accepts every cause the intake offers, so the two forms cannot drift apart", () => {
    for (const option of CAUSE_OPTIONS) {
      expect(referralSchema.safeParse({ ...valid, cause: option.value }).success).toBe(
        true,
      );
    }
  });

  /**
   * The bound this shares with the intake, and the reason it is shared. The
   * public form's version of this compared against `new Date().toISOString()`,
   * which between 8pm and midnight Eastern is already tomorrow — so for four
   * hours every evening it accepted a storm that had not happened. Both forms
   * now take the same `lossDate` from `./shared`; if a second copy is ever
   * introduced here, this is what catches it.
   */
  it("refuses a date of loss that is tomorrow in Florida", () => {
    expect(errorFor({ ...valid, lossDate: shift(1) }, "lossDate")?.message).toBe(
      "The date of loss cannot be in the future.",
    );
  });

  it("accepts a date of loss that is today in Florida", () => {
    expect(referralSchema.safeParse({ ...valid, lossDate: shift(0) }).success).toBe(true);
  });

  it("refuses a date before 1990", () => {
    expect(errorFor({ ...valid, lossDate: "1972-04-01" }, "lossDate")).toBeDefined();
  });

  it("refuses a date that is not a date", () => {
    expect(errorFor({ ...valid, lossDate: "14/07/2026" }, "lossDate")).toBeDefined();
  });

  it("asks for more than a word of description", () => {
    expect(errorFor({ ...valid, description: "hail" }, "description")?.message).toBe(
      "Tell us briefly what happened at the property.",
    );
  });
});

describe("referralSchema — the property", () => {
  it("refuses a state that is not in the union", () => {
    expect(errorFor({ ...valid, state: "Ontario" }, "state")).toBeDefined();
  });

  it("refuses a ZIP that is not five digits", () => {
    expect(errorFor({ ...valid, zip: "328" }, "zip")).toBeDefined();
  });

  it("accepts ZIP+4", () => {
    expect(referralSchema.safeParse({ ...valid, zip: "32801-1234" }).success).toBe(true);
  });
});

/**
 * `REFERRAL_FIELDS` is what a refusal hands back, and a field missing from it is
 * a field the rep retypes with nothing on screen to show why. Derived from the
 * schema rather than restated, so adding a field to the form cannot silently
 * leave it out of the echo.
 */
describe("REFERRAL_FIELDS", () => {
  it("names every string field on the form", () => {
    const shape = Object.keys(referralSchema.shape).filter(
      (key) => key !== "turnstileToken",
    );

    expect([...REFERRAL_FIELDS].sort()).toEqual(shape.sort());
  });

  it("does not name the verification token, which is minted per attempt and never re-seeded", () => {
    expect(REFERRAL_FIELDS).not.toContain("turnstileToken");
  });
});
