export type NavItem = {
  readonly href: string;
  readonly label: string;
};

export const primaryNav: readonly NavItem[] = [
  { href: "/", label: "Home" },
  { href: "/services", label: "Services" },
  { href: "/contractors", label: "Contractors" },
  { href: "/about", label: "About" },
  { href: "/contact", label: "Contact" },
] as const;

export const footerNav: readonly NavItem[] = [
  { href: "/services", label: "Services" },
  { href: "/contractors", label: "Contractors" },
  { href: "/about", label: "About" },
  { href: "/contact", label: "Contact" },
  { href: "/file-a-claim", label: "File a claim" },
] as const;

export const claimHref = "/file-a-claim";

export function isActiveRoute(pathname: string, href: string): boolean {
  if (href === "/") return pathname === "/";
  return pathname === href || pathname.startsWith(`${href}/`);
}
