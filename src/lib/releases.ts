// Prossime uscite raggruppate per libro: la prima data futura con tutti i formati di quel giorno.
// Usato dal cassetto della home e dal carosello della pagina Uscite.
import { FORMAT_LABELS } from './format';
import type { Edition, Work } from './types';

export interface Release {
  work: Work;
  date: string; // ISO
  formats: string[];
  special: Edition['edition_type'] | null;
}

export function upcomingReleases(editions: Array<Edition & { work: Work }>, today = new Date().toISOString().slice(0, 10)): Release[] {
  const byWork = new Map<string, Release>();
  const future = editions
    .filter((e) => e.release_date && e.release_date >= today)
    .sort((a, b) => a.release_date!.localeCompare(b.release_date!));
  for (const e of future) {
    const item = byWork.get(e.work.slug);
    if (!item) {
      byWork.set(e.work.slug, {
        work: e.work,
        date: e.release_date!,
        formats: [FORMAT_LABELS[e.format]],
        special: e.edition_type !== 'standard' ? e.edition_type : null,
      });
    } else if (item.date === e.release_date) {
      if (!item.formats.includes(FORMAT_LABELS[e.format])) item.formats.push(FORMAT_LABELS[e.format]);
      if (e.edition_type !== 'standard') item.special = e.edition_type;
    }
  }
  return [...byWork.values()];
}

/** Edizioni con tutti i formati dello stesso giorno: cartaceo, Kindle e audiolibro diventano un blocco solo. */
export type GroupedEdition = Edition & { work: Work; formats: string[] };

/**
 * Un blocco per libro, data e tipo di edizione: le speciali e le limitate restano a parte.
 * Il blocco prende i dati dell'edizione cartacea, se c'è, e unisce i dettagli dei formati.
 */
export function groupEditions(editions: Array<Edition & { work: Work }>): GroupedEdition[] {
  const groups = new Map<string, GroupedEdition>();
  const paperFirst = (f: Edition['format']) => (f === 'hardcover' || f === 'paperback' ? 0 : 1);
  const sorted = [...editions].sort((a, b) => paperFirst(a.format) - paperFirst(b.format));
  for (const e of sorted) {
    const key = `${e.work.slug}|${e.release_date ?? ''}|${e.edition_type}`;
    const group = groups.get(key);
    if (!group) {
      groups.set(key, { ...e, formats: [FORMAT_LABELS[e.format]] });
      continue;
    }
    if (!group.formats.includes(FORMAT_LABELS[e.format])) group.formats.push(FORMAT_LABELS[e.format]);
    if (e.details && !group.details?.includes(e.details)) group.details = [group.details, e.details].filter(Boolean).join(' · ');
  }
  // l'ordine di partenza (per data) resta quello delle prime edizioni di ogni gruppo
  return editions.map((e) => groups.get(`${e.work.slug}|${e.release_date ?? ''}|${e.edition_type}`)!).filter((g, i, all) => all.indexOf(g) === i);
}
