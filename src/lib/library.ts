// Libreria personale salvata nel browser: libri (preferiti e cartelle), videoteca (serie e film
// preferite, "Da vedere", "Visti" e cartelle proprie) e interessi. Niente account per ora: tutto è identificato dallo slug,
// così un futuro account potrà importare questi dati senza perdite.

export interface Collection {
  id: string;
  name: string;
  slugs: string[];
  createdAt: string;
}

export interface Interests {
  tropes: string[];
  genres: string[];
  settings: string[];
}

/** 'book' = libri, 'screen' = serie TV e film (videoteca). */
export type ItemKind = 'book' | 'screen';

export interface Library {
  version: 1;
  favorites: string[];
  collections: Collection[];
  screenFavorites: string[];
  screenCollections: Collection[];
  interests: Interests | null;
  onboardingDone: boolean;
  updatedAt: string;
}

/** Cartelle sempre presenti, non rinominabili né eliminabili. La TBR è un sottoinsieme dei libri posseduti;
 * nella videoteca un titolo è o da vedere o visto. */
export const OWNED_ID = 'possiedo';
export const TBR_ID = 'tbr';
export const TO_WATCH_ID = 'da-vedere';
export const WATCHED_ID = 'visti';
const PRESET_COLLECTIONS: Record<ItemKind, Array<{ id: string; name: string }>> = {
  book: [
    { id: OWNED_ID, name: 'I miei libri' },
    { id: TBR_ID, name: 'TBR' },
  ],
  screen: [
    { id: TO_WATCH_ID, name: 'Da vedere' },
    { id: WATCHED_ID, name: 'Visti' },
  ],
};
export const isPreset = (id: string, kind: ItemKind = 'book') => PRESET_COLLECTIONS[kind].some((p) => p.id === id);

export const STORAGE_KEY = 'isybook:v1';
export const CHANGE_EVENT = 'library-change';

function empty(): Library {
  return {
    version: 1,
    favorites: [],
    collections: withPresets([], 'book'),
    screenFavorites: [],
    screenCollections: withPresets([], 'screen'),
    interests: null,
    onboardingDone: false,
    updatedAt: new Date().toISOString(),
  };
}

/** Le cartelle preimpostate in testa (create vuote se mancano, nome fisso), poi quelle personali. */
function withPresets(collections: Collection[], kind: ItemKind): Collection[] {
  const presets = PRESET_COLLECTIONS[kind].map((p) => {
    const found = collections.find((c) => c.id === p.id);
    return { id: p.id, name: p.name, slugs: found?.slugs ?? [], createdAt: found?.createdAt ?? '2026-10-29T00:00:00.000Z' };
  });
  if (kind === 'book') {
    const tbr = presets.find((c) => c.id === TBR_ID)!.slugs;
    const owned = presets.find((c) => c.id === OWNED_ID)!;
    owned.slugs = [...new Set([...owned.slugs, ...tbr])];
  }
  return [...presets, ...collections.filter((c) => !isPreset(c.id, kind))];
}

// ripiego in memoria quando localStorage non è disponibile (navigazione privata, storage bloccato)
let memory: Library | null = null;

function sanitize(raw: unknown): Library {
  const base = empty();
  if (!raw || typeof raw !== 'object') return base;
  const r = raw as Partial<Library>;
  const strings = (v: unknown) => (Array.isArray(v) ? v.filter((x): x is string => typeof x === 'string') : []);
  const collections = (v: unknown): Collection[] =>
    Array.isArray(v)
      ? v
          .filter((c): c is Collection => Boolean(c) && typeof c.id === 'string' && typeof c.name === 'string')
          .map((c) => ({ id: c.id, name: c.name, slugs: [...new Set(strings(c.slugs))], createdAt: c.createdAt ?? base.updatedAt }))
      : [];
  return {
    version: 1,
    favorites: [...new Set(strings(r.favorites))],
    collections: withPresets(collections(r.collections), 'book'),
    // librerie salvate prima della videoteca: questi campi mancano e partono vuoti
    screenFavorites: [...new Set(strings(r.screenFavorites))],
    screenCollections: withPresets(collections(r.screenCollections), 'screen'),
    interests: r.interests
      ? { tropes: strings(r.interests.tropes), genres: strings(r.interests.genres), settings: strings(r.interests.settings) }
      : null,
    onboardingDone: Boolean(r.onboardingDone),
    updatedAt: typeof r.updatedAt === 'string' ? r.updatedAt : base.updatedAt,
  };
}

export function getLibrary(): Library {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) return sanitize(JSON.parse(raw));
  } catch {
    // storage non leggibile: uso la copia in memoria
  }
  return memory ?? empty();
}

function save(library: Library): Library {
  library.updatedAt = new Date().toISOString();
  memory = library;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(library));
  } catch {
    // resta in memoria per questa sessione
  }
  if (typeof window !== 'undefined') window.dispatchEvent(new CustomEvent(CHANGE_EVENT, { detail: library }));
  return library;
}

