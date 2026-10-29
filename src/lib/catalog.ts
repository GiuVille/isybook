// Catalogo ridotto usato nel browser (feed, libreria, questionario).
// Generato in build come /catalogo.json da src/pages/catalogo.json.ts.
import { themeForWork } from './book-themes';
import { releaseDate } from './format';
import type { Adaptation, Work } from './types';

export interface CatalogTag {
  slug: string;
  name: string;
}

export interface CatalogBook {
  slug: string;
  title: string;
  authors: string[];
  series: string | null;
  tropes: CatalogTag[];
  genres: CatalogTag[];
  settings: CatalogTag[];
  released: string | null;
  cover: string | null;
  color: string; // colore della copertina segnaposto
}

export interface CatalogScreen {
  slug: string;
  title: string;
  kind: 'series' | 'film';
  seasons: number | null;
  runtime: number | null; // minuti, per i film
  released: string | null;
  poster: string | null;
  color: string; // colore della locandina segnaposto
  source: { slug: string; title: string };
}

export interface Catalog {
  books: CatalogBook[];
  screens: CatalogScreen[];
  tropes: CatalogTag[];
  genres: CatalogTag[];
  settings: CatalogTag[];
}

const tag = ({ slug, name }: CatalogTag): CatalogTag => ({ slug, name });

function uniqueTags(tags: CatalogTag[]): CatalogTag[] {
  return [...new Map(tags.map((t) => [t.slug, tag(t)])).values()].sort((a, b) => a.name.localeCompare(b.name, 'it'));
}

export function buildCatalog(works: Work[]): Catalog {
  const books = works.map(
    (w): CatalogBook => ({
      slug: w.slug,
      title: w.title,
      authors: w.authors.map((a) => a.name),
      series: w.series ?? null,
      tropes: w.tropes.map(tag),
      genres: w.genres.map(tag),
      settings: w.settings.map(tag),
      released: releaseDate(w),
      cover: w.editions.find((e) => e.cover_url)?.cover_url ?? null,
      color: themeForWork(w).cover,
    }),
  );
  const screens = works.flatMap((w) =>
    w.adaptations.map(
      (a: Adaptation): CatalogScreen => ({
        slug: a.slug,
        title: a.title,
        kind: a.kind,
        seasons: a.seasons ?? null,
        runtime: a.runtime_minutes ?? null,
        released: a.release_date ?? null,
        poster: a.poster_url ?? null,
        color: themeForWork(a).cover,
        source: { slug: a.source.slug, title: a.source.title },
      }),
    ),
  );
  return {
    books,
    screens,
    tropes: uniqueTags(books.flatMap((b) => b.tropes)),
    genres: uniqueTags(books.flatMap((b) => b.genres)),
    settings: uniqueTags(books.flatMap((b) => b.settings)),
  };
}

let cached: Promise<Catalog> | null = null;

/** Carica /catalogo.json una sola volta per pagina. */
export function loadCatalog(): Promise<Catalog> {
  cached ??= fetch('/catalogo.json').then((r) => {
    if (!r.ok) throw new Error(`catalogo.json: HTTP ${r.status}`);
    return r.json() as Promise<Catalog>;
  });
  return cached;
}
