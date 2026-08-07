import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Badge, Button, Card, CardBody, CardHeader, CardTitle, Checkbox, Input,
  OpportunityFilters, Select, Stat, Tabs, Textarea, useOpportunityFilters,
} from '../components';
import { Ic } from '../lib/icons';
import { buildCitationUrl } from '../lib/citationUrl';
import { formatElapsedDuration } from '../lib/sentinelTime';
import { availabilityVariant, OPPORTUNITY_AVAILABILITY, opportunityAvailability } from '../lib/opportunityAvailability';
import {
  addManualOpportunity, applyResearchProposal, fetchResearchRuns, fetchSentinelPosts,
  PROPOSAL_STATUS, RESEARCH_RUN_STATUS, rejectResearchProposal, researchCatalogOpportunities,
  resumeCatalogResearch, runSentinel, SENTINEL_STATUS,
} from '../lib/sentinel';

const FIELD_LABELS = {
  title: 'Título', description: 'Descrição', link: 'Link', deadline: 'Prazo', areas: 'Áreas',
  level: 'Nível', location: 'Local/formato', audience: 'Público-alvo', cost: 'Custo',
  language: 'Idioma', keywords: 'Palavras-chave', eligibility: 'Elegibilidade',
  process: 'Processo seletivo', applicants: 'Dicas', additionals: 'Informações adicionais', type: 'Tipo',
  status: 'Disponibilidade',
};
const RUN_TYPES = { discovery: 'Descoberta no Instagram', manual: 'Pesquisa por URL', catalog_review: 'Revisão do catálogo' };
const MODEL_LABELS = {
  'openai/gpt-oss-20b': 'GPT OSS 20B',
  'openai/gpt-oss-120b': 'GPT OSS 120B',
  'z-ai/glm-5.2': 'GLM 5.2',
};
const ARRAY_EDIT_FIELDS = new Set(['areas', 'level', 'audience', 'keywords']);
const MULTILINE_EDIT_FIELDS = new Set(['description', 'location', 'cost', 'eligibility', 'process', 'applicants', 'additionals']);
const EDIT_SELECT_OPTIONS = {
  type: ['Programas Acadêmicos', 'Olimpíadas Científicas', 'Competições', 'Competições de Escrita', 'Mentorias', 'Bolsas de Estudo', 'Programas de Intercâmbio', 'MUNs', 'Estágios'],
  status: ['Aprovada', 'Revisar', 'Rascunho', 'Encerrada'],
};

const opportunityId = (opportunity) => String(opportunity?._raw?.id || opportunity?.id);
const countLabel = (count, singular, plural = `${singular}s`) => `${Number(count).toLocaleString('pt-BR')} ${Number(count) === 1 ? singular : plural}`;
const formatDate = (value, withTime = false) => value
  ? new Intl.DateTimeFormat('pt-BR', withTime
    ? { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }
    : { day: '2-digit', month: 'short', year: 'numeric' }).format(new Date(value))
  : '—';
const displayValue = (value) => Array.isArray(value) ? value.join(', ') : (value == null || value === '' ? 'Não informado' : String(value));
const displayFieldValue = (field, value) => field === 'deadline' && typeof value === 'string'
  ? displayValue(value.replace(/\b0([1-9])(?=\s+de\s+)/gi, '$1'))
  : field === 'status' && value === 'Encerrada' ? OPPORTUNITY_AVAILABILITY.CLOSED
  : field === 'status' && value === 'Aprovada' ? OPPORTUNITY_AVAILABILITY.OPEN
  : displayValue(value);
const editableFieldValue = (field, value) => ARRAY_EDIT_FIELDS.has(field)
  ? (Array.isArray(value) ? value : []).join('\n')
  : String(value ?? '');
const editedDisplayValue = (field, value) => ARRAY_EDIT_FIELDS.has(field)
  ? String(value || '').split(/\r?\n|,/).map((item) => item.trim()).filter(Boolean)
  : value;

function Evidence({ value }) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return <div className="research-evidence"><b>Fonte:</b> {displayValue(value)}</div>;
  }
  return (
    <div className="research-evidence">
      <b>Fonte:</b> {value.summary_pt || 'Evidência confirmada na página oficial.'}
      {value.source_url && <a href={buildCitationUrl(value.source_url, value.quote)} target="_blank" rel="noreferrer" title="Abrir a página-fonte no trecho citado">Abrir trecho citado {Ic('external-link', 'ico-xs')}</a>}
      {value.quote && <small>Citação original: <q>{value.quote}</q></small>}
    </div>
  );
}

function Usage({ run }) {
  const tokens = Number(run.input_tokens || 0) + Number(run.output_tokens || 0);
  return <span>{countLabel(run.model_calls || 0, 'chamada')} · {countLabel(run.page_fetches || 0, 'página')} · {countLabel(tokens, 'token')}</span>;
}

function proposalStage(proposal) {
  if (proposal.notes?.startsWith('Falha na etapa:')) return proposal.notes.replace('Falha na etapa:', '').trim();
  if (proposal.status !== 'failed') return 'Pesquisa concluída';
  if (!proposal.page_fetches && !proposal.model_calls) return 'Leitura da página oficial';
  if (!proposal.model_calls) return 'Preparação da análise';
  return 'Análise pelo modelo';
}

function preferredProposalFilter(run) {
  const proposals = run?.proposals || [];
  if (proposals.some((proposal) => proposal.status === 'pending')) return 'pending';
  if (proposals.some((proposal) => proposal.status === 'failed')) return 'failed';
  return proposals.length ? 'all' : 'pending';
}

