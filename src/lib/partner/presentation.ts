export type PartnerMilestone = { label: string; at: string };

export function partnerMilestones(summary: {
  lor_signed_at: string | null;
  filed_at: string | null;
  settled_at: string | null;
}): PartnerMilestone[] {
  return [
    { label: "LOR signed", at: summary.lor_signed_at },
    { label: "Filed", at: summary.filed_at },
    { label: "Settled", at: summary.settled_at },
  ].filter((entry): entry is PartnerMilestone => entry.at !== null);
}
