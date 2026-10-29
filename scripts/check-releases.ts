// Lettura notturna delle pagine "prossime uscite" di editori e librerie.
//   npm run releases               legge le fonti, estrae le uscite nuove e le mette in coda
//   npm run releases -- --dry-run  legge le fonti e calcola l'impronta, senza estrazione né scritture
//
// Fonti: tabella sources (purpose = 'releases', active) se Supabase è configurato, altrimenti scripts/sources.json.
// Lettura, robots.txt e impronta come per le promozioni (scripts/lib/sources.ts). Per ogni uscita trovata:
// scarta i doppioni (stesso ISBN, o stesso titolo con stesso formato e tipo di edizione), arricchisce con
// Google Books / Open Library se c'è l'ISBN, prepara trama e tropes solo per le opere nuove.
// Una special o una limitata di un libro già in catalogo entra come nuova edizione di quell'opera.
// Nulla viene pubblicato: tutto va in review_queue (o in scripts/out/releases-AAAA-MM-GG.json senza Supabase).
import { createHash } from 'node:crypto';
import { mkdir, writeFile } from 'node:fs/promises';
import { parseArgs } from 'node:util';
import { aiConfigured, extractReleases, rewritePlot, suggestTropes, type ExtractedRelease } from './lib/ai.ts';
import { bookPayload, knownTropes } from './lib/book-payload.ts';
import { fetchBook, type BookData } from './lib/books.ts';
import { OUT_DIR, allowedByRobots, loadSources, readJson, readSource, saveRead, sb, similar, today } from './lib/sources.ts';

const { values: flags } = parseArgs({ options: { 'dry-run': { type: 'boolean', default: false } } });
const dryRun = flags['dry-run'];

/** Massimo di uscite preparate per notte: ognuna può costare fino a tre richieste di estrazione. */
const MAX_PER_RUN = 20;
const OUT_FILE = new URL(`releases-${today}.json`, OUT_DIR);

type Payload = ReturnType<typeof bookPayload> & { source_url: string; note: string };

// ---------------------------------------------------------------------------
// Cosa c'è già: edizioni in catalogo e libri in coda
// ---------------------------------------------------------------------------
interface KnownEdition {
  title: string;
  isbn: string | null;
  format: string;
  edition_type: string;
}

async function knownCatalog(): Promise<{ editions: KnownEdition[]; works: string[] }> {
  if (!sb) {
    // senza database: i dati d'esempio del sito e quanto già trovato oggi
    const sample = await readJson<{ works: Array<{ title: string; editions: Array<{ isbn: string | null; format: string; edition_type: string }> }> }>(
      new URL('../src/data/sample.json', import.meta.url),
      { works: [] },
    );
    const queued = await readJson<Payload[]>(OUT_FILE, []);
    return {
      editions: [
        ...sample.works.flatMap((w) => w.editions.map((e) => ({ title: w.title, isbn: e.isbn, format: e.format, edition_type: e.edition_type }))),
        ...queued.map((p) => ({ title: p.work.title, isbn: p.edition.isbn, format: p.edition.format, edition_type: p.edition.edition_type })),
      ],
      works: sample.works.map((w) => w.title),
    };
  }
  const [editions, works, queue] = await Promise.all([
    sb.from('editions').select('isbn, format, edition_type, works ( title )'),
    sb.from('works').select('title'),
    sb.from('review_queue').select('payload').eq('content_type', 'book').neq('status', 'rejected'),
  ]);
  for (const r of [editions, works, queue]) if (r.error) throw r.error;
  return {
    editions: [
      ...(editions.data ?? []).map((e: any) => ({ title: e.works?.title ?? '', isbn: e.isbn, format: e.format, edition_type: e.edition_type })),
      ...(queue.data ?? []).map((r: any) => ({
        title: r.payload?.work?.title ?? '',
        isbn: r.payload?.edition?.isbn ?? null,
        format: r.payload?.edition?.format ?? '',
        edition_type: r.payload?.edition?.edition_type ?? '',
      })),
    ],
    works: (works.data ?? []).map((w: any) => w.title),
  };
}

const isDuplicate = (r: ExtractedRelease, known: KnownEdition[]) =>
  known.some(
    (k) => (r.isbn && k.isbn === r.isbn) || (similar(k.title, r.title) && k.format === r.format && k.edition_type === r.edition_type),
  );

