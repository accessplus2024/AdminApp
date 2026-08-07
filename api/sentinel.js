import { ApifyClient } from 'apify-client';
import OpenAI from 'openai';
import { createClient } from '@supabase/supabase-js';

export const config = { maxDuration: 300 };

const DEFAULT_MODELS = ['openai/gpt-oss-20b', 'z-ai/glm-5.2'];
const CONFIGURED_MODELS = (process.env.SENTINEL_MODELS || DEFAULT_MODELS.join(','))
  .split(',')
  .map((model) => model.trim())
  .filter(Boolean);
const MODELS = CONFIGURED_MODELS.length ? CONFIGURED_MODELS : DEFAULT_MODELS;
const MODEL = MODELS.join(' -> ');
const MODEL_TIMEOUT_MS = Math.max(10_000, Math.min(Number(process.env.SENTINEL_MODEL_TIMEOUT_MS) || 45_000, 120_000));
const MAX_ADJACENT_PAGES = Math.max(0, Math.min(Number(process.env.SENTINEL_ADJACENT_PAGES) || 2, 4));
const SOURCE_CHAR_LIMIT = Math.max(12_000, Math.min(Number(process.env.SENTINEL_SOURCE_CHAR_LIMIT) || 24_000, 40_000));
const MAX_DISCOVERY_CANDIDATES = 500;
const CATALOG_PROMPT_VERSION = 'catalog-review-v6-ux';
const DISCOVERY_PROMPT_VERSION = 'discovery-v3-ux';
const SCORE_THRESHOLD = 4;
const SOURCE_ACCOUNTS = ['opportunitydesk', 'opportunities_corners', 'opportunitiesforyouth', 'adroiteducation', 'borderless.so'];
const HS_SIGNALS = ['high school', 'secondary school', 'high schooler', 'grade 9', 'grade 10', 'grade 11', 'grade 12'];
const YOUTH_SIGNALS = ['youth', 'young people', 'teenager', 'teen', '16', '17', '18'];
const FUNDING_SIGNALS = ['funded', 'fully funded', 'free', 'scholarship', 'grant', 'stipend', 'fellowship', 'financial aid', 'all expenses'];
const BRAZIL_SIGNALS = ['brazil', 'brazilian', 'all nationals', 'open to all', 'all countries'];
const UNIVERSITY_PENALTIES = ['phd', 'ph.d', 'doctorate', 'doctoral', 'postdoc', 'postdoctoral', "master's", 'masters', 'master degree', 'master of', 'professor', 'faculty', 'researcher', 'research grant', "bachelor's", 'bachelors', 'undergraduate degree'];
const REVIEW_FIELDS = ['title', 'description', 'link', 'deadline', 'areas', 'level', 'location', 'audience', 'cost', 'language', 'keywords', 'eligibility', 'process', 'applicants', 'additionals', 'type', 'status'];
const ARRAY_FIELDS = new Set(['areas', 'level', 'audience', 'keywords']);
const LINE_LIST_FIELDS = new Set(['eligibility', 'applicants']);
const REQUIRED_TEXT_FIELDS = new Set(['title', 'type', 'status']);
const CONTROLLED_VALUES = {
  areas: new Set(['STEM', 'Humanas', 'Meio Ambiente', 'Linguagens', 'Artes']),
  level: new Set(['Ensino Médio', 'Fundamental', 'Gap Year']),
  audience: new Set(['Meninas', 'Escola Pública', 'Indígenas', 'Deficientes', 'Negros', 'LGBT', 'Baixa Renda']),
  type: new Set(['Programas Acadêmicos', 'Olimpíadas Científicas', 'Competições', 'Competições de Escrita', 'Mentorias', 'Bolsas de Estudo', 'Programas de Intercâmbio', 'MUNs', 'Estágios']),
  status: new Set(['Aprovada', 'Revisar', 'Rascunho', 'Encerrada']),
};
const PORTUGUESE_TEXT_FIELDS = new Set(['description', 'location', 'cost', 'language', 'eligibility', 'process', 'applicants', 'additionals', 'keywords']);
const ENGLISH_CATALOG_PATTERN = /\b(?:application fee|participation fee|per project|per participant|fully funded|high school|undergraduate|graduate students?|applications?|registration|eligible|eligibility|deadline|in-person|online only|short film|speech|coding|entrepreneurship|scholarships?|fees?|free|USA)\b/i;

function serverClient(req) {
  const url = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY
    || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
    || process.env.VITE_SUPABASE_PUBLISHABLE_KEY
    || process.env.VITE_SUPABASE_ANON_KEY
    || process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error('A URL e a chave pública do Supabase precisam estar configuradas no servidor.');
  const authorization = req?.headers?.authorization;
  return createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
    global: authorization ? { headers: { Authorization: authorization } } : undefined,
  });
}

async function authorize(req, supabase) {
  const token = String(req.headers.authorization || '').replace(/^Bearer\s+/i, '');
  if (!token) throw Object.assign(new Error('Sessão ausente.'), { statusCode: 401 });
  const { data, error } = await supabase.auth.getUser(token);
  if (error || !data.user?.email) throw Object.assign(new Error('Sessão inválida.'), { statusCode: 401 });
  const { data: admin } = await supabase.from('admins').select('role').eq('email', data.user.email).maybeSingle();
  if (!admin || !['Admin', 'Editor'].includes(admin.role)) {
    throw Object.assign(new Error('Apenas Admins e Editores podem executar o Sentinel.'), { statusCode: 403 });
  }
  return data.user;
}

const emptyMetrics = () => ({ modelCalls: 0, pageFetches: 0, inputTokens: 0, outputTokens: 0 });
function addMetrics(...items) {
  return items.reduce((total, item) => ({
    modelCalls: total.modelCalls + Number(item?.modelCalls || 0),
    pageFetches: total.pageFetches + Number(item?.pageFetches || 0),
    inputTokens: total.inputTokens + Number(item?.inputTokens || 0),
    outputTokens: total.outputTokens + Number(item?.outputTokens || 0),
  }), emptyMetrics());
}

async function createRun(supabase, user, runType, requestedCount, metadata = {}) {
  const { data, error } = await supabase.from('sentinel_research_runs').insert({
    run_type: runType,
    requested_count: requestedCount,
    model: MODEL,
    prompt_version: runType === 'catalog_review' ? CATALOG_PROMPT_VERSION : DISCOVERY_PROMPT_VERSION,
    metadata,
    created_by: user.id,
  }).select().single();
  if (error) throw error;
  return data;
}

async function updateRun(supabase, runId, patch) {
  const { data, error } = await supabase.from('sentinel_research_runs').update(patch).eq('id', runId).select().single();
  if (error) throw error;
  return data;
}

async function finalizeRun(supabase, runId, result, metrics, fatalError = null) {
  return updateRun(supabase, runId, {
    status: fatalError ? 'failed' : (result.failed > 0 ? 'partial' : 'completed'),
    processed_count: result.processed,
    succeeded_count: result.succeeded,
    failed_count: result.failed,
    model_calls: metrics.modelCalls,
    page_fetches: metrics.pageFetches,
    input_tokens: metrics.inputTokens,
    output_tokens: metrics.outputTokens,
    error: fatalError ? String(fatalError.message || fatalError).slice(0, 2000) : null,
    completed_at: new Date().toISOString(),
  });
}

function scorePost(post) {
  const caption = String(post.caption || '').toLowerCase();
  let points = 0;
  for (const word of HS_SIGNALS) if (caption.includes(word)) points += 5;
  for (const word of YOUTH_SIGNALS) if (caption.includes(word)) points += 2;
  for (const word of FUNDING_SIGNALS) if (caption.includes(word)) points += 2;
  for (const word of BRAZIL_SIGNALS) if (caption.includes(word)) points += 1;
  for (const word of UNIVERSITY_PENALTIES) if (caption.includes(word)) points -= 4;
  return points;
}

export function discoveryScreeningStatus(score) {
  return Number(score) >= SCORE_THRESHOLD ? 'queued' : 'rejected';
}

