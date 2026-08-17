// api/lib/scraperSources.js
//
// Config único das fontes web do scraper (ported from the old Scrapers/sources/config.json).
//
// Para adicionar uma fonte nova: se for um blog WordPress, basta um objeto aqui com
// metodo 'wp'. Se for RSS puro (sem REST), use metodo 'rss' e forneça `rss`. Se for
// uma SPA que só mostra conteúdo com JavaScript, use metodo 'js', tipo 'listagem' —
// essas rodam um Chromium de verdade (api/lib/scraperFetch.js#coletarJs) e depois
// pedem pra uma IA identificar quais links são de programas de verdade
// (api/lib/listingExtractor.js), já que a página inteira mistura menu/navegação
// com as oportunidades. São as fontes mais caras e menos confiáveis desta lista —
// foram tentadas de novo em 2026-08 (Stand Out Search, SnowDay, Pathspire) e
// removidas de vez logo depois: mesmo com Chromium de verdade, só trazem
// menu/catálogo, nunca as oportunidades (o conteúdo fica atrás de busca/filtro
// interativo que só existe depois de cliques do usuário). Ver comentário junto
// de FONTES abaixo antes de tentar religar qualquer uma delas.

// Removidas em 2026-08-17, checado ao vivo (fetch direto, fora do app):
// - Stand Out Search / Pathspire: a página bruta que o servidor entrega é só
//   a casca do app (734 e 94 caracteres de texto) — a lista de programas de
//   verdade só existe depois de JavaScript rodar no navegador do usuário e
//   chamar uma API própria. Mesmo com Chromium de verdade (já tentado antes,
//   ver histórico), só trazia menu/catálogo, nunca as oportunidades — não
//   vale o custo de manter ligado sem reescrever pra imitar cliques/filtros
//   de verdade dentro do navegador.
// - SnowDay: a própria URL configurada (/search/free) devolve HTTP 404 — o
//   site mudou de estrutura. Mesmo corrigindo pra /search, é a mesma
//   situação das outras duas (SPA sem conteúdo no HTML bruto).
// - Admissions Angle: a URL não é um feed que recebe posts novos — é UM
//   artigo específico ("melhores programas de matemática de verão"), sempre
//   com a mesma lista fixa. Reprocessar isso toda semana nunca traz nada
//   novo, só reencontra os mesmos itens de sempre.
export const FONTES = [
  { nome: 'Opportunity Desk', url: 'https://opportunitydesk.org', metodo: 'wp', tipo: 'feed', ativo: true },
  { nome: 'Bright Scholarship', url: 'https://brightscholarship.com', metodo: 'wp', tipo: 'feed', ativo: true },
  {
    nome: 'Opportunities for Youth',
    url: 'https://opportunitiesforyouth.org',
    metodo: 'wp',
    tipo: 'feed',
    ativo: true,
    // Este host (WordPress.com/a8c) faz rate-limit de rajada por IP (429), que libera em
    // ~30-60s. Config leve + paciente: sem 'content' (o campo mais pesado), per_page menor,
    // pausa entre páginas, e mais tentativas de backoff antes de cair no RSS.
    perPage: 50,
    semContent: true,
    pausaMs: 2000,
    tentativas: 6,
    esperaInicialMs: 10_000,
  },
  { nome: 'OYAOP', url: 'https://oyaop.com', metodo: 'wp', tipo: 'feed', ativo: true },

  // Reddit não é "um site" com URL fixa — é uma busca em vários subreddits, cada
  // um com suas próprias queries (ver api/lib/redditScraper.js). Aparece aqui só
  // como um marcador pro resto do pipeline (metodo 'reddit' tem um caminho próprio
  // em api/cron/scrape-sources.js). É uma fonte selecionável igual às outras na
  // tela — vem marcada por padrão (não precisa lembrar de marcar), mas dá pra
  // desmarcar ou deixar como a única marcada pra rodar sozinha. Reddit é
  // conhecido por bloquear/limitar IPs de datacenter (o que a Vercel parece pra
  // eles) mais que IPs residenciais — pode simplesmente vir vazio ou com 429 em
  // produção mesmo com a lógica certa.
  { nome: 'Reddit', url: 'https://reddit.com', metodo: 'reddit', tipo: 'feed', ativo: true },
];

// Fontes que normalmente publicam com frequência. Se uma destas voltar com ZERO
// itens brutos numa rodada, é mais provável que tenha quebrado do que "não saiu
// nada essa semana" — vale registrar como aviso em vez de deixar passar em silêncio.
export const FONTES_SEMPRE_ATIVAS = new Set(['opportunity desk', 'bright scholarship', 'oyaop']);

