import { describe, expect, test } from 'bun:test';
import {
  buildOpportunityResearchPlan, canonicalizeOpportunityUrl, catalogCoverageFields, catalogReviewPrompt,
  discoveryCandidateLimit, discoveryPrompt,
  discoveryScreeningStatus, expiredStatusChange, extractAdjacentLinks, isDuplicateOpportunity,
  findEligibilityEvidence, findExplicitClosedApplications, findProcessEvidence,
  findRelevantDeadlineEvidence, findRollingDeadlineEvidence, findUnambiguousDeadlineEvidence,
  isAcceptableDeadlineOutput, isCompleteDeadlineOutput, isPastDate, isPortugueseCatalogValue,
  normalizeDeadlineOutput, normalizeDiscoveryResult, normalizeEligibilityForCatalog,
  normalizeKeywordTags, normalizeLineList, normalizeLocationForCatalog, normalizeQualification,
  normalizeResearchBrief, qualificationAtomicSelection, qualificationCatalogPatch, researchBriefPrompt, researchOpportunityDossier,
  opportunityDiscoveryKey, parseDateParts, parseJsonObject, resolveProposalPatch, validateFieldEvidence,
  vagueDeadlineChange,
} from './sentinel';

describe('discoveryCandidateLimit', () => {
  test('processa toda a fila em uma única execução quando solicitado', () => {
    expect(discoveryCandidateLimit({ allQueued: true, maxCandidates: 1 })).toBe(500);
  });

  test('mantém o limite legado para chamadas parciais', () => {
    expect(discoveryCandidateLimit({ maxCandidates: 100 })).toBe(25);
    expect(discoveryCandidateLimit({})).toBe(10);
  });
});

describe('discoveryScreeningStatus', () => {
  test('usa a pontuação apenas para priorizar, nunca para rejeitar', () => {
    expect(discoveryScreeningStatus(-20)).toBe('queued');
    expect(discoveryScreeningStatus(4)).toBe('queued');
  });
});

