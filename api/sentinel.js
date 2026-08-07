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
const CATALOG_PROMPT_VERSION = 'catalog-review-v5';
const SCORE_THRESHOLD = 4;
const SOURCE_ACCOUNTS = ['opportunitydesk', 'opportunities_corners', 'opportunitiesforyouth', 'adroiteducation', 'borderless.so'];
const HS_SIGNALS = ['high school', 'secondary school', 'high schooler', 'grade 9', 'grade 10', 'grade 11', 'grade 12'];
const YOUTH_SIGNALS = ['youth', 'young people', 'teenager', 'teen', '16', '17', '18'];
const FUNDING_SIGNALS = ['funded', 'fully funded', 'free', 'scholarship', 'grant', 'stipend', 'fellowship', 'financial aid', 'all expenses'];
const BRAZIL_SIGNALS = ['brazil', 'brazilian', 'all nationals', 'open to all', 'all countries'];
const UNIVERSITY_PENALTIES = ['phd', 'ph.d', 'doctorate', 'doctoral', 'postdoc', 'postdoctoral', "master's", 'masters', 'master degree', 'master of', 'professor', 'faculty', 'researcher', 'research grant', "bachelor's", 'bachelors', 'undergraduate degree'];
const REVIEW_FIELDS = ['title', 'description', 'link', 'deadline', 'areas', 'level', 'location', 'audience', 'cost', 'language', 'keywords', 'eligibility', 'process', 'applicants', 'additionals', 'type', 'status'];
const ARRAY_FIELDS = new Set(['areas', 'level', 'audience', 'keywords']);
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
    prompt_version: runType === 'catalog_review' ? CATALOG_PROMPT_VERSION : 'discovery-v1',
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

function extractUrl(value) {
  return String(value || '').match(/https?:\/\/[^\s\)"]+/)?.[0] || null;
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

function discoveryPrompt(manual = false) {
  const today = new Date().toISOString().slice(0, 10);
  const cutoff = new Date(Date.now() + 30 * 86400_000).toISOString().slice(0, 10);
  const criteria = manual ? '' : `\nInclua apenas programas gratuitos ou com apoio financeiro substancial, abertos a brasileiros, adequados a estudantes de 14–18 anos e com prazo até ${cutoff}, contínuo ou desconhecido. Exclua oportunidades universitárias e prazos anteriores a ${today}.`;
  return `Você pesquisa oportunidades educacionais para estudantes brasileiros do ensino médio. Baseie a resposta SOMENTE no conteúdo fornecido. Não invente fatos.${criteria}\nTodos os campos devem estar em português brasileiro. Responda SOMENTE com um objeto JSON cru, sem markdown:\n{"name":"Nome","summary":"Descrição de 1–2 frases que menciona o principal benefício","eligibility":["critério"],"deadline":"DD de mês de YYYY","fees":"taxas e apoio financeiro","link":"URL oficial"}\nSe a oportunidade não se qualificar ou não houver dados suficientes, responda: {"qualified":false}`;
}

async function groundUrl(url, caption = '', ownerUsername = '', manual = false) {
  const page = await fetchPageText(url);
  try {
    const prompt = discoveryPrompt(manual)
      .replace('"DD de mês de YYYY"', '"D de mês de YYYY", sem zero à esquerda')
      .concat('\nEscreva "4 de setembro de 2026", nunca "04 de setembro de 2026".');
    const response = await callModel(prompt, `Legenda: ${caption}\nConta: @${ownerUsername}\nURL: ${url}\n\nConteúdo:\n${page.text}\n\nRetorne o JSON agora.`);
    const result = parseJsonObject(response.content);
    if (result.deadline) result.deadline = normalizeDeadlineOutput(result.deadline);
    return {
      result: result.qualified === false || !result.name || !result.link ? null : result,
      metrics: addMetrics(response.metrics, { pageFetches: page.pageFetches }),
    };
  } catch (error) {
    error.metrics = addMetrics(error.metrics, { pageFetches: page.pageFetches });
    throw error;
  }
}

async function findOrCreateOpportunity(supabase, extracted) {
  const { data: existing } = await supabase.from('opportunities').select('*').eq('link', extracted.link).limit(1).maybeSingle();
  if (existing) return { opportunity: existing, created: false };
  const row = {
    title: extracted.name, description: extracted.summary || '', link: extracted.link,
    deadline: extracted.deadline || null, areas: [], level: ['Ensino Médio'], location: null,
    audience: [], cost: extracted.fees || null, language: null, keywords: ['Sentinel'],
    eligibility: Array.isArray(extracted.eligibility) ? extracted.eligibility.join('\n') : String(extracted.eligibility || ''),
    process: null, applicants: null,
    additionals: 'Descoberta automaticamente pelo Sentinel. Revise todos os campos antes de publicar.',
    resources: [], status: 'Revisar', review: null, type: 'Programas Acadêmicos',
  };
  const { data, error } = await supabase.from('opportunities').insert(row).select().single();
  if (error) throw error;
  return { opportunity: data, created: true };
}

async function processPost(supabase, post, runId, manual = false) {
  const sourceUrl = manual ? post.url : post.sourceUrl;
  const officialUrl = manual ? post.url : extractUrl(post.caption);
  const now = new Date().toISOString();
  if (!officialUrl) {
    await supabase.from('sentinel_posts').update({ status: 'rejected', error: 'Nenhum link encontrado na legenda.', processed_at: now, updated_at: now, run_id: runId }).eq('source_url', sourceUrl);
    return { status: 'rejected', metrics: emptyMetrics() };
  }
  try {
    const researched = await groundUrl(officialUrl, post.caption, post.ownerUsername, manual);
    if (!researched.result) {
      await supabase.from('sentinel_posts').update({ status: 'rejected', processed_at: now, error: null, updated_at: now, run_id: runId }).eq('source_url', sourceUrl);
      return { status: 'rejected', metrics: researched.metrics };
    }
    const { opportunity, created } = await findOrCreateOpportunity(supabase, researched.result);
    await supabase.from('sentinel_posts').update({ status: 'qualified', opportunity_id: opportunity.id, extracted: researched.result, processed_at: now, error: null, updated_at: now, run_id: runId }).eq('source_url', sourceUrl);
    return { status: 'qualified', opportunity, created, metrics: researched.metrics };
  } catch (error) {
    await supabase.from('sentinel_posts').update({ status: 'failed', error: String(error.message || error).slice(0, 1000), processed_at: now, updated_at: now, run_id: runId }).eq('source_url', sourceUrl);
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
      status: post.score >= SCORE_THRESHOLD ? 'pending' : 'screened_out',
      processed_at: post.score >= SCORE_THRESHOLD ? null : new Date().toISOString(),
    })));
    if (error) throw error;
  }
  const candidates = scored.filter((post) => post.score >= SCORE_THRESHOLD).sort((a, b) => b.score - a.score).slice(0, maxCandidates);
  await updateRun(supabase, runId, { requested_count: candidates.length, metadata: { scraped: posts.length, new_posts: fresh.length } });
  const results = await withConcurrency(candidates, 3, (post) => processPost(supabase, post, runId));
  const metrics = addMetrics(...results.map((item) => item.metrics));
  return {
    response: {
      scraped: posts.length, newPosts: fresh.length, candidates: candidates.length,
      qualified: results.filter((item) => item.status === 'qualified').length,
      created: results.filter((item) => item.created).length,
      rejected: results.filter((item) => item.status === 'rejected').length,
      failed: results.filter((item) => item.status === 'failed').length,
    },
    metrics,
  };
}

