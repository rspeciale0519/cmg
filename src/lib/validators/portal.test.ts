import { describe, expect, it } from "vitest";
import {
  passwordChangeSchema,
  profileSchema,
  questionSchema,
  QUESTION_MAX_LENGTH,
} from "./portal";

describe("questionSchema", () => {
  it("refuses a question that is only whitespace", () => {
    // `claim_events_body_not_blank` refuses it in the database too; this is the
    // half that produces a sentence rather than a 500.
    const result = questionSchema.safeParse({ body: "   \n  " });
    expect(result.success).toBe(false);
  });

  it("trims before measuring, so padding cannot buy length", () => {
    const result = questionSchema.safeParse({ body: "  When is the inspection?  " });
    expect(result.success).toBe(true);
    expect(result.success && result.data.body).toBe("When is the inspection?");
  });

  it("refuses a body past the limit the feed can hold", () => {
    const result = questionSchema.safeParse({ body: "x".repeat(QUESTION_MAX_LENGTH + 1) });
    expect(result.success).toBe(false);
  });

  it("accepts a body exactly at the limit", () => {
    const result = questionSchema.safeParse({ body: "x".repeat(QUESTION_MAX_LENGTH) });
    expect(result.success).toBe(true);
  });
});

describe("profileSchema", () => {
  const valid = { firstName: "Marcus", lastName: "Bell", phone: "407-555-0188" };

  it("accepts a normal set of details", () => {
    expect(profileSchema.safeParse(valid).success).toBe(true);
  });

  it("turns an empty phone into null rather than an empty string", () => {
    // `profiles.phone` is nullable, and a person who would rather be reached by
    // email only is entitled to clear it. An empty string would be a stored
    // value that renders as a blank phone number.
    const result = profileSchema.safeParse({ ...valid, phone: "" });
    expect(result.success).toBe(true);
    expect(result.success && result.data.phone).toBeNull();
  });

  it("refuses a phone number too short to be one", () => {
    expect(profileSchema.safeParse({ ...valid, phone: "555" }).success).toBe(false);
  });

  it("accepts a phone number however it is punctuated", () => {
    for (const phone of ["(407) 555-0188", "+1 407 555 0188", "407.555.0188"]) {
      expect(profileSchema.safeParse({ ...valid, phone }).success, phone).toBe(true);
    }
  });

  it("requires both names", () => {
    expect(profileSchema.safeParse({ ...valid, firstName: "  " }).success).toBe(false);
    expect(profileSchema.safeParse({ ...valid, lastName: "" }).success).toBe(false);
  });
});

describe("passwordChangeSchema", () => {
  const schema = passwordChangeSchema("customer@cmg.test");

  it("accepts a strong new password", () => {
    const result = schema.safeParse({
      currentPassword: "CmgDev!2026",
      newPassword: "Rooftop!Quiet7Maple",
      confirmPassword: "Rooftop!Quiet7Maple",
    });
    expect(result.success).toBe(true);
  });

  it("refuses a new password that does not match its confirmation", () => {
    const result = schema.safeParse({
      currentPassword: "CmgDev!2026",
      newPassword: "Rooftop!Quiet7Maple",
      confirmPassword: "Rooftop!Quiet7Mapl",
    });
    expect(result.success).toBe(false);
    expect(
      !result.success &&
        result.error.issues.some((issue) => issue.path[0] === "confirmPassword"),
    ).toBe(true);
  });

  it("refuses a new password identical to the current one", () => {
    const result = schema.safeParse({
      currentPassword: "Rooftop!Quiet7Maple",
      newPassword: "Rooftop!Quiet7Maple",
      confirmPassword: "Rooftop!Quiet7Maple",
    });
    expect(result.success).toBe(false);
    expect(
      !result.success &&
        result.error.issues.some((issue) => issue.path[0] === "newPassword"),
    ).toBe(true);
  });

  it("refuses a password built from the address it signs in with", () => {
    const result = schema.safeParse({
      currentPassword: "CmgDev!2026",
      newPassword: "Customer9Roof!x",
      confirmPassword: "Customer9Roof!x",
    });
    expect(result.success).toBe(false);
  });

  it("requires the current password to be supplied at all", () => {
    // Without it, a borrowed laptop with the portal open is a permanent account
    // takeover: `auth.updateUser({ password })` needs only a session.
    const result = schema.safeParse({
      currentPassword: "",
      newPassword: "Rooftop!Quiet7Maple",
      confirmPassword: "Rooftop!Quiet7Maple",
    });
    expect(result.success).toBe(false);
    expect(
      !result.success &&
        result.error.issues.some((issue) => issue.path[0] === "currentPassword"),
    ).toBe(true);
  });

  it("applies the same strength rules the first password had to meet", () => {
    const result = schema.safeParse({
      currentPassword: "CmgDev!2026",
      newPassword: "password123",
      confirmPassword: "password123",
    });
    expect(result.success).toBe(false);
  });
});
