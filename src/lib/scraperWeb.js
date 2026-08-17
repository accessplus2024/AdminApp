// src/lib/scraperWeb.js
//
// Frontend helper for the "Web" screen. Two-phase flow, on purpose: collecting
// (cheap, just fetch + keyword filter) is separate from researching (the
// expensive AI + link-following step) so a human always picks what's worth the
// spend before it happens — the AI step never runs unattended.
import { isSupabaseConfigured, supabase } from './supabase';
import { fetchSentinelPosts } from './sentinel';

// Mantenha esta lista igual aos "nome" em api/lib/scraperSources.js — é só para
// mostrar os botões; a fonte de verdade de qual site realmente roda é o backend.
// Reddit está aqui, mas marcado por padrão (ver estado inicial de
// webFontesEscolhidas em Sentinel.jsx): continua não exigindo esforço extra
// pra rodar — já vem selecionado — mas agora pode ser desmarcado sozinho pra
// rodar só as outras fontes, ou deixado como a ÚNICA marcada pra rodar só o
// Reddit, sem precisar de um botão separado.
export const WEB_SOURCES = [
  'Opportunity Desk', 'Bright Scholarship', 'Opportunities for Youth', 'OYAOP', 'Reddit',
];

async function chamarScraper(body) {
  if (!isSupabaseConfigured) throw new Error('Supabase não configurado.');
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;
  if (!token) throw new Error('Entre novamente para rodar o scraper.');
  const response = await fetch('/api/cron/scrape-sources', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify(body),
  });
  const result = await response.json().catch(() => ({}));
  if (!response.ok) {
    const routeMissing = response.status === 404 && !result.error;
    throw new Error(result.error || (routeMissing ? 'A rota do scraper não está disponível neste servidor.' : `Scraper respondeu ${response.status}.`));
  }
  return result;
}

// Fase 1 — busca + filtro de palavra-chave (sem IA). `sites` vazio/omitido = todas as fontes.
export const collectSources = (sites) => chamarScraper({ action: 'collect', ...(sites && sites.length ? { sites } : {}) });

// Fase 2 — a etapa que custa: só roda pros itens escolhidos (`postIds`) ou pros
// N mais antigos da fila (`maxCandidates`, padrão 10). `onRunId`, se passado,
// é chamado assim que o id da execução existe (antes de esperar a pesquisa
// terminar) — é o que permite ao botão "Cancelar" existir, já que sem isso
// o navegador só saberia o runId depois que tudo já tivesse acabado.
export const researchCandidates = async ({ postIds, maxCandidates, onRunId } = {}) => {
  const { runId } = await chamarScraper({
    action: 'research_start', ...(postIds ? { postIds } : {}), ...(maxCandidates ? { maxCandidates } : {}),
  });
  onRunId?.(runId);
  return chamarScraper({
    action: 'research', runId, ...(postIds ? { postIds } : {}), ...(maxCandidates ? { maxCandidates } : {}),
  });
};

// Cancela uma pesquisa em andamento (cooperativo — ver comentário em
// pesquisarCandidatos no backend): os itens já em processamento terminam
// normalmente, mas nenhum item novo é iniciado, e o resto volta pra fila.
// Também libera na hora qualquer item dessa execução preso em "pending" —
// não existe mais um botão separado de "destravar pendentes" pra isso.
export const cancelResearch = (runId) => chamarScraper({ action: 'cancel_research', runId });

// Exclui candidatos já processados da tabela "Já pesquisados". O backend nunca
// deixa apagar uma linha "pending" (pesquisa em andamento) — só serve pra
// limpar histórico. Há também uma limpeza automática (30 dias) rodando dentro
// do cron diário, então isso aqui é só um reforço manual.
export const deleteCandidates = (postIds) => chamarScraper({ action: 'delete', postIds });

// Fase 3 — opcional e manual, só faz sentido pra candidatos já 'qualified'
// (já viraram uma oportunidade). Busca links extras via Serper, YouTube Data
// API e Reddit e pede pra IA avaliar cada um — devolve a lista pra você
// revisar, NADA é salvo ainda nesse passo.
export const findEnrichmentCandidates = (opportunityId) => chamarScraper({ action: 'enrich', opportunityId });

// Passo 2 — só depois que você escolheu (na tela) quais links de fato quer
// adicionar. `resources` = [{ platform, title, url }, ...] dos itens marcados.
export const confirmEnrichment = (opportunityId, resources) => chamarScraper({
  action: 'enrich_confirm', opportunityId, resources,
});

// Versão 100% automática (sem devolver lista pra revisão humana) — chamada
// assim que uma oportunidade é aprovada/publicada, pra já sair com os links
// extras (vídeo, cobertura, discussão) sem esperar nenhuma janela de tempo.
// Só entra em `resources` o que a IA marcar "sugerido" + "confiança alta";
// erro aqui nunca deve travar a aprovação em si — sempre chame com .catch.
export const enrichApprovedOpportunityNow = (opportunityId) => chamarScraper({
  action: 'enrich_auto', opportunityId,
});

// Candidatos ainda não pesquisados, prontos pra um humano escolher.
export async function fetchQueuedWebCandidates() {
  const posts = await fetchSentinelPosts();
  return posts
    .filter((p) => p.source_type === 'web' && p.status === 'queued')
    .map((p) => ({
      id: p.id,
      titulo: String(p.caption || '').split('\n')[0] || p.source_url,
      link: p.source_url,
      fonte: p.owner_username,
      criadoEm: p.created_at,
    }));
}

// Candidatos que já passaram pela pesquisa (fase 2) — ficam visíveis aqui pra
// sempre, mesmo depois de saírem da fila, pra você ver o resultado (e o erro,
// se falhou) sem precisar abrir o Supabase.
const STATUS_PROCESSADO = new Set(['qualified', 'duplicate', 'rejected', 'failed']);

export async function fetchProcessedWebCandidates(limit = 50) {
  const posts = await fetchSentinelPosts();
  return posts
    .filter((p) => p.source_type === 'web' && STATUS_PROCESSADO.has(p.status))
    .sort((a, b) => new Date(b.updated_at || b.processed_at || 0) - new Date(a.updated_at || a.processed_at || 0))
    .slice(0, limit)
    .map((p) => ({
      id: p.id,
      titulo: String(p.caption || '').split('\n')[0] || p.source_url,
      link: p.source_url,
      fonte: p.owner_username,
      status: p.status,
      error: p.error,
      opportunityId: p.opportunity_id,
      atualizadoEm: p.updated_at || p.processed_at,
    }));
}
