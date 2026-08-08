import { describe, expect, test } from 'bun:test';
import { emptyOpportunityFilters, filterAndSortOpportunities } from './OpportunityFilters';
import { OPPORTUNITY_AVAILABILITY } from '../lib/opportunityAvailability';

const opportunities = [
  {
    id: 1, titulo: 'Programa Agosto', org: 'Org B', descricao: 'STEM', tipo: 'Mentorias',
    custo: 'Gratuito', prazo: '17 de agosto de 2026', nivel: ['Ensino Médio'],
    interesse: ['STEM'], inscricoesAbertas: true, tagsRelacionadas: [], _raw: { created_at: '2026-08-01' },
  },
  {
    id: 2, titulo: 'Bolsa Julho', org: 'Org A', descricao: 'Artes', tipo: 'Bolsas de Estudo',
    custo: 'Bolsa', prazo: '30 de julho de 2026', nivel: ['Gap'],
    interesse: ['Artes'], inscricoesAbertas: false, tagsRelacionadas: [], _raw: { created_at: '2026-08-02' },
  },
  {
    id: 3, titulo: 'Programa em revisão', org: 'Org C', descricao: 'Humanas', tipo: 'Mentorias',
    custo: 'Gratuito', prazo: '', nivel: ['Ensino Médio'],
    interesse: ['Humanas'], inscricoesAbertas: null, tagsRelacionadas: [], _raw: { created_at: '2026-08-03' },
  },
];

describe('filterAndSortOpportunities', () => {
  test('shares search and multi-filter semantics across screens', () => {
    const filters = emptyOpportunityFilters();
    filters.nivel = ['Ensino Médio'];
    const rows = filterAndSortOpportunities(opportunities, 'STEM', filters, 'recentes');
    expect(rows.map((row) => row.id)).toEqual([1]);
  });

  test('orders specific Brazilian deadlines chronologically', () => {
    const rows = filterAndSortOpportunities(opportunities, '', emptyOpportunityFilters(), 'prazo');
    expect(rows.map((row) => row.id)).toEqual([2, 1, 3]);
  });

  test('does not treat an editorial review state as closed applications', () => {
    const closedFilters = emptyOpportunityFilters();
    closedFilters.inscricoes = OPPORTUNITY_AVAILABILITY.CLOSED;
    expect(filterAndSortOpportunities(opportunities, '', closedFilters, 'recentes').map((row) => row.id)).toEqual([2]);

    const openFilters = emptyOpportunityFilters();
    openFilters.inscricoes = OPPORTUNITY_AVAILABILITY.OPEN;
    expect(filterAndSortOpportunities(opportunities, '', openFilters, 'recentes').map((row) => row.id)).toEqual([1]);
  });
});
