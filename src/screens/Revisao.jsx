import { useState } from 'react';
import { Card, Badge, Button, Input } from '../components';
import { Ic } from '../lib/icons';
import D from '../lib/data';

// Página dedicada: lista TODAS as oportunidades com status "Em revisão", pra
// quem faz a revisão aprovar (ou abrir o detalhe/editar antes de aprovar).
export default function Revisao({ onOpen, onEdit, onApprove, perms = {} }) {
  const [q, setQ] = useState('');
  const [aprovando, setAprovando] = useState(null);

  const todas = D.opportunities.filter((o) => o.status === 'Em revisão');
  const rows = q
    ? todas.filter((o) =>
        o.titulo.toLowerCase().includes(q.toLowerCase()) ||
        o.org.toLowerCase().includes(q.toLowerCase()))
    : todas;

  const aprovar = async (o) => {
    if (!onApprove) return;
    setAprovando(o.id);
    try { await onApprove(o); }
    finally { setAprovando(null); }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16, minWidth: 0 }}>
      <div style={{ display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap' }}>
        <div style={{ flex: 1, minWidth: 220 }}>
          <Input placeholder="Buscar oportunidade em revisão…" icon={Ic('search', 'ico-sm')} value={q} onChange={(e) => setQ(e.target.value)} />
        </div>
        <Badge variant="warning">{todas.length} pendente{todas.length === 1 ? '' : 's'}</Badge>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 16, minWidth: 0 }}>
        {rows.map((o) => (
          <Card key={o.id} interactive onClick={() => onOpen && onOpen(o)}>
            <div className="opp-row" style={{ display: 'flex', gap: 16, padding: '18px 20px', alignItems: 'flex-start', flexWrap: 'wrap' }}>
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
                </div>
              </div>
              <div className="opp-row-actions" style={{ flex: 'none', display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 10, width: 168 }}>
                <Badge variant={D.statusVariant[o.status]} dot>{o.status}</Badge>
                {o.prazo && (
                  <div style={{ fontSize: 12.5, color: 'var(--muted-foreground)', display: 'flex', alignItems: 'center', gap: 5 }}>
                    {Ic('calendar', 'ico-xs')} {o.prazo}
                  </div>
                )}
                <div style={{ display: 'flex', gap: 6 }} onClick={(e) => e.stopPropagation()}>
                  {perms.canWrite && (
                    <Button variant="outline" size="sm" onClick={() => onEdit && onEdit(o)} iconLeft={Ic('pencil', 'ico-xs')}>Editar</Button>
                  )}
                  {perms.canWrite && (
                    <Button variant="primary" size="sm" onClick={() => aprovar(o)} disabled={aprovando === o.id}
                      iconLeft={Ic('circle-check', 'ico-xs')}>
                      {aprovando === o.id ? 'Aprovando…' : 'Aprovar'}
                    </Button>
                  )}
                </div>
              </div>
            </div>
          </Card>
        ))}

        {rows.length === 0 && (
          <Card flat>
            <div style={{ padding: 48, textAlign: 'center', color: 'var(--muted-foreground)' }}>
              <div style={{ marginBottom: 8, display: 'flex', justifyContent: 'center' }}>{Ic('circle-check', 'ico')}</div>
              {todas.length === 0 ? 'Nenhuma oportunidade em revisão no momento.' : 'Nenhuma oportunidade encontrada com essa busca.'}
            </div>
          </Card>
        )}
      </div>
    </div>
  );
}
