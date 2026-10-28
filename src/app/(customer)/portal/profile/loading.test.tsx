import { cleanup, isInaccessible, render, screen } from "@testing-library/react";
import { afterEach, expect, it } from "vitest";
import ProfileLoading from "./loading";

afterEach(cleanup);

it("exposes the profile loading message to assistive technology", () => {
  render(<ProfileLoading />);

  const message = screen.getByText("Loading your account");
  expect(message.getAttribute("aria-live")).toBe("polite");
  expect(isInaccessible(message)).toBe(false);
});
