// Book journal di La mia libreria: una scheda per ogni libro letto o in lettura, con voti, recensione,
// moodboard e l'aspetto dell'agendina scelto da chi legge. Tutto nel browser come la libreria:
// testi e impostazioni in localStorage, foto della moodboard in IndexedDB (localStorage si riempirebbe subito).

import { PATTERN_IDS } from './cover-patterns';

export type JournalFormat = 'paper' | 'ebook' | 'audio';
export type JournalKind = 'standalone' | 'sequel' | 'prequel' | 'spinoff' | 'midquel';
export type JournalSource = 'bought' | 'gift' | 'borrowed';
export type RatingKey = 'emotions' | 'characters' | 'story' | 'overall';

export interface MoodItem {
  id: string;
  type: 'photo' | 'sticker';
  ref: string; // id della foto in IndexedDB, o nome dell'adesivo
  x: number; // posizione del centro in % della moodboard
  y: number;
  rotate: number; // gradi
  scale: number; // 0.5–2
}

export interface JournalEntry {
  id: string;
  n: number; // numero progressivo nell'indice
  slug: string | null; // libro del catalogo, se scelto da lì
  title: string;
  author: string;
  genre: string;
  publisher: string;
  cover: string | null;
  color: string; // colore della copertina segnaposto
  format: JournalFormat | null;
  kind: JournalKind | null;
  source: JournalSource | null;
  startedOn: string;
  finishedOn: string;
  totalPages: number | null;
  currentPage: number | null;
  favoriteCharacter: string;
  favoriteChapter: string;
  tropes: string[];
  moments: string;
  quotes: string;
  ratings: Record<RatingKey, number>; // 0–5 a mezze stelle
  review: string;
  moodboard: MoodItem[];
  createdAt: string;
  updatedAt: string;
}

export interface CoverSticker {
  name: string; // scarabocchio di src/lib/doodles.ts
  x: number; // % della copertina
  y: number;
  r: number; // gradi
  s: number; // scala 0.6–1.4
  c: string; // colore
}

export interface JournalSettings {
  cover: string; // id di COVER_COLORS
  material: 'leather' | 'linen' | 'kraft';
  pattern: string; // fantasia sopra il colore: 'none' o un id di src/lib/cover-patterns.ts
  coverStickers: CoverSticker[]; // adesivi sparsi sulla copertina
  stickerOpacity: number; // trasparenza degli adesivi sparsi, 0.2–1
  patternOpacity: number; // trasparenza della fantasia della copertina, 0.2–1
  band: string; // colore dell'elastico
  ribbon: string; // colore del segnalibro
  paper: 'lines' | 'dots' | 'grid' | 'plain'; // plain = tinta unita
  paperColor: string; // id di PAPER_COLORS
  ink: string; // id di INKS
  hand: boolean; // scrittura a mano
  charm: string; // nome di uno scarabocchio appeso all'elastico, '' = nessuno
  sticker: string; // adesivo sulla copertina, '' = nessuno
  label: 'paper' | 'cartouche' | 'none'; // stile del titolo: etichetta di carta, cartiglio, niente
  ornament: 'none' | 'keyhole' | 'book'; // targhetta con serratura in alto, libro aperto in basso
  name: string; // scritto sulla copertina
  subtitle: string; // riga più piccola sotto il nome (facoltativa)
}

/** Torneo dell'anno: tabellone iniziale (null = passaggio del turno) e scelte fatte, per sfida "turno-partita". */
export interface Tournament {
  seeds: Array<string | null>;
  picks: Record<string, string>;
  finishedAt: string | null;
}

export interface Journal {
  version: 1;
  entries: JournalEntry[];
  settings: JournalSettings;
  monthly: Record<string, string>; // "2026-11" → id della scheda (facoltativo: i mesi possono restare vuoti)
  tournaments: Record<string, Tournament>; // anno → torneo
  updatedAt: string;
}

