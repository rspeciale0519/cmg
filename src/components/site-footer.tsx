import Image from "next/image";
import Link from "next/link";
import { Container } from "@/components/ui/section";
import { footerNav } from "@/lib/nav";
import { emailHref, site, telHref } from "@/lib/site";

const COLUMN_HEADING =
  "text-[11px] font-normal uppercase tracking-[0.18em] text-ink/45";
const LINK =
  "flex min-h-[44px] items-center text-sm text-ink/78 no-underline transition-colors duration-200 hover:text-accent-300";
const EMAIL_LINK = `${LINK} break-all`;

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
            <a href={emailHref} className={EMAIL_LINK}>
              {site.email}
            </a>
            <span className="py-2 text-sm leading-[1.6] text-ink/62">
              {site.city}
              <br />
              {site.serviceArea}
            </span>
          </address>
        </div>
      </Container>

      <Container className="border-t border-ink/8 pb-12 pt-6 text-[13px] text-ink/45">
        &copy; {new Date().getFullYear()} {site.name} &middot; {site.licensee}{" "}
        &middot; License # {site.license}
      </Container>
    </footer>
  );
}
