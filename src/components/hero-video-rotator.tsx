"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { cx } from "@/lib/cx";

const DEFAULT_SOURCES = [
  "/videos/storm-01.mp4",
  "/videos/storm-02.mp4",
  "/videos/storm-03.mp4",
] as const;

const DEFAULT_POSTER = "/images/hero-poster.jpg";
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
  poster = DEFAULT_POSTER,
  className,
}: HeroVideoRotatorProps) {
  const [enabled, setEnabled] = useState(false);
  const [index, setIndex] = useState(0);
  const videoRefs = useRef<Array<HTMLVideoElement | null>>([]);
  const failedRef = useRef<Set<number>>(new Set());
  const count = sources.length;

  useEffect(() => {
    const motion = window.matchMedia("(prefers-reduced-motion: reduce)");
    const evaluate = () => {
      const connection = (navigator as NavigatorWithConnection).connection;
      setEnabled(!motion.matches && connection?.saveData !== true);
    };
    evaluate();
    motion.addEventListener("change", evaluate);
    return () => motion.removeEventListener("change", evaluate);
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
    if (!enabled) return;
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
  }, [enabled, index, advance]);

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

  if (!enabled || count === 0) return null;

  return (
    <div
      aria-hidden="true"
      className={cx("pointer-events-none absolute inset-0 z-[-2]", className)}
    >
      {sources.map((source, position) => (
        <video
          key={source}
          ref={(element) => {
            videoRefs.current[position] = element;
          }}
          src={source}
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
      ))}
    </div>
  );
}
