// src/lib/newsletterRecords.js
//
// Regras e formatos da newsletter que não dependem do cliente Supabase do
// navegador — compartilhados entre a tela Newsletter (via
// src/lib/newsletters.js) e o servidor MCP (mcp/server.js), para que os dois
// gravem exatamente o mesmo formato e escolham oportunidades pelas mesmas
// regras. Imports com extensão .js de propósito: o Node (servidor MCP) não
// resolve import sem extensão, o Vite aceita os dois.
import { slugify } from './newsletterHtml.js';
import { isDeadlineWithinNextMonth } from './deadline.js';

export const DEFAULT_ISSUE = {
  title: '',
  subject: '',
  preheader: '',
  intro: 'Oi! Separamos as melhores oportunidades da semana para você que busca as próprias oportunidades.',
  outro: 'E até mais!',
  campaign_slug: '',
  status: 'draft',
  beehiiv_url: '',
  scheduled_at: null,
  published_at: null,
};

// Trava de 1 ano: uma oportunidade enviada numa edição PUBLICADA não volta a
// ser oferecida por 365 dias a partir do envio (ver comentário na tela
// Newsletter).
export const NEWSLETTER_REPEAT_WINDOW_MS = 365 * 24 * 60 * 60 * 1000;

export function isRecentlyFeatured(info, now = Date.now()) {
  return !!info?.date && (now - new Date(info.date).getTime()) < NEWSLETTER_REPEAT_WINDOW_MS;
}

// Mesmo filtro da lista "catálogo aprovado" da tela Newsletter, mas sobre a
// linha crua de `opportunities` (status 'Aprovada' = 'Publicada' na tela).
// Devolve a lista de motivos pelos quais a oportunidade NÃO entra; vazia = ok.
export function newsletterIneligibilityReasons(row, lastFeatured = null, today = new Date()) {
  const reasons = [];
  if (row?.status !== 'Aprovada') reasons.push(`status é "${row?.status || 'vazio'}", não "Aprovada"`);
  if (row?.qualification_status === 'unqualified') reasons.push('marcada como não qualificada para jovens brasileiros');
  if (!isDeadlineWithinNextMonth(row?.deadline, today)) reasons.push(`prazo "${row?.deadline || 'vazio'}" não cai entre hoje e o fim do próximo mês`);
  if (isRecentlyFeatured(lastFeatured, today.getTime())) reasons.push(`já enviada numa edição publicada em ${String(lastFeatured.date).slice(0, 10)} ("${lastFeatured.title}") — trava de 1 ano`);
  return reasons;
}

// Linhas de newsletter_entries (com o join do issue) -> { [opportunity_id]: { date, title } }
export function lastFeaturedFromRows(rows = []) {
  return rows.reduce((map, row) => {
    if (!row.opportunity_id) return map;
    const value = row.issue?.published_at || row.issue?.created_at;
    if (!map[row.opportunity_id] || new Date(value) > new Date(map[row.opportunity_id].date)) {
      map[row.opportunity_id] = { date: value, title: row.issue?.title || '' };
    }
    return map;
  }, {});
}

export function opportunityToNewsletterEntry(opportunity, position = 0) {
  const raw = opportunity?._raw || {};
  const eligibility = Array.isArray(opportunity?.elegibilidade)
    ? opportunity.elegibilidade.join('\n')
    : (raw.eligibility || opportunity?.elegibilidade || '');
  return {
    opportunity_id: raw.id || opportunity?.id || null,
    position,
    title: opportunity?.titulo || raw.title || '',
    summary: opportunity?.descricao || raw.description || '',
    eligibility,
    deadline: opportunity?.prazo || raw.deadline || '',
    fees: opportunity?.custo || raw.cost || '',
    link: opportunity?.link || raw.link || '',
  };
}

export function newsletterIssuePayload(issue) {
  return {
    title: String(issue.title || '').trim(),
    subject: String(issue.subject || issue.title || '').trim(),
    preheader: issue.preheader || '',
    intro: issue.intro || '',
    outro: issue.outro || '',
    campaign_slug: issue.campaign_slug || slugify(issue.title || issue.subject),
    status: issue.status || 'draft',
    beehiiv_url: issue.beehiiv_url || null,
    scheduled_at: issue.scheduled_at || null,
    published_at: issue.published_at || null,
    updated_at: new Date().toISOString(),
  };
}

export function newsletterEntryRows(newsletterId, entries = []) {
  return entries.map((entry, position) => ({
    newsletter_id: newsletterId,
    opportunity_id: entry.opportunity_id || null,
    position,
    title: entry.title || '',
    summary: entry.summary || '',
    eligibility: entry.eligibility || '',
    deadline: entry.deadline || '',
    fees: entry.fees || '',
    link: entry.link || '',
  }));
}

// Grava um issue + entradas com um cliente Supabase qualquer (o do navegador
// ou o do servidor MCP). Substitui as entradas inteiras, como a tela sempre fez.
export async function saveNewsletterIssueWith(supabase, issue, entries) {
  const payload = newsletterIssuePayload(issue);
  let saved;
  if (issue.id) {
    const { data, error } = await supabase.from('newsletter_issues').update(payload).eq('id', issue.id).select().single();
    if (error) throw new Error(error.message);
    saved = data;
  } else {
    const { data, error } = await supabase.from('newsletter_issues').insert(payload).select().single();
    if (error) throw new Error(error.message);
    saved = data;
  }

  const { error: deleteError } = await supabase.from('newsletter_entries').delete().eq('newsletter_id', saved.id);
  if (deleteError) throw new Error(deleteError.message);
  if (entries.length) {
    const { error } = await supabase.from('newsletter_entries').insert(newsletterEntryRows(saved.id, entries));
    if (error) throw new Error(error.message);
  }
  return { ...saved, entries: entries.map((entry, position) => ({ ...entry, position })) };
}
