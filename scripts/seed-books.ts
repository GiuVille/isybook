// Semina automatica del catalogo: cerca libri su Google Books (in italiano) a partire da scripts/seed.json e dalle
// autrici già in catalogo. Ordine: titoli obbligatori, autrici di riferimento (tutti i loro libri), autrici simili
// suggerite dall'AI a partire da quelle di riferimento (verificate su Google Books: un nome sbagliato non porta nulla),
// altre autrici, editori, ricerche per genere.
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
import { aiConfigured, rewritePlot, similarAuthors, suggestGenres, suggestTropes } from './lib/ai.ts';
import { bookPayload, genresFromCategories, knownGenres, knownTropes } from './lib/book-payload.ts';
import { fetchBook, normalizeIsbn } from './lib/books.ts';
import { notifyEditors } from './lib/notify.ts';
import { readJson, sb, similar } from './lib/sources.ts';
import { publishBook, type BookPayload } from '../src/admin/review.ts';

interface SeedConfig {
  perQuery: number;
  batch: number;
  /** Devono esserci: cercati per primi (titolo + autrice). */
  titles: Array<{ title: string; author: string }>;
  /** Riferimento principale: tutti i loro libri, e la base per trovare autrici simili. */
  reference: string[];
  /** Quante autrici simili chiedere all'AI (0 = nessuna). */
  similar: number;
  queries: string[];
  authors: string[];
  publishers: string[];
}

interface Candidate {
  isbn: string;
  title: string;
  authors: string[];
  found: string; // la ricerca che l'ha trovato
  editionType: 'standard' | 'special' | 'limited';
  publisher: string;
  score: number; // più alto = scheda più completa (trama, copertina, categorie di narrativa)
}

const { values: flags } = parseArgs({
  options: {
    'dry-run': { type: 'boolean', default: false },
    raw: { type: 'boolean', default: false },
    batch: { type: 'string' },
  },
});
const dryRun = flags['dry-run'];
const config = await readJson<SeedConfig>(new URL('./seed.json', import.meta.url), {
  perQuery: 20,
  batch: 40,
  titles: [],
  reference: [],
  similar: 0,
  queries: [],
  authors: [],
  publishers: [],
});
const batch = Number(flags.batch ?? config.batch) || 40;
const useAi = !flags.raw && !dryRun && aiConfigured();
if (!flags.raw && !dryRun && !aiConfigured()) {
  console.log('Modulo AI non configurato: preparo le schede senza trama (come con --raw).');
}
const pause = (ms: number) => new Promise((r) => setTimeout(r, ms));

// ---------------------------------------------------------------------------
// Ciò che conosciamo già: catalogo e coda (anche scartati, così non tornano)
// ---------------------------------------------------------------------------
// Edizioni già note come opera + tipo: una special in catalogo non deve bloccare l'edizione normale, e viceversa.
interface KnownEdition {
  title: string;
  type: string;
}

async function known(): Promise<{ isbns: Set<string>; titles: string[]; editions: KnownEdition[]; authors: string[] }> {
  const isbns = new Set<string>();
  const titles: string[] = [];
  const known: KnownEdition[] = [];
  const authors: string[] = [];
  if (!sb) return { isbns, titles, editions: known, authors };
  const [editions, works, queue, people] = await Promise.all([
    sb.from('editions').select('isbn, edition_type, works ( title )'),
    sb.from('works').select('title'),
    sb.from('review_queue').select('payload').eq('content_type', 'book'),
    sb.from('authors').select('name'),
  ]);
  for (const r of [editions, works, queue, people]) if (r.error) throw r.error;
  for (const e of (editions.data ?? []) as unknown as Array<{ isbn: string | null; edition_type: string; works: { title: string } | null }>) {
    if (e.isbn) isbns.add(normalizeIsbn(e.isbn));
    if (e.works?.title) known.push({ title: e.works.title, type: e.edition_type });
  }
  for (const w of works.data ?? []) titles.push(w.title);
  for (const q of queue.data ?? []) {
    if (q.payload?.edition?.isbn) isbns.add(normalizeIsbn(q.payload.edition.isbn));
    if (q.payload?.work?.title) {
      titles.push(q.payload.work.title);
      known.push({ title: q.payload.work.title, type: q.payload.edition?.edition_type ?? 'standard' });
    }
  }
  for (const a of people.data ?? []) authors.push(a.name);
  return { isbns, titles, editions: known, authors };
}

