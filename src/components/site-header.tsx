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
  const onClaimPage = isActiveRoute(pathname, claimHref);

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
     without this the hero keeps scrolling behind an open menu.

     Hiding the overflow also removes the scrollbar, and on a desktop browser
     with classic (space-taking) scrollbars below the 1025px breakpoint that
     hands the page ~15px it did not have: everything jumps right as the menu
     opens. Padding the body by the width the scrollbar was occupying holds
     the layout still. Overlay scrollbars measure 0, so this is a no-op on
     the phones the panel is actually for. */
  useEffect(() => {
    if (!open) return;
    const { body } = document;
    const previousOverflow = body.style.overflow;
    const previousPadding = body.style.paddingRight;
    const scrollbar = window.innerWidth - document.documentElement.clientWidth;
    body.style.overflow = "hidden";
    if (scrollbar > 0) body.style.paddingRight = `${scrollbar}px`;
    return () => {
      body.style.overflow = previousOverflow;
      body.style.paddingRight = previousPadding;
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
          /* Starts where the header ends: the row floors at 76px but the
             80.94px lockup sets it, plus the 1px bottom border — 81.94px,
             rounded up so the scrim never rides over the header edge. */
          "fixed inset-x-0 bottom-0 top-[82px] z-30 bg-canvas/70 backdrop-blur-[2px] transition-opacity duration-200 ease-out min-[1025px]:hidden",
          open ? "opacity-100" : "pointer-events-none opacity-0",
        )}
      />

      <header className="sticky top-0 z-40 border-b border-ink/9 bg-canvas/82 backdrop-blur-[14px]">
        {/* The prototype's own 76px floor. The stacked mark-over-wordmark
            lockup measures 80.94px, so the row sets to the lockup and the
            floor never binds — nothing clips, and the 58px mark keeps its
            size.

            The `max-w-[1360px]` is a deliberate departure from the prototype,
            whose header row is `width: 100%` with no cap. Full-bleed puts the
            lockup at the raw gutter while every band below it — including the
            footer, which renders this same lockup — starts at the 1360px
            field's inner edge. The gap is `(clientWidth − 1360) / 2`: zero to
            1360px, 32.5px at 1440, 272.5px at 1920. Sanctioned under "craft
            may exceed the prototype": the header now sits on the page's
            content spine at every width. Nav centring is unaffected because
            the container is itself centred. */}
        <div className="mx-auto grid min-h-[76px] w-full max-w-[1360px] grid-cols-[1fr_auto_1fr] items-center gap-8 px-[clamp(20px,4vw,56px)]">
          <Link
            href="/"
            aria-label={`${site.name} — home`}
            className="col-start-1 flex flex-col items-center gap-[5px] justify-self-start text-inherit no-underline"
          >
            {/* 58px is the prototype's header mark, and it is deliberately
                larger than the footer's 56px — the header lockup leads. The
                prototype reaches 58px by stretching the asset to 71×58
                against its true 1.117 aspect; the height is kept and the
                stretch is not, so this renders 64.8×58. The 4px under the
                wordmark is the prototype's own: it sits the visible ink
                slightly above the row's optical centre. */}
            {/* `sizes` is the rendered width (58 × 573/513 = 64.78px), not a
                second opinion about layout — the box is still the class's.
                Without it `next/image` builds the srcset from the *intrinsic*
                573px as `640w 1x, 1200w 2x`, so a 1.75 DPR phone preloaded the
                1200px candidate — 34 KB for 65 CSS pixels. Stating the real
                width lets the browser take the 128px candidate instead. */}
            <Image
              src="/images/logo-cmg-mark.png"
              alt=""
              width={573}
              height={513}
              sizes="65px"
              priority
              className="h-[58px] w-auto"
            />
            <span className="whitespace-nowrap pb-1 text-[9px] uppercase leading-[1.55] tracking-[0.24em] text-accent">
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
                    /* The page you are on still has to answer the pointer.
                       Inactive links resolve toward ink; the current one
                       stays gold and travels up its own ramp instead, so the
                       feedback never reads as "this became a different
                       link". */
                    active
                      ? "text-accent hover:text-accent-300 active:text-accent-200"
                      : "text-ink/85 hover:text-ink active:text-ink/70",
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
              /* `leading-[1.55]` for the same reason the nav links carry it:
                 `text-sm` ships a 20px pair, and the prototype's 14px header
                 items all take the body's 1.55 (21.7px). This was the one
                 header item still on the Tailwind default. */
              className="flex min-h-[44px] items-center whitespace-nowrap text-sm leading-[1.55] font-semibold text-ink no-underline transition-colors duration-200 hover:text-accent-300"
            >
              {site.phone}
            </a>
            {/* The header CTA is a link like any other in this row, so on the
                page it points at it says so — in the a11y tree with
                `aria-current`, and on screen with the prototype's 14% accent
                fill, which `File.dc.html` carries on this button and no other
                page does. */}
            <Button
              href={claimHref}
              size="sm"
              variant={onClaimPage ? "current" : "primary"}
              aria-current={onClaimPage ? "page" : undefined}
            >
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
            className="col-start-3 flex size-11 flex-col items-center justify-center gap-[5px] justify-self-end rounded-md border border-ink/16 text-ink transition-colors duration-200 hover:bg-ink/7 active:bg-ink/12 min-[1025px]:hidden"
          >
            {/* The bars are 1px on a 5px gap, so their centres are 6px apart:
                the outer two travel that 6px to meet on the middle line and
                cross there, and the middle bar leaves. `aria-label` was
                carrying the open/closed state on its own — this is the same
                state, said in the glyph. */}
            <span
              aria-hidden="true"
              className={cx(
                "block h-px w-[18px] bg-current transition-transform duration-200 ease-out",
                open ? "translate-y-[6px] rotate-45" : "",
              )}
            />
            <span
              aria-hidden="true"
              className={cx(
                "block h-px w-[18px] bg-current transition-opacity duration-200 ease-out",
                open ? "opacity-0" : "opacity-100",
              )}
            />
            <span
              aria-hidden="true"
              className={cx(
                "block h-px w-[18px] bg-current transition-transform duration-200 ease-out",
                open ? "-translate-y-[6px] -rotate-45" : "",
              )}
            />
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
                        /* Same surface feedback for both states — only the
                           ink differs, so tapping the current page is not a
                           dead press. */
                        "hover:bg-ink/7 active:bg-ink/12",
                        active
                          ? "text-accent hover:text-accent-300"
                          : "text-ink hover:text-accent-300",
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
