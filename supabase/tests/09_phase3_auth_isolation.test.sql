-- CMG Property Solutions — split pgTAP wrapper.
-- The assertion bodies live in non-discovered support fragments so this file keeps
-- one transaction and the original plan while remaining below the source LOC limit.

begin;
set local client_min_messages = warning;
create extension if not exists pgtap with schema extensions;

select plan(54);

\ir support/09_phase3_auth_isolation_part_1.inc

select * from finish();
rollback;
