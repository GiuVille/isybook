// Libro proposto per la coda di revisione: la stessa forma per l'import per ISBN e per le uscite notturne,
// così l'approvazione (approveReviewItem in src/admin/review.ts) è una sola.
import type { SupabaseClient } from '@supabase/supabase-js';
import { slugify } from '../../src/admin/resources.ts';

export interface BookInput {
  title: string;
  authors: string[];
  publisher?: string | null;
  isbn?: string | null;
  format: string; // paperback | hardcover | kindle | audio
  editionType: string; // standard | special | limited
  releaseDate?: string | null;
  language?: string | null;
  coverUrl?: string | null;
  pages?: number | null;
  series?: string | null;
  seriesNumber?: number | null;
  /** Campi in più dell'edizione quando si conoscono: tiratura, dettagli della special, prezzo. */
  editionExtra?: { print_run?: number | null; details?: string | null; price?: number | null };
  plot: string | null;
  tropes: string[];
  /** Descrizione dell'editore: solo riferimento in revisione, non si pubblica. */
  description?: string | null;
  meta?: Record<string, unknown>;
}

export function bookPayload(b: BookInput) {
  return {
    work: {
      title: b.title,
      slug: slugify(b.title),
      plot: b.plot,
      series: b.series ?? null,
      series_number: b.seriesNumber ?? null,
      origin: 'publisher',
    },
    authors: b.authors.map((name) => ({ name, slug: slugify(name) })),
    publisher: b.publisher ? { name: b.publisher, slug: slugify(b.publisher) } : null,
    edition: {
      isbn: b.isbn ?? null,
      format: b.format,
      edition_type: b.editionType,
      release_date: b.releaseDate ?? null,
      language: b.language ?? 'it',
      cover_url: b.coverUrl ?? null,
      pages: b.pages ?? null,
      purchase_links: [],
      ...b.editionExtra,
    },
    genres: [],
    tropes: b.tropes,
    original_description: b.description ?? null,
    meta: b.meta ?? {},
  };
}

/** Tropes già in catalogo, tra cui scegliere quelli di un libro nuovo. */
export async function knownTropes(sb: SupabaseClient | null): Promise<Array<{ slug: string; name: string }>> {
  if (!sb) return [];
  const { data, error } = await sb.from('tropes').select('slug, name');
  if (error) throw error;
  return data ?? [];
}