/** Palette scelte per stare bene con il sito, nel tema chiaro e scuro. */
export const COVER_COLORS = [
  { id: 'plum', label: 'Prugna', value: '#7a3570' },
  { id: 'sage', label: 'Salvia', value: '#6f8f6a' },
  { id: 'blush', label: 'Cipria', value: '#d99aae' },
  { id: 'night', label: 'Blu notte', value: '#2f3e63' },
  { id: 'mustard', label: 'Senape', value: '#c99a2e' },
  { id: 'ink', label: 'Nero inchiostro', value: '#2a2730' },
  { id: 'terracotta', label: 'Mattone', value: '#a5523a' },
  { id: 'lilac', label: 'Lilla', value: '#9d86c9' },
  { id: 'candy', label: 'Rosa confetto', value: '#e88fb3' },
  { id: 'teal', label: 'Ottanio', value: '#1f6f78' },
  { id: 'forest', label: 'Verde bosco', value: '#2f5a3c' },
  { id: 'wine', label: 'Bordeaux', value: '#6e1f33' },
  { id: 'sky', label: 'Celeste', value: '#7fb2d9' },
  { id: 'cream', label: 'Crema', value: '#e8d9b8' },
  { id: 'peach', label: 'Pesca', value: '#f0a77e' },
  { id: 'gold', label: 'Oro', value: '#b48a2c' },
];
export const PAPER_COLORS = [
  { id: 'cream', label: 'Avorio', value: '#fffdf7' },
  { id: 'white', label: 'Bianco', value: '#ffffff' },
  { id: 'pink', label: 'Rosa', value: '#fbeef2' },
  { id: 'blue', label: 'Azzurro', value: '#eef5fb' },
  { id: 'sage', label: 'Salvia', value: '#eff5ec' },
  { id: 'lilac', label: 'Lilla', value: '#f4effa' },
  { id: 'kraft', label: 'Kraft', value: '#efe3cc' },
];
export const STICKER_COLORS = ['#e9cf74', '#d99aae', '#ffffff', '#a6c4df', '#a9c8a2', '#c62828', '#2a2730'];
export const ACCENTS = ['#e9cf74', '#f4e6f0', '#c62828', '#1e5aa8', '#2e7d32', '#ffffff', '#2a2730'];
export const INKS = [
  { id: 'blue', label: 'Blu', value: '#1f3a8a' },
  { id: 'black', label: 'Nero', value: '#24232b' },
  { id: 'plum', label: 'Prugna', value: '#7a3570' },
  { id: 'green', label: 'Verde', value: '#2f6b46' },
];

export const RATING_LABELS: Record<RatingKey, string> = {
  emotions: 'Emozioni',
  characters: 'Personaggi',
  story: 'Storia',
  overall: 'Voto finale',
};

export const STORAGE_KEY = 'isybook:journal:v1';
export const CHANGE_EVENT = 'journal-change';

const DEFAULT_SETTINGS: JournalSettings = {
  cover: 'plum',
  material: 'leather',
  band: '#e9cf74',
  ribbon: '#e9cf74',
  paper: 'lines',
  ink: 'blue',
  hand: true,
  charm: 'star',
  sticker: '',
  label: 'paper',
  ornament: 'none',
  name: 'Il mio book journal',
  subtitle: '',
  pattern: 'none',
  coverStickers: [],
  stickerOpacity: 1,
  patternOpacity: 1,
  paperColor: 'cream',
};

const now = () => new Date().toISOString();
const empty = (): Journal => ({ version: 1, entries: [], settings: { ...DEFAULT_SETTINGS }, monthly: {}, tournaments: {}, updatedAt: now() });

let memory: Journal | null = null;

const str = (v: unknown, max = 5000) => (typeof v === 'string' ? v.slice(0, max) : '');
const num = (v: unknown) => (typeof v === 'number' && Number.isFinite(v) && v >= 0 ? Math.round(v) : null);
const oneOf = <T extends string>(v: unknown, values: readonly T[]): T | null => (values.includes(v as T) ? (v as T) : null);
const clamp = (v: unknown, min: number, max: number, fallback: number) =>
  typeof v === 'number' && Number.isFinite(v) ? Math.min(max, Math.max(min, v)) : fallback;

