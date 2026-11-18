import "server-only";
import { notFound } from "next/navigation";
import { loadClaimContext } from "@/lib/claims/queries";
import { createClient } from "@/lib/supabase/server";
import { collectPostgrestPages } from "@/lib/supabase/collect-pages";
import { legalHandoffSchema, legalMilestoneEntrySchema, legalPackageSnapshotSchema, legalProgressSchema } from "./parse";
import type { LegalProgress } from "./types";

export async function loadLegalWorkspace(claimId: string) {
  const context = await loadClaimContext(claimId);
  if (!context.can.canManage) notFound();
  const client = await createClient();
  const [firms, handoffs, packages, documents, milestones] = await Promise.all([
    collectPostgrestPages((from, to) => client.from("law_firms").select("id,name,contact_name,contact_email,contact_phone,is_active").order("name").order("id").range(from, to)),
    collectPostgrestPages((from, to) => client.from("claim_legal_handoffs").select("id,claim_id,firm_id,firm_snapshot,milestone,prior_status,version,created_at,ended_at,outcome").eq("claim_id", claimId).order("created_at", { ascending: false }).order("id").range(from, to)),
    collectPostgrestPages((from, to) => client.from("claim_legal_packages").select("snapshot").eq("claim_id", claimId).order("created_at", { ascending: false }).order("id").range(from, to)),
    collectPostgrestPages((from, to) => client.from("documents").select("id,original_name,mime,size_bytes,updated_at").eq("claim_id", claimId).order("created_at").order("id").range(from, to)),
    collectPostgrestPages((from, to) => client.from("claim_legal_milestones").select("id,handoff_id,milestone,occurred_on,recorded_at").eq("claim_id", claimId).order("recorded_at").order("id").range(from, to)),
  ]);
  // collectPostgrestPages throws on query failure; a failure is never an empty list.
  return {
    ...context,
    firms,
    handoffs: handoffs.map((row) => legalHandoffSchema.parse(row)),
    packages: packages.map((row) => legalPackageSnapshotSchema.parse(row.snapshot)),
    documents,
    milestones: milestones.map((row) => legalMilestoneEntrySchema.parse(row)),
  };
}

export async function loadLegalProgress(claimId: string): Promise<LegalProgress> {
  const client = await createClient();
  const { data, error } = await client.rpc("claim_legal_progress", { p_claim_id: claimId });
  if (error) throw new Error("Legal progress is unavailable.");
  return legalProgressSchema.parse(data);
}
