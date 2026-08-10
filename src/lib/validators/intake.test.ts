import { describe, expect, it } from "vitest";
import {
  ADJUSTER_OPTIONS,
  CARRIER_TENURE_OPTIONS,
  CAUSE_OPTIONS,
  intakeSchema,
  PRIOR_OUTCOME_OPTIONS,
} from "./intake";

const valid = {
  firstName: "Dana",
  lastName: "Whitfield",
  email: "dana@example.com",
  phone: "407-555-0119",
  initials: "dw",
  hasSecondPolicyholder: "no",
  secondFirstName: "",
  secondLastName: "",
  secondEmail: "",
  secondInitials: "",
  carrier: "Citizens Property Insurance",
  policyNumber: "FL-88213-A",
  carrierTenure: "three_plus_years",
  priorRoofClaim: "no",
  priorOutcome: "",
  claimNumber: "",
  lossDate: "2026-07-14",
  lossTime: "16:30",
  cause: "wind_hail",
  description: "Roof damage with leaks inside the home.",
  street: "1420 Palmetto Row",
  street2: "",
  city: "Orlando",
  state: "Florida",
  zip: "32801",
  requestedAdjuster: "austin-graham",
  referrerName: "",
  referrerEmail: "",
  consent: "on",
  turnstileToken: "test-token",
};

const errorFor = (input: Record<string, unknown>, field: string) => {
  const result = intakeSchema.safeParse(input);
  expect(result.success).toBe(false);
  if (result.success) return undefined;
  return result.error.issues.find((issue) => issue.path[0] === field);
};

describe("intakeSchema — option values match the database enums", () => {
  it("uses carrier_tenure labels", () => {
    expect(CARRIER_TENURE_OPTIONS.map((o) => o.value)).toEqual([
      "lt_1_year",
      "one_to_two_years",
      "three_plus_years",
    ]);
  });

  it("uses prior_claim_outcome labels", () => {
    expect(PRIOR_OUTCOME_OPTIONS.map((o) => o.value)).toEqual([
      "paid_nothing",
      "paid_no_repairs",
      "paid_repaired",
      "unsure",
    ]);
  });

  it("uses cause_of_loss labels", () => {
    expect(CAUSE_OPTIONS.map((o) => o.value)).toEqual([
      "wind",
      "hail",
      "wind_hail",
      "hurricane",
      "water",
      "fire_smoke",
      "flood",
      "mold",
      "other",
    ]);
  });

  it("offers the two adjuster choices from the prototype", () => {
    expect(ADJUSTER_OPTIONS.map((o) => o.label)).toEqual([
      "Austin Graham",
      "Not sure yet",
    ]);
  });
});

describe("intakeSchema — happy paths", () => {
  it("accepts a single-policyholder intake", () => {
    const result = intakeSchema.safeParse(valid);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.initials).toBe("DW");
      expect(result.data.consent).toBe(true);
      expect(result.data.priorOutcome).toBeUndefined();
      expect(result.data.claimNumber).toBeUndefined();
    }
  });

  it("accepts a two-policyholder intake", () => {
    const result = intakeSchema.safeParse({
      ...valid,
      hasSecondPolicyholder: "yes",
      secondFirstName: "Marcus",
      secondLastName: "Whitfield",
      secondEmail: "marcus@example.com",
      secondInitials: "MW",
    });
    expect(result.success).toBe(true);
  });

  it("accepts a prior roof claim with an outcome", () => {
    const result = intakeSchema.safeParse({
      ...valid,
      priorRoofClaim: "yes",
      priorOutcome: "paid_repaired",
    });
    expect(result.success).toBe(true);
    if (result.success) expect(result.data.priorOutcome).toBe("paid_repaired");
  });
});

describe("intakeSchema — homeowner branch", () => {
  it("rejects a missing first name", () => {
    expect(errorFor({ ...valid, firstName: "" }, "firstName")).toBeDefined();
  });

  it("rejects a malformed email", () => {
    expect(errorFor({ ...valid, email: "dana@" }, "email")).toBeDefined();
  });

  it("rejects a short phone number", () => {
    expect(errorFor({ ...valid, phone: "555" }, "phone")).toBeDefined();
  });

  it("rejects non-alphabetic initials", () => {
    expect(errorFor({ ...valid, initials: "D2" }, "initials")).toBeDefined();
  });
});

describe("intakeSchema — second policyholder branch", () => {
  const second = { ...valid, hasSecondPolicyholder: "yes" };

  it("requires every second-person field when yes", () => {
    const result = intakeSchema.safeParse(second);
    expect(result.success).toBe(false);
    if (result.success) return;
    const paths = result.error.issues.map((issue) => issue.path[0]);
    expect(paths).toContain("secondFirstName");
    expect(paths).toContain("secondLastName");
    expect(paths).toContain("secondEmail");
    expect(paths).toContain("secondInitials");
  });

  it("ignores second-person fields when no", () => {
    const result = intakeSchema.safeParse({
      ...valid,
      secondFirstName: "Marcus",
    });
    expect(result.success).toBe(true);
  });

  it("rejects a second policyholder reusing the first email", () => {
    expect(
      errorFor(
        {
          ...second,
          secondFirstName: "Marcus",
          secondLastName: "Whitfield",
          secondEmail: "DANA@example.com",
          secondInitials: "MW",
        },
        "secondEmail",
      ),
    ).toBeDefined();
  });

  it("rejects non-alphabetic second initials", () => {
    expect(
      errorFor(
        {
          ...second,
          secondFirstName: "Marcus",
          secondLastName: "Whitfield",
          secondEmail: "marcus@example.com",
          secondInitials: "M1",
        },
        "secondInitials",
      ),
    ).toBeDefined();
  });
});

