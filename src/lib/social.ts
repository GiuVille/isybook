// Bozze dei post social: dati dei contenuti, intervalli di date e testi (didascalia Instagram, messaggio Telegram).
// I testi nascono da modelli e dai dati del sito, mai da un'estrazione automatica: date e titoli devono essere esatti.
// Le immagini le disegna il pannello (src/admin/social-canvas.ts).

export type SocialSection = 'releases' | 'special' | 'promotions' | 'events';
export type SocialFormat = 'post' | 'story' | 'carousel' | 'telegram';

export interface Palette {
  light: string;
  dark: string;
  panel: string;
  ink: string;
  accent: string;
}

export interface SocialItem {
  kind: 'book' | 'promo' | 'event';
  id: string;
  title: string;
  /** Autori, editore o luogo. */
  subtitle: string;
  /** Frase in evidenza: il premio di una promozione. */
  highlight?: string | null;
  /** Data di riferimento: uscita, fine della promozione, inizio dell'evento (AAAA-MM-GG). */
  date: string;
  endDate?: string | null;
  /** Righe brevi: formati, condizioni, dove. */
  details: string[];
  /** Bollino: "Edizione limitata · 1500 copie", "Ultimi giorni!", "Firmacopie". */
  badge?: string | null;
  tags: string[];
  /** Slug dei generi, per gli hashtag. */
  genres: string[];
  palette: Palette;
  /** Immagine già preparata in build (stessa origine del pannello: il canvas la può esportare). */
  image?: { src: string; width: number; height: number } | null;
  url: string;
}

export interface SocialData {
  generated: string;
  site: string;
  sections: Record<SocialSection, SocialItem[]>;
}

export const SECTION_LABELS: Record<SocialSection, string> = {
  releases: 'Uscite',
  special: 'Edizioni speciali e limitate',
  promotions: 'Promozioni',
  events: 'Eventi',
};

export const FORMAT_LABELS: Record<SocialFormat, string> = {
  post: 'Post 4:5',
  story: 'Storia 9:16',
  carousel: 'Carosello',
  telegram: 'Telegram',
};

/** Quanti elementi stanno bene in ogni formato (il carosello ne ha uno per slide). */
export const MAX_ITEMS: Record<SocialFormat, number> = { post: 4, story: 3, carousel: 8, telegram: 10 };

// ---------------------------------------------------------------------------
// Intervalli di date
// ---------------------------------------------------------------------------
export type RangeKey = 'this-week' | 'next-week' | 'month';

export const RANGE_LABELS: Record<RangeKey, string> = {
  'this-week': 'Questa settimana',
  'next-week': 'Prossima settimana',
  month: 'Prossimi 30 giorni',
};

const DAY = 86_400_000;
const iso = (d: Date) => d.toISOString().slice(0, 10);
const utc = (s: string) => new Date(`${s}T00:00:00Z`);

/** Da lunedì a domenica (o i prossimi 30 giorni), a partire da oggi. */
export function dateRange(key: RangeKey, today: string): { from: string; to: string } {
  const t = utc(today);
  if (key === 'month') return { from: today, to: iso(new Date(t.getTime() + 30 * DAY)) };
  const monday = new Date(t.getTime() - ((t.getUTCDay() + 6) % 7) * DAY);
  const start = key === 'this-week' ? monday : new Date(monday.getTime() + 7 * DAY);
  return { from: iso(start), to: iso(new Date(start.getTime() + 6 * DAY)) };
}

/** Elementi che cadono nell'intervallo. Promozioni ed eventi in corso contano finché non finiscono. */
export function inRange(item: SocialItem, range: { from: string; to: string }): boolean {
  if (item.kind === 'promo') return item.date >= range.from; // date = fine promozione: deve essere ancora attiva
  const end = item.endDate ?? item.date;
  return end >= range.from && item.date <= range.to;
}

const MONTHS = ['gennaio', 'febbraio', 'marzo', 'aprile', 'maggio', 'giugno', 'luglio', 'agosto', 'settembre', 'ottobre', 'novembre', 'dicembre'];
const WEEKDAYS = ['domenica', 'lunedì', 'martedì', 'mercoledì', 'giovedì', 'venerdì', 'sabato'];

/** "3–9 novembre", "28 ottobre – 3 novembre". */
export function rangeLabel(range: { from: string; to: string }): string {
  const [, m1, d1] = range.from.split('-').map(Number);
  const [, m2, d2] = range.to.split('-').map(Number);
  return m1 === m2 ? `${d1}–${d2} ${MONTHS[m1 - 1]}` : `${d1} ${MONTHS[m1 - 1]} – ${d2} ${MONTHS[m2 - 1]}`;
}

