// @vitest-environment node
import { describe, expect, it } from "vitest";
import { unstable_getResponseFromNextConfig } from "next/experimental/testing/server";
import nextConfig from "../../../next.config";

describe("configured response privacy headers", () => {
  it.each([
    "/auth/confirm",
    "/auth/confirm?token_hash=synthetic-recovery-value&type=recovery",
  ])("does not disclose the recovery URL as a referrer: %s", async (path) => {
    const response = await unstable_getResponseFromNextConfig({
      url: `https://cmg.example.test${path}`,
      nextConfig,
    });

    expect(response.headers.get("referrer-policy")).toBe("no-referrer");
    expect(response.headers.get("strict-transport-security")).toContain("includeSubDomains");
    expect(response.headers.get("x-content-type-options")).toBe("nosniff");
    expect(response.headers.get("x-frame-options")).toBe("DENY");
  });

  it.each(["/", "/login", "/contact", "/file-a-claim", "/auth/confirm-other"])(
    "preserves the ordinary page policy: %s",
    async (path) => {
      const response = await unstable_getResponseFromNextConfig({
        url: `https://cmg.example.test${path}`,
        nextConfig,
      });

      expect(response.headers.get("referrer-policy")).toBe("strict-origin-when-cross-origin");
    },
  );
});
