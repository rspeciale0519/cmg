import type { Metadata } from "next";
import { EmptyState, PageHeader, Panel, PanelBody } from "@/components/admin/admin-shell";
import { CellMeta, DataTable, Td, Th, Tr } from "@/components/admin/data-table";
import { FormDisclosure } from "@/components/admin/disclosure";
import { ListPager } from "@/components/admin/list-pager";
import { ROLE_LABEL } from "@/components/admin/nav";
import {
  StaffActiveForm,
  StaffInviteForm,
  StaffRoleForm,
} from "@/components/admin/staff-forms";
import {
  clampPage,
  firstParam,
  offsetBounds,
  parsePageNumber,
} from "@/lib/admin/paging";
import { loadStaffDirectory, STAFF_PAGE_SIZE } from "@/lib/admin/staff";
import { metadataForRole, requireRole } from "@/lib/authz";
import { formatDateStamp, formatRelative } from "@/lib/format";

export const dynamic = "force-dynamic";

/* `generateMetadata` and not `export const metadata`, because a static title is
   emitted whether or not the component below ever renders — so a non-owner got
   the workspace 404 in the body and this page's real name in the tab. See
   `metadataForRole`. */
export async function generateMetadata(): Promise<Metadata> {
  return metadataForRole(["owner"], "Staff");
}

/**
 * Owner only, and a non-owner gets `notFound()` rather than a 403 (spec §7.9).
 *
 * Two rules the database enforces are stated on this page rather than left to be
 * discovered as errors, because both of them are irreversible from inside the
 * product:
 *
 *   * `guard_profile_privileges()` refuses a role, partner or activation change
 *     from anyone who is not an *active* owner — including the account making
 *     the change about itself. So a deactivated owner cannot re-enable
 *     themselves: the actor lookup filters on `is_active`, finds no row, and the
 *     refusal fires.
 *   * Which is why the last active owner cannot be deactivated or demoted at
 *     all. `strandsWorkspace()` refuses it in the server action before the write
 *     is attempted, since if it landed there would be no active owner left to
 *     satisfy the trigger and undo it — the workspace would only be repairable
 *     with the service-role key.
 *
 * The controls that would break either rule are disabled *and* say why, and the
 * server action refuses the same change independently — the disabled attribute
 * is a courtesy, not the enforcement.
 */