describe("intakeSchema — policy branch", () => {
  it("rejects an unknown carrier tenure", () => {
    expect(errorFor({ ...valid, carrierTenure: "1-2" }, "carrierTenure")).toBeDefined();
  });

  it("requires a prior outcome when a prior roof claim is declared", () => {
    expect(
      errorFor({ ...valid, priorRoofClaim: "yes", priorOutcome: "" }, "priorOutcome"),
    ).toBeDefined();
  });

  it("rejects an unknown prior outcome", () => {
    expect(
      errorFor(
        { ...valid, priorRoofClaim: "yes", priorOutcome: "paid-nothing" },
        "priorOutcome",
      ),
    ).toBeDefined();
  });

  it("rejects a missing carrier", () => {
    expect(errorFor({ ...valid, carrier: "" }, "carrier")).toBeDefined();
  });
});

describe("intakeSchema — loss branch", () => {
  it("rejects a future date of loss", () => {
    const tomorrow = new Date(Date.now() + 2 * 86_400_000).toISOString().slice(0, 10);
    expect(errorFor({ ...valid, lossDate: tomorrow }, "lossDate")).toBeDefined();
  });

  it("rejects a date of loss before 1990", () => {
    expect(errorFor({ ...valid, lossDate: "1972-04-01" }, "lossDate")).toBeDefined();
  });

  it("rejects a malformed date", () => {
    expect(errorFor({ ...valid, lossDate: "14/07/2026" }, "lossDate")).toBeDefined();
  });

  it("rejects a malformed time", () => {
    expect(errorFor({ ...valid, lossTime: "25:00" }, "lossTime")).toBeDefined();
  });

  it("rejects an unknown cause", () => {
    expect(errorFor({ ...valid, cause: "fire" }, "cause")).toBeDefined();
  });

  it("rejects a description that says nothing", () => {
    expect(errorFor({ ...valid, description: "bad" }, "description")).toBeDefined();
  });
});

describe("intakeSchema — address branch", () => {
  it("rejects a missing street", () => {
    expect(errorFor({ ...valid, street: "" }, "street")).toBeDefined();
  });

  it("rejects a non-US state", () => {
    expect(errorFor({ ...valid, state: "Ontario" }, "state")).toBeDefined();
  });

  it("rejects a malformed ZIP", () => {
    expect(errorFor({ ...valid, zip: "3280" }, "zip")).toBeDefined();
  });

  it("accepts a ZIP+4", () => {
    expect(intakeSchema.safeParse({ ...valid, zip: "32801-1234" }).success).toBe(true);
  });
});

describe("intakeSchema — referral and consent", () => {
  it("rejects an unknown adjuster choice", () => {
    expect(errorFor({ ...valid, requestedAdjuster: "someone" }, "requestedAdjuster")).toBeDefined();
  });

  it("rejects a malformed referrer email", () => {
    expect(errorFor({ ...valid, referrerEmail: "rep@" }, "referrerEmail")).toBeDefined();
  });

  it("rejects an unchecked consent box", () => {
    expect(errorFor({ ...valid, consent: undefined }, "consent")).toBeDefined();
  });

  it("rejects a missing turnstile token", () => {
    expect(errorFor({ ...valid, turnstileToken: "" }, "turnstileToken")).toBeDefined();
  });
});

/* The cause, carrier-tenure and adjuster selects now start on an empty
   option rather than pre-answering themselves, so `""` is a value a real
   submission can carry and it has to be rejected with a message the field
   can show. */
describe("intakeSchema — selects that start empty", () => {
  it.each([
    ["cause", "Choose the cause of loss."],
    ["carrierTenure", "Tell us how long you have been with this carrier."],
    ["requestedAdjuster", "Choose which adjuster you are working with."],
  ])("rejects an unanswered %s", (field, message) => {
    const issue = errorFor({ ...valid, [field]: "" }, field);
    expect(issue).toBeDefined();
    expect(issue?.message).toBe(message);
  });

  it("rejects an unanswered prior outcome once a prior claim is declared", () => {
    const issue = errorFor(
      { ...valid, priorRoofClaim: "yes", priorOutcome: "" },
      "priorOutcome",
    );
    expect(issue?.message).toBe("Tell us the outcome of the prior roof claim.");
  });

  it("still accepts every real option value", () => {
    for (const option of CAUSE_OPTIONS) {
      expect(intakeSchema.safeParse({ ...valid, cause: option.value }).success).toBe(true);
    }
    for (const option of ADJUSTER_OPTIONS) {
      expect(
        intakeSchema.safeParse({ ...valid, requestedAdjuster: option.value }).success,
      ).toBe(true);
    }
  });
});
