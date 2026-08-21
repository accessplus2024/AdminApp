// api/lib/enrichment.js
//
// Fase 3 — depois que uma oportunidade fica "Aprovada" no catálogo, busca
// links extras em 3 fontes que NÃO fazem parte da coleta normal (fase 1):
// Serper (busca no Google), YouTube Data API e busca geral no Reddit. Isso é
// apoio (achar cobertura em vídeo, posts falando da oportunidade, mais uma
// fonte pra confirmar que é real) — nunca muda o status da oportunidade.
//
// Duas formas de disparar:
//   - Manual (tela Web/Catálogo, botão "Enriquecer"): buscarCandidatosDeEnriquecimento
//     roda as 3 buscas + avaliação da IA e devolve a lista com sugestão pra um
//     humano escolher; confirmarEnriquecimento só salva o que foi escolhido.
//   - Automático (cron diário, ver enriquecerAutomaticamente): roda pra TODA
//     oportunidade Aprovada ainda não checada, sem humano no meio — por isso a
//     IA tem que ser bem mais rigorosa aqui: só entra em `opportunities.resources`
//     o que ela marcar "sugerido" E "confiança alta", depois de checar o
//     conteúdo real da página (não só o título da busca).
//
// Nada é salvo sem passar pela avaliação da IA — o primeiro rascunho disso
// salvava direto e um usuário real recebeu link de Reddit sem nenhuma relação
// com a oportunidade. Cada uma das 3 buscas roda isolada: se uma falhar (chave
// ausente, rate limit, etc.) as outras continuam — o erro específico fica só
// na resposta (pra tela mostrar), nunca é salvo no banco.

import { callModel, parseJsonObject } from '../sentinel.js';

const REDDIT_USER_AGENT = 'Mozilla/5.0 (compatible; AccessPlusBot/1.0; +https://accessplus.example)';

