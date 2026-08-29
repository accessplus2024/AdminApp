-- Fila de oportunidades enviadas por organizações/estudantes pelo formulário
-- público do site. Deliberadamente uma tabela própria, não uma extensão de
-- sentinel_posts: aquela tabela é modelada em torno de "raspei um post do
-- Instagram e uma IA extraiu campos de uma legenda" (source_url único,
-- owner_username, caption, score de triagem automática) — nada disso existe
-- numa submissão manual, e forçar o encaixe enfraqueceria a constraint de
-- unicidade que protege o Sentinel contra duplicata.
--
-- A detecção de duplicata contra o catálogo (mesmo link/título) é feita na
-- revisão comparando com `opportunities`, reaproveitando a mesma lógica de
-- comparação do Sentinel — não precisa da mesma tabela pra isso.
--
-- Só os campos que a página de detalhe do site realmente usa pra renderizar
-- são obrigatórios (ver server/api/opportunities/[id].get.js e os
-- componentes de components/opportunity/). Conteúdo editorial mais rico
-- (dicas de quem participou, links extras, tags do vocabulário controlado)
-- fica pro editor completar durante a revisão, não pro formulário público.
create table public.opportunity_submissions (
  id bigint generated always as identity primary key,

  -- Campos que viram a oportunidade em si (obrigatórios: sem eles a página
  -- de detalhe do site fica com buracos visíveis).
  -- organization_name é próprio (não misturado na description) porque o
  -- estudante que vê a oportunidade publicada pode não saber quem a
  -- oferece só pelo título — o editor decide como costurar isso na
  -- descrição final ao promover a submissão.
  organization_name text not null,
  title text not null,
  link text not null,
  description text not null,
  type text not null,
  deadline text not null,
  level text[] not null default '{}',
  areas text[] not null default '{}',
  location text not null,
  cost text not null,
  format text not null,
  eligibility text not null,

  -- Quem enviou (pra contato/agradecimento, nunca exposto publicamente).
  submitter_name text not null,
  submitter_email text not null,
  submitter_note text not null default '',

  -- Ciclo de vida mais curto que o do Sentinel: não existe etapa de
  -- processamento por IA aqui, então não existem os estados 'queued'/'failed'.
  status text not null default 'pending'
    check (status in ('pending', 'qualified', 'duplicate', 'rejected')),
  opportunity_id bigint references public.opportunities(id) on delete set null,
  review_note text,
  reviewed_by uuid references auth.users(id) on delete set null,
  processed_at timestamptz,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index opportunity_submissions_status_idx
  on public.opportunity_submissions (status, created_at desc);

alter table public.opportunity_submissions enable row level security;

-- Sem policy de insert pra anon nem authenticated, de propósito: a única
-- porta de entrada é o endpoint server-side (server/api/opportunities/
-- submit.post.js), que valida e limita taxa ANTES de gravar com a chave
-- service_role (que ignora RLS). Se alguém tentasse inserir direto pela API
-- pública do Supabase, sem passar pelo endpoint, essa ausência de policy
-- bloqueia — não existe "insert to anon" em lugar nenhum aqui.
create policy "team reads submissions"
  on public.opportunity_submissions for select to authenticated
  using ((select public.my_role()) is not null);
create policy "editors update submissions"
  on public.opportunity_submissions for update to authenticated
  using ((select public.my_role()) = any (array['Admin', 'Editor']))
  with check ((select public.my_role()) = any (array['Admin', 'Editor']));

revoke all on public.opportunity_submissions from anon;
revoke all on public.opportunity_submissions from authenticated;
grant select, update on public.opportunity_submissions to authenticated;

comment on table public.opportunity_submissions is
  'Oportunidades enviadas por organizações/estudantes pelo formulário público do site, pendentes de revisão editorial.';
