// Quando ricostruire il sito: regola pura, separata dallo script per poterla provare da sola.

export interface SiteState {
  content_changed_at: string | null;
  rebuild_requested_at: string | null;
  last_rebuild_at: string | null;
}

/** Minuti di calma dopo l'ultima modifica: chi sta approvando una serie di schede finisce prima che parta la build. */
export const QUIET_MINUTES = 10;

export type RebuildDecision =
  | { rebuild: true; reason: string }
  | { rebuild: false; reason: string };

const time = (iso: string | null) => (iso ? Date.parse(iso) : 0);

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
  return { rebuild: true, reason: 'contenuti modificati' };
}
