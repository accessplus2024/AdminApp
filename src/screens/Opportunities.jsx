import { Card, Badge, Button, OpportunityFilters, useOpportunityFilters } from '../components';
import { Ic } from '../lib/icons';
import D from '../lib/data';
import { availabilityVariant, OPPORTUNITY_AVAILABILITY, opportunityAvailability } from '../lib/opportunityAvailability';

export default function Opportunities({ onOpen, onNew, onEdit, perms = {} }) {
  const filterController = useOpportunityFilters(D.opportunities);
  const rows = filterController.rows;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16, minWidth: 0 }}>
      <OpportunityFilters controller={filterController} total={D.opportunities.length} />

      {/* List */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 16, minWidth: 0 }}>
        {rows.map((o) => {
          const availability = opportunityAvailability(o);
          return (
          <Card key={o.id} interactive onClick={() => onOpen(o)}>
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
                  {o.qualificacao === 'unqualified' && <Badge variant="danger">Desqualificada</Badge>}
                  {availability !== OPPORTUNITY_AVAILABILITY.UNKNOWN && availability !== o.status && <Badge variant={availabilityVariant(o)} dot>{availability}</Badge>}
                </div>
              </div>
              <div className="opp-row-actions" style={{ flex: 'none', display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 10, width: 168 }}>
                <Badge variant={D.statusVariant[o.status]} dot>{o.status}</Badge>
                <div style={{ fontSize: 12.5, color: 'var(--muted-foreground)', textAlign: 'right' }}>
                  {o.prazo && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: 5, justifyContent: 'flex-end' }}>
                      {Ic('calendar', 'ico-xs')} {o.prazo}
                    </div>
                  )}
                  {o.comentarios && o.comentarios.length > 0 && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: 5, justifyContent: 'flex-end', marginTop: 3 }}>
                      {Ic('message-circle', 'ico-xs')} {o.comentarios.length} comentário(s)
                    </div>
                  )}
                </div>
                <div style={{ display: 'flex', gap: 6 }} onClick={(e) => e.stopPropagation()}>
                  {perms.canWrite && (
                    <Button variant="outline" size="sm" onClick={() => onEdit(o)} iconLeft={Ic('pencil', 'ico-xs')}>Editar</Button>
                  )}
                  <Button variant="ghost" size="icon" aria-label="Ver" onClick={() => onOpen(o)} style={{ width: 34, height: 34 }}>
                    {Ic('arrow-up-right', 'ico-sm')}
                  </Button>
                </div>
              </div>
            </div>
          </Card>
          );
        })}

        {rows.length === 0 && (
          <Card flat>
            <div style={{ padding: 48, textAlign: 'center', color: 'var(--muted-foreground)' }}>
              <div style={{ marginBottom: 8, display: 'flex', justifyContent: 'center' }}>{Ic('search-x', 'ico')}</div>
              {D.opportunities.length === 0
                ? 'Nenhuma oportunidade cadastrada ainda.'
                : 'Nenhuma oportunidade encontrada com esses filtros.'}
              {(filterController.activeCount > 0 || filterController.query) && (
                <div style={{ marginTop: 14 }}>
                  <Button variant="outline" size="sm" onClick={filterController.clear}>Limpar filtros</Button>
                </div>
              )}
            </div>
          </Card>
        )}
      </div>
    </div>
  );
}
