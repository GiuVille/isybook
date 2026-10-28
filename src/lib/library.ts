// Libreria personale salvata nel browser: preferiti, cartelle e interessi.
// Niente account per ora: i libri sono identificati dallo slug, così un futuro
// account potrà importare questi dati senza perdite.

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

export interface Library {
  version: 1;
  favorites: string[];
  collections: Collection[];
  interests: Interests | null;
  onboardingDone: boolean;
  updatedAt: string;
}

export const STORAGE_KEY = 'isybook:v1';
export const CHANGE_EVENT = 'library-change';

function empty(): Library {
  return { version: 1, favorites: [], collections: [], interests: null, onboardingDone: false, updatedAt: new Date().toISOString() };
}

// ripiego in memoria quando localStorage non è disponibile (navigazione privata, storage bloccato)
let memory: Library | null = null;

function sanitize(raw: unknown): Library {
  const base = empty();
  if (!raw || typeof raw !== 'object') return base;
  const r = raw as Partial<Library>;
  const strings = (v: unknown) => (Array.isArray(v) ? v.filter((x): x is string => typeof x === 'string') : []);
  return {
    version: 1,
    favorites: [...new Set(strings(r.favorites))],
    collections: Array.isArray(r.collections)
      ? r.collections
          .filter((c): c is Collection => Boolean(c) && typeof c.id === 'string' && typeof c.name === 'string')
          .map((c) => ({ id: c.id, name: c.name, slugs: [...new Set(strings(c.slugs))], createdAt: c.createdAt ?? base.updatedAt }))
      : [],
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

export const isFavorite = (slug: string) => getLibrary().favorites.includes(slug);

export const toggleFavorite = (slug: string) => update((l) => (l.favorites = toggle(l.favorites, slug)));

export function createCollection(name: string): Collection {
  const collection: Collection = {
    id: `c-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`,
    name: name.trim() || 'Nuova cartella',
    slugs: [],
    createdAt: new Date().toISOString(),
  };
  update((l) => l.collections.push(collection));
  return collection;
}

export const renameCollection = (id: string, name: string) =>
  update((l) => {
    const c = l.collections.find((c) => c.id === id);
    if (c && name.trim()) c.name = name.trim();
  });

export const deleteCollection = (id: string) => update((l) => (l.collections = l.collections.filter((c) => c.id !== id)));

export const toggleInCollection = (id: string, slug: string) =>
  update((l) => {
    const c = l.collections.find((c) => c.id === id);
    if (c) c.slugs = toggle(c.slugs, slug);
  });

export const removeFromCollection = (id: string, slug: string) =>
  update((l) => {
    const c = l.collections.find((c) => c.id === id);
    if (c) c.slugs = c.slugs.filter((s) => s !== slug);
  });

export const setInterests = (interests: Interests) =>
  update((l) => {
    l.interests = interests;
    l.onboardingDone = true;
  });

export const markOnboardingDone = () => update((l) => (l.onboardingDone = true));

/** Numero di libri diversi salvati tra preferiti e cartelle. */
export function savedCount(library = getLibrary()): number {
  return new Set([...library.favorites, ...library.collections.flatMap((c) => c.slugs)]).size;
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
