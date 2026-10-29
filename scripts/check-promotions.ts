// Lettura notturna delle fonti delle promozioni (pagine e feed di editori e librerie).
//   npm run promotions               legge le fonti, estrae le promozioni nuove e le mette in coda
//   npm run promotions -- --dry-run  legge le fonti e calcola l'impronta, senza estrazione né scritture
//
// Fonti: tabella sources (purpose = 'promotions', active) se Supabase è configurato, altrimenti scripts/sources.json.
// Per ogni fonte: rispetta robots.txt, una sola richiesta con User-Agent dichiarato, salta le pagine invariate
// (impronta SHA-256 del testo), estrae le promozioni e scarta quelle già note. Nulla viene pubblicato:
// le candidate vanno in review_queue (o in scripts/out/promotions-AAAA-MM-GG.json senza Supabase).
// Completa anche le segnalazioni grezze inviate dal pannello ("Segnala promozione").
import { createHash } from 'node:crypto';
import { mkdir, writeFile } from 'node:fs/promises';
import { parseArgs } from 'node:util';
import { aiConfigured, extractPromotions, type ExtractedPromotion } from './lib/ai.ts';
import { OUT_DIR, allowedByRobots, loadSources, readJson, readSource, saveRead, sb, similar, today } from './lib/sources.ts';
import { slugify } from '../src/admin/resources.ts';

const { values: flags } = parseArgs({ options: { 'dry-run': { type: 'boolean', default: false } } });
const dryRun = flags['dry-run'];

type Candidate = ExtractedPromotion & {
  source_url: string;
  source_id: string | null;
  image_url: string | null; // grafica proposta: chi approva decide se usarla
  image_credit: string | null;
};

// ---------------------------------------------------------------------------
// Doppioni: titolo molto simile a una promozione già pubblicata o in coda
// ---------------------------------------------------------------------------
async function knownPromotions(): Promise<Array<{ title: string; url: string | null }>> {
  if (!sb) {
    const files = await readJson<Array<{ title: string; url: string | null }>>(new URL(`./out/promotions-${today}.json`, import.meta.url), []);
    return files;
  }
  const [published, queued] = await Promise.all([
    sb.from('promotions').select('title, url'),
    sb.from('review_queue').select('payload').eq('content_type', 'promotion').neq('status', 'rejected'),
  ]);
  if (published.error) throw published.error;
  if (queued.error) throw queued.error;
  return [
    ...(published.data ?? []),
    ...(queued.data ?? []).map((r) => ({ title: r.payload?.title ?? '', url: r.payload?.url ?? null })),
  ];
}

// la pagina di origine spesso è la stessa per più promozioni: conta il titolo
const isKnown = (p: ExtractedPromotion, known: Array<{ title: string }>) => known.some((k) => similar(k.title, p.title));

function toPayload(p: Candidate) {
  return {
    title: p.title,
    slug: slugify(p.title),
    publisher: p.publisher ? { name: p.publisher, slug: slugify(p.publisher) } : null,
    kind: p.kind,
    reward: p.reward,
    conditions: p.conditions,
    description: p.description,
    starts_on: p.starts_on,
    ends_on: p.ends_on,
    channel: p.channel,
    where_note: p.where_note,
    url: p.url,
    source_url: p.source_url,
    image_url: p.image_url,
    image_credit: p.image_url ? p.image_credit : null,
    image_alt: null,
    works: p.works,
  };
}

// ---------------------------------------------------------------------------
// Segnalazioni grezze dal pannello: hanno solo il link o il testo incollato
// ---------------------------------------------------------------------------
async function completeReports(): Promise<number> {
  if (!sb) return 0;
  const { data, error } = await sb
    .from('review_queue')
    .select('id, payload')
    .eq('content_type', 'promotion')
    .eq('status', 'pending')
    .eq('payload->>needs_extraction', 'true');
  if (error) throw error;
  let done = 0;
  for (const item of data ?? []) {
    const report = item.payload as { raw_text?: string; source_url?: string; image_url?: string; note?: string };
    let text = report.raw_text ?? '';
    let image = report.image_url ?? null;
    if (report.source_url && (await allowedByRobots(report.source_url))) {
      const page = await readSource({ id: null, name: '', url: report.source_url, kind: 'page', purpose: 'promotions', content_hash: null }).catch(() => null);
      text ||= page?.text ?? '';
      image ??= page?.image ?? null;
    }
    if (!text) continue;
    const [first] = await extractPromotions(text, { sourceUrl: report.source_url ?? null, today });
    if (!first) {
      await sb.from('review_queue').update({ payload: { ...report, needs_extraction: false, extraction_note: 'Nessuna promozione trovata: compila a mano o scarta.' } }).eq('id', item.id);
      continue;
    }
    const candidate = { ...first, source_url: report.source_url ?? first.url ?? '', source_id: null, image_url: image, image_credit: first.publisher };
    const payload = { ...toPayload(candidate), note: report.note ?? null };
    const updated = await sb.from('review_queue').update({ payload }).eq('id', item.id);
    if (updated.error) throw updated.error;
    done++;
  }
  return done;
}

