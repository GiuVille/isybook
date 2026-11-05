// Suggerimenti nel pannello, per compilare le schede più in fretta. Solo proposte: niente si spunta o si cambia da solo,
// tranne il prezzo quando il campo è ancora vuoto.
// - Opera: scelte le autrici, le serie che hanno già in catalogo (con il prossimo numero libero), i tropes già usati
//   nella serie scritta nel campo e i generi che hanno di solito.
// - Edizione: scelti editore e formato, il prezzo più usato da quell'editore per quel formato.
import { getSupabase } from '../lib/supabase';

type Row = Record<string, any>;
const esc = (s: unknown) => String(s ?? '').replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);
const norm = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim();

/** Riquadro dei suggerimenti prima (o dopo) di un elemento: creato una volta, poi riscritto. */
function box(anchor: Element, id: string, where: 'before' | 'after' = 'before'): HTMLElement {
  let el = document.getElementById(id);
  if (!el) {
    el = document.createElement('div');
    el.id = id;
    el.className = 'suggest';
    if (where === 'after') anchor.after(el);
    else anchor.before(el);
  }
  return el;
}

const checkedIn = (fieldset: Element | null) =>
  new Set([...(fieldset?.querySelectorAll<HTMLInputElement>('.m2m-list input:checked') ?? [])].map((i) => i.value));
const labelOf = (fieldset: Element | null, id: string) =>
  fieldset?.querySelector<HTMLInputElement>(`.m2m-list input[value="${CSS.escape(id)}"]`)?.parentElement?.textContent?.trim() ?? null;

/** Spunta una voce in un elenco e avvisa il menu, che aggiorna le pillole. */
function check(fieldset: Element, id: string) {
  const input = fieldset.querySelector<HTMLInputElement>(`.m2m-list input[value="${CSS.escape(id)}"]`);
  if (!input || input.checked) return;
  input.checked = true;
  fieldset.dispatchEvent(new Event('change', { bubbles: true }));
}

export function bindWorkSuggestions(form: HTMLFormElement, workId: string | null) {
  const sb = getSupabase();
  const authors = form.querySelector('fieldset[data-join="work_authors"]');
  const genres = form.querySelector('fieldset[data-join="work_genres"]');
  const tropes = form.querySelector('fieldset[data-join="work_tropes"]');
  const series = form.querySelector<HTMLInputElement>('#f-series');
  const seriesNumber = form.querySelector<HTMLInputElement>('#f-series_number');
  if (!authors || !series) return;

  // dati delle altre opere delle autrici scelte
  let other: Array<{ series: string | null; series_number: number | null; genres: string[]; tropes: string[] }> = [];

  const datalist = document.createElement('datalist');
  datalist.id = 'series-suggestions';
  series.setAttribute('list', datalist.id);
  series.after(datalist);

  const drawSeries = () => {
    const bySeries = new Map<string, { name: string; count: number; max: number }>();
    for (const w of other) {
      if (!w.series) continue;
      const k = norm(w.series);
      const s = bySeries.get(k) ?? { name: w.series, count: 0, max: 0 };
      s.count++;
      s.max = Math.max(s.max, w.series_number ?? 0);
      bySeries.set(k, s);
    }
    const list = [...bySeries.values()].sort((a, b) => b.count - a.count);
    datalist.innerHTML = list.map((s) => `<option value="${esc(s.name)}"></option>`).join('');
    const el = box(datalist, 'sg-series', 'after');
    el.innerHTML = list.length
      ? `<span class="suggest-title">Serie di questa autrice:</span> ${list
          .map((s) => `<button type="button" class="suggest-chip" data-series="${esc(s.name)}" data-next="${s.max + 1}">${esc(s.name)} <small>(${s.count} ${s.count === 1 ? 'libro' : 'libri'})</small></button>`)
          .join('')}`
      : '';
    el.hidden = !list.length;
  };

  const drawTropes = () => {
    if (!tropes) return;
    const el = box(tropes, 'sg-tropes');
    const name = norm(series.value);
    const counts = new Map<string, number>();
    if (name) for (const w of other) if (w.series && norm(w.series) === name) for (const t of w.tropes) counts.set(t, (counts.get(t) ?? 0) + 1);
    const chosen = checkedIn(tropes);
    const ids = [...counts.entries()].filter(([id]) => !chosen.has(id) && labelOf(tropes, id)).sort((a, b) => b[1] - a[1]).map(([id]) => id);
    el.innerHTML = ids.length
      ? `<span class="suggest-title">Nella serie «${esc(series.value.trim())}» hai usato:</span> ${ids
          .map((id) => `<button type="button" class="suggest-chip" data-trope="${esc(id)}">+ ${esc(labelOf(tropes, id))}</button>`)
          .join('')} <button type="button" class="suggest-all" data-all-tropes="${esc(ids.join(' '))}">Aggiungi tutti</button>`
      : '';
    el.hidden = !ids.length;
  };

  const drawGenres = () => {
    if (!genres) return;
    const el = box(genres, 'sg-genres');
    const counts = new Map<string, number>();
    for (const w of other) for (const g of w.genres) counts.set(g, (counts.get(g) ?? 0) + 1);
    const chosen = checkedIn(genres);
    const list = [...counts.entries()].filter(([id]) => !chosen.has(id) && labelOf(genres, id)).sort((a, b) => b[1] - a[1]);
    el.innerHTML = list.length
      ? `<span class="suggest-title">Di solito per questa autrice:</span> ${list
          .map(([id, n]) => `<button type="button" class="suggest-chip" data-genre="${esc(id)}">+ ${esc(labelOf(genres, id))} <small>(${n})</small></button>`)
          .join('')}`
      : '';
    el.hidden = !list.length;
  };

  const drawAll = () => {
    drawSeries();
    drawTropes();
    drawGenres();
  };

  let lastKey = '';
  const load = async () => {
    const ids = [...checkedIn(authors)];
    const key = ids.sort().join(',');
    if (key === lastKey) return drawAll();
    lastKey = key;
    if (!ids.length) {
      other = [];
      return drawAll();
    }
    const { data, error } = await sb
      .from('work_authors')
      .select('work_id, works ( id, series, series_number, work_genres ( genre_id ), work_tropes ( trope_id ) )')
      .in('author_id', ids);
    if (error) return; // i suggerimenti sono un aiuto: se la lettura fallisce, semplicemente non compaiono
    const seen = new Set<string>();
    other = (data ?? [])
      .map((r: Row) => r.works)
      .filter((w: Row | null): w is Row => {
        if (!w || w.id === workId || seen.has(w.id)) return false; // niente l'opera stessa, niente doppioni
        seen.add(w.id);
        return true;
      })
      .map((w: Row) => ({
        series: w.series ?? null,
        series_number: w.series_number ?? null,
        genres: (w.work_genres ?? []).map((g: Row) => g.genre_id),
        tropes: (w.work_tropes ?? []).map((t: Row) => t.trope_id),
      }));
    drawAll();
  };

  authors.addEventListener('change', load);
  genres?.addEventListener('change', drawGenres);
  tropes?.addEventListener('change', drawTropes);
  series.addEventListener('input', drawTropes);
  form.addEventListener('click', (e) => {
    const b = (e.target as HTMLElement).closest<HTMLButtonElement>('.suggest button');
    if (!b) return;
    if (b.dataset.series) {
      series.value = b.dataset.series;
      if (seriesNumber && !seriesNumber.value) seriesNumber.value = b.dataset.next ?? '';
      // input: aggiorna i tropes suggeriti e salva la bozza
      series.dispatchEvent(new Event('input', { bubbles: true }));
    } else if (b.dataset.trope && tropes) check(tropes, b.dataset.trope);
    else if (b.dataset.allTropes && tropes) b.dataset.allTropes.split(' ').forEach((id) => check(tropes, id));
    else if (b.dataset.genre && genres) check(genres, b.dataset.genre);
  });
  load();
}