function stripHtml(value) {
  return String(value || '')
    .replace(/<script[\s\S]*?<\/script>/gi, '')
    .replace(/<style[\s\S]*?<\/style>/gi, '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/\s+/g, ' ')
    .trim();
}

// Busca o texto real da página (não só o snippet do resultado de busca) pra
// dar pra IA evidência de verdade, em vez dela ter que "confiar" no título —
// foi exatamente a falta disso que causou os links errados relatados antes
// (Reddit trazendo posts sem nenhuma relação, YouTube trazendo vídeo de outro
// assunto). Nunca falha o fluxo inteiro: se a página não abrir a tempo, o
// candidato só vai pra avaliação sem esse texto extra (mais chance de virar
// "não sugerido", o que é o lado seguro do erro).
async function buscarConteudoDaPagina(url) {
  try {
    const resposta = await fetch(url, {
      headers: { 'User-Agent': REDDIT_USER_AGENT },
      signal: AbortSignal.timeout(8_000),
    });
    if (!resposta.ok) return '';
    const html = await resposta.text();
    return stripHtml(html).slice(0, 1800);
  } catch {
    return '';
  }
}

async function buscarSerper(query) {
  const key = process.env.SERPER_API_KEY;
  if (!key) throw new Error('SERPER_API_KEY não configurada no servidor.');
  const resposta = await fetch('https://google.serper.dev/search', {
    method: 'POST',
    headers: { 'X-API-KEY': key, 'Content-Type': 'application/json' },
    body: JSON.stringify({ q: query, num: 5 }),
    signal: AbortSignal.timeout(15_000),
  });
  if (!resposta.ok) throw new Error(`Serper respondeu ${resposta.status}`);
  const dados = await resposta.json();
  // "platform" aqui precisa ser um dos valores que a tela reconhece
  // (youtube/reddit/instagram/tiktok/website) — Serper é busca no Google,
  // então o resultado é sempre "website". Antes isso vinha marcado como
  // "google" (não é uma plataforma que a tela conhece): o <select> do editor
  // não encontra essa opção e o navegador mostra a PRIMEIRA opção da lista
  // ("YouTube") como se fosse a selecionada, mesmo sendo um link comum — foi
  // exatamente o que gerou o rótulo errado relatado.
  return (dados.organic || []).slice(0, 5)
    .filter((r) => r.link)
    // instagram.com fica de fora daqui: a busca dedicada buscarInstagram()
    // abaixo já cobre esse domínio e marca "platform: instagram" corretamente
    // — sem esse filtro, se o Google indexasse por acaso um post do
    // Instagram nesta busca geral, ele entraria rotulado "website" (ordem de
    // concat em buscarCandidatosDeEnriquecimento decide qual busca "ganha" o
    // dedup por URL).
    .filter((r) => !/(?:^|\.)instagram\.com$/i.test(new URL(r.link).hostname))
    .map((r) => ({ platform: 'website', title: r.title || r.link, url: r.link, snippet: r.snippet || '' }));
}

// 4ª fonte de enriquecimento (a pedido, 2026-08-21) — não existe API pública
// de busca do Instagram, então usa o mesmo Serper (busca no Google) com
// "site:instagram.com" pra achar posts públicos que mencionem a
// oportunidade. Fica isolado numa função própria (não misturado em
// buscarSerper) só pra já sair com platform "instagram" certo, sem depender
// de reclassificar depois.
async function buscarInstagram(query) {
  const key = process.env.SERPER_API_KEY;
  if (!key) throw new Error('SERPER_API_KEY não configurada no servidor.');
  const resposta = await fetch('https://google.serper.dev/search', {
    method: 'POST',
    headers: { 'X-API-KEY': key, 'Content-Type': 'application/json' },
    body: JSON.stringify({ q: `site:instagram.com ${query}`, num: 5 }),
    signal: AbortSignal.timeout(15_000),
  });
  if (!resposta.ok) throw new Error(`Serper (Instagram) respondeu ${resposta.status}`);
  const dados = await resposta.json();
  return (dados.organic || []).slice(0, 5)
    .filter((r) => r.link)
    .map((r) => ({ platform: 'instagram', title: r.title || r.link, url: r.link, snippet: r.snippet || '' }));
}

async function buscarYoutube(query) {
  const key = process.env.YOUTUBE_API_KEY;
  if (!key) throw new Error('YOUTUBE_API_KEY não configurada no servidor.');
  const url = new URL('https://www.googleapis.com/youtube/v3/search');
  url.searchParams.set('part', 'snippet');
  url.searchParams.set('q', query);
  url.searchParams.set('type', 'video');
  url.searchParams.set('maxResults', '5');
  url.searchParams.set('key', key);
  const resposta = await fetch(url.toString(), { signal: AbortSignal.timeout(15_000) });
  if (!resposta.ok) throw new Error(`YouTube Data API respondeu ${resposta.status}`);
  const dados = await resposta.json();
  return (dados.items || [])
    .filter((item) => item.id?.videoId) // descarta resultados de canal/playlist sem vídeo
    .map((item) => ({
      platform: 'youtube',
      title: item.snippet?.title || '',
      url: `https://www.youtube.com/watch?v=${item.id.videoId}`,
      snippet: item.snippet?.description || '',
    }));
}

// Sem chave nenhuma — feed RSS de busca geral do Reddit (mesma técnica de
// api/lib/redditScraper.js, só que sem restringir a um subreddit específico).
// Busca geral no Reddit é ruidosa por natureza (qualquer post que mencione as
// palavras da busca aparece, relacionado ou não) — por isso a avaliação da IA
// abaixo é obrigatória pra essa fonte, não opcional.
async function buscarReddit(query) {
  const url = new URL('https://www.reddit.com/search.rss');
  url.searchParams.set('q', query);
  url.searchParams.set('sort', 'relevance');
  url.searchParams.set('limit', '5');
  const resposta = await fetch(url.toString(), { headers: { 'User-Agent': REDDIT_USER_AGENT }, signal: AbortSignal.timeout(15_000) });
  if (!resposta.ok) throw new Error(`Reddit respondeu ${resposta.status}`);
  const xml = await resposta.text();
  const entradas = [...xml.matchAll(/<entry>([\s\S]*?)<\/entry>/gi)].map((m) => m[1]);
  return entradas.slice(0, 5).map((entryXml) => {
    const titulo = (entryXml.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1] || '')
      .replace(/^<!\[CDATA\[/, '').replace(/\]\]>$/, '');
    const link = entryXml.match(/<link[^>]*href="([^"]+)"/i)?.[1] || '';
    return { platform: 'reddit', title: titulo, url: link, snippet: '' };
  }).filter((r) => r.url);
}