// ---------------------------------------------------------------------------
// Ricerca su Google Books
// ---------------------------------------------------------------------------
interface Volume {
  volumeInfo?: {
    title?: string;
    authors?: string[];
    language?: string;
    description?: string;
    publisher?: string;
    categories?: string[];
    imageLinks?: unknown;
    industryIdentifiers?: Array<{ type: string; identifier: string }>;
  };
}

// Narrativa sì, saggi e manuali no. Google usa le categorie BISAC in inglese.
const FICTION = /fiction|romance|fantasy|young adult|juvenile|narrativa/i;
const NOT_FICTION = /criticism|biography|philosophy|history|religion|education|self-help|psychology|social science|business|cooking|reference|study aids|language arts/i;

/**
 * Le special e le limitate arrivano da Google come libri a sé ("Powerless. Limited edition"): si toglie la dicitura
 * dal titolo e diventano un'edizione della stessa opera, con il tipo giusto.
 */
const VARIANT = /[\s.,:;(\[-]*\b(platinum|limited edition|edizione limitata|ediz\.? limitata|special edition|edizione speciale|ediz\.? speciale|deluxe edition|edizione deluxe|ediz\.? deluxe)\b[)\]]*/i; // anche in mezzo al titolo
// "Edizione italiana", "Ediz. italiana", "(versione italiana)": sul sito è tutto in italiano, la dicitura non serve
const ITALIAN = /[\s.,:;(\[-]*\b(edizione italiana|ediz\.? italiana|versione italiana)\b[)\]]*\s*$/i;
function variant(title: string): { title: string; editionType: 'standard' | 'special' | 'limited' } {
  const clean = (t: string) => t.replace(ITALIAN, '').trim();
  const t = clean(title);
  const m = t.match(VARIANT);
  if (!m) return { title: t, editionType: 'standard' };
  // la dicitura può stare anche in mezzo ("Corrupt. Limited edition. Devil's night series"): si toglie e si ricuce
  const rest = t.slice(m.index! + m[0].length).replace(/^[\s.,:;)\]-]+/, '');
  const before = clean(t.slice(0, m.index));
  return { title: rest ? `${before}. ${rest}` : before, editionType: /limit/i.test(m[1]) ? 'limited' : 'special' };
}

/**
 * Tiene un volume solo se è narrativa: per le ricerche generiche e per editore servono categorie di narrativa,
 * per le autrici di riferimento basta che non sia un saggio. Solo ISBN italiani (978-88, 979-12): quelli esteri
 * (979-8 di Amazon, 978-1 delle piattaforme di traduzione) sono quasi sempre autopubblicazioni o omonimi.
 */
function keep(info: NonNullable<Volume['volumeInfo']>, isbn: string, trusted: boolean): boolean {
  if (!/^(97888|97912)/.test(isbn) || !info.authors?.length) return false;
  const cats = (info.categories ?? []).join(' ');
  if (NOT_FICTION.test(cats) && !FICTION.test(cats)) return false;
  return trusted ? true : FICTION.test(cats);
}

async function search(q: string, max: number, trusted: boolean): Promise<Candidate[]> {
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
    const isbn = normalizeIsbn(id.identifier);
    if (!keep(info, isbn, trusted)) return [];
    const score = (info.description ? 2 : 0) + (info.imageLinks ? 2 : 0) + (FICTION.test((info.categories ?? []).join(' ')) ? 1 : 0);
    return [{ isbn, ...variant(info.title), authors: info.authors ?? [], publisher: info.publisher ?? '', found: q, score }];
  });
}

const k = await known();
// prima le autrici (risultati più sicuri), poi gli editori, infine le ricerche generiche
const candidates: Candidate[] = [];
// stessa opera: titolo simile e stessa autrice (con un catalogo vuoto basta il titolo)
const sameWork = (a: { title: string; authors: string[] }, b: { title: string; authors: string[] }) =>
  similar(a.title, b.title) && (a.authors[0] ?? '') === (b.authors[0] ?? '');
// le special e le limitate sono nuove se l'ISBN è nuovo: si agganciano all'opera anche se c'è già
const isNew = (c: Candidate) =>
  !k.isbns.has(c.isbn) &&
  !candidates.some((x) => x.isbn === c.isbn || (x.editionType === c.editionType && sameWork(x, c))) &&
  !k.editions.some((e) => e.type === c.editionType && similar(e.title, c.title));

