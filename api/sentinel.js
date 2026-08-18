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
const MAX_ADJACENT_PAGES = Math.max(0, Math.min(Number(process.env.SENTINEL_ADJACENT_PAGES) || 8, 12));
const SOURCE_CHAR_LIMIT = Math.max(18_000, Math.min(Number(process.env.SENTINEL_SOURCE_CHAR_LIMIT) || 48_000, 80_000));
const MAX_DISCOVERY_CANDIDATES = 500;
const CATALOG_PROMPT_VERSION = 'catalog-review-v11-unified-research';
const DISCOVERY_PROMPT_VERSION = 'discovery-v6-unified-research';
// Contas de Instagram: antes fixas aqui, agora vêm da tabela
// sentinel_instagram_accounts (editável por Admin/Editor na tela do
// Sentinel, sem deploy) — ver activeInstagramAccounts() abaixo.
const MIN_DISCOVERY_SCORE = 4; // abaixo disso, nem entra no histórico (ver runDiscovery)
const HS_SIGNALS = ['high school', 'secondary school', 'high schooler', 'grade 9', 'grade 10', 'grade 11', 'grade 12'];
const YOUTH_SIGNALS = ['youth', 'young people', 'teenager', 'teen', '16', '17', '18'];
const FUNDING_SIGNALS = ['funded', 'fully funded', 'free', 'scholarship', 'grant', 'stipend', 'fellowship', 'financial aid', 'all expenses'];
const BRAZIL_SIGNALS = ['brazil', 'brazilian', 'all nationals', 'open to all', 'all countries'];
const UNIVERSITY_PENALTIES = ['phd', 'ph.d', 'doctorate', 'doctoral', 'postdoc', 'postdoctoral', "master's", 'masters', 'master degree', 'master of', 'professor', 'faculty', 'researcher', 'research grant', "bachelor's", 'bachelors', 'undergraduate degree'];
const REVIEW_FIELDS = ['title', 'description', 'link', 'deadline', 'areas', 'level', 'audience', 'location', 'cost', 'language', 'keywords', 'eligibility', 'process', 'applicants', 'additionals', 'type', 'status', 'qualification_status', 'qualification_reason'];
const MODEL_REVIEW_FIELDS = REVIEW_FIELDS.filter((field) => field !== 'status' && !field.startsWith('qualification_'));
const ARRAY_FIELDS = new Set(['areas', 'level', 'keywords', 'audience']);
const LINE_LIST_FIELDS = new Set(['eligibility', 'applicants']);
const REQUIRED_TEXT_FIELDS = new Set(['title', 'type', 'status']);
const CONTROLLED_VALUES = {
  areas: new Set(['STEM', 'Humanas', 'Meio Ambiente', 'Linguagens', 'Artes']),
  level: new Set(['Ensino Médio', 'Fundamental', 'Gap Year']),
  audience: new Set(['Negros', 'LGBT', 'Baixa Renda', 'Indígenas', 'Deficientes', 'Meninas', 'Escola Pública']),
  type: new Set(['Programas Acadêmicos', 'Olimpíadas Científicas', 'Competições', 'Competições de Escrita', 'Mentorias', 'Bolsas de Estudo', 'Programas de Intercâmbio', 'MUNs', 'Estágios']),
  status: new Set(['Aprovada', 'Revisar', 'Rascunho', 'Encerrada']),
  qualification_status: new Set(['pending', 'qualified', 'unqualified']),
};
const PORTUGUESE_TEXT_FIELDS = new Set(['description', 'location', 'cost', 'language', 'eligibility', 'process', 'applicants', 'additionals', 'keywords', 'qualification_reason']);
const ENGLISH_CATALOG_PATTERN = /\b(?:application fee|participation fee|per project|per participant|fully funded|high school|undergraduate|graduate students?|applications?|registration|eligible|eligibility|deadline|in-person|online only|short film|speech|coding|entrepreneurship|scholarships?|fees?|free|USA)\b/i;
const QUALIFICATION_VERDICTS = new Set(['qualified', 'unqualified', 'uncertain']);
// Caso real que expôs a lacuna: dossiê do Ross/USA Program citou "Ross
// participants come from all over the United States, and from several other
// countries" (literal, confiabilidade 4/5) — prova real de alcance
// internacional, mas rebaixada pra "uncertain" porque não batia com nenhuma
// palavra da lista. A mesma página tinha uma frase mais direta ("Do you
// accept international students?") que bateria, mas o modelo citou a outra.
// Em vez de depender só de o modelo escolher a frase "ideal", a lista
// também reconhece esse jeito comum de descrever alcance internacional sem
// usar a palavra "international" (contagem de países, em vez de nome).
const BRAZIL_REACH_PATTERN = /\b(?:brasil|brazil|brasileir[oa]s?|brazilian|international students?|internationally|all nationalities|any nationality|all countries|any country|worldwide|global(?:ly)?|from every country|from around the world|(?:other|several|many|various|numerous|\d+|over \d+) (?:other )?countries|hosted? students? from|come from .{0,40}countries|qualquer nacionalidade|todas as nacionalidades|qualquer pais|todos os paises|mundo inteiro|outros paises|varios paises|diversos paises|diferentes paises)\b/i;
const BRAZIL_LOCAL_REACH_PATTERN = /\b(?:acre|acrean[oa]s?|alagoas|alagoan[oa]s?|amapa|amapaense?s?|amazonas|amazonense?s?|bahia|baian[oa]s?|ceara|cearense?s?|distrito federal|brasiliense?s?|espirito santo|capixaba?s?|goias|goian[oa]s?|maranhao|maranhense?s?|mato grosso(?: do sul)?|mato-grossense?s?|sul-mato-grossense?s?|minas gerais|mineir[oa]s?|(?:estado do|no|do) para|paraense?s?|paraiba|paraiban[oa]s?|parana|paranaense?s?|pernambuco|pernambucan[oa]s?|piaui|piauiense?s?|rio de janeiro|fluminense?s?|carioca?s?|rio grande do norte|potiguar(?:es)?|rio grande do sul|gauch[oa]s?|rondonia|rondoniense?s?|roraima|roraimense?s?|santa catarina|catarinense?s?|sao paulo|paulista?s?|sergipe|sergipan[oa]s?|tocantins|tocantinense?s?)\b/i;
const YOUTH_PARTICIPATION_PATTERN = /\b(?:youth|young people|young person|student|students|school|college|university|undergraduate|teen|adolesc|jovens?|juventude|estudantes?|alun[oa]s?|universitari[oa]s?|graduand[oa]s?|ensino|escola|matriculad[oa]s?)\b/i;
// Caso real: AI Civic Action Accelerator 2026 tinha "Applicant(s) must live
// in the United States or are US citizens or permanent residents living
// abroad" — nenhuma das frases antigas ("must be a citizen", "citizens or
// residents of") batia com esse jeito de escrever (verbo "live in", e
// "permanent residents" sem "of" logo depois). Adicionadas variações comuns
// de restrição por residência/cidadania dos EUA (ou de qualquer país).
const PARTICIPATION_EXCLUSION_PATTERN = /\b(?:only|exclusiv(?:e|ely|amente|os?|as?)|must be (?:a |an )?(?:citizen|resident|national)|must (?:live|reside) in|permanent residents?|citizens? or (?:permanent )?residents?( of)?|citizens? and residents? of|open only to|not eligible|cannot apply|ineligible|somente|apenas|exclusiv[oa]s?|deve ser (?:cidad[aã]o|residente)|n[aã]o (?:pode|podem|eleg[ií]vel|aceita))\b/i;
const BRAZIL_EXCLUSION_PATTERN = /\b(?:brazil(?:ian)?|brasil(?:eir[oa]s?)?).{0,80}\b(?:not eligible|cannot apply|ineligible|excluded|nao (?:pode|podem|e elegivel|sao elegiveis)|excluid[oa]s?)\b|\b(?:not eligible|cannot apply|ineligible|excluded|nao (?:pode|podem|e elegivel|sao elegiveis)|excluid[oa]s?).{0,80}\b(?:brazil(?:ian)?|brasil(?:eir[oa]s?)?)\b|\b(?:except|excluding|exceto|menos)\s+(?:o\s+)?(?:brazil|brasil)\b/i;

// Caso real: Allan Gray Scholarship ("Country: South Africa / Citizenship
// requirement: South African citizenship") e FAWE Mastercard ("Programme
// Regions: all sixteen regions of Ghana") — sites de listagem descrevem
// restrição geográfica como campo estruturado ("Rótulo: Valor"), não como
// frase corrida. PARTICIPATION_EXCLUSION_PATTERN só reconhece frases do tipo
// "citizens only"/"must be a citizen of" — nenhuma delas aparece nesse
// formato de campo, então esse tipo de exclusão (tão explícita quanto as
// outras) nunca sobrevivia ao verdict "unqualified" e virava "uncertain"
// sempre com o mesmo texto genérico. Detecta o rótulo + valor e testa se o
// valor citado NÃO tem nenhum sinal de alcance Brasil/internacional.
const SCOPE_FIELD_LABELS = 'country|countries|citizenship requirement|nationality requirement|eligible countr(?:y|ies)|programme regions?|program regions?|target regions?|eligible regions?|eligible nationalit(?:y|ies)|nationality|region of residence|country of residence';
const SCOPE_FIELD_PATTERN = new RegExp(`\\b(?:${SCOPE_FIELD_LABELS})\\s*:\\s*([^.,;:]{2,60})`, 'gi');
// De propósito SEM "all"/"any"/"open" soltos: "Programme Regions: all
// sixteen regions of Ghana" usa "all" genericamente (todas as regiões DE UM
// SÓ país), não como sinal de alcance internacional — isso escondia o caso
// real do FAWE Mastercard. Frases de alcance com essas palavras (ex.: "all
// countries") já estão cobertas por BRAZIL_REACH_PATTERN.
const SCOPE_INCLUSIVE_FALLBACK = /\b(?:worldwide|global(?:ly)?|international(?:ly)?|multiple countries|various countries|several countries|latin america|america latina|latam)\b/i;

// Devolve a citação bruta do rótulo+valor (ex.: "country: south africa") se
// achar um campo de escopo geográfico cujo valor não indica alcance
// Brasil/internacional — null se não achar nada assim no texto.
function findScopeRestrictionQuote(text) {
  const t = normalizedText(text);
  SCOPE_FIELD_PATTERN.lastIndex = 0;
  let match;
  while ((match = SCOPE_FIELD_PATTERN.exec(t))) {
    const value = match[1].trim();
    if (value.length < 2) continue;
    if (BRAZIL_REACH_PATTERN.test(value) || BRAZIL_LOCAL_REACH_PATTERN.test(value) || SCOPE_INCLUSIVE_FALLBACK.test(value)) continue;
    return match[0].trim();
  }
  return null;
}

// Subconjunto de PARTICIPATION_EXCLUSION_PATTERN usado só para varrer texto
// bruto (não a citação que o modelo escolheu) — de propósito SEM as
// variantes genéricas ("only"/"exclusiv"/"apenas"/"somente"/"not eligible"),
// que são palavras comuns demais em português/inglês pra escanear um texto
// inteiro sem contexto (ex.: "Você APENAS precisa estar matriculado entre o
// 8º e 9º ano" não é exclusão nenhuma — usa "apenas" no sentido de
// "somente precisa fazer isto", derrubava o caso real da Bolsa do Ceará).
// Mantém só frases que praticamente só aparecem em regra de
// cidadania/residência/passaporte.
const GEO_EXCLUSION_PHRASE_PATTERN = /\bmust be (?:a |an )?(?:citizen|resident|national)\b|\bmust (?:live|reside) in\b|\bpermanent residents?\b|\bcitizens? or (?:permanent )?residents?( of)?\b|\bcitizens? and residents? of\b|\bopen only to\b|\bpassport issued by\b|\bdeve ser (?:cidad[aã]o|residente)\b/i;

// Mesma checagem do rótulo estruturado, mas direto no texto bruto de cada
// fonte (não só na evidence que o modelo devolveu) — cobre dois casos: (1)
// o modelo pede "unqualified" mas devolve evidence vazio ou mal citado,
// mesmo com o dado real disponível na página coletada; (2) o modelo cita
// uma frase real mas IRRELEVANTE (ex.: idade) e "esquece" de citar a frase
// que realmente exclui (ex.: Western Balkans Meet Japan — a citação do
// modelo era sobre idade mínima, mas a mesma página também diz "Applicants
// must live in one of the participating Western Balkan societies", que nem
// chegou a ser avaliada). Só aceita se a fonte INTEIRA (não só um trecho
// perto da frase) não tiver nenhum sinal de alcance Brasil/internacional —
// evita repetir o falso positivo da Bolsa do Ceará (sinal de alcance longe
// da frase que disparou o match).
function findGeographicExclusionEvidence(sources) {
  for (const source of sources || []) {
    const text = source?.text;
    if (!text) continue;
    const labelQuote = findScopeRestrictionQuote(text);
    if (labelQuote) return { quote: labelQuote, source_url: source.url, trust_rank: Number(source.trust?.trust_rank || 0) };

    const norm = normalizedText(text);
    if (BRAZIL_REACH_PATTERN.test(norm) || BRAZIL_LOCAL_REACH_PATTERN.test(norm)) continue;
    const match = GEO_EXCLUSION_PHRASE_PATTERN.exec(norm);
    if (match) {
      const start = Math.max(0, match.index - 80);
      const end = Math.min(norm.length, match.index + match[0].length + 80);
      return { quote: norm.slice(start, end).trim(), source_url: source.url, trust_rank: Number(source.trust?.trust_rank || 0) };
    }
  }
  return null;
}
const TAG_EXCLUSIONS = new Set([
  'sentinel', 'remoto', 'online', 'presencial', 'hibrido', 'híbrido', 'ingles', 'inglês', 'portugues', 'português', 'espanhol',
  'gratuito', 'gratis', 'grátis', 'pago', 'bolsa-de-estudo', 'totalmente-financiado', 'ensino-medio', 'ensino-médio',
  'ensino-fundamental', 'fundamental', 'gap-year', 'programas-academicos', 'programas-acadêmicos', 'olimpiadas-cientificas',
  'olimpíadas-científicas', 'competicoes', 'competições', 'competicoes-de-escrita', 'competições-de-escrita',
  'mentorias', 'bolsas-de-estudo', 'programas-de-intercambio', 'programas-de-intercâmbio', 'muns', 'estagios', 'estágios',
]);

const ELIGIBILITY_PROCESS_GUIDANCE = [
  '- eligibility alimenta somente a seção "Elegibilidade" e responde objetivamente: quem pode participar? Inclua apenas condições que selecionam ou excluem candidatos. Use até 7 itens curtos, um por linha, sem símbolos de bullet. Comece cada item com verbo, limite-o a 14 palavras e nunca invente itens para completar a lista.',
  '- Não coloque em eligibility explicações sobre a oportunidade, etapas de inscrição, documentos ou trabalhos a enviar, temas, prazo, custo, benefícios, etapas de seleção nem o que acontece com os selecionados.',
  '- process alimenta a seção "Sobre o processo". Coloque ali como se inscrever, o que enviar, temas ou formatos exigidos, etapas da seleção e o que acontece depois da seleção. Organize as ações em até cinco frases curtas.',
  '- Analise eligibility e process em conjunto: mova para process todo conteúdo operacional ou explicativo que estiver em eligibility, sem perder informação e sem duplicá-la.',
  '- Em process, não repita prazo, custo, local ou idioma já registrados nos campos próprios.',
  '- O catálogo é voltado a estudantes brasileiros. Não escreva "Ser de qualquer lugar do mundo" nem equivalentes. Só inclua nacionalidade ou residência quando houver restrição real que afete brasileiros.',
  '- Se language já informar "Inglês", não repita em eligibility requisitos genéricos como "Saber inglês". Mantenha apenas exigência linguística adicional, específica e eliminatória, como nota mínima comprovada em teste.',
  '- Exemplo: para Câmara Mirim na Escola, eligibility deve ser apenas "Estar entre o 5º e 9º ano do Ensino Fundamental". O envio do projeto de lei, a participação da escola ou de educadores e as etapas de seleção pertencem a process.',
].join('\n');

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
export function addMetrics(...items) {
  return items.reduce((total, item) => ({
    modelCalls: total.modelCalls + Number(item?.modelCalls || 0),
    pageFetches: total.pageFetches + Number(item?.pageFetches || 0),
    inputTokens: total.inputTokens + Number(item?.inputTokens || 0),
    outputTokens: total.outputTokens + Number(item?.outputTokens || 0),
  }), emptyMetrics());
}

// O histórico de "Execuções" (Sentinel > Resultados por fonte > Execuções) não
// precisa acumular pra sempre — é um log de apoio pra ver o que rodou
// recentemente (com links, fontes, consumo de IA), não uma auditoria
// permanente. Depois de cada nova execução criada, mantém só as
// RUN_HISTORY_LIMIT mais recentes (de qualquer tipo — descoberta, pesquisa
// manual, revisão de catálogo ou enriquecimento) e apaga o resto.
const RUN_HISTORY_LIMIT = 15;

async function limitarHistoricoExecucoes(supabase) {
  const { data, error } = await supabase.from('sentinel_research_runs')
    .select('id').order('started_at', { ascending: false }).range(RUN_HISTORY_LIMIT, RUN_HISTORY_LIMIT + 999);
  if (error || !data?.length) return;
  await supabase.from('sentinel_research_runs').delete().in('id', data.map((row) => row.id));
}

export async function createRun(supabase, user, runType, requestedCount, metadata = {}) {
  const { data, error } = await supabase.from('sentinel_research_runs').insert({
    run_type: runType,
    requested_count: requestedCount,
    model: MODEL,
    prompt_version: runType === 'catalog_review' ? CATALOG_PROMPT_VERSION : DISCOVERY_PROMPT_VERSION,
    metadata,
    created_by: user.id,
  }).select().single();
  if (error) throw error;
  limitarHistoricoExecucoes(supabase).catch((cleanupError) => {
    console.error('Limpeza do histórico de execuções falhou:', cleanupError.message);
  });
  return data;
}

export async function updateRun(supabase, runId, patch) {
  const { data, error } = await supabase.from('sentinel_research_runs').update(patch).eq('id', runId).select().single();
  if (error) throw error;
  return data;
}

export async function finalizeRun(supabase, runId, result, metrics, fatalError = null) {
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
  // A triagem por score agora acontece ANTES de inserir a linha (ver
  // runDiscovery: score < MIN_DISCOVERY_SCORE nunca chega a virar uma linha
  // em sentinel_posts). Toda linha que chega aqui já passou nesse corte, então
  // sempre entra na fila — isso só ordena, não filtra mais nada.
  return 'queued';
}

// Contas de Instagram ativas (tabela sentinel_instagram_accounts, editável
// por Admin/Editor na tela do Sentinel). Lista vazia = Instagram desligado:
// runDiscovery pula a etapa inteira, sem chamar a Apify.
export async function activeInstagramAccounts(supabase) {
  const { data, error } = await supabase.from('sentinel_instagram_accounts').select('username').eq('active', true).order('username');
  if (error) {
    console.warn('[sentinel] não foi possível carregar as contas de Instagram:', error.message);
    return [];
  }
  return (data || []).map((row) => String(row.username || '').trim()).filter(Boolean);
}

export async function activeOpportunityTagNames(supabase) {
  const { data, error } = await supabase.from('opportunity_tags').select('name').eq('active', true)
    .order('category').order('sort_order').order('name');
  if (error) {
    console.warn('[sentinel] não foi possível carregar o vocabulário de tags:', error.message);
    return [];
  }
  return (data || []).map((tag) => String(tag.name || '').trim()).filter(Boolean);
}

