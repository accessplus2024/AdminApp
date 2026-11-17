import { describe, expect, test } from 'bun:test';
import { buildOpportunityResearchPlan, discoveryResearchUrl, findGeographicExclusionEvidence, findStructuralIneligibilityEvidence, normalizeResearchBrief, processPost, researchExistingOpportunity, validateFieldEvidence } from './sentinel.js';

// The MCP server (mcp/server.js) runs the catalog review with the client's
// model answers injected via `deps`. These tests pin that the injected path
// still goes through the full deterministic validation.
const opportunity = {
  id: 1, title: 'Global Youth Essay Prize', link: 'https://prize.example.org/apply', deadline: 'agosto',
  status: 'Aprovada', description: 'Prêmio.', level: [], areas: ['Humanas'], keywords: [], language: '',
  type: 'Competições de Escrita', cost: 'Gratuito',
};
const sourceText = 'Global Youth Essay Prize. Students aged 14 to 18 from any country may apply. '
  + 'Applications close on 15 March 2027. There is no entry fee.';
const research = () => ({
  sources: [{ url: opportunity.link, relation: 'Página inicial', text: sourceText, trust: { authority: 'official_rules_or_application', trust_rank: 5 } }],
  plan: buildOpportunityResearchPlan(opportunity), pageFetches: 1, adjacentFailures: [],
});
const brief = {
  facts: [
    { topic: 'eligibility', fact: 'Aberto a estudantes de 14 a 18 anos de qualquer país.', quote: 'Students aged 14 to 18 from any country may apply.', source_url: opportunity.link },
    { topic: 'deadline_status', fact: 'Inventado.', quote: 'Applications close on 1 January 2030.', source_url: opportunity.link },
  ],
  qualification: { verdict: 'qualified', reason: 'Aberto a qualquer país.', evidence: [{ quote: 'Students aged 14 to 18 from any country may apply.', source_url: opportunity.link }] },
  source_assessments: [], gaps: [], conflicts: [],
};
const mapping = {
  updates: { deadline: '1 de janeiro de 2030', cost: 'US$ 50' },
  evidence: {
    deadline: { quote: 'Applications close on 1 January 2030.', source_url: opportunity.link, kind: 'application_deadline' },
    cost: { quote: 'There is no entry fee.', source_url: opportunity.link, kind: 'field_evidence' },
  },
};
function injectedModel(answers) {
  const queue = [...answers];
  const fn = async () => {
    fn.calls += 1;
    const parsed = queue.shift();
    if (!parsed) throw new Error('no more answers');
    return { parsed, content: JSON.stringify(parsed), model: 'mcp:test', attempts: [{ model: 'mcp:test', status: 'succeeded' }], metrics: { modelCalls: 1, pageFetches: 0, inputTokens: 0, outputTokens: 0 } };
  };
  fn.calls = 0;
  return fn;
}

describe('Sentinel review with injected (MCP client) model', () => {
  test('drops research facts whose quote is not literally in a source', () => {
    const validated = normalizeResearchBrief(brief, research().sources, research().plan);
    expect(validated.facts).toHaveLength(1);
    expect(validated.qualification.verdict).toBe('qualified');
  });

  test('uses injected research and answers, and still validates every field', async () => {
    const structuredModel = injectedModel([brief, mapping, { updates: {}, evidence: {} }]);
    const result = await researchExistingOpportunity(null, 0, opportunity, [], { structuredModel, research: research() });
    expect(result.status).toBe('pending');
    expect(structuredModel.calls).toBe(3);
    // Made-up deadline is rejected; the real one is recovered from the source.
    expect(result.row.changes.deadline).toEqual({ before: 'agosto', after: '15 de março de 2027' });
    // A price is never a valid catalog cost.
    expect(result.row.changes.cost).toBeUndefined();
    expect(result.row.evidence._sentinel.selected_model).toBe('mcp:test');
    expect(result.row.evidence._sentinel.validation_notes.join(' ')).toContain('deadline descartado');
  });
});

