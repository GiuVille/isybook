// Menu a tendina con ricerca per il pannello: sostituisce a vista gli elenchi di caselle (tropes, generi, autori…)
// e le tendine lunghe (editore, genere del trope, decorazione). I campi veri restano nel modulo, nascosti:
// caselle e <select> continuano a essere letti al salvataggio come prima, il menu li spunta e li sceglie.
//
// Pensato per chi non usa spesso il computer: le voci scelte si vedono come pillole grandi con la ✕, si scrive per
// filtrare, un clic aggiunge; se la voce non c'è compare «➕ Aggiungi …». Tastiera: ↑ ↓ per scorrere, Invio per
// scegliere, Esc per chiudere, Backspace a campo vuoto toglie l'ultima pillola.

type Create = (table: string, name: string) => Promise<{ id: string; name: string }>;
interface Option {
  value: string;
  label: string;
}

const esc = (s: string) => s.replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);
const norm = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim();
let uid = 0;

/** Struttura comune: campo di testo con la freccia, elenco che si apre sotto. */
function shell(placeholder: string, label: string) {
  const id = `picker-${++uid}`;
  const root = document.createElement('div');
  root.className = 'picker';
  root.innerHTML = `
    <div class="picker-chips" hidden></div>
    <div class="picker-box">
      <input type="search" class="picker-input" role="combobox" aria-expanded="false" aria-controls="${id}" aria-autocomplete="list"
        autocomplete="off" placeholder="${esc(placeholder)}" aria-label="${esc(label)}">
      <button type="button" class="picker-toggle" tabindex="-1" aria-label="Apri l'elenco">▾</button>
    </div>
    <ul class="picker-list" id="${id}" role="listbox" hidden></ul>`;
  return {
    root,
    chips: root.querySelector<HTMLElement>('.picker-chips')!,
    input: root.querySelector<HTMLInputElement>('.picker-input')!,
    toggle: root.querySelector<HTMLButtonElement>('.picker-toggle')!,
    list: root.querySelector<HTMLUListElement>('.picker-list')!,
  };
}

/** Comportamento condiviso da scelta multipla e singola. */
function wire(
  ui: ReturnType<typeof shell>,
  opts: {
    options: () => Option[];
    isChosen: (value: string) => boolean;
    choose: (option: Option) => void;
    create?: (name: string) => Promise<void>;
    keepOpen: boolean;
    onBackspace?: () => void;
  },
) {
  let active = 0;
  let items: Array<{ kind: 'option'; option: Option } | { kind: 'create'; name: string }> = [];

  const close = () => {
    ui.list.hidden = true;
    ui.input.setAttribute('aria-expanded', 'false');
  };
  /** Ridisegna l'elenco restando dove si era; porta in vista la voce attiva solo se richiesto (frecce della tastiera). */
  const draw = (scrollToActive = false) => {
    const top = ui.list.scrollTop;
    const q = norm(ui.input.value);
    const all = opts.options();
    const matches = all.filter((o) => !q || norm(o.label).includes(q));
    items = matches.map((option) => ({ kind: 'option' as const, option }));
    if (opts.create && q && !all.some((o) => norm(o.label) === q)) items.push({ kind: 'create', name: ui.input.value.trim() });
    active = Math.min(active, Math.max(items.length - 1, 0));
    ui.list.innerHTML = items.length
      ? items
          .map((item, i) =>
            item.kind === 'create'
              ? `<li role="option" class="picker-create${i === active ? ' is-active' : ''}" data-i="${i}">➕ Aggiungi «${esc(item.name)}»</li>`
              : `<li role="option" aria-selected="${opts.isChosen(item.option.value)}" class="${i === active ? 'is-active' : ''}" data-i="${i}">
                  <span class="picker-check" aria-hidden="true">${opts.isChosen(item.option.value) ? '✓' : ''}</span>${esc(item.option.label)}</li>`,
          )
          .join('')
      : '<li class="picker-empty">Nessun risultato</li>';
    ui.list.scrollTop = top;
    if (scrollToActive) ui.list.querySelector('.is-active')?.scrollIntoView({ block: 'nearest' });
  };
  const open = () => {
    if (ui.list.hidden) ui.list.scrollTop = 0; // riaprendo si riparte dall'inizio; mentre è aperto resta dov'è
    draw();
    ui.list.hidden = false;
    ui.input.setAttribute('aria-expanded', 'true');
  };
  const pick = async (i: number) => {
    const item = items[i];
    if (!item) return;
    if (item.kind === 'create') {
      await opts.create!(item.name);
      ui.input.value = ''; // la voce nuova è creata: si torna all'elenco completo
    } else {
      // la ricerca resta com'è: stesso elenco, stessa posizione, con la nuova spunta
      opts.choose(item.option);
      active = i;
    }
    if (opts.keepOpen) {
      open();
      ui.input.focus();
    } else close();
  };

  ui.input.addEventListener('focus', open);
  ui.input.addEventListener('click', open);
  ui.input.addEventListener('input', () => {
    active = 0;
    ui.list.scrollTop = 0; // ricerca nuova: si riparte dai primi risultati
    open();
  });
  ui.toggle.addEventListener('click', () => (ui.list.hidden ? (ui.input.focus(), open()) : close()));
  // mousedown: si sceglie prima che il campo perda il fuoco
  ui.list.addEventListener('mousedown', (e) => {
    const li = (e.target as HTMLElement).closest<HTMLElement>('[data-i]');
    if (!li) return;
    e.preventDefault();
    pick(Number(li.dataset.i));
  });
  ui.input.addEventListener('keydown', (e) => {
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      e.preventDefault();
      if (ui.list.hidden) return open();
      active = (active + (e.key === 'ArrowDown' ? 1 : -1) + items.length) % Math.max(items.length, 1);
      draw(true);
    } else if (e.key === 'Enter') {
      e.preventDefault(); // mai inviare tutto il modulo da qui
      if (!ui.list.hidden) pick(active);
    } else if (e.key === 'Escape') {
      close();
    } else if (e.key === 'Backspace' && !ui.input.value) {
      opts.onBackspace?.();
    }
  });
  ui.input.addEventListener('blur', () => setTimeout(close, 120));
  return { draw };
}

