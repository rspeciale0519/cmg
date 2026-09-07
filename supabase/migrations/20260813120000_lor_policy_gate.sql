-- CMG Property Solutions — a letter of representation names a carrier
--
-- The 20260812120000 migration made `carrier`, `policy_number` and `carrier_tenure`
-- nullable so a referring contractor could send CMG a homeowner and a loss without
-- inventing a policy, and it closed the gap at accept: `acceptIntake` asks the operator
-- for all three when the claim it is accepting has none. It also wrote down, in prose,
-- why it added no database rule to go with them:
--
--     No CHECK re-states the rule for later statuses (e.g. "not null from lor_sent
--     onwards"). It was drafted and dropped: the only writer that could hit it is the LOR
--     dispatch, and a constraint violation there is a raw 23514 on a screen with no field
--     to fix it in. The gap is closed at accept, where there is a form, rather than
--     guarded at a wall with no door.
--
-- Both of its premises were wrong, and this migration exists because they were.
--
--   * "the only writer that could hit it is the LOR dispatch." Accept is not the only
--     door out of `new_intake`. public.allowed_claim_transitions('new_intake') returns
--     `under_review`, the claim detail screen has no status guard, and the status picker
--     on it will move a partner referral straight to `under_review` without the accept
--     form ever opening. From there `under_review → lor_sent` is legal and the letter is
--     drafted from `claims.carrier`.
--
--   * "a wall with no door." There is a door now: the claim Overview carries an editable
--     policy panel, permitted to the owner and the assigned adjuster, and it renders
--     whether the columns are absent or merely wrong. `advanceClaimStatus` refuses the
--     move first, in a sentence that names that panel; the picker renders the move
--     disabled with the same sentence under it.
--
-- So the rule is stated here as well, and it is stated as a transition gate rather than
-- as a CHECK on the columns. That is deliberate. A CHECK would have to be written against
-- every status at or past `lor_sent` and would fire on any UPDATE of a row already there
-- — including a correction to an unrelated column on a settled claim. The transition
-- trigger asks the question once, at the only moment it matters: the move that says the
-- letter has gone out.
--
-- It also sits beside its twin. `enforce_claim_status_transition()` already refuses
-- `lor_sent → lor_signed` without a signed letter on the file (§5), and the app already
-- mirrors that gate in TypeScript so the refusal arrives as a sentence rather than a
-- raised 23514. The new gate is the same rule one step earlier — a letter cannot be
-- called signed without the document, and cannot be called sent without an addressee —
-- and it earns the same double enforcement for the same reason: a service-role writer
-- bypasses RLS and every check in the application, and this is what still refuses it.
--
-- Blank counts as absent. The columns carry no length CHECK, so `''` is reachable, and a
-- carrier of `''` names an insurer no better than null does. `namesAPolicy()` in
-- src/lib/claims/transitions.ts makes the same judgement, so the disabled control, the
-- server action and this trigger cannot disagree about what "present" means.
create or replace function public.enforce_claim_status_transition()
returns trigger
language plpgsql
security definer
set search_path = ''
as $fn$
declare
  v_allowed public.claim_status[];
begin
  v_allowed := public.allowed_claim_transitions(old.status);

  if v_allowed is null or array_length(v_allowed, 1) is null or not (new.status = any (v_allowed)) then
    raise exception 'illegal claim status transition: % -> % (claim %)', old.status, new.status, old.claim_ref
      using errcode = '23514';
  end if;

  -- Gate: a Letter of Representation is addressed to an insurance carrier and cites the
  -- policy it is written against, so a claim that names neither cannot be said to have
  -- sent one. A partner referral is not asked for either (§6) and reaches `under_review`
  -- by two different routes, only one of which collects them.
  if new.status = 'lor_sent'
     and (
       new.carrier is null or btrim(new.carrier) = ''
       or new.policy_number is null or btrim(new.policy_number) = ''
     ) then
    raise exception 'claim % cannot advance to lor_sent without a carrier and a policy number', old.claim_ref
      using errcode = '23514';
  end if;

  -- Gate: representation is only "signed" once a signed LOR document exists (spec §5).
  if new.status = 'lor_signed'
     and not exists (
       select 1 from public.documents d
       where d.claim_id = old.id and d.kind = 'lor_signed'
     ) then
    raise exception 'claim % cannot advance to lor_signed without a document of kind lor_signed', old.claim_ref
      using errcode = '23514';
  end if;

  if new.status = 'lor_signed' then new.lor_signed_at := coalesce(new.lor_signed_at, now()); end if;
  if new.status = 'filed' then new.filed_at := coalesce(new.filed_at, now()); end if;
  if new.status = 'denied' then new.denied_at := coalesce(new.denied_at, now()); end if;
  if new.status = 'settled' then new.settled_at := coalesce(new.settled_at, now()); end if;

  return new;
end;
$fn$;

-- The columns' own comments still say the absence is confined to the intake queue. That
-- was the intent and it is now enforced for the two that a letter cannot be written
-- without; carrier_tenure keeps its comment unamended because it is deliberately not
-- gated — see src/lib/claims/transitions.ts for why a tenure is a triage fact rather than
-- something the letter asserts.
comment on column public.claims.carrier is
  'Null only while a partner referral sits in the intake queue: the referring rep is not asked for it (§6) and staff supply it on accept, or afterwards from the claim Overview. public.enforce_claim_status_transition() refuses lor_sent while it is null or blank.';
comment on column public.claims.policy_number is
  'Null only while a partner referral sits in the intake queue — see claims.carrier. Gated at lor_sent for the same reason: the letter cites the policy.';
