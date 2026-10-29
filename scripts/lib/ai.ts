// Client unico per modelli compatibili con l'API OpenAI (Mistral, Groq, Ollama…).
// Il fornitore si cambia solo da configurazione: AI_BASE_URL, AI_API_KEY, AI_MODEL.
// Regola: mai inviare dati degli utenti, i piani gratuiti possono usarli per l'addestramento.

import { isValidIsbn, normalizeIsbn } from './books.ts';

export interface ChatMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export interface ChatOptions {
  temperature?: number;
  json?: boolean;
  maxTokens?: number;
}

export const aiConfigured = () => Boolean(process.env.AI_BASE_URL && process.env.AI_MODEL);

function config() {
  const baseUrl = process.env.AI_BASE_URL;
  const model = process.env.AI_MODEL;
  if (!baseUrl || !model) {
    throw new Error('Modulo AI non configurato: imposta AI_BASE_URL e AI_MODEL (e AI_API_KEY se richiesta) nel file .env');
  }
  return { baseUrl: baseUrl.replace(/\/$/, ''), model, apiKey: process.env.AI_API_KEY };
}

export async function chat(messages: ChatMessage[], opts: ChatOptions = {}): Promise<string> {
  const { baseUrl, model, apiKey } = config();
  const res = await fetch(`${baseUrl}/chat/completions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(apiKey ? { Authorization: `Bearer ${apiKey}` } : {}),
    },
    body: JSON.stringify({
      model,
      messages,
      temperature: opts.temperature ?? 0.7,
      ...(opts.maxTokens ? { max_tokens: opts.maxTokens } : {}),
      ...(opts.json ? { response_format: { type: 'json_object' } } : {}),
    }),
  });
  if (!res.ok) throw new Error(`Errore AI ${res.status}: ${await res.text()}`);
  const data = (await res.json()) as { choices: Array<{ message: { content: string } }> };
  return data.choices[0]?.message.content.trim() ?? '';
}

/** Trama riscritta in italiano: niente frasi copiate dalla descrizione dell'editore. */
export async function rewritePlot(original: string, meta: { title: string; authors: string[] }): Promise<string> {
  return chat(
    [
      {
        role: 'system',
        content:
          'Sei la redazione di un sito italiano dedicato a romantasy, romance e fantasy YA. ' +
          'Scrivi trame originali in italiano, 60-100 parole, tono caldo ma informativo, senza spoiler oltre la premessa. ' +
          'Non copiare frasi dal testo di partenza: riformula completamente. Rispondi solo con la trama.',
      },
      {
        role: 'user',
        content: `Libro: "${meta.title}" di ${meta.authors.join(', ')}.\nDescrizione di partenza:\n${original}`,
      },
    ],
    { temperature: 0.8 },
  );
}

/** Sceglie i tropi pertinenti da una lista chiusa di slug. */
export async function suggestTropes(
  work: { title: string; description: string },
  tropes: Array<{ slug: string; name: string }>,
): Promise<string[]> {
  if (tropes.length === 0) return [];
  const answer = await chat(
    [
      {
        role: 'system',
        content:
          'Classifichi libri per tropi narrativi. Scegli solo tra gli slug forniti, al massimo 5, e solo se chiaramente presenti. ' +
          'Rispondi in JSON: {"tropes": ["slug", ...]}',
      },
      {
        role: 'user',
        content:
          `Tropi disponibili:\n${tropes.map((t) => `- ${t.slug}: ${t.name}`).join('\n')}\n\n` +
          `Libro: ${work.title}\nDescrizione: ${work.description}`,
      },
    ],
    { temperature: 0, json: true },
  );
  try {
    const parsed = JSON.parse(answer) as { tropes?: unknown };
    const valid = new Set(tropes.map((t) => t.slug));
    return Array.isArray(parsed.tropes) ? parsed.tropes.filter((s): s is string => typeof s === 'string' && valid.has(s)) : [];
  } catch {
    return [];
  }
}

export interface ExtractedPromotion {
  title: string;
  publisher: string | null;
  kind: 'gift_with_purchase' | 'bundle' | 'discount' | 'contest' | 'preorder';
  reward: string | null;
  conditions: string | null;
  description: string | null;
  starts_on: string | null;
  ends_on: string | null;
  channel: 'online' | 'bookstores' | 'chain' | 'everywhere';
  where_note: string | null;
  url: string | null;
  works: string[];
}

const PROMOTION_KINDS = ['gift_with_purchase', 'bundle', 'discount', 'contest', 'preorder'] as const;
const PROMOTION_CHANNELS = ['online', 'bookstores', 'chain', 'everywhere'] as const;

/** Promozioni sui libri trovate in un testo (pagina, feed, newsletter, post). Solo quelle esplicite. */
export async function extractPromotions(
  text: string,
  context: { sourceUrl?: string | null; publisher?: string | null; today: string },
): Promise<ExtractedPromotion[]> {
  const answer = await chat(
    [
      {
        role: 'system',
        content:
          'Estrai le promozioni sui libri da un testo in italiano di un editore o di una libreria: omaggi con l\'acquisto ' +
          '(gift_with_purchase), offerte multiple come 3x2 (bundle), sconti (discount), concorsi (contest), bonus per il preordine (preorder). ' +
          'Includi solo promozioni scritte esplicitamente nel testo, mai supposizioni. Date in formato AAAA-MM-GG; se manca l\'anno ' +
          `deducilo da oggi (${context.today}); se una data non c'è usa null. ` +
          'channel: online, bookstores (librerie), chain (una catena di librerie) o everywhere. ' +
          'reward è ciò che si ottiene, breve ("Un plaid in omaggio"); conditions come si ottiene ("Acquistando 3 libri della collana X"). ' +
          'description: due frasi scritte da te, senza copiare il testo. works: titoli dei libri citati. ' +
          'Rispondi in JSON: {"promotions": [{"title","publisher","kind","reward","conditions","description","starts_on","ends_on",' +
          '"channel","where_note","url","works"}]}. Se non ce ne sono: {"promotions": []}.',
      },
      {
        role: 'user',
        content:
          (context.publisher ? `Editore o negozio: ${context.publisher}\n` : '') +
          (context.sourceUrl ? `Pagina: ${context.sourceUrl}\n` : '') +
          `Testo:\n${text.slice(0, 12000)}`,
      },
    ],
    { temperature: 0, json: true },
  );
  let parsed: { promotions?: unknown };
  try {
    parsed = JSON.parse(answer);
  } catch {
    return [];
  }
  const str = (v: unknown) => (typeof v === 'string' && v.trim() ? v.trim() : null);
  const date = (v: unknown) => (typeof v === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(v) ? v : null);
  return (Array.isArray(parsed.promotions) ? parsed.promotions : [])
    .filter((p): p is Record<string, unknown> => Boolean(p) && typeof p === 'object' && Boolean(str((p as any).title)))
    .map((p) => ({
      title: str(p.title)!,
      publisher: str(p.publisher) ?? context.publisher ?? null,
      kind: PROMOTION_KINDS.includes(p.kind as any) ? (p.kind as ExtractedPromotion['kind']) : 'discount',
      reward: str(p.reward),
      conditions: str(p.conditions),
      description: str(p.description),
      starts_on: date(p.starts_on),
      ends_on: date(p.ends_on),
      channel: PROMOTION_CHANNELS.includes(p.channel as any) ? (p.channel as ExtractedPromotion['channel']) : 'everywhere',
      where_note: str(p.where_note),
      url: str(p.url) ?? context.sourceUrl ?? null,
      works: Array.isArray(p.works) ? p.works.map(str).filter((w): w is string => Boolean(w)) : [],
    }))
    // scadute: non servono
    .filter((p) => !p.ends_on || p.ends_on >= context.today);
}

