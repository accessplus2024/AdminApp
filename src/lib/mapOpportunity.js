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

// Disponibilidade vem da coluna `inscricoes` ('Aberta' | 'Encerrada'): é ela
// que diz se dá pra se inscrever (Aberta) ou se o prazo já passou (Encerrada).
// Não confundir com qualification_status, que só diz se jovens brasileiros
// são elegíveis — isso é para o Sentinel decidir, não é disponibilidade.
function mapInscricoes(row) {
  const valor = str(row.inscricoes).trim().toLowerCase();
  if (valor === 'aberta') return true;
  if (valor === 'encerrada') return false;
  return null;
}

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
    descricao: str(row.description),
    link: str(row.link),                   // URL da oportunidade
    lingua: str(row.language),             // lingua exigida (campo unico no banco)

    // classificacao (arrays garantidos)
    tipo: str(row.type),
    nivel: arr(row.level),                 // text[]
    interesse: arr(row.areas),             // text[]  (as "areas de atuacao")
    areaAtuacao: arr(row.areas).join(', '),
    publicoAlvo: arr(row.audience),        // text[]  (publico-alvo)
    custo: str(row.cost),

    // logistica
    local: str(row.location),
    prazo: cap(row.deadline),              // '' quando não há prazo

    // status / estado
    status: STATUS_UI[status] || status || 'Rascunho',
    // Disponibilidade é um campo próprio (`inscricoes`), independente do fluxo
    // editorial: uma oportunidade publicada pode estar com inscrições
    // encerradas, e uma em revisão pode estar com inscrições abertas.
    inscricoesAbertas: mapInscricoes(row),
    destaque: false,

    // detalhe
    elegibilidade: toLista(row.eligibility),
    processo: str(row.process),
    dicas: toLista(row.applicants),        // "dicas de contemplados"
    infoAdicional: str(row.additionals),
    recursos: mapResources(row.resources),
    tagsRelacionadas: arr(row.keywords),
    qualificacao: str(row.qualification_status) || 'pending',
    motivoQualificacao: str(row.qualification_reason),

    // comentarios ainda nao existem no banco (feature futura)
    comentarios: [],

    // guarda o registro cru, caso alguma tela precise de um campo original
    _raw: row,
  };
}

export function mapOpportunities(rows) {
  return Array.isArray(rows) ? rows.map(mapOpportunity) : [];
}
