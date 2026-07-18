// Lê a fila de revisão do Sentinel (Google Sheets) via a função serverless
// /api/sheets (api/sheets.js). O proxy já devolve todas as linhas da planilha;
// aqui só filtramos as aprovadas e normalizamos os nomes de campo pro app.
export async function fetchApprovedOpportunities() {
  try {
    const res = await fetch('/api/sheets');
    if (!res.ok) throw new Error(`Sheets proxy respondeu ${res.status}`);
    const { items = [] } = await res.json();
    return items
      .filter((r) => String(r.status || '').trim().toLowerCase() === 'approved')
      .map((r) => ({
        instaAccount: r.insta_account || '',
        title: r.title || '',
        summary: r.summary || '',
        deadline: r.deadline || '',
        link: r.link || '',
      }));
  } catch (err) {
    console.error('[Access+] Falha ao ler oportunidades aprovadas da planilha:', err.message);
    return [];
  }
}
