// Pannello → Post social: la socia sceglie cosa raccontare, il periodo e il formato; ottiene le immagini
// da scaricare e il testo da copiare. I dati sono quelli pubblicati sul sito (/admin/social-data.json).
import {
  FORMAT_LABELS,
  MAX_ITEMS,
  RANGE_LABELS,
  SECTION_LABELS,
  buildText,
  dateLine,
  headline,
  dateRange,
  inRange,
  rangeLabel,
  type RangeKey,
  type SocialData,
  type SocialFormat,
  type SocialItem,
  type SocialSection,
} from '../lib/social';
import { renderSlides } from './social-canvas';

const esc = (value: unknown) => String(value ?? '').replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);

export function socialHtml(): string {
  const options = <K extends string>(labels: Record<K, string>) =>
    (Object.entries(labels) as Array<[K, string]>).map(([v, l]) => `<option value="${v}">${esc(l)}</option>`).join('');
  return `
    <h1>Post social</h1>
    <p class="muted">Bozze pronte dai contenuti pubblicati sul sito. Prima di pubblicare ricontrolla date e titoli.</p>
    <div class="social">
      <form class="card social-controls" id="social-form">
        <label for="s-section">Cosa raccontare</label>
        <select id="s-section" name="section">${options(SECTION_LABELS)}</select>
        <label for="s-range" class="range-label">Periodo</label>
        <select id="s-range" name="range">${options(RANGE_LABELS)}</select>
        <fieldset class="formats">
          <legend>Formato</legend>
          ${(Object.entries(FORMAT_LABELS) as Array<[SocialFormat, string]>)
            .map(([v, l], i) => `<label><input type="radio" name="format" value="${v}" ${i === 0 ? 'checked' : ''}> ${esc(l)}</label>`)
            .join('')}
        </fieldset>
        <fieldset>
          <legend>Cosa mettere <span class="muted small" id="s-max"></span></legend>
          <div id="s-items" class="social-items"></div>
        </fieldset>
      </form>
      <div class="social-output">
        <div id="s-slides" class="social-slides"></div>
        <div class="actions" id="s-download"></div>
        <label for="s-text">Testo</label>
        <textarea id="s-text" rows="14"></textarea>
        <div class="actions"><button type="button" id="s-copy">Copia il testo</button></div>
      </div>
    </div>`;
}