function sanitizeEntry(raw: any, i: number): JournalEntry | null {
  if (!raw || typeof raw !== 'object' || typeof raw.id !== 'string') return null;
  const ratings = raw.ratings ?? {};
  const half = (v: unknown) => Math.round(clamp(v, 0, 5, 0) * 2) / 2;
  return {
    id: raw.id,
    n: num(raw.n) ?? i + 1,
    slug: typeof raw.slug === 'string' ? raw.slug : null,
    title: str(raw.title, 200) || 'Senza titolo',
    author: str(raw.author, 200),
    genre: str(raw.genre, 100),
    publisher: str(raw.publisher, 100),
    cover: typeof raw.cover === 'string' ? raw.cover : null,
    color: str(raw.color, 20) || '#7a3570',
    format: oneOf(raw.format, ['paper', 'ebook', 'audio'] as const),
    kind: oneOf(raw.kind, ['standalone', 'sequel', 'prequel', 'spinoff', 'midquel'] as const),
    source: oneOf(raw.source, ['bought', 'gift', 'borrowed'] as const),
    startedOn: str(raw.startedOn, 10),
    finishedOn: str(raw.finishedOn, 10),
    totalPages: num(raw.totalPages),
    currentPage: num(raw.currentPage),
    favoriteCharacter: str(raw.favoriteCharacter, 200),
    favoriteChapter: str(raw.favoriteChapter, 200),
    tropes: Array.isArray(raw.tropes) ? raw.tropes.filter((t: unknown) => typeof t === 'string').slice(0, 30) : [],
    moments: str(raw.moments),
    quotes: str(raw.quotes),
    ratings: { emotions: half(ratings.emotions), characters: half(ratings.characters), story: half(ratings.story), overall: half(ratings.overall) },
    review: str(raw.review, 20000),
    moodboard: Array.isArray(raw.moodboard)
      ? raw.moodboard
          .filter((m: any) => m && typeof m.id === 'string' && typeof m.ref === 'string' && (m.type === 'photo' || m.type === 'sticker'))
          .slice(0, 40)
          .map((m: any) => ({
            id: m.id,
            type: m.type,
            ref: m.ref,
            x: clamp(m.x, 0, 100, 50),
            y: clamp(m.y, 0, 100, 50),
            rotate: clamp(m.rotate, -180, 180, 0),
            scale: clamp(m.scale, 0.5, 2, 1),
          }))
      : [],
    createdAt: str(raw.createdAt, 40) || now(),
    updatedAt: str(raw.updatedAt, 40) || now(),
  };
}

function sanitize(raw: unknown): Journal {
  const base = empty();
  if (!raw || typeof raw !== 'object') return base;
  const r = raw as Partial<Journal> & { settings?: Partial<JournalSettings> };
  const entries = (Array.isArray(r.entries) ? r.entries : []).map(sanitizeEntry).filter((e): e is JournalEntry => e !== null);
  const ids = new Set(entries.map((e) => e.id));
  const monthly: Record<string, string> = {};
  for (const [month, id] of Object.entries(r.monthly ?? {})) if (/^\d{4}-\d{2}$/.test(month) && typeof id === 'string' && ids.has(id)) monthly[month] = id;
  const tournaments: Record<string, Tournament> = {};
  for (const [year, t] of Object.entries(r.tournaments ?? {})) {
    if (!/^\d{4}$/.test(year) || !t || !Array.isArray(t.seeds)) continue;
    const seeds = t.seeds.map((s) => (typeof s === 'string' && ids.has(s) ? s : null));
    const picks: Record<string, string> = {};
    for (const [k, v] of Object.entries(t.picks ?? {})) if (/^\d+-\d+$/.test(k) && typeof v === 'string' && ids.has(v)) picks[k] = v;
    tournaments[year] = { seeds, picks, finishedAt: typeof t.finishedAt === 'string' ? t.finishedAt : null };
  }
  const s: Partial<JournalSettings> = r.settings ?? {};
  const color = (v: unknown, fallback: string) => (typeof v === 'string' && /^#[0-9a-f]{6}$/i.test(v) ? v : fallback);
  return {
    version: 1,
    entries,
    monthly,
    tournaments,
    settings: {
      cover: COVER_COLORS.some((c) => c.id === s.cover) ? s.cover! : DEFAULT_SETTINGS.cover,
      material: oneOf(s.material, ['leather', 'linen', 'kraft'] as const) ?? DEFAULT_SETTINGS.material,
      band: color(s.band, DEFAULT_SETTINGS.band),
      ribbon: color(s.ribbon, DEFAULT_SETTINGS.ribbon),
      paper: oneOf(s.paper, ['lines', 'dots', 'grid', 'plain'] as const) ?? DEFAULT_SETTINGS.paper,
      paperColor: PAPER_COLORS.some((c) => c.id === s.paperColor) ? s.paperColor! : DEFAULT_SETTINGS.paperColor,
      pattern: typeof s.pattern === 'string' && PATTERN_IDS.includes(s.pattern) ? s.pattern : DEFAULT_SETTINGS.pattern,
      stickerOpacity: Math.round(clamp(s.stickerOpacity, 0.2, 1, 1) * 100) / 100,
      patternOpacity: Math.round(clamp(s.patternOpacity, 0.2, 1, 1) * 100) / 100,
      coverStickers: (Array.isArray(s.coverStickers) ? s.coverStickers : [])
        .filter((x): x is CoverSticker => Boolean(x) && typeof x.name === 'string')
        .slice(0, 24)
        .map((x) => ({ name: x.name, x: clamp(x.x, 0, 100, 50), y: clamp(x.y, 0, 100, 50), r: clamp(x.r, -180, 180, 0), s: clamp(x.s, 0.6, 1.4, 1), c: color(x.c, '#e9cf74') })),
      ink: INKS.some((c) => c.id === s.ink) ? s.ink! : DEFAULT_SETTINGS.ink,
      hand: typeof s.hand === 'boolean' ? s.hand : DEFAULT_SETTINGS.hand,
      charm: typeof s.charm === 'string' ? s.charm : DEFAULT_SETTINGS.charm,
      sticker: typeof s.sticker === 'string' ? s.sticker : DEFAULT_SETTINGS.sticker,
      label: oneOf(s.label, ['paper', 'cartouche', 'none'] as const) ?? DEFAULT_SETTINGS.label,
      ornament: oneOf(s.ornament, ['none', 'keyhole', 'book'] as const) ?? DEFAULT_SETTINGS.ornament,
      name: typeof s.name === 'string' ? s.name.slice(0, 40) : DEFAULT_SETTINGS.name,
      subtitle: typeof s.subtitle === 'string' ? s.subtitle.slice(0, 60) : DEFAULT_SETTINGS.subtitle,
    },
    updatedAt: typeof r.updatedAt === 'string' ? r.updatedAt : base.updatedAt,
  };
}

export function getJournal(): Journal {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) return sanitize(JSON.parse(raw));
  } catch {
    // storage non leggibile: uso la copia in memoria
  }
  return memory ?? empty();
}

