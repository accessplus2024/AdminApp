import { isSupabaseConfigured, supabase } from './supabase';

export const SENTINEL_STATUS = {
  pending: { label: 'Processando', variant: 'primary' },
  screened_out: { label: 'Fora do corte', variant: 'neutral' },
  qualified: { label: 'Qualificada', variant: 'success' },
  rejected: { label: 'Rejeitada', variant: 'warning' },
  failed: { label: 'Falhou', variant: 'danger' },
};

export const RESEARCH_RUN_STATUS = {
  running: { label: 'Em andamento', variant: 'primary' },
  completed: { label: 'Concluída', variant: 'success' },
  partial: { label: 'Parcial', variant: 'warning' },
  failed: { label: 'Falhou', variant: 'danger' },
};

export const PROPOSAL_STATUS = {
  pending: { label: 'Aguardando revisão', variant: 'warning' },
  approved: { label: 'Aplicada', variant: 'success' },
  partially_approved: { label: 'Aplicada parcialmente', variant: 'primary' },
  rejected: { label: 'Descartada', variant: 'neutral' },
  no_changes: { label: 'Sem mudanças', variant: 'neutral' },
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

export async function fetchResearchRuns(limit = 50) {
  if (!isSupabaseConfigured) return [];
  const { data, error } = await supabase
    .from('sentinel_research_runs')
    .select('*, proposals:sentinel_research_proposals(*, opportunity:opportunities(id,title,deadline,link,status)), posts:sentinel_posts(*, opportunity:opportunities(id,title,status))')
    .order('started_at', { ascending: false })
    .limit(limit);
  if (error) throw new Error(error.message);
  return (data || []).map((run) => ({
    ...run,
    proposals: (run.proposals || []).sort((a, b) => a.id - b.id),
    posts: (run.posts || []).sort((a, b) => new Date(a.created_at) - new Date(b.created_at)),
  }));
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
  if (!response.ok) {
    const routeMissing = response.status === 404 && !result.error;
    const error = new Error(result.error || (routeMissing
      ? 'A rota do Sentinel não está disponível neste servidor.'
      : `Sentinel respondeu ${response.status}.`));
    error.status = response.status;
    error.routeMissing = routeMissing;
    throw error;
  }
  return result;
}

export const runSentinel = (maxCandidates = 10) => callSentinel({ action: 'run', maxCandidates });
export const addManualOpportunity = (url) => callSentinel({ action: 'add', url });

const chunks = (items, size) => Array.from({ length: Math.ceil(items.length / size) }, (_, index) => items.slice(index * size, index * size + size));

export async function researchCatalogOpportunities(opportunityIds, onProgress) {
  const run = await callSentinel({ action: 'review-start', opportunityIds });
  onProgress?.({ runId: run.id, processed: 0, total: opportunityIds.length, run });
  try {
    const batches = chunks(opportunityIds, 6);
    let processed = 0;
    for (const batch of batches) {
      const result = await callSentinel({ action: 'review-batch', runId: run.id, opportunityIds: batch });
      processed += result.processed || 0;
      onProgress?.({ runId: run.id, processed, total: opportunityIds.length, run: result.run });
    }
    return await callSentinel({ action: 'review-finish', runId: run.id });
  } catch (error) {
    error.runId = run.id;
    throw error;
  }
}

export async function resumeCatalogResearch(run, onProgress) {
  const selected = (run.metadata?.selected_ids || []).map(Number);
  const completed = new Set((run.proposals || []).map((proposal) => Number(proposal.opportunity_id)));
  const remaining = selected.filter((id) => !completed.has(id));
  let processed = run.processed_count || 0;
  for (const batch of chunks(remaining, 6)) {
    const result = await callSentinel({ action: 'review-batch', runId: run.id, opportunityIds: batch });
    processed += result.processed || 0;
    onProgress?.({ runId: run.id, processed, total: selected.length, run: result.run });
  }
  return callSentinel({ action: 'review-finish', runId: run.id });
}

export const applyResearchProposal = (proposalId, fields) => callSentinel({ action: 'proposal-apply', proposalId, fields });
export const rejectResearchProposal = (proposalId) => callSentinel({ action: 'proposal-reject', proposalId });