interface Search {
  q: string;
  trusted: boolean;
  max: number;
  /** Solo libri della stessa "scena" delle autrici di riferimento (stessi editori): per i nomi proposti dall'AI. */
  scene?: boolean;
}
const searches: Search[] = [];
const seen = new Set<string>();
const once = (name: string) => !seen.has(name.toLowerCase()) && seen.add(name.toLowerCase());
const byAuthor = (names: string[], max: number, scene = false): Search[] =>
  names.filter(once).map((a) => ({ q: `inauthor:"${a}"`, trusted: true, max, scene }));

// editori delle autrici di riferimento: per nome e per prefisso dell'ISBN (che identifica l'editore)
const scenePublishers = new Set<string>();
const scenePrefixes = new Set<string>();
const inScene = (c: Candidate) =>
  (c.publisher && scenePublishers.has(c.publisher.toLowerCase())) || scenePrefixes.has(c.isbn.slice(0, 8));

async function run(list: Search[]) {
  for (const s of list) {
    searches.push(s);
    if (!dryRun && candidates.length >= batch * 3) continue; // abbastanza per questo lotto e i prossimi due
    let found = 0;
    for (const c of await search(s.q, s.max, s.trusted)) {
      if (s.scene && !inScene(c)) continue;
      if (!isNew(c)) continue; // uno alla volta: anche i doppioni dentro la stessa risposta restano fuori
      candidates.push(c);
      found++;
    }
    console.log(`- ${s.q}: ${found} nuovi`);
    await pause(300); // gentili con l'API pubblica
  }
}

// 1. titoli obbligatori e autrici di riferimento
await run([
  ...config.titles.map((t) => ({ q: `intitle:"${t.title}" inauthor:"${t.author}"`, trusted: true, max: 5 })),
  ...byAuthor(config.reference, 40),
]);
for (const c of candidates) {
  if (c.publisher) scenePublishers.add(c.publisher.toLowerCase());
  scenePrefixes.add(c.isbn.slice(0, 8));
}
// chi firma antologie e raccolte con le autrici di riferimento è quasi sempre della stessa scena
const reference = new Set(config.reference.map((a) => a.toLowerCase()));
const coauthors = [...new Set(candidates.flatMap((c) => c.authors).filter((a) => !reference.has(a.toLowerCase())))];
if (coauthors.length) console.log(`Coautrici delle autrici di riferimento: ${coauthors.join(', ')}`);

// 2. autrici simili proposte dall'AI, tenute solo con libri degli stessi editori (anche nella prova a secco: una richiesta)
const lookalikes =
  config.similar > 0 && aiConfigured()
    ? await similarAuthors({ authors: config.reference, titles: config.titles.map((t) => t.title) }, config.similar).catch((err) => {
        console.warn(`Autrici simili non disponibili: ${(err as Error).message}`);
        return [] as string[];
      })
    : [];
if (lookalikes.length) console.log(`Autrici simili proposte dall'AI: ${lookalikes.join(', ')}`);

// 3. il resto: coautrici, autrici simili, altre autrici, editori, ricerche per genere
await run([
  ...byAuthor(coauthors, config.perQuery),
  ...byAuthor(lookalikes, config.perQuery, true),
  ...byAuthor([...config.authors, ...k.authors], config.perQuery),
  // con le parole di genere: senza, gli editori portano soprattutto classici (Dickens, Austen, il Mago di Oz)
  ...config.publishers.map((p) => ({ q: `inpublisher:"${p}" romance OR young OR thriller OR fantasy`, trusted: false, max: config.perQuery })),
  ...config.queries.map((q) => ({ q, trusted: false, max: config.perQuery })),
]);
console.log(`Ricerche: ${searches.length} (di cui ${k.authors.length} autrici e autori già in catalogo).`);

