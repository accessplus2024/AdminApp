import { useEffect, useMemo, useRef, useState } from 'react';
import { Checkbox } from './Checkbox';
import { Input } from './Input';
import { Select } from './Select';
import { Ic } from '../lib/icons';
import D from '../lib/data';
import { opportunityAvailability } from '../lib/opportunityAvailability';

export const emptyOpportunityFilters = () => ({
  tipo: [], nivel: [], custo: [], interesse: [], inscricoes: null,
});

const text = (value) => String(value || '').toLocaleLowerCase('pt-BR');
const intersects = (selected, values) => selected.some((value) => (values || []).includes(value));

const MONTHS = {
  janeiro: 0, fevereiro: 1, março: 2, marco: 2, abril: 3, maio: 4, junho: 5,
  julho: 6, agosto: 7, setembro: 8, outubro: 9, novembro: 10, dezembro: 11,
};

function deadlineTime(value) {
  const normalized = text(value).replace(/\s+/g, ' ').trim();
  const match = normalized.match(/(\d{1,2})\s*(?:de\s*)?([a-zç]+)(?:\s*(?:de\s*)?(\d{4}))?/i);
  if (!match) return Number.POSITIVE_INFINITY;
  const month = MONTHS[match[2]];
  if (month == null) return Number.POSITIVE_INFINITY;
  const year = Number(match[3]) || new Date().getFullYear();
  return new Date(year, month, Number(match[1])).getTime();
}

export function filterAndSortOpportunities(opportunities, query, filters, sort) {
  const q = text(query).trim();
  const rows = (opportunities || []).filter((opportunity) => {
    const searchable = [
      opportunity.titulo, opportunity.org, opportunity.descricao, opportunity.tipo,
      opportunity.custo, opportunity.prazo, ...(opportunity.tagsRelacionadas || []),
    ].map(text).join(' ');
    if (q && !searchable.includes(q)) return false;
    if (filters.tipo.length && !filters.tipo.includes(opportunity.tipo)) return false;
    if (filters.custo.length && !filters.custo.includes(opportunity.custo)) return false;
    if (filters.nivel.length && !intersects(filters.nivel, opportunity.nivel)) return false;
    if (filters.interesse.length && !intersects(filters.interesse, opportunity.interesse)) return false;
    if (filters.inscricoes && opportunityAvailability(opportunity) !== filters.inscricoes) return false;
    return true;
  });

  return rows.sort((a, b) => {
    if (sort === 'alfabetica') return String(a.titulo || '').localeCompare(String(b.titulo || ''), 'pt-BR');
    if (sort === 'prazo') return deadlineTime(a.prazo) - deadlineTime(b.prazo);
    return new Date(b._raw?.created_at || 0) - new Date(a._raw?.created_at || 0);
  });
}

export function useOpportunityFilters(opportunities, options = {}) {
  const [query, setQuery] = useState(options.initialQuery || '');
  const [filters, setFilters] = useState(emptyOpportunityFilters);
  const [sort, setSort] = useState(options.initialSort || 'recentes');
  const rows = useMemo(
    () => filterAndSortOpportunities(opportunities, query, filters, sort),
    [opportunities, query, filters, sort],
  );
  const activeCount = filters.tipo.length + filters.nivel.length
    + filters.custo.length + filters.interesse.length + (filters.inscricoes ? 1 : 0);
  const toggle = (key, value) => setFilters((current) => ({
    ...current,
    [key]: current[key].includes(value)
      ? current[key].filter((item) => item !== value)
      : current[key].concat(value),
  }));
  const radio = (key, value) => setFilters((current) => ({ ...current, [key]: value }));
  const clear = () => { setQuery(''); setFilters(emptyOpportunityFilters()); };
  return { query, setQuery, filters, setFilters, sort, setSort, rows, activeCount, toggle, radio, clear };
}

function FilterDropdown({ definition, controller, openKey, setOpenKey }) {
  const open = openKey === definition.key;
  const ref = useRef(null);
  useEffect(() => {
    if (!open) return undefined;
    const close = (event) => { if (ref.current && !ref.current.contains(event.target)) setOpenKey(null); };
    document.addEventListener('mousedown', close);
    return () => document.removeEventListener('mousedown', close);
  }, [open, setOpenKey]);

  const selected = definition.type === 'radio'
    ? (controller.filters[definition.key] ? 1 : 0)
    : controller.filters[definition.key].length;
  return (
    <div className="opp-filter-dropdown" ref={ref}>
      <button type="button" className="opp-filter-trigger" data-active={selected > 0 || open} onClick={() => setOpenKey(open ? null : definition.key)}>
        {definition.label}
        {selected > 0 && <span>{selected}</span>}
        <i data-open={open}>{Ic('chevron-down', 'ico-xs')}</i>
      </button>
      {open && (
        <div className="opp-filter-menu">
          {definition.type === 'radio' ? (
            <div className="opp-filter-radio">
              {definition.options.map((option) => {
                const active = controller.filters[definition.key] === option;
                return <button type="button" key={option} data-active={active} onClick={() => controller.radio(definition.key, active ? null : option)}>{option}</button>;
              })}
            </div>
          ) : (
            <div className="opp-filter-checks">
              {definition.options.map((option) => (
                <Checkbox key={option} label={<span>{option}</span>} checked={controller.filters[definition.key].includes(option)} onChange={() => controller.toggle(definition.key, option)} />
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export function OpportunityFilters({
  controller,
  total,
  placeholder = 'Buscar oportunidade…',
  compact = false,
  showCount = true,
  children,
}) {
  const [openKey, setOpenKey] = useState(null);
  const resultCount = controller.rows.length;
  const opportunityLabel = resultCount === 1 ? 'oportunidade' : 'oportunidades';
  const filterLabel = controller.activeCount === 1 ? 'filtro' : 'filtros';
  return (
    <div className={`opportunity-filter-suite${compact ? ' opportunity-filter-suite--compact' : ''}`}>
      <div className="opportunity-filter-search">
        <Input placeholder={placeholder} icon={Ic('search', 'ico-sm')} value={controller.query} onChange={(event) => controller.setQuery(event.target.value)} />
        <div className="opportunity-filter-sort">
          <Select value={controller.sort} onChange={(event) => controller.setSort(event.target.value)}>
            <option value="recentes">Mais recentes</option>
            <option value="prazo">Prazo mais próximo</option>
            <option value="alfabetica">Ordem alfabética</option>
          </Select>
        </div>
      </div>
      <div className="opportunity-filter-bar">
        <span className="opportunity-filter-label">{Ic('sliders-horizontal', 'ico-sm')} Filtros</span>
        {D.filters.map((definition) => (
          <FilterDropdown key={definition.key} definition={definition} controller={controller} openKey={openKey} setOpenKey={setOpenKey} />
        ))}
        {(controller.activeCount > 0 || controller.query) && <button type="button" className="opportunity-filter-clear" onClick={controller.clear}>Limpar filtros</button>}
        {children}
      </div>
      {showCount && <div className="opportunity-filter-count">{resultCount} de {total ?? resultCount} {opportunityLabel}{controller.activeCount ? ` · ${controller.activeCount} ${filterLabel}` : ''}</div>}
    </div>
  );
}
