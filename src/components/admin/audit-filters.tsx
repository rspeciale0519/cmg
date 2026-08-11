"use client";

import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useTransition } from "react";
import { hasActiveFilters, readAuditFilters } from "@/lib/admin/audit-query";
import { AUDIT_ENTITIES } from "@/lib/admin/audit-vocabulary";
import type { ActorOption } from "@/lib/admin/audit";
import { cx } from "@/lib/cx";
import { AdminSelect } from "./form-controls";

/**
 * Filters live in the URL, like the claims list's. A filtered view of the audit
 * log is the thing an owner sends to an accountant or keeps open while they work
 * through an incident, and both of those need it to be a link.
 *
 * Every control resets the keyset cursor. Without that, narrowing the filter
 * while three pages deep keeps `?before=` from the old result set and lands on a
 * page of the new one chosen by an id that means nothing in it — the reader sees
 * an arbitrary window and no indication that anything is missing.
 *
 * The action list is grouped by subject, because "Claim changed" and "Lead
 * status changed" mean nothing next to each other in one flat list of forty.
 */
export function AuditFilters({ actors }: { actors: ActorOption[] }) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const [isPending, startTransition] = useTransition();

  function go(key: string, value: string) {
    const next = new URLSearchParams(params.toString());
    if (value) next.set(key, value);
    else next.delete(key);
    next.delete("before");
    next.delete("after");

    const query = next.toString();
    startTransition(() => {
      router.replace(query ? `${pathname}?${query}` : pathname, { scroll: false });
    });
  }

  // Read through the same validator the page uses, not off the raw query
  // string. `?from=notadate` is correctly ignored by the query and by every
  // control below, so offering to clear it was the bar contradicting itself:
  // "Clear filters" appeared on a page where nothing was filtered.
  const filters = readAuditFilters(Object.fromEntries(params.entries()));
  const { entity, action, actor, from, to } = filters;
  const filtered = hasActiveFilters(filters);

  // Narrowing the action list to the chosen subject is what keeps the second
  // select usable: pick "Documents" and the forty actions become four.
  const actionGroups = entity
    ? AUDIT_ENTITIES.filter((candidate) => candidate.value === entity)
    : AUDIT_ENTITIES;

  return (
    <div
      className={cx(
        "flex flex-wrap items-end gap-3 pb-[clamp(14px,1.6vw,20px)] transition-opacity duration-150",
        isPending && "opacity-60",
      )}
    >
      <Field label="Subject" htmlFor="admin-entity">
        <AdminSelect
          name="entity"
          value={entity}
          onChange={(event) => go("entity", event.target.value)}
          className="min-w-[170px]"
        >
          <option value="">Everything</option>
          {AUDIT_ENTITIES.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </AdminSelect>
      </Field>

      <Field label="Action" htmlFor="admin-action">
        <AdminSelect
          name="action"
          value={action}
          onChange={(event) => go("action", event.target.value)}
          className="min-w-[196px]"
        >
          <option value="">Any action</option>
          {actionGroups.map((group) => (
            <optgroup key={group.value} label={group.label}>
              {group.actions.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </optgroup>
          ))}
        </AdminSelect>
      </Field>

      <Field label="Who" htmlFor="admin-actor">
        <AdminSelect
          name="actor"
          value={actor}
          onChange={(event) => go("actor", event.target.value)}
          className="min-w-[170px]"
        >
          <option value="">Anyone</option>
          {actors.map((option) => (
            <option key={option.id} value={option.id}>
              {option.name} · {option.role}
            </option>
          ))}
        </AdminSelect>
      </Field>

      <Field label="From" htmlFor="audit-from">
        <DateInput
          id="audit-from"
          value={from}
          max={to || undefined}
          onChange={(value) => go("from", value)}
        />
      </Field>

      <Field label="To" htmlFor="audit-to">
        <DateInput
          id="audit-to"
          value={to}
          min={from || undefined}
          onChange={(value) => go("to", value)}
        />
      </Field>

      {filtered ? (
        <Link
          href={pathname}
          className="pb-[8px] text-[12px] leading-[1.4] text-accent no-underline transition-colors duration-150 hover:text-accent-300"
        >
          Clear filters
        </Link>
      ) : null}
    </div>
  );
}

function Field({
  label,
  htmlFor,
  children,
}: {
  label: string;
  htmlFor: string;
  children: React.ReactNode;
}) {
  return (
    <div className="min-w-0">
      <label
        htmlFor={htmlFor}
        className="mb-[5px] block text-[11px] uppercase leading-[1.4] tracking-[0.13em] text-ink/45"
      >
        {label}
      </label>
      {children}
    </div>
  );
}

/**
 * `color-scheme: dark` rather than a styled wrapper: the native date picker's
 * calendar is drawn by the browser, and on a dark surface the default light
 * panel is the one element on the page that flashes white. It is also the only
 * way to tint the built-in indicator — the pseudo-element is not stylable in
 * every engine, so the property has to do the work.
 */
function DateInput({
  id,
  value,
  min,
  max,
  onChange,
}: {
  id: string;
  value: string;
  min?: string;
  max?: string;
  onChange: (value: string) => void;
}) {
  return (
    <input
      id={id}
      type="date"
      value={value}
      min={min}
      max={max}
      onChange={(event) => onChange(event.target.value)}
      className={cx(
        "min-h-[34px] rounded-md border border-ink/15 bg-canvas/70 px-[9px] py-[6px] text-[13px] leading-[1.5] text-ink [color-scheme:dark]",
        "transition-colors duration-150 hover:border-ink/40 focus-visible:border-accent focus-visible:outline-offset-0",
      )}
    />
  );
}
