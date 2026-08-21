// api/cron/scrape-sources.js
//
// Web-scraper pipeline, hosted inside AdminApp instead of the old standalone
// Python project, running for free on Vercel (Hobby plan: cron jobs are capped
// at once/day and 300s per function — both plenty for 4 WordPress/RSS feeds).
//
// THREE PHASES:
//
//   1. COLLECT (cheap, no AI): fetch recent posts from each source, run the
//      keyword pre-filter (eligibility + financial aid, ported from the old
//      sources/config.json) plus a title-slug check against the existing
//      catalog and history (slugTitulo, in scraperFilters.js — skips
//      anything that already looks like a known opportunity before spending
//      even a page fetch), and queue whatever survives as `sentinel_posts`
//      rows with status "queued".
//
//   2. RESEARCH (the expensive step): runs automatically right after COLLECT,
//      on up to HARD_MAX_CANDIDATES queued rows — no manual per-item pick
//      needed anymore. Uses Sentinel's existing research pipeline
//      (processPost), the same code AdminApp already uses for Instagram
//      finds and manual URL adds: fetches the real page (and nearby pages),
//      asks the model to extract full catalog fields, dedupes against the
//      real catalog, and inserts into `opportunities` with status "Revisar"
//      — never "Aprovada". A human still makes the publish call afterwards,
//      same as always. Can still be triggered manually (or with a specific
//      list of postIds) from the Web screen if you want it sooner than the
//      daily cron, or want to point it at specific rows.
//
//   3. ENRICH (optional/manual any time, or automatic once a day for anything
//      that became "Aprovada" recently — see enriquecerAprovadasAutomaticamente):
//      search Serper/YouTube/Reddit
//      for extra links, ask the AI to verify (against the real page content,
//      not just the search snippet) which ones are genuinely about the same
//      opportunity, and add only what it's confident about to
//      `opportunities.resources`. The manual "enrich" action still returns
//      every candidate (confident or not) for a human to pick from.
//
// Triggers:
//   GET  (Vercel Cron only, see vercel.json) — COLLECT across all active
//        sources, then RESEARCH automatically (capped at HARD_MAX_CANDIDATES),
//        then the automatic ENRICH pass. Once/day (Vercel Hobby plan limit).
//   POST (from the admin app's "Web" screen, Admin/Editor only) —
//        { action: 'collect', sites?: string[] }  -> phase 1, a chosen subset or all.
//        { action: 'research', postIds?, maxCandidates? } -> phase 2, either
//          specific queued rows (postIds) or the oldest `maxCandidates` queued
//          rows (default 10, max 25 — same cap Sentinel's Instagram flow uses).
//          Mostly useful now to force a run sooner than the daily cron.
//        { action: 'delete', postIds } -> remove processed rows (never 'pending').
//        { action: 'enrich', opportunityId } -> phase 3 (optional, manual, per
//          opportunity, only meaningful once it's already 'qualified'): search
//          Serper + YouTube Data API + Reddit, ask the AI to flag which results
//          actually look related, and return the list for a human to review —
//          nothing is saved yet.
//        { action: 'enrich_confirm', opportunityId, resources } -> save only the
//          items a human actually picked from the 'enrich' response.

import { createClient } from '@supabase/supabase-js';
import { FONTES, FONTES_SEMPRE_ATIVAS, FILTROS } from '../lib/scraperSources.js';
import { coletarWp, coletarRss, coletarJs } from '../lib/scraperFetch.js';
import { passaFiltro, slugTitulo, pontuarItem } from '../lib/scraperFilters.js';
import { extrairCandidatosDaListagem } from '../lib/listingExtractor.js';
import { coletarReddit, fetchActiveRedditSubreddits } from '../lib/redditScraper.js';
import { buscarCandidatosDeEnriquecimento, confirmarEnriquecimento, enriquecerAutomaticamente } from '../lib/enrichment.js';
import {
  processPost, activeOpportunityTagNames, createRun, updateRun,
  discoveryTitleSimilarity,
} from '../sentinel.js';

