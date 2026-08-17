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
import { passaFiltro, slugTitulo } from '../lib/scraperFilters.js';
import { extrairCandidatosDaListagem } from '../lib/listingExtractor.js';
import { coletarReddit } from '../lib/redditScraper.js';
import { buscarCandidatosDeEnriquecimento, confirmarEnriquecimento, enriquecerAutomaticamente } from '../lib/enrichment.js';
import {
  processPost, activeOpportunityTagNames,
} from '../sentinel.js';

// Busca os itens brutos de UM site, sem aplicar filtro nenhum ainda — cada
// método de coleta devolve o mesmo formato: [{ titulo, link, data, resumo, texto }].
// Sites 'listagem' (js/estatico) já vêm com a extração de IA embutida aqui,
// porque sem ela não existe "um item por candidato" — é só uma página inteira.
async function coletarItensBrutos(site, dias) {
  if (site.metodo === 'reddit') return coletarReddit(); // já filtrado (scorePost) e pronto
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
  const [{ data: postsExistentes, error: postsError }, { data: opsExistentes, error: opsError }] = await Promise.all([
    supabase.from('sentinel_posts').select('title_slug').not('title_slug', 'is', null),
    supabase.from('opportunities').select('title'),
  ]);
  if (postsError) throw postsError;
  if (opsError) throw opsError;
  const slugsConhecidos = new Set([
    ...(postsExistentes || []).map((r) => r.title_slug).filter(Boolean),
    ...(opsExistentes || []).map((r) => slugTitulo(r.title)).filter(Boolean),
  ]);

  const resumoFontes = [];
  let totalEnfileirado = 0;
  let houveFalha = false;

  for (const site of sitesAtivos) {
    const info = { nome: site.nome, itensBrutos: 0, novosNaFila: 0, erro: null, aviso: null };
    try {
      const itens = await coletarItensBrutos(site, FILTROS.dias);
      info.itensBrutos = itens.length;
      if (itens.length === 0 && FONTES_SEMPRE_ATIVAS.has(site.nome.toLowerCase())) {
        info.aviso = '0 itens brutos numa fonte normalmente ativa — pode ter quebrado.';
      }

      const candidatos = [];
      for (const item of itens) {
        if (!item.link) continue;
        if (precisaDeFiltroDeTexto(site)) {
          const { passou } = passaFiltro(item, FILTROS);
          if (!passou) continue;
        }
        const slug = slugTitulo(item.titulo);
        // já visto nesta rodada (outro feed) OU já existe na fila/histórico/catálogo
        if (slug && slugsConhecidos.has(slug)) continue;
        if (slug) slugsConhecidos.add(slug);
        candidatos.push({ ...item, _slug: slug });
      }

      // checagem por URL exata continua existindo também — cobre título sem
      // nenhum token útil (slug vazio) e evita reenfileirar a mesma URL de novo.
      const novos = [];
      for (const item of candidatos) {
        const { data: existente } = await supabase.from('sentinel_posts').select('id').eq('source_url', item.link).maybeSingle();
        if (!existente) novos.push(item);
      }

      if (novos.length) {
        const agora = new Date().toISOString();
        const { error } = await supabase.from('sentinel_posts').insert(novos.map((item) => ({
          source_url: item.link, source_type: 'web', owner_username: site.nome,
          caption: `${item.titulo}\n\n${item.resumo || ''}`.slice(0, 4000), posted_at: item.data || agora,
          score: 0, status: 'queued', error: null, processed_at: null, updated_at: agora,
          title_slug: item._slug || null,
        })));
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
// -----------------------------------------------------------------------------
export async function pesquisarCandidatos(supabase, { postIds, maxCandidates, userId } = {}) {
  let fila;
  if (Array.isArray(postIds) && postIds.length) {
    const { data, error } = await supabase.from('sentinel_posts').select('*').in('id', postIds).eq('status', 'queued');
    if (error) throw error;
    fila = data || [];
  } else {
    const limite = Math.max(1, Math.min(Number(maxCandidates) || DEFAULT_MAX_CANDIDATES, HARD_MAX_CANDIDATES));
    const { data, error } = await supabase.from('sentinel_posts').select('*')
      .eq('status', 'queued').eq('source_type', 'web')
      .order('created_at', { ascending: true }).limit(limite);
    if (error) throw error;
    fila = data || [];
  }

  if (fila.length === 0) {
    return { fase: 'research', processados: 0, resultados: [] };
  }

  // Reivindica as linhas (queued -> pending) antes de processar, igual ao fluxo
  // do Instagram — evita que duas pessoas peçam pesquisa do mesmo item ao mesmo tempo.
  const ids = fila.map((r) => r.id);
  const { data: reivindicadas, error: claimError } = await supabase.from('sentinel_posts')
    .update({ status: 'pending', updated_at: new Date().toISOString() })
    .in('id', ids).eq('status', 'queued').select('*');
  if (claimError) throw claimError;

  const allowedTags = await activeOpportunityTagNames(supabase);
  const resultados = await withConcurrency(reivindicadas || [], 3, (row) => processPost(
    supabase,
    { url: row.source_url, caption: row.caption, ownerUsername: row.owner_username },
    null, true, allowedTags,
  ));

  const falhados = resultados.filter((r) => r.status === 'failed').length;

  return {
    fase: 'research', processados: resultados.length,
    qualificados: resultados.filter((r) => r.status === 'qualified').length,
    duplicados: resultados.filter((r) => r.status === 'duplicate').length,
    rejeitados: resultados.filter((r) => r.status === 'rejected').length,
    falhados,
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
// LIMPEZA AUTOMÁTICA — roda sozinha dentro do cron diário (fase de coleta),
// sem precisar de nenhuma ação manual. Só apaga "lixo" que não vira catálogo:
// rejected/duplicate/failed com mais de 30 dias. "qualified" NUNCA é tocado
// aqui — essas linhas já viraram uma oportunidade em `opportunities` e servem
// de histórico/auditoria. "queued"/"pending" também nunca são tocados: são
// trabalho ainda não feito ou em andamento.
// -----------------------------------------------------------------------------
const RETENCAO_DIAS_PROCESSADOS = 30;

export async function limparProcessadosAntigos(supabase) {
  const limite = new Date(Date.now() - RETENCAO_DIAS_PROCESSADOS * 24 * 60 * 60 * 1000).toISOString();
  const { data, error } = await supabase.from('sentinel_posts')
    .delete()
    .in('status', ['rejected', 'duplicate', 'failed'])
    .lt('updated_at', limite)
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
      // Coleta (barata) + pesquisa (a etapa com IA) rodam sozinhas todo dia,
      // até um teto (RESEARCH_DIARIO_MAX) — antes a pesquisa exigia alguém
      // escolher manualmente na tela "Web" a cada vez; agora a fila que
      // sobra depois do filtro de duplicata/relevância (coletarCandidatos)
      // já vem enxuta o suficiente pra rodar sem supervisão, com o mesmo
      // teto que o Instagram sempre usou (HARD_MAX_CANDIDATES).
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
        const resultado = await coletarCandidatos(supabase, { sites: req.body?.sites || null, userId: user.id });
        res.status(200).json(resultado);
        return;
      }
      if (action === 'research') {
        const resultado = await pesquisarCandidatos(supabase, {
          postIds: req.body?.postIds, maxCandidates: limitarCandidatos(req.body), userId: user.id,
        });
        res.status(200).json(resultado);
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
      res.status(400).json({ error: `Ação desconhecida: ${action}` });
      return;
    }
    res.status(405).json({ error: 'Method not allowed' });
  } catch (error) {
    res.status(error.statusCode || 500).json({ error: error.message || 'Erro ao rodar o scraper.' });
  }
}