// Pede pra IA avaliar, um por um, se cada link achado parece genuinamente
// relacionado à oportunidade (usando o próprio título+descrição dela como
// contexto). Sem isso, busca geral (principalmente Reddit) devolve muito
// ruído — post de outra pessoa, outro assunto, outro programa parecido.
async function avaliarCandidatos(opportunity, candidatos) {
  if (!candidatos.length) return candidatos;

  // Busca o conteúdo real de cada página em paralelo (limitado, com timeout
  // individual) — a avaliação passa a ser feita com o texto de verdade da
  // página, não só o título/trecho devolvido pela busca.
  const conteudos = await Promise.all(candidatos.map((c) => buscarConteudoDaPagina(c.url)));

  const lista = candidatos.map((c, i) => {
    const pagina = conteudos[i] ? `\n   conteúdo real da página: "${conteudos[i]}"` : '\n   (não foi possível abrir a página — avalie só com título/trecho, com mais cautela)';
    return `${i}. [${c.platform}] "${c.title}" — ${c.url}${c.snippet ? `\n   trecho da busca: "${c.snippet.slice(0, 200)}"` : ''}${pagina}`;
  }).join('\n');

  const system = 'Você é um checador de fatos rigoroso. Sua tarefa é decidir, com muito zelo, se um link achado numa '
    + 'busca é GENUINAMENTE sobre UMA oportunidade educacional específica (mesmo programa, mesma organização), pra '
    + 'que ele possa ser salvo automaticamente como recurso extra no catálogo Access+ — sem revisão humana depois. '
    + 'Informação errada publicada é pior do que nenhuma informação. Antes de sugerir um link, confirme mentalmente: '
    + '(1) o nome do programa/organização no conteúdo da página bate com o da oportunidade, não é só uma palavra em '
    + 'comum ou um programa homônimo/parecido de outra instituição; (2) o conteúdo realmente fala DESSE programa '
    + '(edição, tema, processo seletivo), não de outro assunto que só apareceu na busca por coincidência de palavras; '
    + '(3) não é o perfil/post de uma pessoa qualquer, empresa não relacionada, ou resultado genérico. Se a página '
    + 'não abriu (sem conteúdo real) ou você tiver QUALQUER dúvida, marque confianca "baixa" e sugerido false — é '
    + 'preferível perder um link bom do que publicar um errado. (4) Se dois ou mais links da lista contarem a MESMA '
    + 'notícia com o mesmo conteúdo (ex.: o mesmo anúncio replicado em vários blogs de oportunidades, sem nada de '
    + 'exclusivo), sugira só o mais confiável/completo dos dois e marque os outros sugerido false com motivo '
    + '"conteúdo repetido de outro link já sugerido" — não sugira cobertura redundante da mesma notícia.';
  const user = `Oportunidade: "${opportunity.title}"\nDescrição: "${String(opportunity.description || '').slice(0, 600)}"\n\n`
    + `Links achados (índice. [fonte] "título" — url, trecho da busca, conteúdo real da página):\n${lista}\n\n`
    + 'Para cada um, responda se é genuinamente sobre essa mesma oportunidade e sua confiança nisso. Responda SOMENTE '
    + 'com JSON cru: {"avaliacoes":[{"indice":0,"sugerido":true,"confianca":"alta","motivo":"a página confirma o mesmo '
    + 'nome do programa e a mesma organização"}]} — confianca deve ser "alta", "media" ou "baixa".';
  try {
    const { content } = await callModel(system, user, { maxTokens: 1024 });
    const parsed = parseJsonObject(content);
    const porIndice = new Map((Array.isArray(parsed.avaliacoes) ? parsed.avaliacoes : [])
      .map((item) => [Number(item.indice), item]));
    return candidatos.map((c, i) => {
      const avaliacao = porIndice.get(i);
      const confianca = ['alta', 'media', 'baixa'].includes(avaliacao?.confianca) ? avaliacao.confianca : 'baixa';
      return {
        ...c,
        sugerido: Boolean(avaliacao?.sugerido),
        confianca,
        motivo: String(avaliacao?.motivo || '').trim() || 'Sem avaliação da IA para este link.',
        paginaVerificada: Boolean(conteudos[i]),
      };
    });
  } catch (error) {
    // Avaliação é apoio, não bloqueio: se a IA falhar, devolve tudo como "não
    // sugerido" (mais seguro) e explica o motivo, mas a busca em si não falha.
    return candidatos.map((c) => ({
      ...c, sugerido: false, confianca: 'baixa',
      motivo: `Não foi possível avaliar com IA (${error.message}) — revise manualmente.`,
      paginaVerificada: false,
    }));
  }
}

