// Parser leve pro formato de prazo que o Sentinel escreve no catálogo:
// "4 de setembro de 2026" (dia sem zero à esquerda, de mês de ano — ver
// api/sentinel.js#PORTUGUESE_MONTH_NAMES no backend, mesma convenção aqui).
// Devolve null pra qualquer coisa que não seja essa data completa —
// "Inscrições contínuas", mês isolado, ou texto vazio — de propósito: não dá
// pra comparar "próximo mês" com algo que não tem uma data de verdade.
function semAcento(value) {
  return String(value || '').normalize('NFD').replace(/[̀-ͯ]/g, '');
}

const MONTH_NUMBERS = {
  janeiro: 0, fevereiro: 1, marco: 2, abril: 3, maio: 4, junho: 5,
  julho: 6, agosto: 7, setembro: 8, outubro: 9, novembro: 10, dezembro: 11,
};
const MONTH_PATTERN = Object.keys(MONTH_NUMBERS).join('|');
const DEADLINE_PATTERN = new RegExp(`\\b(\\d{1,2})\\s+de\\s+(${MONTH_PATTERN})\\s+de\\s+(\\d{4})\\b`, 'i');

export function parseCatalogDeadline(value) {
  const text = semAcento(value).toLowerCase();
  const match = text.match(DEADLINE_PATTERN);
  if (!match) return null;
  const day = Number(match[1]);
  const month = MONTH_NUMBERS[match[2]];
  const year = Number(match[3]);
  if (month === undefined || !day || !year) return null;
  const date = new Date(year, month, day);
  return Number.isNaN(date.getTime()) ? null : date;
}

// true só quando o prazo é uma data de verdade dentro de [hoje, fim do
// próximo mês] — exclui prazo já vencido e prazo distante demais. Prazo sem
// data reconhecível (contínuo, "agosto de 2026" sem dia, vazio) devolve
// false: a newsletter é sobre urgência ("inscreva-se logo"), então uma
// oportunidade sem data clara não compete por esse espaço.
export function isDeadlineWithinNextMonth(value, today = new Date()) {
  const date = parseCatalogDeadline(value);
  if (!date) return false;
  const startOfToday = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  const endOfNextMonth = new Date(today.getFullYear(), today.getMonth() + 2, 0, 23, 59, 59, 999);
  return date >= startOfToday && date <= endOfNextMonth;
}
