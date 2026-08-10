import type { Metadata } from "next";
import { UpcomingSurface } from "@/components/admin/upcoming";
import { requireRole } from "@/lib/authz";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Settings",
  robots: { index: false, follow: false },
};

export default async function SettingsPage() {
  await requireRole("owner");

  return (
    <UpcomingSurface eyebrow="Owner" title="Settings.">
      Firm details, the default fee percent, and the fields that populate a letter
      of representation.
    </UpcomingSurface>
  );
}
