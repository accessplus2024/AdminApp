// api/lib/redditScraper.js
//
// Ported from the old Scrapers/pipeline/reddit.py. Reddit's own search-RSS
// feeds (not a browser, not JS-heavy) — a handful of subreddits, each searched
// with a few different queries/sort orders to catch both fresh posts and the
// big "list of opportunities" megaposts that a plain "new" sort would miss.
//
// Real risk (called out before building this): Reddit is known to rate-limit
// or block requests coming from cloud/datacenter IPs (which is what a Vercel
// function looks like to them) more aggressively than a residential IP. This
// may simply come back empty/429 in production even though the logic is sound.

const USER_AGENT = 'Mozilla/5.0 (compatible; AccessPlusBot/1.0; +https://accessplus.example)';
const DELAY_MS = 1500;
const RETRY_WAIT_MS = 30_000;
const MAX_RETRIES = 3; // menor que o Python (4) pra caber no tempo de uma função Vercel

function sleep(ms) { return new Promise((resolve) => setTimeout(resolve, ms)); }

const BROAD_QUERY = '("high school" OR highschool OR "rising senior" OR "rising junior") '
  + '(program OR competition OR fellowship OR mentorship OR internship OR research OR olympiad OR opportunity)';
const FLAIR_Q = 'flair:"Opportunity"';

// Lista de reserva — usada se a tabela sentinel_reddit_subreddits (editável
// na tela do Sentinel, ver fetchActiveRedditSubreddits) estiver vazia ou sem
// nenhuma linha ativa. Garante que o Reddit nunca fique sem NENHUM subreddit
// só porque a tabela ficou vazia por engano.
export const SUBREDDITS = {
  summerprogramresults: [
    [FLAIR_Q, 'new', 'year'],
    [FLAIR_Q, 'top', 'all'],
    [BROAD_QUERY, 'new', 'year'],
    [BROAD_QUERY, 'top', 'year'],
  ],
  ApplyingToCollege: [
    [BROAD_QUERY, 'new', 'year'],
    [BROAD_QUERY, 'top', 'year'],
  ],
  IntltoUSA: [
    [BROAD_QUERY, 'new', 'year'],
    [BROAD_QUERY, 'top', 'year'],
  ],
};

// Antes, adicionar ou tirar um subreddit exigia deploy (SUBREDDITS acima era
// a única fonte). Agora Admin/Editor edita pela tela do Sentinel, sem
// deploy — mesmo padrão da tabela sentinel_instagram_accounts. `queries`
// (jsonb) guarda ["<query ou 'broad'>", sort, timeFilter] por linha — "broad"
// é um atalho pra não pedir que quem cadastra escreva a query OR gigante na
// mão; qualquer outro texto em `query` é usado literalmente (ex.: a busca
// por flair, que já vem assim da migração original).
export async function fetchActiveRedditSubreddits(supabase) {
  const { data, error } = await supabase.from('sentinel_reddit_subreddits').select('*').eq('active', true).order('name');
  if (error) {
    console.warn('[sentinel] não foi possível carregar subreddits do banco, usando lista fixa de reserva:', error.message);
    return SUBREDDITS;
  }
  if (!data || data.length === 0) return SUBREDDITS;
  const resultado = {};
  for (const row of data) {
    const buscas = Array.isArray(row.queries) ? row.queries : [];
    resultado[row.name] = buscas.length
      ? buscas.map(([query, sort, timeFilter]) => [query === 'broad' ? BROAD_QUERY : query, sort || 'new', timeFilter || 'year'])
      : [[BROAD_QUERY, 'new', 'year']];
  }
  return resultado;
}

