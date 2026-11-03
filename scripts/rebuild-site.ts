// Fa ripartire la build del sito su Cloudflare Pages quando i contenuti sono cambiati.
//   npm run rebuild            ricostruisce solo se serve (modifiche ferme da qualche minuto, o richiesta dalla redazione)
//   npm run rebuild -- --force ricostruisce comunque: la build del mattino, per le sezioni che dipendono dalla data
//
// Lo stato sta in site_state (migrazione 0007), aggiornato dai trigger del database a ogni modifica.
// Gira ogni 5 minuti con .github/workflows/rebuild.yml (tiene anche sveglio il progetto Supabase gratuito).
// Senza configurazione esce senza errori.
import { parseArgs } from 'node:util';
import { buildsToday, shouldRebuild, type SiteState } from './lib/rebuild.ts';
import { sb } from './lib/sources.ts';

const { values: flags } = parseArgs({ options: { force: { type: 'boolean', default: false } } });
const hook = process.env.CLOUDFLARE_DEPLOY_HOOK;

if (!hook) {
  console.log('CLOUDFLARE_DEPLOY_HOOK non impostato: niente da fare (il sito non è ancora collegato a Cloudflare Pages).');
  process.exit(0);
}

let state: SiteState = { content_changed_at: null, rebuild_requested_at: null, last_rebuild_at: null };
if (sb) {
  const { data, error } = await sb
    .from('site_state')
    .select('content_changed_at, rebuild_requested_at, last_rebuild_at, builds_day, builds_count')
    .eq('id', 1)
    .single();
  if (error) throw error;
  state = data;
} else if (!flags.force) {
  console.log('Supabase non configurato: senza lo stato dei contenuti posso solo ricostruire con --force.');
  process.exit(0);
}

const decision = shouldRebuild(state, new Date(), flags.force);
if (!decision.rebuild) {
  console.log(`Nessuna build: ${decision.reason}.`);
  process.exit(0);
}

// l'ora di partenza, non di fine: una modifica arrivata durante la chiamata resta da pubblicare
const startedAt = new Date().toISOString();
const res = await fetch(hook, { method: 'POST' });
if (!res.ok) {
  console.error(`Cloudflare Pages ha risposto ${res.status}: ${await res.text()}`);
  process.exit(1);
}

if (sb) {
  // contatore del giorno: conta tutte le build, così il tetto tiene conto anche di quelle forzate
  const now = new Date();
  const { error } = await sb
    .from('site_state')
    .update({ last_rebuild_at: startedAt, builds_day: now.toISOString().slice(0, 10), builds_count: buildsToday(state, now) + 1 })
    .eq('id', 1);
  if (error) throw error;
}
console.log(`Build avviata (${decision.reason}).`);
