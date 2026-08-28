import { describe, expect, test } from 'bun:test';
import { mapOpportunity } from './mapOpportunity';
import { formParaLinha } from './opportunities';
import { OPPORTUNITY_AVAILABILITY, opportunityAvailability } from './opportunityAvailability';

const row = (extra) => ({
  id: 1, title: 'Programa', type: 'Mentorias', areas: [], level: [], keywords: [], resources: [], ...extra,
});

describe('opportunity availability normalization', () => {
  test('reads availability from the inscricoes column', () => {
    expect(opportunityAvailability(mapOpportunity(row({ inscricoes: 'Aberta' }))))
      .toBe(OPPORTUNITY_AVAILABILITY.OPEN);
    expect(opportunityAvailability(mapOpportunity(row({ inscricoes: 'Encerrada' }))))
      .toBe(OPPORTUNITY_AVAILABILITY.CLOSED);
    expect(opportunityAvailability(mapOpportunity(row({}))))
      .toBe(OPPORTUNITY_AVAILABILITY.UNKNOWN);
  });

  test('status and qualification never decide availability', () => {
    // Publicada com o prazo já vencido: continua no catálogo, mas fechada.
    expect(opportunityAvailability(mapOpportunity(row({ status: 'Aprovada', inscricoes: 'Encerrada' }))))
      .toBe(OPPORTUNITY_AVAILABILITY.CLOSED);
    // Ainda em revisão, mas as inscrições estão de fato abertas.
    expect(opportunityAvailability(mapOpportunity(row({ status: 'Revisar', inscricoes: 'Aberta' }))))
      .toBe(OPPORTUNITY_AVAILABILITY.OPEN);
    // qualification_status é só elegibilidade de brasileiros, não disponibilidade.
    expect(opportunityAvailability(mapOpportunity(row({ inscricoes: 'Aberta', qualification_status: 'unqualified' }))))
      .toBe(OPPORTUNITY_AVAILABILITY.OPEN);
  });

  test('the editor switch writes inscricoes, and publishing alone never closes it', () => {
    expect(formParaLinha({ inscricoesAbertas: true }, 'Publicada')).toMatchObject({
      status: 'Aprovada', inscricoes: 'Aberta',
    });
    // Desligar o switch fecha as inscrições SEM despublicar a oportunidade.
    expect(formParaLinha({ inscricoesAbertas: false }, 'Publicada')).toMatchObject({
      status: 'Aprovada', inscricoes: 'Encerrada',
    });
    expect(formParaLinha({ inscricoesAbertas: true }, 'Rascunho')).toMatchObject({
      status: 'Revisar', inscricoes: 'Aberta',
    });
  });
});
