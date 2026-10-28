// Import di libri per ISBN → coda di revisione.
//
//   npm run import -- 9788804739999 9788804740001
//   npm run import -- 9788804739999 --raw --format kindle --type special
//
// Con SUPABASE_SERVICE_ROLE_KEY impostata inserisce in review_queue,
// altrimenti scrive il JSON in scripts/out/. Nulla viene pubblicato direttamente.
import { mkdir, writeFile } from 'node:fs/promises';
import { parseArgs } from 'node:util';
import { createClient } from '@supabase/supabase-js';
import { rewritePlot, suggestTropes } from './lib/ai.ts';
import { fetchBook, type BookData } from './lib/books.ts';
import { slugify } from '../src/admin/resources.ts';

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

const supabaseUrl = process.env.PUBLIC_SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const sb = supabaseUrl && serviceKey ? createClient(supabaseUrl, serviceKey, { auth: { persistSession: false } }) : null;

async function knownTropes(): Promise<Array<{ slug: string; name: string }>> {
  if (!sb) return [];
  const { data, error } = await sb.from('tropes').select('slug, name');
  if (error) throw error;
  return data ?? [];
}

function buildPayload(book: BookData, plot: string | null, tropes: string[]) {
  return {
    work: {
      title: book.title,
      slug: slugify(book.title),
      plot,
      series: null,
      series_number: null,
      origin: 'publisher',
    },
    authors: book.authors.map((name) => ({ name, slug: slugify(name) })),
    publisher: book.publisher ? { name: book.publisher, slug: slugify(book.publisher) } : null,
    edition: {
      isbn: book.isbn,
      format: flags.format,
      edition_type: flags.type,
      release_date: book.publishedDate ?? null,
      language: book.language ?? 'it',
      cover_url: book.coverUrl ?? null,
      pages: book.pageCount ?? null,
      purchase_links: [],
    },
    genres: [],
    tropes,
    // Solo come riferimento in revisione: la descrizione dell'editore non si pubblica.
    original_description: book.description ?? null,
    meta: { sources: book.sources, categories: book.categories },
  };
}

const tropeList = flags.raw ? [] : await knownTropes();
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
