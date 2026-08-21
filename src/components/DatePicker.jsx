import { useEffect, useRef, useState } from 'react';
import { Ic } from '../lib/icons';

// Calendário próprio pra trocar o <input type="date"> nativo (o "calendário
// padrão do navegador", que muda de aparência em cada sistema/navegador) por
// algo consistente com o resto do design do AdminApp — pedido explícito
// (2026-08-21): "coloque um calendario bonitinho sem ser o default". Mesmo
// contrato de valor que o input nativo (string "AAAA-MM-DD", '' quando
// vazio) pra encaixar sem mudar a lógica de conversão já usada em
// OpportunityEditor (catalogDeadlineToInputValue/inputValueToCatalogDeadline)
// — o Sentinel continua sendo quem sugere a data; isso só troca como um
// humano confirma/ajusta essa data na tela.

const WEEKDAY_LABELS = ['D', 'S', 'T', 'Q', 'Q', 'S', 'S'];
const MONTH_LABELS = [
  'janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho',
  'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro',
];

function parseInputValue(value) {
  const match = String(value || '').match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!match) return null;
  const [, y, m, d] = match;
  return new Date(Number(y), Number(m) - 1, Number(d));
}

function toInputValue(date) {
  const y = String(date.getFullYear()).padStart(4, '0');
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function sameDay(a, b) {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}

function buildMonthGrid(viewDate) {
  const year = viewDate.getFullYear();
  const month = viewDate.getMonth();
  const firstOfMonth = new Date(year, month, 1);
  const startOffset = firstOfMonth.getDay(); // 0 = domingo
  const start = new Date(year, month, 1 - startOffset);
  return Array.from({ length: 42 }, (_, i) => {
    const date = new Date(start.getFullYear(), start.getMonth(), start.getDate() + i);
    return { date, inMonth: date.getMonth() === month };
  });
}

export function DatePicker({ id, value, onChange, disabled = false, placeholder = 'Selecionar data' }) {
  const [open, setOpen] = useState(false);
  const selected = parseInputValue(value);
  const today = new Date();
  const [viewDate, setViewDate] = useState(selected || today);
  const rootRef = useRef(null);

  useEffect(() => {
    if (selected) setViewDate(selected);
  }, [value]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!open) return undefined;
    const onDocClick = (e) => {
      if (rootRef.current && !rootRef.current.contains(e.target)) setOpen(false);
    };
    const onEscape = (e) => { if (e.key === 'Escape') setOpen(false); };
    document.addEventListener('mousedown', onDocClick);
    document.addEventListener('keydown', onEscape);
    return () => {
      document.removeEventListener('mousedown', onDocClick);
      document.removeEventListener('keydown', onEscape);
    };
  }, [open]);

  const cells = buildMonthGrid(viewDate);
  const label = selected
    ? `${selected.getDate()} de ${MONTH_LABELS[selected.getMonth()]} de ${selected.getFullYear()}`
    : placeholder;

  function pick(date) {
    onChange?.(toInputValue(date));
    setOpen(false);
  }

  return (
    <div ref={rootRef} style={{ position: 'relative' }}>
      <button
        id={id}
        type="button"
        disabled={disabled}
        onClick={() => setOpen((v) => !v)}
        className="ap-input"
        style={{
          display: 'flex', alignItems: 'center', gap: 8, width: '100%', textAlign: 'left',
          cursor: disabled ? 'not-allowed' : 'pointer', opacity: disabled ? 0.6 : 1,
          color: selected ? 'var(--ink)' : 'var(--muted-foreground)',
        }}
      >
        {Ic('calendar', 'ico-xs')}
        <span>{label}</span>
      </button>

      {open && !disabled && (
        <div
          role="dialog"
          style={{
            position: 'absolute', zIndex: 40, top: 'calc(100% + 6px)', left: 0,
            width: 272, background: 'var(--popover)', border: '1px solid var(--border)',
            borderRadius: 'var(--radius-lg)', boxShadow: 'var(--shadow-xl)', padding: 12,
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
            <button type="button" className="ap-btn ap-btn--secondary ap-btn--icon"
              onClick={() => setViewDate(new Date(viewDate.getFullYear(), viewDate.getMonth() - 1, 1))}
              aria-label="Mês anterior">
              {Ic('chevron-left', 'ico-xs')}
            </button>
            <span style={{ fontWeight: 600, fontSize: 'var(--text-sm)', textTransform: 'capitalize' }}>
              {MONTH_LABELS[viewDate.getMonth()]} de {viewDate.getFullYear()}
            </span>
            <button type="button" className="ap-btn ap-btn--secondary ap-btn--icon"
              onClick={() => setViewDate(new Date(viewDate.getFullYear(), viewDate.getMonth() + 1, 1))}
              aria-label="Próximo mês">
              {Ic('chevron-right', 'ico-xs')}
            </button>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 2, marginBottom: 4 }}>
            {WEEKDAY_LABELS.map((w, i) => (
              <div key={i} style={{ textAlign: 'center', fontSize: 'var(--text-xs)', color: 'var(--muted-foreground)', padding: '2px 0' }}>{w}</div>
            ))}
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 2 }}>
            {cells.map(({ date, inMonth }, i) => {
              const isSelected = selected && sameDay(date, selected);
              const isToday = sameDay(date, today);
              return (
                <button
                  key={i}
                  type="button"
                  onClick={() => pick(date)}
                  style={{
                    height: 32, borderRadius: 'var(--radius-sm)', border: isToday && !isSelected ? '1px solid var(--primary)' : '1px solid transparent',
                    background: isSelected ? 'var(--primary)' : 'transparent',
                    color: isSelected ? 'var(--primary-foreground)' : (inMonth ? 'var(--ink)' : 'var(--muted-foreground)'),
                    opacity: inMonth ? 1 : 0.45,
                    fontSize: 'var(--text-sm)', cursor: 'pointer',
                  }}
                >
                  {date.getDate()}
                </button>
              );
            })}
          </div>

          <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 10, paddingTop: 10, borderTop: '1px solid var(--border)' }}>
            <button type="button" className="ap-btn ap-btn--secondary ap-btn--sm" onClick={() => pick(today)}>Hoje</button>
            {selected && (
              <button type="button" className="ap-btn ap-btn--outline ap-btn--sm" onClick={() => { onChange?.(''); setOpen(false); }}>Limpar</button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
