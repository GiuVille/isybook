// Book journal di La mia libreria: una scheda per ogni libro letto o in lettura, con voti, recensione,
// moodboard e l'aspetto dell'agendina scelto da chi legge. Tutto nel browser come la libreria:
// testi e impostazioni in localStorage, foto della moodboard in IndexedDB (localStorage si riempirebbe subito).

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

export interface JournalSettings {
  cover: string; // id di COVER_COLORS
  material: 'leather' | 'linen' | 'kraft';
  band: string; // colore dell'elastico
  ribbon: string; // colore del segnalibro
  paper: 'lines' | 'dots' | 'grid';
  ink: string; // id di INKS
  hand: boolean; // scrittura a mano
  charm: string; // nome di uno scarabocchio appeso all'elastico, '' = nessuno
  sticker: string; // adesivo sulla copertina, '' = nessuno
  name: string; // scritto sulla copertina
}

export interface Journal {
  version: 1;
  entries: JournalEntry[];
  settings: JournalSettings;
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
];
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
  name: 'Il mio book journal',
};

const now = () => new Date().toISOString();
const empty = (): Journal => ({ version: 1, entries: [], settings: { ...DEFAULT_SETTINGS }, updatedAt: now() });

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
  const s: Partial<JournalSettings> = r.settings ?? {};
  const color = (v: unknown, fallback: string) => (typeof v === 'string' && /^#[0-9a-f]{6}$/i.test(v) ? v : fallback);
  return {
    version: 1,
    entries: (Array.isArray(r.entries) ? r.entries : []).map(sanitizeEntry).filter((e): e is JournalEntry => e !== null),
    settings: {
      cover: COVER_COLORS.some((c) => c.id === s.cover) ? s.cover! : DEFAULT_SETTINGS.cover,
      material: oneOf(s.material, ['leather', 'linen', 'kraft'] as const) ?? DEFAULT_SETTINGS.material,
      band: color(s.band, DEFAULT_SETTINGS.band),
      ribbon: color(s.ribbon, DEFAULT_SETTINGS.ribbon),
      paper: oneOf(s.paper, ['lines', 'dots', 'grid'] as const) ?? DEFAULT_SETTINGS.paper,
      ink: INKS.some((c) => c.id === s.ink) ? s.ink! : DEFAULT_SETTINGS.ink,
      hand: typeof s.hand === 'boolean' ? s.hand : DEFAULT_SETTINGS.hand,
      charm: typeof s.charm === 'string' ? s.charm : DEFAULT_SETTINGS.charm,
      sticker: typeof s.sticker === 'string' ? s.sticker : DEFAULT_SETTINGS.sticker,
      name: typeof s.name === 'string' ? s.name.slice(0, 40) : DEFAULT_SETTINGS.name,
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
