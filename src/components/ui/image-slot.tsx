import Image from "next/image";
import { cx } from "@/lib/cx";

const RATIO = {
  "4/3": "aspect-[4/3]",
  "3/2": "aspect-[3/2]",
  "16/9": "aspect-[16/9]",
  "1/1": "aspect-square",
} as const;

export type ImageSlotRatio = keyof typeof RATIO;

type ImageSlotBaseProps = {
  ratio?: ImageSlotRatio;
  className?: string;
  sizes?: string;
  priority?: boolean;
};

export type ImageSlotProps = ImageSlotBaseProps &
  (
    | { src: string; alt: string; label?: string }
    | { src?: undefined; alt?: undefined; label: string }
  );

export function ImageSlot({
  ratio = "4/3",
  className,
  sizes = "(min-width: 1025px) 50vw, 100vw",
  priority = false,
  ...content
}: ImageSlotProps) {
  if (content.src !== undefined) {
    return (
      <div
        className={cx("relative w-full overflow-hidden", RATIO[ratio], className)}
      >
        <Image
          src={content.src}
          alt={content.alt}
          fill
          sizes={sizes}
          priority={priority}
          className="object-cover"
        />
      </div>
    );
  }

  return (
    <div
      className={cx(
        "relative w-full overflow-hidden border border-accent/30 bg-canvas",
        RATIO[ratio],
        className,
      )}
    >
      <span
        aria-hidden="true"
        className="absolute inset-0 opacity-[0.13] [background-image:repeating-linear-gradient(74deg,color-mix(in_srgb,var(--color-ink)_50%,transparent)_0_1px,transparent_1px_9px)]"
      />
      <span
        aria-hidden="true"
        className="absolute inset-0 [background-image:radial-gradient(72%_62%_at_50%_34%,color-mix(in_srgb,var(--color-accent)_11%,transparent),transparent_72%)]"
      />
      <span
        aria-hidden="true"
        className="absolute left-3 top-3 size-3 border-l border-t border-accent/55"
      />
      <span
        aria-hidden="true"
        className="absolute right-3 top-3 size-3 border-r border-t border-accent/55"
      />
      <span
        aria-hidden="true"
        className="absolute bottom-3 left-3 size-3 border-b border-l border-accent/55"
      />
      <span
        aria-hidden="true"
        className="absolute bottom-3 right-3 size-3 border-b border-r border-accent/55"
      />
      <span className="absolute inset-0 flex items-center justify-center px-8 text-center text-xs uppercase leading-[1.7] tracking-[0.2em] text-accent-300/85">
        {content.label}
      </span>
    </div>
  );
}
