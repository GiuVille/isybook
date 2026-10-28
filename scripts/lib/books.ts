// Recupero dati bibliografici per ISBN: Google Books, con Open Library come integrazione.

export interface BookData {
  isbn: string;
  title: string;
  subtitle?: string;
  authors: string[];
  publisher?: string;
  publishedDate?: string; // YYYY-MM-DD quando disponibile
  description?: string;
  language?: string;
  pageCount?: number;
  coverUrl?: string;
  categories: string[];
  sources: string[];
}

const USER_AGENT = 'IsyBook/0.1 (catalogo libri)';

export function normalizeIsbn(raw: string): string {
  return raw.replace(/[^0-9Xx]/g, '').toUpperCase();
}

/** Accetta 2026, 2026-11 o 2026-11-12 e restituisce una data ISO solo se completa. */
function toIsoDate(value?: string): string | undefined {
  if (!value) return undefined;
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) return value;
  const d = new Date(`${value} UTC`);
  return /\d{1,2}.*\d{4}/.test(value) && !Number.isNaN(d.getTime()) ? d.toISOString().slice(0, 10) : undefined;
}

const LANGUAGES: Record<string, string> = { ita: 'it', eng: 'en', spa: 'es', fre: 'fr', fra: 'fr', ger: 'de', deu: 'de' };

function toLanguage(code?: string): string | undefined {
  return code ? LANGUAGES[code] ?? code : undefined;
}

async function getJson<T>(url: string): Promise<T | null> {
  const res = await fetch(url, { headers: { 'User-Agent': USER_AGENT } });
  if (res.status === 404) return null;
  if (!res.ok) throw new Error(`${url} → HTTP ${res.status}`);
  return (await res.json()) as T;
}

async function fromGoogleBooks(isbn: string): Promise<Partial<BookData> | null> {
  const key = process.env.GOOGLE_BOOKS_API_KEY;
  const url = `https://www.googleapis.com/books/v1/volumes?q=isbn:${isbn}${key ? `&key=${key}` : ''}`;
  const data = await getJson<{ items?: Array<{ volumeInfo: Record<string, any> }> }>(url);
  const v = data?.items?.[0]?.volumeInfo;
  if (!v) return null;
  return {
    title: v.title,
    subtitle: v.subtitle,
    authors: v.authors ?? [],
    publisher: v.publisher,
    publishedDate: toIsoDate(v.publishedDate),
    description: v.description,
    language: v.language,
    pageCount: v.pageCount,
    coverUrl: v.imageLinks?.thumbnail?.replace(/^http:/, 'https:'),
    categories: v.categories ?? [],
  };
}

async function fromOpenLibrary(isbn: string): Promise<Partial<BookData> | null> {
  const edition = await getJson<Record<string, any>>(`https://openlibrary.org/isbn/${isbn}.json`);
  if (!edition) return null;

  const authors: string[] = [];
  for (const ref of edition.authors ?? []) {
    const author = await getJson<{ name?: string }>(`https://openlibrary.org${ref.key}.json`);
    if (author?.name) authors.push(author.name);
  }

  let description: string | undefined =
    typeof edition.description === 'string' ? edition.description : edition.description?.value;
  let categories: string[] = [];
  const workKey = edition.works?.[0]?.key;
  if (workKey) {
    const work = await getJson<Record<string, any>>(`https://openlibrary.org${workKey}.json`);
    description ??= typeof work?.description === 'string' ? work.description : work?.description?.value;
    categories = (work?.subjects ?? []).slice(0, 10);
  }

  return {
    title: edition.title,
    subtitle: edition.subtitle,
    authors,
    publisher: edition.publishers?.[0],
    publishedDate: toIsoDate(edition.publish_date),
    description,
    language: toLanguage(edition.languages?.[0]?.key?.split('/').pop()),
    pageCount: edition.number_of_pages,
    coverUrl: edition.covers?.[0] ? `https://covers.openlibrary.org/b/id/${edition.covers[0]}-L.jpg` : undefined,
    categories,
  };
}

/** Unisce le due fonti: Google Books ha la precedenza, Open Library riempie i buchi. */
export async function fetchBook(rawIsbn: string): Promise<BookData | null> {
  const isbn = normalizeIsbn(rawIsbn);
  const [google, openLibrary] = await Promise.all([
    fromGoogleBooks(isbn).catch((e) => (console.warn(`Google Books: ${e.message}`), null)),
    fromOpenLibrary(isbn).catch((e) => (console.warn(`Open Library: ${e.message}`), null)),
  ]);
  if (!google && !openLibrary) return null;

  const pick = <K extends keyof BookData>(key: K) => (google?.[key] || openLibrary?.[key]) as BookData[K];
  const authors = google?.authors?.length ? google.authors : openLibrary?.authors ?? [];
  return {
    isbn,
    title: pick('title'),
    subtitle: pick('subtitle'),
    authors,
    publisher: pick('publisher'),
    publishedDate: pick('publishedDate'),
    description: pick('description'),
    language: pick('language'),
    pageCount: pick('pageCount'),
    coverUrl: pick('coverUrl'),
    categories: [...new Set([...(google?.categories ?? []), ...(openLibrary?.categories ?? [])])],
    sources: [google && 'google-books', openLibrary && 'open-library'].filter(Boolean) as string[],
  };
}