function save(journal: Journal): Journal {
  journal.updatedAt = now();
  memory = journal;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(journal));
  } catch {
    // resta in memoria per questa sessione
  }
  window.dispatchEvent(new CustomEvent(CHANGE_EVENT, { detail: journal }));
  return journal;
}

function update(change: (journal: Journal) => void): Journal {
  const journal = getJournal();
  change(journal);
  return save(journal);
}

const newId = (prefix: string) => `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`;

/** Percentuale di lettura (0–100) o null se mancano le pagine. */
export function progress(entry: Pick<JournalEntry, 'currentPage' | 'totalPages' | 'finishedOn'>): number | null {
  if (entry.finishedOn) return 100;
  if (!entry.totalPages || entry.currentPage == null) return null;
  return Math.min(100, Math.round((entry.currentPage / entry.totalPages) * 100));
}

export const isRead = (entry: JournalEntry) => progress(entry) === 100;

/** Libro di una saga visto dal journal. */
export interface SagaBook {
  slug: string;
  title: string;
  number: number | null;
  cover: string | null;
  color: string;
  read: boolean;
  entryId: string | null; // scheda del journal, se c'è
}

export interface Saga {
  name: string;
  books: SagaBook[]; // in ordine di numero
  position: number | null; // numero del libro della scheda
  total: number; // libri della saga (il più alto tra quanti ne conosciamo e il numero più alto)
  read: number;
  percent: number;
  next: SagaBook | null; // prossima lettura per continuare la storia
}

type SagaCatalogBook = { slug: string; title: string; series: string | null; seriesNumber: number | null; cover: string | null; color: string };

/** Saga del libro della scheda, o null se il libro non ne fa parte (o non è nel catalogo). */
export function sagaOf(entry: JournalEntry, books: SagaCatalogBook[], entries: JournalEntry[]): Saga | null {
  const own = entry.slug ? books.find((b) => b.slug === entry.slug) : null;
  if (!own?.series) return null;
  const bySlug = new Map(entries.filter((e) => e.slug).map((e) => [e.slug!, e]));
  const list = books
    .filter((b) => b.series === own.series)
    .sort((a, b) => (a.seriesNumber ?? 999) - (b.seriesNumber ?? 999) || a.title.localeCompare(b.title, 'it'))
    .map((b): SagaBook => {
      const e = bySlug.get(b.slug);
      return { slug: b.slug, title: b.title, number: b.seriesNumber, cover: b.cover, color: b.color, read: e ? isRead(e) : false, entryId: e?.id ?? null };
    });
  const total = Math.max(list.length, ...list.map((b) => b.number ?? 0));
  const read = list.filter((b) => b.read).length;
  // il prossimo da leggere: il primo non letto dopo quello della scheda, altrimenti il primo non letto in assoluto
  const after = list.filter((b) => !b.read && b.slug !== own.slug && (b.number ?? 0) > (own.seriesNumber ?? 0));
  const next = after[0] ?? list.find((b) => !b.read && b.slug !== own.slug) ?? null;
  return { name: own.series, books: list, position: own.seriesNumber, total, read, percent: Math.round((read / total) * 100), next };
}