export default async function StaffPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const session = await requireRole("owner");
  const raw = await searchParams;

  const firstPass = await loadStaffDirectory();
  const page = clampPage(
    parsePageNumber(firstParam(raw, "page")),
    firstPass.total,
    STAFF_PAGE_SIZE,
  );
  const bounds = offsetBounds(page, STAFF_PAGE_SIZE);
  const directory =
    page === 1 ? firstPass : await loadStaffDirectory(bounds.from, bounds.to);

  const { members, pendingInvites, activeOwnerIds, total, activeTotal, unenrolledTotal } =
    directory;

  const soleOwnerId = activeOwnerIds.length === 1 ? activeOwnerIds[0] : null;

  const pageHref = (target: number) =>
    target > 1 ? `/admin/staff?page=${target}` : "/admin/staff";

  return (
    <>
      <PageHeader
        eyebrow={`Owner · ${activeTotal} active of ${total}`}
        title="Staff."
        lede="Who holds a CMG account, what they can do with it, and whether they have set up the authenticator the workspace requires."
      />

      <FormDisclosure
        summary="Invite a colleague"
        hint="adjuster or assistant"
        className="mb-[clamp(14px,1.6vw,20px)]"
      >
        <StaffInviteForm />
      </FormDisclosure>

      <Panel
        title="Accounts"
        meta={
          unenrolledTotal > 0
            ? `${unenrolledTotal} without an authenticator`
            : "all authenticators enrolled"
        }
      >
        <DataTable
          caption="Staff accounts with role, access and second-factor state"
          head={
            <>
              {/* Role is 25% rather than 17% because the column has two states
                  and was sized for the quieter one. Changing a role reveals a
                  Save button beside the select, and at the table's 860px floor
                  — which is every viewport from a phone to a small laptop — the
                  cell needed 198px of content in 146px of box. The button drew
                  380.6→439 against a cell ending at 386.8, so it sat on top of
                  the next column's "Not enrolled". The eight points come off
                  Person and Access, both of which hold text that wraps or
                  truncates rather than a control that cannot. */}
              <Th className="w-[22%]">Person</Th>
              <Th className="w-[25%]">Role</Th>
              <Th className="w-[16%]">Second factor</Th>
              <Th className="w-[15%]">Last signed in</Th>
              <Th className="w-[22%]">Access</Th>
            </>
          }
        >
          {members.map((member) => {
            const isSelf = member.id === session.userId;
            const isSoleOwner = member.id === soleOwnerId;

            return (
              <Tr key={member.id} className={member.isActive ? undefined : "opacity-70"}>
                <Td>
                  <span className="block truncate font-medium text-ink">
                    {member.name}
                    {isSelf ? (
                      <span className="ml-2 text-[11px] font-normal uppercase tracking-[0.14em] text-ink/58">
                        you
                      </span>
                    ) : null}
                  </span>
                  <CellMeta>{member.email ?? "—"}</CellMeta>
                </Td>

                <Td>
                  <StaffRoleForm
                    staffId={member.id}
                    role={member.role}
                    disabled={isSoleOwner}
                    disabledReason={
                      isSoleOwner
                        ? "The only active owner has to stay an owner."
                        : undefined
                    }
                  />
                </Td>

                <Td>
                  <MfaState enrolled={member.mfaEnrolled} isActive={member.isActive} />
                </Td>

                <Td className="whitespace-nowrap tabular-nums text-ink/58">
                  {member.lastSignInAt ? formatRelative(member.lastSignInAt) : "Never"}
                </Td>

                <Td>
                  <div className="flex flex-col gap-[7px]">
                    <AccessState isActive={member.isActive} />
                    <StaffActiveForm
                      staffId={member.id}
                      name={member.name}
                      isActive={member.isActive}
                      isSelf={isSelf}
                      disabled={isSoleOwner}
                      disabledReason={
                        isSoleOwner
                          ? "This is the only active owner. Promote a second owner first."
                          : undefined
                      }
                    />
                  </div>
                </Td>
              </Tr>
            );
          })}
        </DataTable>

        <ListPager
          label="Staff pages"
          noun="account"
          pluralNoun="accounts"
          placement="footer"
          shown={members.length}
          total={total}
          prevHref={page > 1 ? pageHref(page - 1) : null}
          nextHref={bounds.from + members.length < total ? pageHref(page + 1) : null}
          startHref={page > 1 ? pageHref(1) : null}
        />

        <PanelBody className="border-t border-ink/10">
          <h3 className="text-[11px] uppercase leading-[1.4] tracking-[0.13em] text-ink/55">
            How access works here
          </h3>
          <ul className="mt-[9px] grid max-w-[86ch] gap-[7px] text-[12.5px] leading-[1.65] text-ink/58">
            <li>
              Role, partner assignment and activation are changed by an active
              owner and by nobody else. That is a database trigger, not a screen
              rule — it holds for anything that reaches the table.
            </li>
            <li>
              A deactivated owner cannot restore themselves. The trigger looks the
              actor up with <code className="text-ink/72">is_active</code> in the
              predicate, so a disabled account finds no role and is refused. Ask
              another active owner.
            </li>
            <li>
              For that reason the workspace always keeps one active owner. The
              last one cannot be deactivated or demoted — there would be nobody
              left who could put it back.
            </li>
            <li>
              Staff sign-in requires an authenticator app. Someone who has not
              enrolled can sign in but cannot open the workspace until they do.
            </li>
          </ul>
        </PanelBody>
      </Panel>

      <Panel
        title="Awaiting acceptance"
        className="mt-[clamp(16px,2vw,24px)]"
        meta={pendingInvites.length > 0 ? `${pendingInvites.length} live` : undefined}
      >
        {pendingInvites.length === 0 ? (
          <EmptyState headline="No invitations are outstanding.">
            An invitation is live for 72 hours and works once. Sending a new one
            to the same address cancels the previous link.
          </EmptyState>
        ) : (
          <ul className="divide-y divide-ink/8">
            {pendingInvites.map((invite) => (
              <li
                key={invite.id}
                className="flex flex-wrap items-baseline gap-x-4 gap-y-1 px-[clamp(14px,1.6vw,20px)] py-[12px] text-[13px] leading-[1.5]"
              >
                <span className="text-ink/85">{invite.email}</span>
                <span className="text-[12px] uppercase tracking-[0.13em] text-ink/55">
                  {ROLE_LABEL[invite.role]}
                </span>
                <span className="ml-auto text-[12px] text-ink/55">
                  expires {formatDateStamp(invite.expiresAt)}
                </span>
              </li>
            ))}
          </ul>
        )}
      </Panel>
    </>
  );
}

/**
 * Not a pill. A pill in this workspace means "this row is in this state", and
 * both of these are facts about an account rather than its state — rendering
 * four pills per row would make the table read as four competing statuses.
 *
 * "Not enrolled" takes the accent because it is the one thing here that is
 * someone's job to fix (spec §7.2 requires staff MFA), which is exactly the rule
 * `status-pill.tsx` sets for gold in this product. It is muted on a deactivated
 * account: an account that cannot sign in has nothing to enrol.
 */
function MfaState({ enrolled, isActive }: { enrolled: boolean; isActive: boolean }) {
  if (enrolled) {
    return (
      <span className="text-[12.5px] leading-[1.45] text-ink/72">
        Authenticator on
      </span>
    );
  }

  return (
    <span
      className={
        isActive
          ? "text-[12.5px] leading-[1.45] text-accent-300"
          : "text-[12.5px] leading-[1.45] text-ink/58"
      }
    >
      Not enrolled
    </span>
  );
}

function AccessState({ isActive }: { isActive: boolean }) {
  return (
    <span
      className={
        isActive
          ? "text-[12.5px] leading-[1.45] text-ink/72"
          : "text-[12.5px] leading-[1.45] text-[#E8A98D]"
      }
    >
      {isActive ? "Can sign in" : "Signed out everywhere"}
    </span>
  );
}
