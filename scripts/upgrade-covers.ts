// Copertine nitide per le edizioni già in catalogo: le miniature di Google Books (128 px) diventano la versione
// grande (800 px) quando Google ce l'ha davvero (largeGoogleCover in scripts/lib/books.ts); le altre restano come sono.
// Si può rilanciare: le copertine già ingrandite vengono saltate.
//
//   npm run covers               aggiorna
//   npm run covers -- --dry-run  solo controllo: quante si possono ingrandire, nessuna scrittura
import { parseArgs } from 'node:util';
import { largeGoogleCover } from './lib/books.ts';
import { sb } from './lib/sources.ts';

const { values: flags } = parseArgs({ options: { 'dry-run': { type: 'boolean', default: false } } });
if (!sb) throw new Error('Supabase non configurato: servono PUBLIC_SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY');

const { data, error } = await sb.from('editions').select('id, cover_url, works ( title )').like('cover_url', '%books.google.com%');
if (error) throw error;
const editions = (data ?? []) as unknown as Array<{ id: string; cover_url: string; works: { title: string } | null }>;

let upgraded = 0;
let kept = 0;
for (const e of editions) {
  const big = await largeGoogleCover(e.cover_url);
  if (!big) {
    kept++;
    continue;
  }
  if (!flags['dry-run']) {
    const { error: err } = await sb.from('editions').update({ cover_url: big }).eq('id', e.id);
    if (err) throw err;
  }
  upgraded++;
  console.log(`✓ ${e.works?.title ?? e.id}`);
}
console.log(
  `\n${upgraded} copertine ${flags['dry-run'] ? 'si possono ingrandire' : 'ingrandite'}, ${kept} restano com'erano (Google non ha la versione grande o sono già grandi).`,
);
