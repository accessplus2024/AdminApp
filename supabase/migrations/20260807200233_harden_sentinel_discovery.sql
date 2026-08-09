-- Discovery has a real queue. Only rows actively being researched remain
-- pending, and duplicate results get a terminal, explainable status.
alter table public.sentinel_posts
  drop constraint sentinel_posts_status_check;

alter table public.sentinel_posts
  add constraint sentinel_posts_status_check
  check (status in ('queued', 'pending', 'screened_out', 'qualified', 'duplicate', 'rejected', 'failed'));

-- A nullable key protects Sentinel-created opportunities without imposing a
-- global uniqueness rule on catalog rows that legitimately share landing pages.
alter table public.opportunities
  add column sentinel_discovery_key text;

create unique index opportunities_sentinel_discovery_key_idx
  on public.opportunities (sentinel_discovery_key)
  where sentinel_discovery_key is not null;

create index sentinel_posts_queue_idx
  on public.sentinel_posts (status, score desc, created_at);

-- These rows were marked pending before the candidate limit was applied. They
-- were never started, so preserve them in the new queue for future executions.
update public.sentinel_posts
set status = 'queued',
    error = 'Aguardando uma próxima execução do Sentinel.',
    updated_at = now()
where status = 'pending' and processed_at is null;

-- Merge the duplicate that exposed the discovery race. Keep the first catalog
-- row, preserve both source logs, and discard only the redundant no-change
-- proposal from the same review run.
do $$
declare
  kept_id bigint;
  duplicate_id bigint;
begin
  select min(id), max(id) into kept_id, duplicate_id
  from public.opportunities
  where regexp_replace(lower(trim(link)), '/+$', '') = 'https://thegyn.org/sism-2026'
    and lower(title) like 'sdg innovation summit malaysia 2026%';

  if kept_id is not null and duplicate_id is distinct from kept_id then
    delete from public.sentinel_research_proposals duplicate_proposal
    where duplicate_proposal.opportunity_id = duplicate_id
      and exists (
        select 1 from public.sentinel_research_proposals kept_proposal
        where kept_proposal.run_id = duplicate_proposal.run_id
          and kept_proposal.opportunity_id = kept_id
      );

    update public.sentinel_research_proposals set opportunity_id = kept_id where opportunity_id = duplicate_id;
    update public.newsletter_entries set opportunity_id = kept_id where opportunity_id = duplicate_id;
    update public.comments set opportunity_id = kept_id where opportunity_id = duplicate_id;
    update public.sentinel_posts
      set opportunity_id = kept_id,
          status = case when opportunity_id = duplicate_id then 'duplicate' else status end,
          error = case when opportunity_id = duplicate_id then 'Duplicada: mesmo link oficial e nome equivalente.' else error end
      where opportunity_id in (kept_id, duplicate_id);
    delete from public.opportunities where id = duplicate_id;
    update public.opportunities
      set sentinel_discovery_key = 'https://thegyn.org/sism-2026|sdg innovation summit malaysia 2026'
      where id = kept_id;
  end if;
end $$;

comment on column public.opportunities.sentinel_discovery_key is
  'Stable key used only by Sentinel discovery to prevent duplicate inserts.';
