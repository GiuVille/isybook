// Feed "Per te": punteggio di ogni libro rispetto agli interessi e ai preferiti dell'utente.
import type { CatalogBook } from './catalog';
import type { Library } from './library';

export interface Recommendation {
  book: CatalogBook;
  score: number;
  reason: string;
}

/**
 * Trope o genere tra gli interessi +2, ambientazione +1,
 * ogni trope in comune con i libri già salvati +1. Esclude i preferiti.
 */
export function recommend(books: CatalogBook[], library: Library, limit = 6): Recommendation[] {
  const interests = library.interests ?? { tropes: [], genres: [], settings: [] };
  const favorites = new Set(library.favorites);
  const saved = new Set([...library.favorites, ...library.collections.flatMap((c) => c.slugs)]);
  const savedTropes = new Set(books.filter((b) => saved.has(b.slug)).flatMap((b) => b.tropes.map((t) => t.slug)));

  return books
    .filter((b) => !favorites.has(b.slug))
    .map((book) => {
      const tropes = book.tropes.filter((t) => interests.tropes.includes(t.slug));
      const genres = book.genres.filter((g) => interests.genres.includes(g.slug));
      const settings = book.settings.filter((s) => interests.settings.includes(s.slug));
      const likeSaved = book.tropes.filter((t) => savedTropes.has(t.slug));
      const score = tropes.length * 2 + genres.length * 2 + settings.length + likeSaved.length;

      const liked = [...tropes, ...genres, ...settings].map((t) => t.name.toLowerCase());
      const reason = liked.length
        ? `Ti piace: ${liked.slice(0, 3).join(', ')}`
        : likeSaved.length
          ? `Come i libri che hai salvato: ${likeSaved.slice(0, 2).map((t) => t.name.toLowerCase()).join(', ')}`
          : '';
      return { book, score, reason };
    })
    .filter((r) => r.score > 0)
    .sort((a, b) => b.score - a.score || (a.book.released ?? '').localeCompare(b.book.released ?? ''))
    .slice(0, limit);
}
