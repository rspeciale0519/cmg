-- Stored paths must remain exact when the service role signs a download.
begin;
set local client_min_messages = warning;
create extension if not exists pgtap with schema extensions;
select plan(42);

select ok(coalesce((select convalidated from pg_constraint
  where conrelid = 'public.documents'::regclass
    and conname = 'documents_storage_path_canonical'), false),
  'the canonical path constraint validates existing document rows');
-- JSONB preserves every policy field without comparing catalog text collations.
select is(
  (select jsonb_build_object('permissive', permissive, 'roles', roles, 'cmd', cmd)
    from pg_policies
    where schemaname = 'public' and tablename = 'documents'
      and policyname = 'documents_insert_claim_path'),
  '{"permissive":"RESTRICTIVE","roles":["authenticated"],"cmd":"INSERT"}'::jsonb,
  'authenticated path restrictions also constrain other permissive insert policies'
);

set local role service_role;

-- These shapes come from upload generators and existing nested claim objects.
-- A multi-event PandaDoc delivery adds a colon and array index to its UUID.
select lives_ok(format(
  $sql$insert into public.documents
    (claim_id, storage_path, original_name, kind, mime, size_bytes, visibility)
    values ('20000000-0000-4000-a000-000000000001', %L,
      'path-check.pdf', 'other', 'application/pdf', 1, 'customer')$sql$,
  path), description)
from (values
  ('claims/20000000-0000-4000-a000-000000000001/33000000-0000-4000-a000-000000000010.pdf',
    'a generated claim upload remains valid'),
  ('claims/20000000-0000-4000-a000-000000000001/33-folder/scan-1.pdf',
    'an ordinary nested claim path remains valid'),
  ('claims/20000000-0000-4000-a000-000000000001/_original33.JPG',
    'underscores and uppercase extensions remain valid'),
  ('claims/20000000-0000-4000-a000-000000000001/pandadoc-33000000-0000-4000-a000-000000000001.pdf',
    'a single-event PandaDoc PDF remains valid'),
  ('claims/20000000-0000-4000-a000-000000000001/pandadoc-33000000-0000-4000-a000-000000000001:1.pdf',
    'a multi-event PandaDoc PDF keeps its existing colon and index'),
  ('intake/33000000-0000-4000-a000-000000000002/33000000-0000-4000-a000-000000000011.pdf',
    'the service role can attach a generated intake path'),
  ('intake/33000000-0000-4000-A000-000000000003/33000000-0000-4000-a000-000000000012.pdf',
    'existing uppercase intake UUIDs remain valid')
) as cases(path, description);

-- These inserts bypass RLS, so a failure must come from a path constraint.
-- In particular, final line terminators must fail both CHECK expression arms.
select throws_ok(format(
  $sql$insert into public.documents
    (claim_id, storage_path, original_name, kind, mime, size_bytes, visibility)
    values ('20000000-0000-4000-a000-000000000001', %L,
      'path-check.pdf', 'other', 'application/pdf', 1, 'customer')$sql$,
  path), '23514'::char(5), null::text, description)
from (values
  ('', 'an empty path is refused'),
  ('claims/20000000-0000-4000-a000-000000000001/', 'an empty leaf is refused'),
  ('claims/20000000-0000-4000-a000-000000000001//evidence.pdf', 'an empty intermediate segment is refused'),
  ('claims/20000000-0000-4000-a000-000000000001/./evidence.pdf', 'a dot segment is refused'),
  ('claims/20000000-0000-4000-a000-000000000001/../evidence.pdf', 'a parent segment is refused'),
  ('claims/20000000-0000-4000-a000-000000000001/folder/../../evidence.pdf', 'nested parent segments are refused'),
  ('claims/20000000-0000-4000-a000-000000000001/.hidden.pdf', 'a leading dot in an object name is refused'),
  ('claims/20000000-0000-4000-a000-000000000001/evidence.pdf?download=other', 'a query delimiter is refused'),
  ('claims/20000000-0000-4000-a000-000000000001/evidence.pdf#other', 'a fragment delimiter is refused'),
  ('claims/20000000-0000-4000-a000-000000000001/evidence%20copy.pdf', 'an encoded space is refused'),
  ('claims/20000000-0000-4000-a000-000000000001/%2e%2e/evidence.pdf', 'encoded parent segments are refused'),
  (E'claims/20000000-0000-4000-a000-000000000001/folder\\evidence.pdf', 'a backslash separator is refused'),
  ('claims/20000000-0000-4000-a000-000000000001/evidence copy.pdf', 'a literal space is refused'),
  ('claims/20000000-0000-4000-a000-000000000001/evidence.pdf' || chr(10), 'a final newline is refused'),
  ('claims/20000000-0000-4000-a000-000000000001/evidence.pdf' || chr(13), 'a final carriage return is refused'),
  ('claims/20000000-0000-4000-a000-000000000001/evidence' || chr(9) || '.pdf', 'an embedded tab is refused'),
  ('claims/20000000-0000-4000-a000-000000000001/evidence.pdf' || chr(127), 'an ASCII delete control is refused'),
  ('/claims/20000000-0000-4000-a000-000000000001/evidence.pdf', 'an absolute path is refused'),
  ('claims/20000000-0000-4000-a000-000000000002/evidence.pdf', 'another claim prefix is refused even for service writes'),
  ('intake/not-a-uuid/evidence.pdf', 'a malformed intake UUID is refused'),
  ('intake/33000000-0000-4000-a000-000000000002/nested/evidence.pdf', 'nested intake paths are refused'),
  ('other/20000000-0000-4000-a000-000000000001/evidence.pdf', 'an unknown storage prefix is refused'),
  ('claims/20000000-0000-4000-a000-000000000001/:leading-colon.pdf', 'a leading colon is refused'),
  ('claims/20000000-0000-4000-a000-000000000001/evidence.pdf;other', 'a semicolon is refused'),
  ('claims/20000000-0000-4000-a000-000000000001/evidence.pdf&other', 'an ampersand is refused'),
  ('claims/20000000-0000-4000-a000-000000000001/evidence+.pdf', 'a plus sign is refused'),
  ('intake/33000000-0000-4000-a000-000000000002/evidence.pdf' || chr(10), 'a final newline in an intake path is refused')
) as cases(path, description);

