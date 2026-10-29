// Unico punto di accesso ai dati del sito: Supabase se configurato,
// altrimenti i dati di esempio in src/data/sample.json.
// Restituisce solo contenuti con status = 'published' (lato DB lo garantisce anche la RLS).
import sample from '../data/sample.json';
import { getSupabase, supabaseConfigured } from './supabase';
import type { Adaptation, Author, BookEvent, Edition, Merch, Promotion, Publisher, Tag, Work } from './types';

const MERCH_FIELDS = 'id, name, kind, shop, price, url, affiliate, edition_id, status';

const WORK_SELECT = `
  id, slug, title, plot, series, series_number, origin, spice_level,
  work_authors ( authors ( id, slug, name, bio, social_links ) ),
  work_genres ( genres ( id, slug, name, theme ) ),
  work_tropes ( tropes ( id, slug, name ) ),
  work_settings ( settings ( id, slug, name ) ),
  editions (
    id, isbn, format, release_date, price, language, edition_type, first_print, pages, print_run, details, cover_url, purchase_links,
    publishers ( id, slug, name, kind, website ),
    merch ( ${MERCH_FIELDS} )
  ),
  merch_works ( merch ( ${MERCH_FIELDS} ) ),
  adaptations (
    id, slug, title, kind, platform, release_date, production_status, tmdb_id, status,
    plot, poster_url, seasons, episodes, runtime_minutes, watch_providers,
    adaptation_genres ( genres ( id, slug, name, theme ) ),
    adaptation_tropes ( tropes ( id, slug, name ) )
  )
`;

type Row = Record<string, any>;

/** Adattamento completo: se non ha generi o tropes propri li eredita dal libro. */
function buildAdaptation(
  raw: Row & { genres: Tag[]; tropes: Tag[] },
  work: Pick<Work, 'slug' | 'title' | 'authors' | 'genres' | 'tropes'>,
): Adaptation {
  return {
    id: raw.id,
    slug: raw.slug ?? `${work.slug}-${raw.kind === 'film' ? 'film' : 'serie'}`,
    title: raw.title,
    kind: raw.kind,
    platform: raw.platform,
    release_date: raw.release_date,
    production_status: raw.production_status,
    tmdb_id: raw.tmdb_id,
    plot: raw.plot,
    poster_url: raw.poster_url,
    seasons: raw.seasons,
    episodes: raw.episodes,
    runtime_minutes: raw.runtime_minutes,
    watch_providers: raw.watch_providers ?? [],
    genres: raw.genres.length ? raw.genres : work.genres,
    tropes: raw.tropes.length ? raw.tropes : work.tropes,
    inherited: { genres: raw.genres.length === 0, tropes: raw.tropes.length === 0 },
    source: { slug: work.slug, title: work.title, authors: work.authors },
  };
}

function mapWork(row: Row): Work {
  const work = {
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
    adaptations: [] as Adaptation[],
    merch: uniqueById([
      ...(row.merch_works ?? []).map((r: Row) => r.merch),
      ...(row.editions ?? []).flatMap((e: Row) => e.merch ?? []),
    ]).filter((m: Row) => m.status === 'published'),
  };
  work.adaptations = (row.adaptations ?? [])
    .filter((a: Row) => a.status === 'published')
    .map((a: Row) =>
      buildAdaptation(
        {
          ...a,
          genres: (a.adaptation_genres ?? []).map((r: Row) => r.genres).filter(Boolean),
          tropes: (a.adaptation_tropes ?? []).map((r: Row) => r.tropes).filter(Boolean),
        },
        work,
      ),
    );
  return work;
}

function uniqueById<T extends { id: string }>(items: Array<T | null | undefined>): T[] {
  return [...new Map(items.filter((i): i is T => Boolean(i)).map((i) => [i.id, i])).values()];
}

function byReleaseDate(a: Edition, b: Edition) {
  return (a.release_date ?? '').localeCompare(b.release_date ?? '');
}

function sampleWorks(): Work[] {
  const find = <T extends { id: string }>(list: T[], ids: string[]) => list.filter((x) => ids.includes(x.id));
  return sample.works.map((w) => {
    const work: Work = {
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
      adaptations: [],
      merch: (w as { merch?: Merch[] }).merch ?? [],
    };
    type RawAdaptation = Row & { genre_ids?: string[]; trope_ids?: string[] };
    work.adaptations = ((w as { adaptations?: RawAdaptation[] }).adaptations ?? []).map((a) =>
      buildAdaptation(
        { ...a, genres: find(sample.genres as Tag[], a.genre_ids ?? []), tropes: find(sample.tropes as Tag[], a.trope_ids ?? []) },
        work,
      ),
    );
    return work;
  });
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

/** Autori con almeno un libro pubblicato, in ordine alfabetico. */
export async function getAuthors(): Promise<Author[]> {
  const works = await getWorks();
  const map = new Map<string, Author>();
  for (const w of works) for (const a of w.authors) map.set(a.slug, a);
  return [...map.values()].sort((a, b) => a.name.localeCompare(b.name, 'it'));
}

/** Tutte le serie e i film pubblicati, tratti da libri pubblicati. */
export async function getAdaptations(): Promise<Adaptation[]> {
  return (await getWorks())
    .flatMap((w) => w.adaptations)
    .sort((a, b) => a.title.localeCompare(b.title, 'it'));
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
        'event_authors ( authors ( id, slug, name, bio, social_links ) ), event_works ( works ( slug, title, status ) )',
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

/** Promozioni pubblicate, dalla fine più vicina; quelle senza scadenza in fondo. */
export async function getPromotions(): Promise<Promotion[]> {
  const byEnd = (a: Promotion, b: Promotion) => (a.ends_on ?? '9999').localeCompare(b.ends_on ?? '9999');
  if (!supabaseConfigured) {
    return sample.promotions
      .map(
        ({ publisher_id, work_slugs, ...p }): Promotion => ({
          ...p,
          kind: p.kind as Promotion['kind'],
          channel: p.channel as Promotion['channel'],
          publisher: (sample.publishers as Publisher[]).find((x) => x.id === publisher_id) ?? null,
          works: sample.works.filter((w) => work_slugs.includes(w.slug)).map((w) => ({ slug: w.slug, title: w.title })),
        }),
      )
      .sort(byEnd);
  }
  const { data, error } = await getSupabase()
    .from('promotions')
    .select(
      'id, slug, title, kind, description, conditions, reward, starts_on, ends_on, channel, where_note, url, image_url, image_credit, image_alt, source_url, ' +
        'publishers ( id, slug, name, kind, website ), promotion_works ( works ( slug, title, status ) )',
    )
    .eq('status', 'published');
  if (error) throw error;
  return (data ?? [])
    .map(({ publishers, promotion_works, ...p }: Row) => ({
      ...p,
      publisher: publishers ?? null,
      works: (promotion_works ?? [])
        .map((r: Row) => r.works)
        .filter((w: Row | null) => w?.status === 'published')
        .map((w: Row) => ({ slug: w.slug, title: w.title })),
    }) as Promotion)
    .sort(byEnd);
}