describe('Sentinel evidence patterns (real cases, 2026-11-07)', () => {
  const page = (text) => [{ url: 'https://contest.example.org', text, trust: { trust_rank: 5 } }];

  test('"open only to" a school grade is not a geographic exclusion', () => {
    // Kenyon Review Patricia Grodd Prize: "(Open Only to High School Sophomores and Juniors)".
    expect(findGeographicExclusionEvidence(page('The Prize for Young Writers (Open Only to High School Sophomores and Juniors)'))).toBeNull();
    expect(findGeographicExclusionEvidence(page('This call is open only to citizens of Kenya.'))).not.toBeNull();
    expect(findGeographicExclusionEvidence(page('The fellowship is open only to students from Ghana.'))).not.toBeNull();
  });

  test('accepts "Submit between X and Y, YYYY" as an application deadline', () => {
    const quote = 'Submit between November 1 and November 30, 2026.';
    expect(validateFieldEvidence('deadline', '30 de novembro de 2026', { quote, source_url: 'https://contest.example.org' }, page(quote)).valid).toBe(true);
  });

  test('accepts "Submission Deadline" with an abbreviated month', () => {
    // Lumiere Scholars Essay Award: "Submission Deadline Dec 20, 2026".
    const quote = 'Submission Deadline Dec 20, 2026';
    expect(validateFieldEvidence('deadline', '20 de dezembro de 2026', { quote, source_url: 'https://contest.example.org' }, page(`Free Registration Deadline Nov 30, 2026 ${quote} Shortlist Announcement Jan 4, 2027`)).valid).toBe(true);
    expect(validateFieldEvidence('deadline', '30 de novembro de 2026', { quote, source_url: 'https://contest.example.org' }, page(quote)).valid).toBe(false);
  });

  // Real quotes dropped on 2026-11-16 (RSI, BMT Online, One Teen Story).
  test.each([
    ['Applications for RSI 2027 are open through 11:59pm E.T. December 11, 2026.', '11 de dezembro de 2026'],
    ['You may register for BMT 2026 Online on ContestDojo starting Monday, September 14 at 9:00 AM and until November 27, 2026 at 11:59 PM US Pacific Time.', '27 de novembro de 2026'],
    ['The 2027 One Teen Story Teen Writing Contest is open for submissions and will close on December 1, 2026.', '1 de dezembro de 2026'],
  ])('accepts deadline wording: %s', (quote, value) => {
    expect(validateFieldEvidence('deadline', value, { quote, source_url: 'https://contest.example.org' }, page(quote)).valid).toBe(true);
  });

  test('event dates still do not count as deadlines', () => {
    const quote = 'The tournament will be held on December 5, 2026.';
    expect(validateFieldEvidence('deadline', '5 de dezembro de 2026', { quote, source_url: 'https://contest.example.org' }, page(quote)).valid).toBe(false);
  });
});

describe('Structural ineligibility: postgraduate mentions (real cases, 2026-11-07)', () => {
  const src = (url, text) => ({ url, text, trust: { trust_rank: 5, authority: 'official_rules_or_application' } });

  test('a "PhD" menu item does not reject a program open to bachelor\'s students', () => {
    const sources = [
      src('https://lab.example.org/internship', 'Who: Bachelor’s and master’s students in computer science and related fields.'),
      src('https://lab.example.org/faq', 'For students FAQ Application process PhD / doctoral studies Research internships'),
    ];
    expect(findStructuralIneligibilityEvidence(sources)).toBeNull();
  });

  test('still rejects when only postgraduate students can apply', () => {
    const sources = [src('https://lab.example.org/fellowship', 'Applicants must be PhD candidates in molecular biology.')];
    expect(findStructuralIneligibilityEvidence(sources)).not.toBeNull();
  });
});

// --- Discovery (new opportunities) through the MCP path -----------------------
// A tiny chainable fake of the supabase-js calls processPost/findOrCreateOpportunity
// make. Records every write so tests can assert nothing was overwritten.
function fakeSupabase({ opportunities = [] } = {}) {
  const writes = [];
  const rows = { opportunities: [...opportunities], sentinel_posts: [] };
  const from = (table) => {
    const state = { table, op: 'select', filters: [], payload: null };
    const apply = () => (rows[table] || []).filter((row) => state.filters.every(([col, val]) => row[col] === val));
    const result = () => {
      if (state.op === 'insert') {
        const row = { id: 900 + rows[table].length, ...state.payload };
        rows[table].push(row);
        writes.push({ table, op: 'insert', row });
        return { data: row, error: null };
      }
      if (state.op === 'update') {
        writes.push({ table, op: 'update', payload: state.payload, filters: state.filters });
        return { data: null, error: null };
      }
      return { data: apply(), error: null };
    };
    const builder = {
      select: () => builder,
      eq: (col, val) => { state.filters.push([col, val]); return builder; },
      not: () => builder,
      insert: (payload) => { state.op = 'insert'; state.payload = payload; return builder; },
      update: (payload) => { state.op = 'update'; state.payload = payload; return builder; },
      maybeSingle: async () => { const r = result(); return { data: Array.isArray(r.data) ? r.data[0] || null : r.data, error: null }; },
      single: async () => result(),
      then: (resolve, reject) => Promise.resolve(result()).then(resolve, reject),
    };
    return builder;
  };
  return { from, writes, rows };
}

