import { ApifyClient } from 'apify-client';
import OpenAI from 'openai';
import { createClient } from '@supabase/supabase-js';

export const config = { maxDuration: 300 };

const SCORE_THRESHOLD = 4;
const SOURCE_ACCOUNTS = [
  'opportunitydesk',
  'opportunities_corners',
  'opportunitiesforyouth',
  'adroiteducation',
  'borderless.so',
];

const HS_SIGNALS = ['high school', 'secondary school', 'high schooler', 'grade 9', 'grade 10', 'grade 11', 'grade 12'];
const YOUTH_SIGNALS = ['youth', 'young people', 'teenager', 'teen', '16', '17', '18'];
const FUNDING_SIGNALS = ['funded', 'fully funded', 'free', 'scholarship', 'grant', 'stipend', 'fellowship', 'financial aid', 'all expenses'];
const BRAZIL_SIGNALS = ['brazil', 'brazilian', 'all nationals', 'open to all', 'all countries'];
const UNIVERSITY_PENALTIES = ['phd', 'ph.d', 'doctorate', 'doctoral', 'postdoc', 'postdoctoral', "master's", 'masters', 'master degree', 'master of', 'professor', 'faculty', 'researcher', 'research grant', "bachelor's", 'bachelors', 'undergraduate degree'];

