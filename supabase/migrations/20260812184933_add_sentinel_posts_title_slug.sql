alter table public.sentinel_posts
  add column title_slug text;

create index sentinel_posts_title_slug_idx
  on public.sentinel_posts (title_slug);

comment on column public.sentinel_posts.title_slug is
  'Título normalizado (sem acento, sem palavras genéricas tipo "scholarship"/"international", tokens ordenados) — calculado em api/lib/scraperFilters.js:slugTitulo. Usado pra descartar na coleta (fase 1, sem gastar IA) uma oportunidade que já existe com outra URL — outra fonte compartilhou o mesmo programa, ou apareceu de novo numa edição futura.';
