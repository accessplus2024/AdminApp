import { isSupabaseConfigured, supabase } from './supabase';

export const TAG_CATEGORIES = ['Tema', 'Atividade', 'Habilidade', 'Entrega', 'Benefício'];

export function tagSlug(value) {
  return String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLocaleLowerCase('pt-BR')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

export function normalizeTagNames(values) {
  const seen = new Set();
  return (Array.isArray(values) ? values : [])
    .map((value) => String(value || '').trim())
    .filter((value) => {
      const key = value.toLocaleLowerCase('pt-BR');
      if (!value || seen.has(key)) return false;
      seen.add(key);
      return true;
    });
}

export async function fetchOpportunityTags({ activeOnly = false } = {}) {
  if (!isSupabaseConfigured) return [];
  let query = supabase
    .from('opportunity_tags')
    .select('*')
    .order('category')
    .order('sort_order')
    .order('name');
  if (activeOnly) query = query.eq('active', true);
  const { data, error } = await query;
  if (error) throw new Error(error.message);
  return data || [];
}

export async function createOpportunityTag(input) {
  const row = {
    name: String(input.name || '').trim(),
    slug: tagSlug(input.slug || input.name),
    category: input.category,
    description: String(input.description || '').trim(),
    active: input.active !== false,
    sort_order: Number(input.sort_order) || 0,
  };
  const { data, error } = await supabase.from('opportunity_tags').insert(row).select().single();
  if (error) throw new Error(error.message);
  return data;
}

export async function updateOpportunityTag(id, input) {
  const { data, error } = await supabase.rpc('update_opportunity_tag', {
    tag_id: Number(id),
    next_name: String(input.name || '').trim(),
    next_slug: tagSlug(input.slug || input.name),
    next_category: input.category,
    next_description: String(input.description || '').trim(),
    next_active: input.active !== false,
    next_sort_order: Number(input.sort_order) || 0,
  });
  if (error) throw new Error(error.message);
  return data;
}

export async function archiveOpportunityTag(tag) {
  return updateOpportunityTag(tag.id, { ...tag, active: false });
}
