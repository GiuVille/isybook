// Import di libri per ISBN → coda di revisione.
//
//   npm run import -- 9788804739999 9788804740001
//   npm run import -- 9788804739999 --raw --format kindle --type special
//
// Con SUPABASE_SERVICE_ROLE_KEY impostata inserisce in review_queue,
// altrimenti scrive il JSON in scripts/out/. Nulla viene pubblicato direttamente.
import { mkdir, writeFile } from 'node:fs/promises';
import { parseArgs } from 'node:util';
import { rewritePlot, suggestTropes } from './lib/ai.ts';
import { bookPayload, knownTropes } from './lib/book-payload.ts';
import { fetchBook, type BookData } from './lib/books.ts';
import { sb } from './lib/sources.ts';

const { values: flags, positionals: isbns } = parseArgs({
  allowPositionals: true,
  options: {
    raw: { type: 'boolean', default: false },
    format: { type: 'string', default: 'paperback' },
    type: { type: 'string', default: 'standard' },
  },
});

if (isbns.length === 0) {
  console.error('Uso: npm run import -- <isbn> [<isbn>...] [--raw] [--format paperback|hardcover|kindle|audio] [--type standard|special|limited]');
  process.exit(1);
}

function buildPayload(book: BookData, plot: string | null, tropes: string[]) {
  return bookPayload({
    title: book.title,
    authors: book.authors,
    publisher: book.publisher,
    isbn: book.isbn,
    format: flags.format!,
    editionType: flags.type!,
    releaseDate: book.publishedDate,
    language: book.language,
    coverUrl: book.coverUrl,
    pages: book.pageCount,
    plot,
    tropes,
    description: book.description,
    meta: { sources: book.sources, categories: book.categories },
  });
}

const tropeList = flags.raw ? [] : await knownTropes(sb);
let failures = 0;

for (const isbn of isbns) {
  try {
    const book = await fetchBook(isbn);
    if (!book?.title) {
      console.warn(`✗ ${isbn}: non trovato`);
      failures++;
      continue;
    }

    let plot: string | null = null;
    let tropes: string[] = [];
    if (!flags.raw && book.description) {
      plot = await rewritePlot(book.description, { title: book.title, authors: book.authors });
      tropes = await suggestTropes({ title: book.title, description: book.description }, tropeList);
    }

    const payload = buildPayload(book, plot, tropes);

    if (sb) {
      const { error } = await sb.from('review_queue').insert({ content_type: 'book', payload });
      if (error) throw error;
      console.log(`✓ ${book.isbn} "${book.title}" → coda di revisione`);
    } else {
      await mkdir('scripts/out', { recursive: true });
      const file = `scripts/out/${book.isbn}.json`;
      await writeFile(file, JSON.stringify(payload, null, 2));
      console.log(`✓ ${book.isbn} "${book.title}" → ${file}`);
    }
  } catch (err) {
    failures++;
    console.error(`✗ ${isbn}: ${err instanceof Error ? err.message : err}`);
  }
}

process.exit(failures ? 1 : 0);
