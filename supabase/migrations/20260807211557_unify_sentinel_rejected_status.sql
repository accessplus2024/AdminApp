-- Keep a single rejection concept in the UI. The error text still explains
-- whether an item was rejected by automatic scoring or after research.
update public.sentinel_posts
set status = 'rejected',
    error = coalesce(
      error,
      'Rejeitada na triagem automática: pontuação ' || score || ' abaixo do corte 4.'
    ),
    processed_at = coalesce(processed_at, now()),
    updated_at = now()
where status = 'screened_out';

alter table public.sentinel_posts
  drop constraint sentinel_posts_status_check;

alter table public.sentinel_posts
  add constraint sentinel_posts_status_check
  check (status in ('queued', 'pending', 'qualified', 'duplicate', 'rejected', 'failed'));
