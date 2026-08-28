-- Disponibilidade das inscrições deixa de morar na coluna `status`.
--
--   status ............... fluxo editorial: Aprovada | Revisar | Rascunho
--   inscricoes ........... disponibilidade: Aberta | Encerrada
--   qualification_status . elegibilidade de jovens brasileiros (Sentinel)
--
-- Os três são independentes: uma oportunidade publicada pode estar com as
-- inscrições encerradas, e uma qualificação pendente não fecha inscrição.

alter table public.opportunities
  add column if not exists inscricoes text not null default 'Aberta';

-- Linhas antigas que guardavam o encerramento em `status`.
update public.opportunities set inscricoes = 'Encerrada' where status = 'Encerrada';
update public.opportunities set status = 'Aprovada' where status = 'Encerrada';

alter table public.opportunities
  drop constraint if exists opportunities_inscricoes_check;
alter table public.opportunities
  add constraint opportunities_inscricoes_check check (inscricoes in ('Aberta', 'Encerrada'));

create index if not exists opportunities_inscricoes_idx
  on public.opportunities (inscricoes, status);
