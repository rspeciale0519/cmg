import Link from "next/link";
import type { ComponentPropsWithoutRef, ReactNode } from "react";
import { cx } from "@/lib/cx";

/* `opacity` is in the transition list beside the colours: a submit button
   dims and loses its hover fill in the same instant, and animating one while
   the other snaps reads as two events.

   `disabled:hover:bg-transparent` because `:hover` still matches a disabled
   <button> in Chrome. Without it, a submit that has just been pressed lights
   up with its live hover fill for the whole in-flight second while the cursor
   over it reads `not-allowed` — the fill says press me, the cursor says you
   cannot. Two variants, so it outranks the single-variant hover fill however
   the sheet is ordered. */
const BASE =
  "inline-flex items-center justify-center gap-1.5 whitespace-nowrap rounded-md border font-medium leading-[1.2] no-underline " +
  "transition-[color,background-color,border-color,opacity] duration-200 " +
  "disabled:cursor-not-allowed disabled:opacity-45 disabled:hover:bg-transparent";

const VARIANT = {
  primary: "border-accent text-accent hover:bg-accent/12 active:bg-accent/22",
  /* The primary wearing a "you are here" fill: the header CTA on the page it
     points at. `File.dc.html` is the one prototype that gives this button an
     inline `background: color-mix(in srgb, var(--color-accent) 14%,
     transparent)`, and `bg-accent/14` is what that translation has meant
     everywhere else on this site (the prototype's 12% hover is `bg-accent/12`
     directly above).

     A whole variant rather than a fill appended to `primary` at the call site,
     for the reason this file already documents about sizes: `bg-accent/14`
     beside `hover:bg-accent/12` is an equal-specificity pair, so the emitted
     sheet would decide which paints — and if the hover won, the pointer would
     make the current-page button *dimmer* than at rest. The ramp is restated
     from the fill instead of around it, so the button still answers the
     pointer and only ever travels up, which is the same rule the current nav
     link follows. */
  current:
    "border-accent text-accent bg-accent/14 hover:bg-accent/22 active:bg-accent/30",
  secondary: "border-ink/16 text-ink hover:bg-ink/7 active:bg-ink/14",
} as const;

/* Sizes are keys here, never a `className` override at the call site. A
   caller passing `min-h-[46px] px-[22px]` alongside `md`'s own
   `min-h-[50px] px-[26px]` ties on specificity — both are single-class
   selectors — so the emitted sheet decides, and `md` won: the override was
   inert.

   Two type tiers, two densities each — every value the prototype's own:

     tier    size      type   box      prototype source
     ────────────────────────────────────────────────────────────────────
     14px    sm        14px   38.8px   `padding: 10px 18px`, header CTA
     14px    compact   14px   46px     `min-height: 46px; padding: 0 22px`
     15px    md        15px   50px     `min-height: 50px; padding: 0 26px`
     15px    lg        15px   52px     `min-height: 52px; padding: 0 34px`

   `compact` used to carry 15px type on the 46px box, which put a 15px CTA
   4px under another 15px CTA with nothing to explain the difference. The
   prototype's 46px button sets no font-size and therefore takes `.btn`'s
   14px: the box steps because the type steps, and 46 and 50 are the roomy
   ends of two different tiers rather than two guesses at one. */
const SIZE = {
  sm: "px-[18px] py-[10px] text-sm",
  compact: "min-h-[46px] px-[22px] text-sm",
  md: "min-h-[50px] px-[26px] text-[15px]",
  lg: "min-h-[52px] px-[34px] text-[15px]",
} as const;

export type ButtonVariant = keyof typeof VARIANT;
export type ButtonSize = keyof typeof SIZE;

type ButtonBaseProps = {
  variant?: ButtonVariant;
  size?: ButtonSize;
  className?: string;
  children: ReactNode;
};

type ButtonAsLinkProps = ButtonBaseProps &
  Omit<ComponentPropsWithoutRef<"a">, keyof ButtonBaseProps> & { href: string };

type ButtonAsButtonProps = ButtonBaseProps &
  Omit<ComponentPropsWithoutRef<"button">, keyof ButtonBaseProps> & {
    href?: undefined;
  };

export type ButtonProps = ButtonAsLinkProps | ButtonAsButtonProps;

export function Button(props: ButtonProps) {
  if (typeof props.href === "string") {
    const {
      variant = "primary",
      size = "md",
      className,
      children,
      href,
      ...anchorProps
    } = props;
    const classes = cx(BASE, VARIANT[variant], SIZE[size], className);

    if (href.startsWith("/")) {
      return (
        <Link href={href} className={classes} {...anchorProps}>
          {children}
        </Link>
      );
    }

    return (
      <a href={href} className={classes} {...anchorProps}>
        {children}
      </a>
    );
  }

  const {
    variant = "primary",
    size = "md",
    className,
    children,
    ...buttonProps
  } = props;

  return (
    <button
      type="button"
      className={cx(BASE, VARIANT[variant], SIZE[size], className)}
      {...buttonProps}
    >
      {children}
    </button>
  );
}
