create table public.opportunity_tags (
  id bigint generated always as identity primary key,
  slug text not null unique,
  name text not null,
  category text not null
    check (category in ('Tema', 'Atividade', 'Habilidade', 'Entrega', 'Benefício')),
  description text not null default '',
  active boolean not null default true,
  sort_order integer not null default 0,
  created_by uuid references auth.users(id) on delete set null default auth.uid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index opportunity_tags_name_unique_idx
  on public.opportunity_tags (lower(name));
create index opportunity_tags_active_order_idx
  on public.opportunity_tags (active, category, sort_order, name);
create index opportunities_keywords_gin_idx
  on public.opportunities using gin (keywords);

alter table public.opportunities
  add column qualification_status text not null default 'pending'
    check (qualification_status in ('pending', 'qualified', 'unqualified')),
  add column qualification_reason text;

create index opportunities_qualification_status_idx
  on public.opportunities (qualification_status, status);

alter table public.opportunity_tags enable row level security;

create policy "public reads active opportunity tags"
  on public.opportunity_tags for select to anon
  using (active);
create policy "team reads opportunity tags"
  on public.opportunity_tags for select to authenticated
  using ((select public.my_role()) is not null);
create policy "editors create opportunity tags"
  on public.opportunity_tags for insert to authenticated
  with check ((select public.my_role()) = any (array['Admin', 'Editor']));
create policy "editors update opportunity tags"
  on public.opportunity_tags for update to authenticated
  using ((select public.my_role()) = any (array['Admin', 'Editor']))
  with check ((select public.my_role()) = any (array['Admin', 'Editor']));
create policy "editors delete opportunity tags"
  on public.opportunity_tags for delete to authenticated
  using ((select public.my_role()) = any (array['Admin', 'Editor']));

revoke all on public.opportunity_tags from anon;
revoke all on public.opportunity_tags from authenticated;
grant select on public.opportunity_tags to anon;
grant select, insert, update, delete on public.opportunity_tags to authenticated;
grant usage, select on sequence public.opportunity_tags_id_seq to authenticated;

create function public.update_opportunity_tag(
  tag_id bigint,
  next_name text,
  next_slug text,
  next_category text,
  next_description text,
  next_active boolean,
  next_sort_order integer
) returns public.opportunity_tags
language plpgsql
security invoker
set search_path = ''
as $$
declare
  previous_name text;
  updated_tag public.opportunity_tags;
begin
  select name into previous_name
  from public.opportunity_tags
  where id = tag_id
  for update;

  if previous_name is null then
    raise exception 'Tag não encontrada.';
  end if;

  if previous_name is distinct from next_name then
    update public.opportunities
    set keywords = array_replace(keywords, previous_name, next_name)
    where keywords @> array[previous_name];
  end if;

  update public.opportunity_tags
  set name = next_name,
      slug = next_slug,
      category = next_category,
      description = coalesce(next_description, ''),
      active = next_active,
      sort_order = next_sort_order,
      updated_at = now()
  where id = tag_id
  returning * into updated_tag;

  return updated_tag;
end;
$$;

revoke all on function public.update_opportunity_tag(bigint, text, text, text, text, boolean, integer) from public;
grant execute on function public.update_opportunity_tag(bigint, text, text, text, text, boolean, integer) to authenticated;

insert into public.opportunity_tags (slug, name, category)
select
  lower(trim(both '-' from regexp_replace(name, '[^[:alnum:]]+', '-', 'g'))),
  name,
  category
from (values
  ('Administração pública', 'Tema'),
  ('Agricultura', 'Tema'),
  ('Alimentação', 'Tema'),
  ('Antropologia', 'Tema'),
  ('Artes visuais', 'Tema'),
  ('Astronomia', 'Tema'),
  ('Astrofísica', 'Tema'),
  ('Biodiversidade', 'Tema'),
  ('Bioengenharia', 'Tema'),
  ('Bioética', 'Tema'),
  ('Biologia', 'Tema'),
  ('Biologia sintética', 'Tema'),
  ('Bioquímica', 'Tema'),
  ('Biomedicina', 'Tema'),
  ('Ciência da computação', 'Tema'),
  ('Ciência de dados', 'Tema'),
  ('Ciência política', 'Tema'),
  ('Ciências ambientais', 'Tema'),
  ('Ciências sociais', 'Tema'),
  ('Cinema', 'Tema'),
  ('Cidadania', 'Tema'),
  ('Clima', 'Tema'),
  ('Comunicação', 'Tema'),
  ('Comunicação digital', 'Tema'),
  ('Conservação', 'Tema'),
  ('Conservação marinha', 'Tema'),
  ('Cultura', 'Tema'),
  ('Democracia', 'Tema'),
  ('Direito', 'Tema'),
  ('Direitos humanos', 'Tema'),
  ('Economia', 'Tema'),
  ('Educação', 'Tema'),
  ('Energia', 'Tema'),
  ('Engenharia', 'Tema'),
  ('Engenharia aeroespacial', 'Tema'),
  ('Empreendedorismo', 'Tema'),
  ('Espaço', 'Tema'),
  ('Ética', 'Tema'),
  ('Filosofia', 'Tema'),
  ('Finanças', 'Tema'),
  ('Física', 'Tema'),
  ('Fotografia', 'Tema'),
  ('Geografia', 'Tema'),
  ('Geologia', 'Tema'),
  ('Governança', 'Tema'),
  ('História', 'Tema'),
  ('Inteligência artificial', 'Tema'),
  ('Jornalismo', 'Tema'),
  ('Justiça social', 'Tema'),
  ('Linguística', 'Tema'),
  ('Literatura', 'Tema'),
  ('Matemática', 'Tema'),
  ('Medicina', 'Tema'),
  ('Mercado financeiro', 'Tema'),
  ('Microbiologia', 'Tema'),
  ('Mudanças climáticas', 'Tema'),
  ('Negócios', 'Tema'),
  ('Neurociência', 'Tema'),
  ('Oceanografia', 'Tema'),
  ('Política ambiental', 'Tema'),
  ('Política climática', 'Tema'),
  ('Política espacial', 'Tema'),
  ('Políticas públicas', 'Tema'),
  ('Psicologia', 'Tema'),
  ('Química', 'Tema'),
  ('Relações internacionais', 'Tema'),
  ('Robótica', 'Tema'),
  ('Saúde', 'Tema'),
  ('Saúde ambiental', 'Tema'),
  ('Saúde pública', 'Tema'),
  ('Segurança alimentar', 'Tema'),
  ('Sustentabilidade', 'Tema'),
  ('Tecnologia', 'Tema'),
  ('Vida selvagem', 'Tema'),
  ('Advocacy', 'Atividade'),
  ('Ativismo', 'Atividade'),
  ('Campanha', 'Atividade'),
  ('Clube acadêmico', 'Atividade'),
  ('Comunicação científica', 'Atividade'),
  ('Debate', 'Atividade'),
  ('Desenvolvimento de produto', 'Atividade'),
  ('Educação entre pares', 'Atividade'),
  ('Escrita acadêmica', 'Atividade'),
  ('Escrita criativa', 'Atividade'),
  ('Experimentação', 'Atividade'),
  ('Gestão de projetos', 'Atividade'),
  ('Hackathon', 'Atividade'),
  ('Imersão', 'Atividade'),
  ('Inovação social', 'Atividade'),
  ('Intercâmbio cultural', 'Atividade'),
  ('Laboratório', 'Atividade'),
  ('Mentoria', 'Atividade'),
  ('Modelagem', 'Atividade'),
  ('Negociação', 'Atividade'),
  ('Networking', 'Atividade'),
  ('Oratória', 'Atividade'),
  ('Pesquisa', 'Atividade'),
  ('Pesquisa de campo', 'Atividade'),
  ('Programação', 'Atividade'),
  ('Projeto de lei', 'Atividade'),
  ('Prototipagem', 'Atividade'),
  ('Quiz', 'Atividade'),
  ('Simulação diplomática', 'Atividade'),
  ('Trabalho em equipe', 'Atividade'),
  ('Voluntariado', 'Atividade'),
  ('Workshop', 'Atividade'),
  ('Análise de dados', 'Habilidade'),
  ('Argumentação', 'Habilidade'),
  ('Colaboração', 'Habilidade'),
  ('Comunicação', 'Habilidade'),
  ('Criatividade', 'Habilidade'),
  ('Empatia', 'Habilidade'),
  ('Escrita', 'Habilidade'),
  ('Liderança', 'Habilidade'),
  ('Letramento científico', 'Habilidade'),
  ('Letramento financeiro', 'Habilidade'),
  ('Pensamento crítico', 'Habilidade'),
  ('Raciocínio lógico', 'Habilidade'),
  ('Resolução de problemas', 'Habilidade'),
  ('Tomada de decisão', 'Habilidade'),
  ('Aplicativo', 'Entrega'),
  ('Apresentação oral', 'Entrega'),
  ('Artigo científico', 'Entrega'),
  ('Conto', 'Entrega'),
  ('Documentário', 'Entrega'),
  ('Ensaio', 'Entrega'),
  ('Fotografia', 'Entrega'),
  ('Pitch', 'Entrega'),
  ('Poema', 'Entrega'),
  ('Portfólio', 'Entrega'),
  ('Projeto de pesquisa', 'Entrega'),
  ('Projeto social', 'Entrega'),
  ('Protótipo', 'Entrega'),
  ('Redação', 'Entrega'),
  ('Relatório', 'Entrega'),
  ('Robô', 'Entrega'),
  ('Solução tecnológica', 'Entrega'),
  ('Vídeo', 'Entrega'),
  ('Acesso à universidade', 'Benefício'),
  ('Acesso a especialistas', 'Benefício'),
  ('Candidatura universitária', 'Benefício'),
  ('Carta de recomendação', 'Benefício'),
  ('Carreiras', 'Benefício'),
  ('Certificado', 'Benefício'),
  ('Crédito acadêmico', 'Benefício'),
  ('Desenvolvimento pessoal', 'Benefício'),
  ('Desenvolvimento profissional', 'Benefício'),
  ('Experiência internacional', 'Benefício'),
  ('Exposição pública', 'Benefício'),
  ('Financiamento de projeto', 'Benefício'),
  ('Premiação', 'Benefício'),
  ('Prêmio em dinheiro', 'Benefício'),
  ('Publicação', 'Benefício'),
  ('Viagem', 'Benefício')
) as seed(name, category)
on conflict do nothing;

-- Público-alvo foi removido do produto e as tags antigas não seguem a nova
-- taxonomia. As oportunidades serão reclassificadas pelo Sentinel unificado.
update public.opportunities
set audience = '{}'::text[]
where coalesce(cardinality(audience), 0) > 0;

update public.opportunities
set keywords = '{}'::text[]
where coalesce(cardinality(keywords), 0) > 0;

comment on table public.opportunity_tags is
  'Vocabulário administrável de tags canônicas usadas nas oportunidades.';
