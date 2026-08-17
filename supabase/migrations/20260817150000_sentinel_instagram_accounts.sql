-- Contas de Instagram que o Sentinel varre em busca de oportunidades. Antes
-- fixas no código (SOURCE_ACCOUNTS em api/sentinel.js) — precisava de deploy
-- pra adicionar ou desativar uma conta. Agora editável por Admin/Editor
-- direto na tela do Sentinel, sem deploy.
--
-- De propósito, não existe uma coluna/flag separada "instagram_enabled": o
-- Instagram roda sobre as contas com active = true; se nenhuma estiver
-- ativa, a etapa inteira é pulada (nem chama a Apify). Evita precisar de
-- mais uma tabela de configuração só pra um botão liga/desliga.
create table public.sentinel_instagram_accounts (
  username text primary key,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  created_by uuid references auth.users(id) on delete set null default auth.uid()
);

alter table public.sentinel_instagram_accounts enable row level security;

create policy "team reads instagram accounts"
  on public.sentinel_instagram_accounts for select to authenticated
  using ((select public.my_role()) is not null);
create policy "editors create instagram accounts"
  on public.sentinel_instagram_accounts for insert to authenticated
  with check ((select public.my_role()) = any (array['Admin', 'Editor']));
create policy "editors update instagram accounts"
  on public.sentinel_instagram_accounts for update to authenticated
  using ((select public.my_role()) = any (array['Admin', 'Editor']))
  with check ((select public.my_role()) = any (array['Admin', 'Editor']));
create policy "editors delete instagram accounts"
  on public.sentinel_instagram_accounts for delete to authenticated
  using ((select public.my_role()) = any (array['Admin', 'Editor']));

revoke all on public.sentinel_instagram_accounts from anon;
grant select, insert, update, delete on public.sentinel_instagram_accounts to authenticated;

comment on table public.sentinel_instagram_accounts is
  'Instagram usernames que o Sentinel varre. Editável por Admin/Editor pela tela do Sentinel, sem deploy. Vazia ou toda inativa = a etapa de Instagram é pulada inteira (nenhuma chamada à Apify).';

-- Migra as contas hoje fixas no código (SOURCE_ACCOUNTS em api/sentinel.js),
-- mantendo o comportamento idêntico no dia do deploy — ninguém perde fonte.
insert into public.sentinel_instagram_accounts (username, active) values
  ('opportunitydesk', true),
  ('opportunities_corners', true),
  ('opportunitiesforyouth', true),
  ('adroiteducation', true),
  ('borderless.so', true)
on conflict (username) do nothing;
