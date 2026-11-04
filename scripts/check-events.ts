// Lettura notturna delle fonti degli eventi (pagine e feed di fiere, librerie ed editori).
//   npm run events               legge le fonti, estrae gli eventi nuovi e li mette in coda
//   npm run events -- --dry-run  legge le fonti e calcola l'impronta, senza estrazione né scritture
//   npm run events -- --hot      solo le fonti "calde"
//
// Fonti: tabella sources (purpose = 'events', active) se Supabase è configurato, altrimenti scripts/sources.json.
// Per ogni fonte: rispetta robots.txt, una sola richiesta con User-Agent dichiarato, salta le pagine invariate
// (impronta SHA-256 del testo), estrae gli eventi futuri e scarta quelli già noti (titolo simile e stessa data).
// Nulla viene pubblicato: i candidati vanno in review_queue come 'event' (o in scripts/out/events-AAAA-MM-GG.json).
import { createHash } from 'node:crypto';
import { mkdir, writeFile } from 'node:fs/promises';
import { parseArgs } from 'node:util';
import { aiConfigured, extractEvents, type ExtractedEvent } from './lib/ai.ts';
import { notifyEditors } from './lib/notify.ts';
import { OUT_DIR, allowedByRobots, loadSources, readJson, readSource, saveRead, sb, similar, today } from './lib/sources.ts';
import { slugify } from '../src/admin/resources.ts';

const { values: flags } = parseArgs({ options: { 'dry-run': { type: 'boolean', default: false }, hot: { type: 'boolean', default: false } } });
const dryRun = flags['dry-run'];

type Candidate = ExtractedEvent & { source_url: string; source_id: string | null };

async function knownEvents(): Promise<Array<{ title: string; starts_on: string | null }>> {
  if (!sb) return readJson(new URL(`./out/events-${today}.json`, import.meta.url), []);
  const [published, queued] = await Promise.all([
    sb.from('events').select('title, starts_on'),
    sb.from('review_queue').select('payload').eq('content_type', 'event').neq('status', 'rejected'),
  ]);
  if (published.error) throw published.error;
  if (queued.error) throw queued.error;
  return [
    ...(published.data ?? []),
    ...(queued.data ?? []).map((r) => ({ title: r.payload?.title ?? '', starts_on: r.payload?.starts_on ?? null })),
  ];
}

// stesso evento: titolo simile e stessa data d'inizio (le fiere tornano ogni anno con lo stesso nome)
const isKnown = (e: ExtractedEvent, known: Array<{ title: string; starts_on: string | null }>) =>
  known.some((k) => k.starts_on === e.starts_on && similar(k.title, e.title));

function toPayload(e: Candidate) {
  return {
    title: e.title,
    slug: slugify(`${e.title}-${e.city ?? ''}-${e.starts_on}`),
    kind: e.kind,
    starts_on: e.starts_on,
    ends_on: e.ends_on,
    venue: e.venue,
    city: e.city,
    url: e.url,
    description: e.description,
    authors: e.authors,
    works: e.works,
    source_url: e.source_url,
  };
}

if (!dryRun && !aiConfigured()) {
  console.error('Estrazione dei dati non configurata: imposta AI_BASE_URL e AI_MODEL (e AI_API_KEY se richiesta) nel file .env,\noppure prova solo la lettura delle fonti con: npm run events -- --dry-run');
  process.exit(1);
}

const sources = await loadSources('events', flags.hot);
if (sources.length === 0) console.log(sb ? 'Nessuna fonte attiva per gli eventi nella tabella sources.' : 'Nessuna fonte in scripts/sources.json.');

const known = dryRun ? [] : await knownEvents();
const found: Candidate[] = [];
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
    const extracted = await extractEvents(text, { sourceUrl: source.url, source: source.name, today });
    const fresh = extracted.filter((e) => !isKnown(e, known) && !isKnown(e, found));
    console.log(`- ${label}: ${extracted.length} eventi trovati, ${fresh.length} nuovi`);
    found.push(...fresh.map((e) => ({ ...e, source_url: source.url, source_id: source.id })));
    // l'impronta si salva solo a lettura riuscita: se l'estrazione fallisce la pagina si rilegge domani
    await saveRead(source, hash, true);
  } catch (err) {
    console.error(`- ${label}: errore, ${(err as Error).message}`);
  }
}

if (!dryRun && found.length > 0) {
  if (sb) {
    const { error } = await sb.from('review_queue').insert(found.map((e) => ({ content_type: 'event', payload: toPayload(e), source_id: e.source_id })));
    if (error) throw error;
    console.log(`\n${found.length} eventi in coda "Da approvare".`);
    await notifyEditors(`📅 ${found.length} ${found.length === 1 ? 'nuovo evento' : 'nuovi eventi'} da approvare`, found.map((e) => `${e.title} (${e.starts_on})`));
  } else {
    const file = new URL(`./out/events-${today}.json`, import.meta.url);
    const previous = await readJson<unknown[]>(file, []);
    await mkdir(OUT_DIR, { recursive: true });
    await writeFile(file, JSON.stringify([...previous, ...found.map(toPayload)], null, 2));
    console.log(`\n${found.length} eventi salvati in scripts/out/events-${today}.json (Supabase non configurato).`);
  }
}

console.log(`\nFonti lette: ${sources.length}, invariate: ${unchanged}${dryRun ? ' (prova: nessuna estrazione, nessuna scrittura in coda)' : ''}.`);