function catalogReviewPrompt(opportunity) {
  const today = new Date().toISOString().slice(0, 10);
  return `Você audita uma oportunidade já publicada no catálogo Access+. Hoje é ${today}. Compare os dados atuais com as fontes oficiais fornecidas. Baseie tudo SOMENTE no conteúdo das fontes; não invente nem complete por conhecimento prévio.\n\nREGRAS OBRIGATÓRIAS PARA PRAZOS:\n1. "deadline" é exclusivamente a data limite para enviar candidatura, inscrição, projeto ou indicação.\n2. Data do evento, competição, cerimônia, resultado, viagem, início do programa, pagamento ou rodada NÃO é deadline. Frases como "will be held on", "takes place on", "event date" e "finals are on" nunca comprovam prazo.\n3. Só proponha deadline quando a citação disser explicitamente deadline, applications close/due, registration closes/ends, submit by, register by, inscrições até, encerramento das inscrições, prazo ou expressão equivalente.\n4. Não infira um prazo a partir do calendário. Se não houver data limite explícita, não altere deadline.\n5. Prefira o ciclo atual ou futuro. Não misture datas de edições diferentes.\n6. Se houver dia, mês e ano, use exatamente "DD de mês de YYYY". Nunca troque um prazo específico por apenas um mês.\n7. Se o prazo confirmado já passou, inclua também status "Encerrada". Se a fonte disser explicitamente que as inscrições estão fechadas, proponha status "Encerrada" mesmo sem uma data.\n\nIDIOMA, CONDIÇÕES E TAXONOMIA:\n- Todos os valores de updates devem estar em português brasileiro. Traduza custos, critérios, formatos e descrições. Preserve em inglês apenas nomes próprios e URLs.\n- Em cost, preserve condições e etapas: diferencie taxa de candidatura da taxa cobrada apenas de finalistas ou participantes.\n- Em location, diferencie candidatura remota de evento ou final presencial. Uma sede presencial não prova que a candidatura deixou de ser remota; quando ambos forem relevantes, descreva as duas etapas.\n- areas aceita somente: STEM, Humanas, Meio Ambiente, Linguagens, Artes. Classifique pelo tema da oportunidade, não pelas modalidades de envio.\n- level aceita somente: Ensino Médio, Fundamental, Gap Year.\n- audience aceita somente: Meninas, Escola Pública, Indígenas, Deficientes, Negros, LGBT, Baixa Renda.\n- type aceita somente: Programas Acadêmicos, Olimpíadas Científicas, Competições, Competições de Escrita, Mentorias, Bolsas de Estudo, Programas de Intercâmbio, MUNs, Estágios.\n\nVocê também pode corrigir outros campos quando houver evidência clara. Campos permitidos: ${REVIEW_FIELDS.join(', ')}.\n\nCada campo alterado DEVE ter evidência estruturada com uma citação literal copiada de uma das fontes e a URL exata dessa fonte. A citação permanece no idioma original da fonte; apenas o valor proposto deve estar em português. Para deadline, use kind "application_deadline"; para inscrições contínuas, "rolling_deadline".\n\nResponda SOMENTE com JSON cru:\n{"updates":{"deadline":"17 de agosto de 2026"},"evidence":{"deadline":{"quote":"Applications close on 17 August 2026","source_url":"https://exemplo.org/apply","kind":"application_deadline"}},"notes":"observação curta em português"}\nInclua em updates apenas campos que realmente devem mudar. Se nada mudar: {"updates":{},"evidence":{},"notes":"Dados atuais confirmados"}.\n\nDados atuais:\n${JSON.stringify(Object.fromEntries(REVIEW_FIELDS.map((field) => [field, opportunity[field]])))}`;
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
  const normalized = field === 'deadline' ? normalizeDeadlineOutput(value) : value.trim();
  if (CONTROLLED_VALUES[field] && !CONTROLLED_VALUES[field].has(normalized)) return undefined;
  return normalized;
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

async function applyProposal(supabase, user, proposalId, requestedFields) {
  const { data: proposal, error } = await supabase.from('sentinel_research_proposals').select('*').eq('id', proposalId).single();
  if (error || !proposal) throw Object.assign(new Error('Proposta não encontrada.'), { statusCode: 404 });
  if (proposal.status !== 'pending') throw Object.assign(new Error('Esta proposta já foi revisada.'), { statusCode: 409 });
  let fields = [...new Set((requestedFields || []).filter((field) => REVIEW_FIELDS.includes(field) && field in proposal.changes))];
  if (fields.includes('deadline') && proposal.changes.status?.after === 'Encerrada' && isPastDate(proposal.proposed.deadline)) {
    fields = [...new Set([...fields, 'status'])];
  }
  if (!fields.length) throw Object.assign(new Error('Selecione ao menos um campo para aplicar.'), { statusCode: 400 });
  const { data: opportunity, error: opportunityError } = await supabase.from('opportunities').select('*').eq('id', proposal.opportunity_id).single();
  if (opportunityError) throw opportunityError;
  const conflicts = fields.filter((field) => !equalValue(opportunity[field], proposal.original[field]));
  if (conflicts.length) throw Object.assign(new Error(`O catálogo mudou depois da pesquisa nos campos: ${conflicts.join(', ')}. Execute uma nova pesquisa.`), { statusCode: 409 });
  const patch = Object.fromEntries(fields.map((field) => [field, field === 'deadline'
    ? normalizeDeadlineOutput(proposal.proposed[field])
    : proposal.proposed[field]]));
  const { error: updateError } = await supabase.from('opportunities').update(patch).eq('id', opportunity.id);
  if (updateError) throw updateError;
  const allFields = Object.keys(proposal.changes);
  const status = fields.length === allFields.length ? 'approved' : 'partially_approved';
  const { data: updated, error: proposalError } = await supabase.from('sentinel_research_proposals').update({
    status, approved_fields: fields, reviewed_by: user.id, reviewed_at: new Date().toISOString(), updated_at: new Date().toISOString(),
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
      const limit = Math.max(1, Math.min(Number(req.body?.maxCandidates) || 10, 25));
      run = await createRun(supabase, user, 'discovery', 0);
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
    if (action === 'proposal-apply') return res.status(200).json(await applyProposal(supabase, user, Number(req.body?.proposalId), req.body?.fields || []));
    if (action === 'proposal-reject') return res.status(200).json(await rejectProposal(supabase, user, Number(req.body?.proposalId)));
    return res.status(400).json({ error: 'Ação inválida.' });
  } catch (error) {
    console.error('[api/sentinel]', error);
    if (run?.id && supabase) {
      try { await updateRun(supabase, run.id, { status: 'failed', error: String(error.message || error).slice(0, 2000), completed_at: new Date().toISOString() }); } catch { /* keep original error */ }
    }
    return res.status(error.statusCode || 500).json({ error: error.message || 'Falha ao executar o Sentinel.' });
  }
}