export async function bindSocial(flash: (message: string, kind?: 'ok' | 'error') => void) {
  const form = document.getElementById('social-form') as HTMLFormElement;
  const itemsBox = document.getElementById('s-items')!;
  const slidesBox = document.getElementById('s-slides')!;
  const downloads = document.getElementById('s-download')!;
  const textArea = document.getElementById('s-text') as HTMLTextAreaElement;
  const rangeSelect = form.querySelector<HTMLSelectElement>('#s-range')!;

  const res = await fetch('/admin/social-data.json');
  if (!res.ok) {
    slidesBox.innerHTML = '<p class="error">Non riesco a caricare i contenuti del sito.</p>';
    return;
  }
  const data = (await res.json()) as SocialData;
  const today = new Date().toISOString().slice(0, 10);
  let selected = new Set<string>();
  let renderId = 0;

  const state = () => {
    const f = new FormData(form);
    return {
      section: f.get('section') as SocialSection,
      range: f.get('range') as RangeKey,
      format: f.get('format') as SocialFormat,
    };
  };

  /** Elementi del periodo scelto (le promozioni: tutte quelle in corso). */
  function candidates(): { items: SocialItem[]; period: string } {
    const { section, range } = state();
    const all = data.sections[section];
    if (section === 'promotions') return { items: all.filter((i) => i.date >= today), period: '' };
    const r = dateRange(range, today);
    return { items: all.filter((i) => inRange(i, r)), period: rangeLabel(r) };
  }

  function listItems(reset: boolean) {
    const { format, section } = state();
    const { items } = candidates();
    const max = MAX_ITEMS[format];
    if (reset) selected = new Set(items.slice(0, max).map((i) => i.id));
    // nuovo formato con meno posti: tengo i primi scelti
    selected = new Set([...selected].filter((id) => items.some((i) => i.id === id)).slice(0, max));
    rangeSelect.disabled = section === 'promotions';
    form.querySelector('.range-label')!.classList.toggle('muted', section === 'promotions');
    document.getElementById('s-max')!.textContent = `(al massimo ${max})`;
    itemsBox.innerHTML = items.length
      ? items
          .map(
            (i) => `<label class="social-item"><input type="checkbox" value="${esc(i.id)}" ${selected.has(i.id) ? 'checked' : ''}>
              <span><strong>${esc(i.title)}</strong><br><span class="muted small">${esc(dateLine(i))}${i.badge ? ` · ${esc(i.badge)}` : ''}</span></span></label>`,
          )
          .join('')
      : '<p class="muted small">Niente in questo periodo: prova un periodo più lungo.</p>';
  }

  async function draw() {
    const id = ++renderId;
    const { section, format, range } = state();
    const { items, period } = candidates();
    const chosen = items.filter((i) => selected.has(i.id));
    const title = headline(section, range);
    textArea.value = chosen.length ? buildText(section, title, chosen, format, period, data.site) : '';
    if (!chosen.length) {
      slidesBox.innerHTML = '<p class="muted">Scegli almeno un elemento.</p>';
      downloads.innerHTML = '';
      return;
    }
    slidesBox.innerHTML = format === 'telegram' ? '<p class="muted">Per Telegram basta il testo qui sotto: incollalo nel canale.</p>' : '<p class="muted">Disegno…</p>';
    downloads.innerHTML = '';
    const slides = await renderSlides(format, section, title, chosen, period, data.site);
    if (id !== renderId) return; // nel frattempo è cambiato qualcosa
    if (!slides.length) return;
    slidesBox.innerHTML = '';
    slidesBox.dataset.format = format;
    const name = (n: number) => `isybook-${section}-${today}-${format}${slides.length > 1 ? `-${n + 1}` : ''}.png`;
    slides.forEach((c, n) => {
      const figure = document.createElement('figure');
      c.setAttribute('role', 'img');
      c.setAttribute('aria-label', `Anteprima ${n + 1} di ${slides.length}`);
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'secondary';
      button.textContent = slides.length > 1 ? `Scarica ${n + 1}` : 'Scarica l\'immagine';
      button.addEventListener('click', () => download(c, name(n)));
      figure.append(c, button);
      slidesBox.append(figure);
    });
    if (slides.length > 1) {
      const all = document.createElement('button');
      all.type = 'button';
      all.textContent = `Scarica tutte (${slides.length})`;
      all.addEventListener('click', async () => {
        // una alla volta: alcuni browser bloccano i download simultanei
        for (const [n, c] of slides.entries()) {
          await download(c, name(n));
          await new Promise((r) => setTimeout(r, 400));
        }
      });
      downloads.append(all);
    }
  }

  function download(c: HTMLCanvasElement, filename: string): Promise<void> {
    return new Promise((resolve) =>
      c.toBlob((blob) => {
        if (!blob) {
          flash('Immagine non esportabile', 'error');
          return resolve();
        }
        const a = document.createElement('a');
        a.href = URL.createObjectURL(blob);
        a.download = filename;
        a.click();
        setTimeout(() => URL.revokeObjectURL(a.href), 1000);
        resolve();
      }, 'image/png'),
    );
  }

  form.addEventListener('change', (e) => {
    const target = e.target as HTMLInputElement;
    if (target.type === 'checkbox') {
      const max = MAX_ITEMS[state().format];
      if (target.checked && selected.size >= max) {
        target.checked = false;
        return flash(`In questo formato ne stanno al massimo ${max}`, 'error');
      }
      if (target.checked) selected.add(target.value);
      else selected.delete(target.value);
    } else {
      listItems(target.name !== 'format');
    }
    draw();
  });

  document.getElementById('s-copy')!.addEventListener('click', async () => {
    try {
      await navigator.clipboard.writeText(textArea.value);
      flash('Testo copiato');
    } catch {
      // copia non permessa dal browser: lascio il testo selezionato, pronto per Ctrl+C
      textArea.select();
      flash('Testo selezionato: copialo con Ctrl+C', 'error');
    }
  });

  listItems(true);
  await draw();
}
