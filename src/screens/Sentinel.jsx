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
  addManualOpportunity, applyResearchProposal, dismissSentinelPost, fetchResearchRun, fetchResearchRuns,
  fetchSentinelPostCounts, fetchSentinelPosts,
  PROPOSAL_STATUS, RESEARCH_RUN_STATUS, rejectResearchProposal, researchCatalogOpportunities,
  resumeCatalogResearch, runSentinel, SENTINEL_STATUS,
} from '../lib/sentinel';
import {
  collectSources, researchCandidates, WEB_SOURCES, enrichApprovedOpportunityNow,
  cancelResearch,
} from '../lib/scraperWeb';
import {
  addInstagramAccount, fetchInstagramAccounts, removeInstagramAccount, setInstagramAccountActive,
} from '../lib/instagramAccounts';
import { deleteOpportunity, updateOpportunity } from '../lib/opportunities';

const FIELD_LABELS = {
  title: 'Título', description: 'Descrição', link: 'Link', deadline: 'Prazo', areas: 'Áreas',
  level: 'Nível', audience: 'Público-alvo', location: 'Local/formato', cost: 'Custo',
  language: 'Idioma', keywords: 'Palavras-chave', eligibility: 'Elegibilidade',
  process: 'Sobre o processo', applicants: 'Dicas', additionals: 'Informações adicionais', type: 'Tipo',
  status: 'Disponibilidade', qualification_status: 'Qualificação', qualification_reason: 'Motivo da qualificação',
};
const RUN_TYPES = {
  discovery: 'Descoberta no Instagram', manual: 'Pesquisa por URL', catalog_review: 'Revisão do catálogo',
  enrichment: 'Enriquecimento de links', web_research: 'Pesquisa de candidatos (sites)',
};
const MODEL_LABELS = {
  'openai/gpt-oss-20b': 'GPT OSS 20B',
  'openai/gpt-oss-120b': 'GPT OSS 120B',
  'z-ai/glm-5.2': 'GLM 5.2',
};
const SOURCE_AUTHORITY_LABELS = {
  official_rules_or_application: 'Regulamento ou inscrição oficial',
  same_organization_site: 'Site da organização',
  seed_site_unverified: 'Página inicial ainda não confirmada',
  linked_application_platform: 'Plataforma de inscrição vinculada',
  social_lead: 'Post de origem',
  third_party_or_unverified: 'Terceiro ou fonte não verificada',
};
const ARRAY_EDIT_FIELDS = new Set(['areas', 'level', 'keywords']);
const MULTILINE_EDIT_FIELDS = new Set(['description', 'location', 'cost', 'eligibility', 'process', 'applicants', 'additionals']);
const EDIT_SELECT_OPTIONS = {
  type: ['Programas Acadêmicos', 'Olimpíadas Científicas', 'Competições', 'Competições de Escrita', 'Mentorias', 'Bolsas de Estudo', 'Programas de Intercâmbio', 'MUNs', 'Estágios'],
  status: ['Aprovada', 'Revisar', 'Rascunho', 'Encerrada'],
  qualification_status: ['pending', 'qualified', 'unqualified'],
};
const QUALIFICATION_LABELS = { pending: 'Pendente', qualified: 'Qualificada', unqualified: 'Desqualificada' };

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
  : field === 'qualification_status' ? (QUALIFICATION_LABELS[value] || displayValue(value))
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

