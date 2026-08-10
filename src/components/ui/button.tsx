import Link from "next/link";
import type { ComponentPropsWithoutRef, ReactNode } from "react";
import { cx } from "@/lib/cx";

const BASE =
  "inline-flex items-center justify-center gap-1.5 whitespace-nowrap rounded-md border font-medium leading-[1.2] no-underline transition-colors duration-200 disabled:cursor-not-allowed disabled:opacity-45";

const VARIANT = {
  primary: "border-accent text-accent hover:bg-accent/12 active:bg-accent/22",
  secondary: "border-ink/16 text-ink hover:bg-ink/7 active:bg-ink/14",
} as const;

/* Sizes are keys here, never a `className` override at the call site. A
   caller passing `min-h-[46px] px-[22px]` alongside `md`'s own
   `min-h-[50px] px-[26px]` ties on specificity — both are single-class
   selectors — so the emitted sheet decides, and `md` won: the override was
   inert. `compact` is the prototype's own 46px/22px secondary button. */
const SIZE = {
  sm: "px-[18px] py-[10px] text-sm",
  compact: "min-h-[46px] px-[22px] text-[15px]",
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
