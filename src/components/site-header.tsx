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

  /* The panel overlays the page, so the page must stop moving under it —
     without this the hero keeps scrolling behind an open menu. */
  useEffect(() => {
    if (!open) return;
    const { body } = document;
    const previous = body.style.overflow;
    body.style.overflow = "hidden";
    return () => {
      body.style.overflow = previous;
    };
  }, [open]);

  /* The scrim only dims the page; it does not take it out of the tab order,
     so Tab from the last menu item used to walk into the blurred content
     behind. `main` and the footer are siblings rendered by the layout, so the
     panel cannot nest them — they are marked `inert` directly instead, which
     removes them from focus, hit-testing and the a11y tree for as long as the
     menu owns the screen. */
  useEffect(() => {
    if (!open) return;
    const behind = [
      document.getElementById("main"),
      document.querySelector("footer"),
    ].filter((element): element is HTMLElement => element !== null);

    for (const element of behind) element.inert = true;
    return () => {
      for (const element of behind) element.inert = false;
    };
  }, [open]);

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
    <>
      {/* Scrim. A sibling of the header, not a child: the header's
          `backdrop-blur` makes it a containing block, so a `fixed` scrim
          nested inside it would size to the header instead of the viewport. */}
      <button
        type="button"
        tabIndex={-1}
        aria-hidden="true"
        data-testid="site-menu-scrim"
        onClick={() => close(false)}
        className={cx(
          "fixed inset-x-0 bottom-0 top-[84px] z-30 bg-canvas/70 backdrop-blur-[2px] transition-opacity duration-200 ease-out min-[1025px]:hidden",
          open ? "opacity-100" : "pointer-events-none opacity-0",
        )}
      />

      <header className="sticky top-0 z-40 border-b border-ink/9 bg-canvas/82 backdrop-blur-[14px]">
        {/* 84px, not 76px: the lockup is a stacked mark-over-wordmark, so at
            76px it cleared the row by 5px top and bottom and read cramped and
            optically high against the nav baseline. The extra 8px is air, and
            the mark grows with it so the lockup keeps its weight. */}
        <div className="grid min-h-[84px] w-full grid-cols-[1fr_auto_1fr] items-center gap-8 px-[clamp(20px,4vw,56px)]">
          <Link
            href="/"
            aria-label={`${site.name} — home`}
            className="col-start-1 flex flex-col items-center gap-[6px] justify-self-start text-inherit no-underline"
          >
            <Image
              src="/images/logo-cmg-mark.png"
              alt=""
              width={573}
              height={513}
              priority
              className="h-[50px] w-auto"
            />
            <span className="whitespace-nowrap text-[10px] uppercase leading-none tracking-[0.24em] text-accent">
              Property Solutions
            </span>
          </Link>

          <nav
            aria-label="Primary"
            data-testid="desktop-nav"
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
                    /* `leading-[1.55]` is the prototype's body leading, which
                       its 14px nav links inherit (21.7px). Tailwind's
                       `text-sm` ships a 20px pair. */
                    "flex min-h-[44px] items-center text-sm leading-[1.55] no-underline transition-colors duration-200",
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

        {/* Kept mounted so it can transition both ways; `inert` takes the closed
            panel out of the tab order and the a11y tree, and the 0fr→1fr grid
            row is the only way to animate to an unknown content height. */}
        <div
          id={PANEL_ID}
          ref={panelRef}
          inert={!open}
          className={cx(
            "relative z-40 grid overflow-hidden bg-canvas transition-[grid-template-rows,opacity] duration-200 ease-out min-[1025px]:hidden",
            open ? "grid-rows-[1fr] opacity-100" : "grid-rows-[0fr] opacity-0",
          )}
        >
          <div className="min-h-0">
            <div className="border-t border-ink/16 px-[clamp(20px,4vw,56px)] pb-6 pt-2">
              <nav aria-label="Primary" className="flex flex-col gap-[2px]">
                {primaryNav.map((item) => {
                  const active = isActiveRoute(pathname, item.href);
                  return (
                    <Link
                      key={item.href}
                      href={item.href}
                      aria-current={active ? "page" : undefined}
                      className={cx(
                        "-mx-3 flex min-h-[48px] items-center rounded-md px-3 py-[13px] text-[17px] no-underline transition-colors duration-200",
                        active
                          ? "text-accent"
                          : "text-ink hover:bg-ink/7 hover:text-accent-300 active:bg-ink/12",
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
          </div>
        </div>

      </header>
    </>
  );
}
