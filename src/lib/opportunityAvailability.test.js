import { describe, expect, test } from 'bun:test';
import { mapOpportunity } from './mapOpportunity';
import { formParaLinha } from './opportunities';
import { OPPORTUNITY_AVAILABILITY, opportunityAvailability } from './opportunityAvailability';

const row = (status) => ({
  id: 1, title: 'Programa', status, type: 'Mentorias', areas: [], level: [], audience: [], keywords: [], resources: [],
});

describe('opportunity availability normalization', () => {
  test('maps only explicit catalog states to open or closed availability', () => {
    const open = mapOpportunity(row('Aprovada'));
    const closed = mapOpportunity(row('Encerrada'));
    const review = mapOpportunity(row('Revisar'));

    expect(opportunityAvailability(open)).toBe(OPPORTUNITY_AVAILABILITY.OPEN);
    expect(opportunityAvailability(closed)).toBe(OPPORTUNITY_AVAILABILITY.CLOSED);
    expect(closed.status).toBe(OPPORTUNITY_AVAILABILITY.CLOSED);
    expect(opportunityAvailability(review)).toBe(OPPORTUNITY_AVAILABILITY.UNKNOWN);
  });

  test('persists the editor availability switch when publishing', () => {
    expect(formParaLinha({ inscricoesAbertas: true }, 'Publicada').status).toBe('Aprovada');
    expect(formParaLinha({ inscricoesAbertas: false }, 'Publicada').status).toBe('Encerrada');
    expect(formParaLinha({ inscricoesAbertas: false }, 'Rascunho').status).toBe('Revisar');
  });
});
