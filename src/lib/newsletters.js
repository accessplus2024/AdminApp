import { isSupabaseConfigured, supabase } from './supabase';
import { slugify } from './newsletterHtml';

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

function ensureConfigured() {
  if (!isSupabaseConfigured) throw new Error('Supabase não configurado.');
}

export async function fetchNewsletterIssues() {
  if (!isSupabaseConfigured) return [];
  const { data, error } = await supabase
    .from('newsletter_issues')
    .select('*, entries:newsletter_entries(*)')
    .order('created_at', { ascending: false });
  if (error) throw new Error(error.message);
  return (data || []).map((issue) => ({ ...issue, entries: (issue.entries || []).sort((a, b) => a.position - b.position) }));
}

export async function fetchLastFeaturedDates() {
  if (!isSupabaseConfigured) return {};
  const { data, error } = await supabase
    .from('newsletter_entries')
    .select('opportunity_id, issue:newsletter_issues!inner(title,status,published_at,created_at)')
    .eq('newsletter_issues.status', 'published');
  if (error) throw new Error(error.message);
  return (data || []).reduce((map, row) => {
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

export async function saveNewsletterIssue(issue, entries) {
  ensureConfigured();
  const payload = {
    title: issue.title.trim(),
    subject: (issue.subject || issue.title).trim(),
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
    const rows = entries.map((entry, position) => ({
      newsletter_id: saved.id,
      opportunity_id: entry.opportunity_id || null,
      position,
      title: entry.title || '',
      summary: entry.summary || '',
      eligibility: entry.eligibility || '',
      deadline: entry.deadline || '',
      fees: entry.fees || '',
      link: entry.link || '',
    }));
    const { error } = await supabase.from('newsletter_entries').insert(rows);
    if (error) throw new Error(error.message);
  }
  return { ...saved, entries: entries.map((entry, position) => ({ ...entry, position })) };
}

export async function markNewsletterPublished(issue, entries) {
  return saveNewsletterIssue({ ...issue, status: 'published', published_at: issue.published_at || new Date().toISOString() }, entries);
}

export async function deleteNewsletterIssue(id) {
  ensureConfigured();
  const { error } = await supabase.from('newsletter_issues').delete().eq('id', id);
  if (error) throw new Error(error.message);
}
