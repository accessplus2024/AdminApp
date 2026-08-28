// api/lib/enrichment.js
//
// Fase 3 — depois que uma oportunidade fica "Aprovada" no catálogo, busca
// links extras em fontes que NÃO fazem parte da coleta normal (fase 1). Isso é
// apoio (achar cobertura em vídeo, posts falando da oportunidade, depoimento de
// quem participou, mais uma fonte pra confirmar que é real) — nunca muda o
// status da oportunidade.
//
// São 5 buscas, todas usando o TÍTULO da oportunidade como base (2026-08-21,
// a pedido — antes eram 4 e o Reddit vinha de um scraper de RSS próprio):
//
//   1. Serper (Google) com o título          -> websites em geral
//   2. Serper com "site:reddit.com <título>" -> Reddit
//   3. Serper com "site:instagram.com <t>"   -> Instagram
//   4. YouTube Data API com o título         -> vídeos
//   5. Serper com "<título> student story testimonial depoimento brasileiro"
//      -> depoimento de quem ganhou/participou (qualquer domínio)
//
// Por que a 5ª existe: buscar SÓ o título nunca chega em relato pessoal — o
// Google entende a query como "informação sobre o programa" e devolve página
// oficial + blogs agregadores. Medido no dia (University of Miami Stamps
// Scholarship): com o título puro a matéria da Borderless de uma brasileira
// bolsista não aparece em nenhuma das 15 posições; com a query da 5ª busca ela
// aparece em 1º lugar.
//
// Por que o Reddit deixou de ter scraper próprio: o feed RSS de busca
// (reddit.com/search.rss) é bloqueado pelo IP de datacenter da Vercel (403) —
// em deploy essa fonte simplesmente nunca devolvia nada. Pelo Serper com
// "site:reddit.com" a busca sai do lado do Serper (não do nosso servidor) e
// voltou a funcionar: 10 de 10 resultados do domínio certo no teste.
//
// Duas formas de disparar:
//   - Manual (tela Web/Catálogo, botão "Enriquecer"): buscarCandidatosDeEnriquecimento
//     roda as buscas + avaliação da IA e devolve a lista com sugestão pra um
//     humano escolher; confirmarEnriquecimento só salva o que foi escolhido.
//   - Automático (na aprovação, ver enriquecerAutomaticamente): sem humano no
//     meio — por isso a IA tem que ser bem mais rigorosa aqui: só entra em
//     `opportunities.resources` o que ela marcar "sugerido" E "confiança alta".
//
// Nada é salvo sem passar pela avaliação da IA — o primeiro rascunho disso
// salvava direto e um usuário real recebeu link de Reddit sem nenhuma relação
// com a oportunidade. Cada busca roda isolada: se uma falhar (chave ausente,
// rate limit, etc.) as outras continuam — o erro específico fica só na
// resposta (pra tela mostrar), nunca é salvo no banco.

import { callModel, parseJsonObject } from '../sentinel.js';

// 15 resultados por busca (a pedido, 2026-08-21 — antes eram 5). Cinco era
// pouco pro caso real: nas 5 primeiras posições do Google o título puro só
// devolve a página oficial e blogs agregadores que repetem o mesmo anúncio, e
// a regra de "conteúdo repetido" da IA poda quase todos, sobrando ~1 link.
const MAX_RESULTADOS = 15;

// Limite MENOR pras buscas que usam o operador "site:" (Reddit e Instagram): o
// plano free do Serper recusa esse padrão de query com num acima de 10 —
// devolve 400 {"message":"Query pattern not allowed for free accounts"}. Medido
// no dia: site:reddit.com com num=10 responde 200 e 10 resultados; com 15 ou 20
// responde 400, e a fonte inteira aparecia como falha no log.
const MAX_RESULTADOS_SITE = 10;

// User-Agent de navegador de verdade pra ler a página do candidato. O antigo
// ("AccessPlusBot/1.0") era recusado por vários sites (403/429), a página vinha
// vazia, e sem conteúdo a IA marcava confiança baixa — ou seja, o próprio
// User-Agent estava derrubando links bons.
const UA_NAVEGADOR = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) '
  + 'AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36';

