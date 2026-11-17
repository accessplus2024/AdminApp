#!/usr/bin/env node
// mcp/login.js — `npm run mcp:login`. Ver mcp/auth.js.
import { existsSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const envFile = process.env.ACCESS_ENV_FILE || resolve(dirname(fileURLToPath(import.meta.url)), '..', '.env');
if (existsSync(envFile)) process.loadEnvFile(envFile);

const { loginWithGoogle, LOGIN_PORT } = await import('./auth.js');
try {
  const { email, role, file } = await loginWithGoogle();
  console.error(`Autenticado como ${email} (${role}). Sessão salva em ${file}.`);
  console.error('Reconecte o servidor MCP no seu cliente (no Claude Code: /mcp -> access-sentinel -> Reconnect).');
  process.exit(0);
} catch (error) {
  console.error(`Login falhou: ${error.message}`);
  if (/redirect|Site URL/i.test(error.message) || /code/i.test(error.message)) {
    console.error(`Confira se http://localhost:${LOGIN_PORT}/callback está em Supabase -> Authentication -> URL Configuration -> Redirect URLs.`);
  }
  process.exit(1);
}
