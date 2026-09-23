import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/actions/claims", () => ({
  saveClaimFinancials: vi.fn(async () => ({ status: "success" })),
}));

import { FinancialsForm } from "./financials-form";

afterEach(cleanup);

const base = {
  claimId: "11111111-2222-4333-8444-555555555555",
  settlementAmount: null,
  notes: null,
  feeDefault: 10,
};

describe("FinancialsForm fee default", () => {
  it("starts an unconfigured claim at the application default", () => {
    render(<FinancialsForm {...base} feePercent={null} />);

    const input = screen.getByRole<HTMLInputElement>("textbox", {
      name: "Fee percent",
    });
    expect(input.value).toBe("10");
  });

  it("never replaces a fee already recorded on the claim", () => {
    render(<FinancialsForm {...base} feePercent={12.5} />);

    const input = screen.getByRole<HTMLInputElement>("textbox", {
      name: "Fee percent",
    });
    expect(input.value).toBe("12.5");
  });

  it("hints the application default, not a hard-coded figure, once cleared", () => {
    render(<FinancialsForm {...base} feeDefault={20} feePercent={null} />);

    const input = screen.getByRole<HTMLInputElement>("textbox", {
      name: "Fee percent",
    });
    expect(input.placeholder).toBe("20");
  });
});