/** "giovedì 12 novembre". */
export function longDate(date: string): string {
  const d = utc(date);
  return `${WEEKDAYS[d.getUTCDay()]} ${d.getUTCDate()} ${MONTHS[d.getUTCMonth()]}`;
}

/** "12 nov". */
export function shortDate(date: string): string {
  const d = utc(date);
  return `${d.getUTCDate()} ${MONTHS[d.getUTCMonth()].slice(0, 3)}`;
}

/** Riga della data, come la si dice: uscita, scadenza o giorni dell'evento. */
export function dateLine(item: SocialItem): string {
  if (item.kind === 'promo') return `fino a ${longDate(item.date)}`;
  if (item.kind === 'event' && item.endDate && item.endDate !== item.date) return `dal ${shortDate(item.date)} al ${shortDate(item.endDate)}`;
  return longDate(item.date);
}

// ---------------------------------------------------------------------------
// Testi
// ---------------------------------------------------------------------------
/** Titolo del post: "della settimana" solo se il periodo è davvero una settimana. */
export function headline(section: SocialSection, range: RangeKey): string {
  const week = range !== 'month';
  switch (section) {
    case 'releases':
      return week ? 'Le uscite della settimana' : 'Le prossime uscite';
    case 'special':
      return 'Edizioni speciali in arrivo';
    case 'promotions':
      return 'Promozioni da non perdere';
    case 'events':
      return week ? 'Gli eventi della settimana' : 'Prossimi eventi';
  }
}

const EMOJI: Record<SocialSection, string> = { releases: '📚', special: '✨', promotions: '🎁', events: '📍' };

const GENRE_TAGS: Record<string, string> = {
  romantasy: '#romantasy',
  'dark-romance': '#darkromance',
  romance: '#romance',
  'sports-romance': '#sportsromance',
  'fantasy-ya': '#fantasyya',
  fantasy: '#fantasy',
  horror: '#horror',
  giallo: '#gialli',
  thriller: '#thriller',
};

const BASE_TAGS = ['#bookstagramitalia', '#booktokitalia', '#libri', '#consiglidilettura'];
const SECTION_TAGS: Record<SocialSection, string[]> = {
  releases: ['#nuoveuscite', '#uscitelibri'],
  special: ['#specialedition', '#edizionelimitata', '#collezionelibri'],
  promotions: ['#promozionilibri', '#offertelibri'],
  events: ['#eventilibri', '#firmacopie'],
};

/** Al massimo 15 hashtag: quelli della sezione, dei generi presenti, poi i generali. */
export function hashtags(section: SocialSection, items: SocialItem[]): string[] {
  const genres = [...new Set(items.flatMap((i) => i.genres))].map((g) => GENRE_TAGS[g]).filter(Boolean);
  return [...new Set([...SECTION_TAGS[section], ...genres, ...BASE_TAGS])].slice(0, 15);
}

function itemLine(item: SocialItem, telegram: boolean): string {
  const title = telegram ? `**${item.title}**` : `«${item.title}»`;
  const who = item.subtitle ? (item.kind === 'book' ? ` di ${item.subtitle}` : ` · ${item.subtitle}`) : '';
  const parts = [
    `${title}${who}`,
    item.highlight ? item.highlight : null,
    dateLine(item),
    ...item.details,
    item.badge && item.kind === 'book' ? `✨ ${item.badge}` : null,
  ].filter(Boolean);
  return `• ${parts.join(' — ')}${telegram ? `\n  ${item.url}` : ''}`;
}

const CALLS: Record<SocialSection, string> = {
  releases: 'Quale aspetti di più? Dimmelo nei commenti 👇',
  special: 'Tu quale vuoi nella tua libreria? 👇',
  promotions: 'Le condizioni le decide chi propone la promozione: controllale sempre prima di acquistare.',
  events: 'Ci vediamo lì? Taggate chi viene con voi 👇',
};

/** Didascalia per Instagram (post, storia o carosello) o messaggio per Telegram. */
export function buildText(section: SocialSection, title: string, items: SocialItem[], format: SocialFormat, period: string, site: string): string {
  const telegram = format === 'telegram';
  const head = `${EMOJI[section]} ${telegram ? `**${title}**` : title}${period ? ` (${period})` : ''}`;
  const body = items.map((i) => itemLine(i, telegram)).join('\n');
  const host = site.replace(/^https?:\/\//, '').replace(/\/$/, '');
  const footer = telegram ? `Tutte le date su ${site}` : `Tutte le date su ${host} (link in bio)`;
  const text = [head, body, CALLS[section], footer].join('\n\n');
  return telegram ? text : `${text}\n\n${hashtags(section, items).join(' ')}`;
}
