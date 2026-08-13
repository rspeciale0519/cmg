-- CMG Property Solutions — split pgTAP wrapper.
-- The assertion bodies live in non-discovered support fragments so this file keeps
-- one transaction and the original plan while remaining below the source LOC limit.

begin;
set local client_min_messages = warning;
create extension if not exists pgtap with schema extensions;

select plan(66);

\ir support/08_round4_regressions_part_1.inc
\ir support/08_round4_regressions_part_2.inc
\ir support/08_round4_regressions_part_3.inc

select * from finish();
rollback;