function ResearchSources({ sources = [] }) {
  if (!sources.length) return null;
  return (
    <div className="sentinel-source-links">
      <strong>Páginas lidas e confiabilidade</strong>
      {sources.map((source) => {
        const rank = Number(source.trust?.trust_rank || 0);
        const authority = SOURCE_AUTHORITY_LABELS[source.trust?.authority]
          || source.trust?.authority
          || 'Fonte ainda não classificada';
        return (
          <div className="sentinel-source-link-row" key={source.url}>
            <a href={source.url} target="_blank" rel="noreferrer">{source.relation || 'Fonte pesquisada'} {Ic('external-link', 'ico-xs')}</a>
            <span>{authority}{rank > 0 ? ` · confiabilidade ${rank}/5` : ''}</span>
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
        <ResearchSources sources={sources} />
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

      {run.run_type === 'enrichment' && (
        <div className="sentinel-run-log__enrichment">
          <p><strong>Oportunidade:</strong> {run.metadata?.opportunity_title || `#${run.metadata?.opportunity_id}`}</p>
          {(run.metadata?.links || []).length > 0 ? (
            <ul>
              {run.metadata.links.map((link, i) => (
                <li key={i}>
                  <a href={link.url} target="_blank" rel="noopener noreferrer">{link.label || link.url}</a>
                  {' '}· {link.platform}
                </li>
              ))}
            </ul>
          ) : (
            <p>Nenhum link novo adicionado ({run.metadata?.avaliados || 0} candidato{run.metadata?.avaliados === 1 ? '' : 's'} avaliado{run.metadata?.avaliados === 1 ? '' : 's'}).</p>
          )}
          {run.metadata?.errors && Object.keys(run.metadata.errors).length > 0 && (
            <p className="sentinel-run-timeline__error">
              Falhas parciais: {Object.entries(run.metadata.errors).map(([fonte, msg]) => `${fonte} (${msg})`).join('; ')}
            </p>
          )}
        </div>
      )}

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
        {EDIT_SELECT_OPTIONS[field].map((option) => <option value={option} key={option}>{displayFieldValue(field, option)}</option>)}
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
  const changes = Object.entries(proposal.changes || {})
    .filter(([field]) => field !== 'qualification_reason' && proposal.evidence?.[field]?.kind !== 'qualification_gap')
    .sort(([a], [b]) => (a === 'deadline' ? -1 : b === 'deadline' ? 1 : 0));
  const selectedFields = selection || changes.map(([field]) => field);
  const researchedSources = proposal.evidence?._sentinel?.sources || [];
  return (
    <Card className={`research-proposal${proposal.status !== 'pending' ? ' research-proposal--reviewed' : ''}`}>
      <CardHeader className="research-proposal-header">
        <div>
          <div className="research-proposal-title"><CardTitle style={{ fontSize: 16 }}>{proposal.opportunity?.title || proposal.original?.title || 'Oportunidade removida'}</CardTitle>{proposal.source_url && <a href={proposal.source_url} target="_blank" rel="noreferrer" aria-label="Abrir fonte">{Ic('external-link', 'ico-xs')}</a>}</div>
          <p className="card-helper">{countLabel(changes.length, 'campo com atualização sugerida', 'campos com atualização sugerida')}.</p>
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
      {researchedSources.length > 0 && (
        <details className="sentinel-source-details research-proposal-sources">
          <summary>Ver fontes comparadas<span>{countLabel(researchedSources.length, 'fonte')}</span></summary>
          <div className="sentinel-source-details__body"><ResearchSources sources={researchedSources} /></div>
        </details>
      )}
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

// Campos do catálogo mostrados por completo em cada achado qualificado —
// antes só aparecia o título e a legenda original, o resto ficava escondido
// atrás de "Ver pesquisa". Sem ver custo/elegibilidade/prazo etc. de cara, a
// única forma de decidir era abrir "Em revisão" à parte.
const QUALIFIED_REVIEW_FIELDS = [
  'title', 'description', 'link', 'deadline', 'type', 'areas', 'level',
  'location', 'cost', 'language', 'eligibility', 'process', 'applicants',
  'additionals', 'keywords',
];

function QualifiedPostCard({ post, onApprove, onReject, onDismiss, busy, canWrite }) {
  const extracted = post.extracted || {};
  const qualification = QUALIFICATION_LABELS[extracted.qualification_status] || QUALIFICATION_LABELS.pending;
  const alreadyDecided = post.opportunity && post.opportunity.status !== 'Revisar';
  return (
    <Card className="research-proposal">
      <CardHeader className="research-proposal-header">
        <div>
          <div className="research-proposal-title">
            <CardTitle style={{ fontSize: 16 }}>{extracted.title || post.opportunity?.title || post.caption || 'Sem título'}</CardTitle>
            {(extracted.link || post.source_url) && <a href={extracted.link || post.source_url} target="_blank" rel="noreferrer" aria-label="Abrir fonte">{Ic('external-link', 'ico-xs')}</a>}
          </div>
          <p className="card-helper">{post.source_type === 'manual' ? 'Entrada manual' : post.source_type === 'web' ? (post.owner_username || 'Web') : `@${post.owner_username || 'instagram'}`} · {formatDate(post.processed_at || post.created_at)}</p>
        </div>
        <Badge variant={extracted.qualification_status === 'qualified' ? 'success' : 'warning'} dot>{qualification}</Badge>
      </CardHeader>
      <CardBody className="research-change-list">
        {extracted.qualification_reason && <div className="workflow-notice workflow-notice--warning" style={{ marginBottom: 12 }}>{extracted.qualification_reason}</div>}
        {QUALIFIED_REVIEW_FIELDS.map((field) => {
          const value = extracted[field];
          if (value == null || value === '' || (Array.isArray(value) && value.length === 0)) return null;
          return (
            <article className="research-change" key={field}>
              <div className="research-change-check"><strong>{FIELD_LABELS[field] || field}</strong></div>
              <div className="research-change-values"><span>{displayFieldValue(field, value)}</span></div>
              {extracted.evidence?.[field] && <Evidence value={extracted.evidence[field]} />}
            </article>
          );
        })}
      </CardBody>
      <DiscoveryDetails post={post} />
      <div className="research-proposal-footer">
        {alreadyDecided ? (
          <Badge variant="neutral">{post.opportunity.status === 'Aprovada' ? 'Já aprovada' : post.opportunity.status}</Badge>
        ) : !post.opportunity?.id ? (
          <>
            <Badge variant="neutral">Sem oportunidade vinculada nesta versão</Badge>
            <Button variant="ghost" size="sm" onClick={() => onDismiss(post)} disabled={busy || !canWrite}>{busy ? 'Descartando…' : 'Descartar'}</Button>
          </>
        ) : (
          <>
            <Button variant="ghost" size="sm" onClick={() => onReject(post)} disabled={busy || !canWrite}>Rejeitar</Button>
            <Button variant="primary" size="sm" iconLeft={Ic('check', 'ico-xs')} onClick={() => onApprove(post)} disabled={busy || !canWrite}>{busy ? 'Aplicando…' : 'Aplicar e publicar'}</Button>
          </>
        )}
      </div>
    </Card>
  );
}

export default function Sentinel({ perms, opportunities = [], catalogLoading = false, onCatalogChanged }) {
  const [tab, setTab] = useState('review');
  const [posts, setPosts] = useState([]);
  const [postCounts, setPostCounts] = useState({});
  const [runs, setRuns] = useState([]);
  const [loading, setLoading] = useState(true);
  const [researching, setResearching] = useState(false);
  const [manualBusy, setManualBusy] = useState(false);
  const [reviewingId, setReviewingId] = useState(null);
  const [manualUrl, setManualUrl] = useState('');
  // Antes o padrão era 'all': misturava na fila/processando/duplicada/rejeitada/
  // falhou junto com as qualificadas, deixando a lista enorme e confusa. Por
  // padrão agora só mostra o que realmente importa revisar: as qualificadas.
  const [logFilter, setLogFilter] = useState('qualified');
  const [postActionBusy, setPostActionBusy] = useState(null);
  const [igManagerOpen, setIgManagerOpen] = useState(false);
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
  const [loadingRunId, setLoadingRunId] = useState(null);
  const [clockNow, setClockNow] = useState(() => Date.now());
  const [webFontesEscolhidas, setWebFontesEscolhidas] = useState(() => new Set(WEB_SOURCES));
  // Instagram não é "um site" do FONTES (roda via Apify, num pipeline
  // próprio) — não dá pra simplesmente somar ele à lista `sites` mandada pro
  // scraper de sites, ou o backend rejeita ("nenhuma fonte encontrada"). Por
  // isso é um checkbox separado aqui do lado, mas o clique único de "Buscar e
  // analisar" já dispara os dois pipelines juntos quando marcado.
  const [instagramEscolhido, setInstagramEscolhido] = useState(true);
  // Progresso ao vivo da busca de sites — sem isso, "Buscar e
  // analisar" fica minutos parado no mesmo texto (coletando várias fontes,
  // depois pesquisando um por um com IA) e parece travado/quebrado, mesmo
  // funcionando normalmente. `webStage` marca em qual das duas fases está;
  // `webProgress` guarda quantos itens já foram processados de quantos, lido
  // direto da run (sentinel_posts ligados a ela via run_id) enquanto ela roda.
  const [webStage, setWebStage] = useState(null); // 'collect' | 'research' | null
  const [webProgress, setWebProgress] = useState(null); // { processed, total }
  const [webBusy, setWebBusy] = useState(null); // rótulo do que está rodando agora, ou null
  const [webError, setWebError] = useState('');
  const [webRunId, setWebRunId] = useState(null); // id da execução de pesquisa em andamento, pra poder cancelar
  const [cancelandoRunId, setCancelandoRunId] = useState(null);
  // Detalhe por fonte da última coleta — pra responder "por que uma
  // oportunidade que eu sei que existe não apareceu?": mostra quantos itens
  // brutos cada site trouxe e quantos foram descartados, e por qual motivo
  // (filtro de palavra-chave, título duplicado, URL já vista), em vez de só
  // o total final que sobrou na fila.
  const [collectReport, setCollectReport] = useState(null);
  const [igAccounts, setIgAccounts] = useState([]);
  const [igNovoUsername, setIgNovoUsername] = useState('');
  const [igBusy, setIgBusy] = useState(false);
  const [igError, setIgError] = useState('');
  const activeRunIdRef = useRef(null);
  const loadRequestRef = useRef(0);
  const opportunityFilter = useOpportunityFilters(opportunities, { initialSort: 'prazo' });

  const hydrateRun = useCallback(async (runId) => {
    if (!runId) return null;
    setLoadingRunId(runId);
    try {
      const detail = await fetchResearchRun(runId);
      setRuns((current) => current.map((run) => String(run.id) === String(runId) ? detail : run));
      return detail;
    } catch (error) {
      setNotice({ type: 'error', text: error.message });
      return null;
    } finally {
      setLoadingRunId((current) => String(current) === String(runId) ? null : current);
    }
  }, []);

  const load = useCallback(async (preferredRunId) => {
    const requestId = ++loadRequestRef.current;
    try {
      const [nextPosts, nextRuns, nextCounts] = await Promise.all([fetchSentinelPosts(), fetchResearchRuns(), fetchSentinelPostCounts()]);
      if (requestId !== loadRequestRef.current) return;
      setPosts(nextPosts);
      setPostCounts(nextCounts);
      setRuns((current) => nextRuns.map((run) => {
        const previous = current.find((item) => String(item.id) === String(run.id));
        return previous?.proposals ? { ...run, proposals: previous.proposals, posts: previous.posts || [] } : run;
      }));
      const catalogRuns = nextRuns.filter((run) => run.run_type === 'catalog_review');
      const currentRunId = activeRunIdRef.current;
      const preferred = catalogRuns.find((run) => String(run.id) === String(preferredRunId || currentRunId)) || catalogRuns[0];
      if (preferred) {
        activeRunIdRef.current = preferred.id;
        setActiveRunId(preferred.id);
        if (preferredRunId || !currentRunId) setProposalFilter(preferredProposalFilter(preferred));
        await hydrateRun(preferred.id);
      }
    } catch (error) {
      if (requestId === loadRequestRef.current) setNotice({ type: 'error', text: error.message });
    } finally {
      if (requestId === loadRequestRef.current) setLoading(false);
    }
  }, [hydrateRun]);

  const loadInstagramAccounts = useCallback(async () => {
    try { setIgAccounts(await fetchInstagramAccounts()); }
    catch (error) { setIgError(error.message); }
  }, []);
  useEffect(() => { void loadInstagramAccounts(); }, [loadInstagramAccounts]);

  const adicionarContaInstagram = async (event) => {
    event.preventDefault();
    if (!igNovoUsername.trim()) return;
    setIgBusy(true); setIgError('');
    try {
      await addInstagramAccount(igNovoUsername);
      setIgNovoUsername('');
      await loadInstagramAccounts();
    } catch (error) { setIgError(error.message); }
    finally { setIgBusy(false); }
  };
  const alternarContaInstagram = async (conta) => {
    setIgBusy(true); setIgError('');
    try { await setInstagramAccountActive(conta.username, !conta.active); await loadInstagramAccounts(); }
    catch (error) { setIgError(error.message); }
    finally { setIgBusy(false); }
  };
  const removerContaInstagram = async (conta) => {
    setIgBusy(true); setIgError('');
    try { await removeInstagramAccount(conta.username); await loadInstagramAccounts(); }
    catch (error) { setIgError(error.message); }
    finally { setIgBusy(false); }
  };


  // A oportunidade já existe no catálogo (status "Revisar") assim que o post
  // vira "Qualificada" — pra nunca se perder, mesmo se ninguém revisar aqui.
  // Aprovar/rejeitar nesta tela é só um atalho que evita abrir "Em revisão"
  // separadamente pra decidir sobre cada achado do Sentinel.
  const aprovarPost = async (post) => {
    if (!post.opportunity?.id) return;
    setPostActionBusy(post.id); setNotice(null);
    try {
      // Mesmo raciocínio do botão "Publicar" em Oportunidades/Revisão: se o
      // Sentinel tinha deixado isso como "pending" (elegibilidade incerta),
      // aprovar aqui é a revisão humana que resolve essa dúvida — sem isso,
      // o badge "Elegibilidade incerta" ficaria preso mesmo depois de aprovada.
      const patch = { status: 'Aprovada' };
      if (post.opportunity.qualification_status === 'pending') {
        patch.qualification_status = 'qualified';
        patch.qualification_reason = 'Revisado e aprovado manualmente por um administrador.';
      }
      await updateOpportunity(post.opportunity.id, patch);
      setNotice({ type: 'success', text: `“${post.opportunity.title || post.extracted?.title || 'Oportunidade'}” aprovada e publicada.` });
      // Assim que aprova, já dispara a busca de links extras (Serper/YouTube/
      // Reddit) — não espera mais o cron diário (removido a pedido). Apoio:
      // nunca trava a aprovação nem aparece como erro pro usuário se falhar.
      enrichApprovedOpportunityNow(post.opportunity.id).catch((e) => {
        console.error('Enriquecimento automático falhou:', e.message);
      });
      await Promise.all([load(), onCatalogChanged?.()]);
    } catch (error) { setNotice({ type: 'error', text: error.message }); }
    finally { setPostActionBusy(null); }
  };
  const rejeitarPost = async (post) => {
    if (!post.opportunity?.id) return;
    setPostActionBusy(post.id); setNotice(null);
    try {
      await deleteOpportunity(post.opportunity.id);
      setNotice({ type: 'success', text: `“${post.opportunity.title || post.extracted?.title || 'Oportunidade'}” descartada.` });
      await Promise.all([load(), onCatalogChanged?.()]);
    } catch (error) { setNotice({ type: 'error', text: error.message }); }
    finally { setPostActionBusy(null); }
  };
  // Posts "qualificados" sem oportunidade vinculada (processados antes das
  // correções mais recentes) não têm o que aplicar/rejeitar no catálogo —
  // só dá pra tirar da vista mesmo, marcando o post como descartado.
  const dismissarPost = async (post) => {
    setPostActionBusy(post.id); setNotice(null);
    try {
      await dismissSentinelPost(post.id, 'Descartado manualmente (sem oportunidade vinculada).');
      setNotice({ type: 'success', text: `“${post.extracted?.title || post.caption || 'Registro'}” descartado.` });
      await load();
    } catch (error) { setNotice({ type: 'error', text: error.message }); }
    finally { setPostActionBusy(null); }
  };

  useEffect(() => { void load(); }, [load]);
  useEffect(() => {
    // Antes havia também um setInterval(syncVisible, 15000) — recarregava a tela
    // sozinha a cada 15s mesmo com o usuário no meio de uma revisão (perdia
    // seleção/scroll). Recarregar só quando a aba volta a ficar visível ou
    // recebe foco é suficiente pra ver runs terminados sem esse incômodo.
    const syncVisible = () => {
      if (document.visibilityState === 'visible') void load();
    };
    window.addEventListener('focus', syncVisible);
    document.addEventListener('visibilitychange', syncVisible);
    return () => {
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
  // Enquanto a pesquisa (fase cara, com IA) estiver rodando com um runId
  // conhecido, busca a run a cada poucos segundos só pra contar quantos itens
  // ligados a ela já saíram de "pending"/"queued" — isso já muda a cada item
  // processado, mesmo a run em si só sendo fechada (updateRun) no final.
  useEffect(() => {
    if (webStage !== 'research' || !webRunId) { setWebProgress(null); return undefined; }
    let cancelado = false;
    const verificar = async () => {
      try {
        const run = await fetchResearchRun(webRunId);
        if (cancelado || !run) return;
        const posts = run.posts || [];
        const processados = posts.filter((post) => post.status !== 'pending' && post.status !== 'queued').length;
        setWebProgress({ processed: processados, total: posts.length || run.requested_count || 0 });
      } catch { /* silencioso — só é um contador auxiliar, não bloqueia nada */ }
    };
    void verificar();
    const interval = window.setInterval(verificar, 3000);
    return () => { cancelado = true; window.clearInterval(interval); };
  }, [webStage, webRunId]);
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
  // Achado real: "Young Feminist AI School 2026" e outras apareciam de novo
  // aqui mesmo já aprovadas no catálogo — o post é "qualificado" pra sempre
  // (é o histórico da execução que criou a oportunidade), mas não há mais
  // nada pra revisar. Antes isso ficava visível numa lista "já cadastradas"
  // que só recolhia mas nunca esvaziava — ia acumular pra sempre. Agora,
  // uma vez decidido (aprovado, encerrado etc.), o post some completamente
  // desta tela: essa fila é só pra quem ainda precisa de uma decisão.
  const qualifiedNew = useMemo(() => {
    if (logFilter !== 'qualified') return [];
    return filteredPosts.filter((post) => !post.opportunity?.id || post.opportunity.status === 'Revisar');
  }, [filteredPosts, logFilter]);

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

  const rodarWeb = async (rotulo, acao) => {
    // Antes esse botão só avisava em caso de erro — quando dava tudo certo
    // (ou quando não achava nada novo), a tela não mostrava nada, então
    // parecia que o clique não tinha feito efeito nenhum.
    setWebBusy(rotulo); setWebError(''); setNotice(null); setWebRunId(null);
    try {
      const resultado = await acao();
      await load();
      await onCatalogChanged?.();
      if (resultado) setNotice({ type: 'success', text: resultado });
    } catch (error) {
      setWebError(error.message);
    } finally {
      setWebBusy(null); setWebRunId(null); setWebStage(null); setWebProgress(null);
    }
  };
  // Cancela qualquer execução de pesquisa de candidatos (web_research) que
  // esteja "running" — tanto a que está rodando nesta aba agora (webRunId)
  // quanto uma antiga que ficou presa em "running" (ex.: a aba fechou ou a
  // function estourou o tempo antes de terminar). Não existe mais um botão
  // separado de "destravar pendentes": cancelar já devolve pra fila tudo que
  // ficou preso em "pending" daquela execução, então cancelar É a forma de
  // destravar.
  const cancelarPesquisa = async (runId = webRunId) => {
    if (!runId) return;
    setCancelandoRunId(runId);
    try {
      await cancelResearch(runId);
      setNotice({ type: 'success', text: 'Cancelamento pedido — os itens já em andamento terminam, o resto volta pra fila.' });
      await load();
    } catch (error) {
      setNotice({ type: 'error', text: error.message });
    } finally {
      setCancelandoRunId(null);
    }
  };
  const alternarWebFonte = (nome) => setWebFontesEscolhidas((prev) => {
    const next = new Set(prev);
    if (next.has(nome)) next.delete(nome); else next.add(nome);
    return next;
  });
  const addManual = async (event) => {
    event.preventDefault();
    if (!manualUrl.trim()) return;
    setManualBusy(true); setNotice(null);
    try {
      const result = await addManualOpportunity(manualUrl.trim());
      setManualUrl('');
      // "duplicate" com updated=true não é uma falha — é o caso do Ross
      // Program: a URL já existia no catálogo, mas a pesquisa achou conteúdo
      // novo (financial aid, processo etc.) e mandou a oportunidade de volta
      // pra revisão. Antes isso caía direto em "nenhuma oportunidade
      // qualificada", escondendo que algo bom aconteceu.
      const success = result.status === 'qualified' || (result.status === 'duplicate' && result.updated);
      const resultText = result.status === 'qualified'
        ? 'Oportunidade encontrada e enviada para revisão.'
        : result.status === 'duplicate' && result.updated
        ? 'Essa oportunidade já existia no catálogo — a pesquisa achou informações novas e mandou de volta para revisão.'
        : result.status === 'duplicate'
        ? 'Essa oportunidade já existe no catálogo e a pesquisa não achou nada novo além do que já está salvo.'
        : 'Nenhuma oportunidade qualificada foi encontrada nessa URL.';
      setNotice({ type: success || result.status === 'duplicate' ? 'success' : 'error', text: resultText });
      await load();
      if (success) {
        try { await onCatalogChanged?.(); }
        catch (error) { setNotice({ type: 'error', text: `${resultText} O catálogo não pôde ser sincronizado: ${error.message}` }); }
      }
    } catch (error) { setNotice({ type: 'error', text: error.message }); }
    finally { setManualBusy(false); }
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

  const proposalSelection = (proposal) => fieldSelections[proposal.id] || Object.keys(proposal.changes || {})
    .filter((field) => field !== 'qualification_reason' && proposal.evidence?.[field]?.kind !== 'qualification_gap');
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
            <CardHeader className="section-card-header"><div><CardTitle style={{ fontSize: 16 }}>Revisar propostas</CardTitle><p className="card-helper">Confira as fontes e selecione apenas as mudanças que deseja aplicar.</p></div><div className="research-proposal-controls"><Select value={activeRunId || ''} onChange={(event) => { const id = event.target.value; const nextRun = catalogRuns.find((run) => String(run.id) === String(id)); activeRunIdRef.current = id || null; setActiveRunId(id); setProposalFilter(preferredProposalFilter(nextRun)); void hydrateRun(id); }} style={{ minWidth: 220 }}><option value="">Nenhuma execução</option>{catalogRuns.map((run) => <option key={run.id} value={run.id}>Execução #{run.id} · {formatDate(run.started_at, true)} · {run.processed_count}/{run.requested_count}</option>)}</Select><Select value={proposalFilter} onChange={(event) => setProposalFilter(event.target.value)} style={{ minWidth: 200 }}><option value="pending">Aguardando revisão ({proposalCounts.pending || 0})</option><option value="all">Todos os resultados ({proposalCounts.all || 0})</option>{Object.entries(PROPOSAL_STATUS).filter(([value]) => value !== 'pending').map(([value, config]) => <option value={value} key={value}>{config.label} ({proposalCounts[value] || 0})</option>)}</Select></div></CardHeader>
            <CardBody className="research-proposals">
              {!activeRun ? <div className="workflow-empty">Execute uma pesquisa para gerar propostas.</div> : (
                <>
                  {String(loadingRunId) === String(activeRun.id) ? <div className="workflow-empty">Carregando propostas…</div> : proposals.length === 0 ? <div className="workflow-empty">Nenhuma proposta neste filtro.</div> : proposals.map((proposal) => <ProposalCard key={proposal.id} proposal={proposal} selection={proposalSelection(proposal)} edits={fieldEdits[proposal.id] || {}} onToggleField={toggleProposalField} onEditField={editProposalField} onResetField={resetProposalField} onApply={applyProposal} onReject={rejectProposal} busy={reviewingId === proposal.id} />)}
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
          <section className="sentinel-hero"><div><span className="sentinel-eyebrow">RADAR DE OPORTUNIDADES</span><h2>Encontre novas oportunidades para revisar.</h2><p>Escolha as fontes abaixo (sites e Instagram) e analise toda a fila de uma vez. Cada oportunidade passa por revisão antes de ser publicada.</p></div></section>
          {/* Antes contava só os 250 posts mais recentes (fetchSentinelPosts
              tem limite); com mais de 250 no total, os números batidos ficavam
              menores que o real (ex.: "17 Qualificadas" na tela vs. 23 no
              banco). Agora usa contagem exata por status. */}
          <div className="sentinel-stats"><Card><CardBody><Stat label="Na fila" value={postCounts.queued ?? 0} icon={Ic('list-ordered', 'ico-sm')} /></CardBody></Card><Card><CardBody><Stat label="Processando" value={postCounts.pending ?? 0} icon={Ic('clock-3', 'ico-sm')} /></CardBody></Card><Card><CardBody><Stat label="Qualificadas" value={postCounts.qualified ?? 0} icon={Ic('badge-check', 'ico-sm')} /></CardBody></Card><Card><CardBody><Stat label="Duplicadas" value={postCounts.duplicate ?? 0} icon={Ic('copy-check', 'ico-sm')} /></CardBody></Card><Card><CardBody><Stat label="Falhas" value={postCounts.failed ?? 0} icon={Ic('triangle-alert', 'ico-sm')} /></CardBody></Card></div>

          <Card flat>
            <CardHeader><CardTitle style={{ fontSize: 16 }}>Sites e fóruns (scrapers)</CardTitle><p className="card-helper">Mesma fila e mesmos filtros do Instagram. A busca já filtra duplicatas contra o catálogo e a pesquisa roda sozinha em seguida (até 25 itens por vez) — sem precisar escolher um por um. O Instagram está incluído aqui como mais uma fonte: clique nele para gerenciar as contas.</p></CardHeader>
            <CardBody>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 14, marginBottom: 10, alignItems: 'center' }}>
                {WEB_SOURCES.map((nome) => (
                  <Checkbox key={nome} label={nome} checked={webFontesEscolhidas.has(nome)} onChange={() => alternarWebFonte(nome)} />
                ))}
                <Checkbox label="Instagram" checked={instagramEscolhido} onChange={() => setInstagramEscolhido((v) => !v)} />
                <button
                  type="button"
                  onClick={() => setIgManagerOpen((open) => !open)}
                  aria-expanded={igManagerOpen}
                  style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 14, background: 'none', border: '1px solid var(--border)', borderRadius: 999, padding: '4px 12px', cursor: 'pointer' }}
                >
                  {Ic('instagram', 'ico-xs')}
                  <span>Instagram ({igAccounts.filter((conta) => conta.active).length} {igAccounts.filter((conta) => conta.active).length === 1 ? 'conta ativa' : 'contas ativas'})</span>
                  {Ic(igManagerOpen ? 'chevron-up' : 'chevron-down', 'ico-xs')}
                </button>
              </div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                <Button variant="outline" onClick={() => {
                  const tudoMarcado = webFontesEscolhidas.size === WEB_SOURCES.length && instagramEscolhido;
                  setWebFontesEscolhidas(tudoMarcado ? new Set() : new Set(WEB_SOURCES));
                  setInstagramEscolhido(!tudoMarcado);
                }}>
                  {webFontesEscolhidas.size === WEB_SOURCES.length && instagramEscolhido ? 'Desmarcar todas' : 'Marcar todas'}
                </Button>
                <Button
                  variant="primary"
                  disabled={!perms.canWrite || webBusy !== null}
                  iconLeft={Ic(webBusy === 'collect' ? 'loader' : 'search', 'ico-sm')}
                  onClick={() => rodarWeb('collect', async () => {
                    // Instagram roda num pipeline totalmente separado (Apify),
                    // então dispara em paralelo com a coleta+pesquisa dos
                    // sites, e o resultado dos dois é combinado num só
                    // texto — igual ao antigo botão "Buscar e analisar fila",
                    // só que agora dentro do mesmo clique dos sites.
                    setWebStage('collect'); setWebProgress(null);
                    const [coleta, instagramResult] = await Promise.all([
                      webFontesEscolhidas.size > 0 ? collectSources([...webFontesEscolhidas]) : Promise.resolve(null),
                      instagramEscolhido ? runSentinel({ allQueued: true }).catch((error) => ({ erro: error.message })) : Promise.resolve(null),
                    ]);
                    setCollectReport(coleta || null);
                    setWebStage('research');
                    // Processa o que já está na fila SEMPRE, mesmo com todas as
                    // fontes desmarcadas — desmarcar as fontes só evita buscar
                    // itens NOVOS de novo, não deveria impedir de processar o
                    // que já ficou acumulado ali (esse era o único jeito de
                    // esvaziar a fila sem precisar marcar nenhuma fonte).
                    const pesquisa = await researchCandidates({ maxCandidates: 25, onRunId: setWebRunId });
                    setWebRunId(null); setWebStage(null); setWebProgress(null);
                    return [
                      coleta ? countLabel(coleta?.totalEnfileirado || 0, 'novo item coletado', 'novos itens coletados') : null,
                      pesquisa ? countLabel(pesquisa?.processados || 0, 'item analisado', 'itens analisados') : null,
                      pesquisa?.qualificados ? countLabel(pesquisa.qualificados, 'qualificado', 'qualificados') : null,
                      pesquisa?.duplicados ? countLabel(pesquisa.duplicados, 'duplicata', 'duplicatas') : null,
                      pesquisa?.cancelado ? `pesquisa cancelada (${pesquisa.naoIniciados} item(ns) devolvido(s) à fila)` : null,
                      coleta?.limpeza ? countLabel(coleta.limpeza, 'registro antigo removido', 'registros antigos removidos') : null,
                      coleta?.travadosLiberados?.requeued ? countLabel(coleta.travadosLiberados.requeued, 'item travado devolvido à fila', 'itens travados devolvidos à fila') : null,
                      coleta?.travadosLiberados?.failed ? countLabel(coleta.travadosLiberados.failed, 'item travado movido para falhas', 'itens travados movidos para falhas') : null,
                      instagramResult?.erro ? `Instagram: ${instagramResult.erro}`
                        : instagramResult?.instagramAccounts === 0 ? 'Instagram desligado (nenhuma conta ativa)'
                        : instagramResult ? countLabel(instagramResult.created || 0, 'oportunidade do Instagram enviada para revisão', 'oportunidades do Instagram enviadas para revisão')
                        : null,
                    ].filter(Boolean).join(' · ');
                  })}
                >
                  {webBusy === 'collect'
                    ? (webStage === 'research'
                        ? (webProgress?.total ? `Analisando… ${webProgress.processed} de ${webProgress.total}` : 'Analisando oportunidades…')
                        : 'Coletando fontes selecionadas…')
                    : (webFontesEscolhidas.size + (instagramEscolhido ? 1 : 0)) === 0
                      ? 'Processar fila (sem coletar fontes novas)'
                      : `Buscar e analisar (${webFontesEscolhidas.size + (instagramEscolhido ? 1 : 0)} ${webFontesEscolhidas.size + (instagramEscolhido ? 1 : 0) === 1 ? 'fonte' : 'fontes'})`}
                </Button>
                {webBusy === 'collect' && webRunId && (
                  <Button variant="outline" onClick={() => cancelarPesquisa()} disabled={cancelandoRunId === webRunId} iconLeft={Ic('x', 'ico-sm')}>
                    {cancelandoRunId === webRunId ? 'Cancelando…' : 'Cancelar pesquisa'}
                  </Button>
                )}
              </div>
              {webError && <p style={{ color: 'var(--danger)', fontSize: 13, marginTop: 12 }}>{webError}</p>}

              {collectReport?.fontes?.length > 0 && (
                // Aberto sozinho quando alguma fonte veio com erro ou aviso —
                // esse painel mostra a linha de cada fonte com quantos itens
                // ela trouxe (ou o erro, se tiver dado algum bloqueio).
                <details style={{ marginTop: 14 }} open={collectReport.fontes.some((fonte) => fonte.erro || fonte.aviso)}>
                  <summary style={{ cursor: 'pointer', fontSize: 13, fontWeight: 600 }}>
                    Ver detalhe por fonte da última coleta
                  </summary>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginTop: 10 }}>
                    {collectReport.fontes.map((fonte) => {
                      const d = fonte.descartados || {};
                      const totalDescartado = (d.semLink || 0) + (d.filtro || 0) + (d.duplicataTitulo || 0) + (d.duplicataUrl || 0);
                      return (
                        <div key={fonte.nome} style={{ padding: 10, border: '1px solid var(--border)', borderRadius: 8, fontSize: 12.5 }}>
                          <strong>{fonte.nome}</strong> — {fonte.itensBrutos} item{fonte.itensBrutos === 1 ? '' : 's'} bruto{fonte.itensBrutos === 1 ? '' : 's'}, {fonte.novosNaFila} nova{fonte.novosNaFila === 1 ? '' : 's'} na fila
                          {fonte.erro && <p style={{ color: 'var(--danger)', margin: '4px 0 0' }}>Erro: {fonte.erro}</p>}
                          {fonte.aviso && <p style={{ color: 'var(--warning, #b45309)', margin: '4px 0 0' }}>{fonte.aviso}</p>}
                          {totalDescartado > 0 && (
                            <p style={{ color: 'var(--muted-foreground)', margin: '4px 0 0' }}>
                              Descartados: {[
                                d.filtro ? `${d.filtro} não bateram o filtro (nível/financeiro/nacionalidade)` : null,
                                d.duplicataTitulo ? `${d.duplicataTitulo} título já conhecido` : null,
                                d.duplicataUrl ? `${d.duplicataUrl} URL já vista antes` : null,
                                d.semLink ? `${d.semLink} sem link` : null,
                              ].filter(Boolean).join(' · ')}
                            </p>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </details>
              )}

              {igManagerOpen && (
                <div className="sentinel-source-details__body" style={{ marginTop: 16, paddingTop: 16, borderTop: '1px solid var(--border)' }}>
                  <p className="card-helper" style={{ marginTop: 0 }}>Contas que o Sentinel varre em busca de oportunidades. Sem nenhuma conta ativa, essa etapa é pulada inteira (não gasta nada).</p>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 14 }}>
                    {igAccounts.length === 0 && <p className="card-helper" style={{ margin: 0 }}>Nenhuma conta cadastrada ainda.</p>}
                    {igAccounts.map((conta) => (
                      <div key={conta.username} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                        <Checkbox checked={conta.active} onChange={() => alternarContaInstagram(conta)} disabled={!perms.canWrite || igBusy} />
                        <span style={{ flex: 1, fontSize: 14 }}>@{conta.username}</span>
                        {!conta.active && <Badge variant="neutral">Desativada</Badge>}
                        {perms.canWrite && (
                          <Button variant="ghost" size="icon" aria-label={`Remover @${conta.username}`} onClick={() => removerContaInstagram(conta)} disabled={igBusy} style={{ color: 'var(--vermelha)' }}>
                            {Ic('trash-2', 'ico-xs')}
                          </Button>
                        )}
                      </div>
                    ))}
                  </div>
                  {perms.canWrite && (
                    <form onSubmit={adicionarContaInstagram} style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                      <Input value={igNovoUsername} onChange={(event) => setIgNovoUsername(event.target.value)} placeholder="username (sem @)" disabled={igBusy} style={{ maxWidth: 240 }} />
                      <Button type="submit" variant="outline" iconLeft={Ic('plus', 'ico-xs')} disabled={!igNovoUsername.trim() || igBusy}>Adicionar conta</Button>
                    </form>
                  )}
                  {igError && <p style={{ color: 'var(--danger)', fontSize: 13, marginTop: 12 }}>{igError}</p>}
                </div>
              )}

            </CardBody>
          </Card>

          <Card><CardHeader><CardTitle style={{ fontSize: 16 }}>Pesquisar uma URL</CardTitle><p className="card-helper">Use a pesquisa manual para uma nova oportunidade que ainda não está no catálogo.</p></CardHeader><CardBody><form className="sentinel-manual" onSubmit={addManual}><Input type="url" value={manualUrl} onChange={(event) => setManualUrl(event.target.value)} placeholder="https://programa.org/inscricoes" disabled={!perms.canWrite || manualBusy} /><Button type="submit" variant="outline" iconLeft={Ic('search', 'ico-xs')} disabled={!manualUrl.trim() || !perms.canWrite || manualBusy}>Pesquisar URL</Button></form></CardBody></Card>          <Card flat>
            <CardHeader className="section-card-header">
              <div>
                <CardTitle style={{ fontSize: 16 }}>Resultados por fonte</CardTitle>
                <p className="card-helper">{logFilter === 'qualified' ? 'Só as oportunidades qualificadas aparecem por padrão. Veja todos os campos encontrados e escolha se vai aplicar ou rejeitar cada uma.' : 'Consulte o resultado, o motivo e as páginas usadas em cada análise.'}</p>
              </div>
              <Select value={logFilter} onChange={(event) => setLogFilter(event.target.value)} style={{ width: 180 }}>
                {Object.entries(SENTINEL_STATUS).map(([value, config]) => <option key={value} value={value}>{config.label}</option>)}
                <option value="all">Todos os status</option>
              </Select>
            </CardHeader>
            <CardBody style={{ paddingTop: 8 }}>
              {filteredPosts.length === 0 ? <div className="workflow-empty">Nenhum registro neste filtro.</div> : logFilter === 'qualified' ? (
                qualifiedNew.length === 0 ? <div className="workflow-empty">Nada esperando decisão agora — o que já foi decidido não fica acumulando aqui.</div> : (
                  <div className="research-proposals">
                    {qualifiedNew.map((post) => (
                      <QualifiedPostCard key={post.id} post={post} onApprove={aprovarPost} onReject={rejeitarPost} onDismiss={dismissarPost} busy={postActionBusy === post.id} canWrite={perms.canWrite} />
                    ))}
                  </div>
                )
              ) : (
                <div className="sentinel-log">{filteredPosts.map((post) => { const status = SENTINEL_STATUS[post.status] || SENTINEL_STATUS.pending; return <article className="sentinel-log-row" key={post.id}><div className="sentinel-score">{post.score}</div><div className="sentinel-log-main"><div className="sentinel-log-meta"><strong>{post.source_type === 'manual' ? 'Entrada manual' : post.source_type === 'web' ? (post.owner_username || 'Web') : `@${post.owner_username || 'instagram'}`}</strong><span>{formatDate(post.processed_at || post.created_at)}</span><Badge variant={status.variant} dot>{status.label}</Badge></div><p>{post.opportunity?.title || post.caption || post.source_url}</p>{post.error && <small className="sentinel-log-error">{post.error}</small>}<DiscoveryDetails post={post} /></div><a className="row-action" href={post.source_url} target="_blank" rel="noreferrer" aria-label="Abrir fonte">{Ic('external-link', 'ico-sm')}</a></article>; })}</div>
              )}
            </CardBody>
          </Card>
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
              // Cancelável de verdade (o loop em api/cron/scrape-sources.js
              // olha pra sentinel_research_runs.status entre um item e outro)
              // só pra web_research. Aparece pra QUALQUER execução travada em
              // "running"/"cancelling" — não só a que esta aba abriu — porque
              // é exatamente isso que substitui o antigo "Destravar
              // pendentes": em vez de um botão cego que soltava tudo que
              // estivesse preso há 10 minutos em qualquer execução, agora dá
              // pra ver qual execução específica ainda está rodando (mesmo
              // depois de fechar a aba ou a function ter estourado o tempo) e
              // cancelar só ela — o próprio cancelamento já devolve os itens
              // presos em "pending" daquela execução pra fila.
              const cancelavel = run.run_type === 'web_research' && (run.status === 'running' || run.status === 'cancelling');
              const inspected = String(inspectedRunId) === String(run.id);
              return (
                <article className="research-run-row" data-selected={inspected} key={run.id}>
                  <div className="research-run-mark">{Ic(run.run_type === 'catalog_review' ? 'refresh-cw' : run.run_type === 'manual' ? 'link' : run.run_type === 'enrichment' ? 'sparkles' : 'radar', 'ico-sm')}</div>
                  <div><strong>{RUN_TYPES[run.run_type]}</strong><small>{formatDate(run.started_at, true)} · <Usage run={run} /></small></div>
                  <div className="research-run-count"><strong>{run.processed_count}/{run.requested_count}</strong><span>{run.requested_count === 1 ? 'processada' : 'processadas'}</span></div>
                  {run.failed_count > 0 && <Badge variant="danger" dot>{countLabel(run.failed_count, 'falha', 'falhas')}</Badge>}
                  <Badge variant={status.variant} dot>{status.label}</Badge>
                  <div className="research-run-actions">
                    <Button variant={inspected ? 'primary' : 'outline'} size="sm" onClick={() => { setInspectedRunId(inspected ? null : run.id); if (!inspected) void hydrateRun(run.id); }}>{inspected ? 'Fechar log' : 'Ver log'}</Button>
                    {resumable && <Button variant="outline" size="sm" onClick={() => resume(run)} disabled={researching}>{remaining > 0 ? `Retomar (${remaining})` : 'Finalizar'}</Button>}
                    {cancelavel && <Button variant="outline" size="sm" onClick={() => cancelarPesquisa(run.id)} disabled={cancelandoRunId === run.id} iconLeft={Ic('x', 'ico-xs')}>{cancelandoRunId === run.id ? 'Cancelando…' : 'Cancelar'}</Button>}
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
