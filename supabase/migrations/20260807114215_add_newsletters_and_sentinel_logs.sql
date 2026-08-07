-- Newsletter issues are editorial records. Catalog opportunities remain the
-- source of truth for the website and are not given newsletter-specific state.
create table public.newsletter_issues (
  id bigint generated always as identity primary key,
  title text not null default '',
  subject text not null default '',
  preheader text not null default '',
  intro text not null default '',
  outro text not null default '',
  campaign_slug text not null default '',
  status text not null default 'draft'
    check (status in ('draft', 'ready', 'published')),
  beehiiv_url text,
  scheduled_at timestamptz,
  published_at timestamptz,
  created_by uuid references auth.users(id) on delete set null default auth.uid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.newsletter_entries (
  id bigint generated always as identity primary key,
  newsletter_id bigint not null references public.newsletter_issues(id) on delete cascade,
  opportunity_id bigint references public.opportunities(id) on delete set null,
  position integer not null check (position >= 0),
  title text not null,
  summary text not null default '',
  eligibility text not null default '',
  deadline text not null default '',
  fees text not null default '',
  link text not null default '',
  created_at timestamptz not null default now(),
  unique (newsletter_id, position),
  unique (newsletter_id, opportunity_id)
);

-- Supabase replaces Sentinel's data/log.json with a queryable processing log.
create table public.sentinel_posts (
  id bigint generated always as identity primary key,
  source_url text not null unique,
  source_type text not null default 'instagram'
    check (source_type in ('instagram', 'manual')),
  owner_username text not null default '',
  caption text not null default '',
  posted_at timestamptz,
  score integer not null default 0,
  status text not null default 'pending'
    check (status in ('pending', 'screened_out', 'qualified', 'rejected', 'failed')),
  opportunity_id bigint references public.opportunities(id) on delete set null,
  extracted jsonb,
  error text,
  processed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index newsletter_issues_status_idx
  on public.newsletter_issues (status, created_at desc);
create index newsletter_entries_opportunity_idx
  on public.newsletter_entries (opportunity_id, created_at desc);
create index newsletter_entries_issue_position_idx
  on public.newsletter_entries (newsletter_id, position);
create index sentinel_posts_status_idx
  on public.sentinel_posts (status, created_at desc);

alter table public.newsletter_issues enable row level security;
alter table public.newsletter_entries enable row level security;
alter table public.sentinel_posts enable row level security;

-- All team members may read editorial history; only Admins and Editors write.
create policy "team reads newsletter issues"
  on public.newsletter_issues for select to authenticated
  using ((select public.my_role()) is not null);
create policy "editors create newsletter issues"
  on public.newsletter_issues for insert to authenticated
  with check ((select public.my_role()) = any (array['Admin', 'Editor']));
create policy "editors update newsletter issues"
  on public.newsletter_issues for update to authenticated
  using ((select public.my_role()) = any (array['Admin', 'Editor']))
  with check ((select public.my_role()) = any (array['Admin', 'Editor']));
create policy "editors delete newsletter issues"
  on public.newsletter_issues for delete to authenticated
  using ((select public.my_role()) = any (array['Admin', 'Editor']));

create policy "team reads newsletter entries"
  on public.newsletter_entries for select to authenticated
  using ((select public.my_role()) is not null);
create policy "editors create newsletter entries"
  on public.newsletter_entries for insert to authenticated
  with check ((select public.my_role()) = any (array['Admin', 'Editor']));
create policy "editors update newsletter entries"
  on public.newsletter_entries for update to authenticated
  using ((select public.my_role()) = any (array['Admin', 'Editor']))
  with check ((select public.my_role()) = any (array['Admin', 'Editor']));
create policy "editors delete newsletter entries"
  on public.newsletter_entries for delete to authenticated
  using ((select public.my_role()) = any (array['Admin', 'Editor']));

create policy "team reads sentinel log"
  on public.sentinel_posts for select to authenticated
  using ((select public.my_role()) is not null);
create policy "editors create sentinel log"
  on public.sentinel_posts for insert to authenticated
  with check ((select public.my_role()) = any (array['Admin', 'Editor']));
create policy "editors update sentinel log"
  on public.sentinel_posts for update to authenticated
  using ((select public.my_role()) = any (array['Admin', 'Editor']))
  with check ((select public.my_role()) = any (array['Admin', 'Editor']));
create policy "editors delete sentinel log"
  on public.sentinel_posts for delete to authenticated
  using ((select public.my_role()) = any (array['Admin', 'Editor']));

revoke all on public.newsletter_issues from anon;
revoke all on public.newsletter_entries from anon;
revoke all on public.sentinel_posts from anon;
grant select, insert, update, delete on public.newsletter_issues to authenticated;
grant select, insert, update, delete on public.newsletter_entries to authenticated;
grant select, insert, update, delete on public.sentinel_posts to authenticated;
grant usage, select on sequence public.newsletter_issues_id_seq to authenticated;
grant usage, select on sequence public.newsletter_entries_id_seq to authenticated;
grant usage, select on sequence public.sentinel_posts_id_seq to authenticated;

comment on table public.newsletter_entries is
  'Ordered opportunity snapshots used in newsletter issues; independent from catalog publication state.';
comment on table public.sentinel_posts is
  'Persistent replacement for Sentinel data/log.json, keyed by source_url.';
