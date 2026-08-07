import { describe, expect, test } from 'bun:test';
import { serializeResearchEdits } from './sentinel';

describe('serializeResearchEdits', () => {
  test('converte campos de lista e preserva textos editados', () => {
    expect(serializeResearchEdits({
      areas: 'STEM\nArtes',
      eligibility: 'Ter de 14 a 18 anos\nMorar no Brasil',
      title: 'Novo título',
    })).toEqual({
      areas: ['STEM', 'Artes'],
      eligibility: 'Ter de 14 a 18 anos\nMorar no Brasil',
      title: 'Novo título',
    });
  });

  test('permite limpar uma lista selecionada', () => {
    expect(serializeResearchEdits({ audience: '' })).toEqual({ audience: [] });
  });
});