export function createEntry(data: Partial<JournalEntry> & { title: string }): JournalEntry {
  let created!: JournalEntry;
  update((j) => {
    const n = j.entries.reduce((max, e) => Math.max(max, e.n), 0) + 1;
    created = sanitizeEntry({ ...data, id: newId('j'), n, createdAt: now(), updatedAt: now(), startedOn: data.startedOn ?? now().slice(0, 10) }, n)!;
    j.entries.push(created);
  });
  return created;
}

export const updateEntry = (id: string, change: Partial<JournalEntry>) =>
  update((j) => {
    const i = j.entries.findIndex((e) => e.id === id);
    if (i >= 0) j.entries[i] = sanitizeEntry({ ...j.entries[i], ...change, updatedAt: now() }, i)!;
  });

export function deleteEntry(id: string) {
  const entry = getJournal().entries.find((e) => e.id === id);
  update((j) => (j.entries = j.entries.filter((e) => e.id !== id)));
  for (const m of entry?.moodboard ?? []) if (m.type === 'photo') deletePhoto(m.ref).catch(() => {});
}

export const updateSettings = (change: Partial<JournalSettings>) => update((j) => (j.settings = { ...j.settings, ...change }));

// Copertina vista come 490×760 (proporzioni della pagina): gli adesivi non toccano dorso, elastico, etichetta del nome
// e nemmeno gli altri adesivi.
const COVER_W = 490;
const COVER_H = 760;
const SPINE = 20; // striscia colorata a sinistra (dorso)
const BAND = 52; // elastico vicino al bordo destro
const LABEL = { x0: 0.16, x1: 0.84, y0: 0.36, y1: 0.74 }; // zona di nome, sottotitolo e conteggio (anche col cartiglio)
const stickerRadius = (s: number) => 31 * s; // adesivo 46px ruotato: il cerchio che lo contiene
// zone occupate dagli ornamenti (frazioni della copertina)
const ORNAMENT_ZONES: Record<JournalSettings['ornament'], Array<{ x0: number; x1: number; y0: number; y1: number }>> = {
  none: [],
  keyhole: [{ x0: 0.38, x1: 0.62, y0: 0.1, y1: 0.33 }],
  book: [{ x0: 0.28, x1: 0.72, y0: 0.76, y1: 0.93 }],
};

function fits(c: { x: number; y: number; s: number }, others: CoverSticker[], ornament: JournalSettings['ornament'] = 'none'): boolean {
  const px = (c.x / 100) * COVER_W;
  const py = (c.y / 100) * COVER_H;
  const r = stickerRadius(c.s);
  if (px - r < SPINE || px + r > COVER_W - BAND || py - r < 6 || py + r > COVER_H - 40) return false;
  for (const z of [LABEL, ...ORNAMENT_ZONES[ornament]])
    if (px > z.x0 * COVER_W - r && px < z.x1 * COVER_W + r && py > z.y0 * COVER_H - r && py < z.y1 * COVER_H + r) return false;
  return others.every((o) => Math.hypot(px - (o.x / 100) * COVER_W, py - (o.y / 100) * COVER_H) >= r + stickerRadius(o.s) + 6);
}

/** Adesivo in un punto a caso dove non tocca niente; null se sulla copertina non c'è più posto. */
export function randomSticker(name: string, others: CoverSticker[] = [], color?: string, ornament = getJournal().settings.ornament): CoverSticker | null {
  for (let i = 0; i < 250; i++) {
    const s = Math.round((0.75 + Math.random() * 0.5) * 100) / 100;
    const c = { x: Math.random() * 100, y: Math.random() * 100, s };
    if (!fits(c, others, ornament)) continue;
    return {
      name,
      x: Math.round(c.x * 10) / 10,
      y: Math.round(c.y * 10) / 10,
      r: Math.round((Math.random() - 0.5) * 50),
      s,
      c: color ?? STICKER_COLORS[Math.floor(Math.random() * STICKER_COLORS.length)],
    };
  }
  return null;
}

