// Autenticação do AdminApp via Supabase Auth (Google).
// -----------------------------------------------------------------------------
// Quem PODE entrar como admin é decidido pela tabela public.admins (lista de
// e-mails aprovados). O login em si é o Google; a AUTORIZAÇÃO é o allowlist.
import { supabase, isSupabaseConfigured } from './supabase';

// Abre o fluxo do Google. Volta pra mesma URL do app depois de autenticar.
export async function signInWithGoogle() {
  if (!isSupabaseConfigured) throw new Error('Supabase não configurado.');
  return supabase.auth.signInWithOAuth({
    provider: 'google',
    options: { redirectTo: window.location.origin },
  });
}

export async function signOut() {
  if (!isSupabaseConfigured) return;
  return supabase.auth.signOut();
}

export async function getSession() {
  if (!isSupabaseConfigured) return null;
  const { data } = await supabase.auth.getSession();
  return data.session;
}

// Escuta login/logout (troca de sessão). Retorna o objeto de subscription.
export function onAuthChange(cb) {
  if (!isSupabaseConfigured) return { data: { subscription: null } };
  return supabase.auth.onAuthStateChange((_event, session) => cb(session));
}

// Papel do usuário logado: 'Admin' | 'Editor' | 'Viewer' | null (não é do time).
export async function getMyRole(email) {
  if (!isSupabaseConfigured || !email) return null;
  const { data, error } = await supabase
    .from('admins').select('role').eq('email', email).maybeSingle();
  if (error || !data) return null;
  return data.role || 'Viewer';
}

// Guarda o nome/foto do Google na linha do próprio admin (aparece no time).
// Só afeta a própria linha (RLS). Se o e-mail não for admin, não faz nada.
export async function upsertMyProfile(user) {
  if (!isSupabaseConfigured || !user) return;
  const meta = user.user_metadata || {};
  const full_name = meta.full_name || meta.name || null;
  const avatar_url = meta.avatar_url || meta.picture || null;
  if (!full_name && !avatar_url) return;
  const { error } = await supabase
    .from('admins').update({ full_name, avatar_url }).eq('email', user.email);
  if (error) console.warn('[Access+] não atualizou perfil do admin:', error.message);
}
