// Aiuti dei moduli del pannello, pensati per chi non è pratica: interruttore Bozza/Pubblicato in cima,
// scorciatoie sotto le date, controllo dei campi con messaggi in parole ("Manca il titolo"),
// anteprima dal vivo di promozioni ed eventi e anteprima della grafica dal link.
import type { Field, Resource } from './resources';

const pad = (n: number) => String(n).padStart(2, '0');
const iso = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const parse = (v: string) => (v ? new Date(`${v}T12:00:00`) : null);
const esc = (v: unknown) =>
  String(v ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);

const STATUS_HELP: Record<string, string> = {
  draft: 'Si vede solo nel pannello.',
  published: 'Va sul sito al prossimo aggiornamento (pochi minuti).',
  archived: 'Tolto dal sito, ma resta qui.',
};

/** HTML dell'interruttore: la tendina vera resta nel modulo, nascosta, così salvataggio e bozza non cambiano. */
export function statusSwitchHtml(field: Field, value: unknown): string {
  const current = String(value ?? 'draft');
  return `<div class="status-bar">
      <div class="status-switch" role="group" aria-label="${esc(field.label)}">
        ${field.options!.map(([v, l]) => `<button type="button" data-status="${esc(v)}" aria-pressed="${v === current}">${esc(l)}</button>`).join('')}
      </div>
      <small class="muted" data-status-help>${esc(STATUS_HELP[current] ?? '')}</small>
      <select name="${field.name}" id="f-${field.name}" hidden data-switch>${field.options!
        .map(([v, l]) => `<option value="${esc(v)}" ${v === current ? 'selected' : ''}>${esc(l)}</option>`)
        .join('')}</select>
    </div>`;
}

export function bindStatusSwitch(form: HTMLFormElement): void {
  const select = form.querySelector<HTMLSelectElement>('select[data-switch]');
  if (!select) return;
  const bar = select.closest('.status-bar')!;
  const help = bar.querySelector<HTMLElement>('[data-status-help]')!;
  const sync = () => {
    bar.querySelectorAll<HTMLButtonElement>('[data-status]').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.status === select.value)));
    bar.setAttribute('data-value', select.value);
    help.textContent = STATUS_HELP[select.value] ?? '';
  };
  bar.addEventListener('click', (e) => {
    const b = (e.target as HTMLElement).closest<HTMLButtonElement>('[data-status]');
    if (!b) return;
    select.value = b.dataset.status!;
    select.dispatchEvent(new Event('change', { bubbles: true }));
    sync();
  });
  sync();
}

/** Scorciatoie sotto ogni data ("Oggi", "Tra una settimana", "Fine mese", "Svuota") e avviso se la fine viene prima dell'inizio. */
export function bindDateHelpers(form: HTMLFormElement, resource: Resource): void {
  const start = form.querySelector<HTMLInputElement>('input[type="date"][name="starts_on"]');
  const end = form.querySelector<HTMLInputElement>('input[type="date"][name="ends_on"]');
  form.querySelectorAll<HTMLInputElement>('input[type="date"]:not([disabled])').forEach((input) => {
    const field = resource.fields.find((f) => f.name === input.name);
    const isEnd = input === end;
    const shortcuts: Array<[string, () => string]> = [
      ['Oggi', () => iso(new Date())],
      [
        'Tra una settimana',
        () => {
          const from = (isEnd && parse(start?.value ?? '')) || new Date();
          return iso(new Date(from.getFullYear(), from.getMonth(), from.getDate() + 7));
        },
      ],
      [
        'Fine mese',
        () => {
          const from = (isEnd && parse(start?.value ?? '')) || new Date();
          return iso(new Date(from.getFullYear(), from.getMonth() + 1, 0));
        },
      ],
    ];
    const row = document.createElement('div');
    row.className = 'date-shortcuts';
    row.innerHTML =
      shortcuts.map(([label], i) => `<button type="button" class="chip" data-i="${i}">${label}</button>`).join('') +
      (field?.required ? '' : '<button type="button" class="chip ghost" data-clear>Svuota</button>');
    row.addEventListener('click', (e) => {
      const b = (e.target as HTMLElement).closest<HTMLButtonElement>('button');
      if (!b) return;
      input.value = b.dataset.clear !== undefined ? '' : shortcuts[Number(b.dataset.i)][1]();
      input.dispatchEvent(new Event('input', { bubbles: true }));
      input.dispatchEvent(new Event('change', { bubbles: true }));
    });
    input.after(row);
  });

  if (!start || !end) return;
  const warn = document.createElement('small');
  warn.className = 'field-error';
  warn.hidden = true;
  end.closest('.field')!.append(warn);
  const check = () => {
    const bad = Boolean(start.value && end.value && end.value < start.value);
    warn.hidden = !bad;
    warn.textContent = bad ? 'La fine viene prima dell\'inizio: controlla le date.' : '';
    end.classList.toggle('is-invalid', bad);
  };
  start.addEventListener('input', check);
  end.addEventListener('input', check);
  check();
}

