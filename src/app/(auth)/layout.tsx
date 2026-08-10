import type { ReactNode } from "react";

/**
 * No shared chrome — `AuthShell` is the frame and each page renders its own, so
 * the layout exists only to keep the `(auth)` group out of the marketing
 * header/footer.
 */
export default function AuthLayout({ children }: Readonly<{ children: ReactNode }>) {
  return children;
}
