create index newsletter_issues_created_by_idx
  on public.newsletter_issues (created_by);
create index sentinel_posts_opportunity_id_idx
  on public.sentinel_posts (opportunity_id);
