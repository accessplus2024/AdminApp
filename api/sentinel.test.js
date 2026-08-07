import { describe, expect, test } from 'bun:test';
import {
  canonicalizeOpportunityUrl, discoveryCandidateLimit, expiredStatusChange, extractAdjacentLinks, isDuplicateOpportunity,
  isPastDate, isPortugueseCatalogValue, normalizeDeadlineOutput, opportunityDiscoveryKey,
  parseDateParts, validateFieldEvidence,
} from './sentinel';

describe('discoveryCandidateLimit', () => {
  test('processa toda a fila em uma única execução quando solicitado', () => {
    expect(discoveryCandidateLimit({ allQueued: true, maxCandidates: 1 })).toBe(500);
  });

  test('mantém o limite legado para chamadas parciais', () => {
    expect(discoveryCandidateLimit({ maxCandidates: 100 })).toBe(25);
    expect(discoveryCandidateLimit({})).toBe(10);
  });
});

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

  test('deduplicates title variants for the same official opportunity', () => {
    const existing = {
      title: 'SDG Innovation Summit Malaysia 2026',
      link: 'https://thegyn.org/sism-2026/',
    };
    const extracted = {
      title: 'SDG Innovation Summit Malaysia 2026 – Fully Funded Conference',
      link: 'https://www.thegyn.org/sism-2026/?utm_source=instagram',
    };
    expect(canonicalizeOpportunityUrl(extracted.link)).toBe('https://thegyn.org/sism-2026');
    expect(isDuplicateOpportunity(existing, extracted)).toBe(true);
    expect(opportunityDiscoveryKey(existing.link, existing.title)).toBe(opportunityDiscoveryKey(extracted.link, extracted.title));
  });

  test('allows distinct programs to share an organization landing page', () => {
    expect(isDuplicateOpportunity({
      title: 'Campeonato Nacional de Debates Escolares', link: 'https://instagram.com/ibdebates',
    }, {
      title: 'USP Schools', link: 'https://instagram.com/ibdebates/',
    })).toBe(false);
  });
});
