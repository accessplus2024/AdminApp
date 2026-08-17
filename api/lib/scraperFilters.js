// api/lib/scraperFilters.js
//
// Regras de filtro (ported 1:1 from the old Python sources/scrape.py). Pure functions,
// no network — easy to unit test, which matters because this is exactly the kind of
// logic that breaks silently (a word list edit that accidentally excludes everything).

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

// true se algum termo aparece como PALAVRA inteira ("teen" não casa "eighteen"/"canteen").
export function batePalavras(texto, termos) {
  const t = String(texto || '').toLowerCase();
  for (const termoBruto of termos || []) {
    const termo = String(termoBruto || '').toLowerCase().trim();
    if (!termo) continue;
    const re = new RegExp(`(?<![a-z0-9])${escapeRegExp(termo)}(?![a-z0-9])`);
    if (re.test(t)) return true;
  }
  return false;
}

// Restrição de NACIONALIDADE, sem lista de países: aceita Brasil/América Latina/global,
// só corta quando há trava explícita ("citizens only", "must be a resident"...).
export function restritoAOutroPais(texto, filtros) {
  const t = String(texto || '').toLowerCase();
  if (filtros.aceitarNacionalidade && batePalavras(t, filtros.aceitarNacionalidade)) return false;
  const padroes = [
    /\bmust be (?:a |an )?(?:citizen|permanent resident|resident|national)\b/,
    /\b(?:citizens?|nationals?|residents?)\s+only\b/,
    /(?:open only to|only open to|restricted to|exclusively for|reserved for|only for)\s+(?:\w+\s+){0,3}(?:citizens?|nationals?|residents?)\b/,
  ];
  return padroes.some((p) => p.test(t));
}

// Filtro completo de elegibilidade (só para fontes tipo 'feed'). `item` = { texto }.
// Devolve { passou, motivo }.
export function passaFiltro(item, filtros) {
  const texto = item?.texto || '';

  if (filtros.excluir && batePalavras(texto, filtros.excluir)) {
    return { passou: false, motivo: 'excluído (nível superior / profissional)' };
  }
  if (restritoAOutroPais(texto, filtros)) {
    return { passou: false, motivo: 'excluído (restrito a nacionalidade de outro país)' };
  }

  const checagens = [];
  if (filtros.exigirNivel !== false) {
    const forte = batePalavras(texto, filtros.nivelForte || []);
    const fraco = batePalavras(texto, filtros.nivelFraco || []);
    const adulto = batePalavras(texto, filtros.adultoMarcadores || []);
    checagens.push(['nível', forte || (fraco && !adulto)]);
  }
  if (filtros.exigirFinanceiro !== false) {
    checagens.push(['financeiro', batePalavras(texto, filtros.financeiro || [])]);
  }
  if (filtros.exigirInternacional) {
    checagens.push(['internacional', batePalavras(texto, filtros.internacional || [])]);
  }

  const faltou = checagens.filter(([, ok]) => !ok).map(([nome]) => nome);
  return { passou: faltou.length === 0, motivo: faltou.length ? `faltou: ${faltou.join(', ')}` : 'ok' };
}

// Só palavras de ligação, sem nenhum peso próprio (nunca vão ser o que
// diferencia um título de outro) — bem menor que a lista antiga de propósito:
// uma lista grande de palavras "genéricas" (que incluía coisas como o ano e
// "scholarship"/"olympiad") tirava informação que às vezes É o que diferencia
// duas oportunidades DIFERENTES (ex.: a mesma olimpíada em 2025 e em 2026
// virava o MESMO slug, e a edição nova era silenciosamente descartada como se
// já existisse).
const SLUG_STOP = new Set(['the', 'a', 'an', 'of', 'for', 'and', 'to', 'in', 'on', 'at', 'de', 'da', 'do', 'dos', 'das', 'e', 'o', 'os', 'as', 'um', 'uma']);

// Título normalizado (sem acento, sem pontuação, tokens únicos em ordem
// alfabética) — usado só pra pegar o caso mais simples de duplicata: o MESMO
// título (ou quase) aparecendo em fontes diferentes, ou reaparecendo depois.
// De propósito bem simples e barato (só string, sem IA, sem rede): não
// pretende pegar títulos reescritos de formas muito diferentes — esses ainda
// são pegos depois, na pesquisa (fase 2), pelo dedup de verdade que a IA já
// faz contra o catálogo.
export function slugTitulo(titulo) {
  const semAcento = String(titulo || '')
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .toLowerCase();
  const soLetrasNumeros = semAcento.replace(/[^a-z0-9 ]/g, ' ');
  const tokens = soLetrasNumeros
    .split(/\s+/)
    .filter((w) => w && w.length > 1 && !SLUG_STOP.has(w));
  return [...new Set(tokens)].sort().join(' ');
}

