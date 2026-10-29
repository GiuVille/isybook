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
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { parseArgs } from 'node:util';
import { createClient } from '@supabase/supabase-js';
import { aiConfigured, extractPromotions, type ExtractedPromotion } from './lib/ai.ts';
import { slugify } from '../src/admin/resources.ts';

const { values: flags } = parseArgs({ options: { 'dry-run': { type: 'boolean', default: false } } });
const dryRun = flags['dry-run'];

const USER_AGENT = 'IsyBookBot/1.0 (+https://isybook.it; radar delle promozioni sui libri)';
const LOCAL_SOURCES = new URL('./sources.json', import.meta.url);
const OUT_DIR = new URL('./out/', import.meta.url);
const LOCAL_STATE = new URL('./out/sources-state.json', import.meta.url);
const today = new Date().toISOString().slice(0, 10);

const supabaseUrl = process.env.PUBLIC_SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const sb = supabaseUrl && serviceKey ? createClient(supabaseUrl, serviceKey, { auth: { persistSession: false } }) : null;

interface Source {
  id: string | null;
  name: string;
  url: string;
  kind: 'page' | 'rss' | 'api';
  content_hash: string | null;
}

type Candidate = ExtractedPromotion & { source_url: string; source_id: string | null };

// ---------------------------------------------------------------------------
// Fonti e stato (impronta dell'ultima lettura)
// ---------------------------------------------------------------------------
async function readJson<T>(url: URL, fallback: T): Promise<T> {
  try {
    return JSON.parse(await readFile(url, 'utf8')) as T;
  } catch {
    return fallback;
  }
}

async function loadSources(): Promise<Source[]> {
  if (sb) {
    const { data, error } = await sb
      .from('sources')
      .select('id, name, url, kind, content_hash')
      .eq('purpose', 'promotions')
      .eq('active', true);
    if (error) throw error;
    return data ?? [];
  }
  const local = await readJson<Array<Omit<Source, 'id' | 'content_hash'>>>(LOCAL_SOURCES, []);
  const state = await readJson<Record<string, string>>(LOCAL_STATE, {});
  return local.map((s) => ({ ...s, id: null, content_hash: state[s.url] ?? null }));
}

async function saveRead(source: Source, hash: string, changed: boolean) {
  if (sb && source.id) {
    const now = new Date().toISOString();
    const { error } = await sb
      .from('sources')
      .update({ last_read_at: now, content_hash: hash, ...(changed ? { last_changed_at: now } : {}) })
      .eq('id', source.id);
    if (error) throw error;
    return;
  }
  const state = await readJson<Record<string, string>>(LOCAL_STATE, {});
  state[source.url] = hash;
  await mkdir(OUT_DIR, { recursive: true });
  await writeFile(LOCAL_STATE, JSON.stringify(state, null, 2));
}

// ---------------------------------------------------------------------------
// robots.txt: regole per "*" e per il nostro bot, la Disallow più lunga che combacia vince sulle Allow più corte
// ---------------------------------------------------------------------------
const robotsCache = new Map<string, Array<{ allow: boolean; path: string }>>();

async function allowedByRobots(url: string): Promise<boolean> {
  const { origin, pathname, search } = new URL(url);
  if (!robotsCache.has(origin)) {
    const rules: Array<{ allow: boolean; path: string }> = [];
    try {
      const res = await fetch(`${origin}/robots.txt`, { headers: { 'User-Agent': USER_AGENT } });
      if (res.ok) {
        let applies = false;
        let lastWasAgent = false;
        for (const raw of (await res.text()).split(/\r?\n/)) {
          const line = raw.replace(/#.*/, '').trim();
          const [key, ...rest] = line.split(':');
          const value = rest.join(':').trim();
          const k = key.toLowerCase();
          if (k === 'user-agent') {
            const agent = value.toLowerCase();
            const match = agent === '*' || agent.includes('isybook');
            applies = lastWasAgent ? applies || match : match;
            lastWasAgent = true;
          } else {
            lastWasAgent = false;
            if (applies && (k === 'disallow' || k === 'allow') && value) rules.push({ allow: k === 'allow', path: value });
          }
        }
      }
    } catch {
      // robots.txt irraggiungibile: nessuna regola
    }
    robotsCache.set(origin, rules);
  }
  const target = pathname + search;
  const matches = robotsCache
    .get(origin)!
    .filter((r) => new RegExp('^' + r.path.replace(/[.+?^${}()|[\]\\]/g, '\\$&').replace(/\*/g, '.*').replace(/\\\$$/, '$')).test(target))
    .sort((a, b) => b.path.length - a.path.length);
  return matches.length === 0 || matches[0].allow;
}

// ---------------------------------------------------------------------------
// Testo principale di una pagina o di un feed
// ---------------------------------------------------------------------------
const decode = (s: string) =>
  s
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&apos;/g, "'")
    .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(Number(n)));

