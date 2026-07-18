// Newsletter — compose from Sentinel's qualified opportunities & publish to Beehiiv.
// Falls back to the mock Instagram-post demo when the local server is offline.
(function () {
  const NS = window.AccessPlusDesignSystem_ece1f0;
  const { Card, CardHeader, CardTitle, CardBody, Badge, Button, Tabs, Table, Alert } = NS;
  const D = window.AP_DATA;
  const Ic = (n, cls) => window.Ic(n, cls);
  const API = window.SENTINEL_API || 'http://localhost:8787';

  function todayLabel() {
    const d = new Date();
    const meses = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'];
    return d.getDate() + ' ' + meses[d.getMonth()];
  }

  function Newsletter() {
    const [tab, setTab] = React.useState('compor');
    const [titulo, setTitulo] = React.useState('Oportunidades da semana · ' + todayLabel());
    // server state: undefined = loading, null = offline, [] = online
    const [opps, setOpps] = React.useState(undefined);
    const [sel, setSel] = React.useState([]);
    const [publishing, setPublishing] = React.useState(false);
    const [result, setResult] = React.useState(null); // { ok, message, html }

    React.useEffect(() => {
      fetch(API + '/api/opportunities')
        .then((r) => r.json())
        .then((d) => setOpps(d.opportunities || []))
        .catch(() => setOpps(null));
    }, []);

    const online = Array.isArray(opps);
    const toggle = (id) => setSel((s) => (s.indexOf(id) !== -1 ? s.filter((x) => x !== id) : s.concat(id)));
    const selected = online ? opps.filter((o) => sel.indexOf(o.id) !== -1) : [];

    const publish = (status) => {
      setPublishing(true); setResult(null);
      fetch(API + '/api/publish', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: titulo, ids: sel, status }),
      })
        .then((r) => r.json())
        .then((d) => setResult({
          ok: d.ok,
          message: d.ok
            ? (status === 'draft' ? 'Rascunho criado na Beehiiv com sucesso.' : 'Edição publicada na Beehiiv com sucesso.')
            : (d.error || 'Falha ao publicar.'),
          html: d.html || null,
        }))
        .catch(() => setResult({ ok: false, message: 'Servidor Sentinel offline.', html: null }))
        .finally(() => setPublishing(false));
    };

    const copyHtml = () => {
      if (result && result.html) navigator.clipboard.writeText(result.html);
    };

    const tabs = [{ value: 'compor', label: 'Compor' }, { value: 'anteriores', label: 'Edições anteriores' }];

    // ---- Past editions tab (mock data, unchanged) ----
    if (tab === 'anteriores') {
      const cols = [
        { key: 'titulo', header: 'Edição' }, { key: 'status', header: 'Status' },
        { key: 'data', header: 'Data' }, { key: 'destinatarios', header: 'Destinatários', align: 'right' },
        { key: 'aberturas', header: 'Aberturas', align: 'right' }, { key: 'itens', header: 'Itens', align: 'right' },
      ];
      return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
          <Tabs items={tabs} value={tab} onChange={setTab} />
          <Card flat>
            <Table columns={cols} data={D.newsletters} renderCell={(r, c) => {
              if (c.key === 'titulo') return <span style={{ fontWeight: 600 }}>{r.titulo}</span>;
              if (c.key === 'status') return <Badge variant={D.newsletterStatusVariant[r.status]} dot>{r.status}</Badge>;
              if (c.key === 'aberturas') return <span style={{ fontWeight: 600, color: r.aberturas !== '—' ? 'var(--success)' : 'var(--muted-foreground)' }}>{r.aberturas}</span>;
              return r[c.key];
            }} />
          </Card>
        </div>
      );
    }

    // ---- Compose tab ----
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
        <Tabs items={tabs} value={tab} onChange={setTab} />

        {opps === null && (
          <Alert variant="warning" title="Servidor Sentinel offline">
            Rode <code>cd AdminApp/sentinel && bun run server</code> para compor a newsletter com dados reais e publicar na Beehiiv.
          </Alert>
        )}

        <div style={{ display: 'grid', gridTemplateColumns: '1.15fr 1fr', gap: 22, alignItems: 'start' }}>
          {/* Left: pick opportunities */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 18, minWidth: 0 }}>
            <Card>
              <CardHeader style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingBottom: 8 }}>
                <CardTitle style={{ fontSize: 15, display: 'flex', gap: 8, alignItems: 'center' }}>
                  {Ic('radar', 'ico-sm')} Oportunidades qualificadas
                </CardTitle>
                {online && opps.length > 0 && (
                  <Button variant="outline" size="sm" iconLeft={Ic('sparkles', 'ico-xs')}
                    onClick={() => setSel(opps.map((o) => o.id))}>Selecionar tudo</Button>
                )}
              </CardHeader>
              <CardBody style={{ display: 'flex', flexDirection: 'column', gap: 10, paddingTop: 8 }}>
                {!online && (
                  <p style={{ color: 'var(--muted-foreground)', fontSize: 13, margin: 0 }}>
                    {opps === undefined ? 'Carregando…' : 'Sem conexão com o servidor — nada para mostrar.'}
                  </p>
                )}
                {online && opps.length === 0 && (
                  <p style={{ color: 'var(--muted-foreground)', fontSize: 13, margin: 0 }}>
                    Nenhuma oportunidade qualificada no log. Rode o pipeline na aba Sentinel.
                  </p>
                )}
                {online && opps.map((o) => {
                  const on = sel.indexOf(o.id) !== -1;
                  return (
                    <div key={o.id} onClick={() => toggle(o.id)}
                      style={{ display: 'flex', gap: 12, padding: 12, borderRadius: 'var(--radius-md)', cursor: 'pointer', border: '1px solid ' + (on ? 'var(--azul)' : 'var(--border)'), background: on ? 'var(--azul-soft)' : 'var(--card)' }}>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 7, marginBottom: 2, flexWrap: 'wrap' }}>
                          <span style={{ fontSize: 13, fontWeight: 700 }}>{o.name}</span>
                          <Badge variant="neutral">@{o.ownerUsername}</Badge>
                        </div>
                        <div style={{ fontSize: 12.5, color: 'var(--neutral-700)', lineHeight: 1.4 }}>{o.summary}</div>
                        <div style={{ fontSize: 11.5, color: 'var(--muted-foreground)', marginTop: 4 }}>
                          Prazo: {o.deadline} · {o.fees}
                        </div>
                      </div>
                      <span style={{ color: on ? 'var(--azul)' : 'var(--neutral-300)', flex: 'none' }}>{Ic(on ? 'check-circle-2' : 'circle', 'ico-sm')}</span>
                    </div>
                  );
                })}
              </CardBody>
            </Card>
          </div>

          {/* Right: preview + publish */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14, position: 'sticky', top: 84 }}>
            <Card style={{ overflow: 'hidden' }}>
              <div style={{ background: 'var(--ink)', padding: '18px 20px', display: 'flex', alignItems: 'center', gap: 10 }}>
                <img src="../../assets/icon-branco.png" alt="" style={{ width: 28, height: 28, borderRadius: '50%' }} />
                <span style={{ fontFamily: 'var(--font-display)', fontWeight: 800, fontSize: 16, color: '#fff' }}>Access<span style={{ color: 'var(--grifa-texto)' }}>+</span>Plus</span>
                <span style={{ marginLeft: 'auto', fontSize: 11, color: 'var(--sidebar-muted)', textTransform: 'uppercase', letterSpacing: '.1em' }}>Newsletter</span>
              </div>
              <CardBody style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                <input value={titulo} onChange={(e) => setTitulo(e.target.value)} className="ap-input"
                  style={{ fontFamily: 'var(--font-display)', fontWeight: 800, fontSize: 18, border: '1px dashed var(--border)' }} />
                <p style={{ fontSize: 13.5, color: 'var(--neutral-700)', margin: 0, lineHeight: 1.5 }}>
                  Oi! Separamos as melhores oportunidades da semana pra você que busca as próprias oportunidades. 👇
                </p>
                {selected.length === 0 && (
                  <div style={{ padding: 20, textAlign: 'center', color: 'var(--muted-foreground)', fontSize: 13, border: '1px dashed var(--border)', borderRadius: 'var(--radius-md)' }}>
                    Selecione oportunidades ao lado para montar a edição.
                  </div>
                )}
                {selected.map((o, i) => (
                  <div key={o.id} style={{ display: 'flex', gap: 12, paddingBottom: 14, borderBottom: i < selected.length - 1 ? '1px solid var(--neutral-100)' : 'none' }}>
                    <span style={{ width: 30, height: 30, flex: 'none', borderRadius: 8, background: 'var(--azul-soft)', color: 'var(--azul)', fontWeight: 800, fontFamily: 'var(--font-display)', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontSize: 13 }}>{i + 1}</span>
                    <div>
                      <div style={{ fontSize: 14, fontWeight: 700, fontFamily: 'var(--font-display)' }}>{o.name}</div>
                      <div style={{ fontSize: 12.5, color: 'var(--neutral-700)', marginTop: 2, lineHeight: 1.4 }}>{o.summary}</div>
                      <div style={{ fontSize: 11.5, color: 'var(--muted-foreground)', marginTop: 4 }}>Prazo: {o.deadline} · {o.fees}</div>
                      <a href={o.link} target="_blank" rel="noreferrer" style={{ fontSize: 12, color: 'var(--azul)', fontWeight: 600, display: 'inline-flex', alignItems: 'center', gap: 4, marginTop: 4 }}>Ver oportunidade {Ic('arrow-right', 'ico-xs')}</a>
                    </div>
                  </div>
                ))}
                <div style={{ fontSize: 11, color: 'var(--muted-foreground)', textAlign: 'center', paddingTop: 4 }}>
                  Access+Plus · você recebe porque se inscreveu · descadastrar
                </div>
              </CardBody>
            </Card>

            {result && (
              <Alert variant={result.ok ? 'success' : 'danger'} title={result.ok ? 'Sucesso' : 'Não foi possível publicar'}>
                {result.message}
                {!result.ok && result.html && (
                  <div style={{ marginTop: 8 }}>
                    <Button variant="outline" size="sm" iconLeft={Ic('copy', 'ico-xs')} onClick={copyHtml}>
                      Copiar HTML da edição
                    </Button>
                  </div>
                )}
              </Alert>
            )}

            <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
              <span style={{ fontSize: 12.5, color: 'var(--muted-foreground)', flex: 1 }}>{selected.length} itens</span>
              <Button variant="outline" size="sm" iconLeft={Ic('save', 'ico-xs')}
                disabled={!online || selected.length === 0 || publishing}
                onClick={() => publish('draft')}>Rascunho na Beehiiv</Button>
              <Button variant="primary" size="sm" iconLeft={Ic('send', 'ico-xs')}
                disabled={!online || selected.length === 0 || publishing}
                onClick={() => { if (window.confirm('Publicar esta edição AGORA para todos os inscritos?')) publish('confirmed'); }}>
                {publishing ? 'Enviando…' : 'Publicar'}
              </Button>
            </div>
          </div>
        </div>
      </div>
    );
  }
  window.Newsletter = Newsletter;
})();
