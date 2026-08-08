import { useEffect, useMemo, useState } from 'react';
import { Badge, Button, Card, CardBody, CardHeader, CardTitle, Input, OpportunityFilters, Select, Tabs, Textarea, useOpportunityFilters } from '../components';
import { Ic } from '../lib/icons';
import { buildNewsletterHtml, slugify } from '../lib/newsletterHtml';
import {
  DEFAULT_ISSUE,
  deleteNewsletterIssue,
  fetchLastFeaturedDates,
  fetchNewsletterIssues,
  markNewsletterPublished,
  opportunityToNewsletterEntry,
  saveNewsletterIssue,
} from '../lib/newsletters';

const ISSUE_STATUS = {
  draft: { label: 'Rascunho', variant: 'neutral' },
  ready: { label: 'Pronta', variant: 'primary' },
  published: { label: 'Enviada', variant: 'success' },
};

const formatDate = (value, withTime = false) => value
  ? new Intl.DateTimeFormat('pt-BR', withTime
    ? { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }
    : { day: '2-digit', month: 'short', year: 'numeric' }).format(new Date(value))
  : '—';

function blankIssue() {
  const now = new Date();
  return {
    ...DEFAULT_ISSUE,
    title: `Weekly Drop · ${new Intl.DateTimeFormat('pt-BR', { day: '2-digit', month: 'short' }).format(now)}`,
    campaign_slug: `weekly-drop-${now.toISOString().slice(0, 10)}`,
  };
}

function Field({ label, hint, children }) {
  return (
    <label className="newsletter-field">
      <span>{label}</span>
      {children}
      {hint && <small>{hint}</small>}
    </label>
  );
}

function EntryEditor({ entry, index, total, onChange, onMove, onRemove }) {
  const patch = (key, value) => onChange(index, { ...entry, [key]: value });
  return (
    <details className="newsletter-entry-editor">
      <summary>
        <span className="publication-number">{String(index + 1).padStart(2, '0')}</span>
        <span className="publication-title">{entry.title || 'Sem título'}</span>
        <span className="publication-actions" onClick={(event) => event.preventDefault()}>
          <button type="button" onClick={() => onMove(index, -1)} disabled={index === 0} aria-label="Mover para cima">{Ic('arrow-up', 'ico-xs')}</button>
          <button type="button" onClick={() => onMove(index, 1)} disabled={index === total - 1} aria-label="Mover para baixo">{Ic('arrow-down', 'ico-xs')}</button>
          <button type="button" onClick={() => onRemove(index)} aria-label="Remover">{Ic('x', 'ico-xs')}</button>
        </span>
      </summary>
      <div className="newsletter-entry-fields">
        <Field label="Título"><Input value={entry.title} onChange={(event) => patch('title', event.target.value)} /></Field>
        <Field label="Resumo"><Textarea value={entry.summary} onChange={(event) => patch('summary', event.target.value)} rows={4} /></Field>
        <Field label="Elegibilidade" hint="Escreva um item curto por linha."><Textarea value={entry.eligibility} onChange={(event) => patch('eligibility', event.target.value)} rows={3} /></Field>
        <div className="newsletter-two-fields">
          <Field label="Prazo"><Input value={entry.deadline} onChange={(event) => patch('deadline', event.target.value)} /></Field>
          <Field label="Taxas"><Input value={entry.fees} onChange={(event) => patch('fees', event.target.value)} /></Field>
        </div>
        <Field label="Link"><Input type="url" value={entry.link} onChange={(event) => patch('link', event.target.value)} /></Field>
      </div>
    </details>
  );
}

