import { headers } from "next/headers";
import { site } from "@/lib/site";

/* The payload is a module-level constant — no request, user or CMS data
   reaches it. Serialization still re-encodes the characters that could close
   the script element early; JSON.parse resolves the escapes back to the
   original characters, so consumers read identical JSON. */
const ESCAPES: Record<string, string | undefined> = {
  "<": "\\u003c",
  ">": "\\u003e",
  "&": "\\u0026",
};

function serialize(data: unknown): string {
  return JSON.stringify(data).replace(
    /[<>&]/g,
    (character) => ESCAPES[character] ?? character,
  );
}

const localBusiness = {
  "@context": "https://schema.org",
  "@type": "LocalBusiness",
  "@id": `${site.url}/#business`,
  name: site.name,
  description: `${site.tagline} representing property owners — never insurance companies.`,
  url: site.url,
  telephone: site.phone,
  email: site.email,
  address: {
    "@type": "PostalAddress",
    addressLocality: "Orlando",
    addressRegion: "FL",
    addressCountry: "US",
  },
  areaServed: {
    "@type": "State",
    name: "Florida",
  },
  identifier: {
    "@type": "PropertyValue",
    name: "Florida public adjuster license",
    value: site.license,
  },
  founder: {
    "@type": "Person",
    name: "Austin Graham",
    jobTitle: "Public Insurance Adjuster",
  },
  sameAs: [site.url],
};

export async function LocalBusinessJsonLd() {
  const nonce = (await headers()).get("x-nonce") ?? undefined;

  return (
    <script
      nonce={nonce}
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: serialize(localBusiness) }}
    />
  );
}
