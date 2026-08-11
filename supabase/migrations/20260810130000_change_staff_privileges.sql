-- CMG Property Solutions — "the workspace always keeps one active owner", enforced
-- where it can actually hold
--
-- WHY THIS MIGRATION EXISTS
--
-- src/lib/staff/guards.ts already refuses a change that would leave zero active owners,
-- and the reasoning there is right: if the last active owner is demoted or deactivated,
-- the predicate that authorises undoing it — public.guard_profile_privileges(), which
-- requires an *active owner* — can never again be satisfied by any user. The workspace
-- becomes repairable only with the service-role key.
--
-- What that guard cannot do is hold under concurrency. It runs as
--
--     1. read the roster           (PostgREST round trip)
--     2. decide                    (Node)
--     3. update the profile        (a second, separate PostgREST round trip)
--
-- and there is no transaction spanning the three. Two owners demoting each other at the
-- same moment each read a roster containing two active owners, each conclude that one
-- will remain, and each commit. The workspace ends with none — the exact state the guard
-- exists to prevent, reached without either caller doing anything wrong. It is a narrow
-- window and it is not exploitable by an outsider (both actors must already be owners),
-- but the consequence is unrecoverable from inside the product, which is what makes a
-- rare race worth closing rather than documenting.
--
-- WHY A FUNCTION AND NOT A TRIGGER
--
-- A BEFORE UPDATE trigger on public.profiles would be the obvious move and is the wrong
-- one here, for the reason src/lib/staff/guards.ts sets out: it would also fire for the
-- service-role paths that legitimately rebuild a workspace — the seed, a restore, an
-- offboarding migration — and supabase/tests/04_rls_roles.test.sql deactivates owner
-- accounts on purpose to prove other guards hold. A trigger cannot tell "the staff screen
-- is about to strand the workspace" from "a developer is rebuilding it".
--
-- So the atomicity is added where the *screen's* rule already lives, by giving that rule
-- one statement to happen in. Everything else about the write is unchanged:
--
--   * SECURITY INVOKER, so `profiles_update_owner` still decides whether the UPDATE is
--     admitted at all and public.guard_profile_privileges() still refuses any caller who
--     is not an active owner. This function adds a fourth layer; it replaces none of the
--     three, and it grants nothing a direct UPDATE would not have granted.
--   * Direct service-role UPDATEs do not pass through here and are unaffected.
--
-- WHY `for update` AS WELL AS THE COUNT
--
-- The count alone is not enough. Two concurrent transactions in READ COMMITTED each see
-- a snapshot taken before the other's write, so both could count one surviving owner and
-- both commit. Locking every currently-active owner row first forces the second
-- transaction to wait for the first to commit and then re-read — at which point its count
-- is taken against the post-demotion truth and the raise fires. The lock is taken before
-- the write so the ordering cannot deadlock against itself, and it is scoped to the
-- handful of rows that can hold an owner account rather than to the table.

set check_function_bodies = off;

-- ---------------------------------------------------------------------------
-- private.active_owner_count()
-- ---------------------------------------------------------------------------
--
-- "How many active owners does the workspace have?", answered outside the caller's
-- RLS view. That distinction is the whole reason this exists, and it is what made the
-- control below unusable in the one case it most needed to work.
--
-- public.change_staff_privileges() is SECURITY INVOKER, so its post-update re-count ran
-- under the caller's policies. When the caller deactivates *itself*, the UPDATE has
-- already set its own is_active = false by the time the count runs;
-- private.current_app_role() filters on is_active and returns NULL, private.is_staff()
-- goes false, and `profiles_select_self_or_staff` then matches zero rows — including the
-- caller's own row, because the self branch is `id = auth.uid()` on a policy the caller
-- can no longer satisfy through the staff branch either. The count read 0 no matter how
-- many owners were actually left, CMG01 fired, and the server action rendered the
-- last-owner refusal: "promote a second owner first" told to an owner while two or three
-- active owners were sitting in the table. There was no state in which an owner could
-- deactivate their own account.
--
-- Reproduced before the fix: with three active owners, O1 deactivating another owner
-- succeeded and O1 deactivating itself raised CMG01 with three owners still active.
--
-- SECURITY DEFINER is therefore not a convenience here — it is the only way to ask the
-- question the invariant is about ("does an administrator survive this?") rather than the
-- question RLS answers ("can this caller still see one?"). It leaks nothing: the return is
-- a single integer over a predicate the caller already knows the shape of, it takes no
-- arguments, and it cannot be pointed at another table.
create or replace function private.active_owner_count()
returns integer
language sql
security definer
set search_path = ''
as $fn$
  select count(*)::int
    from public.profiles
   where role = 'owner' and is_active;
