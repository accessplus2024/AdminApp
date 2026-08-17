-- Allow the new web-scraper pipeline (sources/config.json ported into
-- api/cron/scrape-sources.js) to reuse the existing Sentinel tables instead of
-- creating parallel ones: it upserts sentinel_posts rows with source_type='web'
-- (one per site, e.g. "Opportunity Desk") and groups its work under
-- sentinel_research_runs.run_type='web_scraper', exactly like 'instagram'/
-- 'manual' and 'discovery'/'catalog_review' already do for the Instagram flow.

alter table public.sentinel_posts
  drop constraint sentinel_posts_source_type_check;

alter table public.sentinel_posts
  add constraint sentinel_posts_source_type_check
  check (source_type in ('instagram', 'manual', 'web'));

alter table public.sentinel_research_runs
  drop constraint sentinel_research_runs_run_type_check;

alter table public.sentinel_research_runs
  add constraint sentinel_research_runs_run_type_check
  check (run_type in ('discovery', 'manual', 'catalog_review', 'web_scraper'));