// ---------------------------------------------------------------------------
// Scheda per la coda: dati dell'uscita, completati con Google Books / Open Library quando c'è l'ISBN
// ---------------------------------------------------------------------------
async function prepare(
  r: ExtractedRelease,
  source: { name: string; url: string },
  catalogWork: string | undefined,
  tropeList: Array<{ slug: string; name: string }>,
): Promise<Payload> {
  let book: BookData | null = null;
  if (r.isbn) book = await fetchBook(r.isbn).catch(() => null);
  const description = book?.description ?? null;

  // trama e tropes solo per le opere nuove: quelle in catalogo li hanno già
  let plot: string | null = null;
  let tropes: string[] = [];
  if (!catalogWork && description) {
    const authors = r.authors.length ? r.authors : (book?.authors ?? []);
    plot = await rewritePlot(description, { title: r.title, authors });
    tropes = await suggestTropes({ title: r.title, description }, tropeList);
  }

  return {
    ...bookPayload({
      // stesso titolo dell'opera in catalogo: in approvazione l'edizione si aggancia a lei
      title: catalogWork ?? r.title,
      authors: r.authors.length ? r.authors : (book?.authors ?? []),
      publisher: r.publisher ?? book?.publisher,
      isbn: r.isbn,
      format: r.format,
      editionType: r.edition_type,
      releaseDate: r.release_date ?? book?.publishedDate,
      language: book?.language,
      coverUrl: book?.coverUrl,
      pages: book?.pageCount,
      series: r.series,
      seriesNumber: r.series_number,
      editionExtra: { print_run: r.print_run, details: r.details, price: r.price },
      plot,
      tropes,
      description,
      meta: { sources: ['pagina uscite', ...(book?.sources ?? [])], categories: book?.categories ?? [], new_work: !catalogWork },
    }),
    source_url: r.url ?? source.url,
    note: `Trovato in ${source.name}${catalogWork ? ' · nuova edizione di un libro già in catalogo' : ''}`,
  };
}

// ---------------------------------------------------------------------------
// Esecuzione
// ---------------------------------------------------------------------------
if (!dryRun && !aiConfigured()) {
  console.error(
    'Estrazione dei dati non configurata: imposta AI_BASE_URL e AI_MODEL (e AI_API_KEY se richiesta) nel file .env,\n' +
      'oppure prova solo la lettura delle fonti con: npm run releases -- --dry-run',
  );
  process.exit(1);
}

const sources = await loadSources('releases');
if (sources.length === 0) {
  console.log(sb ? 'Nessuna fonte attiva per le uscite nella tabella sources.' : 'Nessuna fonte di uscite in scripts/sources.json.');
}

const catalog = dryRun ? { editions: [], works: [] } : await knownCatalog();
const tropeList = dryRun ? [] : await knownTropes(sb);
const found: Array<{ payload: Payload; source_id: string | null }> = [];
let unchanged = 0;

for (const source of sources) {
  const label = `${source.name} (${source.url})`;
  try {
    if (!(await allowedByRobots(source.url))) {
      console.log(`- ${label}: esclusa da robots.txt, salto`);
      continue;
    }
    const { text } = await readSource(source);
    const hash = createHash('sha256').update(text).digest('hex');
    if (hash === source.content_hash) {
      unchanged++;
      console.log(`- ${label}: invariata dall'ultima lettura`);
      await saveRead(source, hash, false);
      continue;
    }
    if (dryRun) {
      console.log(`- ${label}: cambiata (${text.length} caratteri, impronta ${hash.slice(0, 12)})\n  «${text.slice(0, 160).replace(/\n/g, ' · ')}…»`);
      await saveRead(source, hash, true);
      continue;
    }

    const extracted = await extractReleases(text, { sourceUrl: source.url, publisher: source.name, today });
    // doppioni anche tra le uscite trovate stanotte
    const known = () => [...catalog.editions, ...found.map(({ payload: p }) => ({ title: p.work.title, isbn: p.edition.isbn, format: p.edition.format, edition_type: p.edition.edition_type }))];
    const fresh = extracted.filter((r) => !isDuplicate(r, known()));
    const room = MAX_PER_RUN - found.length;
    for (const r of fresh.slice(0, room)) {
      if (isDuplicate(r, known())) continue;
      const catalogWork = catalog.works.find((t) => similar(t, r.title));
      found.push({ payload: await prepare(r, source, catalogWork, tropeList), source_id: source.id });
    }
    console.log(`- ${label}: ${extracted.length} uscite trovate, ${fresh.length} nuove`);
    if (fresh.length > room) {
      // fonte non finita: niente impronta, così domani la rilegge e prende le restanti
      console.log(`  limite di ${MAX_PER_RUN} per notte raggiunto: le altre ${fresh.length - room} restano per domani`);
      continue;
    }
    await saveRead(source, hash, true);
  } catch (err) {
    console.error(`- ${label}: errore, ${(err as Error).message}`);
  }
}

if (!dryRun && found.length > 0) {
  if (sb) {
    const { error } = await sb.from('review_queue').insert(found.map(({ payload, source_id }) => ({ content_type: 'book', payload, source_id })));
    if (error) throw error;
    console.log(`\n${found.length} uscite in coda "Da approvare".`);
  } else {
    const previous = await readJson<Payload[]>(OUT_FILE, []);
    await mkdir(OUT_DIR, { recursive: true });
    await writeFile(OUT_FILE, JSON.stringify([...previous, ...found.map((f) => f.payload)], null, 2));
    console.log(`\n${found.length} uscite salvate in scripts/out/releases-${today}.json (Supabase non configurato).`);
  }
}

console.log(`\nFonti lette: ${sources.length}, invariate: ${unchanged}${dryRun ? ' (prova: nessuna estrazione, nessuna scrittura in coda)' : ''}.`);