const stripTags = (html: string) => decode(html.replace(/<[^>]+>/g, ' ')).replace(/\s+/g, ' ').trim();

function feedText(xml: string): string {
  const items = xml.match(/<(item|entry)[\s>][\s\S]*?<\/\1>/g) ?? [];
  return items
    .map((item) => {
      const pick = (tag: string) => stripTags(decode(item.match(new RegExp(`<${tag}[^>]*>([\\s\\S]*?)</${tag}>`))?.[1] ?? ''));
      const link = item.match(/<link[^>]*href="([^"]+)"/)?.[1] ?? pick('link');
      return [pick('title'), pick('pubDate') || pick('updated'), pick('description') || pick('summary') || pick('content'), link]
        .filter(Boolean)
        .join('\n');
    })
    .join('\n\n');
}

function pageText(html: string): string {
  const body = html
    .replace(/<(script|style|noscript|svg|nav|footer|header|form|iframe)[\s\S]*?<\/\1>/gi, ' ')
    .replace(/<!--[\s\S]*?-->/g, ' ');
  const main = body.match(/<(main|article)[\s\S]*?<\/\1>/i)?.[0] ?? body;
  // un blocco per riga: titoli, paragrafi, voci di elenco
  return main
    .replace(/<\/(h[1-6]|p|li|div|section|tr)>/gi, '\n')
    .split('\n')
    .map(stripTags)
    .filter((line) => line.length > 2)
    .join('\n');
}

async function readSource(source: Source): Promise<string> {
  const res = await fetch(source.url, { headers: { 'User-Agent': USER_AGENT, Accept: 'text/html,application/xhtml+xml,application/rss+xml,application/xml;q=0.9' } });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const body = await res.text();
  const isFeed = source.kind === 'rss' || /xml|rss|atom/.test(res.headers.get('content-type') ?? '');
  return (isFeed ? feedText(body) : pageText(body)).slice(0, 20000);
}

// ---------------------------------------------------------------------------
// Doppioni: stessa pagina o titolo molto simile a una promozione già pubblicata o in coda
// ---------------------------------------------------------------------------
const words = (s: string) => new Set(slugify(s).split('-').filter((w) => w.length > 2));

function similar(a: string, b: string): boolean {
  const wa = words(a);
  const wb = words(b);
  if (wa.size === 0 || wb.size === 0) return false;
  const common = [...wa].filter((w) => wb.has(w)).length;
  return common / Math.min(wa.size, wb.size) >= 0.75;
}

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
    const report = item.payload as { raw_text?: string; source_url?: string; note?: string };
    let text = report.raw_text ?? '';
    if (!text && report.source_url && (await allowedByRobots(report.source_url))) {
      text = await readSource({ id: null, name: '', url: report.source_url, kind: 'page', content_hash: null }).catch(() => '');
    }
    if (!text) continue;
    const [first] = await extractPromotions(text, { sourceUrl: report.source_url ?? null, today });
    if (!first) {
      await sb.from('review_queue').update({ payload: { ...report, needs_extraction: false, extraction_note: 'Nessuna promozione trovata: compila a mano o scarta.' } }).eq('id', item.id);
      continue;
    }
    const payload = { ...toPayload({ ...first, source_url: report.source_url ?? first.url ?? '', source_id: null }), note: report.note ?? null };
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

const sources = await loadSources();
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
    const text = await readSource(source);
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
    const extracted = await extractPromotions(text, { sourceUrl: source.url, publisher: source.name, today });
    const fresh = extracted.filter((p) => !isKnown(p, known) && !found.some((f) => similar(f.title, p.title)));
    console.log(`- ${label}: ${extracted.length} promozioni trovate, ${fresh.length} nuove`);
    found.push(...fresh.map((p) => ({ ...p, source_url: source.url, source_id: source.id })));
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
