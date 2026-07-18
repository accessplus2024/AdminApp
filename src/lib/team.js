// Membros do time = a lista de admins (public.admins), com nome/foto do Google.
import { supabase, isSupabaseConfigured } from './supabase';

const CORES = ['var(--azul)', 'var(--grifa-topicos)', 'var(--vermelha)', 'var(--success)', 'var(--warning)', 'var(--ink)'];

function iniciais(nome, email) {
  const base = (nome || '').trim() || (email || '').split('@')[0] || '?';
  const partes = base.split(/[.\s_-]+/).filter(Boolean);
  const ini = (partes[0]?.[0] || '') + (partes[1]?.[0] || '');
  return (ini || base.slice(0, 2)).toUpperCase();
}

function corPara(email) {
  let h = 0;
  for (const c of (email || '')) h = (h * 31 + c.charCodeAt(0)) >>> 0;
  return CORES[h % CORES.length];
}

// admins do banco -> formato que a tela Team já usa.
function mapMembro(row) {
  const nome = row.full_name || (row.email || '').split('@')[0];
  return {
    id: row.email,
    nome,
    email: row.email,
    avatar: row.avatar_url || '',
    iniciais: iniciais(row.full_name, row.email),
    cor: corPara(row.email),
    cargo: ({ Admin: 'Administrador', Editor: 'Editor', Viewer: 'Leitor' })[row.role] || 'Administrador',
    papel: row.role || 'Admin',
    // quem ainda não logou (sem nome do Google) aparece como convite pendente.
    status: row.full_name ? 'Ativo' : 'Convite pendente',
  };
}

export async function fetchTeam() {
  if (!isSupabaseConfigured) return [];
  const { data, error } = await supabase.from('admins').select('*').order('email');
  if (error) {
    console.error('[Access+] Erro ao ler o time (admins):', error.message);
    return [];
  }
  return (data || []).map(mapMembro);
}

// Adiciona um membro ao allowlist (só Admin consegue — garantido pelo RLS).
// Isso já dá acesso: a pessoa entra com Google. Nome/foto chegam no 1º login.
// Depois de adicionar, pede ao servidor Sentinel (local) para enviar o e-mail
// oficial de convite do Supabase. Se o servidor estiver offline, o acesso já
// funciona mesmo assim — só não chega e-mail.
const SENTINEL_API = import.meta.env.VITE_SENTINEL_API || 'http://localhost:8787';

export async function inviteMember({ email, role }) {
  if (!isSupabaseConfigured) throw new Error('Supabase não configurado.');
  const limpo = String(email || '').trim().toLowerCase();
  if (!limpo || !limpo.includes('@')) throw new Error('E-mail inválido.');
  const { error } = await supabase
    .from('admins').insert({ email: limpo, role: role || 'Editor' });
  if (error) {
    if (String(error.message).toLowerCase().includes('duplicate')) {
      throw new Error('Esse e-mail já está no time.');
    }
    throw new Error(error.message);
  }

  // E-mail de convite (best-effort).
  try {
    const res = await fetch(SENTINEL_API + '/api/invite', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: limpo, role: role || 'Editor' }),
    });
    const d = await res.json();
    if (!d.ok) return { emailSent: false, emailError: d.error || 'Falha ao enviar e-mail.' };
    return { emailSent: true };
  } catch {
    return { emailSent: false, emailError: 'Servidor Sentinel offline — convite adicionado, mas sem e-mail.' };
  }
}

// Remove um membro do allowlist (só Admin — garantido pelo RLS).
export async function removeMember(email) {
  if (!isSupabaseConfigured) throw new Error('Supabase não configurado.');
  const { error } = await supabase.from('admins').delete().eq('email', email);
  if (error) throw new Error(error.message);
}
