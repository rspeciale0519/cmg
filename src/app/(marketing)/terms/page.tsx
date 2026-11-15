import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { connection } from "next/server";
import { PolicyPage } from "@/components/marketing/policy-page";
import { policyAvailability } from "@/lib/policies/availability";
import { TERMS_SECTIONS } from "@/lib/policies/content";

export const metadata: Metadata = {
  title: "Website terms",
  description: "How the CMG website, claim workspace, and optional connections operate.",
  robots: { index: false, follow: false },
};

export default async function TermsPage() {
  await connection();
  const availability = policyAvailability();
  if (availability === "hidden") notFound();
  return <PolicyPage title="Website terms" draft={availability === "draft"} sections={TERMS_SECTIONS} />;
}
