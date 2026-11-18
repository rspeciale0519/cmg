-- Keep parent-row checks bounded for every new foreign key. Retained history
-- still needs these indexes even when its active-work partial index excludes it.
create index law_firms_created_by_idx on public.law_firms(created_by);
create index law_firms_updated_by_idx on public.law_firms(updated_by);
create index claim_legal_handoffs_firm_id_idx on public.claim_legal_handoffs(firm_id);
create index claim_legal_handoffs_created_by_idx on public.claim_legal_handoffs(created_by);
create index claim_legal_packages_claim_id_idx on public.claim_legal_packages(claim_id);
create index claim_legal_packages_created_by_idx on public.claim_legal_packages(created_by);
create index claim_legal_milestones_recorded_by_idx on public.claim_legal_milestones(recorded_by);

create index airtable_oauth_states_company_id_idx on public.airtable_oauth_states(company_id);
create index airtable_claim_links_company_id_idx on public.airtable_claim_links(company_id);
create index airtable_claim_links_authorized_by_idx on public.airtable_claim_links(authorized_by);
create index airtable_shared_messages_claim_id_idx on public.airtable_shared_messages(claim_id);
create index airtable_shared_messages_connection_id_idx on public.airtable_shared_messages(connection_id);
create index airtable_shared_messages_author_id_idx on public.airtable_shared_messages(author_id);
create index airtable_delivery_requests_connection_id_idx on public.airtable_delivery_requests(connection_id);
