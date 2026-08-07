import { describe, expect, test } from 'bun:test';
import { buildCitationUrl } from './citationUrl';

describe('buildCitationUrl', () => {
  test('links directly to the quoted text on its source page', () => {
    expect(buildCitationUrl(
      'https://example.org/apply',
      'Applications close on 17 August 2026',
    )).toBe('https://example.org/apply#:~:text=Applications%20close%20on%2017%20August%202026');
  });

  test('preserves a source page anchor before the text fragment', () => {
    expect(buildCitationUrl(
      'https://example.org/rules#deadlines',
      'Submit by September 4, 2026',
    )).toBe('https://example.org/rules#deadlines:~:text=Submit%20by%20September%204%2C%202026');
  });

  test('falls back to the source page when no quote is available', () => {
    expect(buildCitationUrl('https://example.org/rules', '')).toBe('https://example.org/rules');
  });
});