describe('Sentinel catalog evidence validation', () => {
  test('orienta os modelos a escrever elegibilidade como lista curta', () => {
    for (const prompt of [discoveryPrompt(true), catalogReviewPrompt({})]) {
      expect(prompt).toContain('seção "Elegibilidade"');
      expect(prompt).toContain('seção "Sobre o processo"');
      expect(prompt).toContain('um por linha');
      expect(prompt).toContain('limite-o a 14 palavras');
      expect(prompt).toContain('nunca invente itens');
      expect(prompt).toContain('Estar entre o 5º e 9º ano do Ensino Fundamental');
      expect(prompt).toContain('mova para process todo conteúdo operacional ou explicativo');
    }
  });

  test('orienta a revisão a evitar requisitos redundantes entre campos', () => {
    const prompt = catalogReviewPrompt({ language: 'Inglês', location: 'Online' });

    expect(prompt).toContain('analise a oportunidade como um conjunto');
    expect(prompt).toContain('Não trate cada campo isoladamente');
    expect(prompt).toContain('Não escreva "Ser de qualquer lugar do mundo"');
    expect(prompt).toContain('não repita em eligibility requisitos genéricos como "Saber inglês"');
    expect(prompt).toContain('proponha sua limpeza quando ele repetir outros campos');
    expect(prompt).not.toContain('Enviar o formulário até o prazo');
  });

  test('usa a mesma etapa factual e somente o critério de jovens brasileiros', () => {
    const researchPrompt = researchBriefPrompt({}, buildOpportunityResearchPlan({}));
    expect(typeof researchOpportunityDossier).toBe('function');
    expect(researchPrompt).toContain('existe uma interseção não vazia entre quem pode participar e jovens brasileiros');
    expect(researchPrompt).toContain('a oportunidade não precisa atender a todos os jovens do Brasil');
    expect(researchPrompt).toContain('Restrições de estado, cidade, escola, rede de ensino, série, idade');
    expect(researchPrompt).toContain('priorize nesta ordem: regulamento ou página de candidatura');
    expect(catalogReviewPrompt({})).toContain('uma nunca substitui a outra');
    expect(discoveryPrompt(false)).toBe(discoveryPrompt(true));
    expect(discoveryPrompt(false)).not.toContain('14–18');
    expect(discoveryPrompt(false)).not.toContain('apoio financeiro substancial');
    expect(catalogReviewPrompt({})).not.toContain('audience');
    expect(discoveryPrompt(false)).not.toContain('audience');
  });

  test('valida literalmente o alcance a jovens brasileiros', () => {
    const sources = [{
      url: 'https://example.org/rules',
      text: 'Young people from all countries may apply. Applications are reviewed monthly.',
      trust: { trust_rank: 5 },
    }];
    expect(normalizeQualification({
      verdict: 'qualified', reason: 'Aberta a jovens de todos os países.',
      evidence: [{ quote: 'Young people from all countries may apply.', source_url: sources[0].url }],
    }, sources)).toMatchObject({ verdict: 'qualified' });
    const internationalSources = [{
      url: 'https://example.org/international',
      text: 'Students from both the U.S. and internationally are all eligible.',
      trust: { trust_rank: 5 },
    }];
    expect(normalizeQualification({
      verdict: 'qualified', reason: 'Estudantes internacionais podem participar.',
      evidence: [{ quote: internationalSources[0].text, source_url: internationalSources[0].url }],
    }, internationalSources)).toMatchObject({ verdict: 'qualified' });
    const cearaSources = [{
      url: 'https://example.org/ceara/rules',
      text: 'Você apenas precisa estar matriculado entre o 8º ano do ensino fundamental e o 3º ano do ensino médio, Supletivo ou Educação de Jovens e Adultos - EJA (equivalentes à Educação Básica), em uma escola cearense.',
      trust: { trust_rank: 5 },
    }];
    expect(normalizeQualification({
      verdict: 'qualified', reason: 'Estudantes de escolas cearenses nessas etapas podem participar.',
      evidence: [{ quote: cearaSources[0].text, source_url: cearaSources[0].url }],
    }, cearaSources)).toMatchObject({
      verdict: 'qualified',
      reason: 'Estudantes de escolas cearenses nessas etapas podem participar.',
    });
    const noBrazilReach = [{
      url: 'https://example.org/school',
      text: 'Programa para estudantes matriculados no ensino médio.',
      trust: { trust_rank: 5 },
    }];
    expect(normalizeQualification({
      verdict: 'qualified', reason: 'Aceita estudantes.',
      evidence: [{ quote: noBrazilReach[0].text, source_url: noBrazilReach[0].url }],
    }, noBrazilReach)).toMatchObject({ verdict: 'uncertain' });
    const excludedBrazil = [{
      url: 'https://example.org/excluded',
      text: 'Brazilian students are not eligible.',
      trust: { trust_rank: 5 },
    }];
    expect(normalizeQualification({
      verdict: 'qualified', reason: 'Menciona estudantes brasileiros.',
      evidence: [{ quote: excludedBrazil[0].text, source_url: excludedBrazil[0].url }],
    }, excludedBrazil)).toMatchObject({ verdict: 'uncertain' });
    const marketingOnly = [{
      url: 'https://example.org/global',
      text: 'A global program inspiring young students.',
      trust: { trust_rank: 4 },
    }];
    expect(normalizeQualification({
      verdict: 'qualified', reason: 'Programa global.',
      evidence: [{ quote: marketingOnly[0].text, source_url: marketingOnly[0].url }],
    }, marketingOnly)).toMatchObject({ verdict: 'uncertain' });
    expect(normalizeQualification({
      verdict: 'qualified', reason: 'Sem prova geográfica.',
      evidence: [{ quote: 'Applications are reviewed monthly.', source_url: sources[0].url }],
    }, sources)).toMatchObject({
      verdict: 'uncertain',
      reason: 'As citações coletadas não comprovam que ao menos um grupo de jovens brasileiros pode participar.',
      evidence: [{ trust_rank: 5 }],
    });
    expect(normalizeQualification({
      verdict: 'unqualified', reason: 'Somente residentes dos Estados Unidos.',
      evidence: [{ quote: 'Young people from all countries may apply.', source_url: 'https://invented.example' }],
    }, sources)).toMatchObject({ verdict: 'uncertain', evidence: [] });
    const restrictedSources = [{
      url: 'https://example.org/restricted',
      text: 'Applicants must be citizens or residents of the United States only.',
      trust: { trust_rank: 5 },
    }];
    expect(normalizeQualification({
      verdict: 'unqualified', reason: 'Exclui brasileiros.',
      evidence: [{ quote: restrictedSources[0].text, source_url: restrictedSources[0].url }],
    }, restrictedSources)).toMatchObject({ verdict: 'unqualified' });
  });

  test('converte vereditos em estados seguros do catálogo', () => {
    expect(qualificationCatalogPatch({ verdict: 'qualified', reason: 'Comprovado.' }, {})).toEqual({
      qualification_status: 'qualified', qualification_reason: null,
    });
    expect(qualificationCatalogPatch({ verdict: 'unqualified', reason: 'Exclui brasileiros.' }, { status: 'Aprovada' })).toEqual({
      qualification_status: 'unqualified', qualification_reason: 'Exclui brasileiros.', status: 'Rascunho',
    });
    expect(qualificationCatalogPatch({ verdict: 'uncertain', reason: 'Sem prova.' }, { status: 'Aprovada' })).toEqual({});
    expect(qualificationCatalogPatch({ verdict: 'uncertain', reason: 'Sem prova.' }, { status: 'Revisar' })).toEqual({});
    expect(qualificationCatalogPatch({ verdict: 'qualified', reason: 'Students from Brazil are eligible.' }, {})).toEqual({
      qualification_status: 'qualified', qualification_reason: null,
    });
    const changes = {
      qualification_status: { before: 'pending', after: 'unqualified' },
      qualification_reason: { before: null, after: 'Exclui brasileiros.' },
      status: { before: 'Aprovada', after: 'Rascunho' },
    };
    expect(qualificationAtomicSelection(['qualification_status'], changes)).toEqual([
      'qualification_status', 'qualification_reason', 'status',
    ]);
    expect(qualificationAtomicSelection(['status'], changes)).toEqual([
      'status', 'qualification_status', 'qualification_reason',
    ]);
  });

  test('normaliza local remoto e tags seletivas com nomes canônicos', () => {
    expect(normalizeLocationForCatalog('100% online, de qualquer lugar')).toBe('Remoto');
    expect(normalizeLocationForCatalog('Candidatura online; final presencial em São Paulo')).toBe('Candidatura online; final presencial em São Paulo');
    const allowed = [
      'Inovação social', 'Desenvolvimento de projetos', 'Liderança', 'Oratória',
      'Pesquisa científica', 'Projeto de lei', 'Viagem internacional', 'Rede de contatos',
    ];
    expect(normalizeKeywordTags([
      'Remoto', 'Inglês', 'Gratuito', 'Ensino Médio', 'Mentorias',
      'Inovação social', 'Desenvolvimento de projetos', 'Liderança', 'Oratória',
      'Pesquisa científica', 'Projeto de lei', 'Viagem internacional', 'Rede de contatos', 'Tag inventada',
    ], allowed)).toEqual([
      'Inovação social', 'Desenvolvimento de projetos', 'Liderança', 'Oratória',
      'Pesquisa científica', 'Projeto de lei', 'Viagem internacional', 'Rede de contatos',
    ]);
  });

  test('detects suspicious fields for a holistic coverage pass', () => {
    expect(catalogCoverageFields({
      description: 'palavra '.repeat(46),
      language: null,
      keywords: [],
      process: 'Registration can be done by students and school staff.',
      status: 'Revisar',
    }, { deadline: '4 de junho de 2026' })).toEqual([
      'description', 'language', 'keywords', 'process', 'status',
    ]);
  });

  test('revisa elegibilidade abstrata junto com o processo', () => {
    const fields = catalogCoverageFields({
      title: 'Câmara Mirim na Escola',
      eligibility: 'Crianças e adolescentes do 5º ao 9º ano podem participar. Os autores das melhores propostas são convidados para defendê-las na Câmara.',
      process: 'O projeto de lei deve abordar um dos temas indicados no regulamento.',
    }, {});

    expect(fields).toContain('eligibility');
    expect(fields).toContain('process');
  });

  test('repairs JSON truncated only by missing closing delimiters', () => {
    expect(parseJsonObject('{"updates":{"deadline":"4 de junho de 2026"},"evidence":{')).toEqual({
      updates: { deadline: '4 de junho de 2026' }, evidence: {},
    });
    expect(parseJsonObject('{"updates":{"description":"texto interrompido')).toEqual({
      updates: { description: 'texto interrompido' },
    });
  });

  test('normaliza marcadores sem alterar o conteúdo dos itens', () => {
    expect(normalizeLineList('- Ter de 14 a 18 anos\n• Morar no Brasil\n2. Morar no Brasil')).toBe(
      'Ter de 14 a 18 anos\nMorar no Brasil',
    );
  });

  test('remove redundância de alcance global e inglês da elegibilidade', () => {
    expect(normalizeEligibilityForCatalog(
      'Ser de qualquer lugar do mundo; Ser autor único; Trabalho em inglês e não publicado antes',
      'Inglês',
    )).toBe('Ser autor único\nNão ter o trabalho publicado antes');
    expect(normalizeEligibilityForCatalog(
      "Qualquer estudante de ensino médio do mundo (autor único); ensaio em inglês (4.000-6.000 palavras). Taxa de US$70.",
      'Inglês',
    )).toBe('Ser estudante de ensino médio\nSer autor único');
  });

  test('mantém formato, idioma e alcance internacional fora da elegibilidade', () => {
    expect(normalizeEligibilityForCatalog(
      'Estar no 11º ano, ter entre 15 e 18 anos e cumprir os pré-requisitos (física + pré-cálculo\nbiologia + química). Internacionais são elegíveis. Presencial nos EUA, em inglês.',
      'Inglês',
    )).toBe('Estar no 11º ano, ter entre 15 e 18 anos e cumprir os pré-requisitos (física + pré-cálculo biologia + química).');
  });

  test('condensa a elegibilidade da Câmara Mirim em um único critério objetivo', () => {
    expect(normalizeEligibilityForCatalog(
      'Crianças e adolescentes do 5º ao 9º ano do ensino fundamental podem participar do Câmara Mirim enviando um projeto de lei de sua autoria. Os autores das três melhores propostas são convidados do Plenarinho para defendê-las na Câmara.',
      'Português',
      { title: 'Câmara Mirim na Escola' },
    )).toBe('Estar entre o 5º e 9º ano do Ensino Fundamental');
  });

  test('aplica a mesma elegibilidade objetiva na descoberta de oportunidades', () => {
    const sourceUrl = 'https://example.org/camara-mirim';
    const parsed = {
      qualified: true,
      title: 'Câmara Mirim na Escola',
      link: sourceUrl,
      language: 'Português',
      eligibility: 'Crianças e adolescentes do 5º ao 9º ano do ensino fundamental podem participar enviando um projeto de lei. Os melhores projetos são apresentados na Câmara.',
    };
    const { result } = normalizeDiscoveryResult(parsed, {
      sources: [{ url: sourceUrl, text: parsed.eligibility }],
    }, sourceUrl);

    expect(result.eligibility).toBe('Estar entre o 5º e 9º ano do Ensino Fundamental');
    expect(result.level).toEqual([]);
  });

  test('mantém oportunidades qualificadas encerradas sem tratá-las como desqualificadas', () => {
    const sourceUrl = 'https://example.org/programa';
    const quote = 'Registration closes on January 4, 2020.';
    const { result, rejectionReason } = normalizeDiscoveryResult({
      title: 'Programa para jovens',
      description: 'Programa internacional para jovens brasileiros.',
      link: sourceUrl,
      deadline: '4 de janeiro de 2020',
      evidence: { deadline: { quote, source_url: sourceUrl, kind: 'application_deadline' } },
    }, { sources: [{ url: sourceUrl, text: quote }] }, sourceUrl);

    expect(rejectionReason).toBeUndefined();
    expect(result.status).toBe('Encerrada');
  });

  test('recupera citações literais relevantes quando o modelo parafraseia a fonte', () => {
    const sources = [{
      url: 'https://example.org/regulamento',
      text: 'Os autores enviam o projeto. Podem participar estudantes do 5º ao 9º ano do Ensino Fundamental. O formulário deve ser preenchido e enviado até o prazo.',
    }];

    expect(findEligibilityEvidence(sources, 'Estar entre o 5º e 9º ano do Ensino Fundamental').quote)
      .toContain('5º ao 9º ano');
    const processEvidence = findProcessEvidence(sources);
    expect(processEvidence.quote).toContain('formulário');
    expect(validateFieldEvidence('process', 'Preencha e envie o formulário.', processEvidence, sources).valid).toBe(true);
  });

  test('formats Portuguese dates without a leading zero', () => {
    expect(normalizeDeadlineOutput('04 de setembro de 2026')).toBe('4 de setembro de 2026');
    expect(normalizeDeadlineOutput('04/06/2026')).toBe('4 de junho de 2026');
    expect(normalizeDeadlineOutput('14 de novembro de 2026')).toBe('14 de novembro de 2026');
  });

  test('rejects an event date presented as an application deadline', () => {
    const quote = 'BMT 2026 will be held on November 14, 2026';
    const result = validateFieldEvidence('deadline', '14 de novembro de 2026', {
      quote, source_url: 'https://bmt.berkeley.edu/', kind: 'application_deadline',
    }, [{ url: 'https://bmt.berkeley.edu/', text: quote }]);
    expect(result.valid).toBe(false);
    expect(result.reason).toContain('não um prazo');
  });

  test('accepts a literal deadline citation whose edition year appears earlier', () => {
    const quote = 'GENIUS 2026 extended application deadline is March 7 at 9:00 AM (U.S. EST)';
    const result = validateFieldEvidence('deadline', '07 de março de 2026', {
      quote, source_url: 'https://geniusolympiad.org/apply', kind: 'application_deadline',
    }, [{ url: 'https://geniusolympiad.org/apply', text: `News: ${quote}.` }]);
    expect(result.valid).toBe(true);
    expect(parseDateParts(quote)).toEqual({ day: 7, month: 3, year: 2026 });
    expect(isPastDate('07 de março de 2026', new Date('2026-08-07T12:00:00Z'))).toBe(true);
    expect(expiredStatusChange('07 de março de 2026', 'Aprovada', new Date('2026-08-07T12:00:00Z'))).toEqual({
      before: 'Aprovada', after: 'Encerrada',
    });
  });

  test('requires catalog values to be translated to Portuguese', () => {
    expect(isPortugueseCatalogValue('cost', '$60 application fee per project')).toBe(false);
    expect(isPortugueseCatalogValue('cost', 'Taxa de inscrição de US$ 60 por projeto')).toBe(true);
  });

  test('prioritizes adjacent application and deadline pages', () => {
    const links = extractAdjacentLinks(`
      <a href="/event">Event</a>
      <a href="https:&#x2F;&#x2F;example.org&#x2F;apply">Apply now</a>
      <a href="/important-dates">Important dates and registration deadlines</a>
      <a href="/event-logistics">Tournament day logistics</a>
    `, 'https://example.org/program');
    expect(links.map((link) => link.url)).toEqual([
      'https://example.org/important-dates',
      'https://example.org/apply',
    ]);
  });

  test('follows submission links and avoids neighboring program rules', () => {
    const links = extractAdjacentLinks(`
      <a href="/submit">Submit</a>
      <a href="/obmf-regulamento">Regulamento OBMF</a>
      <a href="/obgp-regulamento">Regulamento OBGP</a>
    `, 'https://example.org/obmf', { title: 'Olimpíada Brasileira de Matemática Financeira', year: '2026' });
    expect(links.map((link) => link.url)).toEqual([
      'https://example.org/obmf-regulamento',
      'https://example.org/submit',
    ]);
  });

  test('discovers application documents exposed as markdown links', () => {
    const links = extractAdjacentLinks(
      '[Regulamento 2026](https://example.org/regulamento-2026.pdf)',
      'https://example.org/programa',
      { title: 'Programa 2026', year: '2026' },
    );
    expect(links[0]).toMatchObject({ url: 'https://example.org/regulamento-2026.pdf', label: 'Regulamento 2026' });
  });

  test('accepts literal evidence despite HTML entities and punctuation spacing', () => {
    const source = {
      url: 'https://example.org/rules',
      text: 'A competi&ccedil;&atilde;o &eacute; online. Escola privada: R$ 20,00 por aluno.',
    };
    expect(validateFieldEvidence('cost', 'R$ 20 por aluno de escola privada', {
      quote: 'A competição é online. Escola privada R$ 20,00 por aluno',
      source_url: source.url,
    }, [source]).valid).toBe(true);
  });

  test('requires evidence to mention language and the application process semantically', () => {
    const source = { url: 'https://example.org/rules', text: 'A prova é online. Inscrições pelo formulário oficial.' };
    expect(validateFieldEvidence('language', 'Inglês', {
      quote: 'A prova é online.', source_url: source.url,
    }, [source]).valid).toBe(false);
    expect(validateFieldEvidence('process', 'Preencha o formulário oficial.', {
      quote: 'A prova é online.', source_url: source.url,
    }, [source]).valid).toBe(false);
    expect(validateFieldEvidence('process', 'Preencha o formulário oficial.', {
      quote: 'Inscrições pelo formulário oficial.', source_url: source.url,
    }, [source]).valid).toBe(true);
  });

  test('deduplicates title variants for the same official opportunity', () => {
    const existing = {
      title: 'SDG Innovation Summit Malaysia 2026',
      link: 'https://thegyn.org/sism-2026/',
    };
    const extracted = {
      title: 'SDG Innovation Summit Malaysia 2026 – Fully Funded Conference',
      link: 'https://www.thegyn.org/sism-2026/?utm_source=instagram',
    };
    expect(canonicalizeOpportunityUrl(extracted.link)).toBe('https://thegyn.org/sism-2026');
    expect(isDuplicateOpportunity(existing, extracted)).toBe(true);
    expect(opportunityDiscoveryKey(existing.link, existing.title)).toBe(opportunityDiscoveryKey(extracted.link, extracted.title));
  });

  test('allows distinct programs to share an organization landing page', () => {
    expect(isDuplicateOpportunity({
      title: 'Campeonato Nacional de Debates Escolares', link: 'https://instagram.com/ibdebates',
    }, {
      title: 'USP Schools', link: 'https://instagram.com/ibdebates/',
    })).toBe(false);
  });
});

