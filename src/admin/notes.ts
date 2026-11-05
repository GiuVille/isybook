// Note personali nella colonna di sinistra del pannello, come le note di PowerPoint: sempre lì, su ogni pagina.
// Si salvano da sole su Supabase (tabella editor_notes, migrazione 0017: ognuna vede solo le proprie).
// Il pannello ridisegna la colonna a ogni pagina: il testo resta in memoria e un salvataggio in sospeso parte subito.
// Senza rete una copia resta nel browser e si invia al primo salvataggio riuscito.
import { getSupabase } from '../lib/supabase';

let text: string | null = null; // null = non ancora letto
let userId: string | null = null;
let pending = 0;
let status = '';
const BACKUP = 'isybook:admin-notes';

const esc = (s: string) => s.replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);
// copia locale legata all'account: su un computer condiviso ognuna ritrova solo le sue
const backupKey = () => `${BACKUP}:${userId}`;
const backup = (value: string | null) => {
  if (!userId) return;
  try {
    if (value === null) localStorage.removeItem(backupKey());
    else localStorage.setItem(backupKey(), value);
  } catch {
    // niente copia locale: pazienza
  }
};

/** Il riquadro, da mettere nella colonna (si apre e chiude solo su telefono). */
export function notesHtml(): string {
  return `
    <details class="notes" open>
      <summary>📝 Le mie note</summary>
      <textarea id="my-notes" rows="6" maxlength="20000" placeholder="Promemoria, cose da controllare, idee…" aria-label="Le mie note">${esc(text ?? '')}</textarea>
      <small class="notes-status muted" aria-live="polite">${esc(status)}</small>
    </details>`;
}

function grow(area: HTMLTextAreaElement) {
  area.style.height = 'auto';
  area.style.height = `${Math.min(area.scrollHeight + 2, 480)}px`;
}

function setStatus(value: string) {
  status = value;
  const el = document.querySelector('.notes-status');
  if (el) el.textContent = value;
}

async function save() {
  pending = 0;
  if (text === null || !userId) return;
  setStatus('Salvataggio…');
  const { error } = await getSupabase().from('editor_notes').upsert({ user_id: userId, body: text, updated_at: new Date().toISOString() });
  if (error) {
    backup(text);
    setStatus('Non salvato: riprovo alla prossima modifica');
    return;
  }
  backup(null);
  setStatus(`Salvato alle ${new Date().toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit' })}`);
}

/** Da chiamare dopo ogni disegno della colonna: carica le note la prima volta e collega il salvataggio. */
export async function bindNotes(uid: string | undefined): Promise<void> {
  const area = document.getElementById('my-notes') as HTMLTextAreaElement | null;
  const box = area?.closest('details');
  if (!area || !uid) return;
  // telefono: la colonna sta in cima, le note partono chiuse per non spingere giù la pagina
  if (box && window.matchMedia('(max-width: 760px)').matches && !area.value) box.open = false;

  if (text === null || userId !== uid) {
    userId = uid;
    const { data, error } = await getSupabase().from('editor_notes').select('body').eq('user_id', uid).maybeSingle();
    let local: string | null = null;
    try {
      local = localStorage.getItem(backupKey());
    } catch {
      // niente
    }
    if (error) setStatus('Note non disponibili: hai applicato la migrazione 0017?');
    const loaded: string = local ?? data?.body ?? '';
    text = loaded;
    if (local !== null) setStatus('Ritrovata una copia non salvata: la salvo alla prossima modifica');
    if (document.activeElement !== area) area.value = loaded;
  }
  grow(area);
  area.addEventListener('input', () => {
    text = area.value;
    backup(text);
    grow(area);
    setStatus('…');
    clearTimeout(pending);
    pending = window.setTimeout(save, 1000);
  });
  area.addEventListener('blur', () => {
    if (pending) {
      clearTimeout(pending);
      save();
    }
  });
}

/** Cambiando pagina: un salvataggio in sospeso parte subito. */
export function flushNotes(): void {
  if (!pending) return;
  clearTimeout(pending);
  save();
}
