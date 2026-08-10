"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { cx } from "@/lib/cx";

const DEFAULT_SOURCES = [
  "/videos/storm-01.mp4",
  "/videos/storm-02.mp4",
  "/videos/storm-03.mp4",
] as const;

/** The hero's largest contentful paint. */
const HERO_POSTER = "/images/hero-poster.jpg";
const ACTIVE_OPACITY = 0.62;
const FALLBACK_MS = 9000;

type NetworkInformationLike = { saveData?: boolean };
type NavigatorWithConnection = Navigator & {
  connection?: NetworkInformationLike;
};

export type HeroVideoRotatorProps = {
  sources?: readonly string[];
  poster?: string;
  className?: string;
};

export function HeroVideoRotator({
  sources = DEFAULT_SOURCES,
  poster = HERO_POSTER,
  className,
}: HeroVideoRotatorProps) {
  const [enabled, setEnabled] = useState(false);
  /* `enabled` alone cannot tell "not yet asked" from "asked, and the answer is
     no" — both are `false`. The poster stand-in below has to be shown in the
     first case and gone in the second, so the two states are separated. */
  const [resolved, setResolved] = useState(false);
  const [idle, setIdle] = useState(false);
  const [index, setIndex] = useState(0);
  const videoRefs = useRef<Array<HTMLVideoElement | null>>([]);
  const failedRef = useRef<Set<number>>(new Set());
  const count = sources.length;

  useEffect(() => {
    const motion = window.matchMedia("(prefers-reduced-motion: reduce)");
    const evaluate = () => {
      const connection = (navigator as NavigatorWithConnection).connection;
      setEnabled(!motion.matches && connection?.saveData !== true);
      setResolved(true);
    };
    evaluate();
    motion.addEventListener("change", evaluate);
    return () => motion.removeEventListener("change", evaluate);
  }, []);

  /* What gets deferred is the `src`, not the element.

     The clips carry 1.6 MB between them, and downloading and decoding that
     during the load phase cost the page twice: it took bandwidth from the one
     font the hero needs, and main thread from hydration. Blocking the media
     outright moved TBT 2,110 ms → 1,150 ms and Speed Index 4.1 s → 3.0 s.

     But the `<video>` box is full-bleed, so its poster is the page's largest
     contentful paint — holding the *element* back moved LCP with it, from
     3.3 s to 3.6 s. So the elements mount when they always did, showing the
     poster they always showed, and only the `src` waits for `load` plus an
     idle callback. The hero looks the same at the same moment; the clip it
     eventually crossfades to just starts fetching once the page around it has
     finished arriving. */
  useEffect(() => {
    let cancel = () => {};

    const start = () => {
      if (typeof window.requestIdleCallback === "function") {
        const id = window.requestIdleCallback(() => setIdle(true), {
          timeout: 2000,
        });
        cancel = () => window.cancelIdleCallback(id);
        return;
      }
      const id = window.setTimeout(() => setIdle(true), 200);
      cancel = () => window.clearTimeout(id);
    };

    if (document.readyState === "complete") {
      start();
    } else {
      window.addEventListener("load", start, { once: true });
      cancel = () => window.removeEventListener("load", start);
    }

    return () => cancel();
  }, []);

  const advance = useCallback(() => {
    setIndex((current) => {
      for (let step = 1; step <= count; step += 1) {
        const next = (current + step) % count;
        if (!failedRef.current.has(next)) return next;
      }
      return current;
    });
  }, [count]);

  useEffect(() => {
    if (!enabled || !idle) return;
    const active = videoRefs.current[index];
    if (!active) return;

    videoRefs.current.forEach((video, position) => {
      if (video && position !== index) video.pause();
    });

    active.currentTime = 0;
    void active.play().catch(() => {
      /* Autoplay refused — the gradient stack below stays visible. */
    });

    const known = Number.isFinite(active.duration) && active.duration > 0;
    const timer = window.setTimeout(
      advance,
      known ? (active.duration + 1) * 1000 : FALLBACK_MS,
    );
    return () => window.clearTimeout(timer);
  }, [enabled, idle, index, advance]);

  const handleError = useCallback(
    (position: number) => {
      failedRef.current.add(position);
      if (failedRef.current.size >= count) {
        setEnabled(false);
        return;
      }
      if (position === index) advance();
    },
    [advance, count, index],
  );

  if (count === 0) return null;
  /* Asked and answered no: reduced motion, or the connection asking to save
     data. Nothing renders and nothing is fetched — the gradient stack below is
     the hero, exactly as before the poster existed. */
  if (resolved && !enabled) return null;

  return (
    <div
      aria-hidden="true"
      className={cx("pointer-events-none absolute inset-0 z-[-2]", className)}
    >
      {/* ── The hero's largest element, in the prerendered HTML ──────────────
          `<video>` is the thing that eventually shows this frame, and a video
          only exists once a client component has hydrated and read the user's
          motion and data preferences. Until then the page's largest contentful
          paint had nothing to be: the hero's LCP was the video's poster, and
          the poster could not be discovered by the preload scanner because no
          element referenced it. Mobile paid for that twice — LCP waited on
          hydration on a 4×-throttled CPU (3.4 s, against desktop's 0.8 s for
          the identical element), and `lcp-discovery` scored 0 on both
          `requestDiscoverable` and `priorityHinted`.

          So the same frame is painted by an `<img>` that is in the HTML the
          server sends. It is a stand-in, not a second layer: it occupies the
          same box as `videos[index]`, at the same `ACTIVE_OPACITY`, and it is
          unmounted in the very commit that mounts the videos — which come up
          showing this identical poster at this identical opacity. Two 0.62
          layers would composite to 0.856 of the clip and read visibly darker
          than the design, so they are never on screen together.

          `motion-reduce:hidden` rather than JS: reduced motion is the one
          preference CSS can answer at first paint, so those users never see
          the frame at all instead of seeing it and having hydration take it
          away.

          `fetchPriority="high"` is also the whole preload: React hoists a
          matching `<link rel="preload" as="image" fetchPriority="high">` into
          `<head>` from this attribute. Adding one by hand puts two identical
          links in the head — the build was checked, and there is exactly one.

          A bare `<img>`, and the lint rule below is waived rather than
          satisfied: this has to request the byte-identical URL the `<video
          poster>` requests, or the browser fetches the same frame twice.
          `next/image` would rewrite it through the optimizer and break that
          match, for a fixed piece of decorative art that is already sized and
          already compressed.

          No `decoding` attribute either. `async` is the right default for an
          image the page can paint without, and the wrong one for the page's
          LCP: it lets the frame that would have carried this go out without it.
          Measured on the 4×/Slow-4G profile it cost 600 ms — the first frame
          painted at 1328 ms and the poster only reached the screen at 1928 ms,
          though its bytes had arrived at 1295 ms. Left unstated, so the browser
          decodes it with the paint it belongs to. */}
      {resolved ? null : (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={poster}
          alt=""
          fetchPriority="high"
          className="absolute inset-0 size-full object-cover motion-reduce:hidden"
          style={{ opacity: ACTIVE_OPACITY }}
        />
      )}

      {enabled ? sources.map((source, position) => (
        <video
          key={source}
          ref={(element) => {
            videoRefs.current[position] = element;
          }}
          src={idle ? source : undefined}
          poster={poster}
          muted
          playsInline
          preload="metadata"
          tabIndex={-1}
          onEnded={advance}
          onError={() => handleError(position)}
          className="absolute inset-0 size-full object-cover transition-opacity duration-1000 ease-linear"
          style={{ opacity: position === index ? ACTIVE_OPACITY : 0 }}
        />
      )) : null}
    </div>
  );
}
