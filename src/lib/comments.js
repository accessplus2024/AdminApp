// Comentários: o AdminApp LÊ (por oportunidade) e APAGA (moderação).
// (Postar é no site público — não aqui.)
import { supabase, isSupabaseConfigured } from './supabase';

const CORES = ['var(--azul)', 'var(--grifa-topicos)', 'var(--vermelha)', 'var(--success)', 'var(--warning)', 'var(--ink)'];

function iniciais(nome) {
  const base = (nome || 'Estudante').trim();
  const p = base.split(/\s+/).filter(Boolean);
  return ((p[0]?.[0] || '') + (p[1]?.[0] || '') || base.slice(0, 2)).toUpperCase();
}
function corPara(chave) {
  let h = 0; for (const c of String(chave || '')) h = (h * 31 + c.charCodeAt(0)) >>> 0;
  return CORES[h % CORES.length];
}
function tempoRelativo(iso) {
  const t = new Date(iso).getTime();
  if (Number.isNaN(t)) return '';
  const s = Math.max(0, (Date.now() - t) / 1000);
  if (s < 3600) return `há ${Math.max(1, Math.round(s / 60))} min`;
  if (s < 86400) return `há ${Math.round(s / 3600)} h`;
  const d = Math.round(s / 86400);
  return d < 30 ? `há ${d} dia${d > 1 ? 's' : ''}` : new Date(iso).toLocaleDateString('pt-BR');
}

// linha do banco -> formato que a tela de detalhe já renderiza.
function mapComment(row) {
  return {
    id: row.id,
    autor: row.author_name || 'Estudante',
    iniciais: iniciais(row.author_name),
    cor: corPara(row.user_id || row.author_name || row.id),
    quando: tempoRelativo(row.created_at),
    quandoIso: row.created_at || null,
    texto: row.body,
    sinalizado: !!row.flagged,
    oportunidadeId: row.opportunity_id,
  };
}

// Comentários de UMA oportunidade (mais recentes primeiro).
export async function fetchComments(opportunityId) {
  if (!isSupabaseConfigured || opportunityId == null) return [];
  const { data, error } = await supabase
    .from('comments').select('*')
    .eq('opportunity_id', opportunityId)
    .order('created_at', { ascending: false });
  if (error) { console.error('[Access+] erro ao ler comentários:', error.message); return []; }
  return (data || []).map(mapComment);
}

// Comentários mais recentes de TODAS as oportunidades (pra Visão geral).
// Sinalizados (harmful) primeiro, depois os mais novos. O nome da oportunidade
// é resolvido depois, no Dashboard, contra a lista já carregada (evita depender
// de um join/relação específica no Supabase).
export async function fetchRecentComments(limite = 8) {
  if (!isSupabaseConfigured) return [];
  const { data, error } = await supabase
    .from('comments').select('*')
    .order('created_at', { ascending: false })
    .limit(50);   // pega um lote maior; sinalizados podem não estar entre os N mais novos
  if (error) { console.error('[Access+] erro ao ler comentários recentes:', error.message); return []; }
  const mapeados = (data || []).map(mapComment);
  const sinalizados = mapeados.filter((c) => c.sinalizado);
  const recentes = mapeados.filter((c) => !c.sinalizado);
  return [...sinalizados, ...recentes].slice(0, limite);
}

// Apaga um comentário (moderação). RLS garante que só o time/autor consegue.
export async function deleteComment(id) {
  if (!isSupabaseConfigured) return;
  const { error } = await supabase.from('comments').delete().eq('id', id);
  if (error) throw new Error(error.message);
}
