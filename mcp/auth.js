// mcp/auth.js
//
// Login do servidor MCP no Supabase como um usuário real do time, para que
// RLS e o papel (Admin/Editor) valham exatamente como no painel. Nunca usa a
// chave service role.
//
// O painel só tem login com Google, então o caminho principal é o mesmo:
//
//   npm run mcp:login
//
// abre o Google no navegador (OAuth com PKCE), recebe o retorno num servidor
// local de uso único em http://localhost:<porta>/callback e grava a sessão em
// ~/.config/access-sentinel/session.json (permissão 600). Daí em diante o
// servidor MCP reaproveita e renova essa sessão sozinho.
//
// Requisito único no Supabase: Authentication -> URL Configuration ->
// Redirect URLs precisa aceitar http://localhost:<porta>/callback (porta
// padrão 8976, mude com ACCESS_LOGIN_PORT). Sem isso o Supabase manda o
// retorno para o Site URL do painel em vez de voltar para cá.
//
// Contas com senha ainda podem usar ACCESS_EMAIL + ACCESS_PASSWORD.

import { spawn } from 'node:child_process';
import { chmod, mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { createServer } from 'node:http';
import { homedir } from 'node:os';
import { dirname, join } from 'node:path';
import { createClient } from '@supabase/supabase-js';

export const SESSION_FILE = process.env.ACCESS_SESSION_FILE
  || join(homedir(), '.config', 'access-sentinel', 'session.json');
export const LOGIN_PORT = Number(process.env.ACCESS_LOGIN_PORT) || 8976;
const REDIRECT_URL = `http://localhost:${LOGIN_PORT}/callback`;

// Storage do supabase-js em arquivo: guarda a sessão (e o code verifier do
// PKCE durante o login). Renovações de token são gravadas de volta aqui, o
// que importa porque o Supabase gira o refresh token a cada uso.
function fileStorage(path = SESSION_FILE) {
  const load = async () => {
    try { return JSON.parse(await readFile(path, 'utf8')); } catch { return {}; }
  };
  const save = async (data) => {
    await mkdir(dirname(path), { recursive: true, mode: 0o700 });
    await writeFile(path, JSON.stringify(data), { mode: 0o600 });
    await chmod(path, 0o600);
  };
  return {
    getItem: async (key) => (await load())[key] ?? null,
    setItem: async (key, value) => save({ ...(await load()), [key]: value }),
    removeItem: async (key) => { const data = await load(); delete data[key]; await save(data); },
  };
}

function supabaseConfig() {
  const url = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.VITE_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
    || process.env.VITE_SUPABASE_PUBLISHABLE_KEY || process.env.VITE_SUPABASE_ANON_KEY;
  if (!url || !key) throw new Error('Configure NEXT_PUBLIC_SUPABASE_URL e NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY (no .env do projeto ou no ambiente do cliente MCP).');
  return { url, key };
}

function oauthClient() {
  const { url, key } = supabaseConfig();
  return createClient(url, key, {
    auth: { flowType: 'pkce', storage: fileStorage(), persistSession: true, autoRefreshToken: true, detectSessionInUrl: false },
  });
}

async function requireTeamRole(supabase, user) {
  const { data: admin } = await supabase.from('admins').select('role').eq('email', user.email).maybeSingle();
  if (!admin || !['Admin', 'Editor'].includes(admin.role)) {
    throw new Error(`${user.email} não é Admin nem Editor — o Sentinel exige um desses papéis.`);
  }
  return admin.role;
}

// Usado pelo servidor MCP: sessão salva (Google) primeiro, senha como
// alternativa. Devolve { supabase, user, role }.
export async function connect() {
  const saved = oauthClient();
  const { data: { session } } = await saved.auth.getSession();
  if (session) {
    const { data, error } = await saved.auth.getUser();
    if (!error && data.user) return { supabase: saved, user: data.user, role: await requireTeamRole(saved, data.user) };
  }

  const email = process.env.ACCESS_EMAIL;
  const password = process.env.ACCESS_PASSWORD;
  if (email && password) {
    const { url, key } = supabaseConfig();
    const supabase = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: true } });
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    if (error || !data.user) {
      throw new Error(`Login com senha falhou (${error?.message || 'sem usuário'}). O painel usa login com Google: rode "npm run mcp:login" no repositório e reconecte o servidor MCP.`);
    }
    return { supabase, user: data.user, role: await requireTeamRole(supabase, data.user) };
  }

  throw new Error(session
    ? 'A sessão salva expirou. Rode "npm run mcp:login" no repositório e reconecte o servidor MCP.'
    : 'Nenhuma sessão encontrada. Rode "npm run mcp:login" no repositório (login com Google, como no painel) e reconecte o servidor MCP.');
}

function openBrowser(url) {
  const [command, args] = process.platform === 'darwin' ? ['open', [url]]
    : process.platform === 'win32' ? ['cmd', ['/c', 'start', '', url]]
      : ['xdg-open', [url]];
  try { spawn(command, args, { stdio: 'ignore', detached: true }).unref(); } catch { /* o link também é impresso */ }
}

const page = (title, body) => `<!doctype html><meta charset="utf-8"><title>${title}</title><body style="font-family:system-ui;max-width:32rem;margin:4rem auto;padding:0 1rem"><h1>${title}</h1><p>${body}</p></body>`;

// `npm run mcp:login`
export async function loginWithGoogle({ timeoutMs = 5 * 60_000 } = {}) {
  await rm(SESSION_FILE, { force: true });
  const supabase = oauthClient();
  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: 'google',
    options: { redirectTo: REDIRECT_URL, skipBrowserRedirect: true },
  });
  if (error || !data?.url) throw new Error(`Não foi possível iniciar o login: ${error?.message || 'sem URL'}`);

  const code = await new Promise((resolve, reject) => {
    const timer = setTimeout(() => { server.close(); reject(new Error('Tempo esgotado esperando o login (5 min).')); }, timeoutMs);
    const server = createServer((req, res) => {
      const url = new URL(req.url, REDIRECT_URL);
      if (url.pathname !== '/callback') { res.writeHead(404).end(); return; }
      const received = url.searchParams.get('code');
      const failure = url.searchParams.get('error_description') || url.searchParams.get('error');
      res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
      res.end(received
        ? page('Login concluído', 'Pode fechar esta aba e voltar ao terminal.')
        : page('Login falhou', failure || 'O Supabase não devolveu um código.'));
      clearTimeout(timer);
      server.close();
      if (received) resolve(received); else reject(new Error(failure || 'O Supabase não devolveu um código de login.'));
    });
    server.on('error', (serverError) => { clearTimeout(timer); reject(serverError); });
    server.listen(LOGIN_PORT, '127.0.0.1', () => {
      console.error(`Abrindo o login do Google no navegador. Se não abrir, acesse:\n${data.url}\n`);
      openBrowser(data.url);
    });
  });

  const { data: exchanged, error: exchangeError } = await supabase.auth.exchangeCodeForSession(code);
  if (exchangeError || !exchanged.user) throw new Error(`Falha ao concluir o login: ${exchangeError?.message || 'sem usuário'}`);
  const role = await requireTeamRole(supabase, exchanged.user);
  return { email: exchanged.user.email, role, file: SESSION_FILE };
}
