import { render } from "@testing-library/react";
import { afterEach, beforeAll, describe, expect, it } from "vitest";
import { HeroVideoRotator } from "./hero-video-rotator";

type ConnectionStub = { saveData?: boolean } | undefined;

function stubEnvironment(reduceMotion: boolean, connection: ConnectionStub) {
  Object.defineProperty(window, "matchMedia", {
    writable: true,
    configurable: true,
    value: (query: string) => ({
      matches: query.includes("prefers-reduced-motion") ? reduceMotion : false,
      media: query,
      onchange: null,
      addEventListener: () => {},
      removeEventListener: () => {},
      addListener: () => {},
      removeListener: () => {},
      dispatchEvent: () => false,
    }),
  });
  Object.defineProperty(window.navigator, "connection", {
    writable: true,
    configurable: true,
    value: connection,
  });
}

beforeAll(() => {
  // jsdom has no media pipeline; play()/pause() are unimplemented there.
  Object.defineProperty(HTMLMediaElement.prototype, "play", {
    writable: true,
    configurable: true,
    value: () => Promise.resolve(),
  });
  Object.defineProperty(HTMLMediaElement.prototype, "pause", {
    writable: true,
    configurable: true,
    value: () => {},
  });
});

afterEach(() => {
  stubEnvironment(false, undefined);
});

describe("HeroVideoRotator", () => {
  it("renders nothing — and so fetches nothing — under prefers-reduced-motion", () => {
    stubEnvironment(true, undefined);
    const { container } = render(<HeroVideoRotator />);
    expect(container.querySelectorAll("video").length).toBe(0);
    expect(container.innerHTML).toBe("");
  });

  it("renders nothing when the connection asks to save data", () => {
    stubEnvironment(false, { saveData: true });
    const { container } = render(<HeroVideoRotator />);
    expect(container.querySelectorAll("video").length).toBe(0);
  });

  it("still plays when saveData is explicitly false", () => {
    stubEnvironment(false, { saveData: false });
    const { container } = render(<HeroVideoRotator />);
    expect(container.querySelectorAll("video").length).toBe(3);
  });

  it("mounts every clip decorative, muted and metadata-only", () => {
    stubEnvironment(false, undefined);
    const { container } = render(<HeroVideoRotator />);
    const videos = Array.from(container.querySelectorAll("video"));

    expect(videos.map((v) => v.getAttribute("src"))).toEqual([
      "/videos/storm-01.mp4",
      "/videos/storm-02.mp4",
      "/videos/storm-03.mp4",
    ]);

    for (const video of videos) {
      expect(video.muted).toBe(true);
      expect(video.getAttribute("preload")).toBe("metadata");
      expect(video.getAttribute("poster")).toBe("/images/hero-poster.jpg");
      expect(video.getAttribute("tabindex")).toBe("-1");
      expect(video.closest("[aria-hidden='true']")).not.toBeNull();
    }
  });

  it("shows only the active clip so the crossfade never reveals two at once", () => {
    stubEnvironment(false, undefined);
    const { container } = render(<HeroVideoRotator />);
    const opacities = Array.from(container.querySelectorAll("video")).map(
      (v) => v.style.opacity,
    );
    expect(opacities).toEqual(["0.62", "0", "0"]);
  });
});
