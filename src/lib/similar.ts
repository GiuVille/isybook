// Libri correlati e ordine di lettura delle saghe, calcolati in build.
import type { Adaptation, Work } from './types';

export interface SimilarWork {
  work: Work;
  reason: string;
}

const shared = <T extends { slug: string }>(a: T[], b: T[]) => a.filter((x) => b.some((y) => y.slug === x.slug));

/**
 * Punteggio: stessa saga +5, stesso autore +3, ogni trope o genere in comune +2, ogni ambientazione +1.
 * Restituisce i migliori `limit` con il motivo principale.
 */
export function similarWorks(work: Work, all: Work[], limit = 4): SimilarWork[] {
  return all
    .filter((other) => other.id !== work.id)
    .map((other) => {
      const sameSeries = Boolean(work.series && other.series === work.series);
      const authors = shared(work.authors, other.authors);
      const tropes = shared(work.tropes, other.tropes);
      const genres = shared(work.genres, other.genres);
      const settings = shared(work.settings, other.settings);
      const score =
        (sameSeries ? 5 : 0) + authors.length * 3 + tropes.length * 2 + genres.length * 2 + settings.length;

      let reason = '';
      if (sameSeries) reason = `Stessa saga: ${work.series}`;
      else if (tropes.length) reason = `In comune: ${tropes.map((t) => t.name).join(', ')}`;
      else if (authors.length) reason = `Di ${authors.map((a) => a.name).join(', ')}`;
      else if (genres.length) reason = genres.map((g) => g.name).join(', ');
      else if (settings.length) reason = `Ambientato: ${settings.map((s) => s.name.toLowerCase()).join(', ')}`;

      return { work: other, reason, score };
    })
    .filter((s) => s.score > 0)
    .sort((a, b) => b.score - a.score || a.work.title.localeCompare(b.work.title, 'it'))
    .slice(0, limit)
    .map(({ work, reason }) => ({ work, reason }));
}

export interface SeriesInfo {
  name: string;
  /** Volumi in ordine di lettura (numero nella saga). */
  volumes: Work[];
  previous?: Work;
  next?: Work;
}

/** Saga a cui appartiene il libro, con volume precedente e successivo. */
export function seriesInfo(work: Work, all: Work[]): SeriesInfo | null {
  if (!work.series) return null;
  const volumes = all
    .filter((w) => w.series === work.series)
    .sort((a, b) => (a.series_number ?? Infinity) - (b.series_number ?? Infinity) || a.title.localeCompare(b.title, 'it'));
  const index = volumes.findIndex((w) => w.id === work.id);
  return { name: work.series, volumes, previous: volumes[index - 1], next: volumes[index + 1] };
}

export interface SimilarItem {
  kind: 'adaptation' | 'work';
  slug: string;
  title: string;
  caption: string;
  reason: string;
  adaptation?: Adaptation;
  work?: Work;
}

/**
 * Consigli per una serie o un film: altri adattamenti con tropes/generi in comune
 * (+2 ciascuno, +1 se dello stesso tipo, +2 se tratti dallo stesso autore), poi qualche
 * libro con tropes in comune che non ha ancora un adattamento.
 */
export function similarToAdaptation(item: Adaptation, adaptations: Adaptation[], works: Work[], limit = 4): SimilarItem[] {
  const sharedNames = <T extends { slug: string; name: string }>(a: T[], b: T[]) => shared(a, b).map((t) => t.name.toLowerCase());

  const screen = adaptations
    .filter((a) => a.id !== item.id)
    .map((a) => {
      const tropes = sharedNames(item.tropes, a.tropes);
      const genres = sharedNames(item.genres, a.genres);
      const sameAuthor = a.source.authors.some((x) => item.source.authors.some((y) => y.slug === x.slug));
      const score = tropes.length * 2 + genres.length * 2 + (a.kind === item.kind ? 1 : 0) + (sameAuthor ? 2 : 0);
      const reason = tropes.length ? `In comune: ${tropes.slice(0, 2).join(', ')}` : genres.length ? genres.join(', ') : sameAuthor ? 'Dalla stessa autrice o autore' : '';
      return { a, score, reason };
    })
    .filter((x) => x.score > 1)
    .sort((x, y) => y.score - x.score)
    .map(({ a, reason }): SimilarItem => ({
      kind: 'adaptation',
      slug: a.slug,
      title: a.title,
      caption: a.kind === 'film' ? 'Film' : 'Serie TV',
      reason: reason || 'Stesso tipo di storia',
      adaptation: a,
    }));

  const books = works
    .filter((w) => w.slug !== item.source.slug && w.adaptations.length === 0)
    .map((w) => ({ w, tropes: sharedNames(item.tropes, w.tropes) }))
    .filter((x) => x.tropes.length > 0)
    .sort((x, y) => y.tropes.length - x.tropes.length)
    .map(({ w, tropes }): SimilarItem => ({
      kind: 'work',
      slug: w.slug,
      title: w.title,
      caption: w.authors.map((a) => a.name).join(', '),
      reason: `Da leggere: ${tropes.slice(0, 2).join(', ')}`,
      work: w,
    }));

  // almeno un libro se c'è, il resto adattamenti
  return [...screen.slice(0, books.length ? limit - 1 : limit), ...books].slice(0, limit);
}
