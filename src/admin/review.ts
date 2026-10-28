// Approvazione di un elemento della coda: trasforma il payload proposto
// in righe reali (editore, autori, opera, edizione, generi, tropi).
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

/** Approva un libro proposto e restituisce l'id dell'opera. */
export async function approveReviewItem(sb: SupabaseClient, item: Row, reviewerId: string): Promise<string> {
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

  const { error } = await sb
    .from('review_queue')
    .update({ status: 'approved', reviewed_by: reviewerId, reviewed_at: new Date().toISOString() })
    .eq('id', item.id);
  if (error) throw error;

  return workId;
}
