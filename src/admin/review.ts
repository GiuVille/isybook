// Approvazione di un elemento della coda: trasforma il payload proposto in righe reali.
// Libri: editore, autori, opera, edizione, generi, tropi. Promozioni: editore, promozione, libri coinvolti.
import type { SupabaseClient } from '@supabase/supabase-js';
import { slugify } from './resources';

type Row = Record<string, any>;

export interface BookPayload {
  work: { title: string; slug?: string; plot?: string | null; series?: string | null; series_number?: number | null; origin?: string };
  authors: Array<{ name: string; slug?: string }>;
  publisher?: { name: string; slug?: string } | null;
  edition: Row;
  genres?: string[]; // slug
  tropes?: string[]; // slug
}

export interface PromotionPayload {
  title: string;
  slug?: string;
  publisher?: { name: string; slug?: string } | null;
  kind: string;
  reward?: string | null;
  conditions?: string | null;
  description?: string | null;
  starts_on?: string | null;
  ends_on?: string | null;
  channel?: string;
  where_note?: string | null;
  url?: string | null;
  source_url?: string | null;
  works?: string[]; // titoli dei libri citati: collegati solo se sono già in catalogo
}

/** Cosa è stato creato approvando: per aprirlo subito nell'admin. */
export interface Approved {
  resource: 'works' | 'promotions';
  id: string;
}

async function ensureBySlug(sb: SupabaseClient, table: string, values: Row): Promise<string> {
  const slug = values.slug || slugify(values.name ?? values.title);
  const found = await sb.from(table).select('id').eq('slug', slug).maybeSingle();
  if (found.error) throw found.error;
  if (found.data) return found.data.id;
  const inserted = await sb.from(table).insert({ ...values, slug }).select('id').single();
  if (inserted.error) throw inserted.error;
  return inserted.data.id;
}

async function idsBySlug(sb: SupabaseClient, table: string, slugs: string[] = []): Promise<string[]> {
  if (slugs.length === 0) return [];
  const { data, error } = await sb.from(table).select('id').in('slug', slugs);
  if (error) throw error;
  return (data ?? []).map((r) => r.id);
}

async function link(sb: SupabaseClient, table: string, rows: Row[]) {
  if (rows.length === 0) return;
  const { error } = await sb.from(table).upsert(rows, { ignoreDuplicates: true });
  if (error) throw error;
}

async function markApproved(sb: SupabaseClient, item: Row, reviewerId: string) {
  const { error } = await sb
    .from('review_queue')
    .update({ status: 'approved', reviewed_by: reviewerId, reviewed_at: new Date().toISOString() })
    .eq('id', item.id);
  if (error) throw error;
}

/** Slug libero: se è già usato aggiunge -2, -3… */
async function freeSlug(sb: SupabaseClient, table: string, base: string): Promise<string> {
  const { data, error } = await sb.from(table).select('slug').like('slug', `${base}%`);
  if (error) throw error;
  const taken = new Set((data ?? []).map((r) => r.slug));
  let slug = base;
  for (let n = 2; taken.has(slug); n++) slug = `${base}-${n}`;
  return slug;
}

async function approvePromotion(sb: SupabaseClient, item: Row, reviewerId: string): Promise<string> {
  const p = item.payload as PromotionPayload;
  const publisherId = p.publisher ? await ensureBySlug(sb, 'publishers', { name: p.publisher.name, slug: p.publisher.slug }) : null;
  const slug = await freeSlug(sb, 'promotions', p.slug || slugify(p.title));
  const inserted = await sb
    .from('promotions')
    .insert({
      slug,
      title: p.title,
      publisher_id: publisherId,
      kind: p.kind,
      reward: p.reward ?? null,
      conditions: p.conditions ?? null,
      description: p.description ?? null,
      starts_on: p.starts_on || null,
      ends_on: p.ends_on || null,
      channel: p.channel ?? 'everywhere',
      where_note: p.where_note ?? null,
      url: p.url ?? null,
      source_url: p.source_url ?? null,
      status: 'published',
    })
    .select('id')
    .single();
  if (inserted.error) throw inserted.error;
  const promotionId = inserted.data.id;
  const workIds = await idsBySlug(sb, 'works', (p.works ?? []).map(slugify));
  await link(sb, 'promotion_works', workIds.map((work_id) => ({ promotion_id: promotionId, work_id })));
  await markApproved(sb, item, reviewerId);
  return promotionId;
}

/** Approva un elemento della coda e pubblica ciò che propone. */
export async function approveReviewItem(sb: SupabaseClient, item: Row, reviewerId: string): Promise<Approved> {
  if (item.content_type === 'promotion') return { resource: 'promotions', id: await approvePromotion(sb, item, reviewerId) };
  if (item.content_type !== 'book') throw new Error(`Tipo non gestito: ${item.content_type}`);
  const p = item.payload as BookPayload;

  const publisherId = p.publisher ? await ensureBySlug(sb, 'publishers', { name: p.publisher.name, slug: p.publisher.slug }) : null;
  const authorIds = await Promise.all(p.authors.map((a) => ensureBySlug(sb, 'authors', { name: a.name, slug: a.slug })));
  const workId = await ensureBySlug(sb, 'works', { ...p.work, status: 'published' });

  await link(sb, 'work_authors', authorIds.map((author_id) => ({ work_id: workId, author_id })));
  await link(sb, 'work_genres', (await idsBySlug(sb, 'genres', p.genres)).map((genre_id) => ({ work_id: workId, genre_id })));
  await link(sb, 'work_tropes', (await idsBySlug(sb, 'tropes', p.tropes)).map((trope_id) => ({ work_id: workId, trope_id })));

  const edition: Row = { ...p.edition, work_id: workId, publisher_id: publisherId };
  const saved = edition.isbn
    ? await sb.from('editions').upsert(edition, { onConflict: 'isbn' })
    : await sb.from('editions').insert(edition);
  if (saved.error) throw saved.error;

  await markApproved(sb, item, reviewerId);
  return { resource: 'works', id: workId };
}
