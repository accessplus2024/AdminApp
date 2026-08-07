import { useEffect, useMemo, useState } from 'react';
import { Badge, Button, Card, CardBody, CardHeader, CardTitle, Input, Select, Stat } from '../components';
import { Ic } from '../lib/icons';
import { addManualOpportunity, fetchSentinelPosts, runSentinel, SENTINEL_STATUS } from '../lib/sentinel';

const formatDate = (value) => value
  ? new Intl.DateTimeFormat('pt-BR', { day: '2-digit', month: 'short', year: 'numeric' }).format(new Date(value))
  : '—';

export default function Sentinel({ perms }) {
  const [posts, setPosts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [running, setRunning] = useState(false);
  const [manualUrl, setManualUrl] = useState('');
  const [filter, setFilter] = useState('all');
  const [notice, setNotice] = useState(null);

  const load = async () => {
    try { setPosts(await fetchSentinelPosts()); }
    catch (error) { setNotice({ type: 'error', text: error.message }); }
    finally { setLoading(false); }
  };
  useEffect(() => { load(); }, []);

  const execute = async () => {
    setRunning(true); setNotice(null);
    try {
      const result = await runSentinel(10);
      setNotice({ type: 'success', text: `${result.newPosts} posts novos · ${result.candidates} analisados · ${result.created} oportunidades enviadas para revisão.` });
      await load();
    } catch (error) { setNotice({ type: 'error', text: error.message }); }
    finally { setRunning(false); }
  };

  const addManual = async (event) => {
    event.preventDefault();
    if (!manualUrl.trim()) return;
    setRunning(true); setNotice(null);
    try {
      const result = await addManualOpportunity(manualUrl.trim());
      setManualUrl('');
      setNotice({ type: result.status === 'qualified' ? 'success' : 'error', text: result.status === 'qualified' ? 'Oportunidade pesquisada e enviada para revisão.' : 'A URL foi pesquisada, mas não gerou uma oportunidade qualificada.' });
      await load();
    } catch (error) { setNotice({ type: 'error', text: error.message }); }
    finally { setRunning(false); }
  };

  const filtered = useMemo(() => filter === 'all' ? posts : posts.filter((post) => post.status === filter), [posts, filter]);
  const qualified = posts.filter((post) => post.status === 'qualified').length;
  const pending = posts.filter((post) => post.status === 'pending').length;
  const failed = posts.filter((post) => post.status === 'failed').length;

  return (
    <div className="sentinel-page">
      <section className="sentinel-hero">
        <div>
          <span className="sentinel-eyebrow">RADAR DE OPORTUNIDADES</span>
          <h2>Do sinal à revisão, sem planilha no caminho.</h2>
          <p>O Sentinel monitora as fontes, elimina ruído e cria rascunhos no catálogo. Nada vai ao ar sem aprovação.</p>
        </div>
        <Button variant="primary" iconLeft={Ic(running ? 'loader-circle' : 'radar', 'ico-sm')} onClick={execute} disabled={!perms.canWrite || running}>
          {running ? 'Analisando…' : 'Buscar agora'}
        </Button>
      </section>

      {notice && <div className={`workflow-notice workflow-notice--${notice.type}`}>{notice.text}</div>}

      <div className="sentinel-stats">
        <Card><CardBody><Stat label="Posts no log" value={posts.length} icon={Ic('archive', 'ico-sm')} /></CardBody></Card>
        <Card><CardBody><Stat label="Qualificadas" value={qualified} icon={Ic('badge-check', 'ico-sm')} /></CardBody></Card>
        <Card><CardBody><Stat label="Processando" value={pending} icon={Ic('clock-3', 'ico-sm')} /></CardBody></Card>
        <Card><CardBody><Stat label="Falhas" value={failed} icon={Ic('triangle-alert', 'ico-sm')} /></CardBody></Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle style={{ fontSize: 16 }}>Pesquisar uma oportunidade</CardTitle>
          <p className="card-helper">Cole uma URL para usar a pesquisa e extração do Sentinel sem esperar a próxima varredura.</p>
        </CardHeader>
        <CardBody>
          <form className="sentinel-manual" onSubmit={addManual}>
            <Input type="url" value={manualUrl} onChange={(event) => setManualUrl(event.target.value)} placeholder="https://programa.org/inscricoes" disabled={!perms.canWrite || running} />
            <Button type="submit" variant="outline" iconLeft={Ic('search', 'ico-xs')} disabled={!manualUrl.trim() || !perms.canWrite || running}>Pesquisar URL</Button>
          </form>
        </CardBody>
      </Card>

      <Card flat>
        <CardHeader className="section-card-header">
          <div>
            <CardTitle style={{ fontSize: 16 }}>Log de processamento</CardTitle>
            <p className="card-helper">Este histórico substitui o arquivo <code>data/log.json</code>.</p>
          </div>
          <Select value={filter} onChange={(event) => setFilter(event.target.value)} style={{ width: 180 }}>
            <option value="all">Todos os status</option>
            {Object.entries(SENTINEL_STATUS).map(([value, config]) => <option key={value} value={value}>{config.label}</option>)}
          </Select>
        </CardHeader>
        <CardBody style={{ paddingTop: 8 }}>
          {loading ? <div className="workflow-empty">Carregando o radar…</div> : filtered.length === 0 ? (
            <div className="workflow-empty">Nenhum registro neste filtro. Execute uma busca para alimentar o radar.</div>
          ) : (
            <div className="sentinel-log">
              {filtered.map((post) => {
                const status = SENTINEL_STATUS[post.status] || SENTINEL_STATUS.pending;
                return (
                  <article className="sentinel-log-row" key={post.id}>
                    <div className="sentinel-score" title="Pontuação do seletor">{post.score}</div>
                    <div className="sentinel-log-main">
                      <div className="sentinel-log-meta">
                        <strong>{post.source_type === 'manual' ? 'Entrada manual' : `@${post.owner_username || 'instagram'}`}</strong>
                        <span>{formatDate(post.processed_at || post.created_at)}</span>
                        <Badge variant={status.variant} dot>{status.label}</Badge>
                      </div>
                      <p>{post.opportunity?.title || post.error || post.caption || post.source_url}</p>
                    </div>
                    <a className="row-action" href={post.source_url} target="_blank" rel="noreferrer" aria-label="Abrir fonte">{Ic('external-link', 'ico-sm')}</a>
                  </article>
                );
              })}
            </div>
          )}
        </CardBody>
      </Card>
    </div>
  );
}
