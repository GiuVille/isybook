// Quando ricostruire il sito: regola pura, separata dallo script per poterla provare da sola.

export interface SiteState {
  content_changed_at: string | null;
  rebuild_requested_at: string | null;
  last_rebuild_at: string | null;
  builds_day?: string | null; // giorno (AAAA-MM-GG) a cui si riferisce il contatore
  builds_count?: number; // build automatiche partite in quel giorno
}

/** Minuti di calma dopo l'ultima modifica: chi sta approvando una serie di schede finisce prima che parta la build. */
export const QUIET_MINUTES = 5;
/**
 * Build automatiche al giorno al massimo: Cloudflare Pages gratis ne concede 500 al mese (~16 al giorno).
 * Il pulsante "Aggiorna il sito adesso" e la build del mattino passano sempre.
 */
export const DAILY_BUILD_CAP = 14;

export type RebuildDecision =
  | { rebuild: true; reason: string }
  | { rebuild: false; reason: string };

const time = (iso: string | null) => (iso ? Date.parse(iso) : 0);

/** Build automatiche già partite oggi (il contatore vale solo per il giorno a cui si riferisce). */
export const buildsToday = (state: SiteState, now: Date) => (state.builds_day === now.toISOString().slice(0, 10) ? (state.builds_count ?? 0) : 0);

export function shouldRebuild(state: SiteState, now: Date, force = false): RebuildDecision {
  if (force) return { rebuild: true, reason: 'build quotidiana' };
  const last = time(state.last_rebuild_at);
  if (time(state.rebuild_requested_at) > last) return { rebuild: true, reason: 'richiesta dalla redazione' };
  const changed = time(state.content_changed_at);
  if (changed <= last) return { rebuild: false, reason: 'nessuna modifica dall\'ultima build' };
  const quietFor = (now.getTime() - changed) / 60_000;
  if (quietFor < QUIET_MINUTES) {
    return { rebuild: false, reason: `modifiche in corso (l'ultima ${Math.floor(quietFor)} minuti fa): aspetto` };
  }
  if (buildsToday(state, now) >= DAILY_BUILD_CAP) {
    return { rebuild: false, reason: `già ${DAILY_BUILD_CAP} build oggi: le modifiche andranno online con la build del mattino (o con "Aggiorna il sito adesso")` };
  }
  return { rebuild: true, reason: 'contenuti modificati' };
}