// Busca os itens brutos de UM site, sem aplicar filtro nenhum ainda — cada
// método de coleta devolve o mesmo formato: [{ titulo, link, data, resumo, texto }].
// Sites 'listagem' (js/estatico) já vêm com a extração de IA embutida aqui,
// porque sem ela não existe "um item por candidato" — é só uma página inteira.
async function coletarItensBrutos(site, dias, supabase) {
  if (site.metodo === 'reddit') {
    // Subreddits agora vêm do banco (sentinel_reddit_subreddits, editável na
    // tela do Sentinel igual às contas de Instagram) — fetchActiveRedditSubreddits
    // cai pra lista fixa de redditScraper.js se a tabela estiver vazia/indisponível.
    const subreddits = await fetchActiveRedditSubreddits(supabase);
    return coletarReddit(subreddits); // já filtrado (scorePost) e pronto
  }
  if (site.metodo === 'wp') return coletarWp(site, dias);
  if (site.metodo === 'rss') return coletarRss(site, dias);
  if (site.metodo === 'js') {
    const pagina = await coletarJs(site.url);
    return extrairCandidatosDaListagem(pagina);
  }
  if (site.metodo === 'estatico') {
    const resposta = await fetch(site.url, { headers: { 'User-Agent': 'Mozilla/5.0 (compatible; AccessPlusBot/1.0)' }, signal: AbortSignal.timeout(30_000) });
    if (!resposta.ok) throw new Error(`HTTP ${resposta.status}`);
    const html = await resposta.text();
    const texto = html.replace(/<script[\s\S]*?<\/script>/gi, '').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 15_000);
    const links = [...html.matchAll(/<a\b[^>]*href\s*=\s*(["'])(.*?)\1[^>]*>([\s\S]*?)<\/a>/gi)]
      .map((m) => { try { return { href: new URL(m[2], site.url).toString(), texto: m[3].replace(/<[^>]+>/g, ' ').trim() }; } catch { return null; } })
      .filter(Boolean);
    return extrairCandidatosDaListagem({ texto, links });
  }
  throw new Error(`Método de coleta desconhecido: ${site.metodo}`);
}

// Sites 'listagem'/'reddit' já chegam pré-selecionados (a IA ou o score já
// decidiram o que é relevante) — não faz sentido rodar o filtro de palavra-chave
// de novo em cima disso, já que não sobrou o texto completo do post original.
function precisaDeFiltroDeTexto(site) {
  return site.tipo === 'feed' && site.metodo !== 'reddit';
}

const DEFAULT_MAX_CANDIDATES = 10;
const HARD_MAX_CANDIDATES = 25; // mesmo teto que o Sentinel do Instagram usa

function supabaseAdmin() {
  const url = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error('SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY precisam estar configuradas no servidor.');
  return createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
}

function cronAutorizado(req) {
  // Vercel Cron sends this automatically when CRON_SECRET is set on the project.
  if (!process.env.CRON_SECRET) return true; // no secret configured yet -> don't lock yourself out
  return (req.headers.authorization || '') === `Bearer ${process.env.CRON_SECRET}`;
}

// Mesma checagem que o /api/sentinel já usa para ações disparadas pelo admin:
// exige um usuário Supabase autenticado com role Admin ou Editor.
async function autorizarAdmin(req, supabase) {
  const token = String(req.headers.authorization || '').replace(/^Bearer\s+/i, '');
  if (!token) throw Object.assign(new Error('Sessão ausente.'), { statusCode: 401 });
  const { data, error } = await supabase.auth.getUser(token);
  if (error || !data.user?.email) throw Object.assign(new Error('Sessão inválida.'), { statusCode: 401 });
  const { data: admin } = await supabase.from('admins').select('role').eq('email', data.user.email).maybeSingle();
  if (!admin || !['Admin', 'Editor'].includes(admin.role)) {
    throw Object.assign(new Error('Apenas Admins e Editores podem rodar os scrapers.'), { statusCode: 403 });
  }
  return data.user;
}


function limitarCandidatos(body = {}) {
  return Math.max(1, Math.min(Number(body.maxCandidates) || DEFAULT_MAX_CANDIDATES, HARD_MAX_CANDIDATES));
}

// -----------------------------------------------------------------------------
// FASE 1 — COLLECT: busca + filtro de palavra-chave, sem gastar IA nenhuma.
// Só enfileira (`status: 'queued'`) pra um humano decidir depois o que vale a
// pena pesquisar de verdade.
// -----------------------------------------------------------------------------
export async function coletarCandidatos(supabase, { sites, userId } = {}) {
  const nomesEscolhidos = Array.isArray(sites) && sites.length ? sites.map((n) => n.toLowerCase()) : null;
  // Reddit é uma fonte normal na seleção, igual às outras — a UI já deixa ela
  // marcada por padrão, então continua rodando sem esforço extra, mas dá pra
  // desmarcar só ela (roda tudo, menos Reddit) ou deixar SÓ ela marcada
  // (roda apenas o Reddit, sem passar pelas outras fontes).
  const sitesAtivos = FONTES.filter((s) => s.ativo && (!nomesEscolhidos || nomesEscolhidos.includes(s.nome.toLowerCase())));
  if (sitesAtivos.length === 0) {
    throw Object.assign(new Error(nomesEscolhidos ? `Nenhuma das fontes escolhidas foi encontrada ou está ativa: ${sites.join(', ')}` : 'Nenhuma fonte ativa configurada.'), { statusCode: 404 });
  }

  // "Id levinho" pra cada título (slugTitulo: sem acento, sem palavra genérica tipo
  // "scholarship"/"international", tokens ordenados) — calculado aqui mesmo, sem IA.
  // Carrega de uma vez só os slugs já conhecidos, tanto do histórico do scraper
  // (sentinel_posts, qualquer status) quanto do catálogo já publicado/em revisão
  // (opportunities) — assim uma oportunidade que reaparece com OUTRA url (outra
  // fonte compartilhou o mesmo programa, ou voltou numa edição futura) é descartada
  // aqui na coleta, sem gastar nem um fetch de pesquisa, muito menos uma chamada de IA.
  const [{ data: postsExistentes, error: postsError }, { data: opsExistentes, error: opsError }, { data: rejeitadosRecentes, error: rejError }] = await Promise.all([
    supabase.from('sentinel_posts').select('title_slug').not('title_slug', 'is', null),
    supabase.from('opportunities').select('title'),
    // Só pra checagem de repetição "parecida" abaixo (ver PROVAVEL_REPETICAO_LIMIAR):
    // pega os últimos rejeitados/duplicados/falhados, título + link + motivo — não
    // precisa do `extracted` pesado, que já pode nem existir mais (ver
    // limparProcessadosAntigos, que zera esse campo depois de 7 dias).
    supabase.from('sentinel_posts').select('caption, source_url, error')
      .in('status', ['rejected', 'duplicate'])
      .order('updated_at', { ascending: false }).limit(500),
  ]);
  if (postsError) throw postsError;
  if (opsError) throw opsError;
  if (rejError) throw rejError;
  const slugsConhecidos = new Set([
    ...(postsExistentes || []).map((r) => r.title_slug).filter(Boolean),
    ...(opsExistentes || []).map((r) => slugTitulo(r.title)).filter(Boolean),
  ]);
  const rejeitadosParaComparar = (rejeitadosRecentes || []).map((r) => ({
    titulo: String(r.caption || '').split('\n')[0].trim(),
    url: r.source_url,
    motivo: r.error,
  })).filter((r) => r.titulo);

  // Repetição "parecida", não idêntica: o mesmo programa real, escrito com
  // palavras diferentes por sites diferentes (caso real: "FAWE Ghana
  // Mastercard Foundation Second Chance Pathways/Bursary Programme..." — 4
  // títulos diferentes, mesmo programa, cada rejeição virava um slugTitulo
  // diferente e não pegava no dedup exato acima). Usa a mesma função de
  // similaridade já usada pro dedup do Instagram (discoveryTitleSimilarity —
  // interseção de tokens relevantes / menor conjunto). NÃO descarta sozinho
  // (o projeto prefere deixar passar um duvidoso a esconder algo novo por
  // engano) — só marca um aviso na legenda pra quem revisar a fila decidir
  // rápido, sem gastar uma pesquisa de IA à toa num programa que já foi
  // rejeitado antes.
  const PROVAVEL_REPETICAO_LIMIAR = 0.55;
  function provavelRepeticao(titulo) {
    let melhor = null;
    for (const candidato of rejeitadosParaComparar) {
      const score = discoveryTitleSimilarity(candidato.titulo, titulo);
      if (score >= PROVAVEL_REPETICAO_LIMIAR && (!melhor || score > melhor.score)) {
        melhor = { score, ...candidato };
      }
    }
    return melhor;
  }

  const resumoFontes = [];
  let totalEnfileirado = 0;
  let houveFalha = false;

  for (const site of sitesAtivos) {
    // "descartados" registra POR QUE um item bruto não virou candidato — antes
    // isso era jogado fora (só `passaFiltro`'s `passou` era lido, o `motivo`
    // nunca era guardado), então não tinha como saber se o scraper achou uma
    // oportunidade de verdade e descartou por engano (filtro de palavra-chave
    // rígido demais) ou se a fonte genuinamente não tinha nada novo. Isso é
    // essencial pra responder "por que essa oportunidade não apareceu?".
    const info = {
      nome: site.nome, itensBrutos: 0, novosNaFila: 0, erro: null, aviso: null,
      descartados: { semLink: 0, filtro: 0, duplicataTitulo: 0, duplicataUrl: 0 },
      provaveisRepeticoes: 0,
    };
    try {
      const itens = await coletarItensBrutos(site, FILTROS.dias, supabase);
      info.itensBrutos = itens.length;
      if (itens.length === 0 && FONTES_SEMPRE_ATIVAS.has(site.nome.toLowerCase())) {
        info.aviso = '0 itens brutos numa fonte normalmente ativa — pode ter quebrado.';
      }

      const candidatos = [];
      for (const item of itens) {
        if (!item.link) { info.descartados.semLink += 1; continue; }
        if (precisaDeFiltroDeTexto(site)) {
          const { passou } = passaFiltro(item, FILTROS);
          if (!passou) { info.descartados.filtro += 1; continue; }
        }
        const slug = slugTitulo(item.titulo);
        // já visto nesta rodada (outro feed) OU já existe na fila/histórico/catálogo
        if (slug && slugsConhecidos.has(slug)) { info.descartados.duplicataTitulo += 1; continue; }
        if (slug) slugsConhecidos.add(slug);
        const repeticao = provavelRepeticao(item.titulo);
        if (repeticao) info.provaveisRepeticoes += 1;
        // Antes todo candidato do scraper de sites entrava com score fixo 0
        // (só o Instagram calculava um score de verdade) — usa as mesmas
        // listas de palavras do filtro (nível/financeiro/internacional) só
        // pra dar uma nota, sem mudar quem passa ou não (isso continua sendo
        // decisão do passaFiltro acima).
        const pontos = item.texto ? pontuarItem(item, FILTROS) : 0;
        candidatos.push({ ...item, _slug: slug, _repeticao: repeticao, _pontos: pontos });
      }

      // checagem por URL exata continua existindo também — cobre título sem
      // nenhum token útil (slug vazio) e evita reenfileirar a mesma URL de novo.
      const novos = [];
      for (const item of candidatos) {
        const { data: existente } = await supabase.from('sentinel_posts').select('id').eq('source_url', item.link).maybeSingle();
        if (!existente) novos.push(item);
        else info.descartados.duplicataUrl += 1;
      }

      if (novos.length) {
        const agora = new Date().toISOString();
        const { error } = await supabase.from('sentinel_posts').insert(novos.map((item) => {
          const aviso = item._repeticao
            ? `⚠ Provável repetição de uma oportunidade já rejeitada (${Math.round(item._repeticao.score * 100)}% de título parecido): "${item._repeticao.titulo}"${item._repeticao.motivo ? ` — motivo: ${item._repeticao.motivo}` : ''} ${item._repeticao.url || ''}\n\n`
            : '';
          return {
            source_url: item.link, source_type: 'web', owner_username: site.nome,
            // aviso vai DEPOIS do título (não antes) pra não bagunçar quem lê
            // a primeira linha da caption como o título da oportunidade.
            caption: `${item.titulo}\n\n${aviso}${item.resumo || ''}`.slice(0, 4000), posted_at: item.data || agora,
            score: item._pontos || 0, status: 'queued', error: null, processed_at: null, updated_at: agora,
            title_slug: item._slug || null,
          };
        }));
        if (error) throw error;
      }
      info.novosNaFila = novos.length;
      totalEnfileirado += novos.length;
    } catch (error) {
      info.erro = error.message;
      houveFalha = true;
    }
    resumoFontes.push(info);
  }

  return { fase: 'collect', totalEnfileirado, fontes: resumoFontes, houveFalha };
}

// -----------------------------------------------------------------------------
// FASE 2 — RESEARCH: só roda para candidatos que um humano pediu explicitamente
// (via postIds) ou para os N mais antigos da fila (maxCandidates) — nunca
// disparada sozinha pelo cron.
//
// `runId`, se passado, é checado entre um item e outro (ver
// deveCancelar abaixo) — permite cancelar uma pesquisa em andamento (ação
// 'cancel_research') sem esperar os itens já em fila terminarem todos.
// -----------------------------------------------------------------------------
// Tamanho de cada pedaço reivindicado por vez, e quanto tempo (dos 300s de
// maxDuration do Vercel, ver vercel.json) esta função pode gastar reivindicando
// pedaços novos antes de parar sozinha e devolver o resto pra fila. Antes,
// pesquisarCandidatos reivindicava HARD_MAX_CANDIDATES (25) inteiro de uma vez
// só; se a function morresse no meio (host mata o processo, nenhum
// catch/finally roda), os itens ainda não processados ficavam presos em
// 'pending' pra sempre — o mesmo problema que já tinha acontecido do lado do
// Instagram (ver MAX_DISCOVERY_CANDIDATES em api/sentinel.js, caso real de
// 2026-08-19). Processar em pedaços de CHUNK_SIZE, parando entre um pedaço e
// outro conforme o tempo já gasto (em vez de um número fixo chutado), deixa
// isso seguro pra qualquer tamanho de fila.
const CHUNK_SIZE = 10;
const RESEARCH_TIME_BUDGET_MS = 240_000; // reserva ~60s dos 300s pra fechar a resposta com folga

export async function pesquisarCandidatos(supabase, { postIds, maxCandidates, userId, runId = null } = {}) {
  const usandoIdsExplicitos = Array.isArray(postIds) && postIds.length > 0;
  const restantesExplicitos = usandoIdsExplicitos ? [...postIds] : null;
  const teto = usandoIdsExplicitos
    ? postIds.length
    : Math.max(1, Math.min(Number(maxCandidates) || DEFAULT_MAX_CANDIDATES, HARD_MAX_CANDIDATES));

  const allowedTags = await activeOpportunityTagNames(supabase);

  // Cancelamento cooperativo: olha se alguém marcou esse run como
  // 'cancelling' (ação 'cancel_research') — checado tanto entre um pedaço e
  // outro quanto entre um item e outro dentro do próprio pedaço.
  let cancelado = false;
  async function deveCancelar() {
    if (!runId || cancelado) return cancelado;
    const { data } = await supabase.from('sentinel_research_runs').select('status').eq('id', runId).maybeSingle();
    if (data?.status === 'cancelling') cancelado = true;
    return cancelado;
  }

  const deadline = Date.now() + RESEARCH_TIME_BUDGET_MS;
  const processados = [];
  let totalClaimed = 0;
  let stoppedForTime = false;
  let naoIniciadosTotal = 0;

  while (totalClaimed < teto) {
    if (await deveCancelar()) break;
    if (Date.now() >= deadline) { stoppedForTime = true; break; }
    const take = Math.min(CHUNK_SIZE, teto - totalClaimed);

    let candidatosPedaço;
    if (usandoIdsExplicitos) {
      const idsPedaço = restantesExplicitos.splice(0, take);
      if (!idsPedaço.length) break;
      const { data, error } = await supabase.from('sentinel_posts').select('*').in('id', idsPedaço).eq('status', 'queued');
      if (error) throw error;
      candidatosPedaço = data || [];
      if (!candidatosPedaço.length) continue; // esses ids já não estão mais 'queued' — segue pro próximo pedaço
    } else {
      // SEM filtro de source_type: processa qualquer coisa 'queued', seja de
      // site (web) ou Instagram. Antes só pegava 'web' — então um clique em
      // "Processar fila" sem a fonte de Instagram marcada relatava "0 itens
      // analisados" mesmo com dezenas de posts do Instagram esperando na
      // fila (processPost já trata os dois tipos igual; a origem só muda
      // COMO um item chegou na fila, não como ele é processado).
      const { data, error } = await supabase.from('sentinel_posts').select('*')
        .eq('status', 'queued')
        .order('created_at', { ascending: true }).limit(take);
      if (error) throw error;
      candidatosPedaço = data || [];
      if (!candidatosPedaço.length) break; // fila vazia — nada mais a fazer
    }

    // Reivindica as linhas (queued -> pending) antes de processar, igual ao fluxo
    // do Instagram — evita que duas pessoas peçam pesquisa do mesmo item ao mesmo tempo.
    const ids = candidatosPedaço.map((r) => r.id);
    const { data: reivindicadas, error: claimError } = await supabase.from('sentinel_posts')
      .update({ status: 'pending', updated_at: new Date().toISOString(), run_id: runId })
      .in('id', ids).eq('status', 'queued').select('*');
    if (claimError) throw claimError;
    const fonte = reivindicadas || [];
    if (!fonte.length) continue;
    totalClaimed += fonte.length;

    const naoIniciados = [];
    let cursor = 0;
    async function worker() {
      while (cursor < fonte.length) {
        if (await deveCancelar()) {
          while (cursor < fonte.length) naoIniciados.push(fonte[cursor++]);
          return;
        }
        const index = cursor++;
        const row = fonte[index];
        // Bug real (2026-08-20): estava manual=true com { url: row.source_url,
        // ... } — processPost, quando manual=true, usa post.url tanto como
        // sourceUrl quanto como officialUrl, IGNORANDO POR COMPLETO a caption.
        // Pra posts de Instagram (ex.: VII Zendal Awards, id 441 — caption
        // trazia "Details: https://opd.to/4hb28mQ | Deadline: Sept 20"), isso
        // descartava o link oficial de verdade E o texto da caption (nem
        // entrava como leadSource, porque leadSource.url virava igual ao da
        // fonte primária) — a pesquisa via só a própria página do Instagram
        // (que costuma vir vazia/bloqueada), perdendo link oficial, prazo e
        // pistas de elegibilidade que estavam bem ali na legenda. manual=false
        // faz processPost extrair o link da caption primeiro (extractUrl) e
        // cair pra sourceUrl só se a caption não tiver nenhum link — igual ao
        // que runDiscovery já faz certo pro fluxo do Instagram em sentinel.js.
        const resultado = await processPost(
          supabase,
          { sourceUrl: row.source_url, caption: row.caption, ownerUsername: row.owner_username },
          runId, false, allowedTags,
        );
        processados.push({ row, resultado });
      }
    }
    await Promise.all(Array.from({ length: Math.min(3, fonte.length) }, () => worker()));

    if (naoIniciados.length) {
      naoIniciadosTotal += naoIniciados.length;
      await supabase.from('sentinel_posts')
        .update({ status: 'queued', updated_at: new Date().toISOString(), run_id: null })
        .in('id', naoIniciados.map((r) => r.id));
      break; // cancelado — não tenta mais pedaços
    }
    if (fonte.length < take && !usandoIdsExplicitos) break; // a fila esgotou nesse pedaço
  }

  if (processados.length === 0) {
    // Precisa vir com os mesmos campos numéricos do retorno "normal" abaixo
    // (qualificados/duplicados/rejeitados/falhados) — o handler em
    // api/cron/scrape-sources.js soma resultado.qualificados +
    // resultado.duplicados direto no updateRun de succeeded_count; campo
    // faltando aqui virava "undefined + undefined" (NaN), que o Supabase
    // serializa como null e violava a constraint NOT NULL da coluna.
    return {
      fase: 'research', processados: 0, resultados: [], detalhes: [],
      qualificados: 0, duplicados: 0, rejeitados: 0, falhados: 0,
      cancelado, naoIniciados: naoIniciadosTotal, stoppedForTime,
    };
  }

  const resultados = processados.map((p) => p.resultado);
  const falhados = resultados.filter((r) => r.status === 'failed').length;

  // Detalhe por item — título, link, veredito e motivo — pra "Execuções"
  // conseguir mostrar de verdade por que cada candidato foi rejeitado/falhou,
  // em vez de só um número agregado (que não respondia "por que essa
  // rejeitou?" sem ir direto no banco).
  const detalhes = processados.map(({ row, resultado }) => ({
    title: String(row.caption || '').split('\n')[0].slice(0, 200),
    source_url: row.source_url,
    owner_username: row.owner_username,
    status: resultado.status,
    reason: resultado.status === 'duplicate' ? (resultado.duplicateReason || null) : (resultado.error || null),
    opportunity_id: resultado.opportunity?.id || null,
  }));

  return {
    fase: 'research', processados: resultados.length,
    qualificados: resultados.filter((r) => r.status === 'qualified').length,
    duplicados: resultados.filter((r) => r.status === 'duplicate').length,
    rejeitados: resultados.filter((r) => r.status === 'rejected').length,
    falhados,
    cancelado,
    stoppedForTime,
    naoIniciados: naoIniciadosTotal,
    detalhes,
  };
}

// -----------------------------------------------------------------------------
// DELETE — remove linhas já processadas (qualified/duplicate/rejected/failed)
// da tabela "Já pesquisados" pra ela não crescer sem limite. NUNCA remove uma
// linha com status "pending" (pesquisa em andamento) ou "queued" (ainda na
// fila) — só um jeito de limpar o histórico, não de cancelar uma pesquisa.
// -----------------------------------------------------------------------------
export async function deletarCandidatos(supabase, { postIds } = {}) {
  if (!Array.isArray(postIds) || postIds.length === 0) {
    throw Object.assign(new Error('Nenhum candidato selecionado para excluir.'), { statusCode: 400 });
  }
  const { data: excluidos, error } = await supabase.from('sentinel_posts')
    .delete().in('id', postIds).neq('status', 'pending').select('id');
  if (error) throw error;
  return { excluidos: (excluidos || []).length };
}

// -----------------------------------------------------------------------------
// LIMPEZA — chamada a cada "Coletar" manual (a pessoa decide rodar isso, no
// ritmo que quiser — sem cron diário automático, ver vercel.json). Só apaga
// "lixo" que não vira catálogo: rejected/duplicate/failed com mais de 7 dias
// (7, não 30 — combina com o ritmo semanal de revisão manual: cada vez que
// alguém volta pra coletar, o lixo da semana anterior já pode sair).
// "qualified" NUNCA é tocado aqui — essas linhas já viraram uma oportunidade
// em `opportunities` e servem de histórico/auditoria. "queued"/"pending"
// também nunca são tocados: são trabalho ainda não feito ou em andamento.
// -----------------------------------------------------------------------------
const RETENCAO_DIAS_PROCESSADOS = 7;

// MUDANÇA IMPORTANTE (bug real, achado com dado de produção): isso costumava
// ser um DELETE de verdade. Só que o dedup da coleta (`coletarCandidatos`
// acima) decide "já vi isso antes?" lendo exatamente `title_slug` desta
// mesma tabela — apagar a linha apaga também a memória de que aquele título
// já foi rejeitado. Resultado: a MESMA oportunidade (ex.: "FAWE Ghana
// Mastercard Foundation..." — 4 fontes diferentes escreveram o título de 4
// jeitos diferentes, cada um com seu próprio title_slug) podia ser
// coletada, pesquisada (gasta IA) e rejeitada de novo, indefinidamente, toda
// vez que a limpeza de 7 dias passava.
//
// Em vez de apagar a linha inteira, "arquiva": zera só o campo pesado
// (`extracted`, que carrega todo o rastro de fontes/páginas buscadas — o
// que realmente fazia a tabela crescer), mas MANTÉM source_url, title_slug,
// status e o motivo curto (`error`) para sempre. Isso preserva a memória de
// dedup sem acumular dado pesado — exatamente o equilíbrio que faltava.
export async function limparProcessadosAntigos(supabase) {
  const limite = new Date(Date.now() - RETENCAO_DIAS_PROCESSADOS * 24 * 60 * 60 * 1000).toISOString();
  const { data, error } = await supabase.from('sentinel_posts')
    .update({ extracted: null })
    .in('status', ['rejected', 'duplicate', 'failed'])
    .lt('updated_at', limite)
    .not('extracted', 'is', null)
    .select('id');
  if (error) throw error;
  return (data || []).length;
}

// -----------------------------------------------------------------------------
// ENRIQUECIMENTO AUTOMÁTICO — roda sozinho dentro do cron diário, depois da
// coleta. Não guarda nenhum marcador de "já tentei" no banco (de propósito,
// pra não precisar de mais uma coluna): em vez disso, só olha oportunidades
// que ficaram "Aprovada" recentemente (updated_at dentro da janela abaixo).
// Como o cron roda 1x/dia, isso já dá, na prática, uma única tentativa
// automática perto do momento da aprovação — depois que a janela passa, a
// oportunidade nunca mais entra aqui sozinha; se um voluntário quiser tentar
// de novo (ou pela primeira vez, se passou da janela), o botão "Enriquecer"
// na própria oportunidade continua disponível a qualquer momento.
//
// Roda sequencial (não em paralelo) e com um teto por dia, pra não estourar o
// tempo de execução da function (300s) nem gerar um pico de custo de IA de
// uma vez.
// `opportunities` não tem coluna `updated_at` (só `created_at`, gravado na
// criação — não muda quando o status passa de "Revisar" pra "Aprovada" depois).
// Sem criar coluna nova, `created_at` é a aproximação disponível: cobre bem o
// caso comum (aprovação acontece pouco depois da criação). Se uma oportunidade
// for aprovada bem depois dessa janela, o automático não pega — mas o botão
// manual "Enriquecer" sempre resolve isso na hora.
const JANELA_ENRIQUECIMENTO_AUTOMATICO_HORAS = 72;
const MAX_ENRIQUECIMENTOS_AUTOMATICOS_POR_DIA = 8;

export async function enriquecerAprovadasAutomaticamente(supabase) {
  const desde = new Date(Date.now() - JANELA_ENRIQUECIMENTO_AUTOMATICO_HORAS * 60 * 60 * 1000).toISOString();
  const { data: candidatas, error } = await supabase.from('opportunities')
    .select('id, title')
    .eq('status', 'Aprovada')
    .gte('created_at', desde)
    .order('created_at', { ascending: true })
    .limit(MAX_ENRIQUECIMENTOS_AUTOMATICOS_POR_DIA);
  if (error) throw error;
  if (!candidatas || candidatas.length === 0) {
    return { tentadas: 0, adicionadas: 0, falhas: [] };
  }

  let adicionadas = 0;
  const falhas = [];
  for (const opp of candidatas) {
    try {
      const resultado = await enriquecerAutomaticamente(supabase, opp.id);
      adicionadas += resultado.adicionados;
    } catch (e) {
      // Só loga — nunca trava o resto da coleta do cron.
      falhas.push({ id: opp.id, title: opp.title, erro: e.message });
    }
  }
  return { tentadas: candidatas.length, adicionadas, falhas };
}

export default async function handler(req, res) {
  let supabase;
  try {
    supabase = supabaseAdmin();
  } catch (error) {
    res.status(500).json({ error: error.message });
    return;
  }

  try {
    if (req.method === 'GET') {
      // Rota do cron diário automático — DESLIGADA a pedido (removemos a
      // entrada em vercel.json). A Vercel não chama mais isso sozinha; a
      // pessoa agora decide manualmente quando coletar/pesquisar (tela Web),
      // no ritmo que preferir (ex.: uma vez por semana), em vez de rodar
      // sem supervisão todo dia. Deixamos o código aqui só como referência
      // caso um cron seja religado no futuro — sem entrada em vercel.json,
      // esta rota nunca é chamada automaticamente (cronAutorizado também
      // continua exigindo o segredo do cron, então não dá pra disparar isso
      // sem querer pela UI).
      if (!cronAutorizado(req)) { res.status(401).json({ error: 'Não autorizado.' }); return; }
      // Limpeza automática é "best-effort": se falhar, não deve travar a coleta do dia.
      let limpezaAutomatica = 0;
      try {
        limpezaAutomatica = await limparProcessadosAntigos(supabase);
      } catch (error) {
        console.error('Limpeza automática de sentinel_posts falhou:', error.message);
      }
      const resultado = await coletarCandidatos(supabase, {});
      // Pesquisa automática também é "best-effort": uma falha aqui não deve
      // impedir o resto do cron (limpeza/enriquecimento) de rodar.
      let pesquisaAutomatica = { fase: 'research', processados: 0, resultados: [] };
      try {
        pesquisaAutomatica = await pesquisarCandidatos(supabase, { maxCandidates: HARD_MAX_CANDIDATES });
      } catch (error) {
        console.error('Pesquisa automática de candidatos web falhou:', error.message);
      }
      // Enriquecimento automático também é "best-effort": nunca deve travar a
      // coleta do dia se Serper/YouTube/Reddit ou a IA falharem.
      let enriquecimentoAutomatico = { tentadas: 0, adicionadas: 0, falhas: [] };
      try {
        enriquecimentoAutomatico = await enriquecerAprovadasAutomaticamente(supabase);
      } catch (error) {
        console.error('Enriquecimento automático falhou:', error.message);
      }
      res.status(200).json({ ...resultado, pesquisaAutomatica, limpezaAutomatica, enriquecimentoAutomatico });
      return;
    }
    if (req.method === 'POST') {
      const user = await autorizarAdmin(req, supabase);
      const action = req.body?.action || 'collect';
      if (action === 'collect') {
        // Limpeza do lixo antigo (rejected/duplicate/failed com mais de 7
        // dias) roda junto com o "Coletar" manual — não trava a coleta se
        // falhar, só registra no console.
        let limpeza = 0;
        try { limpeza = await limparProcessadosAntigos(supabase); }
        catch (error) { console.error('Limpeza de sentinel_posts falhou:', error.message); }
        const resultado = await coletarCandidatos(supabase, { sites: req.body?.sites || null, userId: user.id });
        res.status(200).json({ ...resultado, limpeza });
        return;
      }
      if (action === 'research_start') {
        // Só cria a linha em "Execuções" e devolve o id na hora — separado da
        // ação 'research' de propósito, pra o navegador já saber o runId
        // ANTES de esperar a pesquisa inteira terminar. Sem isso, o botão
        // "Cancelar" não teria como saber qual run cancelar enquanto o
        // pedido de pesquisa (que pode levar minutos) ainda está em voo.
        const postIds = req.body?.postIds;
        const maxCandidates = limitarCandidatos(req.body);
        const run = await createRun(supabase, user, 'web_research', Array.isArray(postIds) ? postIds.length : maxCandidates, {
          post_ids: postIds || null, max_candidates: maxCandidates,
        });
        res.status(200).json({ runId: run.id });
        return;
      }
      if (action === 'research') {
        // Antes essa ação nem aparecia em "Execuções" — só Instagram, revisão
        // de catálogo e enriquecimento eram registrados ali. Isso escondia
        // exatamente o que mais roda (pesquisa dos candidatos do scraper de
        // sites): sem run, não tinha como ver depois quais itens falharam e
        // por quê sem ir direto no banco. Agora fica registrado igual aos
        // outros tipos, com o detalhe por item (título, link, veredito,
        // motivo) guardado em metadata.detalhes.
        //
        // runId pode vir pronto do body (fluxo novo: o front chama
        // 'research_start' primeiro, guarda o id, e só então chama isso aqui
        // — assim consegue cancelar no meio) — se não vier, cria aqui mesmo
        // (fluxo antigo/cron, que não precisa cancelar).
        const postIds = req.body?.postIds;
        const maxCandidates = limitarCandidatos(req.body);
        const run = req.body?.runId
          ? { id: req.body.runId }
          : await createRun(supabase, user, 'web_research', Array.isArray(postIds) ? postIds.length : maxCandidates, {
            post_ids: postIds || null, max_candidates: maxCandidates,
          });
        try {
          const resultado = await pesquisarCandidatos(supabase, {
            postIds, maxCandidates, userId: user.id, runId: run.id,
          });
          await updateRun(supabase, run.id, {
            status: resultado.cancelado ? 'cancelled' : (resultado.falhados > 0 ? 'partial' : 'completed'),
            processed_count: resultado.processados,
            succeeded_count: resultado.qualificados + resultado.duplicados,
            failed_count: resultado.falhados,
            completed_at: new Date().toISOString(),
            metadata: {
              post_ids: postIds || null, max_candidates: maxCandidates,
              qualificados: resultado.qualificados, duplicados: resultado.duplicados,
              rejeitados: resultado.rejeitados, falhados: resultado.falhados,
              cancelado: resultado.cancelado, nao_iniciados: resultado.naoIniciados,
              detalhes: resultado.detalhes,
            },
          });
          res.status(200).json({ ...resultado, runId: run.id });
        } catch (error) {
          await updateRun(supabase, run.id, {
            status: 'failed', completed_at: new Date().toISOString(), error: String(error.message || error).slice(0, 2000),
          }).catch(() => {});
          throw error;
        }
        return;
      }
      if (action === 'cancel_research') {
        // Cancelamento cooperativo (ver pesquisarCandidatos/deveCancelar):
        // marca a run como "cancelling" — o próprio loop de pesquisa em
        // andamento (se ainda estiver rodando na mesma invocação da function)
        // vê isso entre um item e outro e para de pegar itens novos,
        // devolvendo o resto pra fila. Itens já em andamento no momento do
        // clique terminam normalmente (não dá pra abortar um fetch/chamada de
        // IA no meio).
        //
        // Além disso, libera NA HORA qualquer item dessa run que já esteja
        // preso em "pending" — cobre o caso da function ter morrido por
        // timeout (300s do vercel.json) antes de devolver os itens pra fila
        // sozinha. Antes existia um botão genérico "Destravar pendentes" que
        // soltava qualquer coisa presa há 10 minutos em qualquer execução;
        // ficou confuso e desnecessário. Cancelar uma execução específica já
        // resolve isso pra ela, sem mexer nas outras.
        const runId = req.body?.runId;
        if (!runId) { res.status(400).json({ error: 'runId é obrigatório.' }); return; }
        await updateRun(supabase, runId, { status: 'cancelling' });
        const { data: liberados, error: liberarError } = await supabase.from('sentinel_posts')
          .update({ status: 'queued', updated_at: new Date().toISOString(), run_id: null })
          .eq('run_id', runId).eq('status', 'pending').select('id');
        if (liberarError) throw liberarError;
        res.status(200).json({ ok: true, liberados: (liberados || []).length });
        return;
      }
      if (action === 'delete') {
        const resultado = await deletarCandidatos(supabase, { postIds: req.body?.postIds });
        res.status(200).json(resultado);
        return;
      }
      if (action === 'enrich') {
        const resultado = await buscarCandidatosDeEnriquecimento(supabase, req.body?.opportunityId);
        res.status(200).json(resultado);
        return;
      }
      if (action === 'enrich_confirm') {
        const resultado = await confirmarEnriquecimento(supabase, req.body?.opportunityId, req.body?.resources);
        res.status(200).json(resultado);
        return;
      }
      if (action === 'enrich_auto') {
        // Disparado pelo frontend no exato momento em que uma oportunidade é
        // aprovada (App.jsx/Sentinel.jsx) ou pelo botão "Enriquecer agora" —
        // antes isso só rodava dentro do cron diário (que já não existe
        // mais), pra oportunidades aprovadas nas últimas 72h. Mesma lógica
        // (Serper + YouTube + Reddit, só entra no catálogo o que a IA marcar
        // "sugerido"+"confiança alta"), só que na hora certa em vez de
        // esperar uma janela de tempo.
        //
        // Cada chamada fica registrada em "Execuções" (mesma tabela usada
        // pelo Instagram/Web/Revisão de catálogo) — só as 15 execuções mais
        // recentes de qualquer tipo ficam guardadas (ver createRun).
        const opportunityId = req.body?.opportunityId;
        const run = await createRun(supabase, user, 'enrichment', 1, { opportunity_id: opportunityId });
        try {
          const resultado = await enriquecerAutomaticamente(supabase, opportunityId);
          // Caso real (2026-08-21, Huawei ICT Competition): Reddit respondeu
          // 429 (rate limit) mas Serper e YouTube acharam 5 links bons, todos
          // avaliados normalmente — mesmo assim a execução aparecia como
          // "Parcial"/"1 FALHA" só porque `errors` tinha a entrada do Reddit,
          // por mais que nada de útil tivesse se perdido de verdade. Uma
          // fonte falhar (rate limit, timeout) não é o mesmo que a execução
          // ter falhado: só é "partial"/falha de verdade quando NENHUM
          // candidato foi avaliado (as fontes que funcionaram também não
          // acharam nada) — se pelo menos uma fonte trouxe resultado, a
          // execução é "completed", e o erro da fonte que falhou continua
          // registrado em metadata.errors só como informação, não como falha
          // da execução inteira.
          const semNenhumResultadoUtil = Boolean(resultado.errors) && resultado.avaliados === 0;
          await updateRun(supabase, run.id, {
            status: semNenhumResultadoUtil ? 'partial' : 'completed',
            processed_count: 1,
            succeeded_count: semNenhumResultadoUtil ? 0 : 1,
            failed_count: semNenhumResultadoUtil ? 1 : 0,
            completed_at: new Date().toISOString(),
            metadata: {
              opportunity_id: opportunityId,
              opportunity_title: resultado.opportunityTitle,
              links: resultado.links,
              avaliados: resultado.avaliados,
              ignorados: resultado.ignorados,
              errors: resultado.errors,
            },
          });
          res.status(200).json(resultado);
        } catch (enrichError) {
          await updateRun(supabase, run.id, {
            status: 'failed', completed_at: new Date().toISOString(), error: String(enrichError.message || enrichError).slice(0, 2000),
          }).catch(() => {});
          throw enrichError;
        }
        return;
      }
      res.status(400).json({ error: `Ação desconhecida: ${action}` });
      return;
    }
    res.status(405).json({ error: 'Method not allowed' });
  } catch (error) {
    res.status(error.statusCode || 500).json({ error: error.message || 'Erro ao rodar o scraper.' });
  }
}
