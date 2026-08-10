import { act, render } from "@testing-library/react";
import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, beforeAll, describe, expect, it } from "vitest";
import { HeroVideoRotator } from "./hero-video-rotator";

type ConnectionStub = { saveData?: boolean } | undefined;

/* The rotator waits for `load` and then for an idle callback before it mounts
   a single <video>, so the 1.6 MB of media never lands in the load phase.
   jsdom ships no idle scheduler, so the tests supply one. `inline: true` runs
   the callback the moment it is requested, which keeps every existing
   assertion synchronous; `inline: false` parks it so a test can look at what
   renders *before* the deferral fires. */
function stubIdle(inline: boolean) {
  let pending: (() => void) | null = null;

  Object.defineProperty(window, "requestIdleCallback", {
    writable: true,
    configurable: true,
    value: (callback: () => void) => {
      if (inline) callback();
      else pending = callback;
      return 1;
    },
  });
  Object.defineProperty(window, "cancelIdleCallback", {
    writable: true,
    configurable: true,
    value: () => {
      pending = null;
    },
  });

  return {
    flush() {
      const callback = pending;
      pending = null;
      if (callback) act(callback);
    },
  };
}

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
  // The deferral hangs off `load`, which jsdom has already fired by the time
  // a test runs; stated here so the gate never turns on document timing.
  Object.defineProperty(document, "readyState", {
    writable: true,
    configurable: true,
    value: "complete",
  });

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
  stubIdle(true);
});

describe("HeroVideoRotator", () => {
  /* The defect this guards: a client component that returns `null` until an
     effect has read the user's preferences puts *no* candidate for the page's
     largest contentful paint in the HTML the server sends, so LCP waits on
     hydration. The stand-in has to be in the server output — not merely in the
     DOM once React has run — which is why this asserts against the string. */
  describe("server output", () => {
    const markup = () => renderToStaticMarkup(<HeroVideoRotator />);

    it("carries the poster as a real element, at high priority", () => {
      const html = markup();
      expect(html).toContain('src="/images/hero-poster.jpg"');
      /* React writes the prop verbatim; HTML attribute names are
         case-insensitive, so the browser reads it either way. */
      expect(html.toLowerCase()).toContain('fetchpriority="high"');
      expect(html).toContain("opacity:0.62");
    });

    it("still ships no clip — the bytes are the client's decision", () => {
      expect(markup()).not.toContain("<video");
    });

    it("hides the stand-in from reduced motion without waiting for JS", () => {
      expect(markup()).toContain("motion-reduce:hidden");
    });
  });

  it("renders nothing — and so fetches nothing — under prefers-reduced-motion", () => {
    stubEnvironment(true, undefined);
    stubIdle(true);
    const { container } = render(<HeroVideoRotator />);
    expect(container.querySelectorAll("video").length).toBe(0);
    expect(container.innerHTML).toBe("");
  });

  it("renders nothing when the connection asks to save data", () => {
    stubEnvironment(false, { saveData: true });
    stubIdle(true);
    const { container } = render(<HeroVideoRotator />);
    expect(container.querySelectorAll("video").length).toBe(0);
  });

  it("still plays when saveData is explicitly false", () => {
    stubEnvironment(false, { saveData: false });
    stubIdle(true);
    const { container } = render(<HeroVideoRotator />);
    expect(container.querySelectorAll("video").length).toBe(3);
  });

  it("mounts the poster immediately but holds the clip src until idle", () => {
    stubEnvironment(false, undefined);
    const idle = stubIdle(false);
    const { container } = render(<HeroVideoRotator />);
    const videos = () => Array.from(container.querySelectorAll("video"));

    /* The boxes are there from the first paint — they are the hero's largest
       element, and holding them back holds LCP back with them — but no clip
       is addressed yet, so nothing is fetched. */
    expect(videos().length).toBe(3);
    expect(videos().every((v) => v.getAttribute("poster") !== null)).toBe(true);
    expect(videos().map((v) => v.getAttribute("src"))).toEqual([
      null,
      null,
      null,
    ]);

    idle.flush();
    expect(videos().map((v) => v.getAttribute("src"))).toEqual([
      "/videos/storm-01.mp4",
      "/videos/storm-02.mp4",
      "/videos/storm-03.mp4",
    ]);
  });

  it("mounts every clip decorative, muted and metadata-only", () => {
    stubEnvironment(false, undefined);
    stubIdle(true);
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
    stubIdle(true);
    const { container } = render(<HeroVideoRotator />);
    const opacities = Array.from(container.querySelectorAll("video")).map(
      (v) => v.style.opacity,
    );
    expect(opacities).toEqual(["0.62", "0", "0"]);
  });
});
