export const OPPORTUNITY_AVAILABILITY = {
  OPEN: 'Inscrições abertas',
  CLOSED: 'Inscrições encerradas',
  UNKNOWN: 'Disponibilidade não informada',
};

export function opportunityAvailability(opportunity) {
  if (opportunity?.inscricoesAbertas === true) return OPPORTUNITY_AVAILABILITY.OPEN;
  if (opportunity?.inscricoesAbertas === false) return OPPORTUNITY_AVAILABILITY.CLOSED;
  return OPPORTUNITY_AVAILABILITY.UNKNOWN;
}

export function availabilityVariant(opportunity) {
  const availability = opportunityAvailability(opportunity);
  if (availability === OPPORTUNITY_AVAILABILITY.OPEN) return 'success';
  if (availability === OPPORTUNITY_AVAILABILITY.CLOSED) return 'danger';
  return 'neutral';
}
