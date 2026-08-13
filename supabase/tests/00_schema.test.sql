-- CMG Property Solutions — structural guarantees the access matrix rests on.
-- If any assertion here fails, every row-level test in this suite is meaningless:
-- these are the invariants (RLS armed, anon powerless, audit append-only) that the
-- policies assume rather than restate.

begin;
set local client_min_messages = warning;
create extension if not exists pgtap with schema extensions;

select plan(61);

-- ---------------------------------------------------------------------------
-- Every relation the platform stores data in actually exists
-- ---------------------------------------------------------------------------

select has_table('public'::name, 'profiles'::name,
  'user identities and roles are stored in a table the platform owns, not in auth metadata');
select has_table('public'::name, 'partner_companies'::name,
  'referring contractors are first-class rows, so partner scoping can key off a company id');
select has_table('public'::name, 'leads'::name,
  'contact-form submissions land in their own table, separate from claims');
select has_table('public'::name, 'claim_ref_counters'::name,
  'human-readable claim references are minted from a persisted counter, not from a guessable id');
select has_table('public'::name, 'claims'::name,
  'the claim record exists');
select has_table('public'::name, 'claim_financials'::name,
  'settlement money lives in its own relation, because RLS cannot hide a column');
select has_table('public'::name, 'claimants'::name,
  'homeowners are rows linked to auth users, which is how a customer proves ownership of a claim');
select has_table('public'::name, 'claim_status_history'::name,
  'every status change is recorded in an append-only history relation');
select has_table('public'::name, 'claim_events'::name,
  'the activity feed exists and carries its own visibility column');
select has_table('public'::name, 'documents'::name,
  'uploaded files are described by rows whose visibility drives both table and storage access');
select has_table('public'::name, 'consents'::name,
  'SMS and email consent snapshots are retained as evidence');
select has_table('public'::name, 'invites'::name,
  'account provisioning happens through hashed single-use invite rows');
select has_table('public'::name, 'audit_log'::name,
  'an audit trail exists to record who touched what');
select has_table('public'::name, 'notifications_outbox'::name,
  'outbound mail is queued transactionally rather than sent inline');
select has_table('public'::name, 'claim_partner_summaries'::name,
  'partners read a purpose-built projection, never the claim record itself');
select has_table('public'::name, 'rate_limits'::name,
  'public-form abuse counters are persisted in the database, not in process memory');
select has_table('public'::name, 'pandadoc_webhook_events'::name,
  'webhook deliveries are deduplicated through a persisted ledger');

-- ---------------------------------------------------------------------------
-- Deny-by-default: RLS armed everywhere, anon powerless, audit append-only
-- ---------------------------------------------------------------------------

select is_empty(
  $$ select c.relname::text
       from pg_class c
       join pg_namespace n on n.oid = c.relnamespace
      where n.nspname = 'public'
        and c.relkind in ('r', 'p')
        and not c.relrowsecurity $$,
  'no table in public can be read without a policy deciding the rows, because RLS is armed on every one of them'
);

select is_empty(
  $$ select c.relname
       from pg_class c
       join pg_namespace n on n.oid = c.relnamespace
      where n.nspname = 'public'
        and c.relkind = 'r'
        and (not exists (select 1 from pg_policy p where p.polrelid = c.oid))
            <> (c.relname in ('claim_ref_counters', 'notifications_outbox',
                              'pandadoc_webhook_events', 'rate_limits',
                              'storage_cleanup_queue', 'esign_dispatch_attempts',
                              'esign_recipient_completions')) $$,
  'only service-role ledgers carry zero policies, so RLS-on-with-no-policy is a deliberate lockout and every client-facing table has an explicit policy'
);

select is_empty(
  $$ select p.polname::text
       from pg_policy p
      where p.polrelid = 'public.audit_log'::regclass
        and p.polcmd in ('w', 'd', '*') $$,
  'the audit trail can never be rewritten or erased from a client session: no UPDATE, DELETE or FOR ALL policy exists on it'
);

select is_empty(
  $$ select priv
       from unnest(array['INSERT','UPDATE','DELETE','TRUNCATE']) as t(priv)
      where has_table_privilege('authenticated', 'public.audit_log', priv) $$,
  'even before policies are consulted, a signed-in session holds no grant that could alter the audit trail'
);

select is_empty(
  $$ select c.relname::text || ':' || t.priv
       from pg_class c
       join pg_namespace n on n.oid = c.relnamespace
       cross join unnest(array['SELECT','INSERT','UPDATE','DELETE','TRUNCATE','REFERENCES','TRIGGER']) as t(priv)
      where n.nspname = 'public'
        and c.relkind in ('r', 'v', 'm', 'p', 'f')
        and has_table_privilege('anon', c.oid, t.priv) $$,
  'a leaked publishable key reads nothing: the anon role holds no privilege of any kind on any relation in public'
);

