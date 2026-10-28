// Libri correlati e ordine di lettura delle saghe, calcolati in build.
import type { Work } from './types';

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
