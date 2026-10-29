// Codice comune alla lettura notturna delle fonti (promozioni e uscite): elenco delle fonti, impronta
// dell'ultima lettura, robots.txt, testo principale di pagine e feed, somiglianza tra titoli per i doppioni.
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { createClient } from '@supabase/supabase-js';
import { slugify } from '../../src/admin/resources.ts';

export type SourcePurpose = 'promotions' | 'releases';

export const USER_AGENT = 'IsyBooksBot/1.0 (+https://isybooks.it; radar delle novità sui libri)';
const LOCAL_SOURCES = new URL('../sources.json', import.meta.url);
export const OUT_DIR = new URL('../out/', import.meta.url);
const LOCAL_STATE = new URL('../out/sources-state.json', import.meta.url);
export const today = new Date().toISOString().slice(0, 10);

const supabaseUrl = process.env.PUBLIC_SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
/** Client con la service role key: solo negli script, mai nel sito. null se Supabase non è configurato. */
export const sb = supabaseUrl && serviceKey ? createClient(supabaseUrl, serviceKey, { auth: { persistSession: false } }) : null;

export interface Source {
  purpose: SourcePurpose;
  id: string | null;
  name: string;
  url: string;
  kind: 'page' | 'rss' | 'api';
  content_hash: string | null;
}

// ---------------------------------------------------------------------------
// Fonti e stato (impronta dell'ultima lettura)
// ---------------------------------------------------------------------------
export async function readJson<T>(url: URL, fallback: T): Promise<T> {
  try {
    return JSON.parse(await readFile(url, 'utf8')) as T;
  } catch {
    return fallback;
  }
}

export async function loadSources(purpose: SourcePurpose): Promise<Source[]> {
  if (sb) {
    const { data, error } = await sb
      .from('sources')
      .select('id, name, url, kind, purpose, content_hash')
      .eq('purpose', purpose)
      .eq('active', true);
    if (error) throw error;
    return data ?? [];
  }
  // scripts/sources.json: le voci senza "purpose" sono fonti di promozioni
  const local = await readJson<Array<Omit<Source, 'id' | 'content_hash' | 'purpose'> & { purpose?: SourcePurpose }>>(LOCAL_SOURCES, []);
  const state = await readJson<Record<string, string>>(LOCAL_STATE, {});
  return local
    .map((s) => ({ ...s, purpose: s.purpose ?? 'promotions', id: null }))
    .filter((s) => s.purpose === purpose)
    .map((s) => ({ ...s, content_hash: state[`${s.purpose}:${s.url}`] ?? null }));
}

export async function saveRead(source: Source, hash: string, changed: boolean) {
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
  state[`${source.purpose}:${source.url}`] = hash;
  await mkdir(OUT_DIR, { recursive: true });
  await writeFile(LOCAL_STATE, JSON.stringify(state, null, 2));
}

// ---------------------------------------------------------------------------
// robots.txt: regole per "*" e per il nostro bot, la Disallow più lunga che combacia vince sulle Allow più corte
// ---------------------------------------------------------------------------
const robotsCache = new Map<string, Array<{ allow: boolean; path: string }>>();

export async function allowedByRobots(url: string): Promise<boolean> {
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
            const match = agent === '*' || agent.includes('isybooks');
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
export const decode = (s: string) =>
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
  // i tag possono andare a capo: prima segno la fine dei blocchi, poi tolgo i tag, solo alla fine divido
  return main
    .replace(/<\/(h[1-6]|p|li|div|section|tr)>/gi, '\u0000')
    .split('\u0000')
    .map(stripTags)
    .filter((line) => line.length > 2)
    .join('\n');
}

/** Immagine di anteprima della pagina (og:image o twitter:image): di solito è la grafica della promozione. */
function pageImage(html: string, pageUrl: string): string | null {
  const meta = html.match(/<meta[^>]+(?:property|name)=["'](?:og:image(?::secure_url)?|twitter:image)["'][^>]*>/i)?.[0];
  const content = meta?.match(/content=["']([^"']+)["']/i)?.[1];
  if (!content) return null;
  try {
    const url = new URL(decode(content), pageUrl);
    return url.protocol === 'https:' ? url.toString() : null;
  } catch {
    return null;
  }
}

export async function readSource(source: Source): Promise<{ text: string; image: string | null }> {
  const res = await fetch(source.url, { headers: { 'User-Agent': USER_AGENT, Accept: 'text/html,application/xhtml+xml,application/rss+xml,application/xml;q=0.9' } });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const body = await res.text();
  const isFeed = source.kind === 'rss' || /xml|rss|atom/.test(res.headers.get('content-type') ?? '');
  return {
    text: (isFeed ? feedText(body) : pageText(body)).slice(0, 20000),
    // in un feed ogni voce ha la sua immagine: meglio nessuna che quella sbagliata
    image: isFeed ? null : pageImage(body, source.url),
  };
}


// ---------------------------------------------------------------------------
// Doppioni: titoli molto simili (almeno 3/4 delle parole significative in comune)
// ---------------------------------------------------------------------------
const words = (s: string) => new Set(slugify(s).split('-').filter((w) => w.length > 2));

export function similar(a: string, b: string): boolean {
  const wa = words(a);
  const wb = words(b);
  if (wa.size === 0 || wb.size === 0) return false;
  const common = [...wa].filter((w) => wb.has(w)).length;
  return common / Math.min(wa.size, wb.size) >= 0.75;
}
