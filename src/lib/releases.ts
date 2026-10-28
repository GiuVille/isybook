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
