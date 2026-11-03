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
  /** Slug dei generi (vedi genresFromCategories). */
  genres?: string[];
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
    genres: b.genres ?? [],
    tropes: b.tropes,
    original_description: b.description ?? null,
    meta: b.meta ?? {},
  };
}

/**
 * Generi del catalogo (migrazione 0013) dedotti dalle categorie delle API, in inglese ("Fiction / Romance / Fantasy",
 * "Juvenile Fiction") o dai soggetti di Open Library. Solo una proposta: la redazione li corregge dal pannello.
 */
export function genresFromCategories(categories: string[], text = ''): string[] {
  const c = categories.join(' | ').toLowerCase();
  const all = `${c} ${text.toLowerCase()}`;
  const ya = /juvenile|young adult|ragazzi/.test(c);
  const fantasy = /fantasy|fairy|magic|dragon|fae/.test(c);
  const romance = /romance|love stor/.test(c);
  const out = new Set<string>();
  if (fantasy && romance) out.add('romantasy');
  else if (fantasy) out.add(ya ? 'fantasy-ya' : 'fantasy');
  else if (romance) {
    if (/historical/.test(c)) out.add('romance-storico');
    else if (/dark romance/.test(all)) out.add('dark-romance');
    else if (/sport|hockey|football/.test(c)) out.add('sports-romance');
    else out.add(/contemporary/.test(c) ? 'romance-contemporaneo' : 'romance');
  }
  if (ya && !out.has('fantasy-ya')) out.add('young-adult');
  if (/thriller|suspense/.test(c)) out.add('thriller');
  if (/mystery|detective|crime/.test(c)) out.add('giallo');
  if (/horror/.test(c)) out.add('horror');
  if (/science fiction|dystopi/.test(c)) out.add('fantascienza');
  return [...out];
}

/** Tropes già in catalogo, tra cui scegliere quelli di un libro nuovo. */
export async function knownTropes(sb: SupabaseClient | null): Promise<Array<{ slug: string; name: string }>> {
  if (!sb) return [];
  const { data, error } = await sb.from('tropes').select('slug, name');
  if (error) throw error;
  return data ?? [];
}
