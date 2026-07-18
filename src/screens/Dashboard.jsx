import { useEffect, useState } from 'react';
import { Card, CardHeader, CardTitle, CardBody, Stat, Table, Badge, Button } from '../components';
import { Ic } from '../lib/icons';
import D from '../lib/data';
import { fetchRecentComments } from '../lib/comments';
import { isSupabaseConfigured } from '../lib/supabase';

// Tempo relativo simples em pt-BR a partir de uma data (created_at do banco).
function tempoRelativo(iso) {
  if (!iso) return '';
  const t = new Date(iso).getTime();
  if (Number.isNaN(t)) return '';
  const seg = Math.max(0, (Date.now() - t) / 1000);
  if (seg < 3600) return `há ${Math.max(1, Math.round(seg / 60))} min`;
  if (seg < 86400) return `há ${Math.round(seg / 3600)} h`;
  const dias = Math.round(seg / 86400);
  if (dias < 30) return `há ${dias} dia${dias > 1 ? 's' : ''}`;
  return new Date(iso).toLocaleDateString('pt-BR');
}

// KPIs calculados a partir das oportunidades REAIS (zerado até ter dados).
function calcularStats(opps) {
  const conta = (fn) => opps.filter(fn).length;
  return [
    { label: 'Oportunidades',   value: String(opps.length),                          icon: 'Compass' },
    { label: 'Publicadas',      value: String(conta((o) => o.status === 'Publicada')), icon: 'CircleCheck' },
    { label: 'Em revisão',      value: String(conta((o) => o.status === 'Em revisão')),icon: 'FilePen' },
    { label: 'Gratuitas',       value: String(conta((o) => o.custo === 'Gratuito')),   icon: 'Gift' },
  ];
}

// Atividade recente derivada das oportunidades adicionadas por último (created_at).
function calcularAtividade(opps) {
  const comData = opps.filter((o) => o._raw && o._raw.created_at);
  if (!comData.length) return [];
  return [...comData]
    .sort((a, b) => new Date(b._raw.created_at) - new Date(a._raw.created_at))
    .slice(0, 4)
    .map((o) => ({
      icon: 'CirclePlus',
      color: 'var(--success)',
      text: `<b>${o.titulo}</b> foi adicionada`,
      time: tempoRelativo(o._raw.created_at),
    }));
}

// Comentários mais recentes, quando ainda não temos Supabase configurado:
// junta os comentários mock que já vêm dentro de cada oportunidade. Sinalizados
// (harmful) primeiro, depois os demais.
function comentariosMock(opps) {
  const todos = [];
  opps.forEach((o) => {
    (o.comentarios || []).forEach((c) => todos.push({ ...c, oportunidadeTitulo: o.titulo, oportunidadeRef: o }));
  });
  const sinalizados = todos.filter((c) => c.sinalizado);
  const recentes = todos.filter((c) => !c.sinalizado);
  return [...sinalizados, ...recentes].slice(0, 6);
}

// Acha a oportunidade (já carregada) dona de um comentário vindo do Supabase.
function achaOportunidade(opps, oportunidadeId) {
  return opps.find((o) => (o._raw && o._raw.id === oportunidadeId) || o.id === oportunidadeId);
}

