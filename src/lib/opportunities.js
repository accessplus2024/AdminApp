// Leitura E escrita das oportunidades no Supabase (com traducao pro formato da UI).
import { supabase, isSupabaseConfigured } from './supabase';
import { mapOpportunities, mapOpportunity } from './mapOpportunity';

// ---------------------------------------------------------------------------
// LEITURA
// ---------------------------------------------------------------------------
const OPPORTUNITY_SELECT = [
  'id', 'title', 'description', 'link', 'deadline', 'areas', 'level', 'location',
  'audience', 'cost', 'language', 'keywords', 'eligibility', 'process', 'applicants',
  'additionals', 'resources', 'status', 'review', 'created_at', 'type',
  'sentinel_discovery_key', 'qualification_status', 'qualification_reason',
].join(',');

export async function fetchOpportunities({ throwOnError = false } = {}) {
  if (!isSupabaseConfigured) return [];
  const { data, error } = await supabase
    .from('opportunities')
    .select(OPPORTUNITY_SELECT)
    .order('created_at', { ascending: false });
  if (error) {
    if (throwOnError) throw new Error(error.message);
    console.error('[Access+] Erro ao ler oportunidades do Supabase:', error.message);
    return [];
  }
  return mapOpportunities(data);
}

// ---------------------------------------------------------------------------
// TRADUCAO REVERSA: formulario do editor (PT) -> linha do banco (colunas EN)
// ---------------------------------------------------------------------------
const splitCommas = (s) => String(s || '').split(',').map((x) => x.trim()).filter(Boolean);

export function serializeOpportunityLocation(form = {}) {
  const format = String(form.formato || '').trim();
  const place = String(form.local || '').trim();
  if (/^(?:remoto|online)$/i.test(format)) return 'Remoto';
  if (!format) return place || null;
  return place ? [format, place].join(' — ') : format;
}

// status da UI ('Publicada'/'Rascunho'/'Aprovada'/'Em revisão') -> status do banco.
function statusParaBanco(ui, inscricoesAbertas) {
  if (ui === 'Publicada' || ui === 'Aprovada') return inscricoesAbertas === false ? 'Encerrada' : 'Aprovada';
  return 'Revisar';   // 'Rascunho' / 'Em revisão' / qualquer outro
}

// Monta a linha do banco a partir do formulario do editor. `existente` = o _raw
// da oportunidade sendo editada (pra preservar campos que o form nao tem: link,
// language, resources — quando nao vierem no form).
export function formParaLinha(form, uiStatus, existente = null) {
  const ex = existente || {};
  return {
    title: form.titulo || '',
    description: form.descricao || '',
    type: form.tipo || '',
    level: form.nivel || [],
    audience: form.publicoAlvo || [],
    areas: form.interesse || [],
    cost: form.custo || null,
    location: serializeOpportunityLocation(form),
    deadline: form.prazo || null,
    // colunas de TEXTO no banco (o mapper divide em lista na leitura):
    eligibility: form.elegibilidade || '',
    process: form.processo || '',
    applicants: form.dicas || '',            // "dicas de contemplados"
    additionals: form.infoAdicional || '',
    keywords: Array.isArray(form.tags) ? form.tags : splitCommas(form.tags),
    language: form.lingua || ex.language || null,
    link: form.link || ex.link || null,
    // editor guarda recursos no formato da UI {plataforma,titulo,meta};
    // o banco guarda {platform,label,url} (jsonb).
    resources: Array.isArray(form.recursos)
      ? form.recursos
          .map((r) => ({ platform: r.plataforma || '', label: r.titulo || '', url: r.meta || '' }))
          .filter((r) => r.url || r.label)
      : (ex.resources || []),
    status: statusParaBanco(uiStatus, form.inscricoesAbertas),
  };
}

// ---------------------------------------------------------------------------
// ESCRITA (create / update / delete)  — sujeita ao RLS do Supabase
// ---------------------------------------------------------------------------
function garantirConfig() {
  if (!isSupabaseConfigured) throw new Error('Supabase nao configurado (.env).');
}

export async function createOpportunity(linha) {
  garantirConfig();
  const { data, error } = await supabase
    .from('opportunities').insert(linha).select().single();
  if (error) throw new Error(error.message);
  return mapOpportunity(data);
}

export async function updateOpportunity(id, campos) {
  garantirConfig();
  const { data, error } = await supabase
    .from('opportunities').update(campos).eq('id', id).select().single();
  if (error) throw new Error(error.message);
  return mapOpportunity(data);
}

// Antes de excluir, avisa no log do Sentinel (sentinel_posts) que aquela
// origem não vira mais oportunidade — sem isso, o post ligado a ela continua
// para sempre com o rótulo "Qualificada" em "Resultados por fonte", como se
// a oportunidade ainda existisse no catálogo (mesmo já excluída).
async function marcarPostsComoRemovidos(opportunityId) {
  if (!opportunityId) return;
  const nota = `Removida do catálogo em ${new Date().toLocaleDateString('pt-BR')} (excluída após aprovação/qualificação).`;
  await supabase.from('sentinel_posts')
    .update({ error: nota })
    .eq('opportunity_id', opportunityId)
    .is('error', null);
}

export async function deleteOpportunity(id) {
  garantirConfig();
  // Precisa rodar ANTES do delete: a FK sentinel_posts.opportunity_id é
  // "on delete set null", então depois de excluir a oportunidade não dá mais
  // pra achar o post pelo opportunity_id.
  try { await marcarPostsComoRemovidos(id); } catch { /* não bloqueia a exclusão por causa do log */ }
  const { error } = await supabase.from('opportunities').delete().eq('id', id);
  if (error) throw new Error(error.message);
}

// id real da linha no banco, a partir de uma oportunidade ja mapeada pra UI.
export const idDoBanco = (o) => (o && o._raw ? o._raw.id : (o ? o.id : null));

export { isSupabaseConfigured };