function serverClient() {
  const url = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error('SUPABASE_URL/NEXT_PUBLIC_SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY precisam estar configuradas no servidor.');
  return createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
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

function scorePost(post) {
  const text = String(post.caption || '').toLowerCase();
  let points = 0;
  for (const word of HS_SIGNALS) if (text.includes(word)) points += 5;
  for (const word of YOUTH_SIGNALS) if (text.includes(word)) points += 2;
  for (const word of FUNDING_SIGNALS) if (text.includes(word)) points += 2;
  for (const word of BRAZIL_SIGNALS) if (text.includes(word)) points += 1;
  for (const word of UNIVERSITY_PENALTIES) if (text.includes(word)) points -= 4;
  return points;
}

function extractUrl(text) {
  return String(text || '').match(/https?:\/\/[^\s\)"]+/)?.[0] || null;
}

function stripHtml(html) {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, '')
    .replace(/<style[\s\S]*?<\/style>/gi, '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

async function fetchPageText(url) {
  try {
    const response = await fetch(url, {
      redirect: 'follow',
      headers: { 'User-Agent': 'Mozilla/5.0 (compatible; AccessPlus-Sentinel/2.0)', Accept: 'text/html,text/plain' },
      signal: AbortSignal.timeout(10_000),
    });
    if (response.ok) {
      const text = stripHtml(await response.text()).slice(0, 8_000);
      if (text.length > 200) return text;
    }
  } catch { /* use the text fallback below */ }

  const fallback = await fetch(`https://r.jina.ai/${encodeURIComponent(url)}`, {
    headers: { Accept: 'text/plain' },
    signal: AbortSignal.timeout(30_000),
  });
  if (!fallback.ok) throw new Error(`Não foi possível ler ${url} (HTTP ${fallback.status}).`);
  return (await fallback.text()).slice(0, 8_000);
}

function systemPrompt(manual = false) {
  const today = new Date().toISOString().slice(0, 10);
  const cutoff = new Date(Date.now() + 30 * 86400_000).toISOString().slice(0, 10);
  const criteria = manual ? '' : `
Inclua apenas programas gratuitos ou com apoio financeiro substancial, abertos a brasileiros, adequados a estudantes de 14–18 anos e com prazo até ${cutoff}, contínuo ou desconhecido. Exclua oportunidades universitárias e prazos anteriores a ${today}.`;
  return `Você pesquisa oportunidades educacionais para estudantes brasileiros do ensino médio. Baseie a resposta SOMENTE no conteúdo fornecido. Não invente fatos.${criteria}
Todos os campos devem estar em português brasileiro. Responda SOMENTE com um objeto JSON cru, sem markdown:
{"name":"Nome","summary":"Descrição de 1–2 frases que menciona o principal benefício","eligibility":["critério"],"deadline":"prazo","fees":"taxas e apoio financeiro","link":"URL oficial"}
Se a oportunidade não se qualificar ou não houver dados suficientes, responda: {"qualified":false}`;
}

async function groundUrl(url, caption = '', ownerUsername = '', manual = false) {
  const apiKey = process.env.NVIDIA_API_KEY;
  if (!apiKey) throw new Error('NVIDIA_API_KEY não configurada no servidor.');
  const pageText = await fetchPageText(url);
  const openai = new OpenAI({ apiKey, baseURL: 'https://integrate.api.nvidia.com/v1', timeout: 60_000, maxRetries: 1 });
  const response = await openai.chat.completions.create({
    model: 'z-ai/glm-5.2',
    temperature: 0.2,
    max_tokens: 4096,
    messages: [
      { role: 'system', content: systemPrompt(manual) },
      { role: 'user', content: `Legenda: ${caption}\nConta: @${ownerUsername}\nURL: ${url}\n\nConteúdo:\n${pageText}\n\nRetorne o JSON agora.` },
    ],
    chat_template_kwargs: { enable_thinking: true, clear_thinking: true },
  });
  const raw = response.choices[0]?.message?.content || '';
  const match = raw.match(/\{[\s\S]*\}/);
  if (!match) throw new Error('O modelo não devolveu um objeto JSON.');
  const result = JSON.parse(match[0]);
  if (result.qualified === false || !result.name || !result.link) return null;
  return result;
}

async function findOrCreateOpportunity(supabase, extracted) {
  const { data: existing } = await supabase
    .from('opportunities')
    .select('*')
    .eq('link', extracted.link)
    .limit(1)
    .maybeSingle();
  if (existing) return { opportunity: existing, created: false };

  const row = {
    title: extracted.name,
    description: extracted.summary || '',
    link: extracted.link,
    deadline: extracted.deadline || null,
    areas: [],
    level: ['Ensino Médio'],
    location: null,
    audience: [],
    cost: extracted.fees || null,
    language: null,
    keywords: ['Sentinel'],
    eligibility: Array.isArray(extracted.eligibility) ? extracted.eligibility.join('\n') : String(extracted.eligibility || ''),
    process: null,
    applicants: null,
    additionals: 'Descoberta automaticamente pelo Sentinel. Revise todos os campos antes de publicar.',
    resources: [],
    status: 'Revisar',
    review: null,
    type: 'Programas Acadêmicos',
  };
  const { data, error } = await supabase.from('opportunities').insert(row).select().single();
  if (error) throw error;
  return { opportunity: data, created: true };
}

async function processPost(supabase, post, manual = false) {
  const sourceUrl = manual ? post.url : post.sourceUrl;
  const officialUrl = manual ? post.url : extractUrl(post.caption);
  const now = new Date().toISOString();
  if (!officialUrl) {
    await supabase.from('sentinel_posts').update({ status: 'rejected', error: 'Nenhum link encontrado na legenda.', processed_at: now, updated_at: now }).eq('source_url', sourceUrl);
    return { status: 'rejected' };
  }
  try {
    const extracted = await groundUrl(officialUrl, post.caption, post.ownerUsername, manual);
    if (!extracted) {
      await supabase.from('sentinel_posts').update({ status: 'rejected', processed_at: now, error: null, updated_at: now }).eq('source_url', sourceUrl);
      return { status: 'rejected' };
    }
    const { opportunity, created } = await findOrCreateOpportunity(supabase, extracted);
    await supabase.from('sentinel_posts').update({
      status: 'qualified', opportunity_id: opportunity.id, extracted,
      processed_at: now, error: null, updated_at: now,
    }).eq('source_url', sourceUrl);
    return { status: 'qualified', opportunity, created };
  } catch (error) {
    await supabase.from('sentinel_posts').update({ status: 'failed', error: String(error.message || error).slice(0, 1000), processed_at: now, updated_at: now }).eq('source_url', sourceUrl);
    return { status: 'failed', error: error.message || String(error) };
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

async function runPipeline(supabase, maxCandidates) {
  if (!process.env.APIFY_API_KEY) throw new Error('APIFY_API_KEY não configurada no servidor.');
  const client = new ApifyClient({ token: process.env.APIFY_API_KEY });
  const run = await client.actor('apify/instagram-scraper').call({
    addParentData: false,
    directUrls: SOURCE_ACCOUNTS.map((account) => `https://www.instagram.com/${account}/`),
    onlyPostsNewerThan: '15 days',
    resultsLimit: 50,
    resultsType: 'posts',
    searchLimit: 1,
    searchType: 'hashtag',
  });
  const { items } = await client.dataset(run.defaultDatasetId).listItems();
  const posts = items.map((item) => ({
    caption: item.caption || '',
    sourceUrl: item.url || '',
    timestamp: item.timestamp || null,
    ownerUsername: item.ownerUsername || '',
  })).filter((post) => post.sourceUrl);

  const { data: knownRows, error: knownError } = await supabase.from('sentinel_posts').select('source_url').in('source_url', posts.map((post) => post.sourceUrl));
  if (knownError) throw knownError;
  const known = new Set((knownRows || []).map((row) => row.source_url));
  const fresh = posts.filter((post) => !known.has(post.sourceUrl));
  const scored = fresh.map((post) => ({ ...post, score: scorePost(post) }));
  if (scored.length) {
    const { error } = await supabase.from('sentinel_posts').insert(scored.map((post) => ({
      source_url: post.sourceUrl,
      source_type: 'instagram',
      owner_username: post.ownerUsername,
      caption: post.caption,
      posted_at: post.timestamp,
      score: post.score,
      status: post.score >= SCORE_THRESHOLD ? 'pending' : 'screened_out',
      processed_at: post.score >= SCORE_THRESHOLD ? null : new Date().toISOString(),
    })));
    if (error) throw error;
  }
  const candidates = scored.filter((post) => post.score >= SCORE_THRESHOLD).sort((a, b) => b.score - a.score).slice(0, maxCandidates);
  const results = await withConcurrency(candidates, 3, (post) => processPost(supabase, post));
  return {
    scraped: posts.length,
    newPosts: fresh.length,
    candidates: candidates.length,
    qualified: results.filter((item) => item.status === 'qualified').length,
    created: results.filter((item) => item.created).length,
    rejected: results.filter((item) => item.status === 'rejected').length,
    failed: results.filter((item) => item.status === 'failed').length,
  };
}

async function addManual(supabase, url) {
  try { new URL(url); } catch { throw Object.assign(new Error('Informe uma URL válida.'), { statusCode: 400 }); }
  const now = new Date().toISOString();
  const { error } = await supabase.from('sentinel_posts').upsert({
    source_url: url,
    source_type: 'manual',
    owner_username: 'manual',
    caption: '',
    posted_at: now,
    score: -1,
    status: 'pending',
    error: null,
    processed_at: null,
    updated_at: now,
  }, { onConflict: 'source_url' });
  if (error) throw error;
  return processPost(supabase, { url, caption: '', ownerUsername: 'manual' }, true);
}

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  try {
    const supabase = serverClient();
    await authorize(req, supabase);
    const action = req.body?.action;
    if (action === 'run') {
      const limit = Math.max(1, Math.min(Number(req.body?.maxCandidates) || 10, 25));
      return res.status(200).json(await runPipeline(supabase, limit));
    }
    if (action === 'add') return res.status(200).json(await addManual(supabase, String(req.body?.url || '').trim()));
    return res.status(400).json({ error: 'Ação inválida.' });
  } catch (error) {
    console.error('[api/sentinel]', error);
    return res.status(error.statusCode || 500).json({ error: error.message || 'Falha ao executar o Sentinel.' });
  }
}