function ModelAttempts({ entry }) {
  const attempts = entry.evidence?._sentinel?.model_attempts || [];
  if (!attempts.length) return null;
  return (
    <div className="sentinel-model-attempts" aria-label="Tentativas de modelos de IA">
      {attempts.map((attempt, index) => {
        const duration = Number(attempt.duration_ms || 0) / 1000;
        const tokens = Number(attempt.input_tokens || 0) + Number(attempt.output_tokens || 0);
        return (
          <div data-status={attempt.status} key={`${attempt.model}-${index}`}>
            <span className="sentinel-model-attempts__dot" />
            <strong>{MODEL_LABELS[attempt.model] || attempt.model}</strong>
            <span>{attempt.status === 'succeeded' ? 'respondeu' : 'falhou'} em {duration < 1 ? '<1' : duration.toFixed(1).replace('.', ',')}s</span>
            {tokens > 0 && <span>· {tokens.toLocaleString('pt-BR')} tokens</span>}
            {attempt.error && <small>{attempt.error}</small>}
          </div>
        );
      })}
    </div>
  );
}

function DiscoveryDetails({ post }) {
  const extracted = post.extracted || {};
  const trace = extracted._sentinel || {};
  const evidence = Object.entries(extracted.evidence || {});
  const sources = trace.sources || [];
  const notes = trace.validation_notes || [];
  if (!evidence.length && !sources.length && !trace.model_attempts?.length && !notes.length) return null;
  return (
    <details className="sentinel-source-details">
      <summary>Ver pesquisa<span>{countLabel(sources.length, 'fonte')}</span></summary>
      <div className="sentinel-source-details__body">
        <ModelAttempts entry={{ evidence: { _sentinel: trace } }} />
        {evidence.map(([field, item]) => (
          <div className="sentinel-source-evidence" key={field}>
            <strong>{FIELD_LABELS[field] || field}</strong>
            <Evidence value={item} />
          </div>
        ))}
        {sources.length > 0 && <div className="sentinel-source-links"><strong>Páginas lidas</strong>{sources.map((source) => <a href={source.url} target="_blank" rel="noreferrer" key={source.url}>{source.relation || 'Fonte oficial'} {Ic('external-link', 'ico-xs')}</a>)}</div>}
        {notes.length > 0 && <div className="sentinel-validation-notes"><strong>Validações</strong>{notes.map((note) => <span key={note}>{note}</span>)}</div>}
      </div>
    </details>
  );
}

function RunLog({ run, now }) {
  const [eventsOpen, setEventsOpen] = useState(false);
  const isCatalog = run.run_type === 'catalog_review';
  const entries = isCatalog ? (run.proposals || []) : (run.posts || []);
  const status = RESEARCH_RUN_STATUS[run.status] || RESEARCH_RUN_STATUS.running;
  const denominator = Math.max(Number(run.requested_count || 0), Number(run.processed_count || 0), 1);
  const successWidth = Math.min(100, (Number(run.succeeded_count || 0) / denominator) * 100);
  const failureWidth = Math.min(100 - successWidth, (Number(run.failed_count || 0) / denominator) * 100);

  return (
    <section className="sentinel-run-log">
      <header className="sentinel-run-log__header">
        <div>
          <span className="sentinel-run-log__id">Execução #{run.id}</span>
          <h3>{RUN_TYPES[run.run_type] || run.run_type}</h3>
          <p>{formatDate(run.started_at, true)} · duração {formatElapsedDuration(run.started_at, run.completed_at, now)}{run.status === 'running' ? ' · atualizando automaticamente' : ''}</p>
          {run.model && <p>Modelos: {run.model.replaceAll(' -> ', ' → ')}</p>}
        </div>
        <Badge variant={status.variant} dot>{status.label}</Badge>
      </header>

      <div className="sentinel-run-log__stats">
        <div><strong>{run.processed_count || 0}/{run.requested_count || 0}</strong><span>processadas</span></div>
        <div><strong>{run.succeeded_count || 0}</strong><span>sem falha</span></div>
        <div data-tone={run.failed_count ? 'danger' : 'neutral'}><strong>{run.failed_count || 0}</strong><span>falhas</span></div>
        <div><strong>{run.model_calls || 0}</strong><span>chamadas IA</span></div>
        <div><strong>{run.page_fetches || 0}</strong><span>páginas lidas</span></div>
        <div><strong>{(Number(run.input_tokens || 0) + Number(run.output_tokens || 0)).toLocaleString('pt-BR')}</strong><span>tokens</span></div>
      </div>

      <div className="sentinel-run-log__meter" aria-label={`${run.succeeded_count || 0} sucessos e ${run.failed_count || 0} falhas`}>
        <i data-tone="success" style={{ width: `${successWidth}%` }} />
        <i data-tone="danger" style={{ width: `${failureWidth}%` }} />
      </div>

      {run.error && <div className="workflow-notice workflow-notice--error"><strong>Erro da execução:</strong> {run.error}</div>}

      <details className="sentinel-events-details" onToggle={(event) => setEventsOpen(event.currentTarget.open)}>
        <summary>{eventsOpen ? 'Ocultar eventos' : 'Ver eventos'}<span>{entries.length} registros</span></summary>
        {eventsOpen && <ol className="sentinel-run-timeline">
        <li data-tone="neutral">
          <span className="sentinel-run-timeline__dot" />
          <div><strong>Execução criada</strong><small>{formatDate(run.started_at, true)}</small></div>
        </li>
        {entries.map((entry) => {
          const entryStatus = isCatalog
            ? (PROPOSAL_STATUS[entry.status] || PROPOSAL_STATUS.pending)
            : (SENTINEL_STATUS[entry.status] || SENTINEL_STATUS.pending);
          const title = entry.opportunity?.title || entry.original?.title || (entry.source_type === 'manual' ? 'URL adicionada manualmente' : `@${entry.owner_username || 'instagram'}`);
          const error = entry.error;
          const source = entry.source_url;
          return (
            <li data-tone={entry.status === 'failed' ? 'danger' : entry.status === 'pending' ? 'warning' : 'success'} key={`${isCatalog ? 'proposal' : 'post'}-${entry.id}`}>
              <span className="sentinel-run-timeline__dot" />
              <div className="sentinel-run-timeline__content">
                <div className="sentinel-run-timeline__title"><strong>{title}</strong><Badge variant={entryStatus.variant} dot>{entryStatus.label}</Badge></div>
                {isCatalog && <small>Etapa: {proposalStage(entry)} · <Usage run={entry} /></small>}
                {!isCatalog && <small>{formatDate(entry.processed_at || entry.created_at, true)}</small>}
                {isCatalog && <ModelAttempts entry={entry} />}
                {error && <p className="sentinel-run-timeline__error">{error}</p>}
                {!error && entry.notes && <p>{entry.notes}</p>}
                {source && <a href={source} target="_blank" rel="noreferrer">Abrir fonte oficial {Ic('external-link', 'ico-xs')}</a>}
              </div>
              <time>{formatDate(entry.updated_at || entry.processed_at || entry.created_at, true)}</time>
            </li>
          );
        })}
        {run.completed_at && (
          <li data-tone={run.failed_count ? 'warning' : 'success'}>
            <span className="sentinel-run-timeline__dot" />
            <div><strong>Execução encerrada</strong><small>{run.failed_count ? countLabel(run.failed_count, 'falha registrada', 'falhas registradas') : 'Todas as pesquisas foram concluídas'}</small></div>
            <time>{formatDate(run.completed_at, true)}</time>
          </li>
        )}
        </ol>}
      </details>
    </section>
  );
}

