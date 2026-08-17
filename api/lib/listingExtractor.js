// api/lib/listingExtractor.js
//
// For "listagem" sources (a directory/SPA page listing many programs at once,
// e.g. Stand Out Search, Pathspire) there's no single per-post item the way a
// WordPress feed has — just one big rendered page full of text and links, most
// of which is navigation/menu/footer junk. This step asks a model to pick out
// which links actually look like individual opportunity postings, so each one
// can then go through the normal per-link research pipeline (processPost) in
// the "research" phase, same as everything else.
//
// Model: z-ai/glm-5.2 (NVIDIA's free OpenAI-compatible API), per project
// decision — this step is cheap (one call per source, not per candidate).

import OpenAI from 'openai';

const MODEL = 'z-ai/glm-5.2';
const TIMEOUT_MS = 45_000;

let client = null;
function nvidiaClient() {
  if (!process.env.NVIDIA_API_KEY) throw new Error('NVIDIA_API_KEY não configurada no servidor.');
  if (!client) {
    client = new OpenAI({ apiKey: process.env.NVIDIA_API_KEY, baseURL: 'https://integrate.api.nvidia.com/v1', timeout: TIMEOUT_MS, maxRetries: 0 });
  }
  return client;
}

function montaPrompt(texto, links) {
  const listaLinks = links.slice(0, 200).map((l, i) => `${i}. "${l.texto}" -> ${l.href}`).join('\n');
  return `Esta é uma página de um site que lista oportunidades educacionais (bolsas, programas de verão,
competições) para estudantes do ensino médio. A página foi renderizada inteira, então a lista de links
abaixo mistura menu/navegação/rodapé com links de programas de verdade.

TEXTO DA PÁGINA (truncado):
${texto.slice(0, 6000)}

LINKS ENCONTRADOS (índice. texto do link -> URL):
${listaLinks}

Sua tarefa: identifique quais links (pelo índice) apontam para a página de UM programa/oportunidade
específico — não menu, não redes sociais, não "sobre nós", não categorias/filtros, não paginação.

Responda APENAS com um objeto JSON: {"candidatos": [{"indice": N, "titulo": "nome do programa"}, ...]}.
Se nenhum link parecer ser de um programa específico, responda {"candidatos": []}.`;
}

function extractJsonObject(raw) {
  const start = raw.indexOf('{');
  const end = raw.lastIndexOf('}');
  if (start < 0 || end < start) throw new Error('O modelo não devolveu um objeto JSON.');
  return JSON.parse(raw.slice(start, end + 1));
}

// Devolve uma lista de { titulo, link } — prontos pra virar candidatos na fila,
// do mesmo jeito que um item de feed WP/RSS.
export async function extrairCandidatosDaListagem({ texto, links }) {
  if (!links || links.length === 0) return [];
  const completion = await nvidiaClient().chat.completions.create({
    model: MODEL,
    temperature: 0,
    max_tokens: 2000,
    messages: [{ role: 'user', content: montaPrompt(texto, links) }],
  });
  const conteudo = completion.choices?.[0]?.message?.content?.trim();
  if (!conteudo) throw new Error('O modelo devolveu uma resposta vazia.');
  const dados = extractJsonObject(conteudo);
  const candidatos = Array.isArray(dados.candidatos) ? dados.candidatos : [];
  const resultado = [];
  for (const c of candidatos) {
    const link = links[c.indice];
    if (!link) continue;
    resultado.push({ titulo: String(c.titulo || link.texto || '').trim() || link.href, link: link.href, resumo: '', data: '' });
  }
  return resultado;
}