// Domínios que já têm busca dedicada (2, 3 e 4). Saem da busca geral pra não
// entrar rotulado "website" um link que a busca específica marcaria com a
// plataforma certa — "platform" precisa ser um dos valores que a tela conhece
// (youtube/reddit/instagram/tiktok/website), senão o <select> do editor não
// acha a opção e o navegador mostra a PRIMEIRA da lista ("YouTube") como se
// estivesse selecionada, mesmo num link comum.
const DOMINIOS_COM_BUSCA_PROPRIA = /(?:^|\.)(?:instagram\.com|reddit\.com|youtube\.com|youtu\.be)$/i;

function hostnameDe(url) {
  try { return new URL(url).hostname; } catch { return ''; }
}

// Usado só na 5ª busca (depoimento), que pode devolver qualquer domínio: o
// link vai pro catálogo com o rótulo certo em vez de tudo virar "website".
function plataformaPorUrl(url) {
  const host = hostnameDe(url);
  if (/(?:^|\.)(?:youtube\.com|youtu\.be)$/i.test(host)) return 'youtube';
  if (/(?:^|\.)reddit\.com$/i.test(host)) return 'reddit';
  if (/(?:^|\.)instagram\.com$/i.test(host)) return 'instagram';
  if (/(?:^|\.)tiktok\.com$/i.test(host)) return 'tiktok';
  return 'website';
}

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
// foi exatamente a falta disso que causou os links errados relatados antes.
// Só é chamada pra candidato de plataforma "website" (ver montarEvidencia):
// youtube.com, reddit.com e instagram.com respondem 429/403 pro IP da Vercel,
// e insistir neles fazia TODO vídeo/post ser reprovado por "página não abriu".
async function buscarConteudoDaPagina(url) {
  try {
    const resposta = await fetch(url, {
      headers: { 'User-Agent': UA_NAVEGADOR, 'Accept-Language': 'pt-BR,pt;q=0.9,en;q=0.8' },
      signal: AbortSignal.timeout(8_000),
    });
    if (!resposta.ok) return '';
    const html = await resposta.text();
    return stripHtml(html).slice(0, 1800);
  } catch {
    return '';
  }
}

// Uma única função pras 4 buscas que passam pelo Serper (geral, Reddit,
// Instagram e depoimento) — mudam só a query, o rótulo do erro e como a
// plataforma de cada resultado é decidida.
async function buscarNoSerper(query, { nomeDaFonte, plataforma, filtrarUrl, num = MAX_RESULTADOS }) {
  const key = process.env.SERPER_API_KEY;
  if (!key) throw new Error('SERPER_API_KEY não configurada no servidor.');
  const resposta = await fetch('https://google.serper.dev/search', {
    method: 'POST',
    headers: { 'X-API-KEY': key, 'Content-Type': 'application/json' },
    body: JSON.stringify({ q: query, num }),
    signal: AbortSignal.timeout(15_000),
  });
  if (!resposta.ok) throw new Error(`Serper (${nomeDaFonte}) respondeu ${resposta.status}`);
  const dados = await resposta.json();
  return (dados.organic || [])
    .filter((r) => r.link)
    .filter((r) => (filtrarUrl ? filtrarUrl(r.link) : true))
    .slice(0, num)
    .map((r) => ({
      platform: typeof plataforma === 'function' ? plataforma(r.link) : plataforma,
      title: r.title || r.link,
      url: r.link,
      snippet: r.snippet || '',
    }));
}

// 1. Busca geral (websites): notícia, página oficial, cobertura.
const buscarSerper = (titulo) => buscarNoSerper(titulo, {
  nomeDaFonte: 'geral',
  plataforma: 'website',
  filtrarUrl: (url) => !DOMINIOS_COM_BUSCA_PROPRIA.test(hostnameDe(url)),
});

// 2. Reddit via Serper. O "site:" é o que garante o domínio: medido no dia, a
// query "<título> reddit" (sem o operador) devolvia 3 de 9 links de FORA do
// Reddit, que entrariam no catálogo rotulados "reddit" indevidamente; com
// "site:reddit.com" foram 10 de 10 corretos.
const buscarReddit = (titulo) => buscarNoSerper(`site:reddit.com ${titulo}`, {
  nomeDaFonte: 'Reddit',
  plataforma: 'reddit',
  num: MAX_RESULTADOS_SITE,
  filtrarUrl: (url) => /(?:^|\.)reddit\.com$/i.test(hostnameDe(url)),
});