function ProposedValueEditor({ field, value, changed, onChange, onDone, onReset }) {
  const label = FIELD_LABELS[field] || field;
  const handleKeyDown = (event) => {
    if (event.key === 'Escape') {
      event.preventDefault();
      onReset();
    } else if (event.key === 'Enter' && (event.ctrlKey || event.metaKey)) {
      event.preventDefault();
      onDone();
    }
  };
  let control;
  if (EDIT_SELECT_OPTIONS[field]) {
    control = (
      <Select autoFocus value={value} onChange={(event) => onChange(event.target.value)} onKeyDown={handleKeyDown} aria-label={`Editar ${label}`}>
        {EDIT_SELECT_OPTIONS[field].map((option) => <option value={option} key={option}>{option}</option>)}
      </Select>
    );
  } else if (ARRAY_EDIT_FIELDS.has(field) || MULTILINE_EDIT_FIELDS.has(field)) {
    control = <Textarea autoFocus rows={ARRAY_EDIT_FIELDS.has(field) ? 3 : 4} value={value} onChange={(event) => onChange(event.target.value)} onKeyDown={handleKeyDown} aria-label={`Editar ${label}`} />;
  } else {
    control = <Input autoFocus type={field === 'link' ? 'url' : 'text'} value={value} onChange={(event) => onChange(event.target.value)} onKeyDown={handleKeyDown} aria-label={`Editar ${label}`} />;
  }
  return (
    <div className="research-change-editor">
      {control}
      <div className="research-change-editor__footer">
        <small>{ARRAY_EDIT_FIELDS.has(field) ? 'Um item por linha.' : 'Ctrl + Enter para concluir.'}</small>
        {changed && <Button variant="ghost" size="sm" onClick={onReset}>Restaurar sugestão</Button>}
        <Button variant="outline" size="sm" iconLeft={Ic('check', 'ico-xs')} onClick={onDone}>Concluir edição</Button>
      </div>
    </div>
  );
}

