"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { cx } from "@/lib/cx";
import { claimHref, isActiveRoute, primaryNav } from "@/lib/nav";
import { site, telHref } from "@/lib/site";

const PANEL_ID = "site-mobile-menu";
const FOCUSABLE = "a[href], button:not([disabled])";
const DESKTOP_QUERY = "(min-width: 1025px)";

export function SiteHeader() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const [renderedPath, setRenderedPath] = useState(pathname);
  const toggleRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);

  // Navigating dismisses the menu. Adjusting during render rather than in an
  // effect keeps the closed panel from painting for a frame after the route
  // changes. https://react.dev/learn/you-might-not-need-an-effect
  if (renderedPath !== pathname) {
    setRenderedPath(pathname);
    setOpen(false);
  }

  const close = useCallback((returnFocus: boolean) => {
    setOpen(false);
    if (returnFocus) toggleRef.current?.focus();
  }, []);

  useEffect(() => {
    const desktop = window.matchMedia(DESKTOP_QUERY);
    const closeOnDesktop = (event: MediaQueryListEvent) => {
      if (event.matches) setOpen(false);
    };
    desktop.addEventListener("change", closeOnDesktop);
    return () => desktop.removeEventListener("change", closeOnDesktop);
  }, []);

  useEffect(() => {
    if (!open) return;
    const panel = panelRef.current;
    if (!panel) return;

    panel.querySelector<HTMLElement>(FOCUSABLE)?.focus();

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        close(true);
        return;
      }
      if (event.key !== "Tab") return;

      const ring: HTMLElement[] = [];
      const toggle = toggleRef.current;
      if (toggle) ring.push(toggle);
      ring.push(...Array.from(panel.querySelectorAll<HTMLElement>(FOCUSABLE)));
      if (ring.length === 0) return;

      const first = ring[0];
      const last = ring[ring.length - 1];
      const active = document.activeElement;

      if (event.shiftKey && active === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && active === last) {
        event.preventDefault();
        first.focus();
      } else if (!(active instanceof HTMLElement) || !ring.includes(active)) {
        event.preventDefault();
        first.focus();
      }
    };

    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [open, close]);

  return (
    <header className="sticky top-0 z-40 border-b border-ink/9 bg-canvas/82 backdrop-blur-[14px]">
      <div className="grid min-h-[76px] w-full grid-cols-[1fr_auto_1fr] items-center gap-8 px-[clamp(20px,4vw,56px)]">
        <Link
          href="/"
          aria-label={`${site.name} — home`}
          className="col-start-1 flex flex-col items-center gap-[5px] justify-self-start text-inherit no-underline"
        >
          <Image
            src="/images/logo-cmg-mark.png"
            alt=""
            width={573}
            height={513}
            priority
            className="h-[46px] w-auto"
          />
          <span className="whitespace-nowrap text-[10px] uppercase tracking-[0.24em] text-accent">
            Property Solutions
          </span>
        </Link>

        <nav
          aria-label="Primary"
          className="col-start-2 hidden items-center gap-[30px] justify-self-center min-[1025px]:flex"
        >
          {primaryNav.map((item) => {
            const active = isActiveRoute(pathname, item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                aria-current={active ? "page" : undefined}
                className={cx(
                  "flex min-h-[44px] items-center text-sm no-underline transition-colors duration-200",
                  active ? "text-accent" : "text-ink/82 hover:text-ink",
                )}
              >
                {item.label}
              </Link>
            );
          })}
        </nav>

        <div className="col-start-3 hidden items-center gap-[14px] justify-self-end min-[1025px]:flex">
          <a
            href={telHref}
            className="flex min-h-[44px] items-center whitespace-nowrap text-sm font-semibold text-ink no-underline transition-colors duration-200 hover:text-accent-300"
          >
            {site.phone}
          </a>
          <Button href={claimHref} size="sm">
            File a claim
          </Button>
        </div>

        <button
          ref={toggleRef}
          type="button"
          aria-expanded={open}
          aria-controls={PANEL_ID}
          aria-label={open ? "Close menu" : "Open menu"}
          onClick={() => (open ? close(false) : setOpen(true))}
          className="col-start-3 flex size-11 flex-col items-center justify-center gap-[5px] justify-self-end rounded-md border border-ink/16 text-ink transition-colors duration-200 hover:bg-ink/7 min-[1025px]:hidden"
        >
          <span aria-hidden="true" className="block h-px w-[18px] bg-current" />
          <span aria-hidden="true" className="block h-px w-[18px] bg-current" />
          <span aria-hidden="true" className="block h-px w-[18px] bg-current" />
        </button>
      </div>

      {open ? (
        <div
          id={PANEL_ID}
          ref={panelRef}
          className="border-t border-ink/16 px-[clamp(20px,4vw,56px)] pb-6 pt-2 min-[1025px]:hidden"
        >
          <nav aria-label="Primary" className="flex flex-col gap-[2px]">
            {primaryNav.map((item) => {
              const active = isActiveRoute(pathname, item.href);
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  aria-current={active ? "page" : undefined}
                  className={cx(
                    "flex min-h-[48px] items-center py-[13px] text-[17px] no-underline",
                    active ? "text-accent" : "text-ink",
                  )}
                >
                  {item.label}
                </Link>
              );
            })}
          </nav>
          <Button href={claimHref} className="mt-[14px] w-full">
            File a claim
          </Button>
          <Button href={telHref} variant="secondary" className="mt-[10px] w-full">
            Call 24/7 &middot; {site.phone}
          </Button>
        </div>
      ) : null}
    </header>
  );
}
