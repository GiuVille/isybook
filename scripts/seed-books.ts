// Semina automatica del catalogo: cerca libri su Google Books (in italiano) a partire da scripts/seed.json
// (ricerche, autrici e autori, editori) e dalle autrici già in catalogo.
//
// Per non lasciare il sito spoglio, i dati del libro (titolo, autrici, editore, edizione, copertina) si pubblicano
// SUBITO, ma senza trama e senza tropes: la scheda mostra "La trama arriva presto". La trama riscritta in automatico
// e i tropes suggeriti vanno in "Da approvare" come elemento "Trama": la redazione li corregge e li approva.
// La quarta di copertina dell'editore resta solo come riferimento in coda: non si pubblica mai.
//
//   npm run seed                   prossimo lotto (seed.json → batch)
//   npm run seed -- --dry-run      solo le ricerche: elenca i libri candidati, senza AI né scritture
//   npm run seed -- --raw          senza AI: la trama in coda è vuota, da scrivere a mano
//   npm run seed -- --batch 10     quanti libri in questa esecuzione
//
// A lotti per restare nei limiti gratuiti (AI e Google Books, meglio con GOOGLE_BOOKS_API_KEY): si rilancia finché
// ci sono candidati, anche dal workflow seed.yml. I libri già in catalogo o già passati dalla coda non tornano.
import { mkdir, writeFile } from 'node:fs/promises';
import { parseArgs } from 'node:util';
import { aiConfigured, rewritePlot, suggestTropes } from './lib/ai.ts';
import { bookPayload, knownTropes } from './lib/book-payload.ts';
import { fetchBook, normalizeIsbn } from './lib/books.ts';
import { notifyEditors } from './lib/notify.ts';
import { readJson, sb, similar } from './lib/sources.ts';
import { publishBook, type BookPayload } from '../src/admin/review.ts';

interface SeedConfig {
  perQuery: number;
  batch: number;
  queries: string[];
  authors: string[];
  publishers: string[];
}

interface Candidate {
  isbn: string;
  title: string;
  authors: string[];
  found: string; // la ricerca che l'ha trovato
}

const { values: flags } = parseArgs({
  options: {
    'dry-run': { type: 'boolean', default: false },
    raw: { type: 'boolean', default: false },
    batch: { type: 'string' },
  },
});
const dryRun = flags['dry-run'];
const config = await readJson<SeedConfig>(new URL('./seed.json', import.meta.url), { perQuery: 20, batch: 40, queries: [], authors: [], publishers: [] });
const batch = Number(flags.batch ?? config.batch) || 40;
const useAi = !flags.raw && !dryRun && aiConfigured();
if (!flags.raw && !dryRun && !aiConfigured()) {
  console.log('Modulo AI non configurato: preparo le schede senza trama (come con --raw).');
}
const pause = (ms: number) => new Promise((r) => setTimeout(r, ms));

// ---------------------------------------------------------------------------
// Ciò che conosciamo già: catalogo e coda (anche scartati, così non tornano)
// ---------------------------------------------------------------------------
async function known(): Promise<{ isbns: Set<string>; titles: string[]; authors: string[] }> {
  const isbns = new Set<string>();
  const titles: string[] = [];
  const authors: string[] = [];
  if (!sb) return { isbns, titles, authors };
  const [editions, works, queue, people] = await Promise.all([
    sb.from('editions').select('isbn'),
    sb.from('works').select('title'),
    sb.from('review_queue').select('payload').eq('content_type', 'book'),
    sb.from('authors').select('name'),
  ]);
  for (const r of [editions, works, queue, people]) if (r.error) throw r.error;
  for (const e of editions.data ?? []) if (e.isbn) isbns.add(normalizeIsbn(e.isbn));
  for (const w of works.data ?? []) titles.push(w.title);
  for (const q of queue.data ?? []) {
    if (q.payload?.edition?.isbn) isbns.add(normalizeIsbn(q.payload.edition.isbn));
    if (q.payload?.work?.title) titles.push(q.payload.work.title);
  }
  for (const a of people.data ?? []) authors.push(a.name);
  return { isbns, titles, authors };
}

// ---------------------------------------------------------------------------
// Ricerca su Google Books
// ---------------------------------------------------------------------------
interface Volume {
  volumeInfo?: {
    title?: string;
    authors?: string[];
    language?: string;
    industryIdentifiers?: Array<{ type: string; identifier: string }>;
  };
}

async function search(q: string, max: number): Promise<Candidate[]> {
  const key = process.env.GOOGLE_BOOKS_API_KEY;
  const url = `https://www.googleapis.com/books/v1/volumes?q=${encodeURIComponent(q)}&langRestrict=it&printType=books&maxResults=${Math.min(40, max)}&orderBy=relevance${key ? `&key=${key}` : ''}`;
  // "troppe richieste": si aspetta sempre di più e si riprova (senza chiave il limite di Google è molto basso)
  let res: Response | null = null;
  for (let attempt = 0; attempt < 4; attempt++) {
    res = await fetch(url, { headers: { 'User-Agent': 'IsyBooks/0.1 (catalogo libri)' } });
    if (res.status !== 429 && res.status < 500) break;
    await pause(2000 * 2 ** attempt);
  }
  if (!res || !res.ok) {
    console.warn(`  Google Books ha risposto ${res?.status} per «${q}»${key ? '' : ' (senza GOOGLE_BOOKS_API_KEY il limite è molto basso)'}`);
    return [];
  }
  const data = (await res.json()) as { items?: Volume[] };
  return (data.items ?? []).flatMap((v): Candidate[] => {
    const info = v.volumeInfo;
    const id = info?.industryIdentifiers?.find((i) => i.type === 'ISBN_13') ?? info?.industryIdentifiers?.find((i) => i.type === 'ISBN_10');
    if (!info?.title || !id || (info.language && info.language !== 'it')) return [];
    return [{ isbn: normalizeIsbn(id.identifier), title: info.title, authors: info.authors ?? [], found: q }];
  });
}