/** Ridistribuisce a caso gli adesivi, senza sovrapposizioni (quelli che non trovano posto restano fuori). */
export function shuffleStickers(stickers: CoverSticker[], ornament = getJournal().settings.ornament): CoverSticker[] {
  const out: CoverSticker[] = [];
  for (const x of [...stickers].sort((a, b) => b.s - a.s)) {
    const placed = randomSticker(x.name, out, x.c, ornament);
    if (placed) out.push(placed);
  }
  return out;
}

/** Dopo aver cambiato ornamento: gli adesivi che ora lo toccano vengono spostati, gli altri restano dove sono. */
export function refitStickers(stickers: CoverSticker[], ornament: JournalSettings['ornament']): CoverSticker[] {
  const kept = stickers.filter((x, i) => fits(x, stickers.filter((_, k) => k !== i), ornament));
  const out = [...kept];
  for (const x of stickers.filter((s) => !kept.includes(s))) {
    const placed = randomSticker(x.name, out, x.c, ornament);
    if (placed) out.push(placed);
  }
  return out;
}

export function onJournalChange(callback: (journal: Journal) => void): () => void {
  const local = () => callback(getJournal());
  const other = (e: StorageEvent) => {
    if (e.key === STORAGE_KEY) callback(getJournal());
  };
  window.addEventListener(CHANGE_EVENT, local);
  window.addEventListener('storage', other);
  return () => {
    window.removeEventListener(CHANGE_EVENT, local);
    window.removeEventListener('storage', other);
  };
}

export const newMoodId = () => newId('m');

// ---------------------------------------------------------------------------
// Libro del mese (facoltativo) e statistiche
// ---------------------------------------------------------------------------
export const MONTHS = ['gennaio', 'febbraio', 'marzo', 'aprile', 'maggio', 'giugno', 'luglio', 'agosto', 'settembre', 'ottobre', 'novembre', 'dicembre'];
export const monthKey = (year: number, month: number) => `${year}-${String(month + 1).padStart(2, '0')}`;

/** Imposta (o toglie, con null) il libro del mese. Un libro è libro del mese una volta sola per anno: se era altrove si sposta. */
export const setMonthly = (month: string, entryId: string | null) =>
  update((j) => {
    const year = month.slice(0, 4);
    if (entryId) for (const [m, id] of Object.entries(j.monthly)) if (id === entryId && m.startsWith(year)) delete j.monthly[m];
    if (entryId) j.monthly[month] = entryId;
    else delete j.monthly[month];
  });

/** Mese in cui il libro è libro del mese, se lo è. */
export const monthOf = (journal: Journal, entryId: string) => Object.entries(journal.monthly).find(([, id]) => id === entryId)?.[0] ?? null;

/** Anno in cui il libro conta: quello della fine lettura, altrimenti dell'inizio o della creazione. */
export const yearOf = (e: JournalEntry) => Number((e.finishedOn || e.startedOn || e.createdAt).slice(0, 4));
const monthIndexOf = (e: JournalEntry) => Number((e.finishedOn || e.startedOn || e.createdAt).slice(5, 7)) - 1;

export interface YearStats {
  year: number;
  month: number | null; // null = tutto l'anno
  books: JournalEntry[]; // libri finiti nel periodo, dal più recente
  read: number; // libri finiti nell'anno
  reading: number; // in lettura
  pages: number; // pagine dei libri finiti + pagine arrivate di quelli in corso
  avgRating: number | null; // media del voto finale (solo libri votati)
  avgDays: number | null; // giorni medi dall'inizio alla fine
  perMonth: number[]; // libri finiti per mese
  bestMonth: number | null; // indice del mese con più libri
  genres: Array<[string, number]>; // i più letti
  tropes: Array<[string, number]>;
  formats: Record<'paper' | 'ebook' | 'audio', number>;
  longest: JournalEntry | null;
  shortest: JournalEntry | null;
}

const top = (values: string[], n = 5): Array<[string, number]> =>
  [...values.reduce((m, v) => m.set(v, (m.get(v) ?? 0) + 1), new Map<string, number>())].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0], 'it')).slice(0, n);

