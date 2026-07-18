import { Card, CardHeader, CardTitle, CardBody, Badge, Button, Tabs, Table, Select } from '../components';
import { Ic } from '../lib/icons';
import { useState, useEffect, useMemo } from 'react';
import { fetchBeehiivPosts } from '../lib/beehiiv';
import { fetchApprovedOpportunities } from '../lib/sheets';
import { buildNewsletterHtml } from '../lib/newsletterHtml';
import D from '../lib/data';

function Account({ a, on, onToggle }) {
  return (
    <button type="button" onClick={onToggle}
      style={{
        display: 'flex', alignItems: 'center', gap: 9, padding: '7px 12px 7px 8px',
        borderRadius: 'var(--radius-pill)', cursor: 'pointer',
        border: '1px solid ' + (on ? 'var(--azul)' : 'var(--border)'),
        background: on ? 'var(--azul-soft)' : 'var(--card)',
      }}>
      <span style={{ width: 26, height: 26, borderRadius: '50%', background: a.cor, color: '#fff', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 700, fontFamily: 'var(--font-display)' }}>
        {a.nome.charAt(0)}
      </span>
      <span style={{ fontSize: 13, fontWeight: 600, color: on ? 'var(--azul)' : 'var(--ink)' }}>{a.handle}</span>
      {on && <span style={{ color: 'var(--azul)' }}>{Ic('check', 'ico-xs')}</span>}
    </button>
  );
}

