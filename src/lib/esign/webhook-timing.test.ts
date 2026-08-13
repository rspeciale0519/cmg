import { describe, expect, it } from "vitest";
import {
  WEBHOOK_LEASE_MARGIN_SECONDS,
  WEBHOOK_LEASE_SECONDS,
  WEBHOOK_PDF_DOWNLOAD_TIMEOUT_MS,
  WEBHOOK_ROUTE_MAX_DURATION_SECONDS,
  webhookTimingInvariant,
} from "./webhook-timing";

describe("webhook timing budget", () => {
  it("keeps the lease beyond the route kill with a recovery margin", () => {
    expect(webhookTimingInvariant()).toBe(true);
    expect(WEBHOOK_LEASE_SECONDS).toBeGreaterThanOrEqual(
      WEBHOOK_ROUTE_MAX_DURATION_SECONDS + WEBHOOK_LEASE_MARGIN_SECONDS,
    );
  });

  it("bounds PDF download before the route budget expires", () => {
    expect(WEBHOOK_PDF_DOWNLOAD_TIMEOUT_MS).toBeLessThan(
      WEBHOOK_ROUTE_MAX_DURATION_SECONDS * 1_000,
    );
  });
});
