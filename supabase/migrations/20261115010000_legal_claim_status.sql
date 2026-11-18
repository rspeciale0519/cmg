-- Separate transaction: PostgreSQL must commit a new enum value before use.
alter type public.claim_status add value if not exists 'with_law_firm';
