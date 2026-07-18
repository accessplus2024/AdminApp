// Cliente do Supabase para o AdminApp.
// -----------------------------------------------------------------------------
// As credenciais vem do arquivo .env (na raiz do AdminApp), NUNCA hardcoded aqui.
// No Vite, so variaveis que comecam com VITE_ ficam disponiveis no navegador.
//
//   VITE_SUPABASE_URL       = https://SEU-PROJETO.supabase.co
//   VITE_SUPABASE_ANON_KEY  = eyJ...   (a chave "anon"/publishable — PODE ir pro
//                                        navegador; a seguranca real vem do RLS)
//
// Se o .env ainda nao estiver configurado, exportamos `null` e o app cai de volta
// nos dados de exemplo (mock) — assim ele nunca quebra por falta de config.
import { createClient } from '@supabase/supabase-js';

// Aceita tanto os nomes do Vite (VITE_*) quanto os do Next.js (NEXT_PUBLIC_*),
// pra funcionar com o .env que ja existe no projeto. A "publishable key" nova do
// Supabase e o equivalente publico da chave "anon" — as duas servem aqui.
const env = import.meta.env;
const url =
  env.VITE_SUPABASE_URL ||
  env.NEXT_PUBLIC_SUPABASE_URL;
const anonKey =
  env.VITE_SUPABASE_ANON_KEY ||
  env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
  env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ||
  env.VITE_SUPABASE_PUBLISHABLE_KEY;

export const isSupabaseConfigured = Boolean(url && anonKey);

export const supabase = isSupabaseConfigured
  ? createClient(url, anonKey, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true,
        // PKCE é o fluxo OAuth mais seguro no navegador: o Google devolve um
        // "?code=..." de uso único (em vez do token direto na URL), e o
        // supabase-js troca esse code por uma sessão. Mesmo padrão do site.
        flowType: 'pkce',
      },
    })
  : null;

if (!isSupabaseConfigured) {
  // Aviso amigavel no console do navegador (nao quebra o app).
  console.warn(
    '[Access+] Supabase nao configurado: faltam VITE_SUPABASE_URL / ' +
    'VITE_SUPABASE_ANON_KEY no .env. Usando dados de exemplo (mock).'
  );
}