const k = await known();
const searches = [
  ...config.queries.map((q) => q),
  ...[...new Set([...config.authors, ...k.authors])].map((a) => `inauthor:"${a}"`),
  ...config.publishers.map((p) => `inpublisher:"${p}" romance OR fantasy`),
];

const candidates: Candidate[] = [];
const isNew = (c: Candidate) =>
  !k.isbns.has(c.isbn) &&
  !candidates.some((x) => x.isbn === c.isbn || (similar(x.title, c.title) && x.authors[0] === c.authors[0])) &&
  !k.titles.some((t) => similar(t, c.title));

console.log(`Ricerche: ${searches.length} (di cui ${k.authors.length} autrici e autori già in catalogo).`);
for (const q of searches) {
  if (!dryRun && candidates.length >= batch * 3) break; // abbastanza per questo lotto e i prossimi due
  const found = (await search(q, config.perQuery)).filter(isNew);
  candidates.push(...found);
  console.log(`- ${q}: ${found.length} nuovi`);
  await pause(300); // gentili con l'API pubblica
}

console.log(`\nCandidati nuovi: ${candidates.length}.`);
if (dryRun) {
  for (const c of candidates.slice(0, 60)) console.log(`  ${c.isbn}  ${c.title} — ${c.authors.join(', ')}  (${c.found})`);
  if (candidates.length > 60) console.log(`  …e altri ${candidates.length - 60}`);
  console.log('\nProva: nessuna scheda preparata, nessuna scrittura.');
  process.exit(0);
}

// ---------------------------------------------------------------------------
// Schede del lotto
// ---------------------------------------------------------------------------
const tropeList = useAi ? await knownTropes(sb) : [];
const prepared: Array<{ book: ReturnType<typeof bookPayload>; plot: string | null; tropes: string[] }> = [];
for (const c of candidates.slice(0, batch)) {
  try {
    const book = await fetchBook(c.isbn);
    if (!book?.title) continue;
    let plot: string | null = null;
    let tropes: string[] = [];
    if (useAi && book.description) {
      plot = await rewritePlot(book.description, { title: book.title, authors: book.authors });
      tropes = await suggestTropes({ title: book.title, description: book.description }, tropeList);
      await pause(1500); // limiti dei piani gratuiti
    }
    prepared.push({
      // il libro si pubblica senza trama e senza tropes: quelli passano dalla redazione
      book: bookPayload({
        title: book.title,
        authors: book.authors,
        publisher: book.publisher,
        isbn: book.isbn,
        format: 'paperback',
        editionType: 'standard',
        releaseDate: book.publishedDate,
        language: book.language,
        coverUrl: book.coverUrl,
        pages: book.pageCount,
        plot: null,
        tropes: [],
        description: book.description,
        meta: { sources: book.sources, categories: book.categories, seed: c.found },
      }),
      plot,
      tropes,
    });
    console.log(`✓ ${book.title}`);
  } catch (err) {
    console.error(`✗ ${c.isbn}: ${(err as Error).message}`);
  }
}

if (prepared.length) {
  if (sb) {
    const known = new Set(tropeList.map((t) => t.slug));
    let published = 0;
    for (const { book, plot, tropes } of prepared) {
      try {
        const workId = await publishBook(sb, book as unknown as BookPayload);
        const { error } = await sb.from('review_queue').insert({
          content_type: 'plot',
          payload: {
            work_id: workId,
            work_slug: book.work.slug,
            title: book.work.title,
            authors: book.authors.map((a) => a.name),
            cover_url: book.edition.cover_url,
            plot,
            tropes: tropes.filter((t) => known.has(t)),
            new_tropes: tropes.filter((t) => !known.has(t)).map((slug) => ({ slug, name: slug.replace(/-/g, ' ') })),
            original_description: book.original_description,
          },
        });
        if (error) throw error;
        published++;
      } catch (err) {
        console.error(`✗ ${book.work.title}: ${(err as Error).message}`);
      }
    }
    console.log(`\n${published} libri pubblicati (senza trama) e ${published} trame in "Da approvare". Candidati rimasti: ${Math.max(0, candidates.length - batch)}.`);
    await notifyEditors(`📚 ${published} libri aggiunti al catalogo: le trame aspettano la tua approvazione`, prepared.map((p) => p.book.work.title));
  } else {
    await mkdir('scripts/out', { recursive: true });
    const file = `scripts/out/seed-${new Date().toISOString().slice(0, 10)}.json`;
    await writeFile(file, JSON.stringify(prepared, null, 2));
    console.log(`\n${prepared.length} schede salvate in ${file} (Supabase non configurato).`);
  }
}
