import type { Metadata } from "next";
import { UpcomingSurface } from "@/components/admin/upcoming";
import { requireRole } from "@/lib/authz";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Staff",
  robots: { index: false, follow: false },
};

export default async function StaffPage() {
  await requireRole("owner");

  return (
    <UpcomingSurface eyebrow="Owner" title="Staff.">
      Inviting adjusters and assistants, deactivating an account, and resetting a
      lost authenticator.
    </UpcomingSurface>
  );
}