export const FILTROS = {
  // 7, não 30 — combina com o ritmo semanal de coleta manual (sem cron
  // diário automático, ver vercel.json): a cada rodada, só interessa o que
  // é novo desde a última vez, não reprocessar um mês inteiro toda semana.
  dias: 7,
  maxPorSite: 60,
  exigirNivel: true,
  exigirFinanceiro: true,
  exigirInternacional: false,

  // sinal CLARO de ensino médio / gap year
  nivelForte: [
    'high school', 'high-school', 'highschool', 'high schooler', 'high-schooler',
    'secondary school', 'secondary student', 'secondary education', 'grade 9', 'grade 10',
    'grade 11', 'grade 12', '9th grade', '10th grade', '11th grade', '12th grade', '9-12',
    'k-12', 'k12', 'sixth form', 'year 11', 'year 12', 'gap year', 'pre-college', 'pre college',
    'pre-university', 'pre university', 'precollege', 'senior year', 'rising senior',
    'rising junior', 'college-bound', 'teen', 'teens', 'teenager', 'adolescent', 'aged 13',
    'aged 14', 'aged 15', 'aged 16', 'aged 17', 'ages 13', 'ages 14', 'ages 15', 'ages 16',
    'ages 17', 'ages 18', '13-18', '14-18', '15-18', '16-18', 'under 18', 'under 19',
    'ensino médio', 'ensino medio',
  ],
  // sinal AMBÍGUO ('young'/'youth'/'18-30') — casa programa adulto também
  nivelFraco: [
    'young', 'youth', 'young people', 'young leader', 'young leaders', 'young changemaker',
    'young changemakers', 'aged 18', 'ages 18-', '18-30', '18-35', '18 to 30', '18 to 35',
    'under 30', 'under 35', 'jovens',
  ],
  // se SÓ bate nível fraco, e QUALQUER termo abaixo aparece junto, descarta (é programa
  // adulto/profissional que se chama "youth"). Não derruba item com sinal FORTE.
  adultoMarcadores: [
    'professional', 'professionals', 'career', 'careers', 'workforce', 'employee', 'employees',
    'working professional', 'job seeker', 'job-seeker', 'mid-career', 'early career',
    'aged 21', 'aged 22', 'aged 23', 'aged 24', 'aged 25', '21-35', '25-35', 'adults',
    'practitioner', 'practitioners', 'civil servant', 'policymaker', 'policymakers',
    'accelerator', 'incubator', 'venture', 'ventures', 'seed funding', 'pre-seed',
    'equity-free', 'equity free', 'early-stage', 'early stage', 'angel investor', 'scale-up',
    'sme', 'smes', 'business owner', 'business owners', 'co-founder', 'women in tech',
    'research associate', 'research fellow', 'research fellowship', 'research grant',
    'for organizations', 'for organisations', 'for nonprofits', 'nonprofit organizations',
    'for ngos', 'grantee', 'grantees', 'consortium', 'registered organization',
    'registered organisation',
  ],
  financeiro: [
    'fully funded', 'fully-funded', 'fully sponsored', 'full scholarship', 'scholarship',
    'scholarships', 'financial aid', 'need-based', 'free', 'free of charge', 'free program',
    'no cost', 'cost-free', 'zero cost', 'no fee', 'no application fee', 'no participation fee',
    'fee waiver', 'waiver', 'stipend', 'bursary', 'funded', 'tuition-free', 'tuition free',
    'all expenses', 'expenses paid', 'all costs covered', 'covers all costs', 'travel covered',
    'grant', 'grants', 'paid internship', 'paid opportunity', 'prize money', 'cash prize',
    'bolsa', 'gratuito', 'gratuita', 'financiado', 'totalmente financiado', 'isenção',
  ],
  internacional: [
    'international', 'worldwide', 'global', 'all countries', 'any country', 'open to all',
    'around the world', 'all nationalities', 'open to international', 'students from any',
  ],
  // nível superior/profissional inequívoco: derruba mesmo que bata nível+financeiro
  excluir: [
    'postdoc', 'postdoctoral', 'phd', 'ph.d', 'doctoral', 'doctorate', "master's", 'masters',
    "master's degree", 'master of', 'msc', 'm.sc', 'international master', 'joint master',
    'erasmus mundus', 'mba', 'postgraduate', 'post-graduate', 'graduate student',
    'graduate students', 'graduate programme', 'graduate program', 'undergraduate',
    'undergraduates', 'undergraduate degree', 'bachelor', "bachelor's", 'university student',
    'university students', 'college student', 'college students', 'faculty', 'professor',
    'tenure', 'early career', 'mid-career', 'young professional', 'young professionals',
    'working professional', 'phd candidate', 'master student', 'master students',
    'enrolled at a university', 'current university', 'million',
  ],
  // sinais de abertura que impedem o corte por nacionalidade
  aceitarNacionalidade: [
    'brazil', 'brasil', 'brazilian', 'brasileiro', 'brasileira', 'latin america',
    'latin american', 'américa latina', 'america latina', 'latam', 'latino', 'latina',
    'worldwide', 'global', 'international', 'internacional', 'all nationalities',
    'any nationality', 'all countries', 'any country', 'open to all', 'around the world',
    'students from any', 'all backgrounds', 'regardless of nationality',
  ],
};