describe('Sentinel proposal edits', () => {
  test('normaliza textos e listas editados antes de atualizar o catálogo', () => {
    expect(resolveProposalPatch(
      ['eligibility', 'areas', 'deadline'],
      { eligibility: 'Original', areas: ['Humanas'], deadline: '04 de setembro de 2026' },
      { eligibility: '- Ter de 14 a 18 anos\n• Morar no Brasil', areas: 'STEM\nArtes' },
    )).toEqual({
      patch: {
        eligibility: 'Ter de 14 a 18 anos\nMorar no Brasil',
        areas: ['STEM', 'Artes'],
        deadline: '4 de setembro de 2026',
      },
      editorFields: ['eligibility', 'areas'],
    });
  });

  test('planeja a pesquisa antes de converter informações em campos', () => {
    const opportunity = { title: 'Câmara Mirim 2026', link: 'https://plenarinho.leg.br/index.php/camara-mirim/' };
    const plan = buildOpportunityResearchPlan(opportunity);
    const prompt = researchBriefPrompt(opportunity, plan);

    expect(plan.map((topic) => topic.id)).toEqual([
      'current_cycle', 'deadline_status', 'participation', 'brazilian_youth', 'application', 'logistics_support',
    ]);
    expect(prompt).toContain('ANTES de pensar nos campos do catálogo');
    expect(prompt).toContain('página principal, edição vigente, notícia, regulamento e formulário');
  });

  test('segue a trilha Câmara Mirim até a edição atual e o regulamento', () => {
    const context = { title: 'Câmara Mirim', year: '2026' };
    const landingLinks = extractAdjacentLinks(`
      <a href="/index.php/2026/07/vote-no-eleitor-mirim-2026/">Vote no Eleitor Mirim 2026!</a>
      <a href="/index.php/camara-mirim/para-os-estudantes/">Para estudantes</a>
      <a href="/index.php/camara-mirim/para-os-professores/">Para educadores(as)</a>
    `, 'https://plenarinho.leg.br/index.php/camara-mirim/', context);
    expect(landingLinks.slice(0, 2).map((link) => link.url)).toEqual([
      'https://plenarinho.leg.br/index.php/camara-mirim/para-os-estudantes/',
      'https://plenarinho.leg.br/index.php/camara-mirim/para-os-professores/',
    ]);

    const hubLinks = extractAdjacentLinks(`
      <a href="/index.php/2025/05/camara-mirim-2025/">Câmara Mirim 2025</a>
      <a href="/index.php/2026/05/camara-mirim-2026-edicao-especial/">Incentive sua escola a participar do Câmara Mirim 2026!</a>
    `, landingLinks[0].url, context);
    expect(hubLinks[0].url).toContain('/2026/05/camara-mirim-2026-edicao-especial/');

    const editionLinks = extractAdjacentLinks(`
      <a href="/index.php/2026/05/regulamento-para-inscricao-e-selecao-de-educadoresas-no-camara-mirim-2026/">Consulte o regulamento aqui</a>
    `, hubLinks[0].url, context);
    expect(editionLinks[0].url).toContain('/regulamento-para-inscricao');
  });

  test('mantém no dossiê apenas fatos com citação literal em fonte coletada', () => {
    const sources = [{ url: 'https://example.org/rules', text: 'Inscrições até 28 de agosto de 2026.' }];
    const plan = buildOpportunityResearchPlan({ title: 'Programa 2026' });
    expect(normalizeResearchBrief({ facts: [
      { topic: 'deadline_status', fact: 'Inscrições terminam em 28 de agosto.', quote: 'Inscrições até 28 de agosto de 2026.', source_url: sources[0].url },
      { topic: 'participation', fact: 'Aceita qualquer estudante.', quote: 'Trecho inventado.', source_url: sources[0].url },
    ] }, sources, plan).facts).toHaveLength(1);
  });

  test('permite que a avaliação factual reduza, mas não infle, a confiança preliminar', () => {
    const sources = [{
      url: 'https://aggregator.example/rules', text: 'Students may apply.',
      trust: { authority: 'official_rules_or_application', trust_rank: 5 },
    }];
    const brief = normalizeResearchBrief({
      source_assessments: [{
        source_url: sources[0].url, authority: 'third_party_or_unverified', reason: 'Agregador sem vínculo oficial.',
      }],
    }, sources, buildOpportunityResearchPlan({ title: 'Programa' }));
    expect(brief.source_assessments[0]).toMatchObject({
      authority: 'third_party_or_unverified', trust_rank: 2,
    });
  });

  test('normaliza datas em inglês antes de validar a proposta', () => {
    expect(normalizeDeadlineOutput('Application deadline: September 4, 2026')).toBe('4 de setembro de 2026');
  });

  test('encontra a data de prazo mesmo quando a citação contém outra data', () => {
    const quote = 'The program starts on June 1, 2026. Applications close on May 4, 2026.';
    const result = validateFieldEvidence('deadline', '4 de maio de 2026', {
      quote, source_url: 'https://example.org/apply', kind: 'application_deadline',
    }, [{ url: 'https://example.org/apply', text: quote }]);
    expect(result.valid).toBe(true);
    expect(validateFieldEvidence('deadline', '1 de junho de 2026', {
      quote, source_url: 'https://example.org/apply', kind: 'application_deadline',
    }, [{ url: 'https://example.org/apply', text: quote }]).valid).toBe(false);
  });

  test('recupera um único prazo completo diretamente do texto oficial', () => {
    const source = {
      url: 'https://example.org/apply',
      text: 'Applications are open. The application deadline is September 4, 2026. Results follow later.',
    };
    expect(findUnambiguousDeadlineEvidence([source])).toMatchObject({
      value: '4 de setembro de 2026', source_url: source.url, kind: 'application_deadline',
    });
  });

  test('escolhe o próximo prazo aberto quando Câmara Mirim tem modalidades independentes', () => {
    const source = {
      url: 'https://plenarinho.leg.br/index.php/2026/05/camara-mirim-2026-edicao-especial/',
      text: 'Prazo de inscrições para a jornada parlamentar: prorrogado até 19/06/2026. Prazo de inscrições para as visitas especiais: até 28/08/2026.',
    };
    expect(findRelevantDeadlineEvidence([source], new Date('2026-08-08T12:00:00Z'))).toMatchObject({
      value: '28 de agosto de 2026', source_url: source.url, kind: 'application_deadline',
    });
  });

  test('recovers the end of a registration range for the current edition', () => {
    const source = {
      url: 'https://example.org/olimpiada',
      text: 'OBBS 2026 Inscrições: 20/05 a 31/07. Primeira fase: 08/09 a 14/09.',
    };
    expect(findRelevantDeadlineEvidence(
      [source], new Date('2026-08-08T12:00:00Z'), { title: 'OBBS 2026' },
    )).toMatchObject({
      value: '31 de julho de 2026', source_url: source.url, kind: 'application_deadline',
    });
    expect(validateFieldEvidence('deadline', '31 de julho de 2026', {
      quote: source.text, source_url: source.url, kind: 'application_deadline',
    }, [source]).valid).toBe(true);
  });

  test('recovers a numeric date whose year is stated in the edition context', () => {
    const source = {
      url: 'https://example.org/regulamento',
      text: 'Regulamento OBMF 2026.2. Término das Inscrições: 23/09. Prova: 30/09.',
    };
    expect(findRelevantDeadlineEvidence([source], new Date('2026-08-08T12:00:00Z'))).toMatchObject({
      value: '23 de setembro de 2026', source_url: source.url, kind: 'application_deadline',
    });
  });

  test('recovers the end of a written registration period from a document', () => {
    const source = {
      url: 'https://example.org/regulamento.pdf',
      text: 'O período de inscrições para a edição de 2026 será de 16 de julho de 2026 a 21 de agosto de 2026.',
    };
    expect(findRelevantDeadlineEvidence([source], new Date('2026-08-08T12:00:00Z'))).toMatchObject({
      value: '21 de agosto de 2026', source_url: source.url, kind: 'application_deadline',
    });
    expect(validateFieldEvidence('deadline', '21 de agosto de 2026', {
      quote: source.text, source_url: source.url, kind: 'application_deadline',
    }, [source]).valid).toBe(true);
  });

  test('reads registration dates that precede their labels in document calendars', () => {
    const iypt = {
      url: 'https://example.org/iypt.pdf',
      text: 'Calendário Data Atividade 01/09/2025 a 27/10/2025 Período para preenchimento do formulário de participação e pagamento da taxa de inscrição. 03/11/2025 Prazo final para envio de relatório e vídeos da 1ª Fase.',
    };
    expect(findRelevantDeadlineEvidence([iypt], new Date('2026-08-08T12:00:00Z'))).toMatchObject({
      value: '27 de outubro de 2025', source_url: iypt.url,
    });
    const obrl = {
      url: 'https://example.org/obrl.pdf',
      text: '05.09.2026 Término das Inscrições para OBRL. De 24.08 a 09.09.2026 Período para realização da prova presencial.',
    };
    expect(findRelevantDeadlineEvidence([obrl], new Date('2026-08-08T12:00:00Z'), { title: 'OBRL 2026' })).toMatchObject({
      value: '5 de setembro de 2026', source_url: obrl.url,
    });
  });

  test('recovers rolling submissions from an official submission page', () => {
    const source = {
      url: 'https://example.org/submit',
      text: 'Essays are accepted on a rolling basis. Submit one file through the online form.',
    };
    expect(findRollingDeadlineEvidence([source])).toMatchObject({
      value: 'Inscrições contínuas', source_url: source.url, kind: 'rolling_deadline',
    });
    expect(validateFieldEvidence('deadline', 'Inscrições contínuas', {
      quote: source.text, source_url: source.url, kind: 'rolling_deadline',
    }, [source]).valid).toBe(true);
  });

  test('deriva o tipo de evidência de prazo da própria citação', () => {
    const quote = 'Prazo de inscrições para as visitas especiais: até 28/08/2026.';
    const result = validateFieldEvidence('deadline', '28 de agosto de 2026', {
      quote, source_url: 'https://example.org/apply', kind: 'field_evidence',
    }, [{ url: 'https://example.org/apply', text: quote }]);
    expect(result.valid).toBe(true);
    expect(result.evidence.kind).toBe('application_deadline');
  });

  test('detecta inscrições explicitamente encerradas sem inventar uma data', () => {
    const source = { url: 'https://example.org/apply', text: 'Applications for the 2026 program are now closed.' };
    expect(findExplicitClosedApplications([source], { title: 'Program 2026' })).toMatchObject({
      source_url: source.url, kind: 'closed_applications',
    });
    expect(findExplicitClosedApplications([source], { title: 'Program 2027' })).toBeNull();
  });

  test('aceita apenas datas completas ou inscrições explicitamente contínuas', () => {
    expect(isCompleteDeadlineOutput('4 de setembro de 2026')).toBe(true);
    expect(isCompleteDeadlineOutput('31 de fevereiro de 2026')).toBe(false);
    expect(isAcceptableDeadlineOutput('Inscrições contínuas')).toBe(true);
    expect(isAcceptableDeadlineOutput('Contínuo')).toBe(true);
    expect(isAcceptableDeadlineOutput('agosto')).toBe(false);
    expect(isAcceptableDeadlineOutput('agosto de 2026')).toBe(false);
  });

  test('remove prazos vagos existentes quando a pesquisa não encontra uma data completa', () => {
    expect(vagueDeadlineChange('agosto')).toEqual({ before: 'agosto', after: null });
    expect(vagueDeadlineChange('4 de setembro de 2026')).toBeNull();
  });

  test('rejeita valores editados fora da taxonomia', () => {
    expect(() => resolveProposalPatch(['type'], { type: 'Mentorias' }, { type: 'Workshop' })).toThrow(
      'O valor editado de type é inválido.',
    );
  });

  test('rejeita um prazo manual sem dia, mês e ano', () => {
    expect(() => resolveProposalPatch(
      ['deadline'],
      { deadline: '4 de setembro de 2026' },
      { deadline: 'agosto' },
    )).toThrow('O valor editado de deadline é inválido.');
  });
});
