// Subreddits que o Sentinel varre (tabela sentinel_reddit_subreddits).
// Mesmo padrão de src/lib/instagramAccounts.js: chamadas diretas ao
// Supabase, sem rota de API própria — a permissão de escrita vem só da RLS
// (Admin/Editor).
import { isSupabaseConfigured, supabase } from './supabase';

const NAME_PATTERN = /^[a-z0-9_]{1,25}$/i;

export function normalizeSubredditName(value) {
  return String(value || '').trim().replace(/^\/?r\//i, '');
}

export function isValidSubredditName(value) {
  return NAME_PATTERN.test(normalizeSubredditName(value));
}

export async function fetchRedditSubreddits() {
  if (!isSupabaseConfigured) return [];
  const { data, error } = await supabase
    .from('sentinel_reddit_subreddits')
    .select('*')
    .order('name');
  if (error) throw new Error(error.message);
  return data || [];
}

// Novo subreddit sempre entra com a busca "ampla" padrão (a mesma que os
// outros já usam) — quem quiser uma combinação mais específica (ex.: buscar
// por flair também) edita direto no banco depois.
export async function addRedditSubreddit(name) {
  const normalizado = normalizeSubredditName(name);
  if (!isValidSubredditName(normalizado)) {
    throw new Error('Nome de subreddit inválido. Use só letras, números e underscore, sem "r/".');
  }
  const { data, error } = await supabase
    .from('sentinel_reddit_subreddits')
    .insert({ name: normalizado, active: true, queries: [['broad', 'new', 'year'], ['broad', 'top', 'year']] })
    .select().single();
  if (error) {
    if (error.code === '23505') throw new Error(`r/${normalizado} já está na lista.`);
    throw new Error(error.message);
  }
  return data;
}

export async function setRedditSubredditActive(name, active) {
  const { data, error } = await supabase
    .from('sentinel_reddit_subreddits')
    .update({ active })
    .eq('name', name)
    .select().single();
  if (error) throw new Error(error.message);
  return data;
}

export async function removeRedditSubreddit(name) {
  const { error } = await supabase.from('sentinel_reddit_subreddits').delete().eq('name', name);
  if (error) throw new Error(error.message);
}
