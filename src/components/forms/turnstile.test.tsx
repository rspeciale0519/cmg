import { act, cleanup, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { TurnstileWidget } from "./turnstile";

type RenderWidget = (
  element: HTMLElement,
  options: {
    sitekey: string;
    size?: "normal" | "flexible" | "compact";
    callback?: (token: string) => void;
    "error-callback"?: (code: string) => boolean;
  },
) => string;

const renderWidget = vi.fn<RenderWidget>(() => "widget-id");
const removeWidget = vi.fn();
const resetWidget = vi.fn();

beforeEach(() => {
  vi.stubEnv("NEXT_PUBLIC_TURNSTILE_SITE_KEY", "test-site-key");
  vi.stubGlobal("matchMedia", vi.fn(() => ({
    matches: true,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
  })));
  Object.defineProperty(window, "turnstile", {
    configurable: true,
    value: { render: renderWidget, remove: removeWidget, reset: resetWidget },
  });
});

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

describe("TurnstileWidget", () => {
  it("announces runtime failures and clears the message after recovery", async () => {
    render(<TurnstileWidget />);
    await waitFor(() => expect(renderWidget).toHaveBeenCalled());
    const [container, options] = renderWidget.mock.calls.at(-1)!;

    act(() => { options["error-callback"]?.("110200"); });
    expect(screen.getByRole("alert").textContent).toContain("Please reload the page");
    expect(container.isConnected).toBe(true);

    act(() => { options.callback?.("recovered-token"); });
    expect(screen.queryByRole("alert")).toBeNull();
    expect(container.isConnected).toBe(true);
  });

  it("ignores callbacks from a removed widget", async () => {
    const { unmount } = render(<TurnstileWidget />);
    await waitFor(() => expect(renderWidget).toHaveBeenCalled());
    const options = renderWidget.mock.calls.at(-1)![1];
    unmount();
    expect(removeWidget).toHaveBeenCalledWith("widget-id");
    act(() => {
      options["error-callback"]?.("110200");
      options.callback?.("late-token");
    });
    expect(screen.queryByRole("alert")).toBeNull();
  });

  it("uses the compact widget at the mobile breakpoint", async () => {
    render(<TurnstileWidget />);

    await waitFor(() => expect(renderWidget).toHaveBeenCalled());
    expect(renderWidget.mock.calls[0][1]).toMatchObject({
      sitekey: "test-site-key",
      size: "compact",
    });
  });
});
