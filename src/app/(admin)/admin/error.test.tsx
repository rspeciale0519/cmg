import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import AdminError from "./error";

vi.mock("@/lib/actions/auth", () => ({ signOut: vi.fn() }));

afterEach(() => { cleanup(); vi.restoreAllMocks(); });

it("uses Next's server-data retry and keeps database errors out of the page", () => {
  vi.spyOn(console, "error").mockImplementation(() => {});
  const retry = vi.fn();
  const error = Object.assign(new Error("private database detail"), { digest: "test-reference" });
  render(<AdminError error={error} retry={retry} />);

  expect(screen.queryByText("private database detail")).toBeNull();
  expect(screen.getByText("test-reference")).toBeTruthy();
  fireEvent.click(screen.getByRole("button", { name: "Try again" }));
  expect(retry).toHaveBeenCalledOnce();
  expect(screen.getByRole("link", { name: "Back to the dashboard" }).getAttribute("href")).toBe("/admin");
});