/** Statistiche dell'anno o, con `month` (0–11), di un solo mese. */
export function statsFor(journal: Journal, year: number, month: number | null = null): YearStats {
  const inYear = journal.entries.filter((e) => yearOf(e) === year && (month == null || monthIndexOf(e) === month));
  const done = inYear.filter(isRead);
  const going = inYear.filter((e) => !isRead(e));
  const perMonth = Array(12).fill(0);
  for (const e of done) perMonth[monthIndexOf(e)]++;
  const max = Math.max(...perMonth);
  const rated = done.filter((e) => e.ratings.overall > 0);
  const timed = done.filter((e) => e.startedOn && e.finishedOn);
  const days = timed.map((e) => Math.max(1, Math.round((Date.parse(e.finishedOn) - Date.parse(e.startedOn)) / 86400000) + 1));
  const paged = done.filter((e) => e.totalPages).sort((a, b) => b.totalPages! - a.totalPages!);
  const formats = { paper: 0, ebook: 0, audio: 0 };
  for (const e of done) if (e.format) formats[e.format]++;
  return {
    year,
    month,
    books: done.slice().sort((a, b) => (b.finishedOn || '').localeCompare(a.finishedOn || '')),
    read: done.length,
    reading: going.length,
    pages: done.reduce((s, e) => s + (e.totalPages ?? 0), 0) + going.reduce((s, e) => s + (e.currentPage ?? 0), 0),
    avgRating: rated.length ? Math.round((rated.reduce((s, e) => s + e.ratings.overall, 0) / rated.length) * 10) / 10 : null,
    avgDays: days.length ? Math.round(days.reduce((a, b) => a + b, 0) / days.length) : null,
    perMonth,
    bestMonth: max > 0 ? perMonth.indexOf(max) : null,
    genres: top(done.map((e) => e.genre.trim()).filter(Boolean)),
    tropes: top(done.flatMap((e) => e.tropes)),
    formats,
    longest: paged[0] ?? null,
    shortest: paged.length > 1 ? paged[paged.length - 1] : null,
  };
}

/** Anni con qualcosa nel journal, dal più recente; c'è sempre l'anno in corso. */
export function journalYears(journal: Journal): number[] {
  const years = new Set([new Date().getFullYear(), ...journal.entries.map(yearOf), ...Object.keys(journal.monthly).map((m) => Number(m.slice(0, 4)))]);
  return [...years].sort((a, b) => b - a);
}

// ---------------------------------------------------------------------------
// Torneo dell'anno
// ---------------------------------------------------------------------------
/** Libri del mese dell'anno, in ordine di mese. */
export const monthlyOf = (journal: Journal, year: number) =>
  Object.entries(journal.monthly)
    .filter(([m]) => m.startsWith(`${year}-`))
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([month, id]) => ({ month, id }));

/** Il torneo dell'anno in corso si apre il 1° dicembre; gli anni passati sono sempre giocabili. */
export function tournamentOpensOn(year: number): Date {
  return new Date(year, 11, 1);
}
export const tournamentOpen = (year: number, today = new Date()) => today >= tournamentOpensOn(year);

/** Tabellone a potenza di 2 con passaggi del turno ai primi mesi, così nessuna sfida è vuota. */
export function buildSeeds(ids: string[]): Array<string | null> {
  let size = 2;
  while (size < ids.length) size *= 2;
  const byes = size - ids.length;
  const seeds: Array<string | null> = [];
  ids.forEach((id, i) => {
    seeds.push(id);
    if (i < byes) seeds.push(null);
  });
  return seeds;
}

/** Turni del torneo: per ogni turno gli slot (id, null = vuoto/passaggio, undefined = ancora da decidere). */
export function tournamentRounds(t: Tournament): Array<Array<string | null | undefined>> {
  const rounds: Array<Array<string | null | undefined>> = [t.seeds];
  while (rounds[rounds.length - 1].length > 1) {
    const prev = rounds[rounds.length - 1];
    const r = rounds.length - 1;
    const next: Array<string | null | undefined> = [];
    for (let m = 0; m < prev.length / 2; m++) {
      const [a, b] = [prev[m * 2], prev[m * 2 + 1]];
      if (a === undefined || b === undefined) next.push(undefined);
      else if (a === null) next.push(b);
      else if (b === null) next.push(a);
      else next.push(t.picks[`${r}-${m}`] ?? undefined);
    }
    rounds.push(next);
  }
  return rounds;
}

