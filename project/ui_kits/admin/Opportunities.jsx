// Opportunities (Oportunidades) — list + horizontal dropdown filters
(function () {
  const NS = window.AccessPlusDesignSystem_ece1f0;
  const { Card, Badge, Button, Input, Select, Checkbox } = NS;
  const D = window.AP_DATA;
  const Ic = (n, cls) => window.Ic(n, cls);

  const emptySel = () => ({ tipo: [], nivel: [], publico: [], custo: [], interesse: [], inscricoes: null });

  // ---- Single horizontal filter dropdown ----
  function FilterDropdown({ f, sel, onToggle, onRadio, openKey, setOpenKey }) {
    const open = openKey === f.key;
    const ref = React.useRef(null);
    React.useEffect(() => {
      if (!open) return;
      const onDoc = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpenKey(null); };
      document.addEventListener('mousedown', onDoc);
      return () => document.removeEventListener('mousedown', onDoc);
    }, [open]);

    const count = f.type === 'radio' ? (sel.inscricoes ? 1 : 0) : sel[f.key].length;
    const active = count > 0;

    return (
      <div ref={ref} style={{ position: 'relative' }}>
        <button onClick={() => setOpenKey(open ? null : f.key)}
          style={{
            display: 'inline-flex', alignItems: 'center', gap: 7, cursor: 'pointer',
            padding: '8px 12px', borderRadius: 'var(--radius-md)',
            fontFamily: 'var(--font-body)', fontSize: 13.5, fontWeight: 600,
            border: '1px solid ' + (active || open ? 'var(--azul)' : 'var(--border)'),
            background: active ? 'var(--azul-soft)' : 'var(--card)',
            color: active ? 'var(--azul)' : 'var(--ink)', whiteSpace: 'nowrap',
            transition: 'border-color .12s ease, background-color .12s ease',
          }}>
          {f.label}
          {active && (
            <span style={{
              minWidth: 18, height: 18, padding: '0 5px', borderRadius: 9, fontSize: 11, fontWeight: 700,
              background: 'var(--azul)', color: '#fff', display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
            }}>{count}</span>
          )}
          <span style={{ display: 'inline-flex', transform: open ? 'rotate(180deg)' : 'none', transition: 'transform .14s ease' }}>{Ic('chevron-down', 'ico-xs')}</span>
        </button>

        {open && (
          <div style={{
            position: 'absolute', top: 'calc(100% + 6px)', left: 0, zIndex: 30,
            minWidth: 224, maxHeight: 320, overflowY: 'auto',
            background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 'var(--radius-md)',
            boxShadow: 'var(--shadow-lg, 0 12px 28px rgba(14,0,51,0.16))', padding: '12px 14px',
          }}>
            {f.type === 'radio' ? (
              <div style={{ display: 'flex', gap: 8 }}>
                {f.options.map((o) => {
                  const on = sel.inscricoes === o;
                  return (
                    <button key={o} onClick={() => onRadio(f.key, on ? null : o)}
                      style={{
                        flex: 1, padding: '7px 0', borderRadius: 'var(--radius-sm)', cursor: 'pointer',
                        fontFamily: 'var(--font-body)', fontSize: 13, fontWeight: 600,
                        border: '1px solid ' + (on ? 'var(--azul)' : 'var(--border)'),
                        background: on ? 'var(--azul-soft)' : 'var(--card)', color: on ? 'var(--azul)' : 'var(--ink)',
                      }}>{o}</button>
                  );
                })}
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {f.options.map((o) => (
                  <Checkbox key={o} label={<span style={{ fontSize: 13.5 }}>{o}</span>}
                    checked={sel[f.key].indexOf(o) !== -1} onChange={() => onToggle(f.key, o)} />
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    );
  }

  function Opportunities({ onOpen, onNew, onEdit }) {
    const [q, setQ] = React.useState('');
    const [sel, setSel] = React.useState(emptySel);
    const [openKey, setOpenKey] = React.useState(null);
    const toggle = (k, o) => setSel((s) => {
      const arr = s[k]; const next = arr.indexOf(o) !== -1 ? arr.filter((x) => x !== o) : arr.concat(o);
      return Object.assign({}, s, { [k]: next });
    });
    const radio = (k, v) => setSel((s) => Object.assign({}, s, { [k]: v }));
    const clear = () => { setSel(emptySel()); setQ(''); };

    const inter = (a, b) => a.some((x) => b.indexOf(x) !== -1);
    let rows = D.opportunities.filter((o) => {
      if (q && !(o.titulo.toLowerCase().includes(q.toLowerCase()) || o.org.toLowerCase().includes(q.toLowerCase()))) return false;
      if (sel.tipo.length && sel.tipo.indexOf(o.tipo) === -1) return false;
      if (sel.custo.length && sel.custo.indexOf(o.custo) === -1) return false;
      if (sel.nivel.length && !inter(sel.nivel, o.nivel)) return false;
      if (sel.publico.length && !inter(sel.publico, o.publico)) return false;
      if (sel.interesse.length && !inter(sel.interesse, o.interesse)) return false;
      if (sel.inscricoes === 'Sim' && !o.inscricoesAbertas) return false;
      if (sel.inscricoes === 'Não' && o.inscricoesAbertas) return false;
      return true;
    });
    const activeCount = sel.tipo.length + sel.nivel.length + sel.publico.length + sel.custo.length + sel.interesse.length + (sel.inscricoes ? 1 : 0);

    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 16, minWidth: 0 }}>
        {/* Search + sort */}
        <div style={{ display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap' }}>
          <div style={{ flex: 1, minWidth: 220 }}>
            <Input placeholder="Buscar oportunidade…" icon={Ic('search', 'ico-sm')} value={q} onChange={(e) => setQ(e.target.value)} />
          </div>
          <div style={{ width: 180 }}>
            <Select defaultValue="recentes">
              <option value="recentes">Mais recentes</option>
              <option value="prazo">Prazo mais próximo</option>
              <option value="alfabetica">Ordem alfabética</option>
            </Select>
          </div>
        </div>

        {/* Horizontal filter bar */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 7, color: 'var(--muted-foreground)', fontSize: 12.5, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '.06em' }}>
            {Ic('sliders-horizontal', 'ico-sm')} Filtros
          </span>
          {D.filters.map((f) => (
            <FilterDropdown key={f.key} f={f} sel={sel} onToggle={toggle} onRadio={radio} openKey={openKey} setOpenKey={setOpenKey} />
          ))}
          {activeCount > 0 && (
            <button onClick={clear} className="link-cell" style={{ fontSize: 12.5, color: 'var(--azul)', fontWeight: 600, padding: '6px 4px' }}>
              Limpar filtros
            </button>
          )}
        </div>

        <div style={{ fontSize: 13, color: 'var(--muted-foreground)' }}>
          {rows.length} {rows.length === 1 ? 'oportunidade' : 'oportunidades'}{activeCount ? ' · ' + activeCount + ' filtro(s)' : ''}
        </div>

        {/* List */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16, minWidth: 0 }}>
          {rows.map((o) => (
            <Card key={o.id} interactive onClick={() => onOpen(o)}>
              <div style={{ display: 'flex', gap: 16, padding: '18px 20px', alignItems: 'flex-start' }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                    {o.destaque && Ic('star', 'ico-star')}
                    <h3 style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: 17, letterSpacing: '-0.01em' }}>{o.titulo}</h3>
                  </div>
                  <div style={{ fontSize: 13, color: 'var(--muted-foreground)', marginBottom: 12, display: 'flex', alignItems: 'center', gap: 6 }}>
                    {Ic('building-2', 'ico-xs')} {o.org} · {o.areaAtuacao}
                  </div>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                    <Badge variant={D.tipoVariant[o.tipo] || 'neutral'}>{o.tipo}</Badge>
                    <Badge variant={D.custoVariant[o.custo] || 'neutral'}>{o.custo}</Badge>
                    {o.nivel.map((n) => <Badge key={n} variant="neutral">{n}</Badge>)}
                    {o.publico.slice(0, 2).map((p) => <Badge key={p} variant="pink">{p}</Badge>)}
                  </div>
                </div>
                <div style={{ flex: 'none', display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 10, width: 168 }}>
                  <Badge variant={D.statusVariant[o.status]} dot>{o.status}</Badge>
                  <div style={{ fontSize: 12.5, color: 'var(--muted-foreground)', textAlign: 'right' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 5, justifyContent: 'flex-end' }}>{Ic('calendar', 'ico-xs')} {o.prazo}</div>
                    {o.comentarios && o.comentarios.length > 0 && (
                      <div style={{ display: 'flex', alignItems: 'center', gap: 5, justifyContent: 'flex-end', marginTop: 3 }}>{Ic('message-circle', 'ico-xs')} {o.comentarios.length} comentário(s)</div>
                    )}
                  </div>
                  <div style={{ display: 'flex', gap: 6 }} onClick={(e) => e.stopPropagation()}>
                    <Button variant="outline" size="sm" onClick={() => onEdit(o)} iconLeft={Ic('pencil', 'ico-xs')}>Editar</Button>
                    <Button variant="ghost" size="icon" aria-label="Ver" onClick={() => onOpen(o)} style={{ width: 34, height: 34 }}>{Ic('arrow-up-right', 'ico-sm')}</Button>
                  </div>
                </div>
              </div>
            </Card>
          ))}

          {rows.length === 0 && (
            <Card flat><div style={{ padding: 48, textAlign: 'center', color: 'var(--muted-foreground)' }}>
              <div style={{ marginBottom: 8, display: 'flex', justifyContent: 'center' }}>{Ic('search-x', 'ico')}</div>
              Nenhuma oportunidade encontrada com esses filtros.
              <div style={{ marginTop: 14 }}><Button variant="outline" size="sm" onClick={clear}>Limpar filtros</Button></div>
            </div></Card>
          )}
        </div>
      </div>
    );
  }
  window.Opportunities = Opportunities;
})();
