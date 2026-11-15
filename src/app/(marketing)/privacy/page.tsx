import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { connection } from "next/server";
import { PolicyPage } from "@/components/marketing/policy-page";
import { policyAvailability } from "@/lib/policies/availability";
import { PRIVACY_SECTIONS } from "@/lib/policies/content";

export const metadata: Metadata = {
  title: "Privacy notice",
  description: "How CMG uses information for its website and claim services.",
  robots: { index: false, follow: false },
};

export default async function PrivacyPage() {
  await connection();
  const availability = policyAvailability();
  if (availability === "hidden") notFound();
  return <PolicyPage title="Privacy notice" draft={availability === "draft"} sections={PRIVACY_SECTIONS} />;
}