export default function Dashboard({ onOpen, onNew, perms = {} }) {
  const recent = D.opportunities.slice(0, 5);
  const stats = calcularStats(D.opportunities);
  const activity = calcularAtividade(D.opportunities);
  const [comentarios, setComentarios] = useState(() => comentariosMock(D.opportunities));

  useEffect(() => {
    let ativo = true;
    if (isSupabaseConfigured) {
      fetchRecentComments(6).then((lista) => {
        if (!ativo) return;
        const comTitulo = lista.map((c) => ({
          ...c,
          oportunidadeTitulo: (achaOportunidade(D.opportunities, c.oportunidadeId) || {}).titulo || '',
        }));
        setComentarios(comTitulo);
      });
    } else {
      setComentarios(comentariosMock(D.opportunities));
    }
    return () => { ativo = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [D.opportunities.length]);

  const cols = [
    { key: 'titulo',   header: 'Oportunidade' },
    { key: 'tipo',     header: 'Tipo' },
    { key: 'status',   header: 'Status' },
  ];

  // Distribuicao por tipo, calculada das oportunidades REAIS.
  // Conta cada tipo (ignora vazios) e ordena do maior pro menor. Mostra todos.
  const byTipo = {};
  D.opportunities.forEach((o) => {
    const t = (o.tipo || '').trim();
    if (t) byTipo[t] = (byTipo[t] || 0) + 1;
  });
  const dist = Object.keys(byTipo)
    .map((k) => ({ k, v: byTipo[k] }))
    .sort((a, b) => b.v - a.v);
  const maxV = dist.length ? Math.max(...dist.map((d) => d.v)) : 1;
  const distColors = ['var(--azul)', 'var(--grifa-topicos)', 'var(--citacoes)', 'var(--grifa-texto)', 'var(--vermelha)'];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 22 }}>
      <div className="ap-dashboard-stats" style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16 }}>
        {stats.map((s, i) => (
          <Card key={i}><CardBody>
            <Stat label={s.label} value={s.value} icon={Ic(s.icon, 'ico-sm')} delta={s.delta} deltaDir={s.dir} />
          </CardBody></Card>
        ))}
      </div>

      <div className="ap-dashboard-grid" style={{ display: 'grid', gridTemplateColumns: '1.7fr 1fr', gap: 22, alignItems: 'start' }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 22, minWidth: 0 }}>
          <Card flat>
            <CardHeader style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', paddingBottom: 12 }}>
              <CardTitle>Oportunidades recentes</CardTitle>
              {perms.canWrite && <Button variant="link" iconRight={Ic('arrow-right', 'ico-sm')} onClick={onNew}>Nova</Button>}
            </CardHeader>
            <div className="ap-table-wrap">
              <Table columns={cols} data={recent} renderCell={(r, c) => {
                if (c.key === 'titulo') return (
                  <button onClick={() => onOpen && onOpen(r)} className="link-cell">
                    <div style={{ fontWeight: 600 }}>{r.titulo}</div>
                    <div style={{ fontSize: 12, color: 'var(--muted-foreground)' }}>{r.org}</div>
                  </button>
                );
                if (c.key === 'tipo')     return <Badge variant={D.tipoVariant[r.tipo] || 'neutral'}>{r.tipo}</Badge>;
                if (c.key === 'status')   return <Badge variant={D.statusVariant[r.status]} dot>{r.status}</Badge>;
                return r[c.key];
              }} />
            </div>
          </Card>

          {/* Comentários recentes — featured logo abaixo de Oportunidades recentes.
              Sinalizados como harmful aparecem destacados (borda/fundo vermelhos). */}
          <Card flat>
            <CardHeader style={{ paddingBottom: 6 }}>
              <CardTitle style={{ display: 'flex', alignItems: 'center', gap: 9, fontSize: 16 }}>
                <span style={{ color: 'var(--azul)' }}>{Ic('message-circle', 'ico-sm')}</span>
                Comentários recentes
              </CardTitle>
            </CardHeader>
            <CardBody style={{ paddingTop: 10, display: 'flex', flexDirection: 'column', gap: 10 }}>
              {comentarios.length === 0 ? (
                <div style={{ padding: '10px 0', color: 'var(--muted-foreground)', fontSize: 13.5 }}>
                  Nenhum comentário ainda.
                </div>
              ) : comentarios.map((c) => (
                <div key={c.id}
                  onClick={() => c.oportunidadeRef && onOpen && onOpen(c.oportunidadeRef)}
                  style={{
                    display: 'flex', gap: 11, padding: 12, borderRadius: 'var(--radius-md)',
                    cursor: c.oportunidadeRef ? 'pointer' : 'default',
                    border: '1px solid ' + (c.sinalizado ? 'var(--vermelha)' : 'var(--border)'),
                    background: c.sinalizado ? 'var(--vermelha-soft)' : 'transparent',
                  }}>
                  <span style={{
                    width: 32, height: 32, flex: 'none', borderRadius: '50%', background: c.cor, color: '#fff',
                    display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: 11.5, fontWeight: 700, fontFamily: 'var(--font-display)',
                  }}>{c.iniciais}</span>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 7, flexWrap: 'wrap', marginBottom: 2 }}>
                      <span style={{ fontSize: 13, fontWeight: 700 }}>{c.autor}</span>
                      <span style={{ fontSize: 11.5, color: 'var(--muted-foreground)' }}>{c.quando}</span>
                      {c.sinalizado && (
                        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 11, fontWeight: 700, color: 'var(--vermelha)' }}>
                          {Ic('flag', 'ico-xs')} Sinalizado
                        </span>
                      )}
                    </div>
                    <p style={{ fontSize: 13, lineHeight: 1.45, color: 'var(--neutral-700)', margin: 0, overflow: 'hidden', textOverflow: 'ellipsis', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical' }}>{c.texto}</p>
                    {c.oportunidadeTitulo && (
                      <div style={{ fontSize: 11.5, color: 'var(--muted-foreground)', marginTop: 3 }}>
                        em <b style={{ color: 'var(--ink)' }}>{c.oportunidadeTitulo}</b>
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </CardBody>
          </Card>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 22, minWidth: 0 }}>
          <Card>
            <CardHeader><CardTitle>Por tipo</CardTitle></CardHeader>
            <CardBody style={{ display: 'flex', flexDirection: 'column', gap: 12, paddingTop: 10 }}>
              {dist.length === 0 && (
                <div style={{ color: 'var(--muted-foreground)', fontSize: 13 }}>Nenhuma oportunidade cadastrada ainda.</div>
              )}
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
              {activity.length === 0 && (
                <div style={{ color: 'var(--muted-foreground)', fontSize: 13 }}>Nenhuma atividade recente ainda.</div>
              )}
              {activity.map((a, i) => (
                <div key={i} style={{ display: 'flex', gap: 12, alignItems: 'flex-start' }}>
                  <span style={{
                    width: 28, height: 28, flex: 'none', borderRadius: 8,
                    display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                    background: `color-mix(in srgb, ${a.color} 14%, white)`, color: a.color,
                  }}>
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
