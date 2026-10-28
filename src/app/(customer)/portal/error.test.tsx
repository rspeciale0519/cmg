import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import PortalError from "./error";

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

it("requests fresh server data when the homeowner retries a failed page", () => {
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
  render(<PortalError {...props} />);

  fireEvent.click(screen.getByRole("button", { name: "Try again" }));

  expect(retry).toHaveBeenCalledOnce();
  expect(reset).not.toHaveBeenCalled();
  expect(screen.queryByText("private database detail")).toBeNull();
  expect(screen.getByText("test-reference")).toBeTruthy();
  expect(
    screen.getByRole("link", { name: "Back to your claims" }).getAttribute("href"),
  ).toBe("/portal");
});

it("omits the support reference when the homeowner error has no digest", () => {
  vi.spyOn(console, "error").mockImplementation(() => {});
  const props = {
    error: new Error("private client detail"),
    retry: vi.fn(),
    reset: vi.fn(),
  };
  render(<PortalError {...props} />);

  expect(screen.getByRole("heading", { level: 1 })).toBeTruthy();
  expect(screen.queryByText("private client detail")).toBeNull();
  expect(screen.queryByText(/If you call us, quote this:/)).toBeNull();
});
