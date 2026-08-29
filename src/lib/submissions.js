// Leitura e revisão das oportunidades enviadas por organizações pelo
// formulário público do site (tabela opportunity_submissions — ver
// supabase/migrations/20260829120000_create_opportunity_submissions.sql
// pra entender por que essa fila é separada da do Sentinel).
import { supabase, isSupabaseConfigured } from './supabase';
import { createOpportunity } from './opportunities';

export const SUBMISSION_STATUS = {
  pending: { label: 'Aguardando revisão', variant: 'warning' },
  qualified: { label: 'Aprovada', variant: 'success' },
  duplicate: { label: 'Duplicada', variant: 'neutral' },
  rejected: { label: 'Rejeitada', variant: 'danger' },
};

export async function fetchSubmissions() {
  if (!isSupabaseConfigured) return [];
  const { data, error } = await supabase
    .from('opportunity_submissions')
    .select('*')
    .order('created_at', { ascending: false });
  if (error) throw new Error(error.message);
  return data || [];
}

// Aprova: cria a oportunidade de verdade (status 'Revisar' — ainda não fica
// pública sozinha, só entra na fila "Em revisão" de sempre pra um editor
// completar dicas/recursos antes de publicar de fato) e fecha a submissão.
export async function approveSubmission(sub) {
  const opp = await createOpportunity({
    title: sub.title,
    link: sub.link,
    description: `Oferecida por ${sub.organization_name}.\n\n${sub.description}`,
    type: sub.type,
    deadline: sub.deadline,
    level: sub.level,
    areas: sub.areas,
    location: sub.location,
    cost: sub.cost,
    format: sub.format,
    eligibility: sub.eligibility,
    status: 'Revisar',
  });

  const { data: sessionData } = await supabase.auth.getSession();
  const { error } = await supabase
    .from('opportunity_submissions')
    .update({
      status: 'qualified',
      opportunity_id: opp.id,
      reviewed_by: sessionData?.session?.user?.id || null,
      processed_at: new Date().toISOString(),
    })
    .eq('id', sub.id);
  if (error) throw new Error(error.message);

  return opp;
}

export async function markSubmission(sub, status, reviewNote = null) {
  const { data: sessionData } = await supabase.auth.getSession();
  const { error } = await supabase
    .from('opportunity_submissions')
    .update({
      status,
      review_note: reviewNote,
      reviewed_by: sessionData?.session?.user?.id || null,
      processed_at: new Date().toISOString(),
    })
    .eq('id', sub.id);
  if (error) throw new Error(error.message);
}
