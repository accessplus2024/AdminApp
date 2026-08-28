import { describe, expect, test } from 'bun:test';
import { parseOpportunityLocation } from './mapOpportunity';
import { serializeOpportunityLocation } from './opportunities';

describe('opportunity location', () => {
  test('não duplica local em oportunidades remotas', () => {
    expect(serializeOpportunityLocation({ formato: 'Remoto', local: 'Brasil' })).toBe('Remoto');
    expect(parseOpportunityLocation('Remoto')).toEqual({ formato: 'Remoto', local: '' });
  });

  test('preserva o local de experiências presenciais e híbridas', () => {
    expect(serializeOpportunityLocation({ formato: 'Presencial', local: 'Salvador, BA' }))
      .toBe('Presencial — Salvador, BA');
    expect(parseOpportunityLocation('Híbrido — São Paulo, SP'))
      .toEqual({ formato: 'Híbrido', local: 'São Paulo, SP' });
  });

  test('preserva uma cidade simples como local presencial', () => {
    expect(parseOpportunityLocation('São Paulo, SP')).toEqual({ formato: 'Presencial', local: 'São Paulo, SP' });
    expect(parseOpportunityLocation('Atividades presenciais em Recife')).toEqual({
      formato: 'Presencial', local: 'Atividades presenciais em Recife',
    });
  });
});