describe('Sentinel discovery with injected (MCP client) model', () => {
  const link = 'https://newprize.example.org/apply';
  const discoverySource = 'New Horizons Science Prize. High school students from any country may apply. '
    + 'Applications close on 15 December 2026. Participation is free of charge. '
    + 'Students submit a research project in physics or biology and receive mentorship from scientists.';
  const discoveryResearch = () => ({
    sources: [{ url: link, relation: 'Fonte inicial', text: discoverySource, trust: { authority: 'official_rules_or_application', trust_rank: 5 } }],
    plan: buildOpportunityResearchPlan({ link }), pageFetches: 1, adjacentFailures: [],
  });
  const discoveryBrief = {
    facts: [{ topic: 'eligibility', fact: 'Alunos do ensino médio de qualquer país.', quote: 'High school students from any country may apply.', source_url: link }],
    qualification: { verdict: 'qualified', reason: 'Aberto a qualquer país.', evidence: [{ quote: 'High school students from any country may apply.', source_url: link }] },
    source_assessments: [], gaps: [], conflicts: [],
  };
  const entry = {
    title: 'New Horizons Science Prize', link, deadline: '15 de dezembro de 2026', type: 'Competições',
    description: 'Competição de pesquisa científica em que estudantes desenvolvem um projeto de física ou biologia com mentoria de cientistas.',
    areas: ['STEM'], level: ['Ensino Médio'], audience: [], location: 'Remoto', cost: 'Gratuito', language: 'Inglês',
    keywords: [], eligibility: 'Estar cursando o ensino médio',
    evidence: {
      deadline: { quote: 'Applications close on 15 December 2026.', source_url: link, kind: 'application_deadline' },
      eligibility: { quote: 'High school students from any country may apply.', source_url: link, kind: 'field_evidence' },
    },
  };
  const post = { url: link, caption: '', ownerUsername: 'manual' };

  test('creates a new opportunity in Revisar from the client answers', async () => {
    const supabase = fakeSupabase();
    const structuredModel = injectedModel([discoveryBrief, entry]);
    const result = await processPost(supabase, post, 1, true, [], { overwriteDuplicates: false, deps: { structuredModel, research: discoveryResearch() } });
    expect(result.status).toBe('qualified');
    expect(result.created).toBe(true);
    const inserted = supabase.writes.find((w) => w.table === 'opportunities' && w.op === 'insert').row;
    expect(inserted.status).toBe('Revisar');
    expect(inserted.deadline).toBe('15 de dezembro de 2026');
    expect(inserted.qualification_status).toBe('qualified');
  });

  test('a duplicate newer edition never overwrites the catalog row when overwriteDuplicates is false', async () => {
    const existing = { id: 7, title: 'New Horizons Science Prize', link, status: 'Aprovada', deadline: '15 de dezembro de 2025', description: 'x' };
    const supabase = fakeSupabase({ opportunities: [existing] });
    const structuredModel = injectedModel([discoveryBrief, entry]);
    const result = await processPost(supabase, post, 1, true, [], { overwriteDuplicates: false, deps: { structuredModel, research: discoveryResearch() } });
    expect(result.status).toBe('duplicate');
    expect(result.created).toBe(false);
    expect(result.opportunity.id).toBe(7);
    expect(supabase.writes.filter((w) => w.table === 'opportunities')).toHaveLength(0);
  });

  test('an unqualified brief rejects the lead without touching the catalog', async () => {
    const supabase = fakeSupabase();
    const restricted = 'Only residents of Kenya may apply. Applications close on 15 December 2026.';
    const research = { ...discoveryResearch(), sources: [{ url: link, relation: 'Fonte inicial', text: restricted, trust: { authority: 'official_rules_or_application', trust_rank: 5 } }] };
    const brief = { ...discoveryBrief, facts: [], qualification: { verdict: 'unqualified', reason: 'Só residentes do Quênia.', evidence: [{ quote: 'Only residents of Kenya may apply.', source_url: link }] } };
    const result = await processPost(supabase, post, 1, true, [], { overwriteDuplicates: false, deps: { structuredModel: injectedModel([brief]), research } });
    expect(result.status).toBe('rejected');
    expect(supabase.writes.filter((w) => w.table === 'opportunities')).toHaveLength(0);
  });

  test('official_url overrides the caption link', () => {
    expect(discoveryResearchUrl({ sourceUrl: 'https://instagram.com/p/x', caption: 'link https://agg.example.com/a', officialUrl: 'https://official.example.org' })).toBe('https://official.example.org');
    expect(discoveryResearchUrl({ sourceUrl: 'https://instagram.com/p/x', caption: 'link https://agg.example.com/a' })).toBe('https://agg.example.com/a');
  });
});
