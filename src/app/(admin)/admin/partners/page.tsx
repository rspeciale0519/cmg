import type { Metadata } from "next";
import { UpcomingSurface } from "@/components/admin/upcoming";
import { requireRole } from "@/lib/authz";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Partners",
  robots: { index: false, follow: false },
};

export default async function PartnersPage() {
  await requireRole("owner");

  return (
    <UpcomingSurface eyebrow="Owner" title="Partner companies.">
      Referring contractors, their reps, and the invitations that give them a
      portal. Claims already carry their referring company — you can filter by it
      on the Claims list today.
    </UpcomingSurface>
  );
}
