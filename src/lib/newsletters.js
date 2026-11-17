import { isSupabaseConfigured, supabase } from './supabase';
import { lastFeaturedFromRows, saveNewsletterIssueWith } from './newsletterRecords.js';

// Formato e regras ficam em newsletterRecords.js (compartilhado com o servidor
// MCP); aqui só o acesso pelo cliente Supabase do navegador.
export { DEFAULT_ISSUE, opportunityToNewsletterEntry } from './newsletterRecords.js';

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
  return lastFeaturedFromRows(data || []);
}

export async function saveNewsletterIssue(issue, entries) {
  ensureConfigured();
  return saveNewsletterIssueWith(supabase, issue, entries);
}

export async function markNewsletterPublished(issue, entries) {
  return saveNewsletterIssue({ ...issue, status: 'published', published_at: issue.published_at || new Date().toISOString() }, entries);
}

export async function deleteNewsletterIssue(id) {
  ensureConfigured();
  const { error } = await supabase.from('newsletter_issues').delete().eq('id', id);
  if (error) throw new Error(error.message);
}
