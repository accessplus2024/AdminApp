// Dashboard (Visão geral) — opportunities focused
(function () {
  const NS = window.AccessPlusDesignSystem_ece1f0;
  const { Card, CardHeader, CardTitle, CardBody, CardFooter, Stat, Table, Badge, Button } = NS;
  const D = window.AP_DATA;
  const Ic = (n, cls) => window.Ic(n, cls);

  function Dashboard({ onOpen, onNew }) {
    const recent = D.opportunities.slice(0, 5);
    const cols = [
      { key: 'titulo', header: 'Oportunidade' },
      { key: 'tipo', header: 'Tipo' },
      { key: 'inscritos', header: 'Inscritos', align: 'right' },
      { key: 'status', header: 'Status' },
    ];
    // distribution by tipo
    const byTipo = {};
    D.opportunities.forEach((o) => { byTipo[o.tipo] = (byTipo[o.tipo] || 0) + 1; });
    const dist = Object.keys(byTipo).map((k) => ({ k, v: byTipo[k] })).sort((a, b) => b.v - a.v).slice(0, 5);
    const maxV = Math.max.apply(null, dist.map((d) => d.v));
    const distColors = ['var(--azul)', 'var(--grifa-topicos)', 'var(--citacoes)', 'var(--grifa-texto)', 'var(--vermelha)'];

    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 22 }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16 }}>
          {D.stats.map((s, i) => (
            <Card key={i}><CardBody>
              <Stat label={s.label} value={s.value} icon={Ic(s.icon, 'ico-sm')} delta={s.delta} deltaDir={s.dir} />
            </CardBody></Card>
          ))}
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1.7fr 1fr', gap: 22, alignItems: 'start' }}>
          <Card flat>
            <CardHeader style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', paddingBottom: 12 }}>
              <CardTitle>Oportunidades recentes</CardTitle>
              <Button variant="link" iconRight={Ic('arrow-right', 'ico-sm')} onClick={onNew}>Nova</Button>
            </CardHeader>
            <Table columns={cols} data={recent} renderCell={(r, c) => {
              if (c.key === 'titulo') return (
                <button onClick={() => onOpen && onOpen(r)} className="link-cell">
                  <div style={{ fontWeight: 600 }}>{r.titulo}</div>
                  <div style={{ fontSize: 12, color: 'var(--muted-foreground)' }}>{r.org}</div>
                </button>
              );
              if (c.key === 'tipo') return <Badge variant={D.tipoVariant[r.tipo] || 'neutral'}>{r.tipo}</Badge>;
              if (c.key === 'status') return <Badge variant={D.statusVariant[r.status]} dot>{r.status}</Badge>;
              if (c.key === 'inscritos') return <span style={{ fontVariantNumeric: 'tabular-nums', fontWeight: 600 }}>{r.inscritos || '—'}</span>;
              return r[c.key];
            }} />
          </Card>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 22 }}>
            <Card>
              <CardHeader><CardTitle>Por tipo</CardTitle></CardHeader>
              <CardBody style={{ display: 'flex', flexDirection: 'column', gap: 12, paddingTop: 10 }}>
                {dist.map((d, i) => (
                  <div key={d.k}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12.5, marginBottom: 5 }}>
                      <span style={{ color: 'var(--ink)' }}>{d.k}</span>
                      <span style={{ color: 'var(--muted-foreground)', fontWeight: 600 }}>{d.v}</span>
                    </div>
                    <div style={{ height: 7, borderRadius: 99, background: 'var(--neutral-100)' }}>
                      <div style={{ height: '100%', borderRadius: 99, width: (d.v / maxV * 100) + '%', background: distColors[i % distColors.length] }} />
                    </div>
                  </div>
                ))}
              </CardBody>
            </Card>

            <Card>
              <CardHeader><CardTitle>Atividade</CardTitle></CardHeader>
              <CardBody style={{ display: 'flex', flexDirection: 'column', gap: 14, paddingTop: 8 }}>
                {D.activity.map((a, i) => (
                  <div key={i} style={{ display: 'flex', gap: 12, alignItems: 'flex-start' }}>
                    <span style={{ width: 28, height: 28, flex: 'none', borderRadius: 8, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', background: 'color-mix(in srgb, ' + a.color + ' 14%, white)', color: a.color }}>
                      {Ic(a.icon, 'ico-sm')}
                    </span>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: 13, lineHeight: 1.35 }} dangerouslySetInnerHTML={{ __html: a.text }} />
                      <div style={{ fontSize: 11.5, color: 'var(--muted-foreground)', marginTop: 1 }}>{a.time}</div>
                    </div>
                  </div>
                ))}
              </CardBody>
            </Card>
          </div>
        </div>
      </div>
    );
  }
  window.Dashboard = Dashboard;
})();