// 3. Instagram via Serper — não existe API pública de busca do Instagram, então
// o jeito é o mesmo "site:" no Google.
const buscarInstagram = (titulo) => buscarNoSerper(`site:instagram.com ${titulo}`, {
  nomeDaFonte: 'Instagram',
  plataforma: 'instagram',
  num: MAX_RESULTADOS_SITE,
  filtrarUrl: (url) => /(?:^|\.)instagram\.com$/i.test(hostnameDe(url)),
});

// 5. Depoimento de quem participou/ganhou. Pode cair em qualquer domínio, então
// a plataforma sai do próprio link.
const buscarDepoimentos = (titulo) => buscarNoSerper(
  `${titulo} student story testimonial depoimento brasileiro`,
  { nomeDaFonte: 'depoimentos', plataforma: plataformaPorUrl },
);

// 4. YouTube pela Data API oficial (a chave já existe no servidor). A API
// devolve título, descrição e nome do canal — isso é a evidência que a IA
// recebe, no lugar do HTML da página: youtube.com responde 429 ("unusual
// traffic from your computer network") pro IP da Vercel, então baixar a página
// do vídeo em produção só produzia evidência vazia e reprovava todo mundo.
async function buscarYoutube(titulo) {
  const key = process.env.YOUTUBE_API_KEY;
  if (!key) throw new Error('YOUTUBE_API_KEY não configurada no servidor.');
  const url = new URL('https://www.googleapis.com/youtube/v3/search');
  url.searchParams.set('part', 'snippet');
  url.searchParams.set('q', titulo);
  url.searchParams.set('type', 'video');
  url.searchParams.set('maxResults', String(MAX_RESULTADOS));
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
      canal: item.snippet?.channelTitle || '',
    }));
}

// Monta a evidência que vai pro prompt, por plataforma — em vez de tentar
// abrir a página de todo mundo. Devolve { texto, verificada }: `verificada`
// diz se a evidência é o conteúdo real da página (website) ou metadado da
// própria plataforma (YouTube/Reddit/Instagram), e a IA é avisada da
// diferença.
async function montarEvidencia(candidato) {
  if (candidato.platform === 'website') {
    const pagina = await buscarConteudoDaPagina(candidato.url);
    return pagina
      ? { texto: `conteúdo real da página: "${pagina}"`, verificada: true }
      : { texto: '(a página não abriu — avalie só com título/trecho, com mais cautela)', verificada: false };
  }
  if (candidato.platform === 'youtube') {
    return {
      texto: `metadados oficiais do YouTube — canal: "${candidato.canal || 'desconhecido'}"; `
        + `descrição do vídeo: "${String(candidato.snippet || '').slice(0, 900) || '(vazia)'}"`,
      verificada: Boolean(candidato.canal || candidato.snippet),
    };
  }
  return {
    texto: `trecho indexado pelo Google para este ${candidato.platform}: `
      + `"${String(candidato.snippet || '').slice(0, 900) || '(vazio)'}"`,
    verificada: Boolean(candidato.snippet),
  };
}

// Quantos links vão pra IA POR CHAMADA. Não é frescura de performance: com as
// 5 buscas trazendo ~45 candidatos, mandar tudo numa única chamada dava
// resultado instável demais pra um modelo de 20B (o padrão em SENTINEL_MODELS).
// Medido no mesmo dia, MESMA oportunidade (University of Miami Stamps
// Scholarship), MESMO prompt, 4 execuções: 1 aprovado, 8, 3 e 44 de 45 — a
// última aprovando até vídeo cujo título não cita o programa. Ou seja: o número
// de links que a oportunidade recebia era sorteio, não critério. Em lotes
// pequenos cada chamada é uma tarefa curta (5 itens, JSON curto), o modelo
// consegue de fato comparar item por item, e a resposta não corre risco de ser
// truncada no meio do JSON. Os lotes rodam em paralelo, então continua rápido.
const TAMANHO_DO_LOTE = 5;

