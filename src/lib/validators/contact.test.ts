import { describe, expect, it } from "vitest";
import { contactSchema } from "./contact";

const valid = {
  name: "Dana Whitfield",
  phone: "407-555-0119",
  email: "dana@example.com",
  message: "Roof lost shingles in the storm and the ceiling is staining.",
  turnstileToken: "test-token",
};

const errorFor = (input: Record<string, unknown>, field: string) => {
  const result = contactSchema.safeParse(input);
  expect(result.success).toBe(false);
  if (result.success) return undefined;
  return result.error.issues.find((issue) => issue.path[0] === field);
};

describe("contactSchema", () => {
  it("accepts a complete submission", () => {
    const result = contactSchema.safeParse(valid);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.name).toBe("Dana Whitfield");
      expect(result.data.email).toBe("dana@example.com");
    }
  });

  it("accepts a submission with no email and no message", () => {
    const result = contactSchema.safeParse({
      ...valid,
      email: "",
      message: "",
    });

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.email).toBeUndefined();
      expect(result.data.message).toBeUndefined();
    }
  });

  it("trims surrounding whitespace", () => {
    const result = contactSchema.safeParse({ ...valid, name: "  Dana  " });
    expect(result.success && result.data.name).toBe("Dana");
  });

  it("rejects a missing name", () => {
    expect(errorFor({ ...valid, name: "   " }, "name")).toBeDefined();
  });

  it("rejects a phone number with fewer than seven digits", () => {
    expect(errorFor({ ...valid, phone: "40755" }, "phone")).toBeDefined();
  });

  it("accepts a phone number written with punctuation", () => {
    const result = contactSchema.safeParse({ ...valid, phone: "+1 (407) 555-0119" });
    expect(result.success).toBe(true);
  });

  it("rejects a malformed email when one is supplied", () => {
    expect(errorFor({ ...valid, email: "dana@" }, "email")).toBeDefined();
  });

  it("rejects a missing turnstile token", () => {
    expect(errorFor({ ...valid, turnstileToken: "" }, "turnstileToken")).toBeDefined();
  });

  it("rejects an over-long message", () => {
    expect(errorFor({ ...valid, message: "x".repeat(4001) }, "message")).toBeDefined();
  });
});