// a parità di ricerca, prima le schede complete (trama e copertina): l'ordine delle ricerche resta
candidates.sort((a, b) => searches.findIndex((s) => s.q === a.found) - searches.findIndex((s) => s.q === b.found) || b.score - a.score);
console.log(`\nCandidati nuovi: ${candidates.length}.`);
if (dryRun) {
  for (const c of candidates.slice(0, Number(process.env.SEED_SHOW ?? 60))) console.log(`  ${c.isbn}  ${c.title}${c.editionType === 'standard' ? '' : ` [${c.editionType}]`} — ${c.authors.join(', ')}  (${c.found})`);
  const shown = Number(process.env.SEED_SHOW ?? 60);
  if (candidates.length > shown) console.log(`  …e altri ${candidates.length - shown}`);
  console.log('\nProva: nessuna scheda preparata, nessuna scrittura.');
  process.exit(0);
}

// ---------------------------------------------------------------------------
// Schede del lotto
// ---------------------------------------------------------------------------
const tropeList = useAi ? await knownTropes(sb) : [];
const genreList = useAi ? await knownGenres(sb) : [];
// opere con già una trama in coda o in catalogo: una special nuova non ne chiede un'altra
const withPlot = k.titles.map((title) => ({ title, authors: [] as string[] }));
const prepared: Array<{ book: ReturnType<typeof bookPayload>; plot: string | null; tropes: string[]; genres: string[]; needsPlot: boolean }> = [];
for (const c of candidates.slice(0, batch)) {
  try {
    const book = await fetchBook(c.isbn);
    if (!book?.title) continue;
    const { title, editionType } = variant(book.title);
    const needsPlot = !withPlot.some((w) => similar(w.title, title));
    withPlot.push({ title, authors: book.authors });
    let plot: string | null = null;
    let tropes: string[] = [];
    // dalle categorie se dicono qualcosa (per le edizioni italiane Google dice quasi sempre solo "Fiction"), se no dall'AI
    let genres = genresFromCategories(book.categories);
    if (needsPlot && useAi && book.description) {
      plot = await rewritePlot(book.description, { title, authors: book.authors });
      tropes = await suggestTropes({ title, description: book.description }, tropeList);
      if (genres.length === 0) genres = await suggestGenres({ title, description: book.description }, genreList);
      await pause(1500); // limiti dei piani gratuiti
    }
    prepared.push({
      // il libro si pubblica senza trama, tropes e generi: passano dalla redazione
      book: bookPayload({
        title,
        authors: book.authors,
        publisher: book.publisher,
        isbn: book.isbn,
        format: 'paperback',
        editionType: c.editionType === 'standard' ? editionType : c.editionType,
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
      genres,
      needsPlot,
    });
    console.log(`✓ ${title}${editionType === 'standard' ? '' : ` (${editionType})`}`);
  } catch (err) {
    console.error(`✗ ${c.isbn}: ${(err as Error).message}`);
  }
}

if (prepared.length) {
  if (sb) {
    const known = new Set(tropeList.map((t) => t.slug));
    let published = 0;
    let plots = 0;
    for (const { book, plot, tropes, genres, needsPlot } of prepared) {
      try {
        const workId = await publishBook(sb, book as unknown as BookPayload);
        published++;
        if (!needsPlot) continue;
        const { error } = await sb.from('review_queue').insert({
          content_type: 'plot',
          payload: {
            work_id: workId,
            work_slug: book.work.slug,
            title: book.work.title,
            authors: book.authors.map((a) => a.name),
            cover_url: book.edition.cover_url,
            plot,
            genres,
            tropes: tropes.filter((t) => known.has(t)),
            new_tropes: tropes.filter((t) => !known.has(t)).map((slug) => ({ slug, name: slug.replace(/-/g, ' ') })),
            original_description: book.original_description,
          },
        });
        if (error) throw error;
        plots++;
      } catch (err) {
        console.error(`✗ ${book.work.title}: ${(err as Error).message}`);
      }
    }
    console.log(`\n${published} edizioni pubblicate (senza trama) e ${plots} trame in "Da approvare". Candidati rimasti: ${Math.max(0, candidates.length - batch)}.`);
    await notifyEditors(`📚 ${published} edizioni aggiunte al catalogo: ${plots} trame aspettano la tua approvazione`, prepared.map((p) => p.book.work.title));
  } else {
    await mkdir('scripts/out', { recursive: true });
    const file = `scripts/out/seed-${new Date().toISOString().slice(0, 10)}.json`;
    await writeFile(file, JSON.stringify(prepared, null, 2));
    console.log(`\n${prepared.length} schede salvate in ${file} (Supabase non configurato).`);
  }
}
