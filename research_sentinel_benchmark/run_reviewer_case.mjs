import { createClient } from '@supabase/supabase-js';
import {
  fetchResearchSources,
  findRelevantDeadlineEvidence,
  findRollingDeadlineEvidence,
  researchExistingOpportunity,
  validateFieldEvidence,
} from '../api/sentinel.js';

const opportunityId = Number(process.argv[2]);
if (!Number.isFinite(opportunityId)) {
  throw new Error('Informe o ID numérico da oportunidade.');
}

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY
  || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  || process.env.VITE_SUPABASE_PUBLISHABLE_KEY
  || process.env.VITE_SUPABASE_ANON_KEY;
if (!supabaseUrl || !supabaseKey) {
  throw new Error('Credenciais públicas do Supabase não configuradas.');
}

const supabase = createClient(supabaseUrl, supabaseKey, {
  auth: { persistSession: false, autoRefreshToken: false },
});
const { data: opportunity, error } = await supabase
  .from('opportunities')
  .select('*')
  .eq('id', opportunityId)
  .single();
if (error) throw error;

if (process.argv.includes('--deadline-only')) {
  const research = await fetchResearchSources(opportunity.link, opportunity);
  const rolling = findRollingDeadlineEvidence(research.sources);
  process.stdout.write(JSON.stringify({
    deadline: findRelevantDeadlineEvidence(research.sources, new Date(), opportunity),
    rolling,
    rolling_validation: rolling ? validateFieldEvidence('deadline', rolling.value, rolling, research.sources) : null,
    deadline_contexts: research.sources.map((source) => ({
      url: source.url,
      excerpts: String(source.text).match(/.{0,100}(?:inscri|deadline|rolling).{0,180}/gi)?.slice(0, 8) || [],
    })),
  }, null, 2));
  process.exit(0);
}

// Null persistence arguments deliberately exercise the reviewer without writing
// a research run or proposal to the production database.
const result = await researchExistingOpportunity(null, null, opportunity);
const sentinel = result.row?.evidence?._sentinel || {};
const output = {
  opportunity_id: opportunityId,
  reviewer_status: result.status,
  original: result.row?.original,
  proposed: result.row?.proposed,
  changes: result.row?.changes,
  evidence: Object.fromEntries(Object.entries(result.row?.evidence || {}).filter(([key]) => key !== '_sentinel')),
  notes: result.row?.notes,
  error: result.row?.error,
  research: {
    plan: sentinel.research_plan,
    brief: sentinel.research_brief,
    sources: sentinel.sources,
    adjacent_failures: sentinel.adjacent_failures,
  },
  metrics: result.metrics,
};

const summary = process.argv.includes('--summary') ? {
  opportunity_id: opportunityId,
  title: opportunity.title,
  reviewer_status: result.status,
  qualification: sentinel.research_brief?.qualification,
  proposed_fields: Object.keys(result.row?.changes || {}),
  proposed: Object.fromEntries(Object.entries(result.row?.proposed || {}).filter(([field]) => [
    'deadline', 'status', 'qualification_status', 'qualification_reason', 'eligibility', 'process', 'location', 'keywords',
  ].includes(field))),
  sources: (sentinel.sources || []).map((source) => ({
    url: source.url,
    relation: source.relation,
    authority: source.trust?.authority,
    trust_rank: source.trust?.trust_rank,
  })),
  error: result.row?.error,
  metrics: result.metrics,
} : output;

process.stdout.write(JSON.stringify(summary, null, 2));