export default function Newsletter({ opportunities, perms }) {
  const [tab, setTab] = useState('editor');
  const [issues, setIssues] = useState([]);
  const [issue, setIssue] = useState(blankIssue);
  const [entries, setEntries] = useState([]);
  const [featured, setFeatured] = useState({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [notice, setNotice] = useState(null);

  const refresh = async (preferredId) => {
    try {
      const [nextIssues, nextFeatured] = await Promise.all([fetchNewsletterIssues(), fetchLastFeaturedDates()]);
      setIssues(nextIssues);
      setFeatured(nextFeatured);
      const selected = nextIssues.find((item) => item.id === preferredId)
        || nextIssues.find((item) => item.status !== 'published');
      if (selected && !preferredId && !issue.id) {
        setIssue(selected);
        setEntries(selected.entries || []);
      }
    } catch (error) { setNotice({ type: 'error', text: error.message }); }
    finally { setLoading(false); }
  };
  useEffect(() => { refresh(); }, []);

  const publishedOpportunities = useMemo(() => (opportunities || []).filter((opportunity) => opportunity.status === 'Publicada' && opportunity.qualificacao !== 'unqualified'), [opportunities]);
  const opportunityFilter = useOpportunityFilters(publishedOpportunities);
  const selectedIds = useMemo(() => new Set(entries.map((entry) => String(entry.opportunity_id))), [entries]);
  const available = useMemo(() => opportunityFilter.rows
    .filter((opportunity) => !selectedIds.has(String(opportunity._raw?.id || opportunity.id)))
    .slice(0, 60), [opportunityFilter.rows, selectedIds]);

  const html = useMemo(() => buildNewsletterHtml(issue, entries), [issue, entries]);
  const patchIssue = (key, value) => setIssue((current) => ({
    ...current,
    [key]: value,
    ...(key === 'title' && (!current.campaign_slug || current.campaign_slug === slugify(current.title)) ? { campaign_slug: slugify(value) } : {}),
  }));

  const selectIssue = (id) => {
    const selected = issues.find((item) => String(item.id) === String(id));
    if (!selected) return;
    setIssue({ ...selected });
    setEntries((selected.entries || []).map((entry) => ({ ...entry })));
    setNotice(null);
    setTab('editor');
  };
  const startNew = () => { setIssue(blankIssue()); setEntries([]); setNotice(null); setTab('editor'); };
  const addOpportunity = (opportunity) => setEntries((current) => current.concat(opportunityToNewsletterEntry(opportunity, current.length)));
  const updateEntry = (index, value) => setEntries((current) => current.map((entry, entryIndex) => entryIndex === index ? value : entry));
  const removeEntry = (index) => setEntries((current) => current.filter((_, entryIndex) => entryIndex !== index));
  const moveEntry = (index, direction) => setEntries((current) => {
    const target = index + direction;
    if (target < 0 || target >= current.length) return current;
    const next = [...current];
    [next[index], next[target]] = [next[target], next[index]];
    return next;
  });

  const save = async (status = issue.status) => {
    if (!issue.title.trim()) return setNotice({ type: 'error', text: 'Dê um nome à edição antes de salvar.' });
    setSaving(true); setNotice(null);
    try {
      const saved = await saveNewsletterIssue({ ...issue, status }, entries);
      setIssue(saved); setEntries(saved.entries);
      setNotice({ type: 'success', text: status === 'ready' ? 'Edição pronta para envio.' : 'Rascunho salvo.' });
      await refresh(saved.id);
    } catch (error) { setNotice({ type: 'error', text: error.message }); }
    finally { setSaving(false); }
  };

  const copyHtml = async () => {
    try {
      await navigator.clipboard.writeText(html);
      setNotice({ type: 'success', text: 'HTML copiado. Cole em um bloco HTML do Beehiiv.' });
    } catch { setNotice({ type: 'error', text: 'O navegador bloqueou a área de transferência. Selecione o HTML abaixo e copie manualmente.' }); }
  };

  const markPublished = async () => {
    setSaving(true);
    try {
      const current = issue.id ? issue : await saveNewsletterIssue({ ...issue, status: 'ready' }, entries);
      const saved = await markNewsletterPublished(current, entries);
      setIssue(saved); setEntries(saved.entries);
      setNotice({ type: 'success', text: 'Edição marcada como enviada. O histórico das oportunidades foi atualizado.' });
      await refresh(saved.id);
    } catch (error) { setNotice({ type: 'error', text: error.message }); }
    finally { setSaving(false); }
  };

  const removeIssue = async (item) => {
    if (!window.confirm(`Excluir a edição “${item.title}”?`)) return;
    try {
      await deleteNewsletterIssue(item.id);
      setIssues((current) => current.filter((candidate) => candidate.id !== item.id));
      if (issue.id === item.id) startNew();
    } catch (error) { setNotice({ type: 'error', text: error.message }); }
  };

  const tabs = [{ value: 'editor', label: 'Montar edição' }, { value: 'history', label: `Edições (${issues.length})` }];

  if (loading) return <div className="workflow-empty">Carregando a mesa editorial…</div>;
  if (tab === 'history') {
    return (
      <div className="newsletter-page">
        <div className="newsletter-toolbar"><Tabs items={tabs} value={tab} onChange={setTab} /><Button variant="primary" iconLeft={Ic('plus', 'ico-xs')} onClick={startNew} disabled={!perms.canWrite}>Nova edição</Button></div>
        {notice && <div className={`workflow-notice workflow-notice--${notice.type}`}>{notice.text}</div>}
        <Card flat>
          <CardHeader><CardTitle style={{ fontSize: 16 }}>Edições salvas</CardTitle></CardHeader>
          <CardBody className="issue-history">
            {issues.length === 0 ? <div className="workflow-empty">Nenhuma edição salva. Comece a primeira Weekly Drop.</div> : issues.map((item) => {
              const status = ISSUE_STATUS[item.status] || ISSUE_STATUS.draft;
              return (
                <article className="issue-history-row" key={item.id}>
                  <button type="button" className="issue-history-main" onClick={() => selectIssue(item.id)}>
                    <span className="issue-history-date">{formatDate(item.published_at || item.created_at)}</span>
                    <span><strong>{item.title}</strong><small>{item.entries?.length || 0} oportunidades · atualizado {formatDate(item.updated_at, true)}</small></span>
                    <Badge variant={status.variant} dot>{status.label}</Badge>
                  </button>
                  {perms.canWrite && <button type="button" className="row-action" onClick={() => removeIssue(item)} aria-label="Excluir edição">{Ic('trash-2', 'ico-sm')}</button>}
                </article>
              );
            })}
          </CardBody>
        </Card>
      </div>
    );
  }

  return (
    <div className="newsletter-page">
      <div className="newsletter-toolbar">
        <Tabs items={tabs} value={tab} onChange={setTab} />
        <div className="newsletter-toolbar-actions">
          {issues.length > 0 && <Select value={issue.id || ''} onChange={(event) => event.target.value ? selectIssue(event.target.value) : startNew()} style={{ minWidth: 210 }}><option value="">Nova edição</option>{issues.map((item) => <option key={item.id} value={item.id}>{item.title}</option>)}</Select>}
          <Button variant="outline" iconLeft={Ic('save', 'ico-xs')} onClick={() => save('draft')} disabled={!perms.canWrite || saving}>{saving ? 'Salvando…' : 'Salvar rascunho'}</Button>
          <Button variant="primary" iconLeft={Ic('copy', 'ico-xs')} onClick={copyHtml} disabled={entries.length === 0}>Copiar HTML</Button>
        </div>
      </div>
      {notice && <div className={`workflow-notice workflow-notice--${notice.type}`}>{notice.text}</div>}

      <section className="newsletter-masthead">
        <span>EDIÇÃO EM MONTAGEM</span>
        <input value={issue.title} onChange={(event) => patchIssue('title', event.target.value)} aria-label="Nome da edição" />
        <div><Badge variant={(ISSUE_STATUS[issue.status] || ISSUE_STATUS.draft).variant} dot>{(ISSUE_STATUS[issue.status] || ISSUE_STATUS.draft).label}</Badge><small>{entries.length} oportunidades selecionadas</small></div>
      </section>

      <div className="newsletter-workspace">
        <div className="newsletter-compose">
          <Card>
            <CardHeader><CardTitle style={{ fontSize: 16 }}>Detalhes do e-mail</CardTitle><p className="card-helper">Prepare o assunto e o texto de prévia usados no Beehiiv.</p></CardHeader>
            <CardBody className="newsletter-metadata">
              <Field label="Assunto"><Input value={issue.subject} placeholder={issue.title} onChange={(event) => patchIssue('subject', event.target.value)} /></Field>
              <Field label="Texto de prévia"><Input value={issue.preheader} placeholder="Resuma a edição para a caixa de entrada" onChange={(event) => patchIssue('preheader', event.target.value)} /></Field>
              <Field label="Abertura"><Textarea rows={3} value={issue.intro} onChange={(event) => patchIssue('intro', event.target.value)} /></Field>
              <div className="newsletter-two-fields">
                <Field label="Campanha UTM" hint="Adicionada aos links automaticamente."><Input value={issue.campaign_slug} onChange={(event) => patchIssue('campaign_slug', event.target.value)} /></Field>
                <Field label="URL no Beehiiv" hint="Opcional, depois que o post existir."><Input type="url" value={issue.beehiiv_url || ''} onChange={(event) => patchIssue('beehiiv_url', event.target.value)} /></Field>
              </div>
            </CardBody>
          </Card>

          <Card className="publication-card">
            <CardHeader><div className="publication-card-heading"><div><CardTitle style={{ fontSize: 16 }}>Ordem de publicação</CardTitle><p className="card-helper">Abra um item para ajustar o texto desta edição sem alterar o catálogo.</p></div><span className="publication-rule" /></div></CardHeader>
            <CardBody className="publication-strip">
              {entries.length === 0 ? <div className="workflow-empty">Escolha oportunidades no catálogo ao lado para começar.</div> : entries.map((entry, index) => <EntryEditor key={`${entry.opportunity_id || 'snapshot'}-${index}`} entry={entry} index={index} total={entries.length} onChange={updateEntry} onMove={moveEntry} onRemove={removeEntry} />)}
            </CardBody>
          </Card>

          <Card>
            <CardHeader><CardTitle style={{ fontSize: 16 }}>Prévia e HTML</CardTitle><p className="card-helper">A prévia mostra o mesmo conteúdo que você copiará para o Beehiiv.</p></CardHeader>
            <CardBody>
              <iframe title="Prévia da newsletter" className="newsletter-preview" sandbox="" srcDoc={`<!doctype html><html><body style="margin:0;background:#fff;">${html}</body></html>`} />
              <details className="newsletter-code"><summary>Ver HTML gerado</summary><Textarea readOnly value={html} rows={12} /></details>
            </CardBody>
          </Card>
        </div>

        <aside className="opportunity-palette">
          <Card>
            <CardHeader><CardTitle style={{ fontSize: 16 }}>Catálogo aprovado</CardTitle><p className="card-helper">Só oportunidades publicadas aparecem aqui. Adicionar não muda sua exibição no site.</p></CardHeader>
            <CardBody>
              <OpportunityFilters controller={opportunityFilter} total={publishedOpportunities.length} compact placeholder="Buscar no catálogo aprovado…" />
              <div className="opportunity-palette-list">
                {available.length === 0 ? <div className="workflow-empty">Nenhuma oportunidade disponível para este filtro.</div> : available.map((opportunity) => {
                  const id = opportunity._raw?.id || opportunity.id;
                  const last = featured[id];
                  return (
                    <article key={id} className="opportunity-palette-row">
                      <div><strong>{opportunity.titulo}</strong><span>{opportunity.prazo || 'Prazo não informado'} · {opportunity.custo || 'Custo não informado'}</span>{last && <small>Última newsletter: {formatDate(last.date)}</small>}</div>
                      <Button variant="ghost" size="icon" onClick={() => addOpportunity(opportunity)} disabled={!perms.canWrite} aria-label={`Adicionar ${opportunity.titulo}`}>{Ic('plus', 'ico-sm')}</Button>
                    </article>
                  );
                })}
              </div>
            </CardBody>
          </Card>
          <Card className="newsletter-finish-card">
            <CardBody>
              <span>FECHAMENTO</span>
              <h3>Concluir edição</h3>
              <p>Copie o HTML, crie o post no Beehiiv e registre o envio.</p>
              <Button variant="outline" onClick={() => save('ready')} disabled={!perms.canWrite || saving || entries.length === 0}>Marcar como pronta</Button>
              <Button variant="primary" iconLeft={Ic('check-circle-2', 'ico-xs')} onClick={markPublished} disabled={!perms.canWrite || saving || entries.length === 0 || issue.status === 'published'}>{issue.status === 'published' ? 'Envio registrado' : 'Marcar como enviada'}</Button>
            </CardBody>
          </Card>
        </aside>
      </div>
    </div>
  );
}