function ProposalCard({ proposal, selection, edits = {}, onToggleField, onEditField, onResetField, onApply, onReject, busy }) {
  const [editingField, setEditingField] = useState(null);
  const status = PROPOSAL_STATUS[proposal.status] || PROPOSAL_STATUS.pending;
  const changes = Object.entries(proposal.changes || {}).sort(([a], [b]) => (a === 'deadline' ? -1 : b === 'deadline' ? 1 : 0));
  const selectedFields = selection || changes.map(([field]) => field);
  return (
    <Card className={`research-proposal${proposal.status !== 'pending' ? ' research-proposal--reviewed' : ''}`}>
      <CardHeader className="research-proposal-header">
        <div>
          <div className="research-proposal-title"><CardTitle style={{ fontSize: 16 }}>{proposal.opportunity?.title || proposal.original?.title || 'Oportunidade removida'}</CardTitle>{proposal.source_url && <a href={proposal.source_url} target="_blank" rel="noreferrer" aria-label="Abrir fonte">{Ic('external-link', 'ico-xs')}</a>}</div>
          <p className="card-helper">{proposal.notes || `${countLabel(changes.length, 'campo com atualização sugerida', 'campos com atualização sugerida')}.`}</p>
        </div>
        <Badge variant={status.variant} dot>{status.label}</Badge>
      </CardHeader>
      <CardBody className="research-change-list">
        {proposal.status === 'failed' ? <div className="workflow-notice workflow-notice--error">{proposal.error}</div> : changes.length === 0 ? (
          <div className="workflow-empty">A página oficial confirmou os dados atuais; nenhuma mudança foi proposta.</div>
        ) : changes.map(([field, change]) => {
          const checked = selectedFields.includes(field);
          const changed = Object.prototype.hasOwnProperty.call(edits, field);
          const editValue = changed ? edits[field] : editableFieldValue(field, change.after);
          return (
            <article className={`research-change${field === 'deadline' ? ' research-change--deadline' : ''}`} key={field}>
              <div className="research-change-check">
                {proposal.status === 'pending' ? <Checkbox checked={checked} onChange={() => onToggleField(proposal, field)} label={FIELD_LABELS[field] || field} /> : <strong>{FIELD_LABELS[field] || field}</strong>}
              </div>
              <div className="research-change-values">
                <del>{displayFieldValue(field, change.before)}</del>
                <span>{Ic('arrow-right', 'ico-xs')}</span>
                <ins data-edited={changed} data-editing={editingField === field}>
                  {proposal.status !== 'pending' ? displayFieldValue(field, change.after) : editingField === field ? (
                    <ProposedValueEditor
                      field={field}
                      value={editValue}
                      changed={changed}
                      onChange={(value) => onEditField(proposal, field, value)}
                      onDone={() => setEditingField(null)}
                      onReset={() => { onResetField(proposal, field); setEditingField(null); }}
                    />
                  ) : (
                    <button type="button" className="research-change-edit-trigger" disabled={busy} onClick={() => {
                      if (!checked) onToggleField(proposal, field);
                      setEditingField(field);
                    }} aria-label={`Editar valor proposto de ${FIELD_LABELS[field] || field}`}>
                      <span>{displayFieldValue(field, changed ? editedDisplayValue(field, editValue) : change.after)}</span>
                      {changed && <small>Editado</small>}
                      {Ic('pencil', 'ico-xs')}
                    </button>
                  )}
                </ins>
              </div>
              {proposal.evidence?.[field] && <Evidence value={proposal.evidence[field]} />}
            </article>
          );
        })}
      </CardBody>
      {proposal.status === 'pending' && changes.length > 0 && (
        <div className="research-proposal-footer">
          <span>{selectedFields.length} de {changes.length} {changes.length === 1 ? 'mudança selecionada' : 'mudanças selecionadas'}</span>
          <Button variant="ghost" size="sm" onClick={() => onReject(proposal)} disabled={busy}>Descartar</Button>
          <Button variant="primary" size="sm" iconLeft={Ic('check', 'ico-xs')} onClick={() => onApply(proposal, selectedFields, edits)} disabled={busy || selectedFields.length === 0}>{busy ? 'Aplicando…' : 'Aplicar selecionadas'}</Button>
        </div>
      )}
    </Card>
  );
}