/** Controllo prima di salvare, con messaggi in parole. Restituisce il testo dell'errore o null. */
export function checkForm(form: HTMLFormElement, resource: Resource): string | null {
  form.querySelectorAll('.is-invalid').forEach((el) => el.classList.remove('is-invalid'));
  const missing: Field[] = [];
  for (const f of resource.fields) {
    if (!f.required || f.readonly || f.type === 'checkbox') continue;
    const el = form.elements.namedItem(f.name) as HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement | null;
    if (!el || el.value.trim() !== '') continue;
    missing.push(f);
    (el.closest('.field') ?? el).classList.add('is-invalid');
  }
  const start = form.querySelector<HTMLInputElement>('input[name="starts_on"]');
  const end = form.querySelector<HTMLInputElement>('input[name="ends_on"]');
  const wrongDates = Boolean(start?.value && end?.value && end.value < start.value);
  if (!missing.length && !wrongDates) return null;

  const first = missing[0] ? (form.elements.namedItem(missing[0].name) as HTMLElement) : end!;
  first.closest('details')?.setAttribute('open', '');
  const visible = first.closest('.field')?.querySelector<HTMLElement>('.picker-input') ?? first;
  visible.scrollIntoView({ block: 'center' });
  visible.focus({ preventScroll: true });
  if (missing.length) {
    const names = missing.map((f) => f.label.toLowerCase());
    return missing.length === 1 ? `Manca: ${names[0]}` : `Mancano: ${names.join(', ')}`;
  }
  return 'La fine viene prima dell\'inizio: controlla le date.';
}

// ---------------------------------------------------------------------------
// Anteprime
// ---------------------------------------------------------------------------
const MONTHS = ['gen', 'feb', 'mar', 'apr', 'mag', 'giu', 'lug', 'ago', 'set', 'ott', 'nov', 'dic'];
const longDate = (v: string) => parse(v)?.toLocaleDateString('it-IT', { day: 'numeric', month: 'long' }) ?? '';

function valueOf(form: HTMLFormElement, name: string): string {
  const el = form.elements.namedItem(name) as HTMLInputElement | HTMLSelectElement | null;
  return el?.value.trim() ?? '';
}
function labelOf(form: HTMLFormElement, name: string): string {
  const el = form.elements.namedItem(name);
  if (!(el instanceof HTMLSelectElement) || !el.value) return '';
  return el.selectedOptions[0]?.textContent?.trim() ?? '';
}

function promoPreview(form: HTMLFormElement): string {
  const ends = valueOf(form, 'ends_on');
  const starts = valueOf(form, 'starts_on');
  const today = new Date().toISOString().slice(0, 10);
  const when = ends ? `Fino al ${longDate(ends)}` : starts > today ? `Dal ${longDate(starts)}` : 'Fino a esaurimento';
  const where = valueOf(form, 'where_note') || labelOf(form, 'channel');
  return `<div class="pv-coupon">
      <span class="pv-kind">${esc(labelOf(form, 'kind') || 'Promozione')}</span>
      <strong class="pv-reward">${esc(valueOf(form, 'reward') || 'Cosa si ottiene')}</strong>
      <span class="pv-title">${esc(valueOf(form, 'title') || 'Titolo della promozione')}</span>
      ${valueOf(form, 'conditions') ? `<span class="pv-cond">${esc(valueOf(form, 'conditions'))}</span>` : ''}
      <span class="pv-foot">${esc([labelOf(form, 'publisher_id'), where].filter(Boolean).join(' · '))}</span>
      <span class="pv-when">${esc(when)}</span>
    </div>`;
}

function eventPreview(form: HTMLFormElement): string {
  const d = parse(valueOf(form, 'starts_on'));
  const e = parse(valueOf(form, 'ends_on'));
  const days = d && e && e > d ? `${d.getDate()}–${e.getDate()}` : d ? String(d.getDate()) : '?';
  const place = [valueOf(form, 'venue'), valueOf(form, 'city')].filter(Boolean).join(', ');
  return `<div class="pv-ticket">
      <div class="pv-stub"><strong>${esc(days)}</strong><span>${d ? MONTHS[(e && e > d ? e : d).getMonth()] : 'data'}</span></div>
      <div class="pv-body">
        <span class="pv-kind">${esc(labelOf(form, 'kind') || 'Evento')}</span>
        <strong class="pv-title">${esc(valueOf(form, 'title') || 'Titolo dell\'evento')}</strong>
        <span class="pv-foot">${esc(place || 'Luogo e città')}</span>
      </div>
    </div>`;
}

const PREVIEWS: Record<string, (form: HTMLFormElement) => string> = { promotions: promoPreview, events: eventPreview };

export const hasPreview = (resource: Resource) => resource.key in PREVIEWS;

/** Anteprima che si aggiorna mentre si scrive (promozioni ed eventi). Approssimata: l'aspetto vero è quello del sito. */
export function bindPreview(form: HTMLFormElement, resource: Resource): void {
  const draw = PREVIEWS[resource.key];
  const box = document.querySelector<HTMLElement>('[data-form-preview]');
  if (!draw || !box) return;
  let frame = 0;
  const update = () => {
    cancelAnimationFrame(frame);
    frame = requestAnimationFrame(() => (box.innerHTML = draw(form)));
  };
  form.addEventListener('input', update);
  form.addEventListener('change', update);
  update();
}

/** Anteprima della grafica sotto il campo con il link (solo nel pannello, dopo che il link è stato scritto). */
export function bindImageLinkPreview(form: HTMLFormElement): void {
  const input = form.querySelector<HTMLInputElement>('input[name="image_url"]:not([type="hidden"])');
  if (!input) return;
  const img = document.createElement('img');
  img.className = 'link-preview';
  img.alt = '';
  const note = document.createElement('small');
  note.className = 'field-error';
  note.hidden = true;
  input.after(img, note);
  let timer = 0;
  const show = () => {
    const url = input.value.trim();
    note.hidden = true;
    if (!/^https?:\/\/\S+$/i.test(url)) {
      img.hidden = true;
      img.removeAttribute('src');
      return;
    }
    img.hidden = false;
    img.src = url;
  };
  img.addEventListener('error', () => {
    img.hidden = true;
    note.hidden = false;
    note.textContent = 'Non riesco a mostrare l\'immagine: controlla che il link porti a una foto (finisce di solito con .jpg, .png o .webp).';
  });
  input.addEventListener('input', () => {
    clearTimeout(timer);
    timer = window.setTimeout(show, 400);
  });
  show();
}
