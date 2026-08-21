-- Duas mudanças relacionadas a "Execuções" (sentinel_research_runs):
--
-- 1. run_type ganha 'enrichment' e 'web_research'. 'enrichment' já era usado
--    pelo código (api/cron/scrape-sources.js, ação 'enrich_auto') desde uma
--    sessão anterior, mas essa migração nunca foi criada — toda tentativa de
--    registrar uma execução de enriquecimento estava (e está, até essa
--    migração rodar) falhando silenciosamente contra o check constraint
--    original, que só aceitava 'discovery' | 'manual' | 'catalog_review'.
--    'web_research' é novo: a pesquisa dos candidatos do scraper de sites
--    (ação 'research') nunca tinha ficado registrada em "Execuções" — só
--    Instagram, revisão de catálogo e enriquecimento apareciam ali, o que
--    escondia justamente o que mais roda.
--
-- 2. status ganha 'cancelling' e 'cancelled', pra suportar cancelar uma
--    pesquisa em andamento (ação 'cancel_research'): a run é marcada
--    'cancelling', o loop de pesquisa que estiver rodando vê isso entre um
--    item e outro e para de pegar itens novos da fila, terminando como
--    'cancelled'.
alter table public.sentinel_research_runs
  drop constraint if exists sentinel_research_runs_run_type_check;
alter table public.sentinel_research_runs
  add constraint sentinel_research_runs_run_type_check
  check (run_type in ('discovery', 'manual', 'catalog_review', 'enrichment', 'web_research'));

alter table public.sentinel_research_runs
  drop constraint if exists sentinel_research_runs_status_check;
alter table public.sentinel_research_runs
  add constraint sentinel_research_runs_status_check
  check (status in ('running', 'completed', 'partial', 'failed', 'cancelling', 'cancelled'));