const FORMAT_NAMES: Record<string, string> = { paperback: 'la brossura', hardcover: 'la copertina rigida', kindle: 'il Kindle', audio: "l'audiolibro" };

export function bindPriceSuggestion(form: HTMLFormElement) {
  const sb = getSupabase();
  const publisher = form.querySelector<HTMLSelectElement>('#f-publisher_id');
  const format = form.querySelector<HTMLSelectElement>('#f-format');
  const price = form.querySelector<HTMLInputElement>('#f-price');
  if (!publisher || !format || !price) return;
  const note = document.createElement('div');
  note.className = 'suggest';
  note.hidden = true;
  price.closest('.field')!.append(note);

  const update = async () => {
    note.hidden = true;
    if (!publisher.value || !format.value) return;
    const { data, error } = await sb.from('editions').select('price').eq('publisher_id', publisher.value).eq('format', format.value).not('price', 'is', null);
    if (error || !data?.length) return;
    const counts = new Map<number, number>();
    for (const r of data) counts.set(Number(r.price), (counts.get(Number(r.price)) ?? 0) + 1);
    const [best, n] = [...counts.entries()].sort((a, b) => b[1] - a[1] || b[0] - a[0])[0];
    const euro = best.toLocaleString('it-IT', { style: 'currency', currency: 'EUR' });
    const name = publisher.selectedOptions[0]?.text ?? 'questo editore';
    const filled = !price.value;
    if (filled) {
      price.value = String(best);
      price.dispatchEvent(new Event('input', { bubbles: true })); // anche nella bozza
    }
    note.innerHTML = `${filled ? 'Ho messo' : 'Suggerito:'} il prezzo più usato da ${esc(name)} per ${FORMAT_NAMES[format.value] ?? 'questo formato'}: <strong>${esc(euro)}</strong> <small>(${n} ${n === 1 ? 'edizione' : 'edizioni'})</small>${
      filled || Number(price.value) === best ? '' : ` <button type="button" class="suggest-chip" data-price="${best}">Usa questo</button>`
    }`;
    note.hidden = false;
  };
  note.addEventListener('click', (e) => {
    const b = (e.target as HTMLElement).closest<HTMLButtonElement>('[data-price]');
    if (!b) return;
    price.value = b.dataset.price!;
    price.dispatchEvent(new Event('input', { bubbles: true }));
    b.remove();
  });
  publisher.addEventListener('change', update);
  format.addEventListener('change', update);
  update();
}
