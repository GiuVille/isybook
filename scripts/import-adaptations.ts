// Serie TV e film tratti dai libri del catalogo, da TMDB (themoviedb.org, chiave gratuita in TMDB_API_KEY).
//
//   npm run adaptations                 cerca gli adattamenti dei libri che non ne hanno ancora
//   npm run adaptations -- --all        ricontrolla tutti i libri
//   npm run adaptations -- --dry-run    solo le ricerche: elenca cosa troverebbe, senza AI né scritture
//
// Per evitare omonimi si tiene un risultato solo se TMDB lo segna "tratto da un libro" (parola chiave 818) o se
// l'autrice compare tra i crediti. Dati in italiano: titolo, uscita, stagioni ed episodi o durata, locandina,
// dove vederlo in Italia (dati JustWatch via TMDB), trailer YouTube ufficiale. La trama di TMDB si riscrive con l'AI.
// Tutto va in "Da approvare" come "Serie o film": nulla si pubblica senza la redazione.
// Attribuzione obbligatoria (TMDB e JustWatch) nelle pagine Serie e film.
import { parseArgs } from 'node:util';
import sample from '../src/data/sample.json' with { type: 'json' };
import { aiConfigured, rewritePlot } from './lib/ai.ts';
import { notifyEditors } from './lib/notify.ts';
import { sb, similar } from './lib/sources.ts';
import { slugify } from '../src/admin/resources.ts';

const { values: flags } = parseArgs({
  options: { 'dry-run': { type: 'boolean', default: false }, all: { type: 'boolean', default: false } },
});
const dryRun = flags['dry-run'];
const key = process.env.TMDB_API_KEY;
if (!key) {
  console.log('TMDB_API_KEY non impostata: crea una chiave gratuita su themoviedb.org (Impostazioni → API) e mettila in .env o nei secret.');
  process.exit(0);
}

const BASED_ON_BOOK = 818; // parola chiave TMDB "based on novel or book"
const pause = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function tmdb<T>(path: string, params: Record<string, string> = {}): Promise<T | null> {
  // chiave v3 (corta) come parametro, token v4 (lungo) come intestazione
  const bearer = key!.length > 40;
  const url = new URL(`https://api.themoviedb.org/3${path}`);
  for (const [k, v] of Object.entries({ language: 'it-IT', ...params, ...(bearer ? {} : { api_key: key! }) })) url.searchParams.set(k, v);
  const res = await fetch(url, { headers: bearer ? { Authorization: `Bearer ${key}` } : {} });
  if (res.status === 404) return null;
  if (!res.ok) throw new Error(`TMDB ${res.status} su ${path}`);
  await pause(120); // ben sotto i limiti di TMDB
  return (await res.json()) as T;
}

interface WorkRef {
  id: string;
  title: string;
  authors: string[];
}

// ---------------------------------------------------------------------------
// Libri da controllare e adattamenti già noti
// ---------------------------------------------------------------------------
async function works(): Promise<{ list: WorkRef[]; knownTmdb: Set<number> }> {
  const knownTmdb = new Set<number>();
  if (!sb) {
    return {
      list: sample.works.map((w) => ({
        id: w.slug,
        title: w.title,
        authors: (w.author_ids ?? []).map((id) => sample.authors.find((a) => a.id === id)?.name ?? '').filter(Boolean),
      })),
      knownTmdb,
    };
  }
  const [w, a, q] = await Promise.all([
    sb.from('works').select('id, title, work_authors ( authors ( name ) ), adaptations ( id )').eq('status', 'published'),
    sb.from('adaptations').select('tmdb_id'),
    sb.from('review_queue').select('payload').eq('content_type', 'adaptation'),
  ]);
  for (const r of [w, a, q]) if (r.error) throw r.error;
  for (const x of a.data ?? []) if (x.tmdb_id) knownTmdb.add(x.tmdb_id);
  for (const x of q.data ?? []) if (x.payload?.adaptation?.tmdb_id) knownTmdb.add(x.payload.adaptation.tmdb_id);
  const list = (w.data ?? [])
    .filter((x: any) => flags.all || !(x.adaptations ?? []).length)
    .map((x: any) => ({ id: x.id, title: x.title, authors: (x.work_authors ?? []).map((r: any) => r.authors?.name).filter(Boolean) }));
  return { list, knownTmdb };
}

// ---------------------------------------------------------------------------
// Ricerca e dettagli
// ---------------------------------------------------------------------------
type Kind = 'series' | 'film';
interface Found {
  kind: Kind;
  tmdbId: number;
  title: string;
  overview: string;
  row: Record<string, unknown>;
}

const STATUS: Record<string, string> = {
  'Returning Series': 'In corso',
  Ended: 'Conclusa',
  Canceled: 'Cancellata',
  'In Production': 'In lavorazione',
  Planned: 'Annunciata',
  'Post Production': 'In post-produzione',
  Released: 'Uscito',
  Rumored: 'Voci di corridoio',
};

function providers(details: any): Array<{ platform: string; kind: string; url: string | null }> {
  const it = details['watch/providers']?.results?.IT;
  if (!it) return [];
  const out: Array<{ platform: string; kind: string; url: string | null }> = [];
  for (const [field, kind] of [['flatrate', 'subscription'], ['free', 'free'], ['ads', 'free'], ['rent', 'rent'], ['buy', 'buy']] as const)
    for (const p of it[field] ?? []) if (!out.some((o) => o.platform === p.provider_name)) out.push({ platform: p.provider_name, kind, url: it.link ?? null });
  return out;
}

