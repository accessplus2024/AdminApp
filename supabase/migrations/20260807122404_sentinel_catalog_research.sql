create table public.sentinel_research_runs (
  id bigint generated always as identity primary key,
  run_type text not null
    check (run_type in ('discovery', 'manual', 'catalog_review')),
  status text not null default 'running'
    check (status in ('running', 'completed', 'partial', 'failed')),
  requested_count integer not null default 0 check (requested_count >= 0),
  processed_count integer not null default 0 check (processed_count >= 0),
  succeeded_count integer not null default 0 check (succeeded_count >= 0),
  failed_count integer not null default 0 check (failed_count >= 0),
  model text not null default 'z-ai/glm-5.2',
  prompt_version text not null default 'catalog-review-v1',
  model_calls integer not null default 0 check (model_calls >= 0),
  page_fetches integer not null default 0 check (page_fetches >= 0),
  input_tokens bigint not null default 0 check (input_tokens >= 0),
  output_tokens bigint not null default 0 check (output_tokens >= 0),
  metadata jsonb not null default '{}'::jsonb,
  error text,
  created_by uuid references auth.users(id) on delete set null default auth.uid(),
  started_at timestamptz not null default now(),
  completed_at timestamptz,
  created_at timestamptz not null default now()
);

create table public.sentinel_research_proposals (
  id bigint generated always as identity primary key,
  run_id bigint not null references public.sentinel_research_runs(id) on delete cascade,
  opportunity_id bigint references public.opportunities(id) on delete set null,
  status text not null default 'pending'
    check (status in ('pending', 'approved', 'partially_approved', 'rejected', 'no_changes', 'failed')),
  source_url text,
  original jsonb not null default '{}'::jsonb,
  proposed jsonb not null default '{}'::jsonb,
  changes jsonb not null default '{}'::jsonb,
  evidence jsonb not null default '{}'::jsonb,
  notes text,
  approved_fields text[] not null default '{}',
  model_calls integer not null default 0 check (model_calls >= 0),
  page_fetches integer not null default 0 check (page_fetches >= 0),
  input_tokens bigint not null default 0 check (input_tokens >= 0),
  output_tokens bigint not null default 0 check (output_tokens >= 0),
  error text,
  reviewed_by uuid references auth.users(id) on delete set null,
  reviewed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (run_id, opportunity_id)
);

alter table public.sentinel_posts
  add column run_id bigint references public.sentinel_research_runs(id) on delete set null;

create index sentinel_research_runs_status_idx
  on public.sentinel_research_runs (status, started_at desc);
create index sentinel_research_runs_created_by_idx
  on public.sentinel_research_runs (created_by);
create index sentinel_research_proposals_run_status_idx
  on public.sentinel_research_proposals (run_id, status);
create index sentinel_research_proposals_opportunity_idx
  on public.sentinel_research_proposals (opportunity_id, created_at desc);
create index sentinel_research_proposals_reviewed_by_idx
  on public.sentinel_research_proposals (reviewed_by);
create index sentinel_posts_run_id_idx
  on public.sentinel_posts (run_id);

alter table public.sentinel_research_runs enable row level security;
alter table public.sentinel_research_proposals enable row level security;

create policy "team reads sentinel research runs"
  on public.sentinel_research_runs for select to authenticated
  using ((select public.my_role()) is not null);
create policy "editors create sentinel research runs"
  on public.sentinel_research_runs for insert to authenticated
  with check ((select public.my_role()) = any (array['Admin', 'Editor']));
create policy "editors update sentinel research runs"
  on public.sentinel_research_runs for update to authenticated
  using ((select public.my_role()) = any (array['Admin', 'Editor']))
  with check ((select public.my_role()) = any (array['Admin', 'Editor']));
create policy "editors delete sentinel research runs"
  on public.sentinel_research_runs for delete to authenticated
  using ((select public.my_role()) = any (array['Admin', 'Editor']));

create policy "team reads sentinel research proposals"
  on public.sentinel_research_proposals for select to authenticated
  using ((select public.my_role()) is not null);
create policy "editors create sentinel research proposals"
  on public.sentinel_research_proposals for insert to authenticated
  with check ((select public.my_role()) = any (array['Admin', 'Editor']));
create policy "editors update sentinel research proposals"
  on public.sentinel_research_proposals for update to authenticated
  using ((select public.my_role()) = any (array['Admin', 'Editor']))
  with check ((select public.my_role()) = any (array['Admin', 'Editor']));
create policy "editors delete sentinel research proposals"
  on public.sentinel_research_proposals for delete to authenticated
  using ((select public.my_role()) = any (array['Admin', 'Editor']));

revoke all on public.sentinel_research_runs from anon;
revoke all on public.sentinel_research_proposals from anon;
grant select, insert, update, delete on public.sentinel_research_runs to authenticated;
grant select, insert, update, delete on public.sentinel_research_proposals to authenticated;
grant usage, select on sequence public.sentinel_research_runs_id_seq to authenticated;
grant usage, select on sequence public.sentinel_research_proposals_id_seq to authenticated;

comment on table public.sentinel_research_runs is
  'One Sentinel execution with aggregate API-call and token usage for coordination.';
comment on table public.sentinel_research_proposals is
  'Reviewable before/after field proposals for existing catalog opportunities.';
