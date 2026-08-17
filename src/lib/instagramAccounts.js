// Contas de Instagram que o Sentinel varre (tabela sentinel_instagram_accounts).
// Mesmo padrão de src/lib/tags.js: chamadas diretas ao Supabase, sem rota de
// API própria — a permissão de escrita vem só da RLS (Admin/Editor).
import { isSupabaseConfigured, supabase } from './supabase';

const NAME_PATTERN = /^[a-z0-9._]{1,30}$/i;

export function normalizeInstagramUsername(value) {
  return String(value || '').trim().replace(/^@+/, '').toLowerCase();
}

export function isValidInstagramUsername(value) {
  return NAME_PATTERN.test(normalizeInstagramUsername(value));
}

export async function fetchInstagramAccounts() {
  if (!isSupabaseConfigured) return [];
  const { data, error } = await supabase
    .from('sentinel_instagram_accounts')
    .select('*')
    .order('username');
  if (error) throw new Error(error.message);
  return data || [];
}

export async function addInstagramAccount(username) {
  const normalizado = normalizeInstagramUsername(username);
  if (!isValidInstagramUsername(normalizado)) {
    throw new Error('Username inválido. Use só letras, números, ponto e underscore (sem @).');
  }
  const { data, error } = await supabase
    .from('sentinel_instagram_accounts')
    .insert({ username: normalizado, active: true })
    .select().single();
  if (error) {
    if (error.code === '23505') throw new Error(`@${normalizado} já está na lista.`);
    throw new Error(error.message);
  }
  return data;
}

export async function setInstagramAccountActive(username, active) {
  const { data, error } = await supabase
    .from('sentinel_instagram_accounts')
    .update({ active })
    .eq('username', username)
    .select().single();
  if (error) throw new Error(error.message);
  return data;
}

export async function removeInstagramAccount(username) {
  const { error } = await supabase.from('sentinel_instagram_accounts').delete().eq('username', username);
  if (error) throw new Error(error.message);
}
