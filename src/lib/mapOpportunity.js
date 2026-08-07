// Tradutor: linha do Supabase (colunas em INGLES) -> formato que as telas do
// AdminApp ja esperam (chaves em PORTUGUES). Assim nao precisamos reescrever
// nenhuma tela — so alimentamos o mesmo formato de sempre.
// -----------------------------------------------------------------------------
// Regra de ouro: SEMPRE devolver os tipos certos (string vs array), com valores
// padrao seguros, pra nenhuma tela quebrar (ex.: filtros chamam .toLowerCase()
// no titulo/org e .includes() nos arrays).

const arr = (v) => (Array.isArray(v) ? v.filter((x) => x != null && `${x}`.trim()) : (v ? [v] : []));
const str = (v) => (v == null ? '' : `${v}`);
// Primeira letra maiúscula (ex.: "anual" -> "Anual"). Vazio continua vazio.
const cap = (v) => { const s = str(v).trim(); return s ? s.charAt(0).toUpperCase() + s.slice(1) : ''; };

// status do banco (Aprovada/Revisar) -> rotulo visual do painel.
const STATUS_UI = {
  Aprovada: 'Publicada',
  Revisar: 'Em revisão',
  Rascunho: 'Rascunho',
  Encerrada: 'Inscrições encerradas',
};

// resources (jsonb) do banco -> recursos que a tela de detalhe mostra.
// Formato do banco (do scraper): { label, platform, url, status }
// Formato da tela:               { plataforma, titulo, meta }
function mapResources(resources) {
  if (!Array.isArray(resources)) return [];
  return resources.map((r) => ({
    plataforma: str(r.platform || r.plataforma).toLowerCase(),
    titulo: str(r.label || r.titulo || r.title),
    meta: str(r.url || r.meta || ''),
  }));
}

// Quebra um texto corrido em itens (por linha, ou por frase) pra listas da UI.
function toLista(texto) {
  const t = str(texto).trim();
  if (!t) return [];
  const linhas = t.split(/\r?\n/).map((s) => s.trim()).filter(Boolean);
  return linhas.length > 1 ? linhas : [t];
}

export function mapOpportunity(row) {
  const status = str(row.status);
  return {
    // identidade
    id: row.id,

    // textos principais
    titulo: str(row.title),
    org: str(row.location) || '',          // a base nao tem "organizacao"; usa local se houver
    descricao: str(row.description),
    link: str(row.link),                   // URL da oportunidade
    lingua: str(row.language),             // lingua exigida (campo unico no banco)

    // classificacao (arrays garantidos)
    tipo: str(row.type),
    nivel: arr(row.level),                 // text[]
    publico: arr(row.audience),            // text[]
    interesse: arr(row.areas),             // text[]  (as "areas de atuacao")
    areaAtuacao: arr(row.areas).join(', '),
    custo: str(row.cost),

    // logistica
    formato: str(row.location),            // Remoto / Presencial / Hibrido
    local: str(row.location),
    prazo: cap(row.deadline),              // '' quando não há prazo

    // status / estado
    status: STATUS_UI[status] || status || 'Rascunho',
    // Disponibilidade não é o mesmo que fluxo editorial. Itens em revisão
    // ficam sem disponibilidade conhecida, em vez de serem tratados como fechados.
    inscricoesAbertas: status === 'Aprovada' ? true : status === 'Encerrada' ? false : null,
    destaque: false,

    // detalhe
    elegibilidade: toLista(row.eligibility),
    processo: str(row.process),
    dicas: toLista(row.applicants),        // "dicas de contemplados"
    infoAdicional: str(row.additionals),
    recursos: mapResources(row.resources),
    tagsRelacionadas: arr(row.keywords),

    // comentarios ainda nao existem no banco (feature futura)
    comentarios: [],

    // guarda o registro cru, caso alguma tela precise de um campo original
    _raw: row,
  };
}

export function mapOpportunities(rows) {
  return Array.isArray(rows) ? rows.map(mapOpportunity) : [];
}
