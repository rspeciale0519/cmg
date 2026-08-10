import Image from "next/image";
import Link from "next/link";
import { Container } from "@/components/ui/section";
import { footerNav } from "@/lib/nav";
import { emailHref, site, telHref } from "@/lib/site";

/* The prototype's column headings are `<span>`s and take the body's 1.55
   line-height (17.05px at 11px). These are `<h2>`s for the landmark labels,
   which picks up the 1.12 heading rule in `globals.css` and closes the box to
   12.32px, tightening the gap under each heading by 4.7px. The leading is
   restated so the semantics don't cost the spacing. */
const COLUMN_HEADING =
  "text-[11px] font-normal uppercase leading-[1.55] tracking-[0.18em] text-ink/55";
/* The prototype's footer links set no line-height, so they take the body's
   1.55 (21.7px at 14px); Tailwind's `text-sm` ships a 20px pair. */
const LINK =
  "flex min-h-[44px] items-center text-sm leading-[1.55] text-ink/78 no-underline transition-colors duration-200 hover:text-accent-300";
/* `break-all` split the address mid-word ("…CMGPropertySolution / s.net").
   Block layout plus an explicit break opportunity after the `@` gives the
   line a place it *wants* to break, and `anywhere` is only the fallback for
   viewports too narrow even for the domain. 12px padding on the 21.7px line
   keeps the 44px tap target the flex row was providing. */
const EMAIL_LINK =
  "block py-3 text-sm leading-[1.55] text-ink/78 no-underline transition-colors duration-200 hover:text-accent-300 [overflow-wrap:anywhere]";

const [EMAIL_LOCAL, EMAIL_DOMAIN] = site.email.split("@");

export function SiteFooter() {
  return (
    <footer className="border-t border-ink/11">
      <Container className="grid grid-cols-[repeat(auto-fit,minmax(200px,1fr))] gap-10 pb-10 pt-[clamp(48px,5vw,72px)]">
        <div>
          <div className="flex w-max flex-col items-center gap-[7px]">
            <Image
              src="/images/logo-cmg-mark.png"
              alt={site.name}
              width={573}
              height={513}
              className="h-14 w-auto"
            />
            <span className="whitespace-nowrap text-[11px] uppercase tracking-[0.24em] text-accent">
              Property Solutions
            </span>
          </div>
          <p className="mt-[18px] max-w-[34ch] text-sm leading-[1.7] text-ink/62">
            Licensed Florida public adjusters representing property owners
            &mdash; never insurance companies.
          </p>
        </div>

        <nav aria-labelledby="footer-site" className="flex flex-col">
          <h2 id="footer-site" className={COLUMN_HEADING}>
            Site
          </h2>
          {footerNav.map((item) => (
            <Link key={item.href} href={item.href} className={LINK}>
              {item.label}
            </Link>
          ))}
        </nav>

        <div className="flex flex-col">
          <h2 id="footer-contact" className={COLUMN_HEADING}>
            Contact
          </h2>
          <address className="flex flex-col not-italic">
            <a href={telHref} className={LINK}>
              {site.phone}
            </a>
            {/* The <wbr> serialises into the computed accessible name as a
                space, so the name is given explicitly instead. */}
            <a href={emailHref} aria-label={site.email} className={EMAIL_LINK}>
              {EMAIL_LOCAL}@<wbr />
              {EMAIL_DOMAIN}
            </a>
            <span className="py-2 text-sm leading-[1.6] text-ink/62">
              {site.city}
              <br />
              {site.serviceArea}
            </span>
          </address>
        </div>
      </Container>

      <Container className="border-t border-ink/8 pb-12 pt-6 text-[13px] leading-[1.55] text-ink/55">
        &copy; {new Date().getFullYear()} {site.name} &middot; {site.licensee}{" "}
        &middot; License # {site.license}
      </Container>
    </footer>
  );
}