// Passo 1 — roda as 3 buscas + avaliação da IA. NÃO salva nada no banco.
export async function buscarCandidatosDeEnriquecimento(supabase, opportunityId) {
  if (!opportunityId) {
    throw Object.assign(new Error('opportunityId é obrigatório.'), { statusCode: 400 });
  }
  const { data: opportunity, error: fetchError } = await supabase
    .from('opportunities').select('id, title, description, resources, status').eq('id', opportunityId).maybeSingle();
  if (fetchError) throw fetchError;
  if (!opportunity) throw Object.assign(new Error('Oportunidade não encontrada.'), { statusCode: 404 });
  // Reforço no servidor do que a tela Web/Catálogo já esconde (item 7,
  // 2026-08-21): enriquecimento é apoio pra oportunidade JÁ aprovada — antes
  // disso ela pode ainda ser rejeitada ou mudar de nome/tema na revisão, e
  // gastar as 3 buscas + avaliação da IA nisso é desperdício, além do risco
  // de anexar recursos a algo que nunca vai ao ar com esse título/tema.
  if (opportunity.status !== 'Aprovada') {
    throw Object.assign(
      new Error('Esta oportunidade ainda não foi aprovada — aprove no Catálogo antes de enriquecer.'),
      { statusCode: 409 },
    );
  }

  const query = opportunity.title;
  const errors = {};
  const [serper, youtube, reddit, instagram] = await Promise.all([
    buscarSerper(query).catch((e) => { errors.serper = e.message; return []; }),
    buscarYoutube(query).catch((e) => { errors.youtube = e.message; return []; }),
    buscarReddit(query).catch((e) => { errors.reddit = e.message; return []; }),
    buscarInstagram(query).catch((e) => { errors.instagram = e.message; return []; }),
  ]);

  // Não repete o que já está salvo (de uma pesquisa anterior ou adicionado à
  // mão no editor) — nem manda pra IA avaliar de novo o que já foi decidido.
  const existentes = Array.isArray(opportunity.resources) ? opportunity.resources : [];
  const urlsExistentes = new Set(existentes.map((r) => r.url));
  // Dedup também DENTRO desta rodada: Serper e Reddit podem devolver a mesma
  // URL (ex.: a mesma notícia aparece no resultado do Google e é linkada num
  // post do Reddit) — sem isso, os dois "candidatos" idênticos passavam pela
  // avaliação da IA em paralelo, os dois eram aprovados, e a mesma URL virava
  // dois recursos salvos (o bug relatado de "dois links iguais").
  const vistosNestaRodada = new Set();
  const brutos = [...serper, ...youtube, ...reddit, ...instagram].filter((c) => {
    if (urlsExistentes.has(c.url) || vistosNestaRodada.has(c.url)) return false;
    vistosNestaRodada.add(c.url);
    return true;
  });

  const candidatos = await avaliarCandidatos(opportunity, brutos);

  return {
    query,
    candidatos,
    porFonte: { serper: serper.length, youtube: youtube.length, reddit: reddit.length, instagram: instagram.length },
    errors: Object.keys(errors).length ? errors : null,
  };
}