$fn$;

revoke all on function private.active_owner_count() from public, anon;
grant execute on function private.active_owner_count() to authenticated, service_role;

-- ---------------------------------------------------------------------------
-- public.change_staff_privileges()
-- ---------------------------------------------------------------------------
--
-- One role and/or activation change, with the "at least one active owner" invariant
-- checked against the result inside the same transaction. `null` means "leave alone",
-- which is what lets one function serve both controls on the staff screen without either
-- of them silently restating the other's value from a stale read.
--
-- Raises `CMG01` when the change would strand the workspace. A distinct SQLSTATE rather
-- than 42501: the caller is a legitimate active owner and nothing about their authority
-- is in question, so the server action must be able to answer with the sentence that
-- explains the rule instead of the one that says they are not allowed to be here.
create or replace function public.change_staff_privileges(
  p_target uuid,
  p_role public.app_role default null,
  p_active boolean default null
)
returns public.profiles
language plpgsql
security invoker
set search_path = ''
as $fn$
declare
  v_row public.profiles;
  v_active_owners integer;
begin
  if p_role is null and p_active is null then
    raise exception 'change_staff_privileges was asked to change nothing'
      using errcode = '22023';
  end if;

  -- §7.2's second factor, stated here as well as inherited. `profiles_update_owner` is
  -- private.is_owner(), which now goes false at aal1, so an aal1 caller's UPDATE below
  -- already matches nothing — but it would then fall into the "that account is not
  -- available, or it no longer exists" arm, which describes the target when the problem is
  -- the session. Worth its own sentence on the one control that hands out roles.
  --
  -- It also closes the p_target = self case cleanly. `profiles_update_self` admits a caller
  -- onto their own row on identity alone, so without this the aal1 self-demotion travels
  -- all the way down to public.guard_profile_privileges() before being refused.
  if not private.has_aal2() then
    raise exception 'changing a staff privilege requires a session that has completed two-step verification'
      using errcode = '42501';
  end if;

  -- Serialises this against any other call. RLS applies to the lock as well: an owner
  -- passes `profiles_update_owner`, and anyone else is refused here rather than after
  -- having already written something.
  --
  -- Kept, though public.guard_profile_privileges() now takes pg_advisory_xact_lock() on
  -- the same invariant and therefore covers this path too. The two do not contend: this
  -- one is taken first and the advisory lock second, in that order on every caller, and a
  -- REST-path writer holds only its own row before queueing on the advisory token — so
  -- there is no cycle for either to wait in. The trigger is what makes the guarantee
  -- universal; this remains the narrower, earlier refusal for the RPC's own callers.
  perform 1
    from public.profiles p
   where p.role = 'owner' and p.is_active
     for update;

  update public.profiles
     set role = coalesce(p_role, role),
         is_active = coalesce(p_active, is_active)
   where id = p_target
  returning * into v_row;

  -- Zero rows is `profiles_update_owner` declining, which is not an error condition in
  -- PostgREST's eyes. Raised so the caller cannot mistake a refusal for a success.
  if v_row.id is null then
    raise exception 'that account is not available, or it no longer exists'
      using errcode = '42501';
  end if;

  -- private.active_owner_count() and not a SELECT here. The count has to be taken over
  -- the whole table, and this function runs as the caller — who, one statement ago, may
  -- have deactivated themselves and thereby stopped satisfying the SELECT policy on
  -- public.profiles. An inline count read 0 in exactly that case and refused the only
  -- change it was never supposed to refuse. See the helper for the full account.
  v_active_owners := private.active_owner_count();

  if v_active_owners = 0 then
    raise exception 'this change would leave the workspace with no active owner'
      using errcode = 'CMG01';
  end if;

  return v_row;
end;
$fn$;

-- The grant pair every routine in this schema repeats. `revoke all ... from public` first:
-- Postgres grants EXECUTE to PUBLIC on every function at creation, and 00_schema.test.sql
-- pins that no routine in public is executable by anon.
revoke all on function public.change_staff_privileges(uuid, public.app_role, boolean)
  from public, anon;
grant execute on function public.change_staff_privileges(uuid, public.app_role, boolean)
  to authenticated, service_role;
