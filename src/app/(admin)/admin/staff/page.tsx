import type { Metadata } from "next";
import { EmptyState, PageHeader, Panel, PanelBody } from "@/components/admin/admin-shell";
import { CellMeta, DataTable, Td, Th, Tr } from "@/components/admin/data-table";
import { FormDisclosure } from "@/components/admin/disclosure";
import { ROLE_LABEL } from "@/components/admin/nav";
import {
  StaffActiveForm,
  StaffInviteForm,
  StaffRoleForm,
} from "@/components/admin/staff-forms";
import { loadStaffDirectory } from "@/lib/admin/staff";
import { requireRole } from "@/lib/authz";
import { formatDateStamp, formatRelative } from "@/lib/format";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Staff",
  robots: { index: false, follow: false },
};

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
export default async function StaffPage() {
  const session = await requireRole("owner");
  const { members, pendingInvites, activeOwnerIds } = await loadStaffDirectory();

  const soleOwnerId = activeOwnerIds.length === 1 ? activeOwnerIds[0] : null;
  const active = members.filter((member) => member.isActive).length;
  const unenrolled = members.filter(
    (member) => member.isActive && !member.mfaEnrolled,
  ).length;

  return (
    <>
      <PageHeader
        eyebrow={`Owner · ${active} active of ${members.length}`}
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
          unenrolled > 0
            ? `${unenrolled} without an authenticator`
            : "all authenticators enrolled"
        }
      >
        <DataTable
          caption="Staff accounts with role, access and second-factor state"
          head={
            <>
              <Th className="w-[26%]">Person</Th>
              <Th className="w-[17%]">Role</Th>
              <Th className="w-[16%]">Second factor</Th>
              <Th className="w-[15%]">Last signed in</Th>
              <Th className="w-[26%]">Access</Th>
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
                      <span className="ml-2 text-[11px] font-normal uppercase tracking-[0.14em] text-ink/32">
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

                <Td className="whitespace-nowrap tabular-nums text-ink/50">
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

        <PanelBody className="border-t border-ink/10">
          <h3 className="text-[11px] uppercase leading-[1.4] tracking-[0.13em] text-ink/45">
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
                <span className="text-[12px] uppercase tracking-[0.13em] text-ink/42">
                  {ROLE_LABEL[invite.role]}
                </span>
                <span className="ml-auto text-[12px] text-ink/42">
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
          : "text-[12.5px] leading-[1.45] text-ink/32"
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
