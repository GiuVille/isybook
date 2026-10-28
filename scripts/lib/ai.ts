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
