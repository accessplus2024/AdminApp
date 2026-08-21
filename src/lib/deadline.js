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

// Nomes de mês na mesma convenção que o Sentinel escreve (sem acento na
// chave, com acento no texto exibido) — usado para converter a data do
// <input type="date"> de volta pro formato "D de mês de YYYY" do catálogo.
const MONTH_NAMES_PT = [
  'janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho',
  'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro',
];

// Date -> "4 de setembro de 2026" (mesmo formato que o Sentinel escreve).
export function formatCatalogDeadline(date) {
  if (!(date instanceof Date) || Number.isNaN(date.getTime())) return '';
  const day = date.getDate();
  const month = MONTH_NAMES_PT[date.getMonth()];
  const year = date.getFullYear();
  return `${day} de ${month} de ${year}`;
}

// "4 de setembro de 2026" -> "2026-09-04" (formato que <input type="date">
// espera). Devolve '' quando o prazo não é uma data completa reconhecível
// (ex.: "Inscrições contínuas", texto livre antigo, vazio).
export function catalogDeadlineToInputValue(value) {
  const date = parseCatalogDeadline(value);
  if (!date) return '';
  const y = String(date.getFullYear()).padStart(4, '0');
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

// "2026-09-04" (valor do <input type="date">) -> "4 de setembro de 2026".
export function inputValueToCatalogDeadline(value) {
  const match = String(value || '').match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!match) return '';
  const [, y, m, d] = match;
  return formatCatalogDeadline(new Date(Number(y), Number(m) - 1, Number(d)));
}

// Texto usado pra prazo de inscrição contínua/rolante — a única exceção sem
// data completa que o Sentinel também aceita (ver isAcceptableDeadlineOutput
// em api/sentinel.js).
export const ROLLING_DEADLINE_TEXT = 'Inscrições contínuas';
export const isRollingDeadline = (value) => semAcento(value).trim().toLowerCase() === semAcento(ROLLING_DEADLINE_TEXT).toLowerCase();

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
