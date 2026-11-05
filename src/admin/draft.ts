// Bozza automatica delle schede del pannello: mentre si scrive, i valori del modulo restano nel browser
// (localStorage, solo su questo dispositivo), così si può andare su un'altra pagina e ritrovarli al ritorno.
// Online non va niente finché non si preme "Salva"; dopo un salvataggio o un'eliminazione la bozza sparisce.

const PREFIX = 'isybook:admin-draft:';
const MAX_AGE = 30 * 24 * 60 * 60 * 1000; // 30 giorni

interface Draft {
  savedAt: number;
  fields: Record<string, string | boolean>;
  lists: Record<string, string[]>; // caselle spuntate degli elenchi molti-a-molti, per tabella di collegamento
}

const read = (key: string): Draft | null => {
  try {
    const raw = localStorage.getItem(PREFIX + key);
    return raw ? (JSON.parse(raw) as Draft) : null;
  } catch {
    return null;
  }
};

/** Fotografia del modulo: campi con un nome e caselle degli elenchi. */
function snapshot(form: HTMLFormElement): Omit<Draft, 'savedAt'> {
  const fields: Draft['fields'] = {};
  form.querySelectorAll<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>('[name]').forEach((el) => {
    if (el.disabled) return;
    fields[el.name] = el instanceof HTMLInputElement && el.type === 'checkbox' ? el.checked : el.value;
  });
  const lists: Draft['lists'] = {};
  form.querySelectorAll<HTMLFieldSetElement>('fieldset.m2m[data-join]').forEach((fs) => {
    lists[fs.dataset.join!] = [...fs.querySelectorAll<HTMLInputElement>('.m2m-list input:checked')].map((i) => i.value).sort();
  });
  return { fields, lists };
}

const same = (a: Omit<Draft, 'savedAt'>, b: Omit<Draft, 'savedAt'>) => JSON.stringify(a) === JSON.stringify(b);

/**
 * Rimette nel modulo la bozza (se è diversa da quanto salvato) e mostra l'avviso con "Scarta la bozza".
 * Va chiamata prima dei menu con ricerca e dei suggerimenti, che leggono i valori dei campi.
 */
export function restoreDraft(form: HTMLFormElement, key: string, onDiscard: () => void): void {
  const draft = read(key);
  if (!draft) return;
  if (Date.now() - draft.savedAt > MAX_AGE || same(snapshot(form), draft)) return clearDraft(key);
  for (const [name, value] of Object.entries(draft.fields)) {
    const el = form.elements.namedItem(name);
    if (!(el instanceof HTMLInputElement || el instanceof HTMLTextAreaElement || el instanceof HTMLSelectElement)) continue;
    if (el instanceof HTMLInputElement && el.type === 'checkbox') el.checked = Boolean(value);
    else el.value = String(value);
    // foto già caricata: anche l'anteprima
    const preview = el.closest('.image-field')?.querySelector<HTMLImageElement>('.image-preview');
    if (preview && typeof value === 'string') {
      preview.hidden = !value;
      if (value) preview.src = value;
    }
  }
  for (const [join, values] of Object.entries(draft.lists)) {
    const fs = form.querySelector(`fieldset.m2m[data-join="${CSS.escape(join)}"]`);
    fs?.querySelectorAll<HTMLInputElement>('.m2m-list input[type="checkbox"]').forEach((i) => (i.checked = values.includes(i.value)));
  }
  const when = new Date(draft.savedAt).toLocaleString('it-IT', { day: 'numeric', month: 'numeric', hour: '2-digit', minute: '2-digit' });
  const note = document.createElement('div');
  note.className = 'draft-note';
  note.setAttribute('role', 'status');
  note.innerHTML = `<span>📝 <strong>Bozza ripristinata:</strong> modifiche del ${when} non ancora salvate. Premi «Salva» per pubblicarle.</span>
    <button type="button" class="link">Scarta la bozza</button>`;
  note.querySelector('button')!.addEventListener('click', () => {
    clearDraft(key);
    onDiscard();
  });
  form.before(note);
}

/** Salva la bozza a ogni modifica (mezzo secondo dopo l'ultima), solo se è diversa da quanto c'era all'apertura. */
export function watchDraft(form: HTMLFormElement, key: string, original: Omit<Draft, 'savedAt'>): void {
  let timer = 0;
  const save = () => {
    const now = snapshot(form);
    try {
      if (same(now, original)) localStorage.removeItem(PREFIX + key);
      else localStorage.setItem(PREFIX + key, JSON.stringify({ ...now, savedAt: Date.now() }));
    } catch {
      // senza spazio o con il salvataggio bloccato la bozza non c'è: il modulo funziona lo stesso
    }
  };
  const later = () => {
    clearTimeout(timer);
    timer = window.setTimeout(save, 500);
  };
  form.addEventListener('input', later);
  form.addEventListener('change', later);
  // anche i suggerimenti e i menu spuntano caselle da codice: avvisano con "change", già ascoltato qui sopra
}

/** Fotografia di partenza (dati salvati), da passare a watchDraft. */
export const formState = snapshot;

export function clearDraft(key: string): void {
  try {
    localStorage.removeItem(PREFIX + key);
  } catch {
    // niente da fare
  }
}

/** Pulizia: via le bozze più vecchie di 30 giorni. */
export function pruneDrafts(): void {
  try {
    for (let i = localStorage.length - 1; i >= 0; i--) {
      const k = localStorage.key(i);
      if (!k?.startsWith(PREFIX)) continue;
      const d = read(k.slice(PREFIX.length));
      if (!d || Date.now() - d.savedAt > MAX_AGE) localStorage.removeItem(k);
    }
  } catch {
    // niente da fare
  }
}
