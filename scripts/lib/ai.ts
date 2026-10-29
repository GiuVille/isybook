// Client unico per modelli compatibili con l'API OpenAI (Mistral, Groq, Ollama…).
// Il fornitore si cambia solo da configurazione: AI_BASE_URL, AI_API_KEY, AI_MODEL.
// Regola: mai inviare dati degli utenti, i piani gratuiti possono usarli per l'addestramento.

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
