// Leitura E escrita das oportunidades no Supabase (com traducao pro formato da UI).
import { supabase, isSupabaseConfigured } from './supabase';
import { mapOpportunities, mapOpportunity } from './mapOpportunity';

// ---------------------------------------------------------------------------
// LEITURA
// ---------------------------------------------------------------------------
export async function fetchOpportunities({ throwOnError = false } = {}) {
  if (!isSupabaseConfigured) return [];
  const { data, error } = await supabase
    .from('opportunities')
    .select('*')
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
    audience: form.publico || [],
    areas: form.interesse || [],
    cost: form.custo || null,
    location: form.formato || form.local || null,
    deadline: form.prazo || null,
    // colunas de TEXTO no banco (o mapper divide em lista na leitura):
    eligibility: form.elegibilidade || '',
    process: form.processo || '',
    applicants: form.dicas || '',            // "dicas de contemplados"
    additionals: form.infoAdicional || '',
    keywords: splitCommas(form.tags),
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

export async function deleteOpportunity(id) {
  garantirConfig();
  const { error } = await supabase.from('opportunities').delete().eq('id', id);
  if (error) throw new Error(error.message);
}

// id real da linha no banco, a partir de uma oportunidade ja mapeada pra UI.
export const idDoBanco = (o) => (o && o._raw ? o._raw.id : (o ? o.id : null));

export { isSupabaseConfigured };