// ---------------------------------------------------------------------------
// Esecuzione
// ---------------------------------------------------------------------------
if (!dryRun && !aiConfigured()) {
  console.error(
    'Estrazione dei dati non configurata: imposta AI_BASE_URL e AI_MODEL (e AI_API_KEY se richiesta) nel file .env,\n' +
      'oppure prova solo la lettura delle fonti con: npm run promotions -- --dry-run',
  );
  process.exit(1);
}

const sources = await loadSources('promotions');
if (sources.length === 0) {
  console.log(sb ? 'Nessuna fonte attiva per le promozioni nella tabella sources.' : 'Nessuna fonte in scripts/sources.json.');
}

const known = dryRun ? [] : await knownPromotions();
const found: Candidate[] = [];
let unchanged = 0;

for (const source of sources) {
  const label = `${source.name} (${source.url})`;
  try {
    if (!(await allowedByRobots(source.url))) {
      console.log(`- ${label}: esclusa da robots.txt, salto`);
      continue;
    }
    const { text, image } = await readSource(source);
    const hash = createHash('sha256').update(text).digest('hex');
    if (hash === source.content_hash) {
      unchanged++;
      console.log(`- ${label}: invariata dall'ultima lettura`);
      await saveRead(source, hash, false);
      continue;
    }
    if (dryRun) {
      console.log(`- ${label}: cambiata (${text.length} caratteri, impronta ${hash.slice(0, 12)})\n  «${text.slice(0, 160).replace(/\n/g, ' · ')}…»`);
      if (image) console.log(`  grafica trovata: ${image}`);
      await saveRead(source, hash, true);
      continue;
    }
    const extracted = await extractPromotions(text, { sourceUrl: source.url, publisher: source.name, today });
    const fresh = extracted.filter((p) => !isKnown(p, known) && !found.some((f) => similar(f.title, p.title)));
    console.log(`- ${label}: ${extracted.length} promozioni trovate, ${fresh.length} nuove`);
    // la grafica della pagina va solo se la pagina parla di una promozione sola: altrimenti non si sa di quale sia
    const pageArt = extracted.length === 1 ? image : null;
    found.push(...fresh.map((p) => ({ ...p, source_url: source.url, source_id: source.id, image_url: pageArt, image_credit: p.publisher ?? source.name })));
    // l'impronta si salva solo a lettura riuscita: se l'estrazione fallisce la pagina si rilegge domani
    await saveRead(source, hash, true);
  } catch (err) {
    console.error(`- ${label}: errore, ${(err as Error).message}`);
  }
}

if (!dryRun && found.length > 0) {
  if (sb) {
    const { error } = await sb
      .from('review_queue')
      .insert(found.map((p) => ({ content_type: 'promotion', payload: toPayload(p), source_id: p.source_id })));
    if (error) throw error;
    console.log(`\n${found.length} promozioni in coda "Da approvare".`);
  } else {
    const file = new URL(`./out/promotions-${today}.json`, import.meta.url);
    const previous = await readJson<unknown[]>(file, []);
    await mkdir(OUT_DIR, { recursive: true });
    await writeFile(file, JSON.stringify([...previous, ...found.map(toPayload)], null, 2));
    console.log(`\n${found.length} promozioni salvate in scripts/out/promotions-${today}.json (Supabase non configurato).`);
  }
}

if (!dryRun) {
  const completed = await completeReports();
  if (completed) console.log(`${completed} segnalazioni dal pannello completate.`);
}

console.log(`\nFonti lette: ${sources.length}, invariate: ${unchanged}${dryRun ? ' (prova: nessuna estrazione, nessuna scrittura in coda)' : ''}.`);