reset role;
set local request.jwt.claims = '{"sub":"00000000-0000-4000-a000-000000000001","role":"authenticated","aal":"aal2"}';
set local role authenticated;

select lives_ok(
  $$insert into public.documents
    (claim_id, storage_path, original_name, kind, mime, size_bytes, uploaded_by, visibility)
    values ('20000000-0000-4000-a000-000000000001',
      'claims/20000000-0000-4000-a000-000000000001/33-owner.pdf',
      'owner.pdf', 'other', 'application/pdf', 1,
      '00000000-0000-4000-a000-000000000001', 'internal')$$,
  'authorized staff can still insert a document under its claim prefix'
);
select throws_ok(
  $$insert into public.documents
    (claim_id, storage_path, original_name, kind, mime, size_bytes, uploaded_by, visibility)
    values ('20000000-0000-4000-a000-000000000001',
      'intake/33000000-0000-4000-a000-000000000002/33-owner.pdf',
      'owner.pdf', 'other', 'application/pdf', 1,
      '00000000-0000-4000-a000-000000000001', 'internal')$$,
  '42501'::char(5), null::text,
  'even owner staff cannot attach a new intake path through authenticated insert'
);
select results_eq(
  $$update public.documents set original_name = 'changed-label.pdf'
    where storage_path = 'intake/33000000-0000-4000-a000-000000000002/33000000-0000-4000-a000-000000000011.pdf'
    returning original_name$$,
  $$values ('changed-label.pdf'::text)$$,
  'authorized staff can still edit metadata on an existing intake document'
);

reset role;
set local request.jwt.claims = '{"sub":"00000000-0000-4000-a000-000000000004","role":"authenticated"}';
set local role authenticated;

select lives_ok(
  $$insert into public.documents
    (claim_id, storage_path, original_name, kind, mime, size_bytes, uploaded_by, visibility)
    values ('20000000-0000-4000-a000-000000000001',
      'claims/20000000-0000-4000-a000-000000000001/33-customer.pdf',
      'customer.pdf', 'other', 'application/pdf', 1,
      '00000000-0000-4000-a000-000000000004', 'customer')$$,
  'a customer can still insert a document under their own claim prefix'
);
select throws_ok(
  $$insert into public.documents
    (claim_id, storage_path, original_name, kind, mime, size_bytes, uploaded_by, visibility)
    values ('20000000-0000-4000-a000-000000000001',
      'intake/33000000-0000-4000-a000-000000000002/33-customer.pdf',
      'customer.pdf', 'other', 'application/pdf', 1,
      '00000000-0000-4000-a000-000000000004', 'customer')$$,
  '42501'::char(5), null::text,
  'a customer cannot attach a new intake path to their claim'
);
select throws_ok(
  $$insert into public.documents
    (claim_id, storage_path, original_name, kind, mime, size_bytes, uploaded_by, visibility)
    values ('20000000-0000-4000-a000-000000000002',
      'claims/20000000-0000-4000-a000-000000000002/33-other-customer.pdf',
      'customer.pdf', 'other', 'application/pdf', 1,
      '00000000-0000-4000-a000-000000000004', 'customer')$$,
  '42501'::char(5), null::text,
  'a valid path does not authorize a customer to insert on another claim'
);

reset role;
select * from finish();
rollback;