function trailer(details: any): string | null {
  const videos: any[] = (details.videos?.results ?? []).filter((v: any) => v.site === 'YouTube' && v.type === 'Trailer');
  const best = videos.find((v) => v.iso_639_1 === 'it' && v.official) ?? videos.find((v) => v.iso_639_1 === 'it') ?? videos.find((v) => v.official) ?? videos[0];
  return best ? `https://www.youtube.com/watch?v=${best.key}` : null;
}

/** Stesso titolo, a meno di maiuscole, accenti e punteggiatura; vale anche la sola prima parte ("Titolo. Sottotitolo"). */
function sameTitle(screen: string, book: string): boolean {
  const main = book.split(/[.:]\s/)[0];
  return Boolean(screen) && [book, main].some((t) => slugify(t) === slugify(screen));
}

async function findFor(work: WorkRef): Promise<Found[]> {
  const found: Found[] = [];
  for (const kind of ['series', 'film'] as const) {
    const path = kind === 'series' ? '/search/tv' : '/search/movie';
    const results = (await tmdb<{ results: any[] }>(path, { query: work.title }))?.results ?? [];
    for (const r of results.slice(0, 4)) {
      const name = kind === 'series' ? r.name : r.title;
      const original = kind === 'series' ? r.original_name : r.original_title;
      if (!similar(name ?? '', work.title) && !similar(original ?? '', work.title)) continue;
      const d = await tmdb<any>(`/${kind === 'series' ? 'tv' : 'movie'}/${r.id}`, {
        append_to_response: 'keywords,videos,watch/providers,credits',
        include_video_language: 'it,en,null',
      });
      if (!d) continue;
      const keywords: any[] = (kind === 'series' ? d.keywords?.results : d.keywords?.keywords) ?? [];
      const crew: string[] = [...(d.credits?.crew ?? []).map((c: any) => c.name), ...(d.created_by ?? []).map((c: any) => c.name)];
      const fromBook = keywords.some((k) => k.id === BASED_ON_BOOK);
      const byAuthor = work.authors.some((a) => crew.some((c) => similar(c, a)));
      // con l'autrice nei crediti basta un titolo simile; con il solo "tratto da un libro" (vale per qualunque libro)
      // il titolo deve coincidere: «Falling» non è «Falling Into Your Smile», «Prima regola…» non è «Cruel Intentions»
      if (!byAuthor && !(fromBook && (sameTitle(name ?? '', work.title) || sameTitle(original ?? '', work.title)))) continue;
      const title = (kind === 'series' ? d.name : d.title) as string;
      found.push({
        kind,
        tmdbId: d.id,
        title,
        overview: d.overview ?? '',
        row: {
          title,
          slug: `${slugify(title)}-${kind === 'series' ? 'serie' : 'film'}`,
          kind,
          tmdb_id: d.id,
          platform: kind === 'series' ? (d.networks?.[0]?.name ?? null) : null,
          release_date: (kind === 'series' ? d.first_air_date : d.release_date) || null,
          production_status: STATUS[d.status] ?? d.status ?? null,
          seasons: kind === 'series' ? (d.number_of_seasons || null) : null,
          episodes: kind === 'series' ? (d.number_of_episodes || null) : null,
          runtime_minutes: kind === 'film' ? (d.runtime || null) : null,
          poster_url: d.poster_path ? `https://image.tmdb.org/t/p/w500${d.poster_path}` : null,
          watch_providers: providers(d),
          trailer_url: trailer(d),
          plot: null,
        },
      });
    }
  }
  return found;
}

// ---------------------------------------------------------------------------
const { list, knownTmdb } = await works();
console.log(`Libri da controllare: ${list.length}.`);
const useAi = !dryRun && aiConfigured();
let queued = 0;
const titles: string[] = [];

for (const work of list) {
  try {
    const found = (await findFor(work)).filter((f) => !knownTmdb.has(f.tmdbId));
    for (const f of found) {
      knownTmdb.add(f.tmdbId);
      console.log(`✓ «${work.title}» → ${f.kind === 'series' ? 'serie' : 'film'} «${f.title}» (TMDB ${f.tmdbId})${f.row.trailer_url ? ' · trailer' : ''}`);
      if (dryRun) continue;
      const plot = useAi && f.overview ? await rewritePlot(f.overview, { title: f.title, authors: work.authors }) : null;
      const payload = { work_id: work.id, work_title: work.title, adaptation: { ...f.row, plot }, original_overview: f.overview || null };
      if (sb) {
        const { error } = await sb.from('review_queue').insert({ content_type: 'adaptation', payload });
        if (error) throw error;
      }
      queued++;
      titles.push(f.title);
    }
  } catch (err) {
    console.error(`✗ «${work.title}»: ${(err as Error).message}`);
  }
}

if (dryRun) console.log('\nProva: nessuna scrittura.');
else if (queued) {
  console.log(`\n${queued} serie e film in "Da approvare".`);
  await notifyEditors(`🎬 ${queued} serie e film tratti dai vostri libri, da approvare`, titles);
} else console.log('\nNessun adattamento nuovo.');
