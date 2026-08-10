import type { ReactNode } from "react";
import { SiteFooter } from "@/components/site-footer";
import { SiteHeader } from "@/components/site-header";

export default function MarketingLayout({
  children,
}: Readonly<{ children: ReactNode }>) {
  return (
    <>
      <a
        href="#main"
        className="sr-only rounded-md border border-accent bg-canvas px-5 text-sm font-medium text-accent focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-50 focus:flex focus:h-12 focus:items-center"
      >
        Skip to content
      </a>
      <SiteHeader />
      <main id="main" tabIndex={-1}>
        {children}
      </main>
      <SiteFooter />
    </>
  );
}
