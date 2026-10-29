// Libreria personale salvata nel browser: libri (preferiti e cartelle), videoteca (serie e film
// "da vedere" e cartelle proprie) e interessi. Niente account per ora: tutto è identificato dallo slug,
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

export const STORAGE_KEY = 'isybook:v1';
export const CHANGE_EVENT = 'library-change';

function empty(): Library {
  return {
    version: 1,
    favorites: [],
    collections: [],
    screenFavorites: [],
    screenCollections: [],
    interests: null,
    onboardingDone: false,
    updatedAt: new Date().toISOString(),
  };
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
    collections: collections(r.collections),
    // librerie salvate prima della videoteca: questi campi mancano e partono vuoti
    screenFavorites: [...new Set(strings(r.screenFavorites))],
    screenCollections: collections(r.screenCollections),
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

/** Preferiti (libri) o "Da vedere" (videoteca). */
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
    if (c && name.trim()) c.name = name.trim();
  });

export const deleteCollection = (id: string, kind: ItemKind = 'book') =>
  update((l) => (l[colKey(kind)] = l[colKey(kind)].filter((c) => c.id !== id)));

export const toggleInCollection = (id: string, slug: string, kind: ItemKind = 'book') =>
  update((l) => {
    const c = findCollection(l, id, kind);
    if (c) c.slugs = toggle(c.slugs, slug);
  });

export const removeFromCollection = (id: string, slug: string, kind: ItemKind = 'book') =>
  update((l) => {
    const c = findCollection(l, id, kind);
    if (c) c.slugs = c.slugs.filter((s) => s !== slug);
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
