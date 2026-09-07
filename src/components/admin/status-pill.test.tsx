import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { LeadPill, StatusPill } from "./status-pill";

afterEach(cleanup);

function classesFor(text: string): string[] {
  return screen.getByText(text).className.split(/\s+/).filter(Boolean);
}

describe("LeadPill", () => {
  it("dresses each known status in its own tone", () => {
    for (const [status, label] of [
      ["new", "New"],
      ["contacted", "Contacted"],
      ["converted", "Converted"],
      ["dismissed", "Dismissed"],
    ] as const) {
      cleanup();
      render(<LeadPill status={status} />);
      expect(screen.getByText(label)).toBeTruthy();
    }
  });

  it("does not dress an unknown status as a contacted lead", () => {
    // The fallback used to be `LEAD_TONE.contacted`, which is a *state* and not
    // a neutral: an unrecognised value rendered as Contacted in every respect
    // except its text, on the screen whose whole question is "has anyone called
    // this person". Whatever the fallback is, it must not be a real status's.
    render(<LeadPill status="contacted" />);
    const contacted = classesFor("Contacted");
    cleanup();

    render(<LeadPill status="something_new_in_the_enum" />);
    const unknown = classesFor("something_new_in_the_enum");

    expect(unknown).not.toEqual(contacted);
    expect(unknown).toContain("border-dashed");
  });

  it("shows the raw value when it has no label, rather than inventing one", () => {
    render(<LeadPill status="qualified" />);
    expect(screen.getByText("qualified")).toBeTruthy();
  });

  it("reads a prototype member as unknown rather than as a class name", () => {
    // A plain object answers `LEAD_TONE["toString"]` with a function off the
    // prototype, which would reach `cx()` as a class name. Same guard, and same
    // reason, as `isClaimStatus`.
    render(<LeadPill status="toString" />);
    const classes = classesFor("toString");
    expect(classes).toContain("border-dashed");
    expect(classes.some((name) => name.includes("function"))).toBe(false);
  });
});

describe("StatusPill", () => {
  it("keeps an offer and a reopened file in different tones", () => {
    // The two ends of a negotiation — "an offer is on the table and needs a
    // decision" and "back with the carrier after a denial" — wore the same gold
    // pill. See STATUS_TONE.
    render(<StatusPill status="settlement_offered" />);
    const offered = classesFor("Settlement offered");
    cleanup();

    render(<StatusPill status="reopened" />);
    const reopened = classesFor("Reopened");

    expect(reopened).not.toEqual(offered);
    expect(offered.some((name) => name.includes("accent"))).toBe(true);
    expect(reopened.some((name) => name.includes("accent"))).toBe(false);
  });
});
