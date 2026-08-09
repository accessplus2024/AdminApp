import { isSupabaseConfigured, supabase } from './supabase';

export const SENTINEL_STATUS = {
  queued: { label: 'Na fila', variant: 'neutral' },
  pending: { label: 'Processando', variant: 'primary' },
  qualified: { label: 'Qualificada', variant: 'success' },
  duplicate: { label: 'Duplicada', variant: 'neutral' },
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

const RESEARCH_RUN_SELECT = [
  'id', 'run_type', 'status', 'requested_count', 'processed_count', 'succeeded_count',
  'failed_count', 'model', 'prompt_version', 'model_calls', 'page_fetches',
  'input_tokens', 'output_tokens', 'metadata', 'error', 'created_by', 'started_at',
  'completed_at', 'created_at',
].join(',');

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

export async function fetchResearchRuns(limit = 20) {
  if (!isSupabaseConfigured) return [];
  const { data, error } = await supabase
    .from('sentinel_research_runs')
    .select(RESEARCH_RUN_SELECT)
    .order('started_at', { ascending: false })
    .limit(limit);
  if (error) throw new Error(error.message);
  return data || [];
}

export async function fetchResearchRun(runId) {
  if (!isSupabaseConfigured || !runId) return null;
  const { data, error } = await supabase
    .from('sentinel_research_runs')
    .select('*, proposals:sentinel_research_proposals(*, opportunity:opportunities(id,title,deadline,link,status)), posts:sentinel_posts(*, opportunity:opportunities(id,title,status))')
    .eq('id', runId)
    .single();
  if (error) throw new Error(error.message);
  return {
    ...data,
    proposals: (data.proposals || []).sort((a, b) => a.id - b.id),
    posts: (data.posts || []).sort((a, b) => new Date(a.created_at) - new Date(b.created_at)),
  };
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

export const runSentinel = ({ allQueued = false, maxCandidates = 10 } = {}) => callSentinel({ action: 'run', allQueued, maxCandidates });
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

const ARRAY_EDIT_FIELDS = new Set(['areas', 'level', 'keywords']);

export function serializeResearchEdits(edits = {}) {
  return Object.fromEntries(Object.entries(edits).map(([field, value]) => [
    field,
    ARRAY_EDIT_FIELDS.has(field)
      ? String(value || '').split(/\r?\n|,/).map((item) => item.trim()).filter(Boolean)
      : value,
  ]));
}

export const applyResearchProposal = (proposalId, fields, edits = {}) => callSentinel({
  action: 'proposal-apply', proposalId, fields, edits: serializeResearchEdits(edits),
});
export const rejectResearchProposal = (proposalId) => callSentinel({ action: 'proposal-reject', proposalId });
