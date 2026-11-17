// mcp/catalogTriage.js
//
// Triagem barata (sem rede, sem modelo) do catálogo para a newsletter: separa
// as oportunidades por "situação do prazo" e ordena pelas que têm mais chance
// de cair na janela da newsletter (hoje até o fim do próximo mês) depois de
// uma revisão. Serve para o agente escolher ONDE gastar uma revisão completa
// (cada uma despeja as fontes inteiras no contexto) em vez de revisar tudo.
import { isDeadlineWithinNextMonth, isRollingDeadline, parseCatalogDeadline } from '../src/lib/deadline.js';

const MONTHS = ['janeiro', 'fevereiro', 'marco', 'abril', 'maio', 'junho', 'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro'];
const DAY_MS = 24 * 60 * 60 * 1000;

// Quanto além do fim da janela ainda vale olhar: um prazo de meados de janeiro
// no ciclo passado costuma voltar com data parecida, e às vezes antes.
const NEXT_CYCLE_SLACK_DAYS = 45;

// Ordem de prioridade: quanto menor, mais provável render uma candidata.
export const REFRESH_BUCKETS = {
  month_in_window: { rank: 0, hint: 'Prazo só com o mês, e esse mês cai na janela: falta só confirmar o dia/ano.' },
  past_cycle_due: { rank: 1, hint: 'Prazo do ciclo passado; o próximo ciclo, na mesma época, cai na janela ou logo depois.' },
  empty: { rank: 2, hint: 'Sem prazo cadastrado.' },
  month_soon: { rank: 3, hint: 'Prazo só com o mês, nos dois meses seguintes à janela.' },
  rolling: { rank: 4, hint: 'Inscrições contínuas: só entra na newsletter se a fonte trouxer uma data.' },
  month_later: { rank: 5, hint: 'Prazo só com o mês, longe da janela.' },
  past_later: { rank: 6, hint: 'Prazo passado; o próximo ciclo deve cair bem depois da janela.' },
  future_beyond_window: { rank: 7, hint: 'Prazo futuro depois da janela: não está desatualizado.' },
  in_window: { rank: 8, hint: 'Já está na janela (já é candidata, se as outras regras passarem).' },
};

const plain = (value) => String(value || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim();

export function windowEnd(today = new Date()) {
  return new Date(today.getFullYear(), today.getMonth() + 2, 0, 23, 59, 59, 999);
}

// Mês sem ano ("Junho", "5 de Outubro"): o dia não muda a triagem.
function monthOnly(value) {
  const text = plain(value);
  if (/\b(19|20)\d{2}\b/.test(text)) return null;
  const index = MONTHS.findIndex((month) => new RegExp(`\\b${month}\\b`).test(text));
  return index === -1 ? null : index;
}

// Distância em meses (0..11) de `today` até a próxima ocorrência do mês dado.
function monthsAhead(month, today) {
  return (month - today.getMonth() + 12) % 12;
}

export function refreshBucket(deadline, today = new Date()) {
  if (!deadline || !String(deadline).trim()) return 'empty';
  if (isRollingDeadline(deadline)) return 'rolling';
  const date = parseCatalogDeadline(deadline);
  if (date) {
    if (isDeadlineWithinNextMonth(deadline, today)) return 'in_window';
    const end = windowEnd(today);
    if (date > end) return 'future_beyond_window';
    // Prazo passado: projeta a mesma data nos anos seguintes até passar de hoje.
    const next = new Date(date);
    while (next < today) next.setFullYear(next.getFullYear() + 1);
    return next.getTime() <= end.getTime() + NEXT_CYCLE_SLACK_DAYS * DAY_MS ? 'past_cycle_due' : 'past_later';
  }
  const month = monthOnly(deadline);
  if (month === null) return /continu|rolling/.test(plain(deadline)) ? 'rolling' : 'empty';
  const ahead = monthsAhead(month, today);
  if (ahead <= 1) return 'month_in_window';
  if (ahead <= 3) return 'month_soon';
  return 'month_later';
}

export function triageCatalog(rows = [], today = new Date()) {
  const items = rows.map((row) => ({ ...row, bucket: refreshBucket(row.deadline, today) }));
  items.sort((a, b) => REFRESH_BUCKETS[a.bucket].rank - REFRESH_BUCKETS[b.bucket].rank || Number(b.id) - Number(a.id));
  const counts = Object.fromEntries(Object.keys(REFRESH_BUCKETS).map((bucket) => [bucket, 0]));
  for (const item of items) counts[item.bucket] += 1;
  return { window_end: windowEnd(today).toISOString().slice(0, 10), counts, items };
}