/** Prossima sfida da giocare (con due libri veri), o null se il torneo è finito. */
export function nextMatch(t: Tournament): { round: number; match: number; a: string; b: string } | null {
  const rounds = tournamentRounds(t);
  for (let r = 0; r < rounds.length - 1; r++)
    for (let m = 0; m < rounds[r].length / 2; m++) {
      const [a, b] = [rounds[r][m * 2], rounds[r][m * 2 + 1]];
      if (a && b && !t.picks[`${r}-${m}`]) return { round: r, match: m, a, b };
    }
  return null;
}

/** Numero di sfide vere (senza passaggi del turno): ids - 1. */
export const matchCount = (t: Tournament) => Math.max(0, t.seeds.filter(Boolean).length - 1);

export const tournamentWinner = (t: Tournament) => {
  const rounds = tournamentRounds(t);
  return rounds[rounds.length - 1][0] ?? null;
};

export const startTournament = (year: number, ids: string[]) =>
  update((j) => (j.tournaments[year] = { seeds: buildSeeds(ids), picks: {}, finishedAt: null }));

export const pickWinner = (year: number, round: number, match: number, id: string) =>
  update((j) => {
    const t = j.tournaments[year];
    if (!t) return;
    t.picks[`${round}-${match}`] = id;
    if (tournamentWinner(t)) t.finishedAt = now();
  });

export const resetTournament = (year: number) => update((j) => delete j.tournaments[year]);

// ---------------------------------------------------------------------------
// Foto della moodboard (IndexedDB)
// ---------------------------------------------------------------------------
const DB_NAME = 'isybook-journal';
const STORE = 'photos';
const MAX_PHOTO_SIDE = 1200;

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (!('indexedDB' in window)) return reject(new Error('IndexedDB non disponibile'));
    const req = indexedDB.open(DB_NAME, 1);
    req.onupgradeneeded = () => req.result.createObjectStore(STORE);
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function tx<T>(mode: IDBTransactionMode, run: (store: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const req = run(db.transaction(STORE, mode).objectStore(STORE));
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

export const photosAvailable = () => openDb().then(() => true, () => false);

/** Riduce la foto (max 1200px, WebP, senza dati EXIF come la posizione) e la salva. Restituisce l'id. */
export async function savePhoto(file: Blob): Promise<string> {
  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, MAX_PHOTO_SIDE / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement('canvas');
  canvas.width = Math.round(bitmap.width * scale);
  canvas.height = Math.round(bitmap.height * scale);
  canvas.getContext('2d')!.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  bitmap.close();
  const blob = await new Promise<Blob>((resolve, reject) =>
    canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('Foto non convertibile'))), 'image/webp', 0.82),
  );
  const id = newId('p');
  await tx('readwrite', (s) => s.put(blob, id));
  return id;
}

export const getPhoto = (id: string) => tx<Blob | undefined>('readonly', (s) => s.get(id));
export const deletePhoto = (id: string) => tx('readwrite', (s) => s.delete(id));

// ---------------------------------------------------------------------------
// Backup (insieme a quello della libreria)
// ---------------------------------------------------------------------------
const toDataUrl = (blob: Blob) =>
  new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(blob);
  });

/** Journal + foto della moodboard (in data URL) da aggiungere al file di backup. */
export async function exportJournal(): Promise<{ journal: Journal; journalPhotos: Record<string, string> }> {
  const journal = getJournal();
  const journalPhotos: Record<string, string> = {};
  for (const ref of journal.entries.flatMap((e) => e.moodboard.filter((m) => m.type === 'photo').map((m) => m.ref))) {
    try {
      const blob = await getPhoto(ref);
      if (blob) journalPhotos[ref] = await toDataUrl(blob);
    } catch {
      // foto non leggibile: il backup continua senza
    }
  }
  return { journal, journalPhotos };
}

/** Ripristina il journal da un backup (se presente) e le sue foto. */
export async function importJournal(raw: { journal?: unknown; journalPhotos?: Record<string, string> }) {
  if (!raw.journal) return;
  for (const [id, url] of Object.entries(raw.journalPhotos ?? {})) {
    if (typeof url !== 'string' || !url.startsWith('data:image/')) continue;
    try {
      const blob = await (await fetch(url)).blob();
      await tx('readwrite', (s) => s.put(blob, id));
    } catch {
      // senza IndexedDB la foto si perde, il resto del journal no
    }
  }
  save(sanitize(raw.journal));
}