export default function Sentinel({ perms, opportunities = [], catalogLoading = false, onCatalogChanged }) {
  const [tab, setTab] = useState('review');
  const [posts, setPosts] = useState([]);
  const [runs, setRuns] = useState([]);
  const [loading, setLoading] = useState(true);
  const [discovering, setDiscovering] = useState(false);
  const [researching, setResearching] = useState(false);
  const [reviewingId, setReviewingId] = useState(null);
  const [manualUrl, setManualUrl] = useState('');
  const [logFilter, setLogFilter] = useState('all');
  const [proposalFilter, setProposalFilter] = useState('pending');
  const [selected, setSelected] = useState(() => new Set());
  const [activeRunId, setActiveRunId] = useState(null);
  const [inspectedRunId, setInspectedRunId] = useState(null);
  const [expandedReviewLogId, setExpandedReviewLogId] = useState(null);
  const [fieldSelections, setFieldSelections] = useState({});
  const [fieldEdits, setFieldEdits] = useState({});
  const [progress, setProgress] = useState(null);
  const [notice, setNotice] = useState(null);
  const [refreshingCatalog, setRefreshingCatalog] = useState(false);
  const [clockNow, setClockNow] = useState(() => Date.now());
  const activeRunIdRef = useRef(null);
  const loadRequestRef = useRef(0);
  const opportunityFilter = useOpportunityFilters(opportunities, { initialSort: 'prazo' });

  const load = useCallback(async (preferredRunId) => {
    const requestId = ++loadRequestRef.current;
    try {
      const [nextPosts, nextRuns] = await Promise.all([fetchSentinelPosts(), fetchResearchRuns()]);
      if (requestId !== loadRequestRef.current) return;
      setPosts(nextPosts); setRuns(nextRuns);
      const catalogRuns = nextRuns.filter((run) => run.run_type === 'catalog_review');
      const currentRunId = activeRunIdRef.current;
      const preferred = catalogRuns.find((run) => String(run.id) === String(preferredRunId || currentRunId)) || catalogRuns[0];
      if (preferred) {
        activeRunIdRef.current = preferred.id;
        setActiveRunId(preferred.id);
        if (preferredRunId || !currentRunId) setProposalFilter(preferredProposalFilter(preferred));
      }
    } catch (error) {
      if (requestId === loadRequestRef.current) setNotice({ type: 'error', text: error.message });
    } finally {
      if (requestId === loadRequestRef.current) setLoading(false);
    }
  }, []);

  useEffect(() => { void load(); }, [load]);
  useEffect(() => {
    const syncVisible = () => {
      if (document.visibilityState === 'visible') void load();
    };
    const interval = window.setInterval(syncVisible, 5000);
    window.addEventListener('focus', syncVisible);
    document.addEventListener('visibilitychange', syncVisible);
    return () => {
      window.clearInterval(interval);
      window.removeEventListener('focus', syncVisible);
      document.removeEventListener('visibilitychange', syncVisible);
    };
  }, [load]);

  const catalogRuns = useMemo(() => runs.filter((run) => run.run_type === 'catalog_review'), [runs]);
  const activeRun = catalogRuns.find((run) => String(run.id) === String(activeRunId)) || null;
  const inspectedRun = runs.find((run) => String(run.id) === String(inspectedRunId)) || null;
  const hasRunningLog = researching || activeRun?.status === 'running' || inspectedRun?.status === 'running';
  useEffect(() => {
    setClockNow(Date.now());
    if (!hasRunningLog) return undefined;
    const interval = window.setInterval(() => setClockNow(Date.now()), 1000);
    return () => window.clearInterval(interval);
  }, [hasRunningLog]);
  const proposals = useMemo(() => {
    const items = activeRun?.proposals || [];
    return proposalFilter === 'all' ? items : items.filter((proposal) => proposal.status === proposalFilter);
  }, [activeRun, proposalFilter]);
  const proposalCounts = useMemo(() => (activeRun?.proposals || []).reduce((counts, proposal) => ({
    ...counts,
    all: counts.all + 1,
    [proposal.status]: (counts[proposal.status] || 0) + 1,
  }), { all: 0 }), [activeRun]);
  const filteredPosts = useMemo(() => logFilter === 'all' ? posts : posts.filter((post) => post.status === logFilter), [posts, logFilter]);

  const toggleOpportunity = (id) => setSelected((current) => {
    const next = new Set(current);
    if (next.has(String(id))) next.delete(String(id)); else next.add(String(id));
    return next;
  });
  const selectRows = (rows) => setSelected((current) => new Set([...current, ...rows.filter((item) => item.link).map(opportunityId)]));
  const allResearchable = opportunities.filter((opportunity) => opportunity.link);

  const updateResearchProgress = (next) => {
    setProgress(next);
    if (!next?.runId) return;
    activeRunIdRef.current = next.runId;
    setActiveRunId(next.runId);
    if (!next.run) return;
    setRuns((current) => {
      const existing = current.find((run) => String(run.id) === String(next.runId));
      const updated = {
        ...existing,
        ...next.run,
        proposals: existing?.proposals || next.run.proposals || [],
        posts: existing?.posts || next.run.posts || [],
      };
      return existing
        ? current.map((run) => String(run.id) === String(next.runId) ? updated : run)
        : [updated, ...current];
    });
  };

  const mergeProposal = (updatedProposal) => {
    setRuns((current) => current.map((run) => ({
      ...run,
      proposals: (run.proposals || []).map((proposal) => proposal.id === updatedProposal.id
        ? { ...proposal, ...updatedProposal, opportunity: updatedProposal.opportunity || proposal.opportunity }
        : proposal),
    })));
  };

  const executeDiscovery = async () => {
    setDiscovering(true); setNotice(null);
    try {
      const result = await runSentinel({ allQueued: true });
      const resultText = [
        countLabel(result.newPosts, 'post novo', 'posts novos'),
        countLabel(result.candidates, 'item analisado', 'itens analisados'),
        countLabel(result.created, 'oportunidade enviada para revisão', 'oportunidades enviadas para revisão'),
        countLabel(result.duplicates || 0, 'duplicata vinculada', 'duplicatas vinculadas'),
        `${result.queued || 0} na fila`,
      ].join(' · ');
      setNotice({ type: 'success', text: resultText });
      await load();
      try { await onCatalogChanged?.(); }
      catch (error) { setNotice({ type: 'error', text: `${resultText} O catálogo não pôde ser sincronizado: ${error.message}` }); }
    } catch (error) { setNotice({ type: 'error', text: error.message }); }
    finally { setDiscovering(false); }
  };

  const addManual = async (event) => {
    event.preventDefault();
    if (!manualUrl.trim()) return;
    setDiscovering(true); setNotice(null);
    try {
      const result = await addManualOpportunity(manualUrl.trim());
      setManualUrl('');
      const resultText = result.status === 'qualified'
        ? 'Oportunidade encontrada e enviada para revisão.'
        : 'Nenhuma oportunidade qualificada foi encontrada nessa URL.';
      setNotice({ type: result.status === 'qualified' ? 'success' : 'error', text: resultText });
      await load();
      if (result.status === 'qualified') {
        try { await onCatalogChanged?.(); }
        catch (error) { setNotice({ type: 'error', text: `${resultText} O catálogo não pôde ser sincronizado: ${error.message}` }); }
      }
    } catch (error) { setNotice({ type: 'error', text: error.message }); }
    finally { setDiscovering(false); }
  };

  const runCatalogResearch = async () => {
    const ids = [...selected].map(Number);
    if (!ids.length) return;
    setResearching(true); setProgress({ processed: 0, total: ids.length }); setNotice(null);
    try {
      const completed = await researchCatalogOpportunities(ids, updateResearchProgress);
      activeRunIdRef.current = completed.id;
      setActiveRunId(completed.id); setSelected(new Set());
      setProposalFilter('pending');
      setNotice({ type: completed.status === 'completed' ? 'success' : 'error', text: completed.failed_count
        ? `${countLabel(completed.processed_count, 'oportunidade pesquisada', 'oportunidades pesquisadas')}. ${countLabel(completed.failed_count, 'pesquisa falhou', 'pesquisas falharam')}. Consulte o log para ver onde cada uma parou.`
        : `${countLabel(completed.processed_count, 'oportunidade pesquisada', 'oportunidades pesquisadas')} sem falhas.` });
      await load(completed.id);
    } catch (error) {
      const persistence = error.runId
        ? `A execução #${error.runId} ficou salva e pode ser retomada no histórico.`
        : 'A execução não chegou a ser criada; nada foi salvo no histórico.';
      setNotice({ type: 'error', text: `${error.message} ${persistence}` });
      await load(error.runId);
    } finally { setResearching(false); setProgress(null); }
  };

  const resume = async (run) => {
    setResearching(true); setProgress({ processed: run.processed_count, total: run.requested_count }); setNotice(null);
    try {
      const completed = await resumeCatalogResearch(run, updateResearchProgress);
      setNotice({ type: 'success', text: `Execução retomada: ${completed.processed_count} de ${completed.requested_count} processadas.` });
      await load(run.id); setActiveRunId(run.id); setTab('review');
    } catch (error) { setNotice({ type: 'error', text: error.message }); await load(run.id); }
    finally { setResearching(false); setProgress(null); }
  };

  const proposalSelection = (proposal) => fieldSelections[proposal.id] || Object.keys(proposal.changes || {});
  const toggleProposalField = (proposal, field) => setFieldSelections((current) => {
    const values = proposalSelection(proposal);
    return { ...current, [proposal.id]: values.includes(field) ? values.filter((item) => item !== field) : values.concat(field) };
  });
  const editProposalField = (proposal, field, value) => setFieldEdits((current) => ({
    ...current,
    [proposal.id]: { ...(current[proposal.id] || {}), [field]: value },
  }));
  const resetProposalField = (proposal, field) => setFieldEdits((current) => {
    const proposalEdits = { ...(current[proposal.id] || {}) };
    delete proposalEdits[field];
    if (Object.keys(proposalEdits).length) return { ...current, [proposal.id]: proposalEdits };
    const next = { ...current };
    delete next[proposal.id];
    return next;
  });
  const clearProposalEdits = (proposalId) => setFieldEdits((current) => {
    const next = { ...current };
    delete next[proposalId];
    return next;
  });
  const applyProposal = async (proposal, fields, edits) => {
    setReviewingId(proposal.id); setNotice(null);
    try {
      const updated = await applyResearchProposal(proposal.id, fields, edits);
      mergeProposal(updated);
      clearProposalEdits(proposal.id);
      setNotice({ type: 'success', text: `Mudanças aplicadas em “${proposal.opportunity?.title || proposal.original?.title}”.` });
      await onCatalogChanged?.(); await load(activeRunId);
    } catch (error) { setNotice({ type: 'error', text: error.message }); }
    finally { setReviewingId(null); }
  };
  const refreshCatalog = async () => {
    if (!onCatalogChanged) return;
    setRefreshingCatalog(true); setNotice(null);
    try {
      const next = await onCatalogChanged();
      setNotice({ type: 'success', text: `Catálogo atualizado: ${countLabel(next.length, 'oportunidade carregada', 'oportunidades carregadas')}.` });
    } catch (error) {
      setNotice({ type: 'error', text: `Não foi possível atualizar o catálogo: ${error.message}` });
    } finally {
      setRefreshingCatalog(false);
    }
  };
  const rejectProposal = async (proposal) => {
    setReviewingId(proposal.id); setNotice(null);
    try { const updated = await rejectResearchProposal(proposal.id); mergeProposal(updated); clearProposalEdits(proposal.id); await load(activeRunId); }
    catch (error) { setNotice({ type: 'error', text: error.message }); }
    finally { setReviewingId(null); }
  };

  const tabs = [
    { value: 'review', label: 'Revisar catálogo' },
    { value: 'discover', label: 'Encontrar oportunidades' },
    { value: 'runs', label: `Execuções (${runs.length})` },
  ];
  if (loading) return <div className="workflow-empty">Carregando o Sentinel…</div>;

  return (
    <div className="sentinel-page">
      <Tabs items={tabs} value={tab} onChange={setTab} />
      {notice && <div className={`workflow-notice workflow-notice--${notice.type}`}>{notice.text}</div>}

      {tab === 'review' && (
        <>
          <section className="research-hero">
            <div><span className="sentinel-eyebrow">REVISÃO ASSISTIDA</span><h2>Compare fontes e revise cada mudança.</h2><p>O Sentinel compara as oportunidades com páginas oficiais. Você escolhe quais sugestões aplicar.</p></div>
            <div className="research-hero-counter"><strong>{selected.size}</strong><span>{selected.size === 1 ? 'selecionada' : 'selecionadas'}</span><Button variant="primary" iconLeft={Ic('sparkles', 'ico-xs')} onClick={runCatalogResearch} disabled={!perms.canWrite || researching || selected.size === 0}>{researching ? 'Pesquisando…' : 'Gerar propostas'}</Button></div>
          </section>
          {progress && <div className="research-progress"><div style={{ width: `${Math.min(100, (progress.processed / progress.total) * 100)}%` }} /><span>{progress.processed} de {progress.total} {progress.total === 1 ? 'pesquisada' : 'pesquisadas'}</span></div>}

          <Card>
            <CardHeader className="section-card-header"><div><CardTitle style={{ fontSize: 16 }}>Escolher oportunidades</CardTitle><p className="card-helper">{catalogLoading || refreshingCatalog ? 'Sincronizando oportunidades com o catálogo…' : 'Filtros e ordenação são compartilhados com o catálogo e a Newsletter.'}</p></div><div className="research-selection-actions"><Button variant="ghost" size="sm" iconLeft={Ic('refresh-cw', 'ico-xs')} onClick={refreshCatalog} disabled={catalogLoading || refreshingCatalog}>{catalogLoading || refreshingCatalog ? 'Atualizando…' : 'Atualizar catálogo'}</Button><Button variant="ghost" size="sm" onClick={() => setSelected(new Set())} disabled={!selected.size}>Limpar</Button><Button variant="outline" size="sm" onClick={() => selectRows(opportunityFilter.rows)} disabled={catalogLoading || refreshingCatalog}>Selecionar resultados</Button><Button variant="outline" size="sm" onClick={() => selectRows(allResearchable)} disabled={catalogLoading || refreshingCatalog}>Selecionar todas ({allResearchable.length})</Button></div></CardHeader>
            <CardBody>
              <OpportunityFilters controller={opportunityFilter} total={opportunities.length} />
              <div className="research-opportunity-list">
                {(catalogLoading && opportunities.length === 0) ? <div className="workflow-empty">Carregando oportunidades do catálogo…</div> : opportunityFilter.rows.length === 0 ? <div className="workflow-empty">Nenhuma oportunidade encontrada com estes filtros.</div> : opportunityFilter.rows.map((opportunity) => {
                  const id = opportunityId(opportunity);
                  const checked = selected.has(id);
                  const availability = opportunityAvailability(opportunity);
                  return (
                    <article className="research-opportunity-row" data-selected={checked} key={id} onClick={() => opportunity.link && toggleOpportunity(id)}>
                      <Checkbox checked={checked} onChange={() => toggleOpportunity(id)} onClick={(event) => event.stopPropagation()} disabled={!opportunity.link} />
                      <span><strong>{opportunity.titulo}</strong><small>{opportunity.tipo || 'Sem tipo'} · prazo: {opportunity.prazo || 'não informado'}</small></span>
                      <Badge variant={opportunity.link ? availabilityVariant(opportunity) : 'danger'}>{opportunity.link ? availability : 'Sem link'}</Badge>
                    </article>
                  );
                })}
              </div>
            </CardBody>
          </Card>

          <Card flat>
            <CardHeader className="section-card-header"><div><CardTitle style={{ fontSize: 16 }}>Revisar propostas</CardTitle><p className="card-helper">Confira as fontes e selecione apenas as mudanças que deseja aplicar.</p></div><div className="research-proposal-controls"><Select value={activeRunId || ''} onChange={(event) => { const id = event.target.value; const nextRun = catalogRuns.find((run) => String(run.id) === String(id)); activeRunIdRef.current = id || null; setActiveRunId(id); setProposalFilter(preferredProposalFilter(nextRun)); }} style={{ minWidth: 220 }}><option value="">Nenhuma execução</option>{catalogRuns.map((run) => <option key={run.id} value={run.id}>Execução #{run.id} · {formatDate(run.started_at, true)} · {run.processed_count}/{run.requested_count}</option>)}</Select><Select value={proposalFilter} onChange={(event) => setProposalFilter(event.target.value)} style={{ minWidth: 200 }}><option value="pending">Aguardando revisão ({proposalCounts.pending || 0})</option><option value="all">Todos os resultados ({proposalCounts.all || 0})</option>{Object.entries(PROPOSAL_STATUS).filter(([value]) => value !== 'pending').map(([value, config]) => <option value={value} key={value}>{config.label} ({proposalCounts[value] || 0})</option>)}</Select></div></CardHeader>
            <CardBody className="research-proposals">
              {!activeRun ? <div className="workflow-empty">Execute uma pesquisa para gerar propostas.</div> : (
                <>
                  {proposals.length === 0 ? <div className="workflow-empty">Nenhuma proposta neste filtro.</div> : proposals.map((proposal) => <ProposalCard key={proposal.id} proposal={proposal} selection={proposalSelection(proposal)} edits={fieldEdits[proposal.id] || {}} onToggleField={toggleProposalField} onEditField={editProposalField} onResetField={resetProposalField} onApply={applyProposal} onReject={rejectProposal} busy={reviewingId === proposal.id} />)}
                  <details className="sentinel-run-details" key={activeRun.id} onToggle={(event) => setExpandedReviewLogId(event.currentTarget.open ? activeRun.id : null)}>
                    <summary>Ver log completo da execução #{activeRun.id}<span>{countLabel(activeRun.proposals?.length || 0, 'resultado')}</span></summary>
                    {String(expandedReviewLogId) === String(activeRun.id) && <RunLog run={activeRun} now={clockNow} />}
                  </details>
                </>
              )}
            </CardBody>
          </Card>
        </>
      )}

      {tab === 'discover' && (
        <>
          <section className="sentinel-hero"><div><span className="sentinel-eyebrow">RADAR DE OPORTUNIDADES</span><h2>Encontre novas oportunidades para revisar.</h2><p>Busque novas fontes e analise toda a fila. Cada oportunidade passa por revisão antes de ser publicada.</p></div><Button variant="primary" iconLeft={Ic(discovering ? 'loader-circle' : 'radar', 'ico-sm')} onClick={executeDiscovery} disabled={!perms.canWrite || discovering}>{discovering ? 'Analisando fila…' : 'Buscar e analisar fila'}</Button></section>
          <div className="sentinel-stats"><Card><CardBody><Stat label="Na fila" value={posts.filter((post) => post.status === 'queued').length} icon={Ic('list-ordered', 'ico-sm')} /></CardBody></Card><Card><CardBody><Stat label="Processando" value={posts.filter((post) => post.status === 'pending').length} icon={Ic('clock-3', 'ico-sm')} /></CardBody></Card><Card><CardBody><Stat label="Qualificadas" value={posts.filter((post) => post.status === 'qualified').length} icon={Ic('badge-check', 'ico-sm')} /></CardBody></Card><Card><CardBody><Stat label="Duplicadas" value={posts.filter((post) => post.status === 'duplicate').length} icon={Ic('copy-check', 'ico-sm')} /></CardBody></Card><Card><CardBody><Stat label="Falhas" value={posts.filter((post) => post.status === 'failed').length} icon={Ic('triangle-alert', 'ico-sm')} /></CardBody></Card></div>
          <Card><CardHeader><CardTitle style={{ fontSize: 16 }}>Pesquisar uma URL</CardTitle><p className="card-helper">Use a pesquisa manual para uma nova oportunidade que ainda não está no catálogo.</p></CardHeader><CardBody><form className="sentinel-manual" onSubmit={addManual}><Input type="url" value={manualUrl} onChange={(event) => setManualUrl(event.target.value)} placeholder="https://programa.org/inscricoes" disabled={!perms.canWrite || discovering} /><Button type="submit" variant="outline" iconLeft={Ic('search', 'ico-xs')} disabled={!manualUrl.trim() || !perms.canWrite || discovering}>Pesquisar URL</Button></form></CardBody></Card>
          <Card flat><CardHeader className="section-card-header"><div><CardTitle style={{ fontSize: 16 }}>Resultados por fonte</CardTitle><p className="card-helper">Consulte o resultado, o motivo e as páginas usadas em cada análise.</p></div><Select value={logFilter} onChange={(event) => setLogFilter(event.target.value)} style={{ width: 180 }}><option value="all">Todos os status</option>{Object.entries(SENTINEL_STATUS).map(([value, config]) => <option key={value} value={value}>{config.label}</option>)}</Select></CardHeader><CardBody style={{ paddingTop: 8 }}>{filteredPosts.length === 0 ? <div className="workflow-empty">Nenhum registro neste filtro.</div> : <div className="sentinel-log">{filteredPosts.map((post) => { const status = SENTINEL_STATUS[post.status] || SENTINEL_STATUS.pending; return <article className="sentinel-log-row" key={post.id}><div className="sentinel-score">{post.score}</div><div className="sentinel-log-main"><div className="sentinel-log-meta"><strong>{post.source_type === 'manual' ? 'Entrada manual' : `@${post.owner_username || 'instagram'}`}</strong><span>{formatDate(post.processed_at || post.created_at)}</span><Badge variant={status.variant} dot>{status.label}</Badge></div><p>{post.opportunity?.title || post.caption || post.source_url}</p>{post.error && <small className="sentinel-log-error">{post.error}</small>}<DiscoveryDetails post={post} /></div><a className="row-action" href={post.source_url} target="_blank" rel="noreferrer" aria-label="Abrir fonte">{Ic('external-link', 'ico-sm')}</a></article>; })}</div>}</CardBody></Card>
        </>
      )}

      {tab === 'runs' && (
        <Card flat>
          <CardHeader><CardTitle style={{ fontSize: 16 }}>Uso e histórico de execuções</CardTitle><p className="card-helper">Abra qualquer execução para ver uma linha do tempo com resultados, falhas, fontes e consumo de API.</p></CardHeader>
          <CardBody className="research-run-list">
            {runs.length === 0 ? <div className="workflow-empty">Nenhuma execução registrada.</div> : runs.map((run) => {
              const status = RESEARCH_RUN_STATUS[run.status] || RESEARCH_RUN_STATUS.running;
              const remaining = run.requested_count - run.processed_count;
              const resumable = run.run_type === 'catalog_review' && (remaining > 0 || run.status === 'running');
              const inspected = String(inspectedRunId) === String(run.id);
              return (
                <article className="research-run-row" data-selected={inspected} key={run.id}>
                  <div className="research-run-mark">{Ic(run.run_type === 'catalog_review' ? 'refresh-cw' : run.run_type === 'manual' ? 'link' : 'radar', 'ico-sm')}</div>
                  <div><strong>{RUN_TYPES[run.run_type]}</strong><small>{formatDate(run.started_at, true)} · <Usage run={run} /></small></div>
                  <div className="research-run-count"><strong>{run.processed_count}/{run.requested_count}</strong><span>{run.requested_count === 1 ? 'processada' : 'processadas'}</span></div>
                  <Badge variant={status.variant} dot>{status.label}</Badge>
                  <div className="research-run-actions">
                    <Button variant={inspected ? 'primary' : 'outline'} size="sm" onClick={() => setInspectedRunId(inspected ? null : run.id)}>{inspected ? 'Fechar log' : 'Ver log'}</Button>
                    {resumable && <Button variant="outline" size="sm" onClick={() => resume(run)} disabled={researching}>{remaining > 0 ? `Retomar (${remaining})` : 'Finalizar'}</Button>}
                  </div>
                </article>
              );
            })}
            {inspectedRun && <RunLog run={inspectedRun} now={clockNow} />}
          </CardBody>
        </Card>
      )}
    </div>
  );
}
