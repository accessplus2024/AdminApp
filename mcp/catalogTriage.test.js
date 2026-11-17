import { describe, expect, test } from 'bun:test';
import { refreshBucket, triageCatalog, windowEnd } from './catalogTriage.js';

const today = new Date(2026, 10, 16); // 16 Nov 2026 -> janela até 31 Dez 2026

describe('catalog refresh triage', () => {
  test('window ends at the end of next month', () => {
    expect(windowEnd(today).toISOString().slice(0, 10)).toBe('2026-12-31');
  });

  test('buckets deadlines by how likely a review lands them in the window', () => {
    expect(refreshBucket('13 de dezembro de 2026', today)).toBe('in_window');
    expect(refreshBucket('', today)).toBe('empty');
    expect(refreshBucket(null, today)).toBe('empty');
    expect(refreshBucket('Inscrições contínuas', today)).toBe('rolling');
    expect(refreshBucket('Dezembro', today)).toBe('month_in_window');
    expect(refreshBucket('novembro', today)).toBe('month_in_window');
    expect(refreshBucket('Janeiro', today)).toBe('month_soon');
    expect(refreshBucket('Junho', today)).toBe('month_later');
    expect(refreshBucket('5 de Dezembro', today)).toBe('month_in_window');
    expect(refreshBucket('anual', today)).toBe('empty');
    // Último ciclo fechou em dezembro/2025 -> próximo deve ser dezembro/2026.
    expect(refreshBucket('5 de dezembro de 2025', today)).toBe('past_cycle_due');
    // Janeiro do ano que vem ainda entra na folga.
    expect(refreshBucket('10 de janeiro de 2026', today)).toBe('past_cycle_due');
    expect(refreshBucket('30 de abril de 2026', today)).toBe('past_later');
    expect(refreshBucket('15 de março de 2027', today)).toBe('future_beyond_window');
  });

  test('orders the most promising buckets first and counts them', () => {
    const result = triageCatalog([
      { id: 1, deadline: '30 de abril de 2026' },
      { id: 2, deadline: '' },
      { id: 3, deadline: 'Dezembro' },
    ], today);
    expect(result.items.map((item) => item.id)).toEqual([3, 2, 1]);
    expect(result.counts.month_in_window).toBe(1);
    expect(result.counts.past_later).toBe(1);
  });
});
