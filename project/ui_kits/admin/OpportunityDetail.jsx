// OpportunityDetail — full opportunity page (admin view)
(function () {
  const NS = window.AccessPlusDesignSystem_ece1f0;
  const { Card, CardHeader, CardTitle, CardBody, Badge, Button, Dialog } = NS;
  const D = window.AP_DATA;
  const Ic = (n, cls) => window.Ic(n, cls);

  const PLAT = {
    youtube: { label: 'YouTube', icon: 'youtube', color: '#FF0000' },
    instagram: { label: 'Instagram', icon: 'instagram', color: 'var(--grifa-topicos)' },
    reddit: { label: 'Reddit', icon: 'message-circle', color: '#FF4500' },
  };

  function Section({ icon, title, children }) {
    return (
      <Card flat>
        <CardHeader style={{ paddingBottom: 6 }}>
          <CardTitle style={{ display: 'flex', alignItems: 'center', gap: 9, fontSize: 16 }}>
            <span style={{ color: 'var(--azul)' }}>{Ic(icon, 'ico-sm')}</span>{title}
          </CardTitle>
        </CardHeader>
        <CardBody style={{ paddingTop: 10 }}>{children}</CardBody>
      </Card>
    );
  }

  function Fact({ icon, label, value }) {
    return (
      <div style={{ display: 'flex', gap: 10, alignItems: 'flex-start' }}>
        <span style={{ color: 'var(--muted-foreground)', marginTop: 1 }}>{Ic(icon, 'ico-sm')}</span>
        <div>
          <div style={{ fontSize: 12, color: 'var(--muted-foreground)' }}>{label}</div>
          <div style={{ fontSize: 13.5, fontWeight: 600 }}>{value}</div>
        </div>
      </div>
    );
  }

  function OpportunityDetail({ opp, onBack, onEdit, onDelete, onTogglePublish }) {
    const [confirm, setConfirm] = React.useState(false);
    const [comentarios, setComentarios] = React.useState(() => (opp && opp.comentarios) || []);
    const [delId, setDelId] = React.useState(null);
    React.useEffect(() => { setComentarios((opp && opp.comentarios) || []); }, [opp && opp.id]);
    if (!opp) return null;
    const removeComment = (id) => {
      const next = comentarios.filter((c) => c.id !== id);
      setComentarios(next); opp.comentarios = next; setDelId(null);
    };
    const published = opp.status === 'Publicada';
    const para = { fontSize: 14.5, lineHeight: 1.6, color: 'var(--neutral-700)' };

    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
        {/* breadcrumb + actions */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
          <Button variant="ghost" size="sm" iconLeft={Ic('arrow-left', 'ico-sm')} onClick={onBack}>Oportunidades</Button>
          <div style={{ flex: 1 }} />
          <Button variant="outline" iconLeft={Ic('pencil', 'ico-sm')} onClick={() => onEdit(opp)}>Editar</Button>
          <Button variant={published ? 'secondary' : 'primary'} iconLeft={Ic(published ? 'eye-off' : 'send', 'ico-sm')} onClick={() => onTogglePublish(opp)}>
            {published ? 'Despublicar' : 'Publicar'}
          </Button>
          <Button variant="ghost" size="icon" aria-label="Excluir" onClick={() => setConfirm(true)} style={{ color: 'var(--vermelha)' }}>{Ic('trash-2', 'ico-sm')}</Button>
        </div>

        {/* header */}
        <Card>
          <CardBody style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>
              {opp.destaque && <span style={{ marginTop: 4 }}>{Ic('star', 'ico-star')}</span>}
              <div style={{ flex: 1 }}>
                <h1 style={{ fontFamily: 'var(--font-display)', fontWeight: 800, fontSize: 28, letterSpacing: '-0.02em', lineHeight: 1.1 }}>{opp.titulo}</h1>
                <div style={{ fontSize: 14, color: 'var(--muted-foreground)', marginTop: 6, display: 'flex', alignItems: 'center', gap: 7 }}>
                  {Ic('building-2', 'ico-sm')} {opp.org}
                </div>
              </div>
              <Badge variant={D.statusVariant[opp.status]} dot>{opp.status}</Badge>
            </div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 7 }}>
              <Badge variant={D.tipoVariant[opp.tipo] || 'neutral'}>{opp.tipo}</Badge>
              <Badge variant={D.custoVariant[opp.custo] || 'neutral'}>{opp.custo}</Badge>
              <Badge variant={opp.inscricoesAbertas ? 'success' : 'neutral'} dot>{opp.inscricoesAbertas ? 'Inscrições abertas' : 'Inscrições fechadas'}</Badge>
              {opp.interesse.map((i) => <Badge key={i} variant="lime">{i}</Badge>)}
            </div>
          </CardBody>
        </Card>

        {/* body grid */}
        <div style={{ display: 'grid', gridTemplateColumns: '1.7fr 1fr', gap: 20, alignItems: 'start' }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 20, minWidth: 0 }}>
            <Section icon="align-left" title="Descrição"><p style={para}>{opp.descricao}</p></Section>

            <Section icon="clipboard-check" title="Elegibilidade e guia de aplicação">
              <ul style={{ margin: 0, paddingLeft: 0, listStyle: 'none', display: 'flex', flexDirection: 'column', gap: 10 }}>
                {opp.elegibilidade.map((e, i) => (
                  <li key={i} style={{ display: 'flex', gap: 10, ...para }}>
                    <span style={{ color: 'var(--azul)', marginTop: 2 }}>{Ic('check', 'ico-sm')}</span>{e}
                  </li>
                ))}
              </ul>
            </Section>

            <Section icon="route" title="Sobre o processo"><p style={para}>{opp.processo}</p></Section>

            <Section icon="lightbulb" title="Dicas de contemplados">
              <ul style={{ margin: 0, paddingLeft: 0, listStyle: 'none', display: 'flex', flexDirection: 'column', gap: 10 }}>
                {opp.dicas.map((d, i) => (
                  <li key={i} style={{ display: 'flex', gap: 10, ...para }}>
                    <span style={{ color: 'var(--grifa-topicos)', marginTop: 2 }}>{Ic('sparkles', 'ico-sm')}</span>{d}
                  </li>
                ))}
              </ul>
            </Section>

            <Section icon="info" title="Informações adicionais"><p style={para}>{opp.infoAdicional}</p></Section>

            <Section icon="link" title="Recursos online">
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {opp.recursos.map((r, i) => {
                  const p = PLAT[r.plataforma] || PLAT.instagram;
                  return (
                    <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 13, padding: 12, border: '1px solid var(--border)', borderRadius: 'var(--radius-md)' }}>
                      <span style={{ width: 40, height: 40, flex: 'none', borderRadius: 'var(--radius-sm)', background: 'color-mix(in srgb, ' + p.color + ' 14%, white)', color: p.color, display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}>{Ic(p.icon, 'ico')}</span>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: 14, fontWeight: 600, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{r.titulo}</div>
                        <div style={{ fontSize: 12, color: 'var(--muted-foreground)' }}>{p.label} · {r.meta}</div>
                      </div>
                      <Button variant="ghost" size="icon" aria-label="Abrir" style={{ width: 34, height: 34 }}>{Ic('external-link', 'ico-sm')}</Button>
                    </div>
                  );
                })}
                <Button variant="outline" size="sm" iconLeft={Ic('plus', 'ico-xs')} style={{ alignSelf: 'flex-start' }}>Conectar recurso (YouTube · Reddit · Instagram)</Button>
              </div>
            </Section>

            <Section icon="tags" title="Tags relacionadas">
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 7 }}>
                {opp.tagsRelacionadas.map((t) => <Badge key={t} variant="neutral">#{t}</Badge>)}
              </div>
            </Section>

            {/* Student comments + moderation */}
            <Card flat>
              <CardHeader style={{ paddingBottom: 6 }}>
                <CardTitle style={{ display: 'flex', alignItems: 'center', gap: 9, fontSize: 16 }}>
                  <span style={{ color: 'var(--azul)' }}>{Ic('message-circle', 'ico-sm')}</span>
                  Comentários dos estudantes
                  <span style={{ fontSize: 12.5, fontWeight: 600, color: 'var(--muted-foreground)' }}>({comentarios.length})</span>
                </CardTitle>
              </CardHeader>
              <CardBody style={{ paddingTop: 10 }}>
                <p style={{ fontSize: 12.5, color: 'var(--muted-foreground)', marginTop: 0, marginBottom: 16 }}>
                  Comentários públicos enviados pelos estudantes. Remova qualquer um que seja inadequado, spam ou ofensivo.
                </p>
                {comentarios.length === 0 ? (
                  <div style={{ padding: '28px 0', textAlign: 'center', color: 'var(--muted-foreground)', fontSize: 13.5 }}>
                    Ainda não há comentários nesta oportunidade.
                  </div>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                    {comentarios.map((c) => (
                      <div key={c.id} style={{
                        display: 'flex', gap: 12, padding: 14, borderRadius: 'var(--radius-md)',
                        border: '1px solid ' + (c.sinalizado ? 'var(--vermelha)' : 'var(--border)'),
                        background: c.sinalizado ? 'var(--vermelha-soft)' : 'var(--card)',
                      }}>
                        <span style={{
                          width: 36, height: 36, flex: 'none', borderRadius: '50%', background: c.cor, color: '#fff',
                          display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                          fontSize: 12.5, fontWeight: 700, fontFamily: 'var(--font-display)',
                        }}>{c.iniciais}</span>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 3 }}>
                            <span style={{ fontSize: 13.5, fontWeight: 700 }}>{c.autor}</span>
                            <span style={{ fontSize: 12, color: 'var(--muted-foreground)' }}>{c.quando}</span>
                            {c.sinalizado && (
                              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 11, fontWeight: 700, color: 'var(--vermelha)' }}>
                                {Ic('flag', 'ico-xs')} Sinalizado
                              </span>
                            )}
                          </div>
                          <p style={{ fontSize: 13.5, lineHeight: 1.5, color: 'var(--neutral-700)', margin: 0 }}>{c.texto}</p>
                        </div>
                        <Button variant="ghost" size="icon" aria-label="Excluir comentário" onClick={() => setDelId(c.id)} style={{ flex: 'none', width: 34, height: 34, color: 'var(--vermelha)' }}>{Ic('trash-2', 'ico-sm')}</Button>
                      </div>
                    ))}
                  </div>
                )}
              </CardBody>
            </Card>
          </div>

          {/* sidebar */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 20, position: 'sticky', top: 84 }}>
            <Card>
              <CardHeader><CardTitle style={{ fontSize: 15 }}>Resumo</CardTitle></CardHeader>
              <CardBody style={{ display: 'flex', flexDirection: 'column', gap: 14, paddingTop: 10 }}>
                <Fact icon="calendar" label="Prazo de inscrição" value={opp.prazo} />
                <Fact icon="play" label="Início" value={opp.dataInicio} />
                <Fact icon="bar-chart-3" label="Nível" value={opp.nivel.join(' · ')} />
                <Fact icon="wallet" label="Custo" value={opp.custo} />
                <Fact icon="monitor" label="Formato" value={opp.formato} />
                <Fact icon="map-pin" label="Local" value={opp.local} />
                <Fact icon="target" label="Área de atuação" value={opp.areaAtuacao} />
              </CardBody>
            </Card>

            <Card>
              <CardHeader><CardTitle style={{ fontSize: 15 }}>Público-alvo</CardTitle></CardHeader>
              <CardBody style={{ paddingTop: 10 }}>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 7 }}>
                  {opp.publico.map((p) => <Badge key={p} variant="pink">{p}</Badge>)}
                </div>
              </CardBody>
            </Card>
          </div>
        </div>

        <Dialog open={confirm} onClose={() => setConfirm(false)}
          title="Excluir oportunidade?" description="Esta ação não pode ser desfeita."
          footer={<>
            <Button variant="ghost" onClick={() => setConfirm(false)}>Cancelar</Button>
            <Button variant="destructive" iconLeft={Ic('trash-2', 'ico-sm')} onClick={() => { setConfirm(false); onDelete(opp); }}>Excluir</Button>
          </>}>
          “{opp.titulo}” será removida permanentemente do painel.
        </Dialog>

        <Dialog open={!!delId} onClose={() => setDelId(null)}
          title="Excluir comentário?" description="O comentário será removido para todos os estudantes."
          footer={<>
            <Button variant="ghost" onClick={() => setDelId(null)}>Cancelar</Button>
            <Button variant="destructive" iconLeft={Ic('trash-2', 'ico-sm')} onClick={() => removeComment(delId)}>Excluir comentário</Button>
          </>}>
          Esta ação não pode ser desfeita.
        </Dialog>
      </div>
    );
  }
  window.OpportunityDetail = OpportunityDetail;
})();