export default function Newsletter() {

  const [beehiivPosts, setBeehiivPosts] = useState([]);
  useEffect(() => {
  fetchBeehiivPosts(10)
    .then((data) => setBeehiivPosts(data.data || []))
    .catch((err) => console.error('Beehiiv fetch failed:', err));
}, []);

  // Oportunidades aprovadas na planilha de revisão do Sentinel.
  const [approved, setApproved] = useState([]);
  const [approvedLoading, setApprovedLoading] = useState(true);
  const [contaFiltro, setContaFiltro] = useState('todas');
  const [copyStatus, setCopyStatus] = useState('idle'); // idle | copied | error
  useEffect(() => {
    fetchApprovedOpportunities()
      .then(setApproved)
      .finally(() => setApprovedLoading(false));
  }, []);

  const contasAprovadas = useMemo(
    () => Array.from(new Set(approved.map((o) => o.instaAccount).filter(Boolean))).sort(),
    [approved]
  );
  const approvedFiltradas = useMemo(
    () => (contaFiltro === 'todas' ? approved : approved.filter((o) => o.instaAccount === contaFiltro)),
    [approved, contaFiltro]
  );

  const copiarHtml = async () => {
    try {
      const html = buildNewsletterHtml(approvedFiltradas);
      await navigator.clipboard.writeText(html);
      setCopyStatus('copied');
      setTimeout(() => setCopyStatus('idle'), 2500);
    } catch (err) {
      console.error('Falha ao copiar HTML da newsletter:', err);
      setCopyStatus('error');
      setTimeout(() => setCopyStatus('idle'), 2500);
    }
  };

  const [tab, setTab] = useState('compor');
  const [accounts, setAccounts] = useState(() => D.instaAccounts.map((a) => a.incluido));
  const initialSel = D.instaPosts
    .filter((p) => { const acc = D.instaAccounts.find((a) => a.handle === p.conta); return acc && acc.incluido; })
    .slice(0, 3).map((p) => p.id);
  const [sel, setSel] = useState(initialSel);
  const [titulo, setTitulo] = useState('Oportunidades da semana · 16 jun');

  const includedHandles = D.instaAccounts.filter((a, i) => accounts[i]).map((a) => a.handle);
  const visiblePosts = D.instaPosts.filter((p) => includedHandles.includes(p.conta));
  const toggleAcc = (i) => setAccounts((s) => s.map((v, j) => (j === i ? !v : v)));
  const togglePost = (id) => setSel((s) => s.includes(id) ? s.filter((x) => x !== id) : s.concat(id));
  const selectedPosts = D.instaPosts.filter((p) => sel.includes(p.id));
  const generate = () => setSel(visiblePosts.map((p) => p.id));

  const tabs = [
    { value: 'compor', label: 'Compor' },
    { value: 'aprovadas', label: 'Aprovadas (Sentinel)' },
    { value: 'anteriores', label: 'Edições anteriores' },
  ];

  if (tab === 'aprovadas') {
    const cols = [
      { key: 'instaAccount', header: 'Conta' },
      { key: 'title',        header: 'Título' },
      { key: 'deadline',     header: 'Prazo' },
      { key: 'link',         header: 'Link' },
    ];
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
        <Tabs items={tabs} value={tab} onChange={setTab} />
        <Card flat>
          <CardHeader style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
            <CardTitle style={{ fontSize: 15 }}>
              Oportunidades aprovadas na planilha ({approvedFiltradas.length})
            </CardTitle>
            <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
              <Select value={contaFiltro} onChange={(e) => setContaFiltro(e.target.value)} style={{ minWidth: 200 }}>
                <option value="todas">Todas as contas</option>
                {contasAprovadas.map((c) => <option key={c} value={c}>@{c}</option>)}
              </Select>
              <Button
                variant="primary" size="sm"
                iconLeft={Ic(copyStatus === 'copied' ? 'check' : 'copy', 'ico-xs')}
                onClick={copiarHtml}
                disabled={approvedFiltradas.length === 0}
              >
                {copyStatus === 'copied' ? 'Copiado!' : copyStatus === 'error' ? 'Erro ao copiar' : 'Copiar HTML da edição'}
              </Button>
            </div>
          </CardHeader>
          <CardBody style={{ paddingTop: 0 }}>
            {approvedLoading ? (
              <div style={{ padding: 20, textAlign: 'center', color: 'var(--muted-foreground)', fontSize: 13 }}>
                Carregando planilha…
              </div>
            ) : approvedFiltradas.length === 0 ? (
              <div style={{ padding: 20, textAlign: 'center', color: 'var(--muted-foreground)', fontSize: 13, border: '1px dashed var(--border)', borderRadius: 'var(--radius-md)' }}>
                Nenhuma oportunidade aprovada ainda. Revise a planilha do Sentinel e marque linhas como "approved".
              </div>
            ) : (
              <div className="ap-table-wrap">
                <Table columns={cols} data={approvedFiltradas} rowKey="link" renderCell={(r, c) => {
                  if (c.key === 'instaAccount') return r.instaAccount ? <span>@{r.instaAccount}</span> : '—';
                  if (c.key === 'title')        return <span style={{ fontWeight: 600 }}>{r.title}</span>;
                  if (c.key === 'link')         return r.link ? <a href={r.link} target="_blank" rel="noreferrer" style={{ color: 'var(--azul)' }}>Abrir ↗</a> : '—';
                  return r[c.key] || '—';
                }} />
              </div>
            )}
          </CardBody>
        </Card>
      </div>
    );
  }

  if (tab === 'anteriores') {
    const cols = [
      { key: 'titulo',       header: 'Edição' },
      { key: 'status',       header: 'Status' },
      { key: 'data',         header: 'Data' },
      { key: 'destinatarios',header: 'Destinatários', align: 'right' },
      { key: 'aberturas',    header: 'Aberturas',     align: 'right' },
      { key: 'itens',        header: 'Itens',         align: 'right' },
    ];
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
        <Tabs items={tabs} value={tab} onChange={setTab} />
        <Card flat>
          <div className="ap-table-wrap">
            <Table columns={cols} data={D.newsletters} renderCell={(r, c) => {
              if (c.key === 'titulo')   return <span style={{ fontWeight: 600 }}>{r.titulo}</span>;
              if (c.key === 'status')   return <Badge variant={D.newsletterStatusVariant[r.status]} dot>{r.status}</Badge>;
              if (c.key === 'aberturas') return <span style={{ fontWeight: 600, color: r.aberturas !== '—' ? 'var(--success)' : 'var(--muted-foreground)' }}>{r.aberturas}</span>;
              return r[c.key];
            }} />
          </div>
        </Card>
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
      <Tabs items={tabs} value={tab} onChange={setTab} />
      <div className="ap-newsletter-grid" style={{ display: 'grid', gridTemplateColumns: '1.15fr 1fr', gap: 22, alignItems: 'start' }}>
        {/* Compose */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 18, minWidth: 0 }}>
          <Card>
            <CardHeader style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingBottom: 8 }}>
              <CardTitle style={{ fontSize: 15, display: 'flex', gap: 8, alignItems: 'center' }}>
                {Ic('instagram', 'ico-sm')} Contas do Instagram
              </CardTitle>
              <Button variant="ghost" size="sm" iconLeft={Ic('plus', 'ico-xs')}>Conectar</Button>
            </CardHeader>
            <CardBody style={{ paddingTop: 8 }}>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                {D.instaAccounts.map((a, i) => (
                  <Account key={a.id} a={a} on={accounts[i]} onToggle={() => toggleAcc(i)} />
                ))}
              </div>
            </CardBody>
          </Card>

          <Card>
            <CardHeader style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingBottom: 8 }}>
              <CardTitle style={{ fontSize: 15 }}>Posts recentes</CardTitle>
              <Button variant="outline" size="sm" iconLeft={Ic('sparkles', 'ico-xs')} onClick={generate}>Gerar com tudo</Button>
            </CardHeader>
            <CardBody style={{ display: 'flex', flexDirection: 'column', gap: 10, paddingTop: 8 }}>
              {visiblePosts.map((p) => {
                const on = sel.includes(p.id);
                const acc = D.instaAccounts.find((a) => a.handle === p.conta);
                return (
                  <div key={p.id} onClick={() => togglePost(p.id)}
                    style={{ display: 'flex', gap: 12, padding: 12, borderRadius: 'var(--radius-md)', cursor: 'pointer', border: '1px solid ' + (on ? 'var(--azul)' : 'var(--border)'), background: on ? 'var(--azul-soft)' : 'var(--card)' }}>
                    <span style={{ width: 34, height: 34, flex: 'none', borderRadius: '50%', background: acc ? acc.cor : 'var(--azul)', color: '#fff', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontFamily: 'var(--font-display)', fontSize: 13 }}>
                      {p.conta.charAt(1).toUpperCase()}
                    </span>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 7, marginBottom: 2 }}>
                        <span style={{ fontSize: 12.5, fontWeight: 600 }}>{p.conta}</span>
                        <Badge variant="neutral">{p.tipo}</Badge>
                        <span style={{ fontSize: 11.5, color: 'var(--muted-foreground)' }}>· {p.quando}</span>
                      </div>
                      <div style={{ fontSize: 13, color: 'var(--neutral-700)', lineHeight: 1.4 }}>{p.resumo}</div>
                      <div style={{ fontSize: 11.5, color: 'var(--muted-foreground)', marginTop: 4, display: 'flex', alignItems: 'center', gap: 5 }}>
                        {Ic('heart', 'ico-xs')} {p.curtidas} · {p.oportunidade}
                      </div>
                    </div>
                    <span style={{ color: on ? 'var(--azul)' : 'var(--neutral-300)', flex: 'none' }}>
                      {Ic(on ? 'check-circle-2' : 'circle', 'ico-sm')}
                    </span>
                  </div>
                );
              })}
            </CardBody>
          </Card>
        </div>

        {/* Preview */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14, position: 'sticky', top: 84 }}>
          <Card style={{ overflow: 'hidden' }}>
            <div style={{ background: 'var(--ink)', padding: '18px 20px', display: 'flex', alignItems: 'center', gap: 10 }}>
              <img src="/assets/icon-branco.png" alt="" style={{ width: 28, height: 28, borderRadius: '50%' }} />
              <span style={{ fontFamily: 'var(--font-display)', fontWeight: 800, fontSize: 16, color: '#fff' }}>
                Access<span style={{ color: 'var(--grifa-texto)' }}>+</span>Plus
              </span>
              <span style={{ marginLeft: 'auto', fontSize: 11, color: 'var(--sidebar-muted)', textTransform: 'uppercase', letterSpacing: '.1em' }}>Newsletter</span>
            </div>
            <CardBody style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              <input
                value={titulo}
                onChange={(e) => setTitulo(e.target.value)}
                className="ap-input"
                style={{ fontFamily: 'var(--font-display)', fontWeight: 800, fontSize: 18, border: '1px dashed var(--border)' }}
              />
              <p style={{ fontSize: 13.5, color: 'var(--neutral-700)', margin: 0, lineHeight: 1.5 }}>
                Oi! Separamos as melhores oportunidades da semana pra você que busca as próprias oportunidades. 👇
              </p>
              {selectedPosts.length === 0 && (
                <div style={{ padding: 20, textAlign: 'center', color: 'var(--muted-foreground)', fontSize: 13, border: '1px dashed var(--border)', borderRadius: 'var(--radius-md)' }}>
                  Selecione posts ao lado para montar a edição.
                </div>
              )}
              {selectedPosts.map((p, i) => (
                <div key={p.id} style={{ display: 'flex', gap: 12, paddingBottom: 14, borderBottom: i < selectedPosts.length - 1 ? '1px solid var(--neutral-100)' : 'none' }}>
                  <span style={{ width: 30, height: 30, flex: 'none', borderRadius: 8, background: 'var(--azul-soft)', color: 'var(--azul)', fontWeight: 800, fontFamily: 'var(--font-display)', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontSize: 13 }}>{i + 1}</span>
                  <div>
                    <div style={{ fontSize: 14, fontWeight: 700, fontFamily: 'var(--font-display)' }}>{p.oportunidade}</div>
                    <div style={{ fontSize: 12.5, color: 'var(--neutral-700)', marginTop: 2, lineHeight: 1.4 }}>{p.resumo}</div>
                    <span style={{ fontSize: 12, color: 'var(--azul)', fontWeight: 600, display: 'inline-flex', alignItems: 'center', gap: 4, marginTop: 4 }}>
                      Ver oportunidade {Ic('arrow-right', 'ico-xs')}
                    </span>
                  </div>
                </div>
              ))}
              <div style={{ fontSize: 11, color: 'var(--muted-foreground)', textAlign: 'center', paddingTop: 4 }}>
                Access+Plus · você recebe porque se inscreveu · descadastrar
              </div>
            </CardBody>
          </Card>

          <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
            <span style={{ fontSize: 12.5, color: 'var(--muted-foreground)', flex: 1 }}>{selectedPosts.length} itens · ~9.412 destinatários</span>
            <Button variant="outline" size="sm" iconLeft={Ic('save', 'ico-xs')}>Rascunho</Button>
            <Button variant="outline" size="sm" iconLeft={Ic('calendar-clock', 'ico-xs')}>Agendar</Button>
            <Button variant="primary"  size="sm" iconLeft={Ic('send', 'ico-xs')}>Publicar</Button>
          </div>
        </div>
      </div>
    </div>
  );
}
