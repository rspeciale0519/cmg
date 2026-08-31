import { describe, expect, it } from "vitest";
import {
  actorNameFromEvent,
  asUuid,
  claimIdFromEvent,
  creationErrorFromEvent,
  documentIdFromEvent,
  documentStatusFromEvent,
  parseWebhookEvents,
  payloadSummary,
} from "./payload";

const CLAIM_ID = "6f1d9a2c-5b41-4c0e-9a33-7f2b8d1c4e55";

const event = (overrides: Record<string, unknown> = {}) => ({
  event: "document_state_changed",
  data: {
    id: "doc-abc",
    status: "document.completed",
    metadata: { claim_id: CLAIM_ID },
    ...overrides,
  },
});

describe("parseWebhookEvents", () => {
  it("reads the documented array shape", () => {
    const events = parseWebhookEvents(JSON.stringify([event()]));
    expect(events).toHaveLength(1);
    expect(events?.[0].event).toBe("document_state_changed");
  });

  it("returns null for a body that is not JSON", () => {
    expect(parseWebhookEvents("<html>nope</html>")).toBeNull();
    expect(parseWebhookEvents("")).toBeNull();
    expect(parseWebhookEvents("{ truncated")).toBeNull();
  });

  it("returns null for JSON that is not an array", () => {
    expect(parseWebhookEvents(JSON.stringify(event()))).toBeNull();
    expect(parseWebhookEvents("null")).toBeNull();
    expect(parseWebhookEvents('"a string"')).toBeNull();
  });

  it("drops array entries that are not events, keeping the rest", () => {
    const events = parseWebhookEvents(
      JSON.stringify([null, 7, "x", { data: {} }, { event: "" }, event()]),
    );
    expect(events).toHaveLength(1);
  });

  it("tolerates an event with no data at all", () => {
    const events = parseWebhookEvents(JSON.stringify([{ event: "document_updated" }]));
    expect(events?.[0].data).toEqual({});
    expect(claimIdFromEvent(events![0])).toBeNull();
    expect(documentIdFromEvent(events![0])).toBeNull();
    expect(documentStatusFromEvent(events![0])).toBeNull();
  });
});

describe("field readers", () => {
  it("requires an exact UUID without trailing line terminators", () => {
    expect(asUuid(CLAIM_ID)).toBe(CLAIM_ID);
    expect(asUuid(CLAIM_ID.toUpperCase())).toBe(CLAIM_ID.toUpperCase());
    for (const suffix of ["\n", "\r", "\r\n", "\u2028", "\u2029", " "]) {
      expect(asUuid(`${CLAIM_ID}${suffix}`)).toBeNull();
    }
  });

  it("takes claim_id from metadata only when it is a uuid", () => {
    expect(claimIdFromEvent(event())).toBe(CLAIM_ID);
    expect(claimIdFromEvent(event({ metadata: { claim_id: "not-a-uuid" } }))).toBeNull();
    expect(claimIdFromEvent(event({ metadata: { claim_id: 42 } }))).toBeNull();
    expect(claimIdFromEvent(event({ metadata: "nope" }))).toBeNull();
  });

  it("names the signer from action_by, falling back to email then a placeholder", () => {
    expect(actorNameFromEvent(event({ action_by: { first_name: "Dana", last_name: "Roe" } }))).toBe(
      "Dana Roe",
    );
    expect(actorNameFromEvent(event({ action_by: { email: "dana@example.com" } }))).toBe(
      "dana@example.com",
    );
    expect(actorNameFromEvent(event())).toBe("A signer");
    expect(actorNameFromEvent(event({ action_by: [] }))).toBe("A signer");
  });

  it("reads a creation error from any of the shapes PandaDoc uses", () => {
    expect(creationErrorFromEvent(event({ error: { detail: "Role missing" } }))).toBe(
      "Role missing",
    );
    expect(creationErrorFromEvent(event({ error: { type: "validation_error" } }))).toBe(
      "validation_error",
    );
    expect(creationErrorFromEvent(event({ error: "plain string" }))).toBe("plain string");
    expect(creationErrorFromEvent(event())).toBeNull();
  });
});

describe("payloadSummary", () => {
  it("summarises without carrying the whole payload", () => {
    const events = parseWebhookEvents(JSON.stringify([event(), event()]))!;
    const summary = payloadSummary(events);

    expect(summary.count).toBe(2);
    expect(summary.events).toEqual([
      {
        event: "document_state_changed",
        document_id: "doc-abc",
        status: "document.completed",
        claim_id: CLAIM_ID,
      },
      {
        event: "document_state_changed",
        document_id: "doc-abc",
        status: "document.completed",
        claim_id: CLAIM_ID,
      },
    ]);
  });

  it("caps the per-event detail at ten entries", () => {
    const events = parseWebhookEvents(
      JSON.stringify(Array.from({ length: 25 }, () => event())),
    )!;
    const summary = payloadSummary(events);

    expect(summary.count).toBe(25);
    expect(summary.events).toHaveLength(10);
  });
});