function update(change: (library: Library) => void): Library {
  const library = getLibrary();
  change(library);
  return save(library);
}

const toggle = (list: string[], value: string) =>
  list.includes(value) ? list.filter((v) => v !== value) : [...list, value];

const favKey = (kind: ItemKind) => (kind === 'screen' ? 'screenFavorites' : 'favorites');
const colKey = (kind: ItemKind) => (kind === 'screen' ? 'screenCollections' : 'collections');

/** Preferiti dei libri o della videoteca. */
export const favoritesOf = (library: Library, kind: ItemKind = 'book') => library[favKey(kind)];
export const collectionsOf = (library: Library, kind: ItemKind = 'book') => library[colKey(kind)];

export const isFavorite = (slug: string, kind: ItemKind = 'book') => favoritesOf(getLibrary(), kind).includes(slug);

export const toggleFavorite = (slug: string, kind: ItemKind = 'book') =>
  update((l) => (l[favKey(kind)] = toggle(l[favKey(kind)], slug)));

export function createCollection(name: string, kind: ItemKind = 'book'): Collection {
  const collection: Collection = {
    id: `${kind === 'screen' ? 'v' : 'c'}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`,
    name: name.trim() || 'Nuova cartella',
    slugs: [],
    createdAt: new Date().toISOString(),
  };
  update((l) => l[colKey(kind)].push(collection));
  return collection;
}

const findCollection = (l: Library, id: string, kind: ItemKind) => l[colKey(kind)].find((c) => c.id === id);

export const renameCollection = (id: string, name: string, kind: ItemKind = 'book') =>
  update((l) => {
    const c = findCollection(l, id, kind);
    if (c && name.trim() && !isPreset(c.id, kind)) c.name = name.trim();
  });

export const deleteCollection = (id: string, kind: ItemKind = 'book') =>
  update((l) => (l[colKey(kind)] = l[colKey(kind)].filter((c) => c.id !== id || isPreset(c.id, kind))));

// un libro in TBR è anche posseduto; un libro che non possiedi più esce anche dalla TBR.
// Un titolo visto esce da "Da vedere" e viceversa.
function linkPresets(l: Library, id: string, slug: string, kind: ItemKind) {
  if (kind === 'screen') {
    const other = id === TO_WATCH_ID ? WATCHED_ID : id === WATCHED_ID ? TO_WATCH_ID : null;
    const added = findCollection(l, id, kind)?.slugs.includes(slug);
    const o = other && findCollection(l, other, kind);
    if (o && added) o.slugs = o.slugs.filter((s) => s !== slug);
    return;
  }
  const owned = findCollection(l, OWNED_ID, kind);
  const tbr = findCollection(l, TBR_ID, kind);
  if (!owned || !tbr) return;
  if (id === TBR_ID && tbr.slugs.includes(slug) && !owned.slugs.includes(slug)) owned.slugs.push(slug);
  if (id === OWNED_ID && !owned.slugs.includes(slug)) tbr.slugs = tbr.slugs.filter((s) => s !== slug);
}

export const toggleInCollection = (id: string, slug: string, kind: ItemKind = 'book') =>
  update((l) => {
    const c = findCollection(l, id, kind);
    if (c) c.slugs = toggle(c.slugs, slug);
    linkPresets(l, id, slug, kind);
  });

export const removeFromCollection = (id: string, slug: string, kind: ItemKind = 'book') =>
  update((l) => {
    const c = findCollection(l, id, kind);
    if (c) c.slugs = c.slugs.filter((s) => s !== slug);
    linkPresets(l, id, slug, kind);
  });

export const setInterests = (interests: Interests) =>
  update((l) => {
    l.interests = interests;
    l.onboardingDone = true;
  });

export const markOnboardingDone = () => update((l) => (l.onboardingDone = true));

/** Numero di titoli diversi salvati: libri più serie e film. */
export function savedCount(library = getLibrary()): number {
  const books = new Set([...library.favorites, ...library.collections.flatMap((c) => c.slugs)]);
  const screens = new Set([...library.screenFavorites, ...library.screenCollections.flatMap((c) => c.slugs)]);
  return books.size + screens.size;
}

export const exportLibrary = () => JSON.stringify(getLibrary(), null, 2);

/** Importa un backup sostituendo i dati attuali. Lancia un errore se il file non è valido. */
export function importLibrary(json: string): Library {
  const parsed = JSON.parse(json);
  if (!parsed || parsed.version !== 1) throw new Error('File di backup non riconosciuto');
  return save(sanitize(parsed));
}

/** Richiama `callback` a ogni modifica, anche da altre schede. Restituisce la funzione per smettere. */
export function onLibraryChange(callback: (library: Library) => void): () => void {
  const local = () => callback(getLibrary());
  const other = (e: StorageEvent) => {
    if (e.key === STORAGE_KEY) callback(getLibrary());
  };
  window.addEventListener(CHANGE_EVENT, local);
  window.addEventListener('storage', other);
  return () => {
    window.removeEventListener(CHANGE_EVENT, local);
    window.removeEventListener('storage', other);
  };
}
