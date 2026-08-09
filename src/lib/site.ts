export const site = {
  name: "CMG Property Solutions",
  tagline: "Licensed Florida public adjusters",
  phone: "407-488-5728",
  email: "Austin@CMGPropertySolutions.net",
  city: "Orlando, Florida",
  serviceArea: "Serving the state of Florida",
  license: "G086165",
  licensee: "Austin Graham, Public Insurance Adjuster",
  url: "https://www.cmgpropertysolutions.net",
} as const;

export const telHref = `tel:${site.phone.replace(/[^\d+]/g, "")}`;
export const emailHref = `mailto:${site.email}`;
