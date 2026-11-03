// Approvazione di un elemento della coda: trasforma il payload proposto in righe reali.
// Libri: editore, autori, opera, edizione, generi, tropi, ambientazioni (solo le voci approvate da chi rivede). Promozioni: editore, promozione, libri coinvolti.
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
  settings?: string[]; // slug
  /** Voci nuove approvate da chi rivede: vengono create prima del collegamento. */
  new_genres?: Array<{ name: string; slug: string }>;
  new_tropes?: Array<{ name: string; slug: string }>;
  new_settings?: Array<{ name: string; slug: string }>;
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
  image_url?: string | null;
  image_credit?: string | null;
  image_alt?: string | null;
  works?: string[]; // titoli dei libri citati: collegati solo se sono già in catalogo
}

/** Cosa è stato creato approvando: per aprirlo subito nell'admin. */
export interface Approved {
  resource: 'works' | 'promotions' | 'adaptations';
  id: string;
}

/** Trama da approvare per un libro già pubblicato senza trama (semina automatica del catalogo). */
export interface PlotPayload {
  work_id: string;
  work_slug: string;
  title: string;
  authors?: string[];
  cover_url?: string | null;
  plot: string | null; // riscritta in automatico: si pubblica solo dopo l'approvazione
  tropes?: string[]; // slug suggeriti
  new_tropes?: Array<{ name: string; slug: string }>;
  original_description?: string | null; // solo riferimento, mai pubblicata
}

/** Serie o film tratto da un libro, proposto dall'import da TMDB. */
export interface AdaptationPayload {
  work_id: string;
  work_title: string;
  adaptation: Row; // colonne della tabella adaptations (senza work_id e status)
  original_overview?: string | null; // trama di TMDB: solo riferimento
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

async function markApproved(sb: SupabaseClient, item: Row, reviewerId: string | null) {
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

async function approvePromotion(sb: SupabaseClient, item: Row, reviewerId: string | null): Promise<string> {
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
      image_url: p.image_url ?? null,
      image_credit: p.image_url ? (p.image_credit ?? null) : null,
      image_alt: p.image_url ? (p.image_alt ?? null) : null,
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
export async function approveReviewItem(sb: SupabaseClient, item: Row, reviewerId: string | null): Promise<Approved> {
  if (item.content_type === 'promotion') return { resource: 'promotions', id: await approvePromotion(sb, item, reviewerId) };
  if (item.content_type === 'plot') return { resource: 'works', id: await approvePlot(sb, item, reviewerId) };
  if (item.content_type === 'adaptation') return { resource: 'adaptations', id: await approveAdaptation(sb, item, reviewerId) };
  if (item.content_type !== 'book') throw new Error(`Tipo non gestito: ${item.content_type}`);
  const workId = await publishBook(sb, item.payload as BookPayload);
  await markApproved(sb, item, reviewerId);
  return { resource: 'works', id: workId };
}

/**
 * Crea (o completa) opera, autori, editore ed edizione di un libro. Usata dall'approvazione e dalla semina
 * automatica del catalogo, che pubblica subito i dati del libro e manda in coda solo la trama.
 */
export async function publishBook(sb: SupabaseClient, p: BookPayload): Promise<string> {
  const publisherId = p.publisher ? await ensureBySlug(sb, 'publishers', { name: p.publisher.name, slug: p.publisher.slug }) : null;
  const authorIds = await Promise.all(p.authors.map((a) => ensureBySlug(sb, 'authors', { name: a.name, slug: a.slug })));
  const workId = await ensureBySlug(sb, 'works', { ...p.work, status: 'published' });

  await link(sb, 'work_authors', authorIds.map((author_id) => ({ work_id: workId, author_id })));
  for (const g of p.new_genres ?? []) await ensureBySlug(sb, 'genres', g);
  for (const t of p.new_tropes ?? []) await ensureBySlug(sb, 'tropes', t);
  for (const s of p.new_settings ?? []) await ensureBySlug(sb, 'settings', s);
  await link(sb, 'work_genres', (await idsBySlug(sb, 'genres', p.genres)).map((genre_id) => ({ work_id: workId, genre_id })));
  await link(sb, 'work_tropes', (await idsBySlug(sb, 'tropes', p.tropes)).map((trope_id) => ({ work_id: workId, trope_id })));
  await link(sb, 'work_settings', (await idsBySlug(sb, 'settings', p.settings)).map((setting_id) => ({ work_id: workId, setting_id })));

  const edition: Row = { ...p.edition, work_id: workId, publisher_id: publisherId };
  const saved = edition.isbn
    ? await sb.from('editions').upsert(edition, { onConflict: 'isbn' })
    : await sb.from('editions').insert(edition);
  if (saved.error) throw saved.error;
  return workId;
}

/** Trama approvata (eventualmente corretta) e tropes scelti per un libro già pubblicato. */
async function approvePlot(sb: SupabaseClient, item: Row, reviewerId: string | null): Promise<string> {
  const p = item.payload as PlotPayload;
  if (!p.plot?.trim()) throw new Error('La trama è vuota: scrivila prima di approvare');
  const { error } = await sb.from('works').update({ plot: p.plot.trim() }).eq('id', p.work_id);
  if (error) throw error;
  for (const t of p.new_tropes ?? []) await ensureBySlug(sb, 'tropes', t);
  await link(sb, 'work_tropes', (await idsBySlug(sb, 'tropes', p.tropes)).map((trope_id) => ({ work_id: p.work_id, trope_id })));
  await markApproved(sb, item, reviewerId);
  return p.work_id;
}

/** Serie o film proposto da TMDB: pubblicato e collegato al libro. */
async function approveAdaptation(sb: SupabaseClient, item: Row, reviewerId: string | null): Promise<string> {
  const p = item.payload as AdaptationPayload;
  const a = p.adaptation;
  // se c'è già (stesso id TMDB) si aggiorna, altrimenti si crea con uno slug libero
  const existing = a.tmdb_id ? await sb.from('adaptations').select('id').eq('tmdb_id', a.tmdb_id).maybeSingle() : { data: null, error: null };
  if (existing.error) throw existing.error;
  const row = { ...a, work_id: p.work_id, status: 'published' };
  let id: string;
  if (existing.data) {
    const { error } = await sb.from('adaptations').update(row).eq('id', existing.data.id);
    if (error) throw error;
    id = existing.data.id;
  } else {
    let slug = a.slug || slugify(a.title);
    for (let n = 2; (await sb.from('adaptations').select('id').eq('slug', slug).maybeSingle()).data; n++) slug = `${a.slug || slugify(a.title)}-${n}`;
    const { data, error } = await sb.from('adaptations').insert({ ...row, slug }).select('id').single();
    if (error) throw error;
    id = data.id;
  }
  await markApproved(sb, item, reviewerId);
  return id;
}
