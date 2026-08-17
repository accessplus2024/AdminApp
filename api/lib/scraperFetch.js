// api/lib/scraperFetch.js
//
// Fetches WordPress REST feeds (with retry/backoff on 429/503, same idea as the old
// Python _get_retry), and falls back to plain RSS parsing if the REST endpoint is
// blocked. No external XML library — RSS items are simple enough that a small,
// well-tested regex extraction is fine and keeps the Vercel function bundle tiny.

const USER_AGENT = 'Mozilla/5.0 (compatible; AccessPlusBot/1.0; +https://accessplus.example)';

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function stripHtml(value) {
  return String(value || '')
    .replace(/<script[\s\S]*?<\/script>/gi, '')
    .replace(/<style[\s\S]*?<\/style>/gi, '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&quot;/gi, '"')
    .replace(/&#0?39;/gi, "'")
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/\s+/g, ' ')
    .trim();
}

async function getComRetry(url, { tentativas = 4, esperaInicialMs = 5000, esperaMaxMs = 60_000 } = {}) {
  let espera = esperaInicialMs;
  let ultimaResposta = null;
  for (let i = 0; i < tentativas; i += 1) {
    const resposta = await fetch(url, { headers: { 'User-Agent': USER_AGENT }, signal: AbortSignal.timeout(30_000) });
    ultimaResposta = resposta;
    if (resposta.status !== 429 && resposta.status !== 503) return resposta;
    const retryAfter = Number(resposta.headers.get('retry-after'));
    const pausa = Number.isFinite(retryAfter) && retryAfter > 0 ? retryAfter * 1000 : espera;
    if (i < tentativas - 1) {
      await sleep(pausa);
      espera = Math.min(espera * 2, esperaMaxMs);
    }
  }
  return ultimaResposta;
}

// -----------------------------------------------------------------------------
// WordPress REST (/wp-json/wp/v2/posts) — melhor fonte: filtra por data, traz
// título/excerpt/content já estruturados.
// -----------------------------------------------------------------------------
export async function coletarWp(site, dias) {
  const after = new Date(Date.now() - dias * 24 * 60 * 60 * 1000).toISOString();
  const perPage = site.perPage || 100;
  const tentativas = site.tentativas || 4;
  const esperaInicialMs = site.esperaInicialMs || 5000;
  const campos = site.semContent ? 'title,link,date,excerpt' : 'title,link,date,excerpt,content';

  const itens = [];
  let pagina = 1;
  while (pagina <= 5) {
    const url = new URL(`${site.url.replace(/\/+$/, '')}/wp-json/wp/v2/posts`);
    url.searchParams.set('per_page', String(perPage));
    url.searchParams.set('page', String(pagina));
    url.searchParams.set('after', after);
    url.searchParams.set('_fields', campos);
    url.searchParams.set('orderby', 'date');
    url.searchParams.set('order', 'desc');

    const resposta = await getComRetry(url.toString(), { tentativas, esperaInicialMs });
    if (!resposta || resposta.status !== 200) {
      if (pagina === 1) {
        return coletarRss(site, dias); // REST bloqueado mesmo após backoff -> cai no RSS
      }
      break;
    }
    const lote = await resposta.json();
    if (!Array.isArray(lote) || lote.length === 0) break;

    for (const p of lote) {
      const titulo = stripHtml(p?.title?.rendered);
      const excerpt = stripHtml(p?.excerpt?.rendered);
      const corpo = stripHtml(p?.content?.rendered);
      itens.push({
        titulo,
        link: p?.link || '',
        data: p?.date || '',
        resumo: (excerpt || corpo.slice(0, 1200)),
        texto: `${titulo} ${excerpt} ${corpo}`.slice(0, 5000),
      });
    }
    if (lote.length < perPage) break;
    pagina += 1;
    if (site.pausaMs) await sleep(site.pausaMs);
  }
  return itens;
}

// -----------------------------------------------------------------------------
// RSS (fallback quando o REST está bloqueado, ou a fonte não tem REST).
// -----------------------------------------------------------------------------
function extrairTagsRss(itemXml, tag) {
  const re = new RegExp(`<${tag}[^>]*>([\\s\\S]*?)</${tag}>`, 'i');
  const match = itemXml.match(re);
  if (!match) return '';
  return stripHtml(match[1].replace(/^<!\[CDATA\[/, '').replace(/\]\]>$/, ''));
}

export async function coletarRss(site, dias) {
  const feedUrl = site.rss || `${site.url.replace(/\/+$/, '')}/feed/`;
  const tentativas = site.tentativas || 4;
  const esperaInicialMs = site.esperaInicialMs || 5000;

  let xml = '';
  const resposta = await getComRetry(feedUrl, { tentativas, esperaInicialMs });
  if (resposta && resposta.status === 200) {
    xml = await resposta.text();
  } else {
    throw new Error(`RSS indisponível (HTTP ${resposta ? resposta.status : 'sem resposta'})`);
  }

  const blocos = xml.match(/<item[\s\S]*?<\/item>/gi) || [];
  const corte = Date.now() - dias * 24 * 60 * 60 * 1000;
  const itens = [];
  for (const bloco of blocos) {
    const titulo = extrairTagsRss(bloco, 'title');
    const link = extrairTagsRss(bloco, 'link');
    const dataTexto = extrairTagsRss(bloco, 'pubDate');
    const resumo = extrairTagsRss(bloco, 'description') || extrairTagsRss(bloco, 'content:encoded');
    const quando = dataTexto ? new Date(dataTexto).getTime() : NaN;
    if (Number.isFinite(quando) && quando < corte) continue;
    itens.push({
      titulo, link, data: dataTexto,
      resumo: resumo.slice(0, 1200),
      texto: `${titulo} ${resumo}`.slice(0, 5000),
    });
  }
  return itens;
}

// -----------------------------------------------------------------------------
// JS (SPA) — renderiza a página com um Chromium real. Único jeito de ver o
// conteúdo em sites como Stand Out Search / Pathspire, que só entregam
// menu/navegação sem JavaScript.
//
// Usa @sparticuz/chromium (build de Chromium empacotado pra caber no limite de
// tamanho de uma Vercel Function) + puppeteer-core. ATENÇÃO: a versão do
// @sparticuz/chromium precisa ser compatível com a do puppeteer-core — isso só
// se confirma de verdade rodando em produção (ver README do Sparticuz/chromium
// no GitHub se o Chromium falhar ao abrir nos logs da Vercel). Esta é a parte
// menos testável deste projeto sem um deploy real.
// -----------------------------------------------------------------------------
let chromiumSingleton = null;
async function chromiumDeps() {
  if (!chromiumSingleton) {
    const [{ default: chromium }, puppeteer] = await Promise.all([
      import('@sparticuz/chromium'),
      import('puppeteer-core'),
    ]);
    chromium.setGraphicsMode = false;
    chromiumSingleton = { chromium, puppeteer };
  }
  return chromiumSingleton;
}

export async function coletarJs(url, { timeoutMs = 40_000, esperaAposCargaMs = 3000 } = {}) {
  const { chromium, puppeteer } = await chromiumDeps();
  const browser = await puppeteer.launch({
    args: chromium.args,
    defaultViewport: chromium.defaultViewport,
    executablePath: await chromium.executablePath(),
    headless: chromium.headless,
  });
  try {
    const page = await browser.newPage();
    await page.setUserAgent(USER_AGENT);
    await page.goto(url, { waitUntil: 'networkidle2', timeout: timeoutMs }).catch(() => {
      // segue mesmo se "networkidle2" nunca bater (SPA que fica fazendo polling) —
      // pega o HTML no estado em que estiver depois da espera abaixo.
    });
    await new Promise((resolve) => setTimeout(resolve, esperaAposCargaMs));
    const html = await page.content();
    const texto = stripHtml(html).slice(0, MAX_TEXTO_JS);
    const links = extrairLinksHtml(html, url);
    return { texto, links };
  } finally {
    await browser.close();
  }
}

const MAX_TEXTO_JS = 15_000;

function extrairLinksHtml(html, baseUrl) {
  const vistos = new Set();
  const links = [];
  const pattern = /<a\b[^>]*href\s*=\s*(["'])(.*?)\1[^>]*>([\s\S]*?)<\/a>/gi;
  let match;
  while ((match = pattern.exec(html))) {
    const href = match[2].trim();
    if (!href || href.startsWith('#') || href.startsWith('mailto:') || href.startsWith('javascript:')) continue;
    let absoluta;
    try { absoluta = new URL(href, baseUrl).toString(); } catch { continue; }
    if (vistos.has(absoluta)) continue;
    vistos.add(absoluta);
    links.push({ texto: stripHtml(match[3]), href: absoluta });
  }
  return links;
}
