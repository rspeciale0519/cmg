import { cleanup, render, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { TurnstileWidget } from "./turnstile";

type RenderWidget = (
  element: HTMLElement,
  options: { sitekey: string; size?: "normal" | "flexible" | "compact" },
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
  it("uses the compact widget at the mobile breakpoint", async () => {
    render(<TurnstileWidget />);

    await waitFor(() => expect(renderWidget).toHaveBeenCalled());
    expect(renderWidget.mock.calls[0][1]).toMatchObject({
      sitekey: "test-site-key",
      size: "compact",
    });
  });
});