function extractUrl(value) {
  return String(value || '').match(/https?:\/\/[^\s\)"]+/)?.[0] || null;
}

const TRACKING_PARAMS = /^(?:utm_.+|fbclid|gclid|mc_cid|mc_eid|ref|referrer|source)$/i;
// Palavras que aparecem em variações do MESMO título sem mudar do que se
// trata ("Programa X" vs "X Program" vs "The X Scholarship") — tiradas antes
// de comparar, pra não contarem como diferença real.
const DISCOVERY_TITLE_NOISE = new Set([
  'apply', 'application', 'applications', 'conference', 'funded', 'fully', 'now',
  'open', 'opportunity', 'program', 'programme', 'programa', 'scholarship', 'bolsa',
  'the', 'a', 'an', 'of', 'for', 'in', 'on', 'at', 'to', 'and', 'with', 'by', 'from',
  'official', 'oficial', 'international', 'internacional', 'global', 'national', 'nacional',
  'e', 'de', 'da', 'do', 'das', 'dos', 'no', 'na', 'nos', 'nas', 'um', 'uma', 'uns', 'umas',
  'com', 'para', 'por', 'em', 'ao', 'aos',
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

// O "código leve e reproduzível" pra reconhecer a mesma oportunidade no
// futuro (pedido do usuário) é simplesmente o domínio registrável do link
// oficial — barato de calcular, igual pra sempre que vier da mesma
// organização, e não depende do título vir escrito igual (nem da URL exata
// da página, que muda de edição pra edição: /2026/inscricoes vs /2027/apply).
export function registrableDomain(value) {
  try {
    const host = comparableHost(new URL(String(value || '').trim()).hostname);
    const parts = host.split('.').filter(Boolean);
    return parts.length > 2 ? parts.slice(-2).join('.') : host;
  } catch {
    return '';
  }
}

export function discoveryTitleSimilarity(left, right) {
  const a = new Set(discoveryTitleTokens(left));
  const b = new Set(discoveryTitleTokens(right));
  if (!a.size || !b.size) return 0;
  const intersection = [...a].filter((token) => b.has(token)).length;
  return intersection / Math.min(a.size, b.size);
}

// Ano da edição: NÃO decide se é duplicata — só serve pra saber se o
// conteúdo precisa ser revalidado. "AI Civic Action Accelerator 2026" e
// "...2027" são a MESMA oportunidade (mesmo programa), só que numa edição
// mais nova — o certo é achar a linha antiga no catálogo e mandar o
// conteúdo dela pra revisão de novo (prazo, elegibilidade etc. mudam a cada
// edição), em vez de criar uma linha nova do zero.
// O título deixou de carregar o ano (edições anuais recorrentes perdiam
// alcance com "2026" fixo no nome), então o ano da edição agora vem
// primeiro do deadline (sempre tem ano completo, por regra do prompt) — o
// título só é usado como retrocompatibilidade com registros antigos que
// ainda têm o ano no nome.
function titleYear(value) {
  return String(value || '').match(/\b(20\d{2})\b/)?.[0] || null;
}
function editionYear(value) {
  return String(value?.deadline || '').match(/\b(20\d{2})\b/)?.[0] || titleYear(value?.title) || null;
}

// true quando `extracted` é uma edição mais nova do mesmo programa que já
// existe no catálogo como `candidate` (mesmo título-base, ano maior).
export function isNewerEdition(candidate, extracted) {
  const candidateYear = Number(editionYear(candidate));
  const extractedYear = Number(editionYear(extracted));
  return Boolean(candidateYear && extractedYear && extractedYear > candidateYear);
}

// A "fórmula" pedida pelo usuário: um código leve, calculado só a partir do
// título (sem depender do link, que pode mudar de domínio de uma fonte pra
// outra — mirror, agregador, site oficial vs. terceiro). Tira palavras de
// preenchimento (artigos, preposições, "program"/"official" etc.) e o ano,
// ordena os tokens que sobraram e junta — assim "The Ross Program" e
// "Programa Ross (Ross Program)" caem na mesma fórmula, mesmo vindo de sites
// diferentes.
export function titleFingerprint(value) {
  return discoveryTitleTokens(value)
    .filter((token) => !/^20\d{2}$/.test(token))
    .filter((token, index, all) => all.indexOf(token) === index)
    .sort()
    .join(' ');
}

export function isDuplicateOpportunity(candidate, extracted) {
  const candidateFingerprint = titleFingerprint(candidate?.title);
  const extractedFingerprint = titleFingerprint(extracted.title);
  if (candidateFingerprint && candidateFingerprint === extractedFingerprint) return true;

  const sameKey = candidate?.sentinel_discovery_key
    && candidate.sentinel_discovery_key === opportunityDiscoveryKey(extracted.link, extracted.title);
  if (sameKey) return true;

  const similarity = discoveryTitleSimilarity(candidate?.title, extracted.title);
  const sameUrl = canonicalizeOpportunityUrl(candidate?.link) === canonicalizeOpportunityUrl(extracted.link);
  const candidateDomain = registrableDomain(candidate?.link);
  const sameDomain = candidateDomain && candidateDomain === registrableDomain(extracted.link);
  // Link/domínio ainda contam quando batem (reforçam a decisão), mas não são
  // mais obrigatórios: título muito parecido sozinho (>=0.85) já basta,
  // porque a mesma oportunidade pode chegar por um mirror, agregador ou o
  // site oficial — o link muda, o nome do programa não.
  return (sameUrl && similarity >= 0.72)
    || (similarity === 1 && discoveryTitleTokens(extracted.title).length >= 4)
    || (sameDomain && similarity >= 0.4)
    || similarity >= 0.85;
}

function decodeHtmlEntities(value) {
  const named = {
    aacute: '\u00e1', Aacute: '\u00c1', agrave: '\u00e0', Agrave: '\u00c0', acirc: '\u00e2', Acirc: '\u00c2', atilde: '\u00e3', Atilde: '\u00c3',
    eacute: '\u00e9', Eacute: '\u00c9', ecirc: '\u00ea', Ecirc: '\u00ca', iacute: '\u00ed', Iacute: '\u00cd',
    oacute: '\u00f3', Oacute: '\u00d3', ocirc: '\u00f4', Ocirc: '\u00d4', otilde: '\u00f5', Otilde: '\u00d5',
    uacute: '\u00fa', Uacute: '\u00da', uuml: '\u00fc', Uuml: '\u00dc', ccedil: '\u00e7', Ccedil: '\u00c7',
    ordm: '\u00ba', ordf: '\u00aa', ndash: '\u2013', mdash: '\u2014', bull: '\u2022', hellip: '\u2026',
  };
  return String(value || '')
    .replace(/&#x([0-9a-f]+);/gi, (_, code) => String.fromCodePoint(parseInt(code, 16)))
    .replace(/&#(\d+);/g, (_, code) => String.fromCodePoint(Number(code)))
    .replace(/&([a-z][a-z0-9]+);/gi, (entity, name) => named[name] ?? entity)
    .replace(/&amp;/gi, '&').replace(/&quot;/gi, '"').replace(/&apos;|&#39;/gi, "'").replace(/&nbsp;/gi, ' ');
}

function stripHtml(html) {
  return decodeHtmlEntities(html.replace(/<script[\s\S]*?<\/script>/gi, '').replace(/<style[\s\S]*?<\/style>/gi, '').replace(/<[^>]+>/g, ' ')).replace(/\s+/g, ' ').trim();
}

const ADJACENT_LINK_SIGNALS = [
  ['deadline', 12], ['application', 10], ['registration', 10], ['submission', 11], ['submit', 11],
  ['apply', 9], ['register', 9],
  ['inscri', 10], ['prazo', 12], ['edital', 9], ['rules', 7], ['regulamento', 7],
  ['important dates', 9], ['timeline', 8], ['calendar', 6], ['faq', 5], ['eligibility', 5],
  ['guidelines', 8], ['guide', 6], ['news', 4], ['resources', 3], ['schedule', 3],
  // Caso real: promys.org tem uma página dedicada
  // "/for-international-students/" que nunca era priorizada — sem nenhuma
  // palavra da lista batendo no texto do link, ela ficava com signalScore=0 e
  // dependia só do path bater (nem sempre bate), então a pesquisa terminava
  // sem citar essa página e o veredito caía pra "uncertain" por falta de
  // evidência, mesmo o programa aceitando estudantes internacionais.
  ['international', 12], ['internacional', 12], ['non-us', 8], ['overseas', 8], ['worldwide', 9],
  ['who can apply', 9], ['who is eligible', 9], ['quem pode participar', 9], ['estrangeiro', 9],
];
// Caso real: AI Civic Action Accelerator 2026 — a página fonte tinha botões
// de compartilhar (Reddit, Twitter/X, Pinterest, WhatsApp, Telegram) cujos
// links de verdade são coisas como "reddit.com/submit?url=..." ou
// "twitter.com/intent/tweet?text=...". Eles passavam pela lista de bloqueio
// (que só olhava pro DOMÍNIO da rede social, tipo facebook.com/instagram.com)
// e "comiam" vagas preciosas de MAX_ADJACENT_PAGES (só 8) — deixando a
// pesquisa sem espaço pra ler a página real de elegibilidade.
const ADJACENT_LINK_BLOCKLIST = /(?:privacy|cookie|terms|login|sign[ -]?in|donate|sponsor|facebook|instagram|linkedin|youtube|mailto:|javascript:|reddit\.com\/submit|twitter\.com\/intent|x\.com\/intent|pinterest\.[a-z.]+\/pin\/create|api\.whatsapp\.com\/send|telegram\.me\/share|t\.me\/share|\/share\?url=|sharer\.php)/i;
const ADJACENT_EVENT_PENALTY = /(?:will be held|takes place|event date|tournament day|logistics|finals?\b)/i;
const RESEARCH_TOKEN_STOPWORDS = new Set(['para', 'programa', 'program', 'project', 'projeto', 'edicao', 'edition', 'especial', 'official', 'oficial', 'index', 'http', 'https', '2024', '2025', '2026', '2027']);
const ARCHIVE_LINK_PENALTY = /(?:edições?[-\s]+anteriores|edicoes?[-\s]+anteriores|archive|past[-\s]+editions?|resultados?|selecionad[oa]s?)/i;
// Caso real: AI Civic Action Accelerator 2026 (opportunitiesforyouth.org)
// puxou "apply-now-2026-horizon-fellowship..." — um post TOTALMENTE diferente
// no mesmo blog — pra dentro da pesquisa, só porque a palavra "application"
// aparecia no título (bate com o sinal genérico "application", peso 10, que
// sozinho já passava do corte de 9 pra ignorar a falta de tópico em comum).
// Sites de notícias/oportunidades quase sempre usam uma URL no formato
// /AAAA/MM/DD/titulo-do-post/ pra cada post — dois links nesse formato, no
// mesmo site, sem nenhuma palavra do título em comum, são quase certamente
// posts diferentes (não uma página de elegibilidade/FAQ, que não costuma
// morar numa URL datada assim).
const DATED_BLOG_POST_PATTERN = /^\/\d{4}\/\d{2}\/\d{2}\//;

function comparableHost(hostname) {
  return String(hostname || '').toLowerCase().replace(/^www\./, '');
}

// Sites-semente que só AGREGAM/REPORTAM oportunidades de terceiros (blogs de
// vagas, não a organização que roda o programa). Mantenha em sincronia com os
// "url" de api/lib/scraperSources.js#FONTES. Achado num caso real: a bolsa
// FAWE Mastercard Foundation (só pra jovens de Gana) veio de uma notícia no
// Opportunity Desk; uma página completamente diferente do MESMO blog (um post
// de 2014 sobre outro prêmio, só porque a URL continha "application") virou
// "official_rules_or_application" com prioridade 5 — mais confiável que a
// própria fonte oficial (fawegh.org, corretamente marcada como prioridade 3).
// Isso poluiu a pesquisa com "evidência" de um programa errado e ajudou a
// travar o veredito de elegibilidade em "incerto" em vez de reconhecer o
// país-alvo pela fonte de verdade. Página do mesmo host que um agregador
// nunca é "oficial" desta oportunidade especificamente, não importa a URL.
const AGGREGATOR_SEED_HOSTS = new Set([
  'opportunitydesk.org', 'brightscholarship.com', 'opportunitiesforyouth.org', 'oyaop.com',
  'standoutsearch.com', 'snow.day', 'pathspire.net', 'admissionsangle.com', 'reddit.com',
]);

function researchSourceAssessment(url, relation = '', { primaryUrl = '', discoveredFrom = null, depth = 0 } = {}) {
  let host = '';
  let primaryHost = '';
  try { host = comparableHost(new URL(url).hostname); } catch { /* leave empty */ }
  try { primaryHost = comparableHost(new URL(primaryUrl).hostname); } catch { /* leave empty */ }
  const searchable = normalizedText(`${url} ${relation}`);
  const isSocial = /(?:^|\.)(?:instagram|facebook|linkedin|tiktok|x|twitter)\.com$/.test(host);
  const operational = /\b(?:apply|application|register|registration|submit|submission|rules|regulamento|edital|guidelines|inscri)\b/.test(searchable);
  const sameHost = host && primaryHost && host === primaryHost;
  const seedIsAggregator = primaryHost && AGGREGATOR_SEED_HOSTS.has(primaryHost);
  if (sameHost && depth === 0) return { authority: 'seed_site_unverified', trust_rank: 3, discovered_from: discoveredFrom };
  if (operational && sameHost && !seedIsAggregator) return { authority: 'official_rules_or_application', trust_rank: 5, discovered_from: discoveredFrom };
  // Mesmo host de um agregador conhecido: é só outro post do blog, nunca
  // "oficial" desta oportunidade — trava no mesmo nível de confiança da
  // própria notícia-semente (3), mesmo que a URL contenha "apply"/"application".
  if (sameHost && seedIsAggregator) return { authority: 'seed_site_unverified', trust_rank: 3, discovered_from: discoveredFrom };
  if (sameHost) return { authority: 'same_organization_site', trust_rank: 4, discovered_from: discoveredFrom };
  if (isSocial) return { authority: 'social_lead', trust_rank: 1, discovered_from: discoveredFrom };
  if (operational && discoveredFrom) return { authority: 'linked_application_platform', trust_rank: 3, discovered_from: discoveredFrom };
  return { authority: 'third_party_or_unverified', trust_rank: 2, discovered_from: discoveredFrom };
}

const AUTHORITY_TRUST_RANK = {
  official_rules_or_application: 5,
  same_organization_site: 4,
  seed_site_unverified: 3,
  linked_application_platform: 3,
  third_party_or_unverified: 2,
  social_lead: 1,
};

function annotateResearchSource(source, context = {}) {
  return { ...source, trust: researchSourceAssessment(source.url, source.relation, context) };
}

function researchTitleTokens(value) {
  return [...new Set(normalizedText(value).split(/[^a-z0-9]+/)
    .filter((token) => token.length >= 4 && !RESEARCH_TOKEN_STOPWORDS.has(token)))];
}

export function buildOpportunityResearchPlan(opportunity = {}) {
  const year = String(opportunity.title || '').match(/\b20\d{2}\b/)?.[0] || String(new Date().getUTCFullYear());
  return [
    { id: 'current_cycle', question: `Qual é a edição vigente de ${opportunity.title || 'esta oportunidade'} em ${year}?`, signals: [year, 'edição', 'inscrições abertas', 'notícia', 'announcement'] },
    { id: 'deadline_status', question: 'Quais são os prazos de candidatura e o estado atual das inscrições?', signals: ['prazo', 'inscrição', 'deadline', 'application', 'cronograma', 'calendar'] },
    { id: 'participation', question: 'Quem pode participar e quais condições realmente selecionam candidatos?', signals: ['requisitos', 'elegibilidade', 'quem pode participar', 'eligibility', 'rules', 'regulamento'] },
    { id: 'brazilian_youth', question: 'Existe ao menos um grupo de jovens brasileiros que atende à elegibilidade, inclusive grupos restritos a um estado, cidade, escola, série ou idade?', signals: ['Brasil', 'Brazil', 'nacionalidade', 'estado', 'cidade', 'escola', 'matriculado', 'youth', 'jovens', 'students', 'international', 'internacional', 'estrangeiro', 'worldwide', 'who can apply'] },
    { id: 'application', question: 'Como funciona a candidatura e quais materiais ou etapas são exigidos?', signals: ['formulário', 'como participar', 'application', 'apply', 'documentos', 'processo'] },
    { id: 'logistics_support', question: 'Qual é o formato, local, custo, apoio e benefício oferecido?', signals: ['gratuito', 'custo', 'bolsa', 'prêmio', 'local', 'online', 'presencial', 'support'] },
  ];
}

export function extractAdjacentLinks(html, baseUrl, context = {}) {
  let base;
  try { base = new URL(baseUrl); } catch { return []; }
  const baseHost = comparableHost(base.hostname);
  const titleTokens = researchTitleTokens(context.title || '');
  const researchYear = String(context.year || new Date().getUTCFullYear());
  const basePathTokens = researchTitleTokens(base.pathname.replace(/index\.php/gi, ' '));
  const candidates = new Map();
  const markdownAnchors = [...String(html || '').matchAll(/\[([^\]]{1,300})\]\(([^)\s]+)(?:\s+"[^"]*")?\)/g)]
    .map((match) => `<a href="${match[2].replace(/"/g, '&quot;')}">${match[1]}</a>`).join('\n');
  const searchableMarkup = `${html}\n${markdownAnchors}`;
  const pattern = /<a\b[^>]*href\s*=\s*(["'])(.*?)\1[^>]*>([\s\S]*?)<\/a>/gi;
  let match;
  while ((match = pattern.exec(searchableMarkup))) {
    const label = stripHtml(match[3]);
    const rawHref = decodeHtmlEntities(match[2].trim());
    const searchable = `${label} ${rawHref}`.toLowerCase();
    const normalizedSearchable = normalizedText(searchable);
    if (!rawHref || ADJACENT_LINK_BLOCKLIST.test(searchable)) continue;
    let target;
    try { target = new URL(rawHref, base); } catch { continue; }
    if (!['http:', 'https:'].includes(target.protocol)) continue;
    target.hash = '';
    if (target.href === base.href || /\.(?:jpe?g|png|gif|webp|svg|zip|mp4|mp3)$/i.test(target.pathname)) continue;
    const targetHost = comparableHost(target.hostname);
    const relatedHost = targetHost === baseHost || targetHost.endsWith(`.${baseHost}`) || baseHost.endsWith(`.${targetHost}`);
    const matchedTitleTokens = titleTokens.filter((token) => normalizedSearchable.includes(token)).length;
    const topicScore = matchedTitleTokens === titleTokens.length && titleTokens.length > 1
      ? Math.min(matchedTitleTokens * 5, 15)
      : matchedTitleTokens * 3;
    const normalizedTargetPath = normalizedText(target.pathname);
    const matchesBasePath = relatedHost && basePathTokens.length > 0
      && basePathTokens.every((token) => normalizedTargetPath.includes(token));
    const pathScore = matchesBasePath ? (basePathTokens.length === 1 ? 10 : 7) : 0;
    const signalScore = ADJACENT_LINK_SIGNALS.reduce((total, [signal, weight]) => total + (searchable.includes(signal) ? weight : 0), 0);
    const isUnrelatedDatedBlogPost = relatedHost && matchedTitleTokens === 0 && target.pathname !== base.pathname
      && DATED_BLOG_POST_PATTERN.test(base.pathname) && DATED_BLOG_POST_PATTERN.test(target.pathname);
    if (isUnrelatedDatedBlogPost) continue;
    if (relatedHost && basePathTokens.length && !matchesBasePath && matchedTitleTokens === 0 && signalScore < 9) continue;
    if (titleTokens.length > 1 && matchedTitleTokens > 0 && matchedTitleTokens < titleTokens.length && signalScore === 0 && pathScore === 0) continue;
    const yearScore = normalizedSearchable.includes(researchYear) && (matchedTitleTokens > 0 || signalScore > 0) ? 10 : 0;
    const linkedYears = [...normalizedSearchable.matchAll(/\b(20\d{2})\b/g)].map((yearMatch) => Number(yearMatch[1]));
    const staleYearPenalty = linkedYears.length
      ? Math.min(20, Math.max(0, Number(researchYear) - Math.max(...linkedYears)) * 8)
      : 0;
    const score = signalScore
      + Math.min(topicScore, 15) + pathScore + yearScore
      - (ADJACENT_EVENT_PENALTY.test(searchable) ? 4 : 0)
      - (ARCHIVE_LINK_PENALTY.test(normalizedSearchable) ? 15 : 0)
      - staleYearPenalty;
    if (score < 4) continue;
    if (!relatedHost && score < 9) continue;
    const previous = candidates.get(target.href);
    if (!previous || score > previous.score) candidates.set(target.href, { url: target.href, label, score });
  }
  return [...candidates.values()].sort((a, b) => b.score - a.score || a.url.localeCompare(b.url));
}

const DOCUMENT_SOURCE_PATTERN = /\.pdf(?:$|[?#])|drive\.google\.com\/file\/d\//i;

function repairExtractedText(value) {
  let text = String(value || '').replace(/\u0131/g, 'i');
  for (let pass = 0; pass < 2; pass += 1) {
    text = text.replace(/([A-Za-z])[´`¸~˜^¨]+\s*([A-Za-z])/g, '$1$2');
  }
  return text;
}

function compactResearchText(value, maxChars) {
  const text = repairExtractedText(value).trim();
  if (text.length <= maxChars) return text;
  const segments = [text.slice(0, Math.min(1_800, Math.floor(maxChars / 3)))];
  const marker = /(?:inscri|deadline|prazo|application|registration|submit|candidat|cronograma|calendar|eligib|participa)/gi;
  let match;
  while ((match = marker.exec(text)) && segments.join('\n\n').length < maxChars - 500) {
    const excerpt = text.slice(Math.max(0, match.index - 280), Math.min(text.length, match.index + 720)).trim();
    if (excerpt && !segments.some((segment) => segment.includes(excerpt))) segments.push(excerpt);
  }
  return segments.join('\n\n').slice(0, maxChars);
}

async function fetchReaderPage(url, { maxChars, discoverLinks, linkContext, pageFetches = 0 }) {
  const fallback = await fetch(`https://r.jina.ai/${url}`, {
    headers: { Accept: 'text/plain' },
    signal: AbortSignal.timeout(30_000),
  });
  if (!fallback.ok) throw Object.assign(new Error(`HTTP ${fallback.status}`), { pageFetches: pageFetches + 1 });
  const raw = repairExtractedText(await fallback.text());
  return {
    url,
    text: compactResearchText(raw, maxChars),
    links: discoverLinks ? extractAdjacentLinks(raw, url, linkContext) : [],
    pageFetches: pageFetches + 1,
  };
}

async function fetchPageText(url, { maxChars = 12_000, discoverLinks = false, linkContext = {} } = {}) {
  if (DOCUMENT_SOURCE_PATTERN.test(url)) {
    try {
      return await fetchReaderPage(url, { maxChars, discoverLinks, linkContext });
    } catch (error) {
      throw Object.assign(new Error(`Não foi possível ler ${url} (${String(error.message || error)}).`), { pageFetches: error.pageFetches || 1 });
    }
  }
  let pageFetches = 0;
  try {
    pageFetches += 1;
    const response = await fetch(url, {
      redirect: 'follow',
      headers: { 'User-Agent': 'Mozilla/5.0 (compatible; AccessPlus-Sentinel/3.0)', Accept: 'text/html,text/plain,application/pdf' },
      signal: AbortSignal.timeout(12_000),
    });
    if (response.ok) {
      const contentType = String(response.headers.get('content-type') || '').toLowerCase();
      if (contentType.includes('application/pdf')) {
        return await fetchReaderPage(response.url || url, { maxChars, discoverLinks, linkContext, pageFetches });
      }
      const raw = await response.text();
      const finalUrl = response.url || url;
      const text = compactResearchText(stripHtml(raw), maxChars);
      const links = discoverLinks ? extractAdjacentLinks(raw, finalUrl, linkContext) : [];
      if (text.length > 200) {
        if (discoverLinks && links.length === 0) {
          try {
            const reader = await fetchReaderPage(finalUrl, { maxChars, discoverLinks, linkContext, pageFetches });
            if (reader.text.length > text.length || reader.links.length > links.length) return reader;
            pageFetches = reader.pageFetches;
          } catch (error) { pageFetches = error.pageFetches || pageFetches; }
        }
        return { url: finalUrl, text, links, pageFetches };
      }
    }
  } catch { /* use the text fallback */ }

  try {
    return await fetchReaderPage(url, { maxChars, discoverLinks, linkContext, pageFetches });
  } catch (error) {
    throw Object.assign(new Error(`Não foi possível ler ${url} (${String(error.message || error)}).`), { pageFetches: error.pageFetches || pageFetches });
  }
}

export async function fetchResearchSources(url, opportunity = {}) {
  const plan = buildOpportunityResearchPlan(opportunity);
  const year = String(opportunity.title || '').match(/\b20\d{2}\b/)?.[0] || String(new Date().getUTCFullYear());
  const linkContext = { title: opportunity.title || '', year, signals: plan.flatMap((topic) => topic.signals) };
  const primaryLimit = Math.min(12_000, SOURCE_CHAR_LIMIT);
  const primary = await fetchPageText(url, { maxChars: primaryLimit, discoverLinks: true, linkContext });
  const remainingChars = Math.max(0, SOURCE_CHAR_LIMIT - primary.text.length);
  const adjacentLimit = MAX_ADJACENT_PAGES ? Math.max(4_000, Math.floor(remainingChars / MAX_ADJACENT_PAGES)) : 0;
  const sources = [annotateResearchSource(
    { url: primary.url, text: primary.text, relation: 'Fonte inicial', depth: 0 },
    { primaryUrl: primary.url, depth: 0 },
  )];
  const failures = [];
  const seen = new Set([canonicalizeOpportunityUrl(primary.url)]);
  const queue = new Map();
  const enqueue = (links, depth, discoveredFrom = primary.url) => {
    for (const link of links || []) {
      const key = canonicalizeOpportunityUrl(link.url);
      if (!key || seen.has(key)) continue;
      const candidate = { ...link, depth, discoveredFrom, priority: link.score - depth * 2 };
      const previous = queue.get(key);
      if (!previous || candidate.priority > previous.priority) queue.set(key, candidate);
    }
  };
  enqueue(primary.links, 1, primary.url);
  // Caso real: espr.camp/program não menciona elegibilidade nem prazo — essa
  // informação só existe em /faq (idade, nacionalidade "de qualquer país",
  // custo) e possivelmente /apply (prazo). Um link de nav só com o texto
  // "FAQ" tem pontuação baixa no descobridor de links (ADJACENT_LINK_SIGNALS)
  // e pode nem aparecer no HTML se o menu for montado por JavaScript. Em vez
  // de depender só de achar e pontuar esse link, tenta direto os caminhos
  // mais comuns de FAQ/inscrição no mesmo domínio — se não existir, é só um
  // 404 a mais na lista de falhas, sem custo real.
  const deepDivePaths = ['/faq', '/faqs', '/frequently-asked-questions', '/apply', '/application', '/how-to-apply'];
  const deepDiveGuesses = deepDivePaths
    .map((path) => { try { return new URL(path, primary.url).href; } catch { return null; } })
    .filter(Boolean)
    .map((guessUrl) => ({ url: guessUrl, label: 'Página comum de FAQ/inscrição (tentativa direta)', score: 20 }));
  enqueue(deepDiveGuesses, 1, primary.url);
  let pageFetches = primary.pageFetches;
  while (sources.length - 1 < MAX_ADJACENT_PAGES && queue.size) {
    const batch = [...queue.entries()]
      .sort(([, a], [, b]) => b.priority - a.priority || a.url.localeCompare(b.url))
      .slice(0, Math.min(2, MAX_ADJACENT_PAGES - (sources.length - 1)));
    for (const [key] of batch) { queue.delete(key); seen.add(key); }
    const results = await Promise.all(batch.map(async ([, link]) => {
      try {
        const page = await fetchPageText(link.url, {
          maxChars: adjacentLimit,
          discoverLinks: link.depth < 3,
          linkContext,
        });
        return { link, page };
      } catch (error) {
        return { link, error };
      }
    }));
    for (const result of results) {
      if (result.error) {
        pageFetches += result.error.pageFetches || 0;
        failures.push(`${result.link.url}: ${String(result.error.message || result.error)}`);
        continue;
      }
      pageFetches += result.page.pageFetches;
      const finalKey = canonicalizeOpportunityUrl(result.page.url);
      if (!sources.some((source) => canonicalizeOpportunityUrl(source.url) === finalKey)) {
        sources.push(annotateResearchSource({
          url: result.page.url,
          text: result.page.text,
          relation: result.link.label || `Pesquisa relacionada (nível ${result.link.depth})`,
          depth: result.link.depth,
        }, {
          primaryUrl: primary.url,
          discoveredFrom: result.link.discoveredFrom || primary.url,
          depth: result.link.depth,
        }));
      }
      if (result.link.depth < 3) enqueue(result.page.links, result.link.depth + 1, result.page.url);
    }
  }
  return { sources, pageFetches, adjacentFailures: failures, plan };
}

function sourcesForPrompt(sources) {
  return sources.map((source, index) => `[FONTE ${index + 1}]\nURL: ${source.url}\nContexto: ${source.relation}\nAutoridade preliminar: ${source.trust?.authority || 'não avaliada'} (prioridade ${source.trust?.trust_rank ?? 0})\nDescoberta a partir de: ${source.trust?.discovered_from || 'entrada inicial'}\nConteúdo:\n${source.text}`).join('\n\n');
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

export async function callModel(system, user, { maxTokens = 2048 } = {}) {
  const attempts = [];
  let metrics = emptyMetrics();
  for (const model of MODELS) {
    const startedAt = Date.now();
    try {
      const stream = await openAiClient().chat.completions.create({
        model,
        temperature: 0.15,
        max_tokens: maxTokens,
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

export function parseJsonObject(raw) {
  const rawText = String(raw || '');
  const objectStart = rawText.indexOf('{');
  const match = rawText.match(/\{[\s\S]*\}/);
  if (objectStart < 0) throw new Error('O modelo não devolveu um objeto JSON.');
  try {
    return JSON.parse(match?.[0] || rawText.slice(objectStart));
  } catch (originalError) {
    let candidate = rawText.slice(objectStart).replace(/```(?:json)?|```/gi, '').trim();
    const stack = [];
    let inString = false;
    let escaped = false;
    for (const char of candidate) {
      if (inString) {
        if (escaped) escaped = false;
        else if (char === '\\') escaped = true;
        else if (char === '"') inString = false;
        continue;
      }
      if (char === '"') inString = true;
      else if (char === '{' || char === '[') stack.push(char);
      else if (char === '}' && stack.at(-1) === '{') stack.pop();
      else if (char === ']' && stack.at(-1) === '[') stack.pop();
    }
    if (inString) candidate += '"';
    candidate = candidate.replace(/,\s*$/, '');
    while (stack.length) candidate += stack.pop() === '{' ? '}' : ']';
    try { return JSON.parse(candidate); } catch { throw originalError; }
  }
}

async function callStructuredModel(system, user, options = {}) {
  let metrics = emptyMetrics();
  const attempts = [];
  let lastError;
  for (let round = 0; round < 3; round += 1) {
    const retryInstruction = round === 0
      ? ''
      : round === 1
        ? '\n\nA resposta anterior não era JSON válido. Refaça a resposta completa, feche todos os arrays e objetos e devolva somente JSON cru.'
        : '\n\nA resposta continuou inválida. Responda novamente com JSON cru, compacto e sintaticamente válido. Não use markdown nem texto fora do objeto.';
    const response = await callModel(system, `${user}${retryInstruction}`, options);
    metrics = addMetrics(metrics, response.metrics);
    try {
      return {
        ...response,
        parsed: parseJsonObject(response.content),
        metrics,
        attempts: [...attempts, ...response.attempts],
      };
    } catch (error) {
      lastError = error;
      attempts.push(...response.attempts.map((attempt) => ({
        ...attempt,
        status: 'invalid_json',
        error: String(error.message || error),
      })));
    }
  }
  const error = new Error(`O modelo devolveu JSON inválido em três tentativas: ${String(lastError?.message || lastError)}`);
  error.metrics = metrics;
  error.modelAttempts = attempts;
  throw error;
}

export function discoveryPrompt(manual = false, allowedTags = []) {
  const today = new Date().toISOString().slice(0, 10);
  return `Você converte o dossiê factual validado do Sentinel em uma oportunidade do catálogo. Hoje é ${today}. Baseie tudo SOMENTE no dossiê e nas fontes fornecidas; não complete lacunas por conhecimento prévio. A qualificação já foi decidida pela etapa compartilhada de pesquisa.

PRAZOS:
1. deadline é somente a data limite para enviar candidatura, inscrição, projeto ou indicação.
2. Data do evento, cerimônia, resultado, viagem, início, pagamento ou final não comprova deadline.
3. Só informe deadline com uma citação que diga explicitamente deadline, applications close/due, registration closes/ends, submit by, register by, inscrições até, prazo ou equivalente.
4. Não infira datas pelo calendário e não misture edições.
5. Formate sem zero à esquerda: "4 de setembro de 2026". Se não houver prazo comprovado, use null.

IDIOMA E TAXONOMIA:
- Todos os valores, exceto nomes próprios, citações e URLs, devem estar em português brasileiro.
- cost aceita SOMENTE um destes três valores, nunca um valor em dinheiro nem uma frase descritiva: "Gratuito" (nenhum custo pra nenhum participante), "Bolsa" (existe mensalidade/taxa real, mas há bolsa, ajuda financeira, isenção parcial/total ou desconto por necessidade/mérito disponível), "Totalmente Financiado" (a organização cobre todas as despesas de quem é aceito, sem nenhuma cobrança). O site só existe pra listar oportunidades gratuitas ou com algum caminho de bolsa — nunca escreva "$4.750", "R$500", "US$1.100 por trimestre" ou qualquer valor monetário em cost, mesmo que a fonte também mencione bolsa disponível: nesse caso o valor correto é "Bolsa", sem citar o preço. Se a fonte só mostrar um preço real sem nenhuma bolsa/isenção/desconto disponível, isso é sinal de que a oportunidade não deveria ter sido qualificada — registre isso nos gaps/conflicts em vez de inventar um valor de cost.
- location deve separar candidatura remota de evento ou final presencial. Se toda a oportunidade for remota, use exatamente "Remoto" e não inclua local.
- areas: STEM, Humanas, Meio Ambiente, Linguagens ou Artes.
- level: Ensino Médio, Fundamental ou Gap Year — escolha pelo que a fonte exige, não pelo público genérico ("jovens"/"youth"/"teen"). Ensino Médio = aberto a quem AINDA ESTÁ cursando o ensino médio (secondary/high school student). Fundamental = aberto a quem ainda está no fundamental (younger student, middle school). Gap Year = exige ensino médio JÁ CONCLUÍDO como pré-requisito (ex.: "high school graduate", "completed secondary education", "before starting university/college", programa entre o ensino médio e a faculdade) — mesmo que a idade típica seja parecida com a de um aluno de ensino médio, se a fonte pede o ensino médio já concluído, é Gap Year, não Ensino Médio. Se a fonte exigir ensino superior (university/college) já em andamento ou concluído, isso não é nenhum dos três — sinal de que a oportunidade não deveria ter chegado até aqui; registre isso como gap em vez de forçar um nível.
- type: Programas Acadêmicos, Olimpíadas Científicas, Competições, Competições de Escrita, Mentorias, Bolsas de Estudo, Programas de Intercâmbio, MUNs ou Estágios.
- audience aceita SOMENTE estes valores, um ou mais quando comprovados: Negros, LGBT, Baixa Renda, Indígenas, Deficientes, Meninas, Escola Pública. Só inclua um valor quando a fonte exigir, priorizar ou direcionar explicitamente a oportunidade a esse público (cota, elegibilidade restrita, programa dedicado) — não infira a partir de linguagem genérica de diversidade/inclusão sem critério concreto. Não repita nível escolar (isso é level) nem tema (isso é areas). Se for aberta a qualquer estudante, sem recorte, use lista vazia.
- keywords deve ter de 3 a 8 nomes seletivos do vocabulário ativo, sobre temas, atividades, habilidades, entregáveis ou benefícios. Não use formato, idioma, custo, tipo, nível escolar ou público demográfico como tag.
${allowedTags.length ? `- Vocabulário ativo permitido para keywords: ${allowedTags.join(', ')}.` : ''}

QUALIDADE DO TEXTO:
- Escreva para estudantes e famílias, em linguagem simples, direta e sem tom promocional.
- title deve conter apenas o nome oficial. Remova chamadas como "apply now" e "fully funded" quando não fizerem parte do nome.
- Não inclua o ano da edição no título (ex.: "Programa X 2026" vira "Programa X"), mesmo que a fonte anuncie assim — a maioria dessas oportunidades se renova todo ano, e um ano fixo no nome faz o catálogo parecer desatualizado e reduz o alcance da busca. Só mantenha o ano se ele for parte permanente do nome oficial (ex.: um evento histórico específico, não uma edição anual). O ano da edição atual continua registrado em deadline.
- description deve dar ao estudante uma visão completa da oportunidade em texto corrido: o que é o programa, o tema e formato, o que ele oferece de fato (financiamento, mentoria, certificado, viagem, prêmio, publicação, networking etc.) e a duração/estrutura das atividades. Não é só uma frase-resumo: é o texto que substitui o estudante ter que ler a página oficial inteira pra entender do que se trata.
- Não repita em description o que já pertence a outro campo: regras de quem pode participar (isso é eligibility), passos de inscrição (isso é process), prazo, custo ou local exatos (campos próprios) — cite o benefício ou formato, não o procedimento.
- Sem limite rígido de palavras: normalmente fica entre 60 e 150 palavras em 3 a 6 frases, e pode passar disso se a oportunidade tiver várias fases, categorias ou modalidades que o estudante precisa entender antes de decidir se candidatar. Curto demais (uma frase genérica) é considerado incompleto.
${ELIGIBILITY_PROCESS_GUIDANCE}
- applicants deve trazer somente dicas específicas e comprovadas pela fonte. Se houver apenas orientação genérica, use null.
- additionals deve conter somente informação importante que não caiba nos outros campos. Não repita prazo, custo ou elegibilidade.
- Não use reticências, placeholders, jargão corporativo nem frases como "orientações disponíveis no site".

Cada campo preenchido deve ter evidence com citação literal e a URL exata da página onde o trecho foi encontrado. Se veio de inscrições, regulamento ou outra página adjacente, use essa URL, não a página principal.

Responda SOMENTE com JSON cru:
{"title":"Nome oficial","description":"Programa de verão de seis semanas nos Estados Unidos voltado a estudantes interessados em ciência de dados aplicada a problemas sociais. Combina oficinas técnicas com profissionais da área, um projeto em grupo desenvolvido ao longo do programa e mentoria individual até a apresentação final. Hospedagem, alimentação e material didático são cobertos pela organização, e os participantes recebem certificado internacional de conclusão.","link":"URL oficial","deadline":"4 de setembro de 2026","areas":["STEM"],"level":["Ensino Médio"],"audience":[],"location":"Remoto","cost":"Gratuito","language":"Inglês","keywords":["Inovação social","Gestão de projetos","Liderança"],"eligibility":"Estar matriculado","process":"Preencha o formulário. Anexe os documentos solicitados. Envie a candidatura.","applicants":null,"additionals":null,"type":"Programas Acadêmicos","evidence":{"deadline":{"quote":"Applications close on September 4, 2026","source_url":"https://example.org/apply","kind":"application_deadline"}}}`;
}

export function normalizeDiscoveryResult(parsed, research, fallbackUrl, allowedTags = []) {
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
    if (field === 'deadline' || field === 'eligibility') {
      // eligibility recebe o mesmo tratamento rígido de deadline: sem citação
      // literal validada contra as fontes, o campo é DESCARTADO, não só fica
      // sem selo de evidência. Achado num caso real: o EC Blue Book
      // Traineeship (que exige 3 anos de ensino superior já concluído) saiu
      // com eligibility "ensino médio completo, 14 a 18 anos" — inventado,
      // sem nenhuma citação da fonte por trás (evidence.eligibility ficou
      // null) — e mesmo assim entrou no catálogo, porque só deadline exigia
      // prova pra sobreviver. Eligibility é o campo que mais decide se um
      // estudante perde tempo (ou desiste sem precisar) — não pode ser a
      // única "opinião" da IA sem apoio em texto real da fonte.
      let checked = validateFieldEvidence(field, normalized, parsed.evidence?.[field], research.sources);
      // Mesma recuperação usada na re-revisão do catálogo: se o modelo
      // parafraseou em vez de citar literalmente, procura o trecho real nas
      // fontes antes de descartar — só falha de vez se a fonte genuinamente
      // não sustentar essa elegibilidade.
      if (!checked.valid && field === 'eligibility') {
        const recovered = findEligibilityEvidence(research.sources, normalized);
        if (recovered) checked = validateFieldEvidence(field, normalized, recovered, research.sources);
      }
      if (!checked.valid) {
        validationNotes.push(`${field} descartado: ${checked.reason}`);
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
  if (result.eligibility) {
    const objectiveEligibility = normalizeEligibilityForCatalog(result.eligibility, result.language, result);
    if (objectiveEligibility !== result.eligibility) {
      validationNotes.push('eligibility condensada para conter apenas critérios objetivos');
    }
    if (objectiveEligibility) result.eligibility = objectiveEligibility;
    else delete result.eligibility;
  }
  if (result.cost) {
    const canonicalCost = normalizeCostForCatalog(result.cost);
    if (canonicalCost !== result.cost) {
      validationNotes.push(canonicalCost
        ? `cost convertido de valor livre ("${result.cost}") para a categoria "${canonicalCost}" — o site só usa Gratuito/Bolsa/Totalmente Financiado, nunca valor em dinheiro`
        : `cost descartado: "${result.cost}" não indica gratuidade, bolsa ou financiamento total — só um preço, sem nenhuma ajuda confirmada`);
    }
    if (canonicalCost) result.cost = canonicalCost;
    else delete result.cost;
  }
  result.title = result.title || String(parsed.title || parsed.name || '').trim();
  const proposedLink = canonicalizeOpportunityUrl(result.link || parsed.link || fallbackUrl);
  const hostOf = (value) => { try { return comparableHost(new URL(value).hostname); } catch { return ''; } };
  const relatedLink = hostOf(proposedLink) && research.sources.some((source) => hostOf(source.url) === hostOf(proposedLink));
  result.link = relatedLink ? proposedLink : canonicalizeOpportunityUrl(research.sources[0]?.url || fallbackUrl);
  if (!result.title || !result.link) return { result: null, rejectionReason: 'A fonte não confirmou nome e link oficial suficientes.' };
  result.description = result.description || 'Descrição ainda não confirmada. Revise antes de publicar.';
  result.level = result.level || [];
  result.areas = result.areas || [];
  result.audience = result.audience || [];
  result.keywords = normalizeKeywordTags(result.keywords || [], allowedTags);
  result.type = result.type || 'Programas Acadêmicos';
  const closedEvidence = findExplicitClosedApplications(research.sources, result);
  if ((result.deadline && isPastDate(result.deadline)) || closedEvidence) {
    result.status = 'Encerrada';
    validationNotes.push(result.deadline && isPastDate(result.deadline)
      ? `status marcado como Encerrada porque o prazo confirmado (${result.deadline}) já passou`
      : 'status marcado como Encerrada porque a fonte informa que as inscrições fecharam');
  }
  return { result, evidence, validationNotes };
}

async function groundUrl(url, caption = '', ownerUsername = '', manual = false, sourceUrl = url, allowedTags = []) {
  let metrics = emptyMetrics();
  try {
    const dossier = await researchOpportunityDossier({
      url,
      opportunity: { link: url },
      leadSource: caption ? { url: sourceUrl, text: caption, relation: manual ? 'Entrada manual' : `Post de origem @${ownerUsername}` } : null,
    });
    const { research, brief } = dossier;
    metrics = dossier.metrics;
    if (brief.qualification.verdict === 'unqualified') {
      return {
        result: null,
        rejectionReason: brief.qualification.reason || 'As fontes indicam que jovens brasileiros não podem participar.',
        evidence: { _qualification: brief.qualification },
        validationNotes: [`qualification: ${brief.qualification.verdict}`],
        metrics,
        trace: {
          research_model: dossier.response.model,
          model_attempts: dossier.response.attempts.map((attempt) => ({ ...attempt, phase: 'research_brief' })),
          sources: research.sources.map((source) => ({ url: source.url, relation: source.relation, trust: source.trust })),
          source_assessments: brief.source_assessments,
          research_plan: research.plan,
          research_brief: brief,
          qualification: brief.qualification,
          adjacent_failures: research.adjacentFailures,
        },
      };
    }
    // "uncertain" não é mais descartado aqui: sem prova clara de exclusão,
    // seguimos para montar a entrada do catálogo e a salvamos como pendente
    // de revisão manual (ver qualification_status abaixo), em vez de perder
    // a oportunidade silenciosamente no log do Sentinel.
    let response = await callStructuredModel(
      discoveryPrompt(manual, allowedTags),
      `DOSSIÊ FACTUAL VALIDADO:\n${JSON.stringify(brief)}\n\nFONTES COMPLETAS:\n${sourcesForPrompt(research.sources)}\n\nRetorne o JSON do catálogo agora.`,
    );
    metrics = addMetrics(metrics, response.metrics);
    let mappingAttempts = response.attempts.map((attempt) => ({ ...attempt, phase: 'catalog_mapping' }));
    let normalized = normalizeDiscoveryResult(response.parsed, research, url, allowedTags);
    if (allowedTags.length && normalized.result && normalized.result.keywords.length < 3) {
      const retry = await callStructuredModel(
        `${discoveryPrompt(manual, allowedTags)}\n\nCORREÇÃO OBRIGATÓRIA: a resposta anterior ficou com menos de 3 tags depois da validação. Escolha de 3 a 8 nomes EXATOS do vocabulário ativo.`,
        `RESPOSTA ANTERIOR:\n${JSON.stringify(response.parsed)}\n\nDOSSIÊ FACTUAL VALIDADO:\n${JSON.stringify(brief)}\n\nFONTES COMPLETAS:\n${sourcesForPrompt(research.sources)}\n\nRetorne o JSON completo corrigido.`,
      );
      metrics = addMetrics(metrics, retry.metrics);
      mappingAttempts = [...mappingAttempts, ...retry.attempts.map((attempt) => ({ ...attempt, phase: 'catalog_mapping_tag_retry' }))];
      response = retry;
      normalized = normalizeDiscoveryResult(response.parsed, research, url, allowedTags);
      if (normalized.result && normalized.result.keywords.length < 3) {
        normalized.validationNotes.push('keywords permaneceu com menos de 3 tags canônicas após nova tentativa');
      }
    }
    if (normalized.result) {
      const qualified = brief.qualification.verdict === 'qualified';
      normalized.result.qualification_status = qualified ? 'qualified' : 'pending';
      normalized.result.qualification_reason = qualified
        ? (brief.qualification.reason || 'As fontes comprovam participação de jovens brasileiros.')
        : (brief.qualification.reason || 'A pesquisa não comprovou com certeza que jovens brasileiros podem participar; revise as fontes antes de aprovar.');
      normalized.evidence._qualification = brief.qualification;
      if (!qualified) normalized.validationNotes.push(`qualification: ${brief.qualification.verdict} — salva como pendente para revisão manual`);
    }
    return {
      ...normalized,
      metrics,
      trace: {
        selected_model: response.model,
        research_model: dossier.response.model,
        model_attempts: [
          ...dossier.response.attempts.map((attempt) => ({ ...attempt, phase: 'research_brief' })),
          ...mappingAttempts,
        ],
        sources: research.sources.map((source) => ({ url: source.url, relation: source.relation, trust: source.trust })),
        source_assessments: brief.source_assessments,
        research_plan: research.plan,
        research_brief: brief,
        qualification: brief.qualification,
        adjacent_failures: research.adjacentFailures,
      },
    };
  } catch (error) {
    error.metrics = addMetrics(error.metrics, metrics);
    throw error;
  }
}

// Campos onde vale a pena comparar texto novo com o que já está salvo — só
// os que carregam substância (não local/idioma/tipo, que raramente mudam e
// geram diferença de fiapo). Usado só pra decidir SE vale mandar de volta
// pra revisão, não pra decidir o valor final (isso a pessoa revisando faz).
const CONTENT_DIFF_FIELDS = ['description', 'eligibility', 'process', 'applicants', 'additionals', 'cost', 'deadline', 'audience'];

function fieldText(value) {
  return normalizedText(Array.isArray(value) ? value.join(' ') : String(value || ''));
}

// true quando a pesquisa nova trouxe conteúdo substancialmente diferente do
// que já está salvo em pelo menos um campo relevante. Caso real: re-pesquisar
// manualmente o Ross Program achou financial aid, processo de inscrição e
// dicas que a entrada antiga no catálogo não tinha — isso era descartado em
// silêncio só porque o link/título já existiam ("Duplicada").
function hasMeaningfulContentDiff(existing, extracted) {
  return CONTENT_DIFF_FIELDS.some((field) => {
    const newValue = fieldText(extracted[field]);
    if (!newValue) return false;
    const oldValue = fieldText(existing[field]);
    if (!oldValue) return true;
    return newValue !== oldValue;
  });
}

async function findOrCreateOpportunity(supabase, extracted, { refreshOnDuplicateDiff = false } = {}) {
  const discoveryKey = opportunityDiscoveryKey(extracted.link, extracted.title);
  const { data: exactKey, error: exactKeyError } = await supabase.from('opportunities').select('*').eq('sentinel_discovery_key', discoveryKey).maybeSingle();
  if (exactKeyError) throw exactKeyError;
  if (exactKey) return { opportunity: exactKey, created: false, updated: false, duplicateReason: 'Mesma chave de descoberta.' };

  const { data: candidates, error: candidatesError } = await supabase.from('opportunities').select('*').not('link', 'is', null);
  if (candidatesError) throw candidatesError;
  const existing = (candidates || []).find((candidate) => isDuplicateOpportunity(candidate, extracted));
  if (existing) {
    const newerEdition = isNewerEdition(existing, extracted);
    // O reaproveitamento de conteúdo "solto" (sem edição nova comprovada por
    // data) só roda quando alguém pediu EXPLICITAMENTE "confira essa URL de
    // novo" (a tela "Pesquisar uma URL", um item por vez) — não pro lote
    // automático da fila de sites (até 25 de uma vez, sem ninguém escolher
    // aquele item específico) nem pro Instagram. A redação da IA varia um
    // pouco a cada rodada, então sem essa distinção isso reabriria pra
    // revisão publicações já no ar toda vez que o scraper batesse nelas nos
    // lotes automáticos — barulho constante que ninguém pediu.
    const contentDiff = refreshOnDuplicateDiff && hasMeaningfulContentDiff(existing, extracted);
    if (newerEdition || contentDiff) {
      // Mesmo programa (duplicata confirmada): não cria linha nova — atualiza
      // a oportunidade antiga com o que a pesquisa achou agora e manda de
      // volta pra revisão, porque quem decide se o conteúdo novo está certo
      // é sempre uma pessoa.
      const refreshed = {
        title: extracted.title || existing.title,
        description: extracted.description || existing.description,
        link: canonicalizeOpportunityUrl(extracted.link) || existing.link,
        deadline: extracted.deadline || null,
        areas: extracted.areas?.length ? extracted.areas : existing.areas,
        level: extracted.level?.length ? extracted.level : existing.level,
        audience: extracted.audience?.length ? extracted.audience : existing.audience,
        location: extracted.location || existing.location,
        cost: extracted.cost || existing.cost,
        language: extracted.language || existing.language,
        keywords: extracted.keywords?.length ? normalizeKeywordTags(extracted.keywords) : existing.keywords,
        eligibility: Array.isArray(extracted.eligibility) ? extracted.eligibility.join('\n') : (extracted.eligibility || existing.eligibility),
        process: extracted.process || existing.process,
        applicants: extracted.applicants || existing.applicants,
        additionals: extracted.additionals || existing.additionals,
        status: 'Revisar',
        qualification_status: extracted.qualification_status === 'qualified' ? 'qualified' : 'pending',
        qualification_reason: extracted.qualification_reason || existing.qualification_reason,
        sentinel_discovery_key: discoveryKey,
      };
      const { data: refreshedRow, error: updateError } = await supabase.from('opportunities').update(refreshed).eq('id', existing.id).select().single();
      if (updateError) throw updateError;
      const editionLabel = editionYear(extracted);
      return {
        opportunity: refreshedRow,
        created: false,
        updated: true,
        duplicateReason: newerEdition
          ? `Nova edição encontrada${editionLabel ? ` (${editionLabel})` : ''} — conteúdo atualizado, revise antes de aprovar.`
          : 'Duplicata, mas a nova pesquisa achou informações diferentes das já salvas — conteúdo atualizado, revise antes de aprovar.',
      };
    }
    return { opportunity: existing, created: false, updated: false, duplicateReason: 'Mesmo link oficial e nome equivalente.' };
  }

  const row = {
    title: extracted.title, description: extracted.description || '', link: canonicalizeOpportunityUrl(extracted.link),
    deadline: extracted.deadline || null, areas: extracted.areas || [], level: extracted.level || [], audience: extracted.audience || [], location: extracted.location || null,
    cost: extracted.cost || null, language: extracted.language || null, keywords: normalizeKeywordTags(extracted.keywords || []),
    eligibility: Array.isArray(extracted.eligibility) ? extracted.eligibility.join('\n') : String(extracted.eligibility || ''),
    process: extracted.process || null, applicants: extracted.applicants || null,
    additionals: extracted.additionals || null,
    // Oportunidades novas SEMPRE entram em revisão humana, mesmo quando o
    // Sentinel já suspeita que o prazo passou (extracted.status === 'Encerrada').
    // Antes isso pulava a fila de revisão direto — se a leitura do prazo
    // estivesse errada, ninguém nunca via a oportunidade pra corrigir. O campo
    // deadline continua preenchido com o que o Sentinel encontrou, então quem
    // revisa já vê o prazo suspeito e decide se fecha ou corrige.
    resources: [], status: 'Revisar', review: null, type: extracted.type || 'Programas Acadêmicos',
    qualification_status: extracted.qualification_status === 'qualified' ? 'qualified' : 'pending',
    qualification_reason: extracted.qualification_reason || null,
    sentinel_discovery_key: discoveryKey,
  };
  const { data, error } = await supabase.from('opportunities').insert(row).select().single();
  if (error?.code === '23505') {
    const { data: raced } = await supabase.from('opportunities').select('*').eq('sentinel_discovery_key', discoveryKey).single();
    return { opportunity: raced, created: false, updated: false, duplicateReason: 'Outra execução criou a oportunidade primeiro.' };
  }
  if (error) throw error;
  return { opportunity: data, created: true, updated: false, duplicateReason: null };
}

async function updatePost(supabase, sourceUrl, patch) {
  const { error } = await supabase.from('sentinel_posts').update(patch).eq('source_url', sourceUrl);
  if (error) throw error;
}

export async function processPost(supabase, post, runId, manual = false, allowedTags = [], { refreshOnDuplicateDiff = false } = {}) {
  const sourceUrl = manual ? post.url : post.sourceUrl;
  const officialUrl = manual ? post.url : extractUrl(post.caption);
  try {
    const researched = await groundUrl(officialUrl || sourceUrl, post.caption, post.ownerUsername, manual, sourceUrl, allowedTags);
    if (!researched.result) {
      const now = new Date().toISOString();
      const motivo = researched.rejectionReason || 'A fonte não atende aos critérios da busca.';
      await updatePost(supabase, sourceUrl, {
        status: 'rejected', processed_at: now, updated_at: now, run_id: runId,
        error: motivo,
        extracted: { evidence: researched.evidence || {}, _sentinel: { ...researched.trace, validation_notes: researched.validationNotes || [] } },
      });
      return { status: 'rejected', error: motivo, metrics: researched.metrics };
    }
    const { opportunity, created, updated, duplicateReason } = await findOrCreateOpportunity(supabase, researched.result, { refreshOnDuplicateDiff });
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
    return { status, opportunity, created, updated, duplicateReason, metrics: researched.metrics };
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
  const accounts = await activeInstagramAccounts(supabase);
  if (!accounts.length) {
    // Nenhuma conta ativa = Instagram "desligado". Não chama a Apify, não
    // gasta nada, só registra a execução como vazia.
    await updateRun(supabase, runId, { requested_count: 0, metadata: { scraped: 0, new_posts: 0, queued_remaining: 0, instagram_accounts: 0 } });
    return {
      response: {
        scraped: 0, newPosts: 0, candidates: 0, qualified: 0, duplicates: 0, created: 0, rejected: 0, failed: 0, queued: 0,
        skippedKnownOpportunity: 0, skippedLowScore: 0, instagramAccounts: 0,
      },
      metrics: emptyMetrics(),
    };
  }
  if (!process.env.APIFY_API_KEY) throw new Error('APIFY_API_KEY não configurada no servidor.');
  const client = new ApifyClient({ token: process.env.APIFY_API_KEY });
  const actorRun = await client.actor('apify/instagram-scraper').call({
    addParentData: false,
    directUrls: accounts.map((account) => `https://www.instagram.com/${account}/`),
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

  // Triagem barata (sem IA, sem fetch de página) ANTES de gravar qualquer
  // coisa em sentinel_posts — mesma filosofia que os scrapers de site já
  // usam em coletarCandidatos (api/cron/scrape-sources.js), adaptada pra
  // legenda de Instagram (texto livre, não um título limpo):
  //
  //   1. Já existe algo muito parecido no catálogo? Compara os tokens do
  //      título de cada oportunidade já cadastrada contra a legenda inteira
  //      (discoveryTitleSimilarity, a mesma função que já protege contra
  //      duplicata depois da pesquisa). Só descarta aqui quando TODOS os
  //      tokens do título existente aparecem na legenda E esse título tem
  //      pelo menos 4 tokens — o mesmo critério conservador que o dedup
  //      final usa quando não há URL pra comparar. Prefere deixar passar um
  //      duvidoso (custa uma pesquisa a mais) a esconder uma oportunidade
  //      nova por engano.
  //   2. O coeficiente de relevância (scorePost) é negativo demais? Abaixo
  //      de MIN_DISCOVERY_SCORE a linha nem é criada — não fica "rejeitada"
  //      poluindo o histórico, simplesmente nunca existiu.
  //
  // Os dois cortes rodam só uma vez por execução, em memória — nenhuma
  // chamada extra de rede além da leitura de `title` já feita abaixo.
  const { data: opsExistentes, error: opsError } = await supabase.from('opportunities').select('title').not('title', 'is', null);
  if (opsError) throw opsError;
  const titulosConhecidos = (opsExistentes || []).map((row) => row.title).filter(Boolean);
  const jaEstaNoCatalogo = (caption, tituloJaAceitoNestaRodada) => {
    const candidatos = [...titulosConhecidos, ...tituloJaAceitoNestaRodada];
    return candidatos.some((titulo) => {
      const tokens = discoveryTitleTokens(titulo);
      return tokens.length >= 4 && discoveryTitleSimilarity(titulo, caption) === 1;
    });
  };

  const tituloJaAceitoNestaRodada = [];
  let skippedKnownOpportunity = 0;
  let skippedLowScore = 0;
  const scored = [];
  for (const post of fresh) {
    if (jaEstaNoCatalogo(post.caption, tituloJaAceitoNestaRodada)) { skippedKnownOpportunity += 1; continue; }
    const score = scorePost(post);
    if (score < MIN_DISCOVERY_SCORE) { skippedLowScore += 1; continue; }
    tituloJaAceitoNestaRodada.push(post.caption);
    scored.push({ ...post, score });
  }

  if (scored.length) {
    const { error } = await supabase.from('sentinel_posts').insert(scored.map((post) => ({
      source_url: post.sourceUrl, source_type: 'instagram', owner_username: post.ownerUsername,
      caption: post.caption, posted_at: post.timestamp, score: post.score, run_id: runId,
      status: discoveryScreeningStatus(post.score),
      error: null,
      processed_at: null,
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
  await updateRun(supabase, runId, {
    requested_count: candidates.length,
    metadata: {
      scraped: posts.length, new_posts: fresh.length, queued_remaining: queuedRemaining || 0,
      skipped_known_opportunity: skippedKnownOpportunity, skipped_low_score: skippedLowScore, instagram_accounts: accounts.length,
    },
  });
  const allowedTags = await activeOpportunityTagNames(supabase);
  const results = await withConcurrency(candidates, 3, (post) => processPost(supabase, post, runId, false, allowedTags));
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
      skippedKnownOpportunity, skippedLowScore, instagramAccounts: accounts.length,
    },
    metrics,
  };
}

export function discoveryCandidateLimit(body = {}) {
  if (body.allQueued === true) return MAX_DISCOVERY_CANDIDATES;
  return Math.max(1, Math.min(Number(body.maxCandidates) || 10, 25));
}

export function catalogReviewPrompt(opportunity, allowedTags = []) {
  const today = new Date().toISOString().slice(0, 10);
  return `Você converte o dossiê factual validado do Sentinel em correções para uma oportunidade já publicada. Hoje é ${today}. Compare os dados atuais com o dossiê e as fontes fornecidas. Não invente nem complete por conhecimento prévio. A etapa compartilhada de pesquisa já comparou a confiabilidade das fontes e decidiu a qualificação.

REGRAS OBRIGATÓRIAS PARA PRAZOS:
1. "deadline" é exclusivamente a data limite para enviar candidatura, inscrição, projeto ou indicação.
2. Data do evento, competição, cerimônia, resultado, viagem, início do programa, pagamento ou rodada NÃO é deadline. Frases como "will be held on", "takes place on", "event date" e "finals are on" nunca comprovam prazo.
3. Só proponha deadline quando a citação disser explicitamente deadline, applications close/due, registration closes/ends, submit by, register by, inscrições até, encerramento das inscrições, prazo ou expressão equivalente.
4. Não infira um prazo a partir do calendário. Se não houver data limite explícita, não altere deadline.
5. Prefira o ciclo atual ou futuro. Não misture datas de edições diferentes.
6. deadline deve ser uma data completa, com dia, mês e ano, no formato "D de mês de YYYY", sem zero à esquerda. Mês, estação ou ano isolado — como "agosto" ou "agosto de 2026" — não é deadline válido. Inscrições explicitamente contínuas são a única exceção sem data.
7. Se o prazo confirmado já passou, inclua também status "Encerrada". Se a fonte disser explicitamente que as inscrições estão fechadas, proponha status "Encerrada" mesmo sem uma data.
8. Se houver modalidades independentes, avalie todas antes de escolher deadline e status. Enquanto ao menos uma modalidade relevante aceitar inscrições, use o próximo prazo futuro dessa modalidade e não marque a oportunidade inteira como encerrada. Identifique a modalidade no texto. Só use "Encerrada" quando todas as formas relevantes de candidatura estiverem fechadas.

IDIOMA, CONDIÇÕES E TAXONOMIA:
- Todos os valores de updates devem estar em português brasileiro. Traduza custos, critérios, formatos e descrições. Preserve em inglês apenas nomes próprios e URLs.
- cost aceita SOMENTE "Gratuito", "Bolsa" ou "Totalmente Financiado" — nunca um valor em dinheiro nem uma frase com preço. Se o cost atual estiver como um valor monetário (ex.: "$850 por trimestre... bolsas disponíveis"), proponha a correção para a categoria certa: "Bolsa" se existe mensalidade real mas há bolsa/ajuda financeira/desconto disponível, "Totalmente Financiado" se a organização cobre tudo sem cobrança nenhuma, "Gratuito" se não há custo algum. Nunca proponha um cost com "$", "R$", "US$" ou qualquer número de preço.
- Em location, diferencie candidatura remota de evento ou final presencial. Uma sede presencial não prova que a candidatura deixou de ser remota; quando ambos forem relevantes, descreva as duas etapas. Se toda a oportunidade for remota, use exatamente "Remoto" e não inclua local.
- areas aceita somente: STEM, Humanas, Meio Ambiente, Linguagens, Artes. Classifique pelo tema da oportunidade, não pelas modalidades de envio.
- level aceita somente: Ensino Médio, Fundamental, Gap Year — escolha pelo pré-requisito exigido, não pelo público genérico ("jovens"/"youth"/"teen"). Ensino Médio = exige estar cursando o ensino médio agora. Fundamental = exige estar no fundamental agora. Gap Year = exige ensino médio JÁ CONCLUÍDO (ex.: "high school graduate", "completed secondary education", programa entre o ensino médio e a faculdade) — mesmo com idade parecida à de um aluno de ensino médio, se o pré-requisito é o ensino médio já concluído, corrija para Gap Year, não Ensino Médio. Revise esse campo também em oportunidades já existentes quando a fonte deixar claro qual dos dois é o caso.
- type aceita somente: Programas Acadêmicos, Olimpíadas Científicas, Competições, Competições de Escrita, Mentorias, Bolsas de Estudo, Programas de Intercâmbio, MUNs, Estágios.
- audience aceita SOMENTE estes valores, um ou mais quando comprovados: Negros, LGBT, Baixa Renda, Indígenas, Deficientes, Meninas, Escola Pública. Só proponha um valor quando a fonte exigir, priorizar ou direcionar explicitamente a oportunidade a esse público (cota, elegibilidade restrita, programa dedicado) — não infira a partir de linguagem genérica de diversidade/inclusão sem critério concreto, e remova valores existentes sem essa comprovação. Não repita nível escolar (isso é level) nem tema (isso é areas). Se for aberta a qualquer estudante, sem recorte, proponha lista vazia.
- Não inclua status, qualification_status nem qualification_reason em updates. A disponibilidade é calculada separadamente a partir dos prazos e a qualificação vem do veredito validado do dossiê; uma nunca substitui a outra.
- keywords deve ter de 3 a 8 nomes seletivos do vocabulário ativo, sobre temas, atividades, habilidades, entregáveis ou benefícios. Não use formato, idioma, custo, tipo, nível escolar ou público demográfico como tag.
${allowedTags.length ? `- Vocabulário ativo permitido para keywords: ${allowedTags.join(', ')}.` : ''}

QUALIDADE DO TEXTO:
- Escreva para estudantes e famílias, em linguagem simples, direta e sem tom promocional.
- Antes de propor updates, analise a oportunidade como um conjunto: cruze todos os dados atuais com todas as fontes. Não trate cada campo isoladamente. Use toda a informação disponível e coloque cada fato no campo em que ele acrescenta valor, sem repeti-lo em outros campos.
- Faça uma checagem explícita de todos os campos permitidos antes de responder. Corrija também valores existentes que sejam promocionais, desatualizados, não comprovados ou estejam no campo errado; não se limite ao deadline.
- Se o link atual for uma página lateral, de prêmio ou arquivo e a pesquisa encontrar a página oficial de candidatura/submissão, atualize link para essa página operacional.
- title deve conter apenas o nome oficial, sem chamadas promocionais.
- Remova o ano da edição do título se ele estiver lá (ex.: "Programa X 2026" vira "Programa X"), a não ser que seja parte permanente do nome oficial — o ano da edição atual já fica registrado em deadline.
- description deve dar ao estudante uma visão completa da oportunidade em texto corrido: o que é o programa, tema e formato, o que ele oferece de fato (financiamento, mentoria, certificado, viagem, prêmio, publicação, networking etc.) e a duração/estrutura das atividades — sem repetir regras de elegibilidade, passos de inscrição, prazo, custo ou local, que já têm campo próprio. Sem limite rígido de palavras (normalmente 60 a 150, em 3 a 6 frases); se a description atual for uma frase genérica e curta demais para dar essa visão completa, proponha uma versão mais rica.
${ELIGIBILITY_PROCESS_GUIDANCE}
- Ao revisar eligibility existente, proponha sua limpeza quando ele repetir outros campos, estiver abstrato ou trouxer itens que não sejam critérios de elegibilidade, mesmo que as informações estejam corretas.
- applicants deve trazer somente dicas específicas comprovadas pela fonte; se forem genéricas, use null.
- additionals deve conter apenas informação importante que não caiba nos outros campos.
- Não use reticências, placeholders, jargão corporativo nem frases como "orientações disponíveis no site".

Você também pode corrigir outros campos quando houver evidência clara. Campos permitidos: ${MODEL_REVIEW_FIELDS.join(', ')}.

Cada campo alterado DEVE ter evidência estruturada com uma citação literal copiada de uma das fontes e a URL exata dessa fonte. A citação permanece no idioma original da fonte; apenas o valor proposto deve estar em português. Para deadline, use kind "application_deadline"; para inscrições contínuas, "rolling_deadline".

Responda SOMENTE com JSON cru:
{"updates":{"eligibility":"Estar matriculado","keywords":["Inovação social","Gestão de projetos","Liderança"]},"evidence":{"eligibility":{"quote":"Applicants must be enrolled students.","source_url":"https://exemplo.org/apply","kind":"field_evidence"},"keywords":{"quote":"Participants develop social innovation projects and leadership skills.","source_url":"https://exemplo.org/program","kind":"field_evidence"}}}
Inclua em updates apenas campos que realmente devem mudar. Se nada mudar: {"updates":{},"evidence":{}}.

Dados atuais:
${JSON.stringify(Object.fromEntries(MODEL_REVIEW_FIELDS.map((field) => [field, opportunity[field]])))}`;
}

export function catalogCoverageFields(opportunity = {}, updates = {}, allowedTags = []) {
  const fields = [];
  const missing = (field) => !Object.prototype.hasOwnProperty.call(updates, field);
  // Antes isso marcava description pra revisão quando ela passava de 45
  // palavras (o antigo teto). Agora o objetivo é o oposto: description deve
  // ser rica o bastante pra contar tudo que o estudante precisa saber, então
  // o gatilho principal é o texto ser curto demais (abaixo do piso
  // esperado). Mantido também o sinal de texto degenerado/repetitivo (poucas
  // palavras únicas), que pega lixo tipo placeholder mesmo que "comprido".
  const descriptionWords = String(opportunity.description || '').trim().split(/\s+/).filter(Boolean);
  const descriptionUniqueRatio = descriptionWords.length ? new Set(descriptionWords.map((w) => w.toLowerCase())).size / descriptionWords.length : 1;
  const descriptionTooThin = descriptionWords.length < 40;
  const descriptionDegenerate = descriptionWords.length >= 10 && descriptionUniqueRatio < 0.4;
  if (missing('description') && (descriptionTooThin || descriptionDegenerate)) fields.push('description');
  if (missing('language') && !String(opportunity.language || '').trim()) fields.push('language');
  const keywordCandidate = missing('keywords') ? (opportunity.keywords || []) : updates.keywords;
  const normalizedKeywords = normalizeKeywordTags(keywordCandidate, allowedTags);
  if (normalizedKeywords.length < 3 || normalizedKeywords.length > 8
    || !equalValue(normalizedKeywords, keywordCandidate || [])) fields.push('keywords');
  if (missing('process') && (!String(opportunity.process || '').trim() || ENGLISH_CATALOG_PATTERN.test(String(opportunity.process || ''))
    || String(opportunity.process || '').split(/[.!?]+/).filter((part) => part.trim()).length > 5)) fields.push('process');
  if (missing('applicants') && String(opportunity.applicants || '').length > 220) fields.push('applicants');
  const rawEligibility = String(opportunity.eligibility || '').trim();
  const eligibilityLines = rawEligibility.split(/\r?\n|;\s*/).map((line) => line.trim()).filter(Boolean);
  const abstractEligibility = eligibilityLines.some((line) => line.split(/\s+/).filter(Boolean).length > 14)
    || /(?:podem participar|sao convidados|processo seletivo|interessad[oa]s?|para defend[eê]-?l[oa]s?)/i.test(normalizedText(rawEligibility));
  const misplacedEligibility = /(?:qualquer\s+(?:lugar|pais|parte)\s+do\s+mundo|em\s+ingles|US\$|taxa|\d[.,]?\d{3}\s*palavras?|enviar|inscrever|formulario|projeto de lei|processo seletivo)/i
    .test(normalizedText(rawEligibility));
  const eligibilityNeedsRewrite = abstractEligibility || misplacedEligibility;
  if (missing('eligibility') && eligibilityNeedsRewrite) fields.push('eligibility');
  if (eligibilityNeedsRewrite && missing('process') && !fields.includes('process')) fields.push('process');
  if (missing('status') && opportunity.status === 'Revisar') fields.push('status');
  if (missing('type') && normalizedText(opportunity.type) === 'competicoes'
    && /\b(?:ensaio|redacao|escrita|essay|writing)\b/.test(normalizedText(`${opportunity.title} ${opportunity.description}`))) fields.push('type');
  return fields;
}

export function researchBriefPrompt(opportunity, plan = buildOpportunityResearchPlan(opportunity)) {
  return `Você é a etapa de pesquisa factual do Sentinel. Reúna os fatos da oportunidade como um todo ANTES de pensar nos campos do catálogo Access+.

REGRAS:
- Trate a fonte inicial como uma pista, não como automaticamente oficial. Compare autoria, ligação com a organização, edição e atualidade de todas as fontes.
- Em conflitos, priorize nesta ordem: regulamento ou página de candidatura da organização na edição vigente; anúncio vigente da organização; canal social oficial; plataforma externa ligada pela organização; fonte independente; agregador ou post social não verificado. Registre o conflito mesmo depois de resolvê-lo.
- Percorra todos os tópicos do plano e combine informações complementares entre página principal, edição vigente, notícia, regulamento e formulário.
- Prefira a edição atual ou futura e identifique claramente quando uma informação pertence a outra edição ou modalidade.
- Diferencie prazo de inscrição, prazo de entrega posterior, resultado e data do evento.
- Quando houver modalidades independentes, registre separadamente o prazo e o estado de cada uma; não trate o encerramento de uma modalidade como encerramento de todas.
- Não converta os fatos em campos do catálogo, não resuma por campo e não descarte fatos só porque parecem redundantes nesta etapa.
- Cada fato deve ter uma citação literal curta e a URL exata da fonte.
- Registre todos os fatos materiais encontrados, não apenas datas. Quando houver informação, cubra elegibilidade, formato, custo, idioma, processo, entrega exigida, benefícios e dicas específicas.
- Copie a citação como um trecho contínuo e literal da fonte, sem juntar frases distantes nem reescrever palavras; citações não literais serão descartadas.
- Registre lacunas e conflitos explicitamente; não invente respostas.
- A única regra de qualificação é: existe uma interseção não vazia entre quem pode participar e jovens brasileiros. Basta que ao menos um grupo de jovens brasileiros seja elegível; a oportunidade não precisa atender a todos os jovens do Brasil.
- Restrições de estado, cidade, escola, rede de ensino, série, idade ou outra característica não desqualificam a oportunidade quando o grupo resultante ainda contém jovens brasileiros. Por exemplo, estudantes de escolas cearenses do 8º ano ao 3º ano do ensino médio qualificam.
- Use qualification.verdict "qualified" com citação literal que, isoladamente ou em conjunto, comprove a elegibilidade de algum grupo jovem e seu alcance ao Brasil ou a uma localidade brasileira. Se esses fatos estiverem em trechos diferentes, inclua ambos em qualification.evidence. Use "unqualified" quando a fonte mais confiável excluir todos os jovens brasileiros, quando nenhum jovem puder participar, OU quando a fonte mais confiável mostrar que o programa é operado por/para um país ou região específica sem qualquer menção a alcance internacional — por exemplo: nome da organização é um capítulo nacional específico (ex.: "FAWE Ghana", "Cruz Vermelha Portuguesa"), a inscrição exige comparecer pessoalmente a um escritório em outro país, os "parceiros"/instituições de destino são descritos como locais/nacionais, ou o texto trata implicitamente o público como cidadãos de um único país (sem nunca mencionar critério de nacionalidade justamente porque é óbvio pelo contexto que só se aplica a esse país). Nesses casos, mesmo sem uma frase explícita de exclusão, o padrão do programa (escopo nacional único, zero sinal de alcance internacional em nenhuma fonte) já é evidência suficiente de exclusão — não deixe como "uncertain" só porque falta uma frase literal dizendo "apenas cidadãos de X". Use "uncertain" quando faltar prova, houver conflito não resolvido, ou o programa genuinamente não deixar claro se tem escopo nacional ou internacional.
- Escreva qualification.reason em português brasileiro, mesmo quando as fontes estiverem em outro idioma.

PLANO DE PESQUISA:
${plan.map((topic) => `- ${topic.id}: ${topic.question}`).join('\n')}

Responda SOMENTE com JSON cru:
{"facts":[{"topic":"deadline_status","fact":"As inscrições foram prorrogadas.","quote":"Inscrições prorrogadas até 19/06/2026","source_url":"https://exemplo.org/edicao-2026"}],"qualification":{"verdict":"qualified","reason":"Aceita jovens de todos os países.","evidence":[{"quote":"Young people from all countries may apply","source_url":"https://exemplo.org/rules"}]},"source_assessments":[{"source_url":"https://exemplo.org/rules","authority":"official_rules_or_application","reason":"Regulamento da edição vigente"}],"gaps":[],"conflicts":[]}

Oportunidade atual:
${JSON.stringify({ title: opportunity.title, link: opportunity.link, deadline: opportunity.deadline, status: opportunity.status })}`;
}

export function normalizeResearchBrief(rawBrief, sources, plan = []) {
  const allowedTopics = new Set(plan.map((topic) => topic.id));
  const facts = (Array.isArray(rawBrief?.facts) ? rawBrief.facts : []).flatMap((rawFact) => {
    const quote = String(rawFact?.quote || '').trim();
    const sourceUrl = String(rawFact?.source_url || '').trim();
    const source = sources.find((item) => sameSourceUrl(item.url, sourceUrl));
    const fact = String(rawFact?.fact || '').trim();
    const topic = String(rawFact?.topic || '').trim();
    if (!fact || !quote || !source || !comparableEvidenceText(source.text).includes(comparableEvidenceText(quote))) return [];
    return [{
      topic: allowedTopics.has(topic) ? topic : 'current_cycle',
      fact,
      quote,
      source_url: source.url,
    }];
  });
  const cleanList = (value) => (Array.isArray(value) ? value : [])
    .map((item) => String(item || '').trim()).filter(Boolean).slice(0, 12);
  const qualification = normalizeQualification(rawBrief?.qualification, sources);
  const modelAssessments = new Map((Array.isArray(rawBrief?.source_assessments) ? rawBrief.source_assessments : [])
    .map((item) => [String(item?.source_url || ''), item]));
  const sourceAssessments = sources.map((source) => {
    const model = [...modelAssessments.entries()].find(([url]) => sameSourceUrl(url, source.url))?.[1] || {};
    const authority = String(model.authority || source.trust?.authority || 'third_party_or_unverified');
    const preliminaryRank = Number(source.trust?.trust_rank || 0);
    const authorityRank = AUTHORITY_TRUST_RANK[authority] ?? preliminaryRank;
    return {
      source_url: source.url,
      authority,
      trust_rank: Math.min(preliminaryRank, authorityRank),
      discovered_from: source.trust?.discovered_from || null,
      reason: String(model.reason || '').trim(),
    };
  }).sort((a, b) => b.trust_rank - a.trust_rank);
  return {
    facts: facts.slice(0, 30), qualification, source_assessments: sourceAssessments,
    gaps: cleanList(rawBrief?.gaps), conflicts: cleanList(rawBrief?.conflicts),
  };
}

export function normalizeQualification(rawQualification, sources = []) {
  const requested = String(rawQualification?.verdict || '').toLowerCase();
  const rawEvidence = Array.isArray(rawQualification?.evidence) ? rawQualification.evidence : [];
  const evidence = rawEvidence.flatMap((item) => {
    const quote = String(item?.quote || '').trim();
    const sourceUrl = String(item?.source_url || '').trim();
    const source = sources.find((candidate) => sameSourceUrl(candidate.url, sourceUrl));
    if (!quote || !source || !comparableEvidenceText(source.text).includes(comparableEvidenceText(quote))) return [];
    return [{ quote, source_url: source.url, trust_rank: Number(source.trust?.trust_rank || 0) }];
  }).sort((a, b) => b.trust_rank - a.trust_rank);
  const combined = normalizedText(evidence.map((item) => item.quote).join(' '));
  let verdict = QUALIFICATION_VERDICTS.has(requested) ? requested : 'uncertain';

  // Rede de segurança determinística: procura um campo de escopo geográfico
  // ("Country:", "Programme Regions:", "Citizenship requirement:" etc.) que
  // não indica alcance Brasil/internacional — primeiro na própria evidence
  // (citação já validada contra a fonte), depois no texto bruto de cada
  // fonte (cobre o caso do modelo devolver evidence vazio ou mal citado
  // mesmo com o dado de exclusão presente na página).
  const scopeQuoteFromEvidence = combined ? findScopeRestrictionQuote(combined) : null;
  const structuralExclusion = scopeQuoteFromEvidence
    ? { quote: scopeQuoteFromEvidence, source_url: evidence[0]?.source_url, trust_rank: evidence[0]?.trust_rank || 0 }
    : findGeographicExclusionEvidence(sources);

  if (!evidence.length) verdict = structuralExclusion ? 'unqualified' : 'uncertain';
  // Antes exigíamos também POSITIVE_PARTICIPATION_PATTERN (uma palavra tipo
  // "eligible"/"open to"/"participate" na MESMA citação) — mas isso rejeitava
  // repetidamente citações reais que já combinam alcance + público jovem sem
  // usar uma dessas palavras específicas: "students from around the world are
  // welcome" (Euler Circle) e "Young people aged 18 to 30 from any country"
  // (Young Feminist AI School) foram os dois casos que expuseram o problema —
  // ambos comprovam elegibilidade claramente, só que com frases diferentes.
  // reach + youth já É a descrição de quem pode participar; a garantia contra
  // falso-positivo passa a ser PARTICIPATION_EXCLUSION_PATTERN (any sinal de
  // "only"/"exclusively"/"must be a citizen of" na citação invalida mesmo
  // com reach+youth presentes — cobre o caso "international students, mas só
  // os já matriculados numa universidade americana").
  if (verdict === 'qualified' && !((BRAZIL_REACH_PATTERN.test(combined) || BRAZIL_LOCAL_REACH_PATTERN.test(combined))
    && YOUTH_PARTICIPATION_PATTERN.test(combined)
    && !BRAZIL_EXCLUSION_PATTERN.test(combined)
    && !PARTICIPATION_EXCLUSION_PATTERN.test(combined))) verdict = 'uncertain';
  if (verdict === 'unqualified' && !PARTICIPATION_EXCLUSION_PATTERN.test(combined) && !structuralExclusion) verdict = 'uncertain';
  // Se achamos um campo de escopo geográfico restritivo e o veredito não é
  // "unqualified" ainda, ele vence — é um sinal factual (rótulo estruturado
  // da própria fonte), não uma inferência do modelo.
  if (structuralExclusion && verdict !== 'unqualified') verdict = 'unqualified';

  const finalEvidence = evidence.length
    ? evidence
    : (structuralExclusion ? [structuralExclusion] : evidence);
  const downgraded = verdict === 'uncertain' && requested !== 'uncertain';
  return {
    verdict,
    reason: verdict === 'unqualified' && structuralExclusion && !String(rawQualification?.reason || '').trim()
      ? `Fonte indica escopo geográfico restrito: "${structuralExclusion.quote}".`
      : downgraded
        ? 'As citações coletadas não comprovam que ao menos um grupo de jovens brasileiros pode participar.'
        : String(rawQualification?.reason || (verdict === 'uncertain' ? 'As fontes não comprovam que jovens brasileiros podem participar.' : '')).trim(),
    evidence: finalEvidence,
  };
}

export function qualificationCatalogPatch(qualification, opportunity = {}) {
  const verdict = QUALIFICATION_VERDICTS.has(qualification?.verdict) ? qualification.verdict : 'uncertain';
  // A research gap must not downgrade an existing catalog entry. Only affirmative
  // evidence can qualify or unqualify; availability is handled from deadlines.
  if (verdict === 'uncertain') return {};
  const qualificationStatus = verdict === 'qualified' ? 'qualified' : 'unqualified';
  const rawReason = String(qualification?.reason || '').trim();
  const genericReason = 'As fontes indicam que jovens brasileiros não podem participar.';
  const patch = {
    qualification_status: qualificationStatus,
    qualification_reason: verdict === 'qualified'
      ? null
      : (rawReason && isPortugueseCatalogValue('qualification_reason', rawReason) ? rawReason : genericReason),
  };
  if (verdict === 'unqualified') patch.status = 'Rascunho';
  return patch;
}

export function qualificationAtomicSelection(fields = [], changes = {}) {
  const selected = [...new Set(fields)];
  if (!changes.qualification_status) return selected;
  const decisionFields = ['qualification_status', 'qualification_reason'];
  const touchesDecision = selected.some((field) => decisionFields.includes(field))
    || (selected.includes('status') && ['pending', 'unqualified'].includes(changes.qualification_status?.after));
  if (!touchesDecision) return selected;
  return [...new Set([
    ...selected,
    ...decisionFields.filter((field) => changes[field]),
    ...(changes.status ? ['status'] : []),
  ])];
}

export async function researchOpportunityDossier({ url, opportunity = {}, leadSource = null }) {
  const research = await fetchResearchSources(url, opportunity);
  if (leadSource?.url && leadSource?.text
    && !research.sources.some((source) => sameSourceUrl(source.url, leadSource.url))) {
    research.sources.push(annotateResearchSource({
      url: leadSource.url,
      text: String(leadSource.text),
      relation: leadSource.relation || 'Pista de origem',
      depth: -1,
    }, { primaryUrl: url, depth: -1 }));
  }
  const response = await callStructuredModel(
    researchBriefPrompt(opportunity, research.plan),
    `${sourcesForPrompt(research.sources)}\n\nRetorne o dossiê factual agora.`,
    { maxTokens: 3072 },
  );
  const brief = normalizeResearchBrief(response.parsed, research.sources, research.plan);
  research.sources = research.sources.map((source) => {
    const assessment = brief.source_assessments.find((item) => sameSourceUrl(item.source_url, source.url));
    return assessment
      ? { ...source, trust: { ...source.trust, authority: assessment.authority, trust_rank: assessment.trust_rank } }
      : source;
  });
  brief.qualification.evidence = brief.qualification.evidence
    .map((item) => {
      const assessment = brief.source_assessments.find((source) => sameSourceUrl(source.source_url, item.source_url));
      return assessment ? { ...item, trust_rank: assessment.trust_rank } : item;
    })
    .sort((a, b) => b.trust_rank - a.trust_rank);
  return {
    research,
    brief,
    response,
    metrics: addMetrics({ ...emptyMetrics(), pageFetches: research.pageFetches }, response.metrics),
  };
}

function tagSlug(value) {
  return String(value || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
}

export function normalizeKeywordTags(value, allowedNames = []) {
  const raw = Array.isArray(value) ? value : String(value || '').split(/[,;\n]/);
  const allowed = new Map(allowedNames.map((name) => [normalizedText(name), String(name).trim()]));
  const result = [];
  for (const item of raw) {
    const display = String(item || '').trim();
    const slug = tagSlug(display);
    if (!slug || TAG_EXCLUSIONS.has(slug)) continue;
    if (/^(?:remot[oa]|online|virtual|presencial|hibrid[oa]|ingles|portugues|espanhol|frances|gratuit[oa]|gratis|pago|ensino-|fundamental|gap-year|programa-academico|olimpiada-cientifica|competicao|mentoria|bolsa-de-estudo|programa-de-intercambio|mun|estagio)(?:-|s$|$)/.test(slug)) continue;
    if (/^(?:jovens?|estudantes?|meninas?|mulheres?|negros?|indigenas?|lgbt|baixa-renda)$/.test(slug)) continue;
    const canonical = allowed.size ? allowed.get(normalizedText(display)) : display;
    if (!canonical || result.some((existing) => normalizedText(existing) === normalizedText(canonical))) continue;
    result.push(canonical);
    if (result.length === 8) break;
  }
  return result;
}

export function normalizeLocationForCatalog(value) {
  const raw = String(value || '').trim();
  const semantic = normalizedText(raw);
  const remote = /\b(?:remot[oa]|online|virtual|a distancia)\b/.test(semantic);
  const physical = /\b(?:presencial|hibrid[oa]|sede|campus|cidade|estado|viagem|final presencial|atividades presenciais)\b/.test(semantic);
  return remote && !physical ? 'Remoto' : raw;
}

function normalizeUpdate(field, value) {
  if (value == null) return undefined;
  if (ARRAY_FIELDS.has(field)) {
    if (!Array.isArray(value)) return undefined;
    const normalized = field === 'keywords'
      ? normalizeKeywordTags(value)
      : value.map((item) => String(item).trim()).filter(Boolean);
    if (CONTROLLED_VALUES[field] && normalized.some((item) => !CONTROLLED_VALUES[field].has(item))) return undefined;
    return normalized;
  }
  if (typeof value !== 'string') return undefined;
  if (LINE_LIST_FIELDS.has(field)) {
    return normalizeLineList(value) || undefined;
  }
  const normalized = field === 'deadline'
    ? normalizeDeadlineOutput(value)
    : field === 'location' ? normalizeLocationForCatalog(value) : value.trim();
  if (field === 'deadline' && !isAcceptableDeadlineOutput(normalized)) return undefined;
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

// O site só existe pra achar bolsas/oportunidades gratuitas/financiadas —
// "cost" é um FILTRO de verdade na home (D.filters em src/lib/data.js),
// com só 3 opções: Gratuito, Bolsa, Totalmente Financiado. Um valor fora
// dessas 3 (ex.: "$850 por trimestre... bolsas de estudo disponíveis")
// quebra dois lugares ao mesmo tempo: o filtro na home nunca bate com esse
// texto (some da busca por "Gratuito"/"Bolsa"), e o <select> do editor
// (que só tem essas 3 opções) não consegue mostrar nem editar um valor que
// não é nenhuma delas — parece "travado" pra quem tenta corrigir.
// Precisa mapear qualquer descrição solta pra uma dessas 3 categorias, nunca
// deixar passar valor monetário cru.
export const COST_CANONICAL_VALUES = ['Gratuito', 'Bolsa', 'Totalmente Financiado'];
const COST_MONEY_PATTERN = /[$€£]|\br\$|\b\d[\d.,]*\s*(?:usd|eur|brl|reais?|d[oó]lares?|euros?)\b|\b(?:mensalidade|matr[ií]cula|tuition|fee|taxa)\b.{0,20}\d/i;
const COST_FREE_PATTERN = /\bgratuit[oa]|\bfree\b|sem custo|sem nenhum custo|zero cost|no cost/i;
const COST_FULLY_FUNDED_PATTERN = /totalmente financiad[oa]|fully[\s-]?funded|todas as despesas|all expenses (?:paid|covered)|cobre (?:todas as|todos os) (?:despesas|custos)/i;
const COST_SCHOLARSHIP_PATTERN = /\bbolsa|scholarship|ajuda financeira|financial aid|isen[cç][aã]o|desconto por (?:necessidade|m[eé]rito)|need-based/i;

export function normalizeCostForCatalog(rawCost) {
  const value = String(rawCost || '').trim();
  if (!value) return null;
  if (COST_CANONICAL_VALUES.some((canonical) => normalizedText(canonical) === normalizedText(value))) return value;
  const hasMoney = COST_MONEY_PATTERN.test(value);
  const hasFree = COST_FREE_PATTERN.test(value);
  const hasFullyFunded = COST_FULLY_FUNDED_PATTERN.test(value);
  const hasScholarship = COST_SCHOLARSHIP_PATTERN.test(value);
  // Tem valor em dinheiro real (mensalidade, matrícula etc.) — só vira
  // "Bolsa" se a mesma fonte também confirmar algum tipo de ajuda/desconto;
  // sem isso, não dá pra classificar como nenhuma das 3 (é um programa
  // pago sem nenhuma indicação de bolsa) — melhor descartar o campo do que
  // fingir que é "Gratuito" ou "Totalmente Financiado".
  if (hasMoney) return hasScholarship ? 'Bolsa' : null;
  if (hasFullyFunded) return 'Totalmente Financiado';
  if (hasFree) return 'Gratuito';
  if (hasScholarship) return 'Bolsa';
  return null;
}

export function normalizeEligibilityForCatalog(value, language, opportunity = {}) {
  const opportunityTitle = normalizedText(opportunity.title || opportunity.titulo);
  const eligibilityText = normalizedText(value);
  const isCamaraMirimSchool = opportunityTitle.includes('camara mirim')
    && /5\s*[ºo°]?\s*(?:ao|a|ate|-)\s*9\s*[ºo°]?\s*ano\s+do\s+ensino\s+fundamental/i.test(eligibilityText);
  if (isCamaraMirimSchool) return 'Estar entre o 5º e 9º ano do Ensino Fundamental';
  const englishIsSeparate = normalizedText(language).includes('ingles');
  const parentheticalLinesCollapsed = String(value || '').replace(/\([^)]*\)/gs, (match) => match.replace(/\s*\r?\n\s*/g, ' '));
  const items = parentheticalLinesCollapsed.replace(/\(\s*autor(?:a)?\s+[\u00fau]nic[oa]\s*\)/gi, '; Ser autor \u00fanico')
    .split(/\r?\n|;\s*|(?<=[.!?])\s+/)
    .map((item) => item.replace(/^\s*(?:[-*â€¢]|\d+[.)])\s*/, '').trim())
    .map((item) => /^Qualquer\s+estudante/i.test(item)
      ? item.replace(/^Qualquer\s+estudante/i, 'Ser estudante').replace(/\s+do\s+mundo\b/i, '').trim()
      : item)
    .map((item) => item.replace(/,?\s*brasileiros?\s+ou\s+estrangeiros?/i, '').replace(/\s+,/g, ',').trim())
    .flatMap((item) => item.split(/,\s+e\s+(?=n[aã]o\s+|ter\s+|estar\s+)/i))
    .map((item) => {
      const semanticItem = normalizedText(item);
      if (/^(?:ser|poder ser|aceitar)\s+(?:de\s+)?qualquer\s+(?:lugar|pais|parte)\s+do\s+mundo\.?$/i.test(semanticItem)) return '';
      if (/^(?:estudantes?|candidat[oa]s?|participantes?)?\s*internacionais?.{0,50}(?:elegiveis?|podem participar|podem se inscrever)/i.test(semanticItem)) return '';
      if (/^(?:presencial|remot[oa]|online|virtual|idioma|em ingles|atividades? presenciais?)/i.test(semanticItem)) return '';
      if (/^(?:inscricoes?|candidaturas?|prazo|deadline|preencher|enviar|anexar|pagar|taxa|custo|valor)\b/i.test(semanticItem)) return '';
      if (/(?:palavras?|turabian|endnotes?|bibliografia)/i.test(semanticItem)) return '';
      if (/^nao\s+publicado\s+antes\s+em\s+escola\s+secundaria$/i.test(semanticItem)) return '';
      if (/^autor(?:a)?\s+unic[oa]$/i.test(semanticItem)) return 'Ser autor \u00fanico';
      if (!englishIsSeparate) return item;
      if (/^(?:saber|falar|dominar|ter\s+fluencia\s+em)\s+ingles\.?$/i.test(normalizedText(item))) return '';
      if (/^(?:escrever|redigir|produzir|enviar).{0,50}\bem\s+ingles\.?$/i.test(normalizedText(item))) return '';
      if (/^(?:o\s+)?(?:trabalho|ensaio|texto)\s+(?:deve\s+ser\s+)?em\s+ingles\.?$/i.test(normalizedText(item))) return '';
      const publicationRule = item.match(/^(?:o\s+)?(?:trabalho|ensaio|texto)\s+(?:deve\s+ser\s+)?em\s+ingl[eê]s\s+e\s+n[aã]o\s+(?:ter\s+sido\s+)?publicado\s*(.*)$/i);
      if (publicationRule) return `Não ter o trabalho publicado${publicationRule[1] ? ` ${publicationRule[1]}` : ''}`.trim();
      return item;
    })
    .filter(Boolean);
  return normalizeLineList(items.join('\n'));
}

export function resolveProposalPatch(fields, proposed, requestedEdits = {}, allowedTags = []) {
  const patch = {};
  const editorFields = [];
  for (const field of fields) {
    if (!Object.prototype.hasOwnProperty.call(requestedEdits, field)) {
      patch[field] = field === 'deadline'
        ? (proposed[field] == null ? null : normalizeDeadlineOutput(proposed[field]))
        : proposed[field];
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
    const normalized = field === 'keywords' ? normalizeKeywordTags(raw, allowedTags) : normalizeUpdate(field, raw);
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
  const raw = String(value || '').trim();
  const parts = parseDateParts(raw);
  if (parts) return `${parts.day} de ${PORTUGUESE_MONTH_NAMES[parts.month]} de ${parts.year}`;
  return raw.replace(/\b0([1-9])(?=\s+de\s+(?:janeiro|fevereiro|março|marco|abril|maio|junho|julho|agosto|setembro|outubro|novembro|dezembro)\b)/gi, '$1');
}

const COMPLETE_DEADLINE_PATTERN = /^(\d{1,2})\s+de\s+(janeiro|fevereiro|março|marco|abril|maio|junho|julho|agosto|setembro|outubro|novembro|dezembro)\s+de\s+(20\d{2})$/i;
const ROLLING_DEADLINE_VALUE_PATTERN = /^(?:continuo|rolling|inscricoes?\s+continuas?|prazo\s+continuo|fluxo\s+continuo)$/i;

export function isCompleteDeadlineOutput(value) {
  const normalized = normalizeDeadlineOutput(value);
  const match = normalized.match(COMPLETE_DEADLINE_PATTERN);
  if (!match) return false;
  const parts = parseDateParts(normalized);
  if (!parts) return false;
  const candidate = new Date(Date.UTC(parts.year, parts.month - 1, parts.day));
  return candidate.getUTCFullYear() === parts.year
    && candidate.getUTCMonth() === parts.month - 1
    && candidate.getUTCDate() === parts.day;
}

export function isAcceptableDeadlineOutput(value) {
  const normalized = normalizeDeadlineOutput(value);
  return isCompleteDeadlineOutput(normalized) || ROLLING_DEADLINE_VALUE_PATTERN.test(normalizedText(normalized));
}

export function vagueDeadlineChange(value) {
  if (value == null || value === '' || isAcceptableDeadlineOutput(value)) return null;
  return { before: value, after: null };
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

function comparableEvidenceText(value) {
  return normalizedText(decodeHtmlEntities(value)).replace(/[^a-z0-9]+/g, ' ').trim();
}

const MONTH_NUMBERS = {
  january: 1, janeiro: 1, february: 2, fevereiro: 2, march: 3, marco: 3,
  april: 4, abril: 4, may: 5, maio: 5, june: 6, junho: 6, july: 7, julho: 7,
  august: 8, agosto: 8, september: 9, setembro: 9, october: 10, outubro: 10,
  november: 11, novembro: 11, december: 12, dezembro: 12,
};
const PORTUGUESE_MONTH_NAMES = {
  1: 'janeiro', 2: 'fevereiro', 3: 'março', 4: 'abril', 5: 'maio', 6: 'junho',
  7: 'julho', 8: 'agosto', 9: 'setembro', 10: 'outubro', 11: 'novembro', 12: 'dezembro',
};
const MONTH_PATTERN = Object.keys(MONTH_NUMBERS).join('|');

function fullDateMentions(value) {
  const text = normalizedText(value);
  const mentions = [];
  const patterns = [
    { regex: new RegExp(`\\b(\\d{1,2})(?:st|nd|rd|th)?\\s+(?:de\\s+)?(${MONTH_PATTERN})\\s*(?:de|,)?\\s*(20\\d{2})\\b`, 'g'), order: 'day-first' },
    { regex: new RegExp(`\\b(${MONTH_PATTERN})\\s+(\\d{1,2})(?:st|nd|rd|th)?(?:,)?\\s+(20\\d{2})\\b`, 'g'), order: 'month-first' },
    { regex: /\b(\d{1,2})[\/.\-](\d{1,2})[\/.\-](20\d{2})\b/g, order: 'numeric-day-first' },
  ];
  for (const { regex, order } of patterns) {
    let match;
    while ((match = regex.exec(text))) {
      const parts = order === 'day-first'
        ? { day: Number(match[1]), month: MONTH_NUMBERS[match[2]], year: Number(match[3]) }
        : order === 'month-first'
          ? { day: Number(match[2]), month: MONTH_NUMBERS[match[1]], year: Number(match[3]) }
          : { day: Number(match[1]), month: Number(match[2]), year: Number(match[3]) };
      mentions.push({ parts, index: match.index });
    }
  }
  return mentions.filter(({ parts }) => {
    const candidate = new Date(Date.UTC(parts.year, parts.month - 1, parts.day));
    return candidate.getUTCFullYear() === parts.year
      && candidate.getUTCMonth() === parts.month - 1
      && candidate.getUTCDate() === parts.day;
  });
}

function dayMonthMentions(value) {
  const text = normalizedText(value);
  const mentions = [];
  const patterns = [
    { regex: new RegExp(`\\b(\\d{1,2})(?:st|nd|rd|th)?\\s+(?:de\\s+)?(${MONTH_PATTERN})\\b`, 'g'), order: 'day-first' },
    { regex: new RegExp(`\\b(${MONTH_PATTERN})\\s+(\\d{1,2})(?:st|nd|rd|th)?\\b`, 'g'), order: 'month-first' },
    { regex: /\b(\d{1,2})[\/.\-](\d{1,2})(?![\/.\-]\d{2,4})\b/g, order: 'numeric-day-first' },
  ];
  for (const { regex, order } of patterns) {
    let match;
    while ((match = regex.exec(text))) {
      const parts = order === 'day-first'
        ? { day: Number(match[1]), month: MONTH_NUMBERS[match[2]] }
        : order === 'month-first'
          ? { day: Number(match[2]), month: MONTH_NUMBERS[match[1]] }
          : { day: Number(match[1]), month: Number(match[2]) };
      mentions.push({ parts, index: match.index });
    }
  }
  return mentions;
}

export function parseDateParts(value) {
  const text = normalizedText(value);
  let match = text.match(/\b(\d{1,2})[\/.\-](\d{1,2})[\/.\-](20\d{2})\b/);
  if (match) return { day: Number(match[1]), month: Number(match[2]), year: Number(match[3]) };
  match = text.match(new RegExp(`\\b(\\d{1,2})(?:st|nd|rd|th)?\\s+(?:de\\s+)?(${MONTH_PATTERN})\\s*(?:de|,)?\\s*(\\d{4})\\b`));
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

const DEADLINE_EVIDENCE_PATTERN = /\b(?:application\s+deadline|deadline\s+(?:for\s+)?(?:applications?|registration|submissions?)|applications?\s+(?:close|closes|due)|registration\s+(?:close|closes|ends|deadline)|submissions?\s+(?:close|closes|due)|submit(?:ted)?\s+by|register\s+by|due\s+(?:by|on)|(?:periodo\s+(?:para|de)\s+)?inscri(?:cao|coes).{0,90}(?:ate|encerra|encerram|termina|terminam|prazo|periodo|de\s+\d{1,4})|prazo.{0,30}inscri(?:cao|coes)|(?:encerramento|termino)\s+das\s+inscricoes|data\s+limite.{0,30}(?:inscri|candidat|projeto)|formularios?.{0,50}(?:submetid|enviad).{0,20}ate)\b/;
const ROLLING_EVIDENCE_PATTERN = /\b(?:rolling|open\s+year[- ]round|accepted\s+throughout|inscricoes\s+continuas|fluxo\s+continuo)\b/;
const REGISTRATION_RANGE_PATTERN = /\binscri(?:cao|coes)\b[^.!?;]{0,35}?(\d{1,2})[\/.\-](\d{1,2})(?:[\/.\-](20\d{2}))?\s*(?:a|ate|ao|[-\u2013\u2014])\s*(\d{1,2})[\/.\-](\d{1,2})(?:[\/.\-](20\d{2}))?/g;
const REGISTRATION_WRITTEN_RANGE_PATTERN = new RegExp(`\\b(?:periodo\\s+(?:para|de)\\s+)?inscri(?:cao|coes)\\b[^.!?;]{0,140}?\\bde\\s+(\\d{1,2})(?:st|nd|rd|th)?\\s+(?:de\\s+)?(${MONTH_PATTERN})\\s*(?:de|,)?\\s*(20\\d{2})?\\s*(?:a|ate|ao|[-\\u2013\\u2014])\\s*(\\d{1,2})(?:st|nd|rd|th)?\\s+(?:de\\s+)?(${MONTH_PATTERN})\\s*(?:de|,)?\\s*(20\\d{2})?\\b`, 'g');
const REVERSED_REGISTRATION_RANGE_PATTERN = /(\d{1,2})[\/.\-](\d{1,2})(?:[\/.\-](20\d{2}))?\s*(?:a|ate|ao|[-\u2013\u2014])\s*(\d{1,2})[\/.\-](\d{1,2})(?:[\/.\-](20\d{2}))?[^.!?;]{0,180}\b(?:periodo[^.!?;]{0,120})?inscri(?:cao|coes)\b/g;
const DATE_BEFORE_DEADLINE_LABEL_PATTERN = /(\d{1,2})[\/.\-](\d{1,2})(?:[\/.\-](20\d{2}))?\s*(?:[-\u2013\u2014:]\s*)?(?:(?:termino|encerramento|fim|prazo final)[^.!?;]{0,55}inscri(?:cao|coes)|(?:application|registration)\s+deadline)\b/g;
const CLOSED_APPLICATION_PATTERN = /\b(?:applications?|registration|submissions?|inscri(?:ção|ções|cao|coes))\b[^.!?]{0,100}\b(?:closed|encerrad[ao]s?|finalizad[ao]s?|no longer\s+(?:open|accepted))\b/i;

function sourceDeadlineWindows(source) {
  const text = String(source?.text || '');
  const normalized = normalizedText(text);
  const pattern = new RegExp(DEADLINE_EVIDENCE_PATTERN.source, 'g');
  const windows = [];
  let match;
  while ((match = pattern.exec(normalized))) {
    const start = Math.max(0, match.index - 140);
    const end = Math.min(text.length, match.index + match[0].length + 180);
    windows.push(text.slice(start, end).trim());
  }
  return windows;
}

function deadlineLinkedMentions(value, mentions) {
  const text = normalizedText(value);
  const markerPattern = new RegExp(DEADLINE_EVIDENCE_PATTERN.source, 'g');
  const linked = [];
  let marker;
  while ((marker = markerPattern.exec(text))) {
    const markerEnd = marker.index + marker[0].length;
    const ranked = mentions
      .map((mention) => {
        const between = text.slice(Math.min(mention.index, markerEnd), Math.max(mention.index, markerEnd));
        return {
          ...mention,
          crossesBoundary: /[.!?;]/.test(between),
          distance: Math.min(Math.abs(mention.index - marker.index), Math.abs(mention.index - markerEnd))
            + (mention.index < marker.index ? 80 : 0),
        };
      })
      .filter((mention) => !mention.crossesBoundary)
      .filter((mention) => mention.distance <= 160)
      .sort((a, b) => a.distance - b.distance);
    if (ranked[0]) linked.push(ranked[0]);
  }
  return linked;
}

function evidenceDateMatches(proposedValue, quote, sourceText = quote) {
  const proposedDate = parseDateParts(proposedValue);
  if (!proposedDate) return false;
  const rangePattern = new RegExp(REGISTRATION_RANGE_PATTERN.source);
  const range = rangePattern.exec(normalizedText(quote));
  if (range) {
    const rangeYear = Number(range[6] || range[3]) || contextualYearForQuote(quote, sourceText);
    if (proposedDate.day === Number(range[4]) && proposedDate.month === Number(range[5]) && proposedDate.year === rangeYear) {
      return true;
    }
  }
  const writtenRange = new RegExp(REGISTRATION_WRITTEN_RANGE_PATTERN.source).exec(normalizedText(quote));
  if (writtenRange) {
    const rangeYear = Number(writtenRange[6] || writtenRange[3]) || contextualYearForQuote(quote, sourceText);
    if (proposedDate.day === Number(writtenRange[4]) && proposedDate.month === MONTH_NUMBERS[writtenRange[5]] && proposedDate.year === rangeYear) {
      return true;
    }
  }
  const reversedRange = new RegExp(REVERSED_REGISTRATION_RANGE_PATTERN.source).exec(normalizedText(quote));
  if (reversedRange) {
    const rangeYear = Number(reversedRange[6] || reversedRange[3]) || contextualYearForQuote(quote, sourceText);
    if (proposedDate.day === Number(reversedRange[4]) && proposedDate.month === Number(reversedRange[5]) && proposedDate.year === rangeYear) {
      return true;
    }
  }
  const dateBeforeLabel = new RegExp(DATE_BEFORE_DEADLINE_LABEL_PATTERN.source).exec(normalizedText(quote));
  if (dateBeforeLabel) {
    const year = Number(dateBeforeLabel[3]) || contextualYearForQuote(quote, sourceText);
    if (proposedDate.day === Number(dateBeforeLabel[1]) && proposedDate.month === Number(dateBeforeLabel[2]) && proposedDate.year === year) {
      return true;
    }
  }
  const linkedFullDates = deadlineLinkedMentions(quote, fullDateMentions(quote));
  if (linkedFullDates.some((mention) => equalValue(mention.parts, proposedDate))) return true;
  const linkedPairs = deadlineLinkedMentions(quote, dayMonthMentions(quote));
  const pairMatches = linkedPairs.some(({ parts }) => parts.day === proposedDate.day && parts.month === proposedDate.month);
  if (!pairMatches) return false;
  const normalizedSource = normalizedText(sourceText);
  const normalizedQuote = normalizedText(quote);
  const quoteIndex = normalizedSource.indexOf(normalizedQuote);
  const context = quoteIndex >= 0
    ? normalizedSource.slice(Math.max(0, quoteIndex - 240), quoteIndex + normalizedQuote.length + 240)
    : normalizedSource;
  return new RegExp(`\\b${proposedDate.year}\\b`).test(context);
}

function validDateParts(parts) {
  if (!parts?.day || !parts?.month || !parts?.year) return false;
  const candidate = new Date(Date.UTC(parts.year, parts.month - 1, parts.day));
  return candidate.getUTCFullYear() === parts.year
    && candidate.getUTCMonth() === parts.month - 1
    && candidate.getUTCDate() === parts.day;
}

function contextualYearForQuote(quote, sourceText, opportunity = {}) {
  const quoteYears = [...normalizedText(quote).matchAll(/\b(20\d{2})\b/g)].map((match) => Number(match[1]));
  if (quoteYears.length) return quoteYears[0];
  const normalizedSource = normalizedText(sourceText);
  const normalizedQuote = normalizedText(quote);
  const quoteIndex = normalizedSource.indexOf(normalizedQuote);
  if (quoteIndex >= 0) {
    const contextStart = Math.max(0, quoteIndex - 260);
    const context = normalizedSource.slice(contextStart, quoteIndex + normalizedQuote.length + 260);
    const nearbyYears = [...context.matchAll(/\b(20\d{2})\b/g)]
      .map((match) => ({ year: Number(match[1]), distance: Math.abs(contextStart + match.index - quoteIndex) }))
      .sort((a, b) => a.distance - b.distance);
    if (nearbyYears[0]) return nearbyYears[0].year;
  }
  const opportunityYear = String(opportunity.title || '').match(/\b(20\d{2})\b/)?.[1];
  if (opportunityYear) return Number(opportunityYear);
  const sourceYears = [...new Set([...normalizedSource.matchAll(/\b(20\d{2})\b/g)].map((match) => Number(match[1])))];
  return sourceYears.length === 1 ? sourceYears[0] : null;
}

function deadlineCandidatesFromSources(sources, opportunity = {}) {
  const candidates = [];
  const addCandidate = (source, quote, parts) => {
    if (!validDateParts(parts)) return;
    const value = `${parts.day} de ${PORTUGUESE_MONTH_NAMES[parts.month]} de ${parts.year}`;
    candidates.push({ value, quote, source_url: source.url, kind: 'application_deadline', parts });
  };
  for (const source of sources || []) {
    for (const quote of sourceDeadlineWindows(source)) {
      const normalizedQuote = normalizedText(quote);
      if (new RegExp(REGISTRATION_RANGE_PATTERN.source).test(normalizedQuote)
        || new RegExp(REGISTRATION_WRITTEN_RANGE_PATTERN.source).test(normalizedQuote)
        || new RegExp(REVERSED_REGISTRATION_RANGE_PATTERN.source).test(normalizedQuote)
        || new RegExp(DATE_BEFORE_DEADLINE_LABEL_PATTERN.source).test(normalizedQuote)) continue;
      for (const { parts } of deadlineLinkedMentions(quote, fullDateMentions(quote))) {
        if (evidenceDateMatches(`${parts.day} de ${PORTUGUESE_MONTH_NAMES[parts.month]} de ${parts.year}`, quote, source.text)) {
          addCandidate(source, quote, parts);
        }
      }
      for (const { parts } of deadlineLinkedMentions(quote, dayMonthMentions(quote))) {
        const year = contextualYearForQuote(quote, source.text, opportunity);
        if (year) addCandidate(source, quote, { ...parts, year });
      }
    }
    const normalizedSource = normalizedText(source.text);
    const rangePattern = new RegExp(REGISTRATION_RANGE_PATTERN.source, 'g');
    let range;
    while ((range = rangePattern.exec(normalizedSource))) {
      const quote = normalizedSource.slice(Math.max(0, range.index - 80), Math.min(normalizedSource.length, range.index + range[0].length + 80));
      const year = Number(range[6] || range[3]) || contextualYearForQuote(quote, source.text, opportunity);
      if (year) addCandidate(source, quote, { day: Number(range[4]), month: Number(range[5]), year });
    }
    const writtenRangePattern = new RegExp(REGISTRATION_WRITTEN_RANGE_PATTERN.source, 'g');
    while ((range = writtenRangePattern.exec(normalizedSource))) {
      const quote = normalizedSource.slice(Math.max(0, range.index - 80), Math.min(normalizedSource.length, range.index + range[0].length + 80));
      const year = Number(range[6] || range[3]) || contextualYearForQuote(quote, source.text, opportunity);
      if (year) addCandidate(source, quote, { day: Number(range[4]), month: MONTH_NUMBERS[range[5]], year });
    }
    const reversedRangePattern = new RegExp(REVERSED_REGISTRATION_RANGE_PATTERN.source, 'g');
    while ((range = reversedRangePattern.exec(normalizedSource))) {
      const quote = normalizedSource.slice(Math.max(0, range.index - 80), Math.min(normalizedSource.length, range.index + range[0].length + 80));
      const year = Number(range[6] || range[3]) || contextualYearForQuote(quote, source.text, opportunity);
      if (year) addCandidate(source, quote, { day: Number(range[4]), month: Number(range[5]), year });
    }
    const dateBeforeLabelPattern = new RegExp(DATE_BEFORE_DEADLINE_LABEL_PATTERN.source, 'g');
    while ((range = dateBeforeLabelPattern.exec(normalizedSource))) {
      const quote = normalizedSource.slice(Math.max(0, range.index - 80), Math.min(normalizedSource.length, range.index + range[0].length + 120));
      const year = Number(range[3]) || contextualYearForQuote(quote, source.text, opportunity);
      if (year) addCandidate(source, quote, { day: Number(range[1]), month: Number(range[2]), year });
    }
  }
  return [...new Map(candidates.map((candidate) => [`${candidate.source_url}|${candidate.value}`, candidate])).values()];
}

export function findUnambiguousDeadlineEvidence(sources) {
  const candidates = deadlineCandidatesFromSources(sources);
  const uniqueValues = [...new Set(candidates.map((candidate) => candidate.value))];
  if (uniqueValues.length !== 1) return null;
  const { parts: _parts, ...evidence } = candidates.find((candidate) => candidate.value === uniqueValues[0]);
  return evidence;
}

export function findRelevantDeadlineEvidence(sources, today = new Date(), opportunity = {}) {
  const candidates = deadlineCandidatesFromSources(sources, opportunity);
  const unique = [...new Map(candidates.map((candidate) => [candidate.value, candidate])).values()];
  const current = Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate());
  const future = unique
    .filter(({ parts }) => Date.UTC(parts.year, parts.month - 1, parts.day) >= current)
    .sort((a, b) => Date.UTC(a.parts.year, a.parts.month - 1, a.parts.day) - Date.UTC(b.parts.year, b.parts.month - 1, b.parts.day));
  const chosen = future[0] || unique.sort((a, b) => Date.UTC(b.parts.year, b.parts.month - 1, b.parts.day) - Date.UTC(a.parts.year, a.parts.month - 1, a.parts.day))[0];
  if (!chosen) return null;
  const { parts: _parts, ...evidence } = chosen;
  return evidence;
}

export function findRollingDeadlineEvidence(sources) {
  for (const source of sources || []) {
    const normalizedSource = normalizedText(source.text);
    const match = normalizedSource.match(ROLLING_EVIDENCE_PATTERN);
    if (!match) continue;
    const sentenceStart = Math.max(normalizedSource.lastIndexOf('.', match.index) + 1, match.index - 120);
    const nextPeriod = normalizedSource.indexOf('.', match.index + match[0].length);
    const sentenceEnd = nextPeriod >= 0 ? nextPeriod + 1 : Math.min(normalizedSource.length, match.index + match[0].length + 120);
    return {
      value: 'Inscrições contínuas',
      quote: normalizedSource.slice(sentenceStart, sentenceEnd).trim(),
      source_url: source.url,
      kind: 'rolling_deadline',
    };
  }
  return null;
}

export function findExplicitClosedApplications(sources, opportunity = {}) {
  const opportunityYears = new Set(String(opportunity.title || '').match(/\b20\d{2}\b/g) || []);
  for (const source of sources || []) {
    const match = String(source.text || '').match(CLOSED_APPLICATION_PATTERN);
    if (!match) continue;
    const quoteYears = new Set(match[0].match(/\b20\d{2}\b/g) || []);
    if (opportunityYears.size === 1 && quoteYears.size === 1 && [...opportunityYears][0] !== [...quoteYears][0]) continue;
    return { quote: match[0].trim(), source_url: source.url, kind: 'closed_applications' };
  }
  return null;
}

function findGeneralParticipationEvidence(sources) {
  for (const source of sources || []) {
    const sentences = String(source.text || '').split(/(?<=[.!?])\s+/);
    const quote = sentences.find((sentence) => /\b(?:qualquer\s+estudante|podem\s+participar|abert[ao]\s+a\s+(?:alunos|estudantes)|students?.{0,120}\beligible)\b/.test(normalizedText(sentence)));
    if (quote) return { quote: quote.trim().slice(0, 500), source_url: source.url, kind: 'general_participation' };
  }
  return null;
}

export function findEligibilityEvidence(sources, proposedValue = '') {
  const desiredNumbers = String(proposedValue).match(/\b\d{1,2}\b/g) || [];
  for (const source of sources || []) {
    const sentences = String(source.text || '').split(/(?<=[.!?])\s+/);
    const candidates = sentences
      .map((sentence, index) => ({ sentence, index, text: normalizedText(sentence) }))
      .filter(({ text }) => /\b(?:student|estudante|author|autor|professor|educador|eligible|eligibility|matriculad|ensino\s+fundamental|secondary\s+school|college|university)\b/.test(text))
      .sort((left, right) => {
        const score = ({ text }) => desiredNumbers.filter((number) => new RegExp('\\b' + number + '\\b').test(text)).length;
        return score(right) - score(left);
      });
    const index = candidates[0]?.index ?? -1;
    if (index >= 0) {
      return {
        quote: sentences.slice(index, index + 3).join(' ').trim().slice(0, 800),
        source_url: source.url,
        kind: 'eligibility_cleanup',
      };
    }
  }
  return null;
}

export function findProcessEvidence(sources) {
  for (const source of sources || []) {
    const sentences = String(source.text || '').split(/(?<=[.!?])\s+/);
    const index = sentences.findIndex((sentence) => /\b(?:inscri|candidat|application|apply|register|registration|submit|submission|formulario|cadastre|cadastro)\b/.test(normalizedText(sentence)));
    if (index >= 0) {
      return {
        quote: sentences.slice(index, index + 2).join(' ').trim().slice(0, 800),
        source_url: source.url,
        kind: 'process_evidence_recovered',
      };
    }
  }
  return null;
}

function findWritingCompetitionEvidence(sources) {
  for (const source of sources || []) {
    const sentences = String(source.text || '').split(/(?<=[.!?])\s+/);
    const quote = sentences.find((sentence) => /\b(?:essay|essays|ensaio|ensaios|writing|redacao)\b/.test(normalizedText(sentence)));
    if (quote) return { quote: quote.trim().slice(0, 500), source_url: source.url, kind: 'writing_competition' };
  }
  return null;
}

function findOfficialApplicationSource(sources, currentUrl) {
  let current;
  try { current = new URL(currentUrl); } catch { return null; }
  if (!/(?:page-\d+|prize|award|premio|arquivo|archive)/i.test(current.pathname)) return null;
  return (sources || [])
    .filter((source) => {
      try {
        const target = new URL(source.url);
        return comparableHost(target.hostname) === comparableHost(current.hostname)
          && /\b(?:submit|submission|apply|application|inscri)/i.test(`${source.relation} ${target.pathname}`);
      } catch { return false; }
    })
    .sort((left, right) => {
      const leftExact = /\/submit\/?$/i.test(new URL(left.url).pathname) ? 1 : 0;
      const rightExact = /\/submit\/?$/i.test(new URL(right.url).pathname) ? 1 : 0;
      return rightExact - leftExact || left.url.length - right.url.length;
    })[0] || null;
}

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
  if (!comparableEvidenceText(source.text).includes(comparableEvidenceText(quote))) {
    return { valid: false, reason: 'a citação não foi encontrada literalmente na fonte' };
  }
  const evidence = {
    quote,
    source_url: source.url,
    kind: String(rawEvidence.kind || 'field_evidence'),
    summary_pt: evidenceSummary(field, proposedValue),
  };
  const semanticQuote = normalizedText(quote);
  if (field === 'language' && !/\b(?:idioma|language|portugues|english|ingles|espanhol|spanish|frances|french)\b/.test(semanticQuote)) {
    return { valid: false, reason: 'a citaÃ§Ã£o nÃ£o informa o idioma' };
  }
  if (field === 'process' && !/\b(?:inscri|candidat|application|apply|register|registration|submit|submission|formulario|cadastre|cadastro|pagamento|payment)\b/.test(semanticQuote)) {
    return { valid: false, reason: 'a citaÃ§Ã£o nÃ£o comprova o processo de inscriÃ§Ã£o' };
  }
  if (field === 'eligibility' && !/\b(?:student|estudante|author|autor|eligible|eligibility|elegivel|matriculad|idade|school|university|college|residencia|resident|aluno|alunos|crianca|criancas|adolescente|adolescentes|fundamental|medio|serie|ano escolar|podem participar|pode participar|cursando|grade|graduate|citizen|cidada|national|nationality|nacionalidade|resides?|living in|morar|reside|born|nascido)\b/.test(semanticQuote)) {
    return { valid: false, reason: 'a citaÃ§Ã£o nÃ£o comprova critÃ©rios de elegibilidade' };
  }
  if (field !== 'deadline') return { valid: true, evidence };

  const proposedText = normalizedText(proposedValue);
  const quoteText = normalizedText(quote);
  const rolling = ROLLING_DEADLINE_VALUE_PATTERN.test(proposedText);
  if (rolling) {
    if (!ROLLING_EVIDENCE_PATTERN.test(quoteText)) {
      return { valid: false, reason: 'a fonte não confirma inscrições contínuas' };
    }
    evidence.kind = 'rolling_deadline';
    return { valid: true, evidence };
  }
  if (!DEADLINE_EVIDENCE_PATTERN.test(quoteText) && !(new RegExp(REGISTRATION_RANGE_PATTERN.source)).test(quoteText)) {
    return { valid: false, reason: 'a citação descreve uma data, mas não um prazo de inscrição' };
  }
  if (!evidenceDateMatches(proposedValue, quote, source.text)) {
    return { valid: false, reason: 'a data proposta não corresponde à data citada' };
  }
  evidence.kind = 'application_deadline';
  return { valid: true, evidence };
}

export async function researchExistingOpportunity(supabase, runId, opportunity, allowedTags = []) {
  const original = Object.fromEntries(REVIEW_FIELDS.map((field) => [field, opportunity[field]]));
  if (!opportunity.link) {
    const row = {
      run_id: runId, opportunity_id: opportunity.id, status: 'failed', original,
      error: 'A oportunidade não tem link oficial para pesquisa.',
    };
    if (supabase) {
      const { error } = await supabase.from('sentinel_research_proposals').upsert(row, { onConflict: 'run_id,opportunity_id' });
      if (error) throw error;
    }
    return { status: 'failed', metrics: emptyMetrics(), row };
  }
  let stage = 'Planejamento e coleta de fontes oficiais';
  let metrics = emptyMetrics();
  let modelAttempts = [];
  try {
    stage = 'Síntese factual da pesquisa';
    const dossier = await researchOpportunityDossier({ url: opportunity.link, opportunity });
    const { research, brief: researchBrief, response: briefResponse } = dossier;
    metrics = dossier.metrics;
    modelAttempts = briefResponse.attempts.map((attempt) => ({ ...attempt, phase: 'research_brief' }));
    stage = 'Conversão do dossiê para o catálogo';
    const prompt = catalogReviewPrompt(opportunity, allowedTags)
      .replace('"DD de mês de YYYY"', '"D de mês de YYYY", sem zero à esquerda')
      .concat('\n\nFORMATO OBRIGATÓRIO: escreva "4 de setembro de 2026", nunca "04 de setembro de 2026".');
    let response;
    try {
      response = await callStructuredModel(prompt, `PLANO EXECUTADO:\n${JSON.stringify(research.plan)}\n\nDOSSIÊ FACTUAL VALIDADO:\n${JSON.stringify(researchBrief)}\n\nFONTES COMPLETAS COM PROVENIÊNCIA:\n${sourcesForPrompt(research.sources)}\n\nConverta somente agora o conjunto da pesquisa nos campos do catálogo e retorne o JSON de auditoria.`);
    } catch (error) {
      error.modelAttempts = [...modelAttempts, ...(error.modelAttempts || []).map((attempt) => ({ ...attempt, phase: 'catalog_mapping' }))];
      throw error;
    }
    metrics = addMetrics(metrics, response.metrics);
    modelAttempts = [...modelAttempts, ...response.attempts.map((attempt) => ({ ...attempt, phase: 'catalog_mapping' }))];
    stage = 'Validação e gravação da proposta';
    let parsed = response.parsed;
    let coverageFailure = '';
    const coverageFields = catalogCoverageFields(opportunity, parsed.updates || {}, allowedTags);
    if (coverageFields.length) {
      try {
        const coverageResponse = await callStructuredModel(
          `${prompt}\n\nCHECAGEM FINAL: responda apenas sobre estes campos ainda problemáticos: ${coverageFields.join(', ')}. Considere o dossiê inteiro e não repita fatos entre eles.`,
          `PRIMEIRA PROPOSTA:\n${JSON.stringify(parsed)}\n\nDOSSIÊ FACTUAL VALIDADO:\n${JSON.stringify(researchBrief)}\n\nFONTES COMPLETAS COM PROVENIÊNCIA:\n${sourcesForPrompt(research.sources)}\n\nCorrija somente os campos listados na checagem final, com citações literais.`,
        );
        metrics = addMetrics(metrics, coverageResponse.metrics);
        modelAttempts = [...modelAttempts, ...coverageResponse.attempts.map((attempt) => ({ ...attempt, phase: 'coverage_audit' }))];
        const coverageUpdates = Object.fromEntries(Object.entries(coverageResponse.parsed.updates || {})
          .filter(([field]) => coverageFields.includes(field)));
        const coverageEvidence = Object.fromEntries(Object.entries(coverageResponse.parsed.evidence || {})
          .filter(([field]) => coverageFields.includes(field)));
        parsed = {
          ...parsed,
          updates: { ...(parsed.updates || {}), ...coverageUpdates },
          evidence: { ...(parsed.evidence || {}), ...coverageEvidence },
          notes: [parsed.notes, coverageResponse.parsed.notes].filter(Boolean).join(' '),
        };
      } catch (error) {
        if (error.metrics) metrics = addMetrics(metrics, error.metrics);
        modelAttempts = [...modelAttempts, ...(error.modelAttempts || []).map((attempt) => ({ ...attempt, phase: 'coverage_audit' }))];
        coverageFailure = String(error.message || error);
      }
    }
    const proposed = {};
    const changes = {};
    const evidence = {};
    const validationNotes = coverageFailure ? [`checagem de cobertura falhou: ${coverageFailure}`] : [];
    for (const field of MODEL_REVIEW_FIELDS) {
      if (!Object.prototype.hasOwnProperty.call(parsed.updates || {}, field)) continue;
      const rawUpdate = parsed.updates[field];
      let normalized = rawUpdate === null && !REQUIRED_TEXT_FIELDS.has(field) && field !== 'deadline'
        ? null
        : field === 'keywords' ? normalizeKeywordTags(rawUpdate, allowedTags) : normalizeUpdate(field, rawUpdate);
      if (normalized === undefined) {
        validationNotes.push(`${field} descartado: valor fora da taxonomia aceita`);
        continue;
      }
      if (field === 'keywords' && allowedTags.length && normalized.length < 3) {
        validationNotes.push('keywords descartado: a checagem final não encontrou ao menos 3 tags canônicas');
        continue;
      }
      if (field === 'eligibility' && normalized !== null) {
        normalized = normalizeEligibilityForCatalog(
          normalized,
          parsed.updates?.language ?? original.language,
          opportunity,
        ) || null;
      }
      if (field === 'cost' && normalized !== null) {
        normalized = normalizeCostForCatalog(normalized) || null;
        if (!normalized) {
          validationNotes.push('cost descartado: valor proposto não indica gratuidade, bolsa ou financiamento total');
          continue;
        }
      }
      if (!isPortugueseCatalogValue(field, normalized)) {
        validationNotes.push(`${field} descartado: o valor proposto não está em português`);
        continue;
      }
      if (equalValue(normalized, original[field])) continue;
      if (field === 'deadline' && specificity(normalized) < specificity(original[field])) continue;
      let checkedEvidence = validateFieldEvidence(field, normalized, parsed.evidence?.[field], research.sources);
      if (!checkedEvidence.valid && field === 'eligibility') {
        const recoveredEvidence = findEligibilityEvidence(research.sources, normalized);
        if (recoveredEvidence) checkedEvidence = validateFieldEvidence(field, normalized, recoveredEvidence, research.sources);
      }
      if (!checkedEvidence.valid && field === 'process') {
        const recoveredEvidence = findProcessEvidence(research.sources);
        if (recoveredEvidence) checkedEvidence = validateFieldEvidence(field, normalized, recoveredEvidence, research.sources);
      }
      if (!checkedEvidence.valid) {
        validationNotes.push(`${field} descartado: ${checkedEvidence.reason}`);
        continue;
      }
      proposed[field] = normalized;
      changes[field] = { before: original[field] ?? null, after: normalized };
      evidence[field] = checkedEvidence.evidence;
    }
    const primarySourceUrl = research.sources[0]?.url;
    if (!changes.link && primarySourceUrl
      && canonicalizeOpportunityUrl(primarySourceUrl) !== canonicalizeOpportunityUrl(original.link)) {
      proposed.link = primarySourceUrl;
      changes.link = { before: original.link ?? null, after: primarySourceUrl };
      evidence.link = {
        source_url: primarySourceUrl,
        kind: 'official_redirect',
        summary_pt: 'O endereÃ§o oficial redirecionou permanentemente para esta pÃ¡gina.',
      };
      validationNotes.push('link atualizado para o destino oficial do redirecionamento');
    }
    const applicationSource = !changes.link ? findOfficialApplicationSource(research.sources, original.link) : null;
    if (applicationSource && canonicalizeOpportunityUrl(applicationSource.url) !== canonicalizeOpportunityUrl(original.link)) {
      proposed.link = applicationSource.url;
      changes.link = { before: original.link ?? null, after: applicationSource.url };
      evidence.link = {
        source_url: applicationSource.url,
        kind: 'official_application_page',
        summary_pt: 'PÃ¡gina oficial de submissÃ£o encontrada durante a pesquisa.',
      };
      validationNotes.push('link atualizado para a pÃ¡gina oficial de candidatura ou submissÃ£o');
    }
    const cleanedEligibility = normalizeEligibilityForCatalog(
      original.eligibility,
      proposed.language ?? original.language,
      opportunity,
    );
    if (!changes.eligibility && cleanedEligibility && !equalValue(cleanedEligibility, original.eligibility)) {
      const eligibilityEvidence = findEligibilityEvidence(research.sources, cleanedEligibility);
      if (eligibilityEvidence) {
        proposed.eligibility = cleanedEligibility;
        changes.eligibility = { before: original.eligibility ?? null, after: cleanedEligibility };
        evidence.eligibility = {
          ...eligibilityEvidence,
          summary_pt: 'Elegibilidade limpa para manter apenas critérios objetivos e mover orientações para o processo.',
        };
        validationNotes.push('eligibility limpa com base no conjunto dos campos e nas regras oficiais');
      }
    }
    const writingType = 'Competi\u00e7\u00f5es de Escrita';
    const writingOpportunity = normalizedText(original.type) === 'competicoes'
      && /\b(?:ensaios?|redacao|escrita|essays?|writing)\b/.test(normalizedText(`${original.title} ${original.description}`));
    if (!changes.type && writingType && writingOpportunity) {
      const writingEvidence = findWritingCompetitionEvidence(research.sources);
      if (writingEvidence) {
        proposed.type = writingType;
        changes.type = { before: original.type ?? null, after: writingType };
        evidence.type = {
          ...writingEvidence,
          summary_pt: 'A oportunidade seleciona e publica trabalhos escritos.',
        };
        validationNotes.push('type especializado como competiÃ§Ã£o de escrita');
      }
    }
    const recoveredDeadline = findRelevantDeadlineEvidence(research.sources, new Date(), opportunity);
    let confirmedDeadline = null;
    let confirmedDeadlineEvidence = null;
    const shouldRecoverDeadline = recoveredDeadline && (!changes.deadline
      || (isPastDate(proposed.deadline) && !isPastDate(recoveredDeadline.value)));
    if (shouldRecoverDeadline) {
      const checkedEvidence = validateFieldEvidence('deadline', recoveredDeadline.value, recoveredDeadline, research.sources);
      if (checkedEvidence.valid) {
        confirmedDeadline = recoveredDeadline.value;
        confirmedDeadlineEvidence = checkedEvidence.evidence;
        if (!equalValue(recoveredDeadline.value, original.deadline)) {
          proposed.deadline = recoveredDeadline.value;
          changes.deadline = { before: original.deadline ?? null, after: recoveredDeadline.value };
          evidence.deadline = checkedEvidence.evidence;
          validationNotes.push('deadline completo recuperado diretamente da fonte oficial');
        }
      }
    }
    const recoveredRollingDeadline = !changes.deadline && !isAcceptableDeadlineOutput(original.deadline)
      ? findRollingDeadlineEvidence(research.sources)
      : null;
    if (recoveredRollingDeadline) {
      const checkedEvidence = validateFieldEvidence('deadline', recoveredRollingDeadline.value, recoveredRollingDeadline, research.sources);
      if (checkedEvidence.valid) {
        proposed.deadline = recoveredRollingDeadline.value;
        changes.deadline = { before: original.deadline ?? null, after: recoveredRollingDeadline.value };
        evidence.deadline = checkedEvidence.evidence;
        validationNotes.push('inscriÃ§Ãµes contÃ­nuas recuperadas diretamente da fonte oficial');
      }
    }
    const vagueDeadline = !changes.deadline && vagueDeadlineChange(original.deadline);
    if (vagueDeadline) {
      proposed.deadline = null;
      changes.deadline = vagueDeadline;
      evidence.deadline = {
        kind: 'invalid_catalog_value',
        summary_pt: `Prazo vago removido: "${original.deadline}" não informa dia, mês e ano.`,
      };
      validationNotes.push('deadline vago removido porque não informa uma data completa');
    }
    const effectiveConfirmedDeadline = changes.deadline ? proposed.deadline : confirmedDeadline;
    const effectiveDeadlineEvidence = evidence.deadline || confirmedDeadlineEvidence;
    const statusChange = effectiveConfirmedDeadline && expiredStatusChange(effectiveConfirmedDeadline, original.status);
    if (statusChange) {
      proposed.status = 'Encerrada';
      changes.status = statusChange;
      evidence.status = {
        ...effectiveDeadlineEvidence,
        kind: 'expired_deadline',
        summary_pt: `Inscrições marcadas como encerradas porque o prazo ${effectiveConfirmedDeadline} já passou.`,
      };
      validationNotes.push('status marcado como Encerrada porque o prazo confirmado já passou');
    }
    const hasActiveDeadline = (isCompleteDeadlineOutput(effectiveConfirmedDeadline) && !isPastDate(effectiveConfirmedDeadline))
      || ROLLING_DEADLINE_VALUE_PATTERN.test(normalizedText(effectiveConfirmedDeadline));
    if (hasActiveDeadline && changes.status?.after === 'Encerrada') {
      delete proposed.status;
      delete changes.status;
      delete evidence.status;
      validationNotes.push('status Encerrada descartado porque ainda existe uma modalidade com inscrições abertas');
    }
    if (hasActiveDeadline && ['Encerrada', 'Revisar'].includes(original.status) && !changes.status) {
      proposed.status = 'Aprovada';
      changes.status = { before: original.status, after: 'Aprovada' };
      evidence.status = {
        ...effectiveDeadlineEvidence,
        kind: 'active_deadline',
        summary_pt: `O prazo ${effectiveConfirmedDeadline} confirma que ainda existe uma modalidade com inscrições abertas.`,
      };
      validationNotes.push('status reaberto porque uma modalidade ainda aceita inscrições');
    }
    const explicitlyClosed = !changes.status && !hasActiveDeadline && original.status !== 'Encerrada'
      ? findExplicitClosedApplications(research.sources, opportunity)
      : null;
    if (explicitlyClosed) {
      proposed.status = 'Encerrada';
      changes.status = { before: original.status ?? null, after: 'Encerrada' };
      evidence.status = {
        ...explicitlyClosed,
        summary_pt: 'A fonte oficial informa explicitamente que as inscrições estão encerradas.',
      };
      validationNotes.push('status marcado como Encerrada por declaração explícita da fonte');
    }
    const qualificationPatch = qualificationCatalogPatch(researchBrief.qualification, opportunity);
    const qualificationEvidence = researchBrief.qualification.evidence[0]
      ? {
          ...researchBrief.qualification.evidence[0],
          kind: 'qualification_evidence',
          summary_pt: researchBrief.qualification.reason,
        }
      : { kind: 'qualification_gap', summary_pt: researchBrief.qualification.reason };
    for (const [field, after] of Object.entries(qualificationPatch)) {
      if (equalValue(after, original[field] ?? null)) {
        delete proposed[field];
        delete changes[field];
        delete evidence[field];
        continue;
      }
      proposed[field] = after;
      changes[field] = { before: original[field] ?? null, after };
      evidence[field] = qualificationEvidence;
    }
    validationNotes.push(`qualification definida como ${researchBrief.qualification.verdict}`);
    const row = {
      run_id: runId, opportunity_id: opportunity.id,
      status: Object.keys(changes).length ? 'pending' : 'no_changes',
      source_url: opportunity.link, original, proposed, changes,
      evidence: {
        ...evidence,
        _sentinel: {
          selected_model: response.model,
          research_model: briefResponse.model,
          model_attempts: modelAttempts,
          sources: research.sources.map((source) => ({ url: source.url, relation: source.relation, trust: source.trust })),
          source_assessments: researchBrief.source_assessments,
          qualification: researchBrief.qualification,
          research_plan: research.plan,
          research_brief: researchBrief,
          adjacent_failures: research.adjacentFailures,
        },
      },
      notes: null,
      model_calls: metrics.modelCalls, page_fetches: metrics.pageFetches,
      input_tokens: metrics.inputTokens, output_tokens: metrics.outputTokens,
      error: null, updated_at: new Date().toISOString(),
    };
    if (supabase) {
      const { error } = await supabase.from('sentinel_research_proposals').upsert(row, { onConflict: 'run_id,opportunity_id' });
      if (error) throw error;
    }
    return { status: row.status, metrics, row };
  } catch (error) {
    metrics.pageFetches = Math.max(metrics.pageFetches, error.pageFetches || 0);
    if (error.metrics) metrics = addMetrics(metrics, error.metrics);
    if (error.modelAttempts) modelAttempts = error.modelAttempts;
    const row = {
      run_id: runId, opportunity_id: opportunity.id, status: 'failed', source_url: opportunity.link,
      original, notes: `Falha na etapa: ${stage}`,
      evidence: { _sentinel: { model_attempts: modelAttempts } },
      error: `${stage}: ${String(error.message || error)}`.slice(0, 2000),
      model_calls: metrics.modelCalls, page_fetches: metrics.pageFetches,
      input_tokens: metrics.inputTokens, output_tokens: metrics.outputTokens,
      updated_at: new Date().toISOString(),
    };
    if (supabase) {
      await supabase.from('sentinel_research_proposals').upsert(row, { onConflict: 'run_id,opportunity_id' });
    }
    return { status: 'failed', metrics, row };
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
  const allowedTags = await activeOpportunityTagNames(supabase);
  const results = await withConcurrency(opportunities || [], 2, (opportunity) => researchExistingOpportunity(supabase, runId, opportunity, allowedTags));
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
  const allowedTags = await activeOpportunityTagNames(supabase);
  let fields = [...new Set((requestedFields || []).filter((field) => REVIEW_FIELDS.includes(field)
    && field in proposal.changes && proposal.evidence?.[field]?.kind !== 'qualification_gap'))];
  fields = qualificationAtomicSelection(fields, proposal.changes);
  let resolved = resolveProposalPatch(fields, proposal.proposed, requestedEdits, allowedTags);
  if (fields.includes('deadline') && proposal.changes.status?.after === 'Encerrada' && isPastDate(resolved.patch.deadline)) {
    fields = [...new Set([...fields, 'status'])];
    resolved = resolveProposalPatch(fields, proposal.proposed, requestedEdits, allowedTags);
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
  const allowedTags = await activeOpportunityTagNames(supabase);
  return processPost(supabase, { url, caption: '', ownerUsername: 'manual' }, runId, true, allowedTags, { refreshOnDuplicateDiff: true });
}

export default async function handler(req, res) {
  res.setHeader?.('X-Sentinel-Prompt-Version', CATALOG_PROMPT_VERSION);
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