const WANTED_FLAIRS = ['opportunity'];
const RECRUIT_REJECT = [
  'co-founder', 'cofounder', 'co founder', 'exec team', 'team member', 'board member',
  'build our board', 'chapter founder', 'chapter leader', 'join our team', 'join my',
  'looking for members', 'looking for officers', 'l/f', 'recruiting', 'recruits',
  'consulting', 'instagram', 'insta account', 'group chat', 'discord', 'officers and team',
];
const ADVICE_TITLE_REJECT = [
  'rate my', 'chance me', 'judge my', 'be honest', 'brutally honest', 'am i cooked', 'cooked',
  'scared', 'to relax', 'comparing', 'worth it', 'need advice', 'needs advice', 'feedback',
  'my stats', 'my plan', 'my profile', 'my chances', 'my ecs', 'my app', 'intake', 'rant',
  'which college', 'which school', ' vs ', 'vs.', 'commit', 'waitlist', 'decision', 'get over',
  'i feel', 'no idea where', 'still no idea', 'help me decide', 'questions!', 'behind',
  'should i write', 'should i pick', 'chance', 'realistic shot', 'realistic chances',
  'realistic colleges', 'shot at t', 'seeking full', 'needing aid', 'needs aid',
  'dares to request', 'is my list', 'is my portfolio', 'should i even', 'do you think i should',
  'help me please', 'pls help', 'help me figure', "i don't think i am", 'is there a chance',
  'what do i need', 'what should i expect', 'what do i do', 'suggest colleges',
  'college suggestion', 'rejected from every', 'i got rejected', 'what i wish',
  'feeling discouraged', 'right track', 'what should i put', 'do i have', 'what should i do',
  'am i missing out', 'need help', 'needs help',
];
const OPPORTUNITY_WORDS = [
  'summer program', 'pre-college', 'precollege', 'competition', 'contest', 'olympiad',
  'fellowship', 'mentorship', 'internship', 'research program', 'research opportunit',
  'bootcamp', 'cohort', 'academy', 'institute', 'summer school', 'hackathon', 'scholarship program',
];
const HS_SIGNALS = [
  'high school', 'highschool', 'hs ', 'rising ', 'grade 9', 'grade 10', 'grade 11', 'grade 12',
  'sophomore', 'junior', 'senior', 'teen', 'secondary school',
];
const OFFER_WORDS = [
  'applications open', 'accepting applications', 'now accepting', 'still accepting',
  'still open', 'still opened', 'apply here', 'apply now', 'apply by', 'deadline', 'register',
  'registration', 'sign up', 'spots available', 'spots left', 'we are hosting', "we're hosting",
  'hosting', 'open to', 'enroll', 'apply at', 'join our', 'recruiting', 'fully funded',
  'free program', 'free summer', 'free research', 'free virtual', '100% free', 'completely free',
  'no cost', 'scholarship available', 'financial aid', 'list of', 'compiled', 'masterlist',
  'master list', 'round-up', 'roundup', 'resources', 'mega list', 'megalist',
];
const REQUEST_WORDS = [
  'looking for', 'anyone know', 'any programs', 'recommendations', 'suggestions', 'seeking',
  'does anyone know', 'in need of', 'any summer', 'any research', 'any opportunit',
];
const FUNDING_WORDS = [
  'fully funded', 'full ride', 'all expenses', 'free program', 'free summer', 'no cost',
  'stipend', 'scholarship', 'financial aid', 'free of charge', 'funded',
];
const INTERNATIONAL_WORDS = ['international', 'non-us', 'outside the us', 'worldwide', 'global', 'any country', 'intl'];
const LINK_WORDS = ['forms.gle', 'airtable.com', 'docs.google.com/forms', 'luma.com', 'smapply', 'linktr.ee', 'wixstudio', 'apply at', 'register at', 'application form'];
const MIN_SCORE = 6;

const anyIn = (text, words) => words.some((w) => text.includes(w));

