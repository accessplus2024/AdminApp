import { isSupabaseConfigured, supabase } from './supabase';

export const SENTINEL_STATUS = {
  pending: { label: 'Processando', variant: 'primary' },
  screened_out: { label: 'Fora do corte', variant: 'neutral' },
  qualified: { label: 'Qualificada', variant: 'success' },
  rejected: { label: 'Rejeitada', variant: 'warning' },
  failed: { label: 'Falhou', variant: 'danger' },
};

export async function fetchSentinelPosts() {
  if (!isSupabaseConfigured) return [];
  const { data, error } = await supabase
    .from('sentinel_posts')
    .select('*, opportunity:opportunities(id,title,status)')
    .order('created_at', { ascending: false })
    .limit(250);
  if (error) throw new Error(error.message);
  return data || [];
}

async function callSentinel(body) {
  if (!isSupabaseConfigured) throw new Error('Supabase não configurado.');
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;
  if (!token) throw new Error('Entre novamente para executar o Sentinel.');
  const response = await fetch('/api/sentinel', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify(body),
  });
  const result = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(result.error || `Sentinel respondeu ${response.status}.`);
  return result;
}

export const runSentinel = (maxCandidates = 10) => callSentinel({ action: 'run', maxCandidates });
export const addManualOpportunity = (url) => callSentinel({ action: 'add', url });
