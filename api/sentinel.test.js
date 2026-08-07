import { describe, expect, test } from 'bun:test';
import {
  expiredStatusChange, extractAdjacentLinks, isPastDate, isPortugueseCatalogValue, normalizeDeadlineOutput,
  parseDateParts, validateFieldEvidence,
} from './sentinel';

describe('Sentinel catalog evidence validation', () => {
  test('formats Portuguese dates without a leading zero', () => {
    expect(normalizeDeadlineOutput('04 de setembro de 2026')).toBe('4 de setembro de 2026');
    expect(normalizeDeadlineOutput('14 de novembro de 2026')).toBe('14 de novembro de 2026');
  });

  test('rejects an event date presented as an application deadline', () => {
    const quote = 'BMT 2026 will be held on November 14, 2026';
    const result = validateFieldEvidence('deadline', '14 de novembro de 2026', {
      quote, source_url: 'https://bmt.berkeley.edu/', kind: 'application_deadline',
    }, [{ url: 'https://bmt.berkeley.edu/', text: quote }]);
    expect(result.valid).toBe(false);
    expect(result.reason).toContain('não um prazo');
  });

  test('accepts a literal deadline citation whose edition year appears earlier', () => {
    const quote = 'GENIUS 2026 extended application deadline is March 7 at 9:00 AM (U.S. EST)';
    const result = validateFieldEvidence('deadline', '07 de março de 2026', {
      quote, source_url: 'https://geniusolympiad.org/apply', kind: 'application_deadline',
    }, [{ url: 'https://geniusolympiad.org/apply', text: `News: ${quote}.` }]);
    expect(result.valid).toBe(true);
    expect(parseDateParts(quote)).toEqual({ day: 7, month: 3, year: 2026 });
    expect(isPastDate('07 de março de 2026', new Date('2026-08-07T12:00:00Z'))).toBe(true);
    expect(expiredStatusChange('07 de março de 2026', 'Aprovada', new Date('2026-08-07T12:00:00Z'))).toEqual({
      before: 'Aprovada', after: 'Encerrada',
    });
  });

  test('requires catalog values to be translated to Portuguese', () => {
    expect(isPortugueseCatalogValue('cost', '$60 application fee per project')).toBe(false);
    expect(isPortugueseCatalogValue('cost', 'Taxa de inscrição de US$ 60 por projeto')).toBe(true);
  });

  test('prioritizes adjacent application and deadline pages', () => {
    const links = extractAdjacentLinks(`
      <a href="/event">Event</a>
      <a href="https:&#x2F;&#x2F;example.org&#x2F;apply">Apply now</a>
      <a href="/important-dates">Important dates and registration deadlines</a>
      <a href="/event-logistics">Tournament day logistics</a>
    `, 'https://example.org/program');
    expect(links.map((link) => link.url)).toEqual([
      'https://example.org/important-dates',
      'https://example.org/apply',
    ]);
  });
});
