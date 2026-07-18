// Sentinel — run the opportunity-finder pipeline from the admin panel.
// Talks to the local server (sentinel/server.ts) at window.SENTINEL_API.
(function () {
  const NS = window.AccessPlusDesignSystem_ece1f0;
  const { Card, CardHeader, CardTitle, CardBody, Badge, Button, Table, Alert } = NS;
  const Ic = (n, cls) => window.Ic(n, cls);
  const API = window.SENTINEL_API || 'http://localhost:8787';

  function KeyBadge({ ok, label }) {
    return <Badge variant={ok ? 'success' : 'danger'} dot>{label}</Badge>;
  }

  function Sentinel() {
    const [status, setStatus] = React.useState(null);   // /api/status payload; null = loading; false = offline
    const [logs, setLogs] = React.useState('');
    const [opps, setOpps] = React.useState([]);
    const [starting, setStarting] = React.useState(false);
    const [error, setError] = React.useState(null);
    const logRef = React.useRef(null);
    const wasRunning = React.useRef(false);

    const fetchOpps = React.useCallback(() => {
      fetch(API + '/api/opportunities')
        .then((r) => r.json())
        .then((d) => setOpps(d.opportunities || []))
        .catch(() => {});
    }, []);

    // Poll status + logs every 2.5s.
    React.useEffect(() => {
      let alive = true;
      const tick = () => {
        fetch(API + '/api/status')
          .then((r) => r.json())
          .then((s) => {
            if (!alive) return;
            setStatus(s);
            // refresh results when a run finishes
            if (wasRunning.current && !s.running) fetchOpps();
            wasRunning.current = s.running;
            if (s.running || wasRunning.current || s.exitCode !== null) {
              return fetch(API + '/api/run/logs').then((r) => r.json()).then((l) => alive && setLogs(l.logs || ''));
            }
          })
          .catch(() => alive && setStatus(false));
      };
      tick();
      fetchOpps();
      const id = setInterval(tick, 2500);
      return () => { alive = false; clearInterval(id); };
    }, [fetchOpps]);

    // Auto-scroll the log box.
    React.useEffect(() => {
      if (logRef.current) logRef.current.scrollTop = logRef.current.scrollHeight;
    }, [logs]);

    const runNow = () => {
      setStarting(true); setError(null);
      fetch(API + '/api/run', { method: 'POST' })
        .then((r) => r.json().then((d) => ({ ok: r.ok, d })))
        .then(({ ok, d }) => { if (!ok) setError(d.error || 'Falha ao iniciar.'); })
        .catch(() => setError('Servidor Sentinel offline.'))
        .finally(() => setStarting(false));
    };

    if (status === false) {
      return (
        <Card flat style={{ display: 'grid', placeItems: 'center', minHeight: 360 }}>
          <div style={{ textAlign: 'center', maxWidth: 480 }}>
            <h2 style={{ fontFamily: 'var(--font-display)', fontWeight: 800, fontSize: 20 }}>Servidor Sentinel offline</h2>
            <p style={{ color: 'var(--muted-foreground)', fontSize: 14, marginTop: 8, lineHeight: 1.6 }}>
              No terminal, rode:<br />
              <code style={{ background: 'var(--neutral-100)', padding: '2px 8px', borderRadius: 6 }}>cd AdminApp/sentinel && bun run server</code><br />
              e recarregue esta página.
            </p>
          </div>
        </Card>
      );
    }

    const running = status && status.running;
    const cols = [
      { key: 'name', header: 'Oportunidade' },
      { key: 'deadline', header: 'Prazo' },
      { key: 'fees', header: 'Custo' },
      { key: 'link', header: 'Link' },
    ];

    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
        {/* Status + Run */}
        <Card>
          <CardHeader style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingBottom: 8 }}>
            <CardTitle style={{ fontSize: 15, display: 'flex', gap: 8, alignItems: 'center' }}>{Ic('radar', 'ico-sm')} Pipeline Sentinel</CardTitle>
            <Button variant="primary" size="sm" iconLeft={Ic(running ? 'loader' : 'play', 'ico-xs')}
              onClick={runNow} disabled={running || starting || !status}>
              {running ? 'Rodando…' : 'Rodar agora'}
            </Button>
          </CardHeader>
          <CardBody style={{ paddingTop: 8, display: 'flex', flexDirection: 'column', gap: 12 }}>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              {status && <KeyBadge ok={status.keys.apify} label="Apify" />}
              {status && <KeyBadge ok={status.keys.nvidia} label="NVIDIA" />}
              {status && <KeyBadge ok={status.keys.beehiiv} label="Beehiiv" />}
              {status && <KeyBadge ok={status.keys.beehiivPublication} label="Publication ID" />}
              {status && status.exitCode !== null && !running && (
                <Badge variant={status.exitCode === 0 ? 'success' : 'danger'}>
                  Última execução: {status.exitCode === 0 ? 'ok' : 'erro'}
                </Badge>
              )}
            </div>
            {error && <Alert variant="danger" title="Erro">{error}</Alert>}
            {(running || logs) && (
              <pre ref={logRef} style={{
                margin: 0, background: 'var(--ink)', color: '#CFF665', borderRadius: 'var(--radius-md)',
                padding: 14, fontSize: 12, lineHeight: 1.5, maxHeight: 280, overflow: 'auto', whiteSpace: 'pre-wrap',
              }}>{logs || 'Aguardando saída…'}</pre>
            )}
          </CardBody>
        </Card>

        {/* Results */}
        <Card flat>
          <CardHeader style={{ paddingBottom: 8 }}>
            <CardTitle style={{ fontSize: 15 }}>Oportunidades qualificadas ({opps.length})</CardTitle>
          </CardHeader>
          {opps.length === 0 ? (
            <CardBody><p style={{ color: 'var(--muted-foreground)', fontSize: 13, margin: 0 }}>
              Nenhuma oportunidade qualificada ainda. Rode o pipeline acima.
            </p></CardBody>
          ) : (
            <Table columns={cols} data={opps} renderCell={(r, c) => {
              if (c.key === 'name') return <span style={{ fontWeight: 600 }}>{r.name}</span>;
              if (c.key === 'link') return <a href={r.link} target="_blank" rel="noreferrer" style={{ color: 'var(--azul)', fontWeight: 600 }}>abrir ↗</a>;
              return r[c.key];
            }} />
          )}
        </Card>
      </div>
    );
  }
  window.Sentinel = Sentinel;
})();
