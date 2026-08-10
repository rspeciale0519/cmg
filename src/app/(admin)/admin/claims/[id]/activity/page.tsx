import { EmptyState, Panel, PanelBody } from "@/components/admin/admin-shell";
import { EventComposer } from "@/components/admin/event-composer";
import { VisibilityTag } from "@/components/admin/status-pill";
import { loadClaimContext } from "@/lib/claims/queries";
import { cx } from "@/lib/cx";
import { formatTimestamp, initialsFor } from "@/lib/format";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

const TYPE_LABEL: Record<string, string> = {
  status: "Status",
  note: "Note",
  question: "Question",
  reply: "Reply",
  document: "Document",
  system: "System",
};

export default async function ActivityPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const { can } = await loadClaimContext(id);
  const supabase = await createClient();

  const { data: events } = await supabase
    .from("claim_events")
    .select(
      "id, type, body, visibility, created_at, author_id, author:profiles!claim_events_author_id_fkey(first_name, last_name)",
    )
    .eq("claim_id", id)
    .order("created_at", { ascending: false })
    .limit(120);

  const rows = events ?? [];

  // The newest unanswered question, offered to the composer as a reply target.
  // "Unanswered" is read as "no reply posted after it", which is what a staff
  // member means by the word — the schema does not thread replies to questions,
  // and inventing a link would be a schema change to solve a display problem.
  const newestQuestion = rows.find((event) => event.type === "question");
  const newestReply = rows.find((event) => event.type === "reply");
  const unanswered =
    newestQuestion &&
    (!newestReply ||
      new Date(newestReply.created_at) < new Date(newestQuestion.created_at))
      ? { id: newestQuestion.id, body: newestQuestion.body }
      : null;

  return (
    <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_340px] lg:items-start">
      <Panel title="Activity" meta={`${rows.length} entries`}>
        {rows.length === 0 ? (
          <EmptyState headline="Nothing on the feed yet.">
            Status changes land here automatically. Notes you write and questions
            the homeowner asks appear alongside them.
          </EmptyState>
        ) : (
          <ol className="divide-y divide-ink/8">
            {rows.map((event) => {
              const author = event.author
                ? `${event.author.first_name ?? ""} ${event.author.last_name ?? ""}`.trim()
                : null;
              const isQuestion = event.type === "question";

              return (
                <li
                  key={event.id}
                  className={cx(
                    "px-[clamp(14px,1.6vw,20px)] py-[14px]",
                    isQuestion && "bg-accent/[0.035]",
                  )}
                >
                  <div className="flex items-baseline justify-between gap-x-5 gap-y-1">
                    <p className="flex flex-wrap items-baseline gap-x-3 text-[12px] leading-[1.4]">
                      <span
                        className={cx(
                          "text-[11px] uppercase tracking-[0.12em]",
                          isQuestion ? "text-accent" : "text-ink/38",
                        )}
                      >
                        {TYPE_LABEL[event.type] ?? event.type}
                      </span>
                      <span className="text-ink/62">
                        {author ?? (
                          <span className="text-ink/38">
                            {isQuestion ? "Homeowner" : "System"}
                          </span>
                        )}
                      </span>
                      {author ? (
                        <span
                          aria-hidden="true"
                          className="rounded-full bg-ink/8 px-[6px] py-[1px] text-[10px] tracking-[0.06em] text-ink/40"
                        >
                          {initialsFor(author)}
                        </span>
                      ) : null}
                    </p>
                    <p className="flex shrink-0 items-baseline gap-3 text-[11.5px] leading-[1.4] text-ink/32">
                      <VisibilityTag visibility={event.visibility} />
                      <time dateTime={event.created_at}>
                        {formatTimestamp(event.created_at)}
                      </time>
                    </p>
                  </div>

                  <p className="mt-[7px] max-w-[86ch] whitespace-pre-line text-[13.5px] leading-[1.7] text-ink/82">
                    {event.body}
                  </p>
                </li>
              );
            })}
          </ol>
        )}
      </Panel>

      <div className="grid gap-4">
        {can.canPostNote ? (
          <Panel title={unanswered ? "Answer the homeowner" : "Post an entry"}>
            <PanelBody>
              <EventComposer
                claimId={id}
                canPostShared={can.canPostShared}
                replyTo={unanswered}
              />
            </PanelBody>
          </Panel>
        ) : (
          <Panel title="Post an entry">
            <PanelBody>
              <p className="text-[12.5px] leading-[1.7] text-ink/50">
                Notes and replies on this claim are written by the owner, the
                assigned adjuster, and the assistant.
              </p>
            </PanelBody>
          </Panel>
        )}

        <Panel title="Who reads what">
          <PanelBody>
            <dl className="grid gap-[11px] text-[12.5px] leading-[1.6]">
              <div>
                <dt className="text-ink/72">CMG only</dt>
                <dd className="text-ink/42">
                  Stays inside the firm. Nothing leaves the workspace.
                </dd>
              </div>
              <div>
                <dt className="text-ink/72">Homeowner</dt>
                <dd className="text-ink/42">
                  Appears in their portal and is emailed to them.
                </dd>
              </div>
              <div>
                <dt className="text-ink/72">Partner</dt>
                <dd className="text-ink/42">
                  Goes to the referring contractor, never to the homeowner.
                </dd>
              </div>
              <div>
                <dt className="text-ink/72">Homeowner + partner</dt>
                <dd className="text-ink/42">
                  A milestone both sides of the referral should know about.
                </dd>
              </div>
            </dl>
          </PanelBody>
        </Panel>
      </div>
    </div>
  );
}