export function scorePost(title, summary, flair = '') {
  const t = title.toLowerCase();
  const blob = `${t} ${summary.toLowerCase()}`;

  if (anyIn(t, ADVICE_TITLE_REJECT)) return null;
  if (anyIn(blob, RECRUIT_REJECT)) return null;
  if (flair && anyIn(flair.toLowerCase(), WANTED_FLAIRS)) return 99;

  const oppInTitle = anyIn(t, OPPORTUNITY_WORDS);
  const oppInBody = anyIn(blob, OPPORTUNITY_WORDS);
  if (!oppInBody) return null;
  if (!anyIn(blob, HS_SIGNALS)) return null;

  let score = 0;
  score += oppInTitle ? 2 : 1;
  if (anyIn(t, OFFER_WORDS)) score += 3;
  else if (anyIn(blob, OFFER_WORDS)) score += 1;
  if (anyIn(t, REQUEST_WORDS)) score += 2;
  if (anyIn(blob, FUNDING_WORDS)) score += 1;
  if (anyIn(blob, INTERNATIONAL_WORDS)) score += 1;
  if (anyIn(blob, LINK_WORDS)) score += 2;
  return score;
}

function extrairPrimeiraUrl(texto) {
  const match = String(texto || '').match(/https?:\/\/[^\s)"]+/);
  return match ? match[0].replace(/[.,;]+$/, '') : null;
}

async function buscarFeed(subreddit, query, sort, timeFilter) {
  const url = new URL(`https://www.reddit.com/r/${subreddit}/search.rss`);
  url.searchParams.set('q', query);
  url.searchParams.set('restrict_sr', 'on');
  url.searchParams.set('sort', sort);
  url.searchParams.set('t', timeFilter);
  url.searchParams.set('limit', '100');

  for (let tentativa = 0; tentativa < MAX_RETRIES; tentativa += 1) {
    const resposta = await fetch(url.toString(), { headers: { 'User-Agent': USER_AGENT }, signal: AbortSignal.timeout(30_000) });
    if (resposta.status === 429) {
      if (tentativa < MAX_RETRIES - 1) await sleep(RETRY_WAIT_MS);
      continue;
    }
    if (!resposta.ok) return [];
    const xml = await resposta.text();
    return [...xml.matchAll(/<entry>([\s\S]*?)<\/entry>/gi)].map((m) => m[1]);
  }
  return [];
}

function tag(entryXml, name) {
  const match = entryXml.match(new RegExp(`<${name}[^>]*>([\\s\\S]*?)</${name}>`, 'i'));
  return match ? match[1].replace(/^<!\[CDATA\[/, '').replace(/\]\]>$/, '') : '';
}

function categoriaFlair(entryXml) {
  const matches = [...entryXml.matchAll(/<category[^>]*term="([^"]*)"/gi)];
  return matches.map((m) => m[1]).join(' ');
}

export async function coletarReddit(subreddits = SUBREDDITS) {
  const vistos = new Map(); // normalizedTitle -> item (mantém o de maior score)
  for (const [subreddit, buscas] of Object.entries(subreddits)) {
    for (const [query, sort, timeFilter] of buscas) {
      const entradas = await buscarFeed(subreddit, query, sort, timeFilter);
      for (const entryXml of entradas) {
        const titulo = tag(entryXml, 'title');
        const resumoHtml = tag(entryXml, 'summary') || tag(entryXml, 'content');
        const link = tag(entryXml, 'link').match(/href="([^"]+)"/)?.[1] || tag(entryXml, 'id');
        const flair = categoriaFlair(entryXml);
        const score = scorePost(titulo, resumoHtml, flair);
        if (score === null || score < MIN_SCORE) continue;

        const chave = titulo.toLowerCase().replace(/[^a-z0-9 ]/g, '').trim();
        if (vistos.has(chave) && vistos.get(chave).score >= score) continue;

        const linkOficial = extrairPrimeiraUrl(resumoHtml) || link;
        vistos.set(chave, {
          score,
          item: {
            titulo, link: linkOficial, data: tag(entryXml, 'published') || tag(entryXml, 'updated'),
            resumo: resumoHtml.slice(0, 1200), texto: `${titulo} ${resumoHtml}`.slice(0, 5000),
          },
        });
      }
      await sleep(DELAY_MS);
    }
  }
  return [...vistos.values()].map((v) => v.item);
}
