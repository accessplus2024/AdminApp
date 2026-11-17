import { describe, expect, test } from 'bun:test';
import {
  isRecentlyFeatured, lastFeaturedFromRows, newsletterIneligibilityReasons, opportunityToNewsletterEntry,
  saveNewsletterIssueWith,
} from './newsletterRecords.js';

const today = new Date(2026, 10, 7); // 7 de novembro de 2026
const row = {
  id: 7, title: 'Prêmio X', status: 'Aprovada', qualification_status: 'qualified',
  deadline: '20 de dezembro de 2026', description: 'Descrição do catálogo.', eligibility: 'Ter 15 anos',
  cost: 'Gratuito', link: 'https://x.org',
};

describe('newsletter selection rules (shared by the Newsletter screen and the MCP server)', () => {
  test('accepts an approved opportunity with a deadline inside the window', () => {
    expect(newsletterIneligibilityReasons(row, null, today)).toEqual([]);
  });

  test('rejects not approved, unqualified, out-of-window and recently sent opportunities', () => {
    expect(newsletterIneligibilityReasons({ ...row, status: 'Revisar' }, null, today)[0]).toContain('Aprovada');
    expect(newsletterIneligibilityReasons({ ...row, qualification_status: 'unqualified' }, null, today)[0]).toContain('não qualificada');
    expect(newsletterIneligibilityReasons({ ...row, deadline: '5 de janeiro de 2027' }, null, today)[0]).toContain('prazo');
    expect(newsletterIneligibilityReasons({ ...row, deadline: 'Inscrições contínuas' }, null, today)[0]).toContain('prazo');
    const sent = { date: '2026-06-01T12:00:00Z', title: 'Weekly Drop · 01 de jun.' };
    expect(newsletterIneligibilityReasons(row, sent, today)[0]).toContain('trava de 1 ano');
    expect(isRecentlyFeatured({ date: '2025-06-01T12:00:00Z' }, today.getTime())).toBe(false);
  });

  test('keeps the latest published date per opportunity', () => {
    const map = lastFeaturedFromRows([
      { opportunity_id: 7, issue: { title: 'A', published_at: '2026-01-01T00:00:00Z' } },
      { opportunity_id: 7, issue: { title: 'B', published_at: '2026-03-01T00:00:00Z' } },
    ]);
    expect(map[7]).toEqual({ date: '2026-03-01T00:00:00Z', title: 'B' });
  });

  test('maps a raw catalog row to an entry', () => {
    expect(opportunityToNewsletterEntry({ _raw: row }, 2)).toEqual({
      opportunity_id: 7, position: 2, title: 'Prêmio X', summary: 'Descrição do catálogo.',
      eligibility: 'Ter 15 anos', deadline: '20 de dezembro de 2026', fees: 'Gratuito', link: 'https://x.org',
    });
  });
});

function fakeSupabase() {
  const calls = [];
  const builder = (table) => {
    const op = { table, filters: [] };
    const chain = {
      insert(payload) { op.kind = 'insert'; op.payload = payload; return chain; },
      update(payload) { op.kind = 'update'; op.payload = payload; return chain; },
      delete() { op.kind = 'delete'; return chain; },
      eq(column, value) { op.filters.push([column, value]); return chain; },
      select() { return chain; },
      single() { calls.push(op); return Promise.resolve({ data: { id: 99, ...op.payload }, error: null }); },
      then(resolve) { calls.push(op); return Promise.resolve({ error: null }).then(resolve); },
    };
    return chain;
  };
  return { from: builder, calls };
}

describe('saveNewsletterIssueWith', () => {
  test('creates the issue and replaces its entries in order', async () => {
    const supabase = fakeSupabase();
    const entries = [opportunityToNewsletterEntry({ _raw: row }, 0), { ...opportunityToNewsletterEntry({ _raw: { ...row, id: 8 } }, 1), summary: 'Reescrito' }];
    const saved = await saveNewsletterIssueWith(supabase, { title: 'Weekly Drop · 07 de nov.', status: 'draft' }, entries);
    expect(saved.id).toBe(99);
    const [insertIssue, deleteEntries, insertEntries] = supabase.calls;
    expect(insertIssue).toMatchObject({ table: 'newsletter_issues', kind: 'insert' });
    expect(insertIssue.payload.campaign_slug).toBe('weekly-drop-07-de-nov');
    expect(deleteEntries).toMatchObject({ table: 'newsletter_entries', kind: 'delete', filters: [['newsletter_id', 99]] });
    expect(insertEntries.payload.map((entry) => [entry.opportunity_id, entry.position, entry.summary]))
      .toEqual([[7, 0, 'Descrição do catálogo.'], [8, 1, 'Reescrito']]);
  });
});
