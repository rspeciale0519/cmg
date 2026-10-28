import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import PartnerError from "./error";

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

it("requests fresh server data when the vendor retries a failed page", () => {
  vi.spyOn(console, "error").mockImplementation(() => {});
  const retry = vi.fn();
  const reset = vi.fn();
  const props = {
    error: Object.assign(new Error("private database detail"), {
      digest: "test-reference",
    }),
    retry,
    reset,
  };
  render(<PartnerError {...props} />);

  fireEvent.click(screen.getByRole("button", { name: "Try again" }));

  expect(retry).toHaveBeenCalledOnce();
  expect(reset).not.toHaveBeenCalled();
  expect(screen.queryByText("private database detail")).toBeNull();
  expect(screen.getByText("test-reference")).toBeTruthy();
  expect(
    screen
      .getByRole("link", { name: "Back to your referred claims" })
      .getAttribute("href"),
  ).toBe("/partner");
});

it("omits the support reference when the vendor error has no digest", () => {
  vi.spyOn(console, "error").mockImplementation(() => {});
  const props = {
    error: new Error("private client detail"),
    retry: vi.fn(),
    reset: vi.fn(),
  };
  render(<PartnerError {...props} />);

  expect(screen.getByRole("heading", { level: 1 })).toBeTruthy();
  expect(screen.queryByText("private client detail")).toBeNull();
  expect(screen.queryByText(/If you call us, quote this:/)).toBeNull();
});
