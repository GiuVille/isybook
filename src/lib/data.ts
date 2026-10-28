// Unico punto di accesso ai dati del sito: Supabase se configurato,
// altrimenti i dati di esempio in src/data/sample.json.
// Restituisce solo contenuti con status = 'published' (lato DB lo garantisce anche la RLS).
import sample from '../data/sample.json';
import { getSupabase, supabaseConfigured } from './supabase';
import type { Adaptation, Article, Author, BookEvent, Edition, Merch, Publisher, Section, Tag, Work } from './types';

const MERCH_FIELDS = 'id, name, kind, shop, price, url, affiliate, edition_id, status';

const WORK_SELECT = `
  id, slug, title, plot, series, series_number, origin, spice_level,
  work_authors ( authors ( id, slug, name, bio ) ),
  work_genres ( genres ( id, slug, name, theme ) ),
  work_tropes ( tropes ( id, slug, name ) ),
  work_settings ( settings ( id, slug, name ) ),
  editions (
    id, isbn, format, release_date, price, language, edition_type, first_print, pages, print_run, details, cover_url, purchase_links,
    publishers ( id, slug, name, kind, website ),
    merch ( ${MERCH_FIELDS} )
  ),
  merch_works ( merch ( ${MERCH_FIELDS} ) ),
  adaptations ( id, title, kind, platform, release_date, production_status, tmdb_id, status )
`;

type Row = Record<string, any>;

function mapWork(row: Row): Work {
  return {
    id: row.id,
    slug: row.slug,
    title: row.title,
    plot: row.plot,
    series: row.series,
    series_number: row.series_number,
    origin: row.origin,
    spice_level: row.spice_level,
    authors: (row.work_authors ?? []).map((r: Row) => r.authors).filter(Boolean),
    genres: (row.work_genres ?? []).map((r: Row) => r.genres).filter(Boolean),
    tropes: (row.work_tropes ?? []).map((r: Row) => r.tropes).filter(Boolean),
    settings: (row.work_settings ?? []).map((r: Row) => r.settings).filter(Boolean),
    editions: (row.editions ?? [])
      .map((e: Row): Edition => ({ ...e, publisher: e.publishers ?? null, purchase_links: e.purchase_links ?? [] } as Edition))
      .sort(byReleaseDate),
    adaptations: (row.adaptations ?? []).filter((a: Row) => a.status === 'published'),
    merch: uniqueById([
      ...(row.merch_works ?? []).map((r: Row) => r.merch),
      ...(row.editions ?? []).flatMap((e: Row) => e.merch ?? []),
    ]).filter((m: Row) => m.status === 'published'),
  };
}

function uniqueById<T extends { id: string }>(items: Array<T | null | undefined>): T[] {
  return [...new Map(items.filter((i): i is T => Boolean(i)).map((i) => [i.id, i])).values()];
}

function byReleaseDate(a: Edition, b: Edition) {
  return (a.release_date ?? '').localeCompare(b.release_date ?? '');
}

function sampleWorks(): Work[] {
  const find = <T extends { id: string }>(list: T[], ids: string[]) => list.filter((x) => ids.includes(x.id));
  return sample.works.map((w) => ({
    ...w,
    origin: w.origin as Work['origin'],
    authors: find(sample.authors as Author[], w.author_ids),
    genres: find(sample.genres as Tag[], w.genre_ids),
    tropes: find(sample.tropes as Tag[], w.trope_ids),
    settings: find(sample.settings as Tag[], (w as { setting_ids?: string[] }).setting_ids ?? []),
    editions: w.editions
      .map((e) => ({
        ...e,
        format: e.format as Edition['format'],
        edition_type: e.edition_type as Edition['edition_type'],
        first_print: Boolean((e as { first_print?: boolean }).first_print),
        publisher: (sample.publishers as Publisher[]).find((p) => p.id === e.publisher_id) ?? null,
      }))
      .sort(byReleaseDate),
    adaptations: (w as { adaptations?: Adaptation[] }).adaptations ?? [],
    merch: (w as { merch?: Merch[] }).merch ?? [],
  }));
}

export async function getWorks(): Promise<Work[]> {
  if (!supabaseConfigured) return sampleWorks();
  const { data, error } = await getSupabase()
    .from('works')
    .select(WORK_SELECT)
    .eq('status', 'published')
    .order('title');
  if (error) throw error;
  return (data ?? []).map(mapWork);
}

export async function getWorkBySlug(slug: string): Promise<Work | undefined> {
  return (await getWorks()).find((w) => w.slug === slug);
}

/** Edizioni con la loro opera, per calendario uscite ed edizioni speciali. */
export async function getEditionsWithWork(): Promise<Array<Edition & { work: Work }>> {
  const works = await getWorks();
  return works
    .flatMap((work) => work.editions.map((e) => ({ ...e, work })))
    .sort(byReleaseDate);
}

export async function getEvents(): Promise<BookEvent[]> {
  if (!supabaseConfigured) {
    return sample.events
      .map((e) => ({
        ...e,
        kind: e.kind as BookEvent['kind'],
        authors: (sample.authors as Author[]).filter((a) => e.author_ids.includes(a.id)),
        works: sample.works.filter((w) => e.work_slugs.includes(w.slug)).map((w) => ({ slug: w.slug, title: w.title })),
      }))
      .sort((a, b) => a.starts_on.localeCompare(b.starts_on));
  }
  const { data, error } = await getSupabase()
    .from('events')
    .select(
      'id, slug, title, kind, starts_on, ends_on, venue, city, url, description, ' +
        'event_authors ( authors ( id, slug, name, bio ) ), event_works ( works ( slug, title, status ) )',
    )
    .eq('status', 'published')
    .order('starts_on');
  if (error) throw error;
  return (data ?? []).map((e: Row) => ({
    ...e,
    authors: (e.event_authors ?? []).map((r: Row) => r.authors).filter(Boolean),
    works: (e.event_works ?? [])
      .map((r: Row) => r.works)
      .filter((w: Row | null) => w?.status === 'published')
      .map((w: Row) => ({ slug: w.slug, title: w.title })),
  })) as BookEvent[];
}

export async function getSections(): Promise<Section[]> {
  if (!supabaseConfigured) return sample.sections;
  const { data, error } = await getSupabase().from('sections').select('id, slug, name, description').order('name');
  if (error) throw error;
  return data ?? [];
}

export async function getArticles(): Promise<Article[]> {
  if (!supabaseConfigured) {
    return sample.articles
      .map((a) => ({ ...a, section: sample.sections.find((s) => s.id === a.section_id) ?? null }))
      .sort((a, b) => (b.published_at ?? '').localeCompare(a.published_at ?? ''));
  }
  const { data, error } = await getSupabase()
    .from('articles')
    .select('id, slug, title, excerpt, body, published_at, sections ( id, slug, name, description )')
    .eq('status', 'published')
    .order('published_at', { ascending: false });
  if (error) throw error;
  return (data ?? []).map((a: Row) => ({ ...a, section: a.sections ?? null }) as Article);
}
