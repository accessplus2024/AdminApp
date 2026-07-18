// api/sheets.js
//
// Vercel serverless function (Node runtime, auto-detected from the /api folder —
// works alongside the Vite frontend without any extra config).
//
// Reads the Sentinel review Sheet server-side using a Google service account, so
// the credentials never reach the browser and the Sheet itself never has to be
// made public. The frontend calls GET /api/sheets and gets back plain JSON.
//
// Required Vercel env vars (Project Settings → Environment Variables):
//   GOOGLE_SERVICE_ACCOUNT_KEY  — the *entire* service-account JSON key, as one
//                                 string (paste the whole downloaded .json file
//                                 as the value).
//   SHEET_ID                    — same Sheet id Sentinel writes to.
//   SHEET_TAB                   — tab name (defaults to "Oportunidades").
//
// One-time setup: in the Google Cloud project "wpf-sheets", create a service
// account, download its JSON key, then open the Sheet and share it with that
// service account's email (the "client_email" field in the key) as Viewer.

import { google } from 'googleapis';

const DEFAULT_COLUMNS = ['insta_account', 'title', 'summary', 'deadline', 'link', 'status'];

function loadServiceAccountAuth() {
  const raw = process.env.GOOGLE_SERVICE_ACCOUNT_KEY;
  if (!raw) {
    throw new Error('GOOGLE_SERVICE_ACCOUNT_KEY não configurada nas variáveis de ambiente.');
  }
  let key;
  try {
    key = JSON.parse(raw);
  } catch {
    throw new Error('GOOGLE_SERVICE_ACCOUNT_KEY não é um JSON válido.');
  }
  return new google.auth.JWT({
    email: key.client_email,
    key: key.private_key,
    scopes: ['https://www.googleapis.com/auth/spreadsheets.readonly'],
  });
}

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }

  const sheetId = process.env.SHEET_ID;
  const sheetTab = process.env.SHEET_TAB || 'Oportunidades';

  try {
    if (!sheetId) throw new Error('SHEET_ID não configurada nas variáveis de ambiente.');

    const auth = loadServiceAccountAuth();
    const sheets = google.sheets({ version: 'v4', auth });
    const result = await sheets.spreadsheets.values.get({
      spreadsheetId: sheetId,
      range: `${sheetTab}!A:F`,
    });

    const rows = result.data.values || [];
    const [header, ...body] = rows;
    const columns = (header && header.length ? header : DEFAULT_COLUMNS).map((c) => String(c || '').trim());

    const items = body
      .filter((row) => row.some((cell) => String(cell || '').trim() !== ''))
      .map((row) => Object.fromEntries(columns.map((col, i) => [col, row[i] ?? ''])));

    res.setHeader('Cache-Control', 's-maxage=60, stale-while-revalidate=300');
    res.status(200).json({ items });
  } catch (err) {
    console.error('[api/sheets] erro ao ler a planilha:', err);
    res.status(500).json({ error: err.message || 'Erro ao ler a planilha.' });
  }
}
