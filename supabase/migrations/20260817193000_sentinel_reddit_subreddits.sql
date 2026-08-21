-- Mesma ideia da migração de contas de Instagram
-- (20260817150000_sentinel_instagram_accounts.sql): os subreddits que o
-- Sentinel varre estavam fixos no código (SUBREDDITS em
-- api/lib/redditScraper.js) — precisava de deploy pra adicionar/remover um.
-- Agora editável por Admin/Editor direto na tela do Sentinel, sem deploy,
-- igual ao Instagram.
--
-- `queries` guarda a lista de buscas daquele subreddit (cada uma com
-- palavra-chave, ordenação e janela de tempo) como jsonb, porque cada
-- subreddit no código original já tinha uma combinação própria (ex.:
-- "summerprogramresults" busca por flair "Opportunity" E por uma busca mais
-- ampla; "ApplyingToCollege" só a busca ampla). Um valor default sensato
-- (a mesma "busca ampla" usada em todos os subreddits hoje) cobre o caso
-- comum de só digitar o nome do subreddit sem se preocupar com os detalhes.
create table public.sentinel_reddit_subreddits (
  name text primary key,
  active boolean not null default true,
  queries jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now(),
  created_by uuid references auth.users(id) on delete set null default auth.uid()
);

alter table public.sentinel_reddit_subreddits enable row level security;

create policy "team reads reddit subreddits"
  on public.sentinel_reddit_subreddits for select to authenticated
  using ((select public.my_role()) is not null);
create policy "editors create reddit subreddits"
  on public.sentinel_reddit_subreddits for insert to authenticated
  with check ((select public.my_role()) = any (array['Admin', 'Editor']));
create policy "editors update reddit subreddits"
  on public.sentinel_reddit_subreddits for update to authenticated
  using ((select public.my_role()) = any (array['Admin', 'Editor']))
  with check ((select public.my_role()) = any (array['Admin', 'Editor']));
create policy "editors delete reddit subreddits"
  on public.sentinel_reddit_subreddits for delete to authenticated
  using ((select public.my_role()) = any (array['Admin', 'Editor']));

revoke all on public.sentinel_reddit_subreddits from anon;
grant select, insert, update, delete on public.sentinel_reddit_subreddits to authenticated;

comment on table public.sentinel_reddit_subreddits is
  'Subreddits que o Sentinel varre em busca de oportunidades. Editável por Admin/Editor pela tela do Sentinel, sem deploy. Vazia ou toda inativa = usa a lista fixa de api/lib/redditScraper.js como reserva (nunca fica sem nenhum subreddit).';

-- Migra os subreddits hoje fixos no código, mantendo o comportamento
-- idêntico no dia do deploy — ninguém perde fonte. `queries` replica
-- exatamente as combinações que já existiam pra cada um.
insert into public.sentinel_reddit_subreddits (name, active, queries) values
  ('summerprogramresults', true, '[
    ["flair:\"Opportunity\"", "new", "year"],
    ["flair:\"Opportunity\"", "top", "all"],
    ["broad", "new", "year"],
    ["broad", "top", "year"]
  ]'::jsonb),
  ('ApplyingToCollege', true, '[
    ["broad", "new", "year"],
    ["broad", "top", "year"]
  ]'::jsonb),
  ('IntltoUSA', true, '[
    ["broad", "new", "year"],
    ["broad", "top", "year"]
  ]'::jsonb)
on conflict (name) do nothing;
