import type { EditionFormat, EditionType, Work } from './types';

export const FORMAT_LABELS: Record<EditionFormat, string> = {
  paperback: 'Brossura',
  hardcover: 'Copertina rigida',
  kindle: 'Kindle',
  audio: 'Audiolibro',
};

export const EDITION_TYPE_LABELS: Record<EditionType, string> = {
  standard: 'Standard',
  special: 'Speciale',
  limited: 'Limitata',
};

export function formatDate(iso?: string | null): string {
  if (!iso) return 'Data da annunciare';
  return new Date(iso).toLocaleDateString('it-IT', { day: 'numeric', month: 'long', year: 'numeric' });
}

/** Accorcia un testo all'ultima parola intera entro `max` caratteri. */
export function excerpt(text?: string | null, max = 160): string {
  if (!text) return '';
  if (text.length <= max) return text;
  const cut = text.slice(0, max);
  return `${cut.slice(0, cut.lastIndexOf(' ') > 0 ? cut.lastIndexOf(' ') : max).replace(/[\s,.;:]+$/, '')}…`;
}

/** Testo per la ricerca: minuscolo e senza accenti. */
export function normalize(text: string): string {
  return text
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[’']/g, ' ')
    .toLowerCase();
}

export function formatPrice(price?: number | null): string {
  return price == null ? '' : price.toLocaleString('it-IT', { style: 'currency', currency: 'EUR' });
}

const MONTHS = ['gennaio', 'febbraio', 'marzo', 'aprile', 'maggio', 'giugno', 'luglio', 'agosto', 'settembre', 'ottobre', 'novembre', 'dicembre'];

/** "12 novembre 2026", "14–16 maggio 2027", "30 aprile – 2 maggio 2027", "30 dicembre 2026 – 2 gennaio 2027". */
export function formatDateRange(start: string, end?: string | null): string {
  const [y1, m1, d1] = start.split('-').map(Number);
  if (!end || end === start) return `${d1} ${MONTHS[m1 - 1]} ${y1}`;
  const [y2, m2, d2] = end.split('-').map(Number);
  if (y1 !== y2) return `${d1} ${MONTHS[m1 - 1]} ${y1} – ${d2} ${MONTHS[m2 - 1]} ${y2}`;
  if (m1 !== m2) return `${d1} ${MONTHS[m1 - 1]} – ${d2} ${MONTHS[m2 - 1]} ${y2}`;
  return `${d1}–${d2} ${MONTHS[m1 - 1]} ${y1}`;
}

export const EVENT_KIND_LABELS = { fair: 'Fiera', signing: 'Firmacopie', presentation: 'Presentazione', other: 'Evento' } as const;

/** Formati digitali disponibili tra le edizioni. */
export function availability(work: Pick<Work, 'editions'>): { ebook: boolean; audiobook: boolean } {
  return {
    ebook: work.editions.some((e) => e.format === 'kindle'),
    audiobook: work.editions.some((e) => e.format === 'audio'),
  };
}

/** Pagine della prima edizione cartacea; altrimenti della prima edizione che le indica. */
export function pageCount(work: Pick<Work, 'editions'>): number | null {
  const withPages = work.editions.filter((e) => e.pages);
  const paper = withPages.find((e) => e.format === 'paperback' || e.format === 'hardcover');
  return (paper ?? withPages[0])?.pages ?? null;
}

/** Data della prima edizione uscita (o annunciata), in formato ISO. */
export function releaseDate(work: Pick<Work, 'editions'>): string | null {
  const dates = work.editions.map((e) => e.release_date).filter((d): d is string => Boolean(d)).sort();
  return dates[0] ?? null;
}

export function releaseYear(work: Pick<Work, 'editions'>): number | null {
  const date = releaseDate(work);
  return date ? Number(date.slice(0, 4)) : null;
}