// Avalia UM lote. O prompt numera os itens de 0 DENTRO do lote (índice curto,
// mais fácil pro modelo acertar) e devolve na mesma ordem que recebeu, então
// quem chama só precisa concatenar os lotes na ordem.
async function avaliarLote(opportunity, candidatos, evidencias) {
  const lista = candidatos.map((c, i) => {
    const trecho = c.snippet && c.platform === 'website' ? `\n   trecho da busca: "${c.snippet.slice(0, 200)}"` : '';
    return `${i}. [${c.platform}] "${c.title}" — ${c.url}${trecho}\n   ${evidencias[i].texto}`;
  }).join('\n');

  const system = 'Você é um checador de fatos rigoroso do Access+, um catálogo de oportunidades educacionais para '
    + 'ESTUDANTES BRASILEIROS. Sua tarefa é decidir, com muito zelo, se um link achado numa busca é GENUINAMENTE '
    + 'sobre UMA oportunidade educacional específica (mesmo programa, mesma organização), pra que ele possa ser '
    + 'salvo automaticamente como recurso extra no catálogo — sem revisão humana depois. Informação errada '
    + 'publicada é pior do que nenhuma informação.\n'
    + 'Antes de sugerir um link, confirme mentalmente: '
    + '(1) o nome do programa/organização na evidência bate com o da oportunidade, não é só uma palavra em comum '
    + 'ou um programa homônimo/parecido de outra instituição; (2) a evidência realmente fala DESSE programa '
    + '(edição, tema, processo seletivo, experiência de quem participou), não de outro assunto que só apareceu na '
    + 'busca por coincidência de palavras; (3) não é resultado genérico, perfil/post de alguém sem relação com o '
    + 'programa, nem página de empresa não relacionada.\n'
    + 'CRITÉRIO DE APROVAÇÃO — é UM SÓ: a evidência confirma que o link trata DESTE programa. Material que '
    + 'explica corretamente a oportunidade (como se candidatar, prazos, benefícios, quem pode participar, '
    + 'cobertura jornalística, página oficial, tutorial em vídeo, discussão de candidatos) é ÚTIL e deve ser '
    + 'sugerido com confiança "alta" quando a evidência citar o programa e a organização certos. NUNCA exija '
    + 'relato pessoal, menção ao Brasil ou conteúdo em português como condição pra aprovar — a ausência disso '
    + 'NÃO é motivo de recusa, e "genérico" não é motivo de recusa se o programa certo está identificado.\n'
    + 'MAS a confirmação tem que estar NA EVIDÊNCIA que você recebeu (página, descrição do vídeo, canal ou '
    + 'trecho indexado), não na sua suposição: se o nome do programa e da organização não aparece na evidência '
    + '— por exemplo um vídeo chamado "como consegui uma bolsa integral" cuja descrição não cita este programa '
    + '— marque sugerido false, porque o link só apareceu por coincidência de palavras da busca.\n'
    + 'DESEMPATE EDITORIAL (é preferência, não filtro): entre links equivalentes, prefira o que traz relato em '
    + 'primeira pessoa de quem GANHOU ou PARTICIPOU do programa e, entre esses, o de estudante BRASILEIRO ou '
    + 'lusófono / conteúdo em português — é o que mais serve ao público do catálogo. Consequência prática: NÃO '
    + 'rejeite um link só porque é a história de uma pessoa. A regra (3) existe pra perfil/post SEM relação com '
    + 'o programa; depoimento de participante é conteúdo de primeira linha aqui, e depoimento de brasileiro ou '
    + 'lusófono deve sempre ser sugerido quando a evidência confirmar o programa.\n'
    + 'SOBRE A EVIDÊNCIA: para website, você recebe o conteúdo real da página. Para YouTube você recebe os '
    + 'metadados oficiais da API (canal + descrição) e para Reddit/Instagram o trecho indexado pelo Google — '
    + 'essas plataformas bloqueiam leitura direta pelo servidor, então metadado oficial É evidência válida: se o '
    + 'título e a descrição/canal citarem explicitamente o mesmo programa e organização, isso basta para '
    + 'confiança "alta"; não marque "baixa" só porque a página não foi aberta. Marque confiança "baixa" e '
    + 'sugerido false quando NÃO houver evidência nenhuma (sem página, sem descrição, sem trecho), quando a '
    + 'evidência não citar o programa, ou quando você tiver qualquer dúvida real de que é o mesmo programa.\n'
    + '(4) Se dois ou mais links contarem a MESMA notícia com o mesmo conteúdo (ex.: o mesmo anúncio replicado '
    + 'em vários blogs de oportunidades, sem nada de exclusivo), sugira só o mais confiável/completo e marque os '
    + 'outros sugerido false com motivo "conteúdo repetido de outro link já sugerido". Essa regra vale pra '
    + 'anúncio replicado — dois DEPOIMENTOS de pessoas diferentes não são conteúdo repetido, mesmo falando do '
    + 'mesmo programa.';
  const user = `Oportunidade: "${opportunity.title}"\nDescrição: "${String(opportunity.description || '').slice(0, 600)}"\n\n`
    + `Links achados (índice. [fonte] "título" — url, depois a evidência disponível):\n${lista}\n\n`
    + `Avalie os ${candidatos.length} links acima, um por um, sem pular nenhum índice. `
    + 'Para cada um, responda se é genuinamente sobre essa mesma oportunidade e sua confiança nisso. Responda SOMENTE '
    + 'com JSON cru: {"avaliacoes":[{"indice":0,"sugerido":true,"confianca":"alta","relato":false,'
    + '"brasileiro":false,"motivo":"a descrição do vídeo confirma o mesmo nome do programa e a mesma '
    + 'organização"}]} — confianca deve ser "alta", "media" ou "baixa"; "relato" é true quando o conteúdo é '
    + 'experiência em primeira pessoa de quem participou/ganhou; "brasileiro" é true quando é de estudante '
    + 'brasileiro/lusófono ou está em português. Esses dois campos NÃO decidem a aprovação — servem só pra '
    + 'ordenar o que é mais útil pro catálogo.';
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
        // Usados só pra ORDENAR o que é salvo automaticamente (ver
        // enriquecerAutomaticamente) — nunca pra aprovar ou reprovar.
        relato: Boolean(avaliacao?.relato),
        brasileiro: Boolean(avaliacao?.brasileiro),
        paginaVerificada: evidencias[i].verificada,
      };
    });
  } catch (error) {
    // Avaliação é apoio, não bloqueio: se a IA falhar, devolve tudo como "não
    // sugerido" (mais seguro) e explica o motivo, mas a busca em si não falha.
    // Como isso agora vale por LOTE, uma chamada que falha (timeout, JSON
    // inválido) derruba só os 5 links dela — antes derrubava a rodada inteira.
    return candidatos.map((c) => ({
      ...c, sugerido: false, confianca: 'baixa', relato: false, brasileiro: false,
      motivo: `Não foi possível avaliar com IA (${error.message}) — revise manualmente.`,
      paginaVerificada: false,
    }));
  }
}