/** Scelta multipla: un fieldset.m2m con le caselle in .m2m-list (nascoste) e, se si possono creare voci, data-create. */
function multi(fieldset: HTMLFieldSetElement, create?: Create) {
  const box = fieldset.querySelector<HTMLElement>('.m2m-list');
  if (!box) return;
  const label = fieldset.querySelector('legend')?.textContent?.trim() ?? '';
  const ui = shell(`Scrivi per cercare in ${label.toLowerCase()}…`, `Cerca in ${label}`);
  const inputs = () => [...box.querySelectorAll<HTMLInputElement>('input[type="checkbox"]')];
  const options = () =>
    inputs()
      .map((i) => ({ value: i.value, label: i.parentElement!.textContent!.trim() }))
      .sort((a, b) => a.label.localeCompare(b.label, 'it'));
  const find = (value: string) => inputs().find((i) => i.value === value);
  const showChips = () => {
    const picked = options().filter((o) => find(o.value)?.checked);
    ui.chips.hidden = picked.length === 0;
    ui.chips.innerHTML = picked
      .map((o) => `<span class="picker-chip">${esc(o.label)}<button type="button" data-remove="${esc(o.value)}" aria-label="Togli ${esc(o.label)}">✕</button></span>`)
      .join('');
  };
  const table = fieldset.dataset.create;
  const { draw } = wire(ui, {
    options,
    isChosen: (v) => Boolean(find(v)?.checked),
    choose: (o) => {
      const input = find(o.value);
      if (input) input.checked = !input.checked;
      showChips();
    },
    create:
      table && create
        ? async (name) => {
            const row = await create(table, name);
            const existing = find(row.id);
            if (existing) existing.checked = true;
            else box.insertAdjacentHTML('beforeend', `<label class="check"><input type="checkbox" value="${esc(row.id)}" checked> ${esc(row.name)}</label>`);
            showChips();
          }
        : undefined,
    keepOpen: true,
    onBackspace: () => {
      const last = options().filter((o) => find(o.value)?.checked).pop();
      if (last) {
        find(last.value)!.checked = false;
        showChips();
      }
    },
  });
  ui.chips.addEventListener('click', (e) => {
    const button = (e.target as HTMLElement).closest<HTMLButtonElement>('[data-remove]');
    if (!button) return;
    const input = find(button.dataset.remove!);
    if (input) input.checked = false;
    showChips();
    draw();
  });
  box.hidden = true;
  box.after(ui.root);
  showChips();
}

/** Scelta singola: una <select> (nascosta) con le sue opzioni; data-create sulla select se si possono creare voci. */
function single(select: HTMLSelectElement, create?: Create) {
  const label = select.closest('.field')?.querySelector('label')?.textContent?.replace('*', '').trim() ?? '';
  const ui = shell('Scrivi per cercare…', label);
  const options = () => [...select.options].map((o) => ({ value: o.value, label: o.value ? o.text : '— nessuno —' }));
  const current = () => select.selectedOptions[0];
  const showValue = () => {
    const o = current();
    ui.input.value = o && o.value ? o.text : '';
    ui.input.placeholder = o && o.value ? o.text : 'Scrivi per cercare…';
  };
  const table = select.dataset.create;
  // aprendo si vede tutto l'elenco (la voce scelta resta nel suggerimento grigio); registrato prima di wire,
  // così il campo è già vuoto quando l'elenco si disegna
  ui.input.addEventListener('focus', () => (ui.input.value = ''));
  wire(ui, {
    options,
    isChosen: (v) => select.value === v,
    choose: (o) => {
      select.value = o.value;
      select.dispatchEvent(new Event('change', { bubbles: true }));
      showValue();
    },
    create:
      table && create
        ? async (name) => {
            const row = await create(table, name);
            if (![...select.options].some((o) => o.value === row.id)) select.add(new Option(row.name, row.id));
            select.value = row.id;
            showValue();
          }
        : undefined,
    keepOpen: false,
  });
  // chiudendo senza scegliere torna il valore di prima
  ui.input.addEventListener('blur', () => setTimeout(showValue, 150));
  select.hidden = true;
  select.after(ui.root);
  showValue();
}

/** Tutti i campi a scelta del modulo: elenchi multipli e tendine (quelle con più di 6 voci o collegate ad altre tabelle). */
export function enhancePickers(form: HTMLElement, create?: Create) {
  form.querySelectorAll<HTMLFieldSetElement>('fieldset.m2m').forEach((f) => multi(f, create));
  form.querySelectorAll<HTMLSelectElement>('select:not([disabled])').forEach((s) => {
    if (s.dataset.relation !== undefined || s.dataset.create !== undefined || s.options.length > 6) single(s, create);
  });
}
