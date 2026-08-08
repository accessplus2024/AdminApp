import { describe, expect, test } from 'bun:test';
import { normalizeTagNames, tagSlug } from './tags';

describe('opportunity tags', () => {
  test('normaliza slugs em português', () => {
    expect(tagSlug('Ciência Política')).toBe('ciencia-politica');
    expect(tagSlug('  Projeto de lei  ')).toBe('projeto-de-lei');
  });

  test('remove tags vazias e duplicadas sem perder a grafia canônica', () => {
    expect(normalizeTagNames(['Pesquisa', ' pesquisa ', '', 'Liderança']))
      .toEqual(['Pesquisa', 'Liderança']);
  });
});