// Pede pra IA avaliar se cada link achado parece genuinamente relacionado à
// oportunidade (usando o próprio título+descrição dela como contexto). Sem
// isso, busca geral devolve muito ruído — post de outra pessoa, outro assunto,
// outro programa parecido. Quebra em lotes de TAMANHO_DO_LOTE e junta tudo de
// volta na ordem original.
async function avaliarCandidatos(opportunity, candidatos) {
  if (!candidatos.length) return candidatos;

  // Evidência em paralelo (só website faz fetch de página; o resto usa
  // metadado da plataforma — ver montarEvidencia).
  const evidencias = await Promise.all(candidatos.map((c) => montarEvidencia(c)));

  const lotes = [];
  for (let i = 0; i < candidatos.length; i += TAMANHO_DO_LOTE) {
    lotes.push(i);
  }
  const avaliados = await Promise.all(lotes.map((inicio) => avaliarLote(
    opportunity,
    candidatos.slice(inicio, inicio + TAMANHO_DO_LOTE),
    evidencias.slice(inicio, inicio + TAMANHO_DO_LOTE),
  )));
  return avaliados.flat();
}

// Passo 1 — roda as 5 buscas + avaliação da IA. NÃO salva nada no banco.
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
  // gastar as buscas + avaliação da IA nisso é desperdício, além do risco de
  // anexar recursos a algo que nunca vai ao ar com esse título/tema.
  if (opportunity.status !== 'Aprovada') {
    throw Object.assign(
      new Error('Esta oportunidade ainda não foi aprovada — aprove no Catálogo antes de enriquecer.'),
      { statusCode: 409 },
    );
  }

  const query = opportunity.title;
  const errors = {};
  const [youtube, reddit, instagram, depoimentos, serper] = await Promise.all([
    buscarYoutube(query).catch((e) => { errors.youtube = e.message; return []; }),
    buscarReddit(query).catch((e) => { errors.reddit = e.message; return []; }),
    buscarInstagram(query).catch((e) => { errors.instagram = e.message; return []; }),
    buscarDepoimentos(query).catch((e) => { errors.depoimentos = e.message; return []; }),
    buscarSerper(query).catch((e) => { errors.serper = e.message; return []; }),
  ]);

  // Não repete o que já está salvo (de uma pesquisa anterior ou adicionado à
  // mão no editor) — nem manda pra IA avaliar de novo o que já foi decidido.
  const existentes = Array.isArray(opportunity.resources) ? opportunity.resources : [];
  const urlsExistentes = new Set(existentes.map((r) => r.url));
  // Dedup também DENTRO desta rodada: buscas diferentes podem devolver a mesma
  // URL (ex.: a busca de depoimento e a busca geral acham a mesma matéria) —
  // sem isso, os dois "candidatos" idênticos passavam pela avaliação da IA, os
  // dois eram aprovados, e a mesma URL virava dois recursos salvos (o bug
  // relatado de "dois links iguais"). A ORDEM do concat decide quem ganha o
  // dedup: as buscas com plataforma específica vêm primeiro, depois a de
  // depoimento (que já classifica a plataforma pelo domínio), e a geral por
  // último — assim nenhum link chega ao catálogo rotulado "website" quando
  // existe rótulo melhor pra ele.
  const vistosNestaRodada = new Set();
  const brutos = [...youtube, ...reddit, ...instagram, ...depoimentos, ...serper].filter((c) => {
    if (urlsExistentes.has(c.url) || vistosNestaRodada.has(c.url)) return false;
    vistosNestaRodada.add(c.url);
    return true;
  });

  const candidatos = await avaliarCandidatos(opportunity, brutos);

  return {
    query,
    candidatos,
    porFonte: {
      serper: serper.length,
      youtube: youtube.length,
      reddit: reddit.length,
      instagram: instagram.length,
      depoimentos: depoimentos.length,
    },
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

// Quanto o modo automático pode salvar de uma vez. Com 15 resultados por busca
// a IA aprova com facilidade 10+ vídeos que explicam corretamente o mesmo
// programa — todos "certos", mas uma lista de 15 links iguais em "Recursos
// online" não ajuda ninguém a decidir o que abrir. O corte por plataforma
// garante variedade (vídeo + discussão + post + matéria) em vez de 15 vídeos.
const MAX_POR_PLATAFORMA_AUTO = 3;
const MAX_TOTAL_AUTO = 8;

// Ordem do que é mais útil pro catálogo, dentro do que a IA já aprovou:
// depoimento de brasileiro/lusófono primeiro, depois qualquer depoimento,
// depois o resto (anúncio/tutorial/página oficial). É aqui que os campos
// "brasileiro" e "relato" da avaliação são usados — eles não aprovam nem
// reprovam nada, só decidem quem entra quando há mais candidato bom do que
// vaga.
function ordemEditorial(a, b) {
  const peso = (c) => (c.brasileiro ? 0 : 2) + (c.relato ? 0 : 1);
  return peso(a) - peso(b);
}

// Automático — roda na aprovação da oportunidade. Diferente do fluxo manual
// (que devolve tudo pra um humano escolher), aqui só entra em
// `opportunities.resources` o que a IA marcou "sugerido" E "confianca: alta",
// e no máximo MAX_POR_PLATAFORMA_AUTO por plataforma / MAX_TOTAL_AUTO no total
// — o resto é descartado (não fica "pendente" em lugar nenhum). Não guarda
// nenhum "já checado" no banco: a ideia é rodar uma vez, perto da aprovação;
// se não achar nada bom, tudo bem — quem decide tentar de novo depois é um
// voluntário, clicando no botão "Enriquecer" na própria oportunidade.
export async function enriquecerAutomaticamente(supabase, opportunityId) {
  const resultado = await buscarCandidatosDeEnriquecimento(supabase, opportunityId);
  const porPlataforma = new Map();
  const aprovadosPelaIa = resultado.candidatos
    .filter((c) => c.sugerido && c.confianca === 'alta')
    .sort(ordemEditorial)
    .filter((c) => {
      const usados = porPlataforma.get(c.platform) || 0;
      if (usados >= MAX_POR_PLATAFORMA_AUTO) return false;
      porPlataforma.set(c.platform, usados + 1);
      return true;
    })
    .slice(0, MAX_TOTAL_AUTO);

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
