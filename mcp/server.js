#!/usr/bin/env node
// mcp/server.js
//
// Servidor MCP (stdio) que expõe o "cérebro" do Sentinel para qualquer cliente
// MCP — Claude Desktop, Claude Code, Cursor, um cliente com Ollama etc. — com o
// modelo que a pessoa quiser. Este servidor NÃO chama modelo nenhum: quem lê as
// fontes e escreve o dossiê/as correções é o modelo do cliente. O que fica
// aqui é a parte determinística, que é o que dá confiabilidade ao Sentinel:
//
//   - coleta de fontes (página oficial + páginas adjacentes, com proveniência);
//   - validação das citações contra o texto real das fontes;
//   - detectores de prazo, exclusão geográfica e inelegibilidade estrutural;
//   - normalização para a taxonomia do catálogo;
//   - gravação como PROPOSTA (sentinel_research_proposals), que um humano
//     aplica ou rejeita na tela Sentinel, como qualquer outra revisão.
//
// Nenhuma ferramenta aqui edita `opportunities` diretamente. Um modelo fraco
// pode, no máximo, gerar uma proposta ruim que a validação poda e que um
// humano ainda precisa aprovar.
//
// Uso: ver mcp/README.md.

import { randomUUID } from 'node:crypto';
import { existsSync, statSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { connect } from './auth.js';
import { z } from 'zod';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const envFile = process.env.ACCESS_ENV_FILE || resolve(ROOT, '.env');
if (existsSync(envFile)) process.loadEnvFile(envFile);

// Import dinâmico: sentinel.js lê process.env no topo do módulo, então o .env
// precisa estar carregado antes. Recarga a quente: o servidor reimporta api/sentinel.js sempre que o arquivo
// muda (ver loadSentinel), então ajustes no validador valem na próxima chamada
// de ferramenta, sem reconectar o MCP. Os módulos que ele importa (api/lib/*)
// continuam em cache.
const SENTINEL_PATH = resolve(ROOT, 'api/sentinel.js');
let sentinelMtime = 0;
let {
  activeOpportunityTagNames, buildOpportunityResearchPlan, catalogCoverageFields,
  catalogMappingSystemPrompt, coverageAuditSystemPrompt,
  createRun, fetchResearchSources, findGeographicExclusionEvidence,
  findRelevantDeadlineEvidence, findRollingDeadlineEvidence, findStructuralIneligibilityEvidence,
  finalizeRun, isDuplicateOpportunity, isNewerEdition, normalizeResearchBrief,
  researchBriefPrompt, researchExistingOpportunity, sourcesForPrompt,
  attachLeadSource, discoveryLeadSource, discoveryPrompt, discoveryResearchUrl, extractUrl,
  normalizeKeywordTags, processPost, scrapeInstagramLeads,
} = {};
async function loadSentinel() {
  const mtime = statSync(SENTINEL_PATH).mtimeMs;
  if (mtime === sentinelMtime) return;
  const mod = await import(`${pathToFileURL(SENTINEL_PATH).href}?v=${mtime}`);
  ({
    activeOpportunityTagNames, buildOpportunityResearchPlan, catalogCoverageFields,
    catalogMappingSystemPrompt, coverageAuditSystemPrompt,
    createRun, fetchResearchSources, findGeographicExclusionEvidence,
    findRelevantDeadlineEvidence, findRollingDeadlineEvidence, findStructuralIneligibilityEvidence,
    finalizeRun, isDuplicateOpportunity, isNewerEdition, normalizeResearchBrief,
    researchBriefPrompt, researchExistingOpportunity, sourcesForPrompt,
    attachLeadSource, discoveryLeadSource, discoveryPrompt, discoveryResearchUrl, extractUrl,
    normalizeKeywordTags, processPost, scrapeInstagramLeads,
  } = mod);
  if (sentinelMtime) log('api/sentinel.js recarregado');
  sentinelMtime = mtime;
}
await loadSentinel();
const { REFRESH_BUCKETS, triageCatalog } = await import('./catalogTriage.js');
const {
  DEFAULT_ISSUE, isRecentlyFeatured, lastFeaturedFromRows, newsletterIneligibilityReasons,
  opportunityToNewsletterEntry, saveNewsletterIssueWith,
} = await import('../src/lib/newsletterRecords.js');
const { buildNewsletterHtml } = await import('../src/lib/newsletterHtml.js');
const { parseCatalogDeadline } = await import('../src/lib/deadline.js');

// Toda saída de log vai para stderr: stdout é o canal do protocolo MCP.
const log = (...args) => console.error('[access-mcp]', ...args);

// ---------------------------------------------------------------------------
// Supabase: login como um usuário real do time, para que RLS e o papel
// (Admin/Editor) valham exatamente como na interface. Nunca usa service role.
// ---------------------------------------------------------------------------
let auth = null;
async function session() {
  if (auth) return auth;
  auth = await connect();
  log(`autenticado como ${auth.user.email} (${auth.role})`);
  return auth;
}

// ---------------------------------------------------------------------------
// Sessões de revisão: o fluxo tem três etapas (fontes -> dossiê -> correções)
// e cada etapa depende do que a anterior produziu. Fica em memória — o
// processo stdio vive enquanto o cliente MCP estiver conectado.
// ---------------------------------------------------------------------------
const SESSION_TTL_MS = 60 * 60_000;
const reviews = new Map();
function getReview(id) {
  const review = reviews.get(id);
  if (!review || Date.now() - review.createdAt > SESSION_TTL_MS) {
    reviews.delete(id);
    throw new Error('Sessão de revisão não encontrada ou expirada (1h). Comece de novo com start_review.');
  }
  return review;
}

const emptyMetrics = () => ({ modelCalls: 0, pageFetches: 0, inputTokens: 0, outputTokens: 0 });

// Uma execução por tipo por sessão do servidor (não uma por item): o painel
// lista propostas por execução, e o histórico guarda só as 15 execuções mais
// recentes — 12 revisões viravam 12 entradas no seletor da tela Sentinel.
// A execução é reaproveitada por até SHARED_RUN_TTL_MS e os contadores somam.
const SHARED_RUN_TTL_MS = 6 * 60 * 60_000;
const sharedRuns = new Map();
async function sharedRun(supabase, user, runType, metadata = {}) {
  const current = sharedRuns.get(runType);
  if (current && Date.now() - current.createdAt < SHARED_RUN_TTL_MS) return current;
  const run = await createRun(supabase, user, runType, 0, { source: 'mcp', shared_session: true, ...metadata });
  const entry = { id: run.id, createdAt: Date.now(), processed: 0, succeeded: 0, failed: 0, metrics: emptyMetrics(), items: [] };
  sharedRuns.set(runType, entry);
  return entry;
}
async function recordRunItem(supabase, run, { ok, metrics, item }) {
  run.processed += 1;
  if (ok) run.succeeded += 1; else run.failed += 1;
  for (const key of Object.keys(run.metrics)) run.metrics[key] += Number(metrics?.[key] || 0);
  if (item) run.items.push(item);
  await finalizeRun(supabase, run.id, { processed: run.processed, succeeded: run.succeeded, failed: run.failed }, run.metrics);
  const { error } = await supabase.from('sentinel_research_runs')
    .update({ requested_count: run.processed, metadata: { source: 'mcp', shared_session: true, items: run.items } }).eq('id', run.id);
  if (error) log(`não foi possível atualizar a execução ${run.id}: ${error.message}`);
}

// Faz uma resposta já produzida pelo modelo do cliente parecer uma chamada de
// callStructuredModel, para que o pipeline de validação do Sentinel rode sem
// nenhuma alteração.
function clientResponse(parsed, model) {
  return {
    content: JSON.stringify(parsed),
    parsed,
    model,
    attempts: [{ model, status: 'succeeded', duration_ms: 0, input_tokens: 0, output_tokens: 0 }],
    metrics: { ...emptyMetrics(), modelCalls: 1 },
  };
}

function clientModelName() {
  const info = server.server.getClientVersion();
  return `mcp:${info?.name || 'cliente'}${info?.version ? `@${info.version}` : ''}`;
}

const text = (value) => ({ content: [{ type: 'text', text: typeof value === 'string' ? value : JSON.stringify(value, null, 2) }] });
const fail = (error) => ({ isError: true, content: [{ type: 'text', text: String(error?.message || error) }] });
const safe = (handler) => async (args) => {
  try { return await handler(args); } catch (error) { log(String(error?.message || error)); return fail(error); }
};

async function loadOpportunity(supabase, id) {
  const { data, error } = await supabase.from('opportunities').select('*').eq('id', id).maybeSingle();
  if (error) throw error;
  if (!data) throw new Error(`Oportunidade ${id} não encontrada.`);
  return data;
}

const JSON_ONLY = 'Responda chamando a próxima ferramenta com o objeto JSON pedido (não escreva o JSON no chat).';

// As fontes completas já foram entregues ao cliente na etapa 1; reenviá-las a
// cada etapa custava ~55 KB por revisão. O pipeline de validação (no fim)
// continua usando as fontes completas guardadas na sessão.
const SAME_SOURCES = 'FONTES: as mesmas da etapa 1 (cite delas, literalmente, com a URL exata).';
const mappingMaterial = (research, brief) => `PLANO EXECUTADO:\n${JSON.stringify(research.plan)}\n\nDOSSIÊ FACTUAL VALIDADO:\n${JSON.stringify(brief)}\n\n${SAME_SOURCES}\n\nConverta somente agora o conjunto da pesquisa nos campos do catálogo e retorne o JSON de auditoria.`;
const coverageMaterial = (proposal, brief) => `PRIMEIRA PROPOSTA:\n${JSON.stringify(proposal)}\n\nDOSSIÊ FACTUAL VALIDADO:\n${JSON.stringify(brief)}\n\n${SAME_SOURCES}\n\nCorrija somente os campos listados na checagem final, com citações literais.`;

// ---------------------------------------------------------------------------
// Servidor
// ---------------------------------------------------------------------------
const server = new McpServer(
  { name: 'access-sentinel', version: '0.1.0' },
  {
    instructions: [
      'Ferramentas do Sentinel, o pesquisador de oportunidades educacionais do catálogo Access+ (para jovens brasileiros).',
      'Para revisar uma oportunidade do catálogo, siga as três etapas na ordem: start_review -> submit_research_brief -> submit_catalog_review.',
      'Cada etapa devolve as instruções exatas da próxima. Toda citação precisa ser um trecho LITERAL e contínuo das fontes devolvidas, com a URL exata — citações não literais são descartadas pela validação.',
      'O resultado final é uma proposta pendente que um humano aplica ou rejeita na tela Sentinel do painel; nada é publicado direto.',
      'Oportunidades NOVAS: ache o link oficial (busca na web sua ou list_discovery_leads, a fila do Instagram), confira com check_duplicate e siga start_discovery -> submit_discovery_brief -> submit_discovery_entry. O resultado entra no catálogo com status "Revisar" (um humano aprova); duplicatas nunca sobrescrevem o catálogo.',
      'Catálogo desatualizado: list_refresh_candidates ordena as oportunidades pela chance de uma revisão (start_review) colocá-las na janela da newsletter.',
      'Newsletter: list_newsletter_candidates mostra o que pode entrar numa edição (mesmas regras da tela Newsletter); create_newsletter_draft / update_newsletter_draft gravam SOMENTE rascunhos. Título, prazo, taxas e link de cada oportunidade vêm sempre do catálogo; você pode reescrever o resumo (summary) e a elegibilidade. Marcar como pronta ou enviada é feito por um humano no painel.',
    ].join(' '),
  },
);

// Toda ferramenta recarrega o Sentinel antes de rodar, se o arquivo mudou.
const registerTool = server.registerTool.bind(server);
server.registerTool = (name, config, handler) => registerTool(name, config, async (...args) => {
  await loadSentinel();
  return handler(...args);
});

server.registerTool('whoami', {
  title: 'Conta conectada',
  description: 'Mostra com qual conta do painel Access+ o servidor está autenticado.',
  inputSchema: {},
}, safe(async () => {
  const { user, role } = await session();
  return text({ email: user.email, role });
}));

server.registerTool('list_opportunities', {
  title: 'Listar oportunidades',
  description: 'Lista oportunidades do catálogo (id, título, status, prazo, link). Filtra por status e/ou busca no título.',
  inputSchema: {
    status: z.string().optional().describe('Ex.: Aprovada, Revisar, Encerrada, Rascunho'),
    search: z.string().optional().describe('Trecho do título'),
    limit: z.number().int().min(1).max(200).default(50),
  },
}, safe(async ({ status, search, limit }) => {
  const { supabase } = await session();
  let query = supabase.from('opportunities')
    .select('id, title, status, inscricoes, deadline, link, type, qualification_status, created_at')
    .order('created_at', { ascending: false }).limit(limit);
  if (status) query = query.eq('status', status);
  if (search) query = query.ilike('title', `%${search}%`);
  const { data, error } = await query;
  if (error) throw error;
  return text(data);
}));

server.registerTool('get_opportunity', {
  title: 'Ver oportunidade',
  description: 'Devolve todos os campos de uma oportunidade do catálogo.',
  inputSchema: { id: z.number().int() },
}, safe(async ({ id }) => {
  const { supabase } = await session();
  return text(await loadOpportunity(supabase, id));
}));

server.registerTool('check_duplicate', {
  title: 'Checar duplicata',
  description: 'Compara um link/título com o catálogo usando a mesma regra de duplicata e de "edição mais nova" do Sentinel.',
  inputSchema: { link: z.string().url(), title: z.string().min(1) },
}, safe(async ({ link, title }) => {
  const { supabase } = await session();
  const { data, error } = await supabase.from('opportunities').select('id, title, link, status, deadline').limit(10_000);
  if (error) throw error;
  const candidate = { link, title };
  const matches = (data || []).filter((existing) => isDuplicateOpportunity(existing, candidate))
    .map((existing) => ({ ...existing, candidate_is_newer_edition: isNewerEdition(existing, candidate) }));
  return text({ duplicate: matches.length > 0, matches });
}));

server.registerTool('research_url', {
  title: 'Pesquisar URL',
  description: 'Coleta as fontes de uma URL (página + páginas adjacentes relevantes, com proveniência e autoridade preliminar) e roda os detectores determinísticos de prazo e de exclusão. Só leitura; não grava nada.',
  inputSchema: {
    url: z.string().url(),
    title: z.string().optional().describe('Nome do programa, se souber — melhora a escolha de páginas adjacentes'),
  },
}, safe(async ({ url, title }) => {
  const opportunity = { link: url, title: title || '' };
  const research = await fetchResearchSources(url, opportunity);
  return text({
    deterministic_checks: {
      deadline: findRelevantDeadlineEvidence(research.sources, new Date(), opportunity),
      rolling_deadline: findRollingDeadlineEvidence(research.sources),
      geographic_exclusion: findGeographicExclusionEvidence(research.sources),
      structural_ineligibility: findStructuralIneligibilityEvidence(research.sources),
    },
    research_plan: research.plan,
    adjacent_failures: research.adjacentFailures,
    sources: sourcesForPrompt(research.sources),
  });
}));

// --- Revisão de catálogo em 3 etapas ---------------------------------------

server.registerTool('start_review', {
  title: '1/3 Começar revisão',
  description: 'Etapa 1 de 3 da revisão de uma oportunidade do catálogo. Coleta as fontes oficiais e devolve o prompt da pesquisa factual. Depois leia as fontes e chame submit_research_brief.',
  inputSchema: {
    opportunity_id: z.number().int(),
    url: z.string().url().optional().describe('Pesquisar a partir desta URL em vez do link do catálogo — use quando o link atual é um agregador ou post e você achou a página oficial. A proposta pode então trocar o link para ela.'),
  },
}, safe(async ({ opportunity_id: id, url }) => {
  const { supabase } = await session();
  const opportunity = await loadOpportunity(supabase, id);
  const seed = url || opportunity.link;
  if (!seed) throw new Error('A oportunidade não tem link oficial para pesquisa.');
  const research = await fetchResearchSources(seed, opportunity);
  const reviewId = randomUUID();
  reviews.set(reviewId, { createdAt: Date.now(), opportunityId: id, opportunity, research, brief: null, mapping: null });
  return text([
    `review_id: ${reviewId}`,
    `Fontes coletadas: ${research.sources.length} (${research.pageFetches} páginas lidas).`,
    '',
    '=== INSTRUÇÕES DA ETAPA (siga à risca) ===',
    researchBriefPrompt(opportunity, research.plan || buildOpportunityResearchPlan(opportunity)),
    '',
    '=== FONTES ===',
    sourcesForPrompt(research.sources),
    '',
    `Agora monte o dossiê factual e chame submit_research_brief com review_id e brief. ${JSON_ONLY}`,
  ].join('\n'));
}));

server.registerTool('submit_research_brief', {
  title: '2/3 Enviar dossiê factual',
  description: 'Etapa 2 de 3. Recebe o dossiê factual (facts, qualification, source_assessments, gaps, conflicts), valida cada citação contra as fontes e aplica as regras determinísticas de qualificação. Devolve o dossiê validado e o prompt da etapa 3.',
  inputSchema: {
    review_id: z.string(),
    brief: z.object({
      facts: z.array(z.object({ topic: z.string(), fact: z.string(), quote: z.string(), source_url: z.string() })).default([]),
      qualification: z.object({
        verdict: z.enum(['qualified', 'unqualified', 'uncertain']),
        reason: z.string(),
        evidence: z.array(z.object({ quote: z.string(), source_url: z.string() })).default([]),
      }),
      source_assessments: z.array(z.object({ source_url: z.string(), authority: z.string(), reason: z.string().optional() })).default([]),
      gaps: z.array(z.string()).default([]),
      conflicts: z.array(z.string()).default([]),
    }).passthrough(),
  },
}, safe(async ({ review_id: reviewId, brief }) => {
  const review = getReview(reviewId);
  const { supabase } = await session();
  const validated = normalizeResearchBrief(brief, review.research.sources, review.research.plan);
  review.brief = brief;
  review.validatedBrief = validated;
  review.allowedTags = await activeOpportunityTagNames(supabase);
  const droppedFacts = brief.facts.length - validated.facts.length;
  const verdictChanged = validated.qualification.verdict !== brief.qualification.verdict;
  return text([
    'Validação do dossiê:',
    `- fatos aceitos: ${validated.facts.length}/${brief.facts.length}${droppedFacts ? ` (${droppedFacts} descartados: citação não literal, URL fora das fontes ou campo vazio)` : ''}`,
    `- qualificação: ${validated.qualification.verdict}${verdictChanged ? ` (você propôs ${brief.qualification.verdict}; as regras determinísticas ajustaram: ${validated.qualification.reason})` : ''}`,
    droppedFacts
      ? '\nSe quiser recuperar fatos descartados, chame submit_research_brief de novo com citações copiadas literalmente. Senão, siga para a etapa 3.'
      : '',
    '',
    '=== INSTRUÇÕES DA ETAPA 3 (siga à risca) ===',
    catalogMappingSystemPrompt(review.opportunity, review.allowedTags),
    '',
    '=== MATERIAL ===',
    mappingMaterial(review.research, validated),
    '',
    `Chame submit_catalog_review com review_id, updates e evidence. ${JSON_ONLY}`,
  ].join('\n'));
}));

const evidenceSchema = z.object({
  quote: z.string().optional(),
  source_url: z.string().optional(),
  kind: z.string().optional(),
}).passthrough();

server.registerTool('submit_catalog_review', {
  title: '3/3 Enviar correções',
  description: 'Etapa 3 de 3. Recebe as correções propostas (updates + evidence por campo). Se ainda houver campos problemáticos, pede uma checagem final desses campos antes de gravar. Ao final, valida tudo e grava uma proposta pendente para revisão humana na tela Sentinel.',
  inputSchema: {
    review_id: z.string(),
    updates: z.record(z.string(), z.any()).default({}),
    evidence: z.record(z.string(), evidenceSchema).default({}),
    notes: z.string().optional(),
  },
}, safe(async ({ review_id: reviewId, updates, evidence, notes }) => {
  const review = getReview(reviewId);
  if (!review.validatedBrief) throw new Error('Envie o dossiê com submit_research_brief antes desta etapa.');
  const submission = { updates, evidence, ...(notes ? { notes } : {}) };

  // Primeira chamada: mesma checagem de cobertura do Sentinel. Se faltar
  // campo, devolve o prompt da checagem final e espera a segunda chamada.
  if (!review.mapping) {
    const coverageFields = catalogCoverageFields(review.opportunity, updates, review.allowedTags);
    review.mapping = submission;
    if (coverageFields.length) {
      review.coverageFields = coverageFields;
      return text([
        `Checagem final necessária para: ${coverageFields.join(', ')}.`,
        '',
        '=== INSTRUÇÕES ===',
        coverageAuditSystemPrompt(catalogMappingSystemPrompt(review.opportunity, review.allowedTags), coverageFields),
        '',
        '=== MATERIAL ===',
        coverageMaterial(submission, review.validatedBrief),
        '',
        `Chame submit_catalog_review de novo com o mesmo review_id, trazendo em updates/evidence SOMENTE esses campos. ${JSON_ONLY}`,
      ].join('\n'));
    }
  }
  const coverage = review.coverageFields ? submission : null;

  const { supabase, user } = await session();
  const model = clientModelName();
  const responses = [
    clientResponse(review.brief, model),
    clientResponse(review.mapping, model),
    ...(coverage ? [clientResponse(coverage, model)] : []),
  ];
  const structuredModel = async () => {
    const next = responses.shift();
    if (!next) throw new Error('O pipeline pediu mais respostas do que o cliente enviou.');
    return next;
  };

  const run = await sharedRun(supabase, user, 'catalog_review', { client_model: model });
  let result;
  try {
    result = await researchExistingOpportunity(supabase, run.id, review.opportunity, review.allowedTags, {
      structuredModel,
      research: structuredClone(review.research),
    });
    await recordRunItem(supabase, run, { ok: result.status !== 'failed', metrics: result.metrics, item: review.opportunityId });
  } catch (error) {
    await recordRunItem(supabase, run, { ok: false, metrics: emptyMetrics(), item: review.opportunityId }).catch(() => {});
    throw error;
  }
  reviews.delete(reviewId);

  const { row } = result;
  if (row.status === 'failed') return fail(`A revisão falhou: ${row.error}`);
  const { _sentinel: meta, ...fieldEvidence } = row.evidence || {};
  return text({
    proposal_status: row.status,
    run_id: run.id,
    message: row.status === 'no_changes'
      ? 'Nada a mudar depois da validação.'
      : 'Proposta gravada. Um Admin/Editor aplica ou rejeita campo a campo na tela Sentinel do painel.',
    changes: row.changes,
    evidence: fieldEvidence,
    qualification: meta?.qualification,
    validation_notes: meta?.validation_notes || [],
  });
}));

// --- Descoberta de oportunidades NOVAS ----------------------------------------
// Mesmo pipeline do Sentinel (processPost -> groundUrl -> findOrCreateOpportunity),
// com as respostas do modelo do cliente injetadas, como na revisão. Diferenças
// deliberadas em relação ao painel:
//   - overwriteDuplicates: false — uma duplicata NUNCA sobrescreve a linha do
//     catálogo (no painel, uma "edição mais nova" volta a oportunidade para
//     Revisar). Aqui a resposta manda rodar start_review, que gera proposta.
//   - Um lead da fila (sentinel_posts) só é reivindicado (queued -> pending)
//     quando a pesquisa começa, com o mesmo update condicional do painel.

const discoveries = new Map();
function getDiscovery(id) {
  const discovery = discoveries.get(id);
  if (!discovery || Date.now() - discovery.createdAt > SESSION_TTL_MS) {
    discoveries.delete(id);
    throw new Error('Sessão de descoberta não encontrada ou expirada (1h). Comece de novo com start_discovery.');
  }
  return discovery;
}

// Mantém o lead "vivo": a recuperação de travados (api/lib/staleRecovery.js)
// devolve para a fila o que fica em "pending" sem update por 10 min.
async function touchLead(supabase, sourceUrl) {
  await supabase.from('sentinel_posts').update({ updated_at: new Date().toISOString() })
    .eq('source_url', sourceUrl).eq('status', 'pending');
}

async function releaseLead(supabase, discovery, error) {
  const now = new Date().toISOString();
  const patch = discovery.manual
    ? { status: 'failed', error: String(error?.message || error).slice(0, 1000), processed_at: now, updated_at: now }
    : { status: 'queued', updated_at: now };
  await supabase.from('sentinel_posts').update(patch).eq('source_url', discovery.sourceUrl).eq('status', 'pending');
}

const leadCaption = (caption, max) => {
  const clean = String(caption || '').replace(/\s+/g, ' ').trim();
  return clean.length > max ? `${clean.slice(0, max)}…` : clean;
};

server.registerTool('list_discovery_leads', {
  title: 'Fila de leads (Instagram/web)',
  description: 'Leads ainda não pesquisados da fila do Sentinel (sentinel_posts com status queued): legenda resumida, score da triagem, data e o primeiro link da legenda. Leia as legendas e escolha quais valem uma pesquisa completa (start_discovery com lead_id). Só leitura.',
  inputSchema: {
    source_type: z.enum(['instagram', 'web', 'manual']).optional(),
    since: z.string().optional().describe('Só posts a partir desta data (YYYY-MM-DD)'),
    caption_chars: z.number().int().min(80).max(2000).default(400),
    limit: z.number().int().min(1).max(200).default(60),
    offset: z.number().int().min(0).default(0),
  },
}, safe(async ({ source_type: sourceType, since, caption_chars: captionChars, limit, offset }) => {
  const { supabase } = await session();
  let query = supabase.from('sentinel_posts')
    .select('id, source_url, source_type, owner_username, caption, posted_at, score', { count: 'exact' })
    .eq('status', 'queued')
    .order('score', { ascending: false }).order('posted_at', { ascending: false })
    .range(offset, offset + limit - 1);
  if (sourceType) query = query.eq('source_type', sourceType);
  if (since) query = query.gte('posted_at', since);
  const { data, error, count } = await query;
  if (error) throw error;
  return text({
    total_queued: count,
    leads: (data || []).map((row) => ({
      lead_id: row.id, source_type: row.source_type, account: row.owner_username, posted_at: String(row.posted_at || '').slice(0, 10),
      score: row.score, link_in_caption: extractUrl(row.caption), post_url: row.source_url,
      caption: leadCaption(row.caption, captionChars),
    })),
  });
}));

server.registerTool('dismiss_lead', {
  title: 'Descartar lead',
  description: 'Descarta um lead da fila sem pesquisar (mesmo efeito do "descartar" da tela Sentinel). Use só quando a legenda já deixa claro que não serve para o catálogo (não é uma oportunidade, só universitários/pós, restrito a outro país, pago sem bolsa). NÃO descarte só porque o prazo cai fora da janela da newsletter.',
  inputSchema: { lead_id: z.number().int(), reason: z.string().min(5).max(500) },
}, safe(async ({ lead_id: leadId, reason }) => {
  const { supabase } = await session();
  const now = new Date().toISOString();
  const { data, error } = await supabase.from('sentinel_posts')
    .update({ status: 'rejected', error: `Descartado na triagem (MCP): ${reason}`, processed_at: now, updated_at: now })
    .eq('id', leadId).eq('status', 'queued').select('id');
  if (error) throw error;
  if (!data?.length) throw new Error(`Lead ${leadId} não está na fila (já foi processado ou reivindicado).`);
  return text({ dismissed: leadId });
}));

server.registerTool('scrape_instagram', {
  title: 'Raspar Instagram (Apify)',
  description: 'Roda a raspagem do Instagram do Sentinel (contas ativas da tela Sentinel, posts dos últimos 15 dias) e ENFILEIRA os posts novos que passam na triagem. GASTA CRÉDITO DA APIFY. Não pesquisa nada: depois use list_discovery_leads.',
  inputSchema: {},
}, safe(async () => {
  const { supabase, user } = await session();
  const run = await createRun(supabase, user, 'discovery', 0, { source: 'mcp', scrape_only: true, client_model: clientModelName() });
  try {
    const result = await scrapeInstagramLeads(supabase, run.id);
    await finalizeRun(supabase, run.id, { processed: 0, succeeded: 0, failed: 0 }, emptyMetrics());
    return text({
      accounts: result.accounts, scraped_posts: result.posts.length, already_known: result.posts.length - result.fresh.length,
      skipped_already_in_catalog: result.skippedKnownOpportunity, skipped_low_score: result.skippedLowScore,
      queued: result.queuedPosts.length,
    });
  } catch (error) {
    await finalizeRun(supabase, run.id, { processed: 0, succeeded: 0, failed: 0 }, emptyMetrics(), error).catch(() => {});
    throw error;
  }
}));

server.registerTool('start_discovery', {
  title: '1/3 Começar descoberta',
  description: 'Etapa 1 de 3 para cadastrar uma oportunidade NOVA. Passe lead_id (um lead da fila) OU url (um link oficial que você achou). official_url substitui o link a pesquisar (ex.: post do Instagram com "link na bio"). Coleta as fontes oficiais e devolve o prompt do dossiê factual. Antes, confira com check_duplicate.',
  inputSchema: {
    lead_id: z.number().int().optional(),
    url: z.string().url().optional().describe('Link oficial da oportunidade (página do programa/inscrição, não um agregador)'),
    official_url: z.string().url().optional().describe('Link oficial a pesquisar no lugar do link do lead'),
    note: z.string().max(2000).optional().describe('Pista de origem para uma url manual (ex.: de onde você tirou o link)'),
  },
}, safe(async ({ lead_id: leadId, url, official_url: officialUrl, note }) => {
  if (!!leadId === !!url) throw new Error('Passe exatamente um: lead_id ou url.');
  const { supabase } = await session();
  const now = new Date().toISOString();
  let post; let manual; let sourceUrl;
  if (leadId) {
    const { data, error } = await supabase.from('sentinel_posts')
      .update({ status: 'pending', error: null, updated_at: now })
      .eq('id', leadId).eq('status', 'queued').select('*');
    if (error) throw error;
    const row = data?.[0];
    if (!row) throw new Error(`Lead ${leadId} não está na fila (já foi processado ou outra execução o pegou).`);
    manual = false;
    sourceUrl = row.source_url;
    post = { sourceUrl, caption: row.caption || '', ownerUsername: row.owner_username || '', officialUrl };
  } else {
    manual = true;
    sourceUrl = url;
    const { error } = await supabase.from('sentinel_posts').upsert({
      source_url: url, source_type: 'manual', owner_username: 'manual', caption: note || '', posted_at: now,
      score: -1, status: 'pending', error: null, processed_at: null, updated_at: now,
    }, { onConflict: 'source_url' });
    if (error) throw error;
    post = { url, caption: note || '', ownerUsername: 'manual', officialUrl };
  }
  const discovery = { createdAt: Date.now(), manual, sourceUrl, post, leadId: leadId || null };
  const researchUrl = discoveryResearchUrl(post, manual);
  let research;
  try {
    research = await fetchResearchSources(researchUrl, { link: researchUrl });
    attachLeadSource(research, discoveryLeadSource(post, manual), researchUrl);
  } catch (error) {
    await releaseLead(supabase, discovery, error).catch(() => {});
    throw new Error(`Não foi possível ler as fontes de ${researchUrl}: ${error.message || error}. ${manual ? '' : 'O lead voltou para a fila; tente de novo com official_url.'}`);
  }
  const discoveryId = randomUUID();
  discoveries.set(discoveryId, { ...discovery, researchUrl, research, brief: null });
  return text([
    `discovery_id: ${discoveryId}`,
    `Pesquisando: ${researchUrl}`,
    `Fontes coletadas: ${research.sources.length} (${research.pageFetches} páginas lidas).`,
    '',
    '=== INSTRUÇÕES DA ETAPA (siga à risca) ===',
    researchBriefPrompt({ link: researchUrl }, research.plan),
    '',
    '=== FONTES ===',
    sourcesForPrompt(research.sources),
    '',
    `Monte o dossiê factual e chame submit_discovery_brief com discovery_id e brief. Se as fontes não forem da oportunidade certa, chame abandon_discovery. ${JSON_ONLY}`,
  ].join('\n'));
}));

server.registerTool('abandon_discovery', {
  title: 'Abandonar descoberta',
  description: 'Desiste de uma descoberta em andamento sem gravar oportunidade. Um lead da fila volta para a fila; uma url manual fica marcada como falha com o motivo.',
  inputSchema: { discovery_id: z.string(), reason: z.string().min(5).max(500) },
}, safe(async ({ discovery_id: discoveryId, reason }) => {
  const discovery = getDiscovery(discoveryId);
  const { supabase } = await session();
  await releaseLead(supabase, discovery, reason);
  discoveries.delete(discoveryId);
  return text({ released: discovery.sourceUrl, back_in_queue: !discovery.manual });
}));

const briefSchema = z.object({
  facts: z.array(z.object({ topic: z.string(), fact: z.string(), quote: z.string(), source_url: z.string() })).default([]),
  qualification: z.object({
    verdict: z.enum(['qualified', 'unqualified', 'uncertain']),
    reason: z.string(),
    evidence: z.array(z.object({ quote: z.string(), source_url: z.string() })).default([]),
  }),
  source_assessments: z.array(z.object({ source_url: z.string(), authority: z.string(), reason: z.string().optional() })).default([]),
  gaps: z.array(z.string()).default([]),
  conflicts: z.array(z.string()).default([]),
}).passthrough();

// Roda o pipeline do Sentinel com as respostas do cliente e grava o resultado
// (oportunidade em Revisar, ou lead rejeitado), registrando uma execução.
async function finishDiscovery(discoveryId, answers) {
  const discovery = getDiscovery(discoveryId);
  const { supabase, user } = await session();
  const model = clientModelName();
  const queue = answers.map((answer) => clientResponse(answer, model));
  // Se o pipeline pedir uma resposta extra (a nova tentativa de tags do
  // Sentinel), repete a última: o resultado é validado do mesmo jeito.
  let last = null;
  const structuredModel = async () => {
    last = queue.shift() || last;
    if (!last) throw new Error('O pipeline pediu mais respostas do que o cliente enviou.');
    return last;
  };
  const run = await sharedRun(supabase, user, discovery.manual ? 'manual' : 'discovery', { client_model: model });
  const result = await processPost(supabase, discovery.post, run.id, discovery.manual, discovery.allowedTags || [], {
    overwriteDuplicates: false,
    deps: { structuredModel, research: structuredClone(discovery.research) },
  });
  await recordRunItem(supabase, run, {
    ok: result.status !== 'failed', metrics: result.metrics,
    item: discovery.leadId ? `lead:${discovery.leadId}` : discovery.sourceUrl,
  }).catch((error) => log(`execução não atualizada: ${error.message}`));
  discoveries.delete(discoveryId);
  return { result, runId: run.id };
}

server.registerTool('submit_discovery_brief', {
  title: '2/3 Enviar dossiê da descoberta',
  description: 'Etapa 2 de 3. Valida cada citação do dossiê contra as fontes e aplica as regras determinísticas de qualificação. Se não qualificada, grava o lead como rejeitado e encerra. Senão, devolve o prompt do cadastro (etapa 3).',
  inputSchema: { discovery_id: z.string(), brief: briefSchema },
}, safe(async ({ discovery_id: discoveryId, brief }) => {
  const discovery = getDiscovery(discoveryId);
  const { supabase } = await session();
  const validated = normalizeResearchBrief(brief, discovery.research.sources, discovery.research.plan);
  discovery.brief = brief;
  discovery.allowedTags = await activeOpportunityTagNames(supabase);
  await touchLead(supabase, discovery.sourceUrl).catch(() => {});
  const droppedFacts = brief.facts.length - validated.facts.length;
  if (validated.qualification.verdict === 'unqualified') {
    const { result, runId } = await finishDiscovery(discoveryId, [brief]);
    return text({
      outcome: 'rejected', run_id: runId,
      reason: result.error || validated.qualification.reason,
      message: 'Não qualificada para jovens brasileiros pelas regras do Sentinel. O lead foi marcado como rejeitado; nada entrou no catálogo.',
    });
  }
  return text([
    'Validação do dossiê:',
    `- fatos aceitos: ${validated.facts.length}/${brief.facts.length}${droppedFacts ? ` (${droppedFacts} descartados: citação não literal, URL fora das fontes ou campo vazio)` : ''}`,
    `- qualificação: ${validated.qualification.verdict}${validated.qualification.verdict !== brief.qualification.verdict ? ` (você propôs ${brief.qualification.verdict}; as regras determinísticas ajustaram: ${validated.qualification.reason})` : ''}`,
    droppedFacts ? '\nPara recuperar fatos descartados, chame submit_discovery_brief de novo com citações literais. Senão, siga para a etapa 3.' : '',
    '',
    '=== INSTRUÇÕES DA ETAPA 3 (siga à risca) ===',
    discoveryPrompt(discovery.manual, discovery.allowedTags),
    '',
    '=== DOSSIÊ FACTUAL VALIDADO ===',
    JSON.stringify(validated),
    '',
    'As FONTES são as mesmas da etapa 1 (cite delas, literalmente, com a URL exata).',
    `Chame submit_discovery_entry com discovery_id e entry (o objeto JSON do catálogo, com evidence por campo). ${JSON_ONLY}`,
  ].join('\n'));
}));

server.registerTool('submit_discovery_entry', {
  title: '3/3 Cadastrar oportunidade',
  description: 'Etapa 3 de 3. Recebe o objeto do catálogo (title, description, link, deadline, areas, level, audience, location, cost, language, keywords, eligibility, process, applicants, additionals, type, evidence). Valida tudo com as regras do Sentinel e, se não for duplicata, cria a oportunidade com status "Revisar" para um humano aprovar. Duplicatas não alteram o catálogo.',
  inputSchema: { discovery_id: z.string(), entry: z.record(z.string(), z.any()) },
}, safe(async ({ discovery_id: discoveryId, entry }) => {
  const discovery = getDiscovery(discoveryId);
  if (!discovery.brief) throw new Error('Envie o dossiê com submit_discovery_brief antes desta etapa.');
  const { supabase } = await session();
  // O Sentinel pede uma segunda resposta quando sobram menos de 3 tags
  // válidas; aqui pedimos a correção antes de gravar qualquer coisa.
  const allowedTags = discovery.allowedTags || [];
  if (allowedTags.length && normalizeKeywordTags(entry.keywords || [], allowedTags).length < 3) {
    return fail(`keywords precisa de 3 a 8 nomes EXATOS do vocabulário ativo (vieram ${JSON.stringify(entry.keywords || [])}). Corrija e chame submit_discovery_entry de novo. Vocabulário: ${allowedTags.join(', ')}`);
  }
  await touchLead(supabase, discovery.sourceUrl).catch(() => {});
  const { result, runId } = await finishDiscovery(discoveryId, [discovery.brief, entry]);
  const base = { run_id: runId, validation_notes: result.validationNotes || [] };
  if (result.status === 'failed') return fail(`A descoberta falhou: ${result.error}`);
  if (result.status === 'rejected') return text({ ...base, outcome: 'rejected', reason: result.error });
  const opportunity = result.opportunity || {};
  if (!result.created) {
    return text({
      ...base, outcome: 'duplicate', existing: { id: opportunity.id, title: opportunity.title, status: opportunity.status, deadline: opportunity.deadline },
      newer_edition: result.newerEdition, message: result.duplicateReason,
      next: `Para atualizar a oportunidade existente, rode start_review(${opportunity.id}) — vira uma proposta que um humano aplica na tela Sentinel.`,
    });
  }
  return text({
    ...base, outcome: 'created',
    message: 'Oportunidade criada com status "Revisar". Um Admin/Editor confere e aprova no Catálogo do painel.',
    opportunity: {
      id: opportunity.id, title: opportunity.title, status: opportunity.status, deadline: opportunity.deadline,
      link: opportunity.link, type: opportunity.type, cost: opportunity.cost, qualification_status: opportunity.qualification_status,
    },
    accepted_evidence: Object.keys(result.evidence || {}).filter((field) => !field.startsWith('_')),
  });
}));

// --- Catálogo desatualizado ---------------------------------------------------

server.registerTool('list_refresh_candidates', {
  title: 'Oportunidades a atualizar',
  description: `Lê o catálogo inteiro (sem rede, sem modelo) e classifica cada oportunidade pela situação do prazo, das mais promissoras para a newsletter às menos: ${Object.entries(REFRESH_BUCKETS).map(([bucket, { hint }]) => `${bucket} = ${hint}`).join(' | ')}. Use para escolher quais revisar com start_review. Com status "Revisar", mostra a fila de aprovação humana.`,
  inputSchema: {
    status: z.string().default('Aprovada').describe('Aprovada (padrão), Revisar, Encerrada…'),
    buckets: z.array(z.enum(Object.keys(REFRESH_BUCKETS))).optional().describe('Só estes grupos'),
    limit: z.number().int().min(1).max(300).default(60),
  },
}, safe(async ({ status, buckets, limit }) => {
  const { supabase } = await session();
  const [{ data, error }, featured] = await Promise.all([
    supabase.from('opportunities')
      .select('id, title, deadline, link, type, inscricoes, qualification_status')
      .eq('status', status).limit(10_000),
    fetchLastFeatured(supabase),
  ]);
  if (error) throw error;
  // Fora da triagem: o que nunca poderia entrar na newsletter mesmo com o
  // prazo certo (desqualificada, ou enviada numa edição nos últimos 365 dias).
  const excluded = { unqualified: 0, recently_published: 0 };
  const eligibleRows = (data || []).filter((row) => {
    if (row.qualification_status === 'unqualified') { excluded.unqualified += 1; return false; }
    if (isRecentlyFeatured(featured[row.id])) { excluded.recently_published += 1; return false; }
    return true;
  });
  const { window_end: end, counts, items } = triageCatalog(eligibleRows);
  const selected = buckets?.length ? items.filter((item) => buckets.includes(item.bucket)) : items;
  return text({ status, window_end: end, excluded, counts, showing: Math.min(limit, selected.length), items: selected.slice(0, limit) });
}));

// --- Newsletter --------------------------------------------------------------
// Agentes só criam e editam RASCUNHOS. "Pronta" e "enviada" continuam sendo
// decisões humanas na tela Newsletter. Título, prazo, taxas e link de cada
// entrada vêm sempre do catálogo (fonte da verdade); o agente só escreve o
// texto editorial (summary/elegibilidade da entrada, intro, outro, assunto).

async function fetchLastFeatured(supabase) {
  const { data, error } = await supabase
    .from('newsletter_entries')
    .select('opportunity_id, issue:newsletter_issues!inner(title,status,published_at,created_at)')
    .eq('newsletter_issues.status', 'published');
  if (error) throw error;
  return lastFeaturedFromRows(data || []);
}

async function loadIssue(supabase, id) {
  const { data, error } = await supabase.from('newsletter_issues')
    .select('*, entries:newsletter_entries(*)').eq('id', id).maybeSingle();
  if (error) throw error;
  if (!data) throw new Error(`Edição ${id} não encontrada.`);
  return { ...data, entries: (data.entries || []).sort((a, b) => a.position - b.position) };
}

function defaultIssueMeta(now = new Date()) {
  return {
    title: `Weekly Drop · ${new Intl.DateTimeFormat('pt-BR', { day: '2-digit', month: 'short' }).format(now)}`,
    campaign_slug: `weekly-drop-${now.toISOString().slice(0, 10)}`,
  };
}

// Monta as entradas a partir do catálogo, aplicando as regras de seleção da
// tela. Falha com a lista completa de problemas em vez de gravar uma edição
// pela metade.
async function buildEntries(supabase, requested) {
  const ids = [...new Set(requested.map((entry) => entry.opportunity_id))];
  if (ids.length !== requested.length) throw new Error('Cada oportunidade só pode aparecer uma vez na edição.');
  if (!ids.length) return [];
  const { data: rows, error } = await supabase.from('opportunities').select('*').in('id', ids);
  if (error) throw error;
  const byId = new Map((rows || []).map((row) => [Number(row.id), row]));
  const featured = await fetchLastFeatured(supabase);
  const problems = [];
  const entries = requested.map((entry, position) => {
    const row = byId.get(entry.opportunity_id);
    if (!row) { problems.push(`${entry.opportunity_id}: não existe no catálogo`); return null; }
    const reasons = newsletterIneligibilityReasons(row, featured[row.id]);
    if (reasons.length) problems.push(`${row.id} "${row.title}": ${reasons.join('; ')}`);
    const base = opportunityToNewsletterEntry({ _raw: row }, position);
    return {
      ...base,
      ...(entry.summary !== undefined ? { summary: entry.summary.trim() } : {}),
      ...(entry.eligibility !== undefined ? { eligibility: entry.eligibility.trim() } : {}),
    };
  });
  if (problems.length) {
    throw new Error(`Nada foi gravado. Oportunidades que não podem entrar na newsletter (mesmas regras da tela Newsletter):\n- ${problems.join('\n- ')}\nUse list_newsletter_candidates para ver as elegíveis.`);
  }
  return entries;
}

function issueSummary(issue) {
  return {
    id: issue.id,
    title: issue.title,
    subject: issue.subject,
    preheader: issue.preheader,
    status: issue.status,
    campaign_slug: issue.campaign_slug,
    intro: issue.intro,
    outro: issue.outro,
    updated_at: issue.updated_at,
    entries: (issue.entries || []).map(({ opportunity_id, position, title, summary, eligibility, deadline, fees, link }) => ({
      opportunity_id, position, title, summary, eligibility, deadline, fees, link,
    })),
  };
}

const entryInput = z.object({
  opportunity_id: z.number().int(),
  summary: z.string().max(1500).optional().describe('Texto editorial da entrada (pt-BR). Omitido = descrição do catálogo.'),
  eligibility: z.string().max(1500).optional().describe('Elegibilidade resumida, uma condição por linha. Omitido = a do catálogo.'),
});
const issueFields = {
  title: z.string().max(200).optional().describe('Nome interno da edição. Padrão: "Weekly Drop · <data>"'),
  subject: z.string().max(200).optional().describe('Assunto do e-mail. Padrão: o título'),
  preheader: z.string().max(300).optional(),
  intro: z.string().max(3000).optional(),
  outro: z.string().max(3000).optional(),
};

server.registerTool('list_newsletter_candidates', {
  title: 'Candidatas à newsletter',
  description: 'Oportunidades que podem entrar numa edição agora, pelas mesmas regras da tela Newsletter: status Aprovada, não desqualificada, prazo entre hoje e o fim do próximo mês, e não enviada numa edição publicada nos últimos 365 dias. Ordenadas pelo prazo mais próximo. Indica se já estão em algum rascunho aberto.',
  inputSchema: { limit: z.number().int().min(1).max(200).default(60) },
}, safe(async ({ limit }) => {
  const { supabase } = await session();
  const [{ data: rows, error }, featured, { data: openIssues, error: openError }] = await Promise.all([
    supabase.from('opportunities')
      .select('id, title, status, qualification_status, deadline, type, cost, location, link, description, eligibility')
      .eq('status', 'Aprovada'),
    fetchLastFeatured(supabase),
    supabase.from('newsletter_issues').select('id, title, entries:newsletter_entries(opportunity_id)').neq('status', 'published'),
  ]);
  if (error) throw error;
  if (openError) throw openError;
  const inOpenIssue = new Map();
  for (const issue of openIssues || []) {
    for (const entry of issue.entries || []) {
      if (!entry.opportunity_id) continue;
      inOpenIssue.set(entry.opportunity_id, [...(inOpenIssue.get(entry.opportunity_id) || []), { id: issue.id, title: issue.title }]);
    }
  }
  const candidates = (rows || [])
    .filter((row) => newsletterIneligibilityReasons(row, featured[row.id]).length === 0)
    .sort((a, b) => parseCatalogDeadline(a.deadline) - parseCatalogDeadline(b.deadline))
    .slice(0, limit)
    .map((row) => ({
      id: row.id, title: row.title, deadline: row.deadline, type: row.type, cost: row.cost, location: row.location,
      link: row.link, description: row.description, eligibility: row.eligibility,
      last_published_in: featured[row.id] || null,
      in_open_drafts: inOpenIssue.get(row.id) || [],
    }));
  return text({ count: candidates.length, candidates });
}));

server.registerTool('list_newsletters', {
  title: 'Listar edições',
  description: 'Lista edições da newsletter (rascunho, pronta, enviada), mais recentes primeiro.',
  inputSchema: {
    status: z.enum(['draft', 'ready', 'published']).optional(),
    limit: z.number().int().min(1).max(100).default(20),
  },
}, safe(async ({ status, limit }) => {
  const { supabase } = await session();
  let query = supabase.from('newsletter_issues')
    .select('id, title, subject, status, created_at, updated_at, published_at, entries:newsletter_entries(count)')
    .order('created_at', { ascending: false }).limit(limit);
  if (status) query = query.eq('status', status);
  const { data, error } = await query;
  if (error) throw error;
  return text((data || []).map(({ entries, ...issue }) => ({ ...issue, entry_count: entries?.[0]?.count ?? 0 })));
}));

server.registerTool('get_newsletter', {
  title: 'Ver edição',
  description: 'Todos os campos de uma edição e suas entradas, na ordem.',
  inputSchema: { id: z.number().int() },
}, safe(async ({ id }) => {
  const { supabase } = await session();
  return text(issueSummary(await loadIssue(supabase, id)));
}));

server.registerTool('create_newsletter_draft', {
  title: 'Criar rascunho de newsletter',
  description: 'Cria uma edição em RASCUNHO com as oportunidades dadas, na ordem dada. Título, prazo, taxas e link de cada entrada vêm do catálogo; summary e eligibility podem ser reescritos. Recusa (sem gravar nada) se alguma oportunidade não passar nas regras da tela Newsletter. Um humano revisa e envia pelo painel.',
  inputSchema: { ...issueFields, entries: z.array(entryInput).min(1).max(30) },
}, safe(async ({ entries: requested, ...fields }) => {
  const { supabase } = await session();
  const entries = await buildEntries(supabase, requested);
  const defaults = defaultIssueMeta();
  const issue = {
    ...DEFAULT_ISSUE,
    ...(fields.title ? {} : defaults),
    ...Object.fromEntries(Object.entries(fields).filter(([, value]) => value !== undefined)),
    status: 'draft',
  };
  const saved = await saveNewsletterIssueWith(supabase, issue, entries);
  return text({ message: 'Rascunho criado. Revise e envie pela tela Newsletter do painel.', ...issueSummary(saved) });
}));

server.registerTool('update_newsletter_draft', {
  title: 'Editar rascunho de newsletter',
  description: 'Edita uma edição que ainda está em RASCUNHO. Campos omitidos ficam como estão; se entries for enviado, substitui a lista inteira (na ordem dada) com as mesmas regras de create_newsletter_draft. Edições prontas ou enviadas não podem ser alteradas por aqui.',
  inputSchema: { id: z.number().int(), ...issueFields, entries: z.array(entryInput).min(1).max(30).optional() },
}, safe(async ({ id, entries: requested, ...fields }) => {
  const { supabase } = await session();
  const current = await loadIssue(supabase, id);
  if (current.status !== 'draft') {
    throw new Error(`A edição ${id} está como "${current.status}" — só rascunhos podem ser editados por agentes. Volte-a para rascunho no painel, se for o caso.`);
  }
  const entries = requested ? await buildEntries(supabase, requested) : current.entries;
  const { entries: _ignored, ...currentIssue } = current;
  const issue = {
    ...currentIssue,
    ...Object.fromEntries(Object.entries(fields).filter(([, value]) => value !== undefined)),
    status: 'draft',
  };
  const saved = await saveNewsletterIssueWith(supabase, issue, entries);
  return text({ message: 'Rascunho atualizado.', ...issueSummary(saved) });
}));

server.registerTool('preview_newsletter', {
  title: 'Prévia da newsletter (HTML)',
  description: 'Gera o HTML da edição exatamente como a tela Newsletter gera para colar no beehiiv.',
  inputSchema: { id: z.number().int() },
}, safe(async ({ id }) => {
  const { supabase } = await session();
  const issue = await loadIssue(supabase, id);
  return text(buildNewsletterHtml(issue, issue.entries));
}));

server.registerPrompt('review_opportunity', {
  title: 'Revisar oportunidade do catálogo',
  description: 'Roda a revisão completa do Sentinel para uma oportunidade, usando o seu modelo.',
  argsSchema: { opportunity_id: z.string().describe('id numérico da oportunidade') },
}, ({ opportunity_id: id }) => ({
  messages: [{
    role: 'user',
    content: {
      type: 'text',
      text: `Revise a oportunidade ${id} do catálogo Access+ com as ferramentas do Sentinel: chame start_review, siga as instruções devolvidas, envie o dossiê com submit_research_brief e as correções com submit_catalog_review (incluindo a checagem final, se pedida). No fim, resuma em português o que foi proposto e o que a validação descartou.`,
    },
  }],
}));

server.registerPrompt('prepare_newsletter', {
  title: 'Preparar material da newsletter',
  description: 'Atualiza o catálogo e busca oportunidades novas para a próxima edição; tudo vira proposta ou "Revisar" para aprovação humana.',
  argsSchema: { max_reviews: z.string().optional().describe('Máximo de revisões de catálogo (padrão 12)') },
}, ({ max_reviews: maxReviews }) => ({
  messages: [{
    role: 'user',
    content: {
      type: 'text',
      text: [
        'Prepare o material da próxima edição da newsletter Access+ com as ferramentas do Sentinel. Não crie o rascunho da newsletter: quem monta a edição é um humano.',
        '1. Linha de base: list_newsletter_candidates, list_refresh_candidates (Aprovada e Revisar).',
        `2. Catálogo: escolha até ${maxReviews || 12} oportunidades dos grupos month_in_window, past_cycle_due e empty e rode start_review -> submit_research_brief -> submit_catalog_review em cada uma.`,
        '3. Novas: leia list_discovery_leads, descarte (dismiss_lead) só o que claramente não serve, e pesquise as promissoras com start_discovery -> submit_discovery_brief -> submit_discovery_entry. Se puder buscar na web, procure também oportunidades para estudantes brasileiros do ensino médio com prazo até o fim do próximo mês, sempre pelo link oficial e depois de check_duplicate.',
        '4. No fim, liste em português: oportunidades novas (em Revisar), propostas de atualização (campo antes -> depois), o que já está em Revisar com prazo na janela, e o que foi rejeitado/descartado e por quê — com onde aprovar cada item no painel.',
      ].join('\n'),
    },
  }],
}));

await server.connect(new StdioServerTransport());
log('pronto (stdio)');