// Passo 2 — só roda depois que um humano escolheu (na tela) quais candidatos
// quer de fato adicionar. `escolhidos` = [{ platform, title, url }, ...].
export async function confirmarEnriquecimento(supabase, opportunityId, escolhidos) {
  if (!opportunityId) {
    throw Object.assign(new Error('opportunityId é obrigatório.'), { statusCode: 400 });
  }
  const lista = Array.isArray(escolhidos) ? escolhidos.filter((r) => r?.url) : [];
  const { data: opportunity, error: fetchError } = await supabase
    .from('opportunities').select('id, resources').eq('id', opportunityId).maybeSingle();
  if (fetchError) throw fetchError;
  if (!opportunity) throw Object.assign(new Error('Oportunidade não encontrada.'), { statusCode: 404 });

  const existentes = Array.isArray(opportunity.resources) ? opportunity.resources : [];
  const urlsExistentes = new Set(existentes.map((r) => r.url));
  // Reforço aqui também (além do dedup em buscarCandidatosDeEnriquecimento):
  // se por algum motivo `escolhidos` chegar com a mesma URL mais de uma vez,
  // não salva a mesma URL duas vezes em `resources`.
  const vistosNestaConfirmacao = new Set();
  const novos = lista
    .filter((r) => {
      if (urlsExistentes.has(r.url) || vistosNestaConfirmacao.has(r.url)) return false;
      vistosNestaConfirmacao.add(r.url);
      return true;
    })
    .map((r) => ({ platform: r.platform || 'website', label: r.title || r.label || r.url, url: r.url }));

  if (novos.length) {
    const { error: updateError } = await supabase.from('opportunities')
      .update({ resources: [...existentes, ...novos] }).eq('id', opportunityId);
    if (updateError) throw updateError;
  }

  return { adicionados: novos.length, total: existentes.length + novos.length, links: novos };
}

// Automático — roda sozinho (chamado pelo cron diário) pra oportunidade recém
// "Aprovada". Diferente do fluxo manual (que devolve tudo pra um humano
// escolher), aqui só entra em `opportunities.resources` o que a IA marcou
// "sugerido" E "confianca: alta" — o resto é descartado (não fica "pendente"
// em lugar nenhum). Não guarda nenhum "já checado" no banco: a ideia é rodar
// uma vez, perto da aprovação; se não achar nada bom, tudo bem — quem decide
// tentar de novo depois é um voluntário, clicando no botão "Enriquecer" na
// própria oportunidade, quando quiser.
export async function enriquecerAutomaticamente(supabase, opportunityId) {
  const resultado = await buscarCandidatosDeEnriquecimento(supabase, opportunityId);
  const aprovadosPelaIa = resultado.candidatos.filter((c) => c.sugerido && c.confianca === 'alta');

  let salvo = { adicionados: 0, total: null };
  if (aprovadosPelaIa.length) {
    salvo = await confirmarEnriquecimento(supabase, opportunityId, aprovadosPelaIa);
  }

  return {
    opportunityId,
    opportunityTitle: resultado.query,
    avaliados: resultado.candidatos.length,
    adicionados: salvo.adicionados,
    ignorados: resultado.candidatos.length - aprovadosPelaIa.length,
    links: salvo.links || [],
    errors: resultado.errors,
  };
}
