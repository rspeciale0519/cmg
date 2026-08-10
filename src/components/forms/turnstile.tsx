"use client";

import { useEffect, useRef, useState } from "react";

type TurnstileApi = {
  render: (
    element: HTMLElement,
    options: {
      sitekey: string;
      theme?: "light" | "dark" | "auto";
      "response-field-name"?: string;
    },
  ) => string;
  reset: (widgetId?: string) => void;
  remove: (widgetId?: string) => void;
};

declare global {
  interface Window {
    turnstile?: TurnstileApi;
  }
}

const SCRIPT_ID = "cf-turnstile-api";
const SCRIPT_SRC =
  "https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit";

/** Loaded directly rather than through `next/script`: the widget has to exist
 *  before `render()` can be called on it, and owning the load gives that
 *  ordering outright instead of inferring it from a framework lifecycle. */
function loadTurnstile(): Promise<TurnstileApi> {
  if (window.turnstile) return Promise.resolve(window.turnstile);

  let element = document.getElementById(SCRIPT_ID) as HTMLScriptElement | null;

  if (!element) {
    element = document.createElement("script");
    element.id = SCRIPT_ID;
    element.src = SCRIPT_SRC;
    element.async = true;
    element.defer = true;
    document.head.appendChild(element);
  }

  const script = element;

  return new Promise((resolve, reject) => {
    if (window.turnstile) {
      resolve(window.turnstile);
      return;
    }

    script.addEventListener("load", () => {
      if (window.turnstile) resolve(window.turnstile);
      else reject(new Error("Turnstile loaded without exposing its API"));
    });
    script.addEventListener("error", () =>
      reject(new Error("Turnstile script could not be loaded")),
    );
  });
}

/**
 * Explicit render, so the widget can be reset after a failed submission — a
 * Turnstile token is single-use, and retrying with a spent one is refused
 * server-side for a reason that has nothing to do with what the user got wrong.
 *
 * Turnstile writes the token into a hidden `cf-turnstile-response` input it
 * injects into the containing form, which is the field the server action reads.
 * Keeping the token out of React state is what lets the reset be a plain
 * external-system call with no cascading render behind it.
 */
export function TurnstileWidget({ resetOn }: { resetOn?: unknown }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const widgetIdRef = useRef<string | null>(null);
  const isFirstRun = useRef(true);
  const [failed, setFailed] = useState(false);

  const siteKey = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY;

  useEffect(() => {
    if (!siteKey) return;

    let cancelled = false;

    loadTurnstile()
      .then((api) => {
        if (cancelled || !containerRef.current || widgetIdRef.current) return;

        widgetIdRef.current = api.render(containerRef.current, {
          sitekey: siteKey,
          theme: "dark",
          "response-field-name": "cf-turnstile-response",
        });
      })
      .catch((error: unknown) => {
        if (cancelled) return;
        console.error("[turnstile]", error);
        setFailed(true);
      });

    return () => {
      cancelled = true;
      if (widgetIdRef.current) {
        window.turnstile?.remove(widgetIdRef.current);
        widgetIdRef.current = null;
      }
    };
  }, [siteKey]);

  useEffect(() => {
    if (isFirstRun.current) {
      isFirstRun.current = false;
      return;
    }

    if (widgetIdRef.current) {
      window.turnstile?.reset(widgetIdRef.current);
    }
  }, [resetOn]);

  if (!siteKey || failed) {
    return (
      <p className="text-[13px] leading-[1.6] text-[#E08C6A]">
        The verification check could not load, so this form cannot be submitted right now.
        Please reload the page, or call us and we&apos;ll take the details over the phone.
      </p>
    );
  }

  return <div ref={containerRef} className="min-h-[65px]" />;
}