export interface ExtractedRelease {
  title: string;
  authors: string[];
  publisher: string | null;
  release_date: string | null;
  format: 'paperback' | 'hardcover' | 'kindle' | 'audio';
  edition_type: 'standard' | 'special' | 'limited';
  isbn: string | null;
  series: string | null;
  series_number: number | null;
  details: string | null;
  print_run: number | null;
  price: number | null;
  url: string | null;
}

const FORMATS = ['paperback', 'hardcover', 'kindle', 'audio'] as const;
const EDITION_TYPES = ['standard', 'special', 'limited'] as const;

/** Uscite di libri trovate in una pagina o un feed "prossime uscite". Solo quelle esplicite. */
export async function extractReleases(
  text: string,
  context: { sourceUrl?: string | null; publisher?: string | null; today: string },
): Promise<ExtractedRelease[]> {
  const answer = await chat(
    [
      {
        role: 'system',
        content:
          'Estrai le uscite di libri da un testo in italiano (pagina o feed delle prossime uscite di un editore o di una libreria). ' +
          'Includi solo libri con titolo scritto esplicitamente, mai supposizioni. title è solo il titolo dell\'opera, senza ' +
          '"edizione speciale", "limited edition" o il formato. Date in formato AAAA-MM-GG; se manca il giorno o ' +
          `la data non è certa usa null; se manca l'anno deducilo da oggi (${context.today}). ` +
          'format: paperback (brossura), hardcover (copertina rigida), kindle (ebook), audio (audiolibro); se non è detto, paperback. ' +
          'edition_type: limited se è a tiratura limitata o numerata, special se è un\'edizione speciale/da collezione (bordi decorati, ' +
          'copertina alternativa, sovraccoperta esclusiva), altrimenti standard. details: in breve cosa ha di speciale. ' +
          'print_run: numero di copie se indicato. price: prezzo in euro come numero. isbn solo se scritto nel testo. ' +
          'Rispondi in JSON: {"releases": [{"title","authors","publisher","release_date","format","edition_type","isbn",' +
          '"series","series_number","details","print_run","price","url"}]}. Se non ce ne sono: {"releases": []}.',
      },
      {
        role: 'user',
        content:
          (context.publisher ? `Editore o negozio: ${context.publisher}\n` : '') +
          (context.sourceUrl ? `Pagina: ${context.sourceUrl}\n` : '') +
          `Testo:\n${text.slice(0, 12000)}`,
      },
    ],
    { temperature: 0, json: true },
  );
  let parsed: { releases?: unknown };
  try {
    parsed = JSON.parse(answer);
  } catch {
    return [];
  }
  const str = (v: unknown) => (typeof v === 'string' && v.trim() ? v.trim() : null);
  const num = (v: unknown) => (typeof v === 'number' && Number.isFinite(v) && v > 0 ? v : null);
  const date = (v: unknown) => (typeof v === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(v) ? v : null);
  // uscite già passate da più di una settimana: non sono più notizie
  const oldest = new Date(Date.parse(`${context.today}T00:00:00Z`) - 7 * 86_400_000).toISOString().slice(0, 10);
  return (Array.isArray(parsed.releases) ? parsed.releases : [])
    .filter((r): r is Record<string, unknown> => Boolean(r) && typeof r === 'object' && Boolean(str((r as any).title)))
    .map((r) => {
      const isbn = str(r.isbn);
      return {
        title: str(r.title)!,
        authors: Array.isArray(r.authors) ? r.authors.map(str).filter((a): a is string => Boolean(a)) : [],
        publisher: str(r.publisher) ?? context.publisher ?? null,
        release_date: date(r.release_date),
        format: FORMATS.includes(r.format as any) ? (r.format as ExtractedRelease['format']) : 'paperback',
        edition_type: EDITION_TYPES.includes(r.edition_type as any) ? (r.edition_type as ExtractedRelease['edition_type']) : 'standard',
        isbn: isbn && isValidIsbn(isbn) ? normalizeIsbn(isbn) : null,
        series: str(r.series),
        series_number: num(r.series_number),
        details: str(r.details),
        print_run: num(r.print_run),
        price: num(r.price),
        url: str(r.url) ?? context.sourceUrl ?? null,
      };
    })
    .filter((r) => !r.release_date || r.release_date >= oldest);
}
