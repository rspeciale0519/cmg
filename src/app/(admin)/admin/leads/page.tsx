import type { Metadata } from "next";
import Link from "next/link";
import { EmptyState, PageHeader, Panel } from "@/components/admin/admin-shell";
import { LeadStatusForm } from "@/components/admin/lead-status-form";
import { LeadPill } from "@/components/admin/status-pill";
import { requireStaff } from "@/lib/authz";
import { formatRelative, formatTimestamp } from "@/lib/format";
import { createClient } from "@/lib/supabase/server";
import type { Database } from "@/types/database";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Leads",
  robots: { index: false, follow: false },
};

type LeadStatus = Database["public"]["Enums"]["lead_status"];

const FILTERS = [
  { value: "", label: "All" },
  { value: "new", label: "New" },
  { value: "contacted", label: "Contacted" },
  { value: "converted", label: "Converted" },
  { value: "dismissed", label: "Dismissed" },
] as const satisfies readonly { value: "" | LeadStatus; label: string }[];

function isLeadStatus(value: string): value is LeadStatus {
  return value === "new" || value === "contacted" || value === "converted" || value === "dismissed";
}

/**
 * A list rather than a table: a lead is mostly a paragraph, and the paragraph
 * is the reason to call the person back. Truncating it into a cell would hide
 * the only field that tells the operator what the call is about.
 *
 * §4 gives adjusters read on leads and writes to the owner and assistant, so
 * the status control is simply absent for an adjuster — `leads_update_staff`
 * would return zero rows, and a save button that never saves is worse than no
 * button.
 */
export default async function LeadsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const session = await requireStaff("/admin/leads");
  const raw = await searchParams;
  const statusParam = Array.isArray(raw.status) ? raw.status[0] : raw.status;
  const status = FILTERS.some((filter) => filter.value === statusParam)
    ? (statusParam ?? "")
    : "";

  const supabase = await createClient();
  let query = supabase
    .from("leads")
    .select("id, name, phone, email, message, status, created_at", { count: "exact" })
    .order("created_at", { ascending: false })
    .limit(80);

  if (isLeadStatus(status)) query = query.eq("status", status);

  const { data, count } = await query;
  const leads = data ?? [];
  const canEdit = session.role === "owner" || session.role === "assistant";

  return (
    <>
      <PageHeader
        eyebrow={`${count ?? leads.length} ${status || "total"}`}
        title="Leads."
        lede={
          canEdit
            ? "Enquiries from the contact form. Mark one contacted when you have called back, converted when it becomes a claim."
            : "Enquiries from the contact form, read-only. The owner and the assistant work this list."
        }
      />

      <nav aria-label="Filter leads" className="flex flex-wrap gap-1 pb-[clamp(14px,1.6vw,20px)]">
        {FILTERS.map((filter) => {
          const active = status === filter.value;
          return (
            <Link
              key={filter.value}
              href={filter.value ? `/admin/leads?status=${filter.value}` : "/admin/leads"}
              aria-current={active ? "page" : undefined}
              className={
                active
                  ? "rounded-md border border-accent/45 bg-accent/12 px-[11px] py-[6px] text-[12.5px] leading-[1.4] text-accent no-underline"
                  : "rounded-md border border-transparent px-[11px] py-[6px] text-[12.5px] leading-[1.4] text-ink/55 no-underline transition-colors duration-150 hover:border-ink/14 hover:text-ink"
              }
            >
              {filter.label}
            </Link>
          );
        })}
      </nav>

      <Panel>
        {leads.length === 0 ? (
          <EmptyState headline={status ? `Nothing ${status}.` : "No enquiries yet."}>
            Submissions from the contact form arrive here with the caller&rsquo;s
            number and what they wrote.
          </EmptyState>
        ) : (
          <ul className="divide-y divide-ink/8">
            {leads.map((lead) => (
              <li
                key={lead.id}
                className="px-[clamp(14px,1.6vw,20px)] py-[15px] transition-colors duration-150 hover:bg-ink/[0.03]"
              >
                <div className="flex flex-wrap items-start justify-between gap-x-6 gap-y-3">
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                      <h2 className="text-[14px] font-medium leading-[1.35] tracking-[-0.01em]">
                        {lead.name}
                      </h2>
                      <LeadPill status={lead.status} />
                      <time
                        dateTime={lead.created_at}
                        title={formatTimestamp(lead.created_at)}
                        className="text-[12px] leading-[1.4] text-ink/38"
                      >
                        {formatRelative(lead.created_at)}
                      </time>
                    </div>

                    <p className="mt-[5px] flex flex-wrap gap-x-4 text-[12.5px] leading-[1.5] text-ink/58">
                      <a
                        href={`tel:${lead.phone.replace(/[^\d+]/g, "")}`}
                        className="tabular-nums text-ink/72 no-underline transition-colors duration-150 hover:text-accent"
                      >
                        {lead.phone}
                      </a>
                      {lead.email ? (
                        <a
                          href={`mailto:${lead.email}`}
                          className="text-ink/72 no-underline transition-colors duration-150 hover:text-accent"
                        >
                          {lead.email}
                        </a>
                      ) : null}
                    </p>

                    {lead.message ? (
                      <p className="mt-[9px] max-w-[86ch] whitespace-pre-line text-[13px] leading-[1.65] text-ink/72">
                        {lead.message}
                      </p>
                    ) : (
                      <p className="mt-[9px] text-[13px] leading-[1.6] text-ink/32">
                        No message left.
                      </p>
                    )}
                  </div>

                  <LeadStatusForm
                    leadId={lead.id}
                    status={lead.status}
                    canEdit={canEdit}
                  />
                </div>
              </li>
            ))}
          </ul>
        )}
      </Panel>
    </>
  );
}
