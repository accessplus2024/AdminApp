import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

const SERVER_ENV_KEYS = [
  'SUPABASE_URL',
  'NEXT_PUBLIC_SUPABASE_URL',
  'SUPABASE_SERVICE_ROLE_KEY',
  'NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY',
  'NEXT_PUBLIC_SUPABASE_ANON_KEY',
  'VITE_SUPABASE_PUBLISHABLE_KEY',
  'VITE_SUPABASE_ANON_KEY',
  'APIFY_API_KEY',
  'NVIDIA_API_KEY',
  'SENTINEL_MODELS',
  'SENTINEL_MODEL_TIMEOUT_MS',
  'SENTINEL_ADJACENT_PAGES',
  'SENTINEL_SOURCE_CHAR_LIMIT',
];

async function readJsonBody(req) {
  const chunks = [];
  let size = 0;
  for await (const chunk of req) {
    size += chunk.length;
    if (size > 1024 * 1024) {
      const error = new Error('Requisição grande demais.');
      error.statusCode = 413;
      throw error;
    }
    chunks.push(chunk);
  }
  if (!chunks.length) return {};
  try {
    return JSON.parse(Buffer.concat(chunks).toString('utf8'));
  } catch {
    const error = new Error('JSON inválido.');
    error.statusCode = 400;
    throw error;
  }
}

function localSentinelApi() {
  return {
    name: 'accessplus-local-sentinel-api',
    apply: 'serve',
    configureServer(server) {
      server.middlewares.use(async (req, res, next) => {
        if ((req.url || '').split('?')[0] !== '/api/sentinel') return next();

        res.status = (statusCode) => {
          res.statusCode = statusCode;
          return res;
        };
        res.json = (payload) => {
          if (!res.headersSent) res.setHeader('Content-Type', 'application/json; charset=utf-8');
          res.end(JSON.stringify(payload));
          return res;
        };

        try {
          req.body = await readJsonBody(req);
          const { default: handler } = await import('./api/sentinel.js');
          await handler(req, res);
        } catch (error) {
          console.error('[vite/api/sentinel]', error);
          if (!res.writableEnded) {
            res.status(error.statusCode || 500).json({ error: error.message || 'Falha ao executar o Sentinel.' });
          }
        }
      });
    },
  };
}

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');
  for (const key of SERVER_ENV_KEYS) {
    if (!process.env[key] && env[key]) process.env[key] = env[key];
  }

  return {
    plugins: [react(), localSentinelApi()],
    // O projeto também usa nomes NEXT_PUBLIC_* no frontend.
    envPrefix: ['VITE_', 'NEXT_PUBLIC_'],
  };
});