function extractUrl(value) {
  return String(value || '').match(/https?:\/\/[^\s\)"]+/)?.[0] || null;
}

const TRACKING_PARAMS = /^(?:utm_.+|fbclid|gclid|mc_cid|mc_eid|ref|referrer|source)$/i;
const DISCOVERY_TITLE_NOISE = new Set([
  'apply', 'application', 'applications', 'conference', 'funded', 'fully', 'now',
  'open', 'opportunity', 'program', 'programme', 'scholarship',
]);

export function canonicalizeOpportunityUrl(value) {
  try {
    const url = new URL(String(value || '').trim());
    url.hash = '';
    url.hostname = comparableHost(url.hostname);
    for (const key of [...url.searchParams.keys()]) {
      if (TRACKING_PARAMS.test(key)) url.searchParams.delete(key);
    }
    url.searchParams.sort();
    url.pathname = url.pathname.replace(/\/+$/, '') || '/';
    return url.toString().replace(/\/$/, '');
  } catch {
    return String(value || '').trim().toLowerCase().replace(/\/+$/, '');
  }
}

export function discoveryTitleTokens(value) {
  return String(value || '')
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim().split(/\s+/)
    .filter((token) => token && !DISCOVERY_TITLE_NOISE.has(token));
}

export function opportunityDiscoveryKey(link, title) {
  return `${canonicalizeOpportunityUrl(link)}|${discoveryTitleTokens(title).join(' ')}`;
}

export function discoveryTitleSimilarity(left, right) {
  const a = new Set(discoveryTitleTokens(left));
  const b = new Set(discoveryTitleTokens(right));
  if (!a.size || !b.size) return 0;
  const intersection = [...a].filter((token) => b.has(token)).length;
  return intersection / Math.min(a.size, b.size);
}

export function isDuplicateOpportunity(candidate, extracted) {
  const sameKey = candidate?.sentinel_discovery_key
    && candidate.sentinel_discovery_key === opportunityDiscoveryKey(extracted.link, extracted.title);
  if (sameKey) return true;
  const similarity = discoveryTitleSimilarity(candidate?.title, extracted.title);
  const sameUrl = canonicalizeOpportunityUrl(candidate?.link) === canonicalizeOpportunityUrl(extracted.link);
  return (sameUrl && similarity >= 0.72) || (similarity === 1 && discoveryTitleTokens(extracted.title).length >= 4);
}

function decodeHtmlEntities(value) {
  return String(value || '')
    .replace(/&#x([0-9a-f]+);/gi, (_, code) => String.fromCodePoint(parseInt(code, 16)))
    .replace(/&#(\d+);/g, (_, code) => String.fromCodePoint(Number(code)))
    .replace(/&amp;/gi, '&').replace(/&quot;/gi, '"').replace(/&apos;|&#39;/gi, "'").replace(/&nbsp;/gi, ' ');
}

function stripHtml(html) {
  return decodeHtmlEntities(html.replace(/<script[\s\S]*?<\/script>/gi, '').replace(/<style[\s\S]*?<\/style>/gi, '').replace(/<[^>]+>/g, ' ')).replace(/\s+/g, ' ').trim();
}

const ADJACENT_LINK_SIGNALS = [
  ['deadline', 12], ['application', 10], ['registration', 10], ['apply', 9], ['register', 9],
  ['inscri', 10], ['prazo', 12], ['edital', 9], ['rules', 7], ['regulamento', 7],
  ['important dates', 9], ['timeline', 8], ['calendar', 6], ['faq', 5], ['eligibility', 5],
  ['guide', 6], ['news', 4], ['resources', 3], ['schedule', 3],
];
const ADJACENT_LINK_BLOCKLIST = /(?:privacy|cookie|terms|login|sign[ -]?in|donate|sponsor|facebook|instagram|linkedin|youtube|mailto:|javascript:)/i;
const ADJACENT_EVENT_PENALTY = /(?:will be held|takes place|event date|tournament day|logistics|finals?\b)/i;

function comparableHost(hostname) {
  return String(hostname || '').toLowerCase().replace(/^www\./, '');
}

export function extractAdjacentLinks(html, baseUrl) {
  let base;
  try { base = new URL(baseUrl); } catch { return []; }
  const baseHost = comparableHost(base.hostname);
  const candidates = new Map();
  const pattern = /<a\b[^>]*href\s*=\s*(["'])(.*?)\1[^>]*>([\s\S]*?)<\/a>/gi;
  let match;
  while ((match = pattern.exec(String(html || '')))) {
    const label = stripHtml(match[3]);
    const rawHref = decodeHtmlEntities(match[2].trim());
    const searchable = `${label} ${rawHref}`.toLowerCase();
    if (!rawHref || ADJACENT_LINK_BLOCKLIST.test(searchable)) continue;
    let target;
    try { target = new URL(rawHref, base); } catch { continue; }
    if (!['http:', 'https:'].includes(target.protocol)) continue;
    target.hash = '';
    if (target.href === base.href || /\.(?:jpe?g|png|gif|webp|svg|zip|mp4|mp3)$/i.test(target.pathname)) continue;
    const score = ADJACENT_LINK_SIGNALS.reduce((total, [signal, weight]) => total + (searchable.includes(signal) ? weight : 0), 0)
      - (ADJACENT_EVENT_PENALTY.test(searchable) ? 4 : 0);
    if (score <= 0) continue;
    const targetHost = comparableHost(target.hostname);
    const relatedHost = targetHost === baseHost || targetHost.endsWith(`.${baseHost}`) || baseHost.endsWith(`.${targetHost}`);
    if (!relatedHost && score < 9) continue;
    const previous = candidates.get(target.href);
    if (!previous || score > previous.score) candidates.set(target.href, { url: target.href, label, score });
  }
  return [...candidates.values()].sort((a, b) => b.score - a.score || a.url.localeCompare(b.url));
}

async function fetchPageText(url, { maxChars = 12_000, discoverLinks = false } = {}) {
  let pageFetches = 0;
  try {
    pageFetches += 1;
    const response = await fetch(url, {
      redirect: 'follow',
      headers: { 'User-Agent': 'Mozilla/5.0 (compatible; AccessPlus-Sentinel/3.0)', Accept: 'text/html,text/plain' },
      signal: AbortSignal.timeout(12_000),
    });
    if (response.ok) {
      const raw = await response.text();
      const text = stripHtml(raw).slice(0, maxChars);
      if (text.length > 200) return {
        url: response.url || url,
        text,
        links: discoverLinks ? extractAdjacentLinks(raw, response.url || url) : [],
        pageFetches,
      };
    }
  } catch { /* use the text fallback */ }

  pageFetches += 1;
  try {
    const fallback = await fetch(`https://r.jina.ai/${url}`, {
      headers: { Accept: 'text/plain' },
      signal: AbortSignal.timeout(30_000),
    });
    if (!fallback.ok) throw new Error(`HTTP ${fallback.status}`);
    return { url, text: (await fallback.text()).slice(0, maxChars), links: [], pageFetches };
  } catch (error) {
    throw Object.assign(new Error(`Não foi possível ler ${url} (${String(error.message || error)}).`), { pageFetches });
  }
}

async function fetchResearchSources(url) {
  const primaryLimit = Math.min(12_000, SOURCE_CHAR_LIMIT);
  const primary = await fetchPageText(url, { maxChars: primaryLimit, discoverLinks: true });
  const remainingChars = Math.max(0, SOURCE_CHAR_LIMIT - primary.text.length);
  const adjacentLimit = MAX_ADJACENT_PAGES ? Math.max(3_000, Math.floor(remainingChars / MAX_ADJACENT_PAGES)) : 0;
  const selectedLinks = primary.links.slice(0, MAX_ADJACENT_PAGES);
  const adjacentResults = await withConcurrency(selectedLinks, 2, async (link) => {
    try {
      const page = await fetchPageText(link.url, { maxChars: adjacentLimit });
      return { source: { url: page.url, text: page.text, relation: link.label || 'Link relacionado' }, pageFetches: page.pageFetches };
    } catch (error) {
      return { source: null, pageFetches: error.pageFetches || 0, error: `${link.url}: ${String(error.message || error)}` };
    }
  });
  return {
    sources: [{ url: primary.url, text: primary.text, relation: 'Página principal' }, ...adjacentResults.map((result) => result.source).filter(Boolean)],
    pageFetches: primary.pageFetches + adjacentResults.reduce((total, result) => total + result.pageFetches, 0),
    adjacentFailures: adjacentResults.filter((result) => result.error).map((result) => result.error),
  };
}

function sourcesForPrompt(sources) {
  return sources.map((source, index) => `[FONTE ${index + 1}]\nURL: ${source.url}\nContexto: ${source.relation}\nConteúdo:\n${source.text}`).join('\n\n');
}

function openAiClient() {
  if (!process.env.NVIDIA_API_KEY) throw new Error('NVIDIA_API_KEY não configurada no servidor.');
  return new OpenAI({ apiKey: process.env.NVIDIA_API_KEY, baseURL: 'https://integrate.api.nvidia.com/v1', timeout: MODEL_TIMEOUT_MS, maxRetries: 0 });
}

function modelRequestOptions(model) {
  if (model === 'openai/gpt-oss-20b' || model === 'openai/gpt-oss-120b') {
    return { reasoning_effort: 'low' };
  }
  if (model.startsWith('z-ai/glm-')) {
    return { chat_template_kwargs: { enable_thinking: false, clear_thinking: true } };
  }
  return {};
}

function modelErrorMessage(error) {
  if (error?.name === 'APIConnectionTimeoutError' || /timed out|timeout/i.test(String(error?.message || error))) {
    return `Tempo limite de ${Math.round(MODEL_TIMEOUT_MS / 1000)}s excedido`;
  }
  return String(error?.message || error || 'Falha desconhecida').slice(0, 500);
}

async function callModel(system, user) {
  const attempts = [];
  let metrics = emptyMetrics();
  for (const model of MODELS) {
    const startedAt = Date.now();
    try {
      const stream = await openAiClient().chat.completions.create({
        model,
        temperature: 0.15,
        max_tokens: 2048,
        messages: [{ role: 'system', content: system }, { role: 'user', content: user }],
        ...modelRequestOptions(model),
        stream: true,
        stream_options: { include_usage: true },
      });
      let content = '';
      let usage;
      for await (const chunk of stream) {
        content += chunk.choices?.[0]?.delta?.content || '';
        if (chunk.usage) usage = chunk.usage;
      }
      if (!content.trim()) throw new Error('O modelo devolveu uma resposta vazia.');
      const attempt = {
        model, status: 'succeeded', duration_ms: Date.now() - startedAt,
        input_tokens: usage?.prompt_tokens || 0, output_tokens: usage?.completion_tokens || 0,
      };
      attempts.push(attempt);
      metrics = addMetrics(metrics, {
        modelCalls: 1,
        inputTokens: attempt.input_tokens,
        outputTokens: attempt.output_tokens,
      });
      return { content, model, attempts, metrics };
    } catch (error) {
      attempts.push({
        model, status: 'failed', duration_ms: Date.now() - startedAt,
        error: modelErrorMessage(error),
      });
      metrics = addMetrics(metrics, { modelCalls: 1 });
    }
  }
  const error = new Error(`Todos os modelos falharam: ${attempts.map((attempt) => `${attempt.model} (${attempt.error})`).join('; ')}`);
  error.metrics = metrics;
  error.modelAttempts = attempts;
  throw error;
}

function parseJsonObject(raw) {
  const match = raw.match(/\{[\s\S]*\}/);
  if (!match) throw new Error('O modelo não devolveu um objeto JSON.');
  return JSON.parse(match[0]);
}

export function discoveryPrompt(manual = false) {
  const today = new Date().toISOString().slice(0, 10);
  const cutoff = new Date(Date.now() + 30 * 86400_000).toISOString().slice(0, 10);
  const criteria = manual ? '' : `\nInclua apenas oportunidades gratuitas ou com apoio financeiro substancial, abertas a brasileiros, adequadas a estudantes de 14–18 anos e com prazo até ${cutoff}, contínuo ou desconhecido. Exclua oportunidades exclusivamente universitárias e prazos anteriores a ${today}.`;
  return `Você pesquisa novas oportunidades educacionais para estudantes brasileiros do ensino médio. Hoje é ${today}. Baseie tudo SOMENTE nas fontes fornecidas e não complete lacunas por conhecimento prévio.${criteria}

PRAZOS:
1. deadline é somente a data limite para enviar candidatura, inscrição, projeto ou indicação.
2. Data do evento, cerimônia, resultado, viagem, início, pagamento ou final não comprova deadline.
3. Só informe deadline com uma citação que diga explicitamente deadline, applications close/due, registration closes/ends, submit by, register by, inscrições até, prazo ou equivalente.
4. Não infira datas pelo calendário e não misture edições.
5. Formate sem zero à esquerda: "4 de setembro de 2026". Se não houver prazo comprovado, use null.

IDIOMA E TAXONOMIA:
- Todos os valores, exceto nomes próprios, citações e URLs, devem estar em português brasileiro.
- cost deve separar taxa de candidatura de taxas cobradas apenas de finalistas ou participantes.
- location deve separar candidatura remota de evento ou final presencial.
- areas: STEM, Humanas, Meio Ambiente, Linguagens ou Artes.
- level: Ensino Médio, Fundamental ou Gap Year.
- audience: Meninas, Escola Pública, Indígenas, Deficientes, Negros, LGBT ou Baixa Renda.
- type: Programas Acadêmicos, Olimpíadas Científicas, Competições, Competições de Escrita, Mentorias, Bolsas de Estudo, Programas de Intercâmbio, MUNs ou Estágios.

QUALIDADE DO TEXTO:
- Escreva para estudantes e famílias, em linguagem simples, direta e sem tom promocional.
- title deve conter apenas o nome oficial. Remova chamadas como "apply now" e "fully funded" quando não fizerem parte do nome.
- description deve explicar o que é a oportunidade, para quem é e o principal apoio oferecido em até 45 palavras e duas frases.
- eligibility alimenta a seção "Elegibilidade e guia de aplicação". Escreva até 7 itens curtos, um por linha, sem símbolos de bullet. Comece cada item com verbo e limite-o a 14 palavras. Inclua apenas critérios comprovados e nunca invente itens para completar a lista.
- process deve orientar a candidatura em até três frases curtas, na ordem das ações.
- applicants deve trazer somente dicas específicas e comprovadas pela fonte. Se houver apenas orientação genérica, use null.
- additionals deve conter somente informação importante que não caiba nos outros campos. Não repita prazo, custo ou elegibilidade.
- Não use reticências, placeholders, jargão corporativo nem frases como "orientações disponíveis no site".

Cada campo preenchido deve ter evidence com citação literal e a URL exata da página onde o trecho foi encontrado. Se veio de inscrições, regulamento ou outra página adjacente, use essa URL, não a página principal.

Responda SOMENTE com JSON cru:
{"qualified":true,"title":"Nome oficial","description":"Programa para estudantes que oferece formação e apoio financeiro.","link":"URL oficial","deadline":"4 de setembro de 2026","areas":["STEM"],"level":["Ensino Médio"],"location":"Candidatura remota; atividades presenciais em São Paulo","audience":[],"cost":"Gratuito","language":"Inglês","keywords":["tema"],"eligibility":"Estar no ensino médio\\nMorar no Brasil\\nEnviar o formulário até o prazo","process":"Preencha o formulário. Anexe os documentos solicitados. Envie a candidatura.","applicants":null,"additionals":null,"type":"Programas Acadêmicos","evidence":{"deadline":{"quote":"Applications close on September 4, 2026","source_url":"https://example.org/apply","kind":"application_deadline"}}}
Se não se qualificar ou não houver dados suficientes: {"qualified":false,"reason":"motivo curto em português"}.`;
}

function normalizeDiscoveryResult(parsed, research, fallbackUrl) {
  if (parsed.qualified === false) return { result: null, rejectionReason: String(parsed.reason || 'Não atende aos critérios da busca.') };
  const aliases = { title: parsed.title || parsed.name, description: parsed.description || parsed.summary, cost: parsed.cost || parsed.fees };
  const result = {};
  const evidence = {};
  const validationNotes = [];
  for (const field of REVIEW_FIELDS.filter((item) => item !== 'status')) {
    const raw = Object.prototype.hasOwnProperty.call(aliases, field) ? aliases[field] : parsed[field];
    if (raw == null || raw === '') continue;
    const normalized = normalizeUpdate(field, raw);
    if (normalized === undefined || !isPortugueseCatalogValue(field, normalized)) {
      validationNotes.push(`${field} descartado: valor inválido ou fora da taxonomia em português`);
      continue;
    }
    if (field === 'deadline') {
      const checked = validateFieldEvidence(field, normalized, parsed.evidence?.[field], research.sources);
      if (!checked.valid) {
        validationNotes.push(`deadline descartado: ${checked.reason}`);
        continue;
      }
      evidence[field] = checked.evidence;
    } else if (parsed.evidence?.[field]) {
      const checked = validateFieldEvidence(field, normalized, parsed.evidence[field], research.sources);
      if (checked.valid) evidence[field] = checked.evidence;
      else validationNotes.push(`${field}: evidência descartada (${checked.reason})`);
    }
    result[field] = normalized;
  }
  result.title = result.title || String(parsed.title || parsed.name || '').trim();
  const proposedLink = canonicalizeOpportunityUrl(result.link || parsed.link || fallbackUrl);
  const hostOf = (value) => { try { return comparableHost(new URL(value).hostname); } catch { return ''; } };
  const relatedLink = hostOf(proposedLink) && research.sources.some((source) => hostOf(source.url) === hostOf(proposedLink));
  result.link = relatedLink ? proposedLink : canonicalizeOpportunityUrl(research.sources[0]?.url || fallbackUrl);
  if (!result.title || !result.link) return { result: null, rejectionReason: 'A fonte não confirmou nome e link oficial suficientes.' };
  if (result.deadline && isPastDate(result.deadline)) return { result: null, rejectionReason: `O prazo confirmado (${result.deadline}) já passou.` };
  result.description = result.description || 'Descrição ainda não confirmada. Revise antes de publicar.';
  result.level = result.level?.length ? result.level : ['Ensino Médio'];
  result.areas = result.areas || [];
  result.audience = result.audience || [];
  result.keywords = [...new Set([...(result.keywords || []), 'Sentinel'])];
  result.type = result.type || 'Programas Acadêmicos';
  return { result, evidence, validationNotes };
}

async function groundUrl(url, caption = '', ownerUsername = '', manual = false) {
  const research = await fetchResearchSources(url);
  let metrics = { ...emptyMetrics(), pageFetches: research.pageFetches };
  try {
    const response = await callModel(discoveryPrompt(manual), `Legenda: ${caption}\nConta: @${ownerUsername}\nURL inicial: ${url}\n\n${sourcesForPrompt(research.sources)}\n\nRetorne o JSON agora.`);
    metrics = addMetrics(metrics, response.metrics);
    const normalized = normalizeDiscoveryResult(parseJsonObject(response.content), research, url);
    return {
      ...normalized,
      metrics,
      trace: {
        selected_model: response.model,
        model_attempts: response.attempts,
        sources: research.sources.map((source) => ({ url: source.url, relation: source.relation })),
        adjacent_failures: research.adjacentFailures,
      },
    };
  } catch (error) {
    error.metrics = addMetrics(error.metrics, metrics);
    throw error;
  }
}

async function findOrCreateOpportunity(supabase, extracted) {
  const discoveryKey = opportunityDiscoveryKey(extracted.link, extracted.title);
  const { data: exactKey, error: exactKeyError } = await supabase.from('opportunities').select('*').eq('sentinel_discovery_key', discoveryKey).maybeSingle();
  if (exactKeyError) throw exactKeyError;
  if (exactKey) return { opportunity: exactKey, created: false, duplicateReason: 'Mesma chave de descoberta.' };

  const { data: candidates, error: candidatesError } = await supabase.from('opportunities').select('*').not('link', 'is', null);
  if (candidatesError) throw candidatesError;
  const existing = (candidates || []).find((candidate) => isDuplicateOpportunity(candidate, extracted));
  if (existing) return { opportunity: existing, created: false, duplicateReason: 'Mesmo link oficial e nome equivalente.' };

  const row = {
    title: extracted.title, description: extracted.description || '', link: canonicalizeOpportunityUrl(extracted.link),
    deadline: extracted.deadline || null, areas: extracted.areas || [], level: extracted.level || ['Ensino Médio'], location: extracted.location || null,
    audience: extracted.audience || [], cost: extracted.cost || null, language: extracted.language || null, keywords: extracted.keywords || ['Sentinel'],
    eligibility: Array.isArray(extracted.eligibility) ? extracted.eligibility.join('\n') : String(extracted.eligibility || ''),
    process: extracted.process || null, applicants: extracted.applicants || null,
    additionals: extracted.additionals || null,
    resources: [], status: 'Revisar', review: null, type: extracted.type || 'Programas Acadêmicos',
    sentinel_discovery_key: discoveryKey,
  };
  const { data, error } = await supabase.from('opportunities').insert(row).select().single();
  if (error?.code === '23505') {
    const { data: raced } = await supabase.from('opportunities').select('*').eq('sentinel_discovery_key', discoveryKey).single();
    return { opportunity: raced, created: false, duplicateReason: 'Outra execução criou a oportunidade primeiro.' };
  }
  if (error) throw error;
  return { opportunity: data, created: true, duplicateReason: null };
}

async function updatePost(supabase, sourceUrl, patch) {
  const { error } = await supabase.from('sentinel_posts').update(patch).eq('source_url', sourceUrl);
  if (error) throw error;
}

async function processPost(supabase, post, runId, manual = false) {
  const sourceUrl = manual ? post.url : post.sourceUrl;
  const officialUrl = manual ? post.url : extractUrl(post.caption);
  if (!officialUrl) {
    const now = new Date().toISOString();
    await updatePost(supabase, sourceUrl, { status: 'rejected', error: 'Nenhum link oficial encontrado na legenda.', processed_at: now, updated_at: now, run_id: runId });
    return { status: 'rejected', metrics: emptyMetrics() };
  }
  try {
    const researched = await groundUrl(officialUrl, post.caption, post.ownerUsername, manual);
    if (!researched.result) {
      const now = new Date().toISOString();
      await updatePost(supabase, sourceUrl, {
        status: 'rejected', processed_at: now, updated_at: now, run_id: runId,
        error: researched.rejectionReason || 'A fonte não atende aos critérios da busca.',
        extracted: { evidence: researched.evidence || {}, _sentinel: { ...researched.trace, validation_notes: researched.validationNotes || [] } },
      });
      return { status: 'rejected', metrics: researched.metrics };
    }
    const { opportunity, created, duplicateReason } = await findOrCreateOpportunity(supabase, researched.result);
    const now = new Date().toISOString();
    const status = created ? 'qualified' : 'duplicate';
    await updatePost(supabase, sourceUrl, {
      status, opportunity_id: opportunity.id, processed_at: now, updated_at: now, run_id: runId,
      error: duplicateReason ? `Duplicada: ${duplicateReason}` : null,
      extracted: {
        ...researched.result,
        evidence: researched.evidence || {},
        _sentinel: { ...researched.trace, validation_notes: researched.validationNotes || [], duplicate_of: created ? null : opportunity.id },
      },
    });
    return { status, opportunity, created, duplicateReason, metrics: researched.metrics };
  } catch (error) {
    const now = new Date().toISOString();
    try {
      await updatePost(supabase, sourceUrl, { status: 'failed', error: String(error.message || error).slice(0, 1000), processed_at: now, updated_at: now, run_id: runId });
    } catch (persistenceError) {
      error.message = `${error.message || error}; falha ao registrar estado final: ${persistenceError.message}`;
    }
    return {
      status: 'failed', error: error.message || String(error),
      metrics: addMetrics(error.metrics, { pageFetches: error.pageFetches || 0 }),
    };
  }
}

async function withConcurrency(items, limit, task) {
  const results = new Array(items.length);
  let next = 0;
  async function worker() {
    while (next < items.length) {
      const index = next++;
      results[index] = await task(items[index]);
    }
  }
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, () => worker()));
  return results;
}

async function runDiscovery(supabase, maxCandidates, runId) {
  if (!process.env.APIFY_API_KEY) throw new Error('APIFY_API_KEY não configurada no servidor.');
  const client = new ApifyClient({ token: process.env.APIFY_API_KEY });
  const actorRun = await client.actor('apify/instagram-scraper').call({
    addParentData: false,
    directUrls: SOURCE_ACCOUNTS.map((account) => `https://www.instagram.com/${account}/`),
    onlyPostsNewerThan: '15 days', resultsLimit: 50, resultsType: 'posts', searchLimit: 1, searchType: 'hashtag',
  });
  const { items } = await client.dataset(actorRun.defaultDatasetId).listItems();
  const posts = items.map((item) => ({ caption: item.caption || '', sourceUrl: item.url || '', timestamp: item.timestamp || null, ownerUsername: item.ownerUsername || '' })).filter((post) => post.sourceUrl);
  const { data: knownRows, error: knownError } = posts.length
    ? await supabase.from('sentinel_posts').select('source_url').in('source_url', posts.map((post) => post.sourceUrl))
    : { data: [], error: null };
  if (knownError) throw knownError;
  const known = new Set((knownRows || []).map((row) => row.source_url));
  const fresh = posts.filter((post) => !known.has(post.sourceUrl));
  const scored = fresh.map((post) => ({ ...post, score: scorePost(post) }));
  if (scored.length) {
    const { error } = await supabase.from('sentinel_posts').insert(scored.map((post) => ({
      source_url: post.sourceUrl, source_type: 'instagram', owner_username: post.ownerUsername,
      caption: post.caption, posted_at: post.timestamp, score: post.score, run_id: runId,
      status: discoveryScreeningStatus(post.score),
      error: post.score >= SCORE_THRESHOLD ? null : `Rejeitada na triagem automática: pontuação ${post.score} abaixo do corte ${SCORE_THRESHOLD}.`,
      processed_at: post.score >= SCORE_THRESHOLD ? null : new Date().toISOString(),
    })));
    if (error) throw error;
  }
  const staleBefore = new Date(Date.now() - 10 * 60_000).toISOString();
  const { error: staleError } = await supabase.from('sentinel_posts').update({
    status: 'queued', error: 'Execução anterior interrompida; devolvida à fila.', updated_at: new Date().toISOString(),
  }).eq('status', 'pending').lt('updated_at', staleBefore);
  if (staleError) throw staleError;

  const { data: queued, error: queueError } = await supabase.from('sentinel_posts')
    .select('*').eq('status', 'queued').order('score', { ascending: false }).order('created_at', { ascending: true }).limit(maxCandidates);
  if (queueError) throw queueError;
  const queuedUrls = (queued || []).map((row) => row.source_url);
  let claimed = [];
  if (queuedUrls.length) {
    const { data: claimedRows, error: claimError } = await supabase.from('sentinel_posts').update({
      status: 'pending', error: null, run_id: runId, updated_at: new Date().toISOString(),
    }).in('source_url', queuedUrls).eq('status', 'queued').select('*');
    if (claimError) throw claimError;
    claimed = claimedRows || [];
  }
  const candidates = claimed.map((row) => ({
    sourceUrl: row.source_url, caption: row.caption, ownerUsername: row.owner_username,
    timestamp: row.posted_at, score: row.score,
  }));
  const { count: queuedRemaining } = await supabase.from('sentinel_posts').select('id', { count: 'exact', head: true }).eq('status', 'queued');
  await updateRun(supabase, runId, { requested_count: candidates.length, metadata: { scraped: posts.length, new_posts: fresh.length, queued_remaining: queuedRemaining || 0 } });
  const results = await withConcurrency(candidates, 3, (post) => processPost(supabase, post, runId));
  const metrics = addMetrics(...results.map((item) => item.metrics));
  return {
    response: {
      scraped: posts.length, newPosts: fresh.length, candidates: candidates.length,
      qualified: results.filter((item) => item.status === 'qualified').length,
      duplicates: results.filter((item) => item.status === 'duplicate').length,
      created: results.filter((item) => item.created).length,
      rejected: results.filter((item) => item.status === 'rejected').length,
      failed: results.filter((item) => item.status === 'failed').length,
      queued: queuedRemaining || 0,
    },
    metrics,
  };
}

export function discoveryCandidateLimit(body = {}) {
  if (body.allQueued === true) return MAX_DISCOVERY_CANDIDATES;
  return Math.max(1, Math.min(Number(body.maxCandidates) || 10, 25));
}

export function catalogReviewPrompt(opportunity) {
  const today = new Date().toISOString().slice(0, 10);
  return `Você audita uma oportunidade já publicada no catálogo Access+. Hoje é ${today}. Compare os dados atuais com as fontes oficiais fornecidas. Baseie tudo SOMENTE no conteúdo das fontes; não invente nem complete por conhecimento prévio.

REGRAS OBRIGATÓRIAS PARA PRAZOS:
1. "deadline" é exclusivamente a data limite para enviar candidatura, inscrição, projeto ou indicação.
2. Data do evento, competição, cerimônia, resultado, viagem, início do programa, pagamento ou rodada NÃO é deadline. Frases como "will be held on", "takes place on", "event date" e "finals are on" nunca comprovam prazo.
3. Só proponha deadline quando a citação disser explicitamente deadline, applications close/due, registration closes/ends, submit by, register by, inscrições até, encerramento das inscrições, prazo ou expressão equivalente.
4. Não infira um prazo a partir do calendário. Se não houver data limite explícita, não altere deadline.
5. Prefira o ciclo atual ou futuro. Não misture datas de edições diferentes.
6. Se houver dia, mês e ano, use "D de mês de YYYY", sem zero à esquerda.
7. Se o prazo confirmado já passou, inclua também status "Encerrada". Se a fonte disser explicitamente que as inscrições estão fechadas, proponha status "Encerrada" mesmo sem uma data.

IDIOMA, CONDIÇÕES E TAXONOMIA:
- Todos os valores de updates devem estar em português brasileiro. Traduza custos, critérios, formatos e descrições. Preserve em inglês apenas nomes próprios e URLs.
- Em cost, preserve condições e etapas: diferencie taxa de candidatura da taxa cobrada apenas de finalistas ou participantes.
- Em location, diferencie candidatura remota de evento ou final presencial. Uma sede presencial não prova que a candidatura deixou de ser remota; quando ambos forem relevantes, descreva as duas etapas.
- areas aceita somente: STEM, Humanas, Meio Ambiente, Linguagens, Artes. Classifique pelo tema da oportunidade, não pelas modalidades de envio.
- level aceita somente: Ensino Médio, Fundamental, Gap Year.
- audience aceita somente: Meninas, Escola Pública, Indígenas, Deficientes, Negros, LGBT, Baixa Renda.
- type aceita somente: Programas Acadêmicos, Olimpíadas Científicas, Competições, Competições de Escrita, Mentorias, Bolsas de Estudo, Programas de Intercâmbio, MUNs, Estágios.

QUALIDADE DO TEXTO:
- Escreva para estudantes e famílias, em linguagem simples, direta e sem tom promocional.
- title deve conter apenas o nome oficial, sem chamadas promocionais.
- description deve explicar o que é, para quem é e o principal apoio em até 45 palavras e duas frases.
- eligibility alimenta a seção "Elegibilidade e guia de aplicação". Use até 7 itens curtos, um por linha e sem símbolos de bullet. Comece cada item com verbo, limite-o a 14 palavras e nunca invente itens para completar a lista.
- process deve orientar a candidatura em até três frases curtas e na ordem das ações.
- applicants deve trazer somente dicas específicas comprovadas pela fonte; se forem genéricas, use null.
- additionals deve conter apenas informação importante que não caiba nos outros campos.
- Não use reticências, placeholders, jargão corporativo nem frases como "orientações disponíveis no site".

Você também pode corrigir outros campos quando houver evidência clara. Campos permitidos: ${REVIEW_FIELDS.join(', ')}.

Cada campo alterado DEVE ter evidência estruturada com uma citação literal copiada de uma das fontes e a URL exata dessa fonte. A citação permanece no idioma original da fonte; apenas o valor proposto deve estar em português. Para deadline, use kind "application_deadline"; para inscrições contínuas, "rolling_deadline".

Responda SOMENTE com JSON cru:
{"updates":{"eligibility":"Ter de 14 a 18 anos\\nMorar no Brasil\\nEnviar o formulário até o prazo"},"evidence":{"eligibility":{"quote":"Applicants must be 14–18, reside in Brazil and submit the form by the deadline.","source_url":"https://exemplo.org/apply","kind":"field_evidence"}},"notes":"Critérios organizados para leitura rápida"}
Inclua em updates apenas campos que realmente devem mudar. Se nada mudar: {"updates":{},"evidence":{},"notes":"Dados atuais confirmados"}.

Dados atuais:
${JSON.stringify(Object.fromEntries(REVIEW_FIELDS.map((field) => [field, opportunity[field]])))}`;
}

function normalizeUpdate(field, value) {
  if (value == null) return undefined;
  if (ARRAY_FIELDS.has(field)) {
    if (!Array.isArray(value)) return undefined;
    const normalized = value.map((item) => String(item).trim()).filter(Boolean);
    if (CONTROLLED_VALUES[field] && normalized.some((item) => !CONTROLLED_VALUES[field].has(item))) return undefined;
    return normalized;
  }
  if (typeof value !== 'string') return undefined;
  if (LINE_LIST_FIELDS.has(field)) {
    return normalizeLineList(value) || undefined;
  }
  const normalized = field === 'deadline' ? normalizeDeadlineOutput(value) : value.trim();
  if (CONTROLLED_VALUES[field] && !CONTROLLED_VALUES[field].has(normalized)) return undefined;
  return normalized;
}

export function normalizeLineList(value) {
  return [...new Set(String(value || '')
    .split(/\r?\n/)
    .map((item) => item.replace(/^\s*(?:[-*•]|\d+[.)])\s*/, '').trim())
    .filter(Boolean))]
    .join('\n');
}

export function resolveProposalPatch(fields, proposed, requestedEdits = {}) {
  const patch = {};
  const editorFields = [];
  for (const field of fields) {
    if (!Object.prototype.hasOwnProperty.call(requestedEdits, field)) {
      patch[field] = field === 'deadline' ? normalizeDeadlineOutput(proposed[field]) : proposed[field];
      continue;
    }
    let raw = requestedEdits[field];
    if (ARRAY_FIELDS.has(field) && typeof raw === 'string') {
      raw = raw.split(/\r?\n|,/).map((item) => item.trim()).filter(Boolean);
    }
    if (typeof raw === 'string' && !raw.trim() && !REQUIRED_TEXT_FIELDS.has(field)) {
      patch[field] = null;
      editorFields.push(field);
      continue;
    }
    const normalized = normalizeUpdate(field, raw);
    if (normalized === undefined || (REQUIRED_TEXT_FIELDS.has(field) && !String(normalized).trim())) {
      throw Object.assign(new Error(`O valor editado de ${field} é inválido.`), { statusCode: 400 });
    }
    if (!isPortugueseCatalogValue(field, normalized)) {
      throw Object.assign(new Error(`O valor editado de ${field} precisa estar em português.`), { statusCode: 400 });
    }
    patch[field] = normalized;
    editorFields.push(field);
  }
  return { patch, editorFields };
}

export function normalizeDeadlineOutput(value) {
  return String(value || '').trim().replace(/\b0([1-9])(?=\s+de\s+(?:janeiro|fevereiro|março|marco|abril|maio|junho|julho|agosto|setembro|outubro|novembro|dezembro)\b)/gi, '$1');
}

export function isPortugueseCatalogValue(field, value) {
  if (!PORTUGUESE_TEXT_FIELDS.has(field)) return true;
  const values = Array.isArray(value) ? value : [value];
  return values.every((item) => {
    const text = String(item || '');
    if (ENGLISH_CATALOG_PATTERN.test(text)) return false;
    const englishMarkers = normalizedText(text).match(/\b(?:the|and|for|with|students?|program|competition|participants?|from|must|will|are|open)\b/g)?.length || 0;
    const portugueseMarkers = normalizedText(text).match(/\b(?:o|a|os|as|e|para|com|estudantes?|programa|competicao|participantes?|de|devem|sera|estao|abertas?)\b/g)?.length || 0;
    return englishMarkers < 2 || portugueseMarkers >= englishMarkers;
  });
}

function specificity(value) {
  const text = String(value || '').toLocaleLowerCase('pt-BR');
  if (/\b\d{1,2}\b/.test(text) && /(janeiro|fevereiro|março|marco|abril|maio|junho|julho|agosto|setembro|outubro|novembro|dezembro)/.test(text)) return 3;
  if (/(contínuo|continuo|rolling)/.test(text)) return 2;
  if (/(janeiro|fevereiro|março|marco|abril|maio|junho|julho|agosto|setembro|outubro|novembro|dezembro)/.test(text)) return 1;
  return 0;
}

const equalValue = (a, b) => JSON.stringify(a ?? null) === JSON.stringify(b ?? null);

function normalizedText(value) {
  return String(value || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/\s+/g, ' ').trim();
}

const MONTH_NUMBERS = {
  january: 1, janeiro: 1, february: 2, fevereiro: 2, march: 3, marco: 3,
  april: 4, abril: 4, may: 5, maio: 5, june: 6, junho: 6, july: 7, julho: 7,
  august: 8, agosto: 8, september: 9, setembro: 9, october: 10, outubro: 10,
  november: 11, novembro: 11, december: 12, dezembro: 12,
};
const MONTH_PATTERN = Object.keys(MONTH_NUMBERS).join('|');

export function parseDateParts(value) {
  const text = normalizedText(value);
  let match = text.match(new RegExp(`\\b(\\d{1,2})(?:st|nd|rd|th)?\\s+(?:de\\s+)?(${MONTH_PATTERN})\\s*(?:de|,)?\\s*(\\d{4})\\b`));
  if (match) return { day: Number(match[1]), month: MONTH_NUMBERS[match[2]], year: Number(match[3]) };
  match = text.match(new RegExp(`\\b(${MONTH_PATTERN})\\s+(\\d{1,2})(?:st|nd|rd|th)?(?:,)?\\s+(\\d{4})\\b`));
  if (match) return { day: Number(match[2]), month: MONTH_NUMBERS[match[1]], year: Number(match[3]) };
  const contextualYear = text.match(/\b(20\d{2})\b/)?.[1];
  match = text.match(new RegExp(`\\b(\\d{1,2})(?:st|nd|rd|th)?\\s+(?:de\\s+)?(${MONTH_PATTERN})\\b`));
  if (match && contextualYear) return { day: Number(match[1]), month: MONTH_NUMBERS[match[2]], year: Number(contextualYear) };
  match = text.match(new RegExp(`\\b(${MONTH_PATTERN})\\s+(\\d{1,2})(?:st|nd|rd|th)?\\b`));
  if (match && contextualYear) return { day: Number(match[2]), month: MONTH_NUMBERS[match[1]], year: Number(contextualYear) };
  return null;
}

export function isPastDate(value, today = new Date()) {
  const parts = parseDateParts(value);
  if (!parts) return false;
  const candidate = Date.UTC(parts.year, parts.month - 1, parts.day);
  const current = Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate());
  return candidate < current;
}

export function expiredStatusChange(deadline, currentStatus, today = new Date()) {
  if (!isPastDate(deadline, today) || currentStatus === 'Encerrada') return null;
  return { before: currentStatus ?? null, after: 'Encerrada' };
}

const DEADLINE_EVIDENCE_PATTERN = /\b(?:deadline|applications?\s+(?:close|closes|due)|registration\s+(?:close|closes|ends|deadline)|submissions?\s+(?:close|closes|due)|submit(?:ted)?\s+by|register\s+by|due\s+(?:by|on)|inscri(?:cao|coes).{0,30}(?:ate|encerra|encerram|termina|terminam)|encerramento\s+das\s+inscricoes|prazo|data\s+limite)\b/;
const ROLLING_EVIDENCE_PATTERN = /\b(?:rolling|open\s+year[- ]round|accepted\s+throughout|inscricoes\s+continuas|fluxo\s+continuo)\b/;

function sameSourceUrl(a, b) {
  try {
    const left = new URL(a); const right = new URL(b);
    left.hash = ''; right.hash = '';
    return left.href.replace(/\/$/, '') === right.href.replace(/\/$/, '');
  } catch { return false; }
}

function evidenceSummary(field, proposedValue) {
  const value = Array.isArray(proposedValue) ? proposedValue.join(', ') : String(proposedValue || '');
  if (field === 'deadline') return `Prazo de inscrição confirmado para ${value}.`;
  if (field === 'status' && value === 'Encerrada') return 'A fonte confirma que as inscrições estão encerradas.';
  return `A fonte confirma o valor proposto: ${value}.`;
}

export function validateFieldEvidence(field, proposedValue, rawEvidence, sources) {
  if (!rawEvidence || typeof rawEvidence !== 'object' || Array.isArray(rawEvidence)) {
    return { valid: false, reason: 'evidência sem citação e URL estruturadas' };
  }
  const quote = String(rawEvidence.quote || '').trim();
  const sourceUrl = String(rawEvidence.source_url || '').trim();
  const source = sources.find((item) => sameSourceUrl(item.url, sourceUrl));
  if (!quote || !source) return { valid: false, reason: 'citação ou URL não corresponde às fontes lidas' };
  if (!normalizedText(source.text).includes(normalizedText(quote))) {
    return { valid: false, reason: 'a citação não foi encontrada literalmente na fonte' };
  }
  const evidence = {
    quote,
    source_url: source.url,
    kind: String(rawEvidence.kind || 'field_evidence'),
    summary_pt: evidenceSummary(field, proposedValue),
  };
  if (field !== 'deadline') return { valid: true, evidence };

  const proposedText = normalizedText(proposedValue);
  const quoteText = normalizedText(quote);
  const rolling = /\b(?:continuo|rolling)\b/.test(proposedText);
  if (rolling) {
    if (evidence.kind !== 'rolling_deadline' || !ROLLING_EVIDENCE_PATTERN.test(quoteText)) {
      return { valid: false, reason: 'a fonte não confirma inscrições contínuas' };
    }
    return { valid: true, evidence };
  }
  if (evidence.kind !== 'application_deadline' || !DEADLINE_EVIDENCE_PATTERN.test(quoteText)) {
    return { valid: false, reason: 'a citação descreve uma data, mas não um prazo de inscrição' };
  }
  const proposedDate = parseDateParts(proposedValue);
  const evidenceDate = parseDateParts(quote);
  if (!proposedDate || !evidenceDate || !equalValue(proposedDate, evidenceDate)) {
    return { valid: false, reason: 'a data proposta não corresponde à data citada' };
  }
  return { valid: true, evidence };
}

async function researchExistingOpportunity(supabase, runId, opportunity) {
  const original = Object.fromEntries(REVIEW_FIELDS.map((field) => [field, opportunity[field]]));
  if (!opportunity.link) {
    const row = {
      run_id: runId, opportunity_id: opportunity.id, status: 'failed', original,
      error: 'A oportunidade não tem link oficial para pesquisa.',
    };
    const { error } = await supabase.from('sentinel_research_proposals').upsert(row, { onConflict: 'run_id,opportunity_id' });
    if (error) throw error;
    return { status: 'failed', metrics: emptyMetrics() };
  }
  let stage = 'Leitura da página oficial e links relacionados';
  let metrics = emptyMetrics();
  let modelAttempts = [];
  try {
    const research = await fetchResearchSources(opportunity.link);
    metrics.pageFetches = research.pageFetches;
    stage = 'Análise pelo modelo';
    const prompt = catalogReviewPrompt(opportunity)
      .replace('"DD de mês de YYYY"', '"D de mês de YYYY", sem zero à esquerda')
      .concat('\n\nFORMATO OBRIGATÓRIO: escreva "4 de setembro de 2026", nunca "04 de setembro de 2026".');
    const response = await callModel(prompt, `${sourcesForPrompt(research.sources)}\n\nRetorne o JSON de auditoria agora.`);
    metrics = addMetrics(metrics, response.metrics);
    modelAttempts = response.attempts;
    stage = 'Validação e gravação da proposta';
    const parsed = parseJsonObject(response.content);
    const proposed = {};
    const changes = {};
    const evidence = {};
    const validationNotes = [];
    for (const field of REVIEW_FIELDS) {
      if (!Object.prototype.hasOwnProperty.call(parsed.updates || {}, field)) continue;
      const normalized = normalizeUpdate(field, parsed.updates[field]);
      if (normalized === undefined) {
        validationNotes.push(`${field} descartado: valor fora da taxonomia aceita`);
        continue;
      }
      if (!isPortugueseCatalogValue(field, normalized)) {
        validationNotes.push(`${field} descartado: o valor proposto não está em português`);
        continue;
      }
      if (equalValue(normalized, original[field])) continue;
      if (field === 'deadline' && specificity(normalized) < specificity(original[field])) continue;
      const checkedEvidence = validateFieldEvidence(field, normalized, parsed.evidence?.[field], research.sources);
      if (!checkedEvidence.valid) {
        validationNotes.push(`${field} descartado: ${checkedEvidence.reason}`);
        continue;
      }
      proposed[field] = normalized;
      changes[field] = { before: original[field] ?? null, after: normalized };
      evidence[field] = checkedEvidence.evidence;
    }
    const statusChange = changes.deadline && expiredStatusChange(proposed.deadline, original.status);
    if (statusChange) {
      proposed.status = 'Encerrada';
      changes.status = statusChange;
      evidence.status = {
        ...evidence.deadline,
        kind: 'expired_deadline',
        summary_pt: `Inscrições marcadas como encerradas porque o prazo ${proposed.deadline} já passou.`,
      };
      validationNotes.push('status marcado como Encerrada porque o prazo confirmado já passou');
    }
    const row = {
      run_id: runId, opportunity_id: opportunity.id,
      status: Object.keys(changes).length ? 'pending' : 'no_changes',
      source_url: opportunity.link, original, proposed, changes,
      evidence: {
        ...evidence,
        _sentinel: {
          selected_model: response.model,
          model_attempts: modelAttempts,
          sources: research.sources.map((source) => ({ url: source.url, relation: source.relation })),
          adjacent_failures: research.adjacentFailures,
        },
      },
      notes: [String(parsed.notes || '').trim(), validationNotes.length ? `Validação: ${validationNotes.join('; ')}.` : ''].filter(Boolean).join(' ').slice(0, 2000),
      model_calls: metrics.modelCalls, page_fetches: metrics.pageFetches,
      input_tokens: metrics.inputTokens, output_tokens: metrics.outputTokens,
      error: null, updated_at: new Date().toISOString(),
    };
    const { error } = await supabase.from('sentinel_research_proposals').upsert(row, { onConflict: 'run_id,opportunity_id' });
    if (error) throw error;
    return { status: row.status, metrics };
  } catch (error) {
    metrics.pageFetches = Math.max(metrics.pageFetches, error.pageFetches || 0);
    if (error.metrics) metrics = addMetrics(metrics, error.metrics);
    if (error.modelAttempts) modelAttempts = error.modelAttempts;
    await supabase.from('sentinel_research_proposals').upsert({
      run_id: runId, opportunity_id: opportunity.id, status: 'failed', source_url: opportunity.link,
      original, notes: `Falha na etapa: ${stage}`,
      evidence: { _sentinel: { model_attempts: modelAttempts } },
      error: `${stage}: ${String(error.message || error)}`.slice(0, 2000),
      model_calls: metrics.modelCalls, page_fetches: metrics.pageFetches,
      input_tokens: metrics.inputTokens, output_tokens: metrics.outputTokens,
      updated_at: new Date().toISOString(),
    }, { onConflict: 'run_id,opportunity_id' });
    return { status: 'failed', metrics };
  }
}

async function processReviewBatch(supabase, runId, opportunityIds) {
  const ids = [...new Set(opportunityIds.map(Number).filter(Number.isFinite))].slice(0, 8);
  const { data: run, error: runError } = await supabase.from('sentinel_research_runs').select('*').eq('id', runId).eq('run_type', 'catalog_review').single();
  if (runError || !run) throw Object.assign(new Error('Execução de pesquisa não encontrada.'), { statusCode: 404 });
  const selectedIds = new Set((run.metadata?.selected_ids || []).map(Number));
  if (ids.some((id) => !selectedIds.has(id))) throw Object.assign(new Error('A oportunidade não pertence a esta execução.'), { statusCode: 400 });
  const { data: existing } = await supabase.from('sentinel_research_proposals').select('opportunity_id').eq('run_id', runId).in('opportunity_id', ids);
  const done = new Set((existing || []).map((item) => Number(item.opportunity_id)));
  const pendingIds = ids.filter((id) => !done.has(id));
  const { data: opportunities, error } = pendingIds.length
    ? await supabase.from('opportunities').select('*').in('id', pendingIds)
    : { data: [], error: null };
  if (error) throw error;
  const results = await withConcurrency(opportunities || [], 2, (opportunity) => researchExistingOpportunity(supabase, runId, opportunity));
  const metrics = addMetrics(...results.map((item) => item.metrics));
  const processed = results.length;
  const failed = results.filter((item) => item.status === 'failed').length;
  const { data: updated, error: updateError } = await supabase.from('sentinel_research_runs').update({
    processed_count: run.processed_count + processed,
    succeeded_count: run.succeeded_count + processed - failed,
    failed_count: run.failed_count + failed,
    model_calls: run.model_calls + metrics.modelCalls,
    page_fetches: run.page_fetches + metrics.pageFetches,
    input_tokens: Number(run.input_tokens) + metrics.inputTokens,
    output_tokens: Number(run.output_tokens) + metrics.outputTokens,
  }).eq('id', runId).select().single();
  if (updateError) throw updateError;
  return { run: updated, processed, failed };
}

async function finishReviewRun(supabase, runId) {
  const { data: run, error } = await supabase.from('sentinel_research_runs').select('*').eq('id', runId).single();
  if (error) throw error;
  const status = run.failed_count > 0 ? 'partial' : 'completed';
  return updateRun(supabase, runId, { status, completed_at: new Date().toISOString() });
}

async function applyProposal(supabase, user, proposalId, requestedFields, requestedEdits = {}) {
  const { data: proposal, error } = await supabase.from('sentinel_research_proposals').select('*').eq('id', proposalId).single();
  if (error || !proposal) throw Object.assign(new Error('Proposta não encontrada.'), { statusCode: 404 });
  if (proposal.status !== 'pending') throw Object.assign(new Error('Esta proposta já foi revisada.'), { statusCode: 409 });
  let fields = [...new Set((requestedFields || []).filter((field) => REVIEW_FIELDS.includes(field) && field in proposal.changes))];
  let resolved = resolveProposalPatch(fields, proposal.proposed, requestedEdits);
  if (fields.includes('deadline') && proposal.changes.status?.after === 'Encerrada' && isPastDate(resolved.patch.deadline)) {
    fields = [...new Set([...fields, 'status'])];
    resolved = resolveProposalPatch(fields, proposal.proposed, requestedEdits);
  }
  if (!fields.length) throw Object.assign(new Error('Selecione ao menos um campo para aplicar.'), { statusCode: 400 });
  const { data: opportunity, error: opportunityError } = await supabase.from('opportunities').select('*').eq('id', proposal.opportunity_id).single();
  if (opportunityError) throw opportunityError;
  const conflicts = fields.filter((field) => !equalValue(opportunity[field], proposal.original[field]));
  if (conflicts.length) throw Object.assign(new Error(`O catálogo mudou depois da pesquisa nos campos: ${conflicts.join(', ')}. Execute uma nova pesquisa.`), { statusCode: 409 });
  const { patch, editorFields } = resolved;
  const { error: updateError } = await supabase.from('opportunities').update(patch).eq('id', opportunity.id);
  if (updateError) throw updateError;
  const allFields = Object.keys(proposal.changes);
  const status = fields.length === allFields.length ? 'approved' : 'partially_approved';
  const proposed = { ...proposal.proposed, ...patch };
  const changes = { ...proposal.changes };
  const evidence = { ...proposal.evidence };
  for (const field of editorFields) {
    changes[field] = { ...changes[field], after: patch[field] };
    evidence[field] = {
      ...(evidence[field] && typeof evidence[field] === 'object' ? evidence[field] : {}),
      summary_pt: 'Valor ajustado manualmente durante a revisão.',
      editor_override: true,
    };
  }
  const { data: updated, error: proposalError } = await supabase.from('sentinel_research_proposals').update({
    status, proposed, changes, evidence, approved_fields: fields,
    reviewed_by: user.id, reviewed_at: new Date().toISOString(), updated_at: new Date().toISOString(),
  }).eq('id', proposal.id).select().single();
  if (proposalError) throw proposalError;
  return updated;
}

async function rejectProposal(supabase, user, proposalId) {
  const { data, error } = await supabase.from('sentinel_research_proposals').update({
    status: 'rejected', reviewed_by: user.id, reviewed_at: new Date().toISOString(), updated_at: new Date().toISOString(),
  }).eq('id', proposalId).eq('status', 'pending').select().maybeSingle();
  if (error) throw error;
  if (!data) throw Object.assign(new Error('A proposta já foi revisada ou não existe.'), { statusCode: 409 });
  return data;
}

async function addManual(supabase, url, runId) {
  try { new URL(url); } catch { throw Object.assign(new Error('Informe uma URL válida.'), { statusCode: 400 }); }
  const now = new Date().toISOString();
  const { error } = await supabase.from('sentinel_posts').upsert({
    source_url: url, source_type: 'manual', owner_username: 'manual', caption: '', posted_at: now,
    score: -1, status: 'pending', error: null, processed_at: null, updated_at: now, run_id: runId,
  }, { onConflict: 'source_url' });
  if (error) throw error;
  return processPost(supabase, { url, caption: '', ownerUsername: 'manual' }, runId, true);
}

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  let supabase;
  let run;
  try {
    supabase = serverClient(req);
    const user = await authorize(req, supabase);
    const action = req.body?.action;
    if (action === 'run') {
      const limit = discoveryCandidateLimit(req.body);
      run = await createRun(supabase, user, 'discovery', 0, { all_queued: req.body?.allQueued === true });
      const outcome = await runDiscovery(supabase, limit, run.id);
      const result = { processed: outcome.response.candidates, succeeded: outcome.response.candidates - outcome.response.failed, failed: outcome.response.failed };
      await finalizeRun(supabase, run.id, result, outcome.metrics);
      return res.status(200).json({ ...outcome.response, runId: run.id });
    }
    if (action === 'add') {
      run = await createRun(supabase, user, 'manual', 1, { url: String(req.body?.url || '').trim() });
      const result = await addManual(supabase, String(req.body?.url || '').trim(), run.id);
      await finalizeRun(supabase, run.id, { processed: 1, succeeded: result.status === 'failed' ? 0 : 1, failed: result.status === 'failed' ? 1 : 0 }, result.metrics);
      return res.status(200).json({ ...result, runId: run.id });
    }
    if (action === 'review-start') {
      const ids = [...new Set((req.body?.opportunityIds || []).map(Number).filter(Number.isFinite))];
      if (!ids.length || ids.length > 500) throw Object.assign(new Error('Selecione entre 1 e 500 oportunidades.'), { statusCode: 400 });
      run = await createRun(supabase, user, 'catalog_review', ids.length, { selected_ids: ids });
      return res.status(200).json(run);
    }
    if (action === 'review-batch') return res.status(200).json(await processReviewBatch(supabase, Number(req.body?.runId), req.body?.opportunityIds || []));
    if (action === 'review-finish') return res.status(200).json(await finishReviewRun(supabase, Number(req.body?.runId)));
    if (action === 'proposal-apply') return res.status(200).json(await applyProposal(supabase, user, Number(req.body?.proposalId), req.body?.fields || [], req.body?.edits || {}));
    if (action === 'proposal-reject') return res.status(200).json(await rejectProposal(supabase, user, Number(req.body?.proposalId)));
    return res.status(400).json({ error: 'Ação inválida.' });
  } catch (error) {
    console.error('[api/sentinel]', error);
    if (run?.id && supabase) {
      try {
        const now = new Date().toISOString();
        await supabase.from('sentinel_posts').update({
          status: 'failed', error: `Execução interrompida: ${String(error.message || error).slice(0, 800)}`,
          processed_at: now, updated_at: now,
        }).eq('run_id', run.id).eq('status', 'pending');
        await updateRun(supabase, run.id, { status: 'failed', error: String(error.message || error).slice(0, 2000), completed_at: now });
      } catch { /* keep original error */ }
    }
    return res.status(error.statusCode || 500).json({ error: error.message || 'Falha ao executar o Sentinel.' });
  }
}