select is_empty(
  $$ select p.oid::regprocedure::text
       from pg_proc p
       join pg_namespace n on n.oid = p.pronamespace
      where n.nspname = 'public'
        and p.prokind in ('f', 'p')
        and has_function_privilege('anon', p.oid, 'EXECUTE') $$,
  'anon cannot reach the database through a function either — no routine in public is executable by it, including the SECURITY DEFINER helpers'
);

select is_empty(
  $$ select c.relname::text || ':' || t.priv
       from pg_class c
       join pg_namespace n on n.oid = c.relnamespace
       cross join unnest(array['SELECT','INSERT','UPDATE','DELETE']) as t(priv)
      where n.nspname = 'public'
        and c.relname in ('notifications_outbox', 'rate_limits', 'pandadoc_webhook_events', 'claim_ref_counters')
        and has_table_privilege('authenticated', c.oid, t.priv) $$,
  'the outbox, the rate-limit counters, the webhook ledger and the reference counter are unreachable from any signed-in session, service role only'
);

select is_empty(
  $$ select t.priv
       from unnest(array['INSERT','UPDATE','DELETE','TRUNCATE']) as t(priv)
      where has_table_privilege('authenticated', 'public.claim_partner_summaries', t.priv) $$,
  'the partner projection is read-only to clients, so a partner cannot write themselves a settlement figure'
);

-- ---------------------------------------------------------------------------
-- Foreign keys are index-backed (an unindexed FK turns a parent delete into a
-- full scan of the child, and cascade paths here reach claim documents)
-- ---------------------------------------------------------------------------

select is_empty(
  $$ select c.conrelid::regclass::text || '.' || c.conname
       from pg_constraint c
      where c.contype = 'f'
        and c.connamespace = 'public'::regnamespace
        and not exists (
          select 1
            from pg_index i
           where i.indrelid = c.conrelid
             and i.indnkeyatts >= array_length(c.conkey, 1)
             and (select array_agg(i.indkey[k]::smallint order by k)
                    from generate_series(0, array_length(c.conkey, 1) - 1) g(k)) @> c.conkey
             and c.conkey @> (select array_agg(i.indkey[k]::smallint order by k)
                                from generate_series(0, array_length(c.conkey, 1) - 1) g(k))
        ) $$,
  'every foreign key is backed by an index on its own columns, so deleting a claim or a profile cannot degrade into repeated full scans of its children'
);

-- ---------------------------------------------------------------------------
-- Enums: the closed vocabularies the policies and the status machine branch on
-- ---------------------------------------------------------------------------

select enum_has_labels('public'::name, 'app_role'::name,
  array['owner','adjuster','assistant','customer','partner']::name[],
  'exactly five roles exist, so no unexpected role can slip past a policy that enumerates them');

select enum_has_labels('public'::name, 'claim_status'::name,
  array['new_intake','under_review','lor_sent','lor_signed','documenting','filed','negotiating',
        'settlement_offered','settled','closed','denied','reopened','rejected']::name[],
  'the claim lifecycle vocabulary is fixed at the type level, so an unknown status cannot be written at all');

select enum_has_labels('public'::name, 'document_visibility'::name,
  array['internal','customer']::name[],
  'a document is either internal or customer-visible and nothing else, which is what the customer document policy keys on');

select enum_has_labels('public'::name, 'claim_event_visibility'::name,
  array['internal','customer','partner','shared']::name[],
  'feed entries carry a four-way audience marker, letting one table serve staff, customers and partners without leaking across them');

select enum_has_labels('public'::name, 'document_kind'::name,
  array['declarations','photo','contract','lor_unsigned','lor_signed','estimate','denial',
        'correspondence','other']::name[],
  'lor_signed is a distinct document kind, which is what the representation gate looks for');

select enum_has_labels('public'::name, 'claim_event_type'::name,
  array['status','note','question','reply','document','system']::name[],
  'feed entry types are closed, so the customer insert policy can safely allow only question');

select enum_has_labels('public'::name, 'cause_of_loss'::name,
  array['wind','hail','wind_hail','hurricane','water','fire_smoke','flood','mold','other']::name[],
  'cause of loss is constrained to the intake form vocabulary');

select enum_has_labels('public'::name, 'carrier_tenure'::name,
  array['lt_1_year','one_to_two_years','three_plus_years']::name[],
  'carrier tenure is constrained to the intake form vocabulary');

select enum_has_labels('public'::name, 'prior_claim_outcome'::name,
  array['paid_nothing','paid_no_repairs','paid_repaired','unsure']::name[],
  'prior claim outcome is constrained to the intake form vocabulary');

