import type { Metadata } from "next";
import { UpcomingSurface } from "@/components/admin/upcoming";
import { requireRole } from "@/lib/authz";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Audit",
  robots: { index: false, follow: false },
};

export default async function AuditPage() {
  await requireRole("owner");

  return (
    <UpcomingSurface eyebrow="Owner" title="Audit trail.">
      The whole append-only log, searchable across claims. Each claim already
      shows its own slice on the History tab.
    </UpcomingSurface>
  );
}