select enum_has_labels('public'::name, 'lead_status'::name,
  array['new','contacted','converted','dismissed']::name[],
  'lead triage states are closed');

select enum_has_labels('public'::name, 'consent_kind'::name,
  array['sms','email']::name[],
  'consent is recorded per channel, which is what TCPA evidence requires');

select enum_has_labels('public'::name, 'outbox_status'::name,
  array['pending','sent','failed','dead']::name[],
  'outbox delivery states are closed, so the sweeper cannot encounter an unhandled state');

select enum_has_labels('public'::name, 'partner_company_status'::name,
  array['active','inactive']::name[],
  'partner companies can be deactivated without being deleted');

-- ---------------------------------------------------------------------------
-- The columns the security model depends on, and the ones it must not have
-- ---------------------------------------------------------------------------

select has_column('public'::name, 'claims'::name, 'claim_ref'::name,
  'claims carry a display reference, so real ids never need to appear in a URL');
select has_column('public'::name, 'claims'::name, 'status'::name,
  'claim status is a column on the claim, guarded by the transition trigger');
select has_column('public'::name, 'claim_financials'::name, 'settlement_amount'::name,
  'the settlement figure lives on the financials relation only');
select has_column('public'::name, 'documents'::name, 'visibility'::name,
  'each document declares its audience, which both the table policy and the storage policy read');
select has_column('public'::name, 'claimants'::name, 'user_id'::name,
  'a claimant row is the link between an auth user and a claim, which is how customer ownership is proven');
select has_column('public'::name, 'profiles'::name, 'role'::name,
  'role is stored server-side on the profile, never taken from a JWT claim the client could forge');
select has_column('public'::name, 'claim_partner_summaries'::name, 'settlement_amount'::name,
  'the projection has a settlement column that the refresh function fills only after settlement');

select hasnt_column('public'::name, 'claim_partner_summaries'::name, 'carrier'::name,
  'a partner cannot learn the carrier even if the projection policy were wrong: the column does not exist');
select hasnt_column('public'::name, 'claim_partner_summaries'::name, 'policy_number'::name,
  'the policy number is structurally absent from the partner projection, not merely filtered out');
select hasnt_column('public'::name, 'claim_partner_summaries'::name, 'description'::name,
  'the homeowner narrative of the loss is structurally absent from the partner projection');
select hasnt_column('public'::name, 'claim_partner_summaries'::name, 'property_zip'::name,
  'the projection carries street and city for recognition but withholds the full address');

-- ---------------------------------------------------------------------------
-- The triggers that enforce behaviour the policies cannot express
-- ---------------------------------------------------------------------------

select has_trigger('public'::name, 'claims'::name, 'claims_enforce_status_transition'::name,
  'the lifecycle is enforced in the database, so a compromised app cannot jump a claim to settled');
select has_trigger('public'::name, 'claims'::name, 'audit_claims'::name,
  'every claim mutation is recorded whether or not the application remembers to log it');
select has_trigger('public'::name, 'documents'::name, 'audit_documents'::name,
  'every document mutation is recorded whether or not the application remembers to log it');
select has_trigger('public'::name, 'claim_status_history'::name, 'audit_claim_status_history'::name,
  'every history append is itself audited');
select has_trigger('public'::name, 'claims'::name, 'claims_refresh_partner_summary'::name,
  'the partner projection is rebuilt by the database on claim change, so it cannot drift from the claim it mirrors');
select has_trigger('public'::name, 'claim_financials'::name, 'claim_financials_refresh_partner_summary'::name,
  'a change to the settlement figure re-derives what partners are allowed to see of it');
select has_trigger('public'::name, 'claimants'::name, 'claimants_refresh_partner_summary'::name,
  'renaming a homeowner propagates to the partner projection instead of leaving a stale name behind');

-- ---------------------------------------------------------------------------
-- Privileged routines
-- ---------------------------------------------------------------------------

select has_function('public'::name, 'check_rate_limit'::name,
  array['text','integer','interval']::name[],
  'public forms are throttled by a database function, so the limit survives a restart and applies across instances');
select has_function('public'::name, 'allowed_claim_transitions'::name,
  array['public.claim_status']::name[],
  'the legal transition set is queryable, so the app and the trigger can agree on one definition');

select is_definer('public'::name, 'next_claim_ref'::name, '{}'::name[],
  'reference minting runs as definer, so the counter stays unreadable to the caller that increments it');
select is_definer('public'::name, 'check_rate_limit'::name,
  array['text','integer','interval']::name[],
  'the throttle runs as definer, so a caller can be counted without being able to read or reset the counters');

select * from finish();
rollback;
