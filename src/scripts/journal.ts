// Book journal: apertura dell'agendina, indice, scheda e recensione di ogni libro, moodboard,
// personalizzazione e condivisione. Dati in src/lib/journal.ts; stili in src/styles/journal.css.
import { esc } from '../lib/book-card';
import { loadCatalog, type Catalog, type CatalogBook } from '../lib/catalog';
import { DOODLE_LABELS, doodlePath } from '../lib/doodles';
import {
  ACCENTS,
  COVER_COLORS,
  INKS,
  RATING_LABELS,
  createEntry,
  deleteEntry,
  deletePhoto,
  getJournal,
  getPhoto,
  isRead,
  newMoodId,
  onJournalChange,
  progress,
  sagaOf,
  savePhoto,
  updateEntry,
  updateSettings,
  type JournalEntry,
  type JournalSettings,
  type MoodItem,
  type RatingKey,
  type Saga,
} from '../lib/journal';
import { TBR_ID, getLibrary, removeFromCollection } from '../lib/library';
import { reducedMotion } from './reveal';
import { heartBurst } from './celebrate';
import { openShare } from './journal-share';

const STAR = 'M12 2.8l2.8 5.9 6.4.8-4.7 4.4 1.2 6.4L12 17.2l-5.7 3.1 1.2-6.4L2.8 9.5l6.4-.8Z';
const FORMAT_ICONS: Record<string, [string, string]> = {
  paper: ['📖', 'Cartaceo'],
  ebook: ['📱', 'Ebook'],
  audio: ['🎧', 'Audiolibro'],
};
const KINDS: Array<[string, string]> = [['standalone', 'Autoconclusivo'], ['sequel', 'Sequel'], ['prequel', 'Prequel'], ['spinoff', 'Spin-off'], ['midquel', 'Midquel']];
const SOURCES: Array<[string, string]> = [['bought', 'Comprato'], ['gift', 'Regalato'], ['borrowed', 'Prestato']];
const STICKERS = Object.keys(DOODLE_LABELS);
const svgIcon = (name: string, cls = '') => {
  const d = doodlePath(name);
  return d ? `<svg class="${cls}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="${d}"/></svg>` : '';
};

export function initJournal(section: HTMLElement) {
  const root = section.querySelector<HTMLElement>('.journal')!;
  const cover = root.querySelector<HTMLButtonElement>('.journal-cover')!;
  const book = root.querySelector<HTMLElement>('.journal-book')!;
  const left = root.querySelector<HTMLElement>('.jleft')!;
  const right = root.querySelector<HTMLElement>('.jright')!;
  const saved = root.querySelector<HTMLElement>('.journal-saved')!;
  const nav = {
    prev: root.querySelector<HTMLButtonElement>('.jnav-prev')!,
    next: root.querySelector<HTMLButtonElement>('.jnav-next')!,
    index: root.querySelector<HTMLButtonElement>('.jnav-index')!,
    where: root.querySelector<HTMLElement>('.jnav-where')!,
    close: root.querySelector<HTMLButtonElement>('.jnav-close')!,
  };
  let catalog: Catalog | null = null;
  let current: string | null = null; // id della scheda aperta, null = indice
  // sul telefono si vede una pagina alla volta: sinistra (indice o scheda) o destra (nuovo libro o recensione)
  let side: 'left' | 'right' = 'left';
  const narrowQuery = window.matchMedia('(max-width: 760px)');
  const narrow = () => narrowQuery.matches;
  let selectedMood: string | null = null;
  const photoUrls = new Map<string, string>();

  const entries = () => getJournal().entries.slice().sort((a, b) => a.n - b.n);
  const entry = () => getJournal().entries.find((e) => e.id === current) ?? null;
  const bookOf = (slug: string | null) => (slug && catalog ? catalog.books.find((b) => b.slug === slug) ?? null : null);
  const saga = (e: JournalEntry): Saga | null => (catalog ? sagaOf(e, catalog.books, getJournal().entries) : null);
  const celebrated = new Set<string>(); // saghe già festeggiate in questa visita

  // ---------------------------------------------------------------- aspetto
  function applySettings(s: JournalSettings = getJournal().settings) {
    root.style.setProperty('--cover', COVER_COLORS.find((c) => c.id === s.cover)!.value);
    root.style.setProperty('--band', s.band);
    root.style.setProperty('--ribbon', s.ribbon);
    root.style.setProperty('--ink', INKS.find((c) => c.id === s.ink)!.value);
    root.style.setProperty('--jfont', s.hand ? 'var(--font-hand)' : 'var(--font-text)');
    root.dataset.material = s.material;
    root.dataset.paper = s.paper;
    root.querySelector('.cover-name')!.textContent = s.name || 'Book journal';
    root.querySelector('.cover-sticker')!.innerHTML = s.sticker ? svgIcon(s.sticker) : '';
    root.querySelector('.journal-charm')!.innerHTML = s.charm ? svgIcon(s.charm) : '';
    const all = getJournal().entries;
    const read = all.filter(isRead).length;
    root.querySelector('.cover-count')!.textContent = all.length
      ? `${read} ${read === 1 ? 'libro letto' : 'libri letti'} · ${all.length - read} in lettura`
      : 'Ancora vuoto: aprilo e aggiungi il primo libro';
  }

  // ---------------------------------------------------------------- apertura
  const DURATION = 900;
  // Sulla copertina (3D, preserve-3d) si anima solo la rotazione: un'opacità animata la "appiattisce" e
  // Edge/Chrome smettono di nascondere il retro, mostrando il fronte a specchio. La dissolvenza la fa l'interno.
  const coverBack = cover.querySelector<HTMLElement>('.cover-back')!;
  const EASE = 'cubic-bezier(0.45, 0, 0.2, 1)';
  async function open() {
    if (root.dataset.state !== 'closed') return;
    root.dataset.state = 'opening';
    cover.setAttribute('aria-expanded', 'true');
    render();
    if (!reducedMotion()) {
      const wide = window.matchMedia('(min-width: 761px)').matches;
      const anims = [
        cover.animate([{ transform: 'rotateY(0)' }, { transform: 'rotateY(-180deg)' }], { duration: DURATION, easing: EASE }),
        // l'interno della copertina copre la pagina sinistra e si dissolve solo alla fine, scoprendola
        coverBack.animate([{ opacity: 1 }, { opacity: 1, offset: 0.7 }, { opacity: 0 }], { duration: DURATION }),
        left.animate([{ opacity: 0 }, { opacity: 0, offset: 0.55 }, { opacity: 1 }], { duration: DURATION }),
      ];
      if (wide) anims.push(book.animate([{ transform: 'translateX(-25%)' }, { transform: 'none' }], { duration: DURATION, easing: EASE }));
      await Promise.all(anims.map((a) => a.finished));
    }
    root.dataset.state = 'open';
    nav.index.focus({ preventScroll: true });
  }

  async function close() {
    if (root.dataset.state !== 'open') return;
    root.dataset.state = 'closing';
    if (!reducedMotion()) {
      const wide = window.matchMedia('(min-width: 761px)').matches;
      const anims = [
        cover.animate([{ transform: 'rotateY(-180deg)' }, { transform: 'rotateY(0)' }], { duration: DURATION, easing: EASE }),
        coverBack.animate([{ opacity: 0 }, { opacity: 1, offset: 0.25 }, { opacity: 1 }], { duration: DURATION }),
        // la pagina sinistra sparisce mentre la copertina ci passa sopra, così non resta scoperta fino alla fine
        left.animate([{ opacity: 1 }, { opacity: 0, offset: 0.25 }, { opacity: 0 }], { duration: DURATION, fill: 'forwards' }),
      ];
      if (wide) anims.push(book.animate([{ transform: 'none' }, { transform: 'translateX(-25%)' }], { duration: DURATION, easing: EASE }));
      await Promise.all(anims.map((a) => a.finished));
      anims.forEach((a) => a.cancel()); // tolgo l'opacità lasciata da fill, alla prossima apertura riparte pulita
    }
    root.dataset.state = 'closed';
    cover.setAttribute('aria-expanded', 'false');
    applySettings();
    cover.focus({ preventScroll: true });
  }

  // ---------------------------------------------------------------- navigazione
  function turn(direction: 'next' | 'prev') {
    if (reducedMotion()) return;
    // su computer gira la pagina destra (avanti) o sinistra (indietro); sul telefono quella visibile
    const page = narrow() ? (side === 'left' ? left : right) : direction === 'next' ? right : left;
    const other = page === left ? right : left;
    page.classList.remove('turn-next', 'turn-prev', 'fade-in');
    other.classList.remove('turn-next', 'turn-prev', 'fade-in');
    void page.offsetWidth; // riparte l'animazione
    page.classList.add(direction === 'next' ? 'turn-next' : 'turn-prev');
    if (!narrow()) other.classList.add('fade-in');
  }

  function go(id: string | null, direction: 'next' | 'prev' = 'next', toSide: 'left' | 'right' = 'left') {
    current = id;
    selectedMood = null;
    side = toSide;
    render();
    left.scrollTop = 0;
    right.scrollTop = 0;
    turn(direction);
  }

  function step(delta: 1 | -1) {
    // telefono: prima si gira la pagina dentro la stessa doppia pagina
    if (narrow() && ((delta > 0 && side === 'left') || (delta < 0 && side === 'right'))) {
      side = delta > 0 ? 'right' : 'left';
      root.dataset.side = side;
      (side === 'left' ? left : right).scrollTop = 0;
      updateNav();
      return turn(delta > 0 ? 'next' : 'prev');
    }
    const ids = [null, ...entries().map((e) => e.id)];
    const i = ids.indexOf(current);
    const target = ids[i + delta];
    if (target !== undefined) go(target, delta > 0 ? 'next' : 'prev', narrow() && delta < 0 ? 'right' : 'left');
  }

  function updateNav() {
    root.dataset.side = side;
    const list = entries();
    const i = current ? list.findIndex((e) => e.id === current) + 1 : 0;
    const small = narrow();
    nav.prev.disabled = i === 0 && (!small || side === 'left');
    nav.next.disabled = i >= list.length && (!small || side === 'right');
    const page = small ? (current ? (side === 'left' ? ' · scheda' : ' · recensione') : '') : '';
    nav.where.textContent = current ? `${i} di ${list.length}${page}` : small && side === 'right' ? 'Nuovo libro' : 'Indice';
  }
  narrowQuery.addEventListener('change', updateNav);

  // ---------------------------------------------------------------- pagine
  function render() {
    applySettings();
    const e = entry();
    if (!e) {
      current = null;
      left.innerHTML = indexHtml();
      right.innerHTML = addHtml();
      renderResults('');
    } else {
      left.innerHTML = sheetHtml(e);
      right.innerHTML = reviewHtml(e);
      renderMood(e);
      const done = left.querySelector<HTMLElement>('[data-saga-done]');
      if (done && !celebrated.has(done.dataset.sagaDone!)) {
        celebrated.add(done.dataset.sagaDone!);
        heartBurst(done, '★', '#e2a92b');
      }
    }
    updateNav();
  }

  const coverHtml = (e: Pick<JournalEntry, 'cover' | 'color' | 'title'>, cls = '') =>
    e.cover
      ? `<img class="${cls}" src="${esc(e.cover)}" alt="" loading="lazy">`
      : `<span class="${cls} ph" style="--c:${esc(e.color)}">${cls === 'mini' ? '' : esc(e.title)}</span>`;

  function indexHtml(): string {
    const list = entries();
    return `<h3>Indice</h3>
      ${
        list.length
          ? `<ol class="jindex">${list
              .map((e) => {
                const p = progress(e);
                const state = isRead(e) ? (e.ratings.overall ? `★ ${e.ratings.overall}` : 'letto ✓') : p != null ? `${p}%` : 'in lettura';
                return `<li><button type="button" data-open="${esc(e.id)}">
                  <span class="n">${e.n}.</span>${coverHtml(e, 'mini')}
                  <span class="t">${esc(e.title)}${(() => {
                    const s = saga(e);
                    return s?.position ? ` <em class="jsaga-n">${s.position}/${s.total}</em>` : '';
                  })()}<small>${esc(e.author)}</small></span>
                  <span class="state">${esc(state)}</span></button></li>`;
              })
              .join('')}</ol>`
          : `<p class="jempty">Ancora nessun libro. ${narrow() ? 'Gira pagina e scegli il primo.' : 'Scegline uno qui accanto e inizia a scrivere.'}</p>`
      }
      <button type="button" class="jbtn jgo-add" data-go-add>+ Nuovo libro</button>`;
  }

  function addHtml(): string {
    return `<div class="jadd">
      <h3>Nuovo libro</h3>
      <label class="jlabel" for="jsearch">Cerca nel catalogo</label>
      <input type="search" id="jsearch" placeholder="Titolo o autore…" autocomplete="off">
      <ul class="jresults" aria-label="Libri trovati"></ul>
      <p class="or">…oppure un libro che non è nel catalogo</p>
      <form class="jfree">
        <label class="jlabel" for="jfree-title">Titolo</label>
        <input type="text" id="jfree-title" required maxlength="200">
        <label class="jlabel" for="jfree-author">Autore</label>
        <input type="text" id="jfree-author" maxlength="200">
        <button class="jbtn">Aggiungi al journal</button>
      </form>
    </div>`;
  }

  function renderResults(query: string) {
    const list = right.querySelector<HTMLElement>('.jresults');
    if (!list) return;
    if (!catalog) {
      list.innerHTML = '<li class="muted">Carico il catalogo…</li>';
      return;
    }
    const q = query.trim().toLowerCase();
    const found = catalog.books
      .filter((b) => !q || b.title.toLowerCase().includes(q) || b.authors.some((a) => a.toLowerCase().includes(q)))
      .slice(0, 12);
    list.innerHTML = found.length
      ? found
          .map(
            (b) => `<li><button type="button" data-pick="${esc(b.slug)}">
              ${b.cover ? `<img src="${esc(b.cover)}" alt="" loading="lazy">` : `<span class="ph" style="--c:${esc(b.color)}"></span>`}
              <span><strong>${esc(b.title)}</strong><br><small>${esc(b.authors.join(', '))}</small></span></button></li>`,
          )
          .join('')
      : '<li class="muted">Nessun libro trovato: aggiungilo qui sotto.</li>';
  }

  /** Nuova scheda da un libro del catalogo (o apre quella che c'è già). */
  function addFromCatalog(slug: string) {
    const existing = getJournal().entries.find((e) => e.slug === slug);
    if (existing) return go(existing.id);
    const b = bookOf(slug);
    if (!b) return;
    const created = createEntry(fromBook(b));
    go(created.id);
    const inTbr = getLibrary().collections.find((c) => c.id === TBR_ID)?.slugs.includes(slug);
    if (inTbr && confirm(`«${b.title}» è nella tua TBR: vuoi toglierlo ora che hai iniziato a leggerlo?`)) removeFromCollection(TBR_ID, slug);
  }

  const fromBook = (b: CatalogBook): Partial<JournalEntry> & { title: string } => ({
    slug: b.slug,
    title: b.title,
    author: b.authors.join(', '),
    genre: b.genres[0]?.name ?? '',
    publisher: b.publisher ?? '',
    cover: b.cover,
    color: b.color,
    totalPages: b.pages,
    kind: b.series ? (b.seriesNumber && b.seriesNumber > 1 ? 'sequel' : null) : 'standalone',
    tropes: b.tropes.map((t) => t.name),
  });

  const radios = (field: string, options: Array<[string, string]>, value: string | null, cls = '') =>
    `<fieldset class="jchoices ${cls}"><legend class="jlabel">${esc(cls === 'jformats' ? 'Formato' : field === 'kind' ? 'Tipo' : 'Come è arrivato')}</legend>${options
      .map(
        ([v, l]) =>
          `<label><input type="radio" name="j-${field}" value="${v}" data-field="${field}" ${value === v ? 'checked' : ''}>${l}</label>`,
      )
      .join('')}</fieldset>`;

  function stars(key: RatingKey, value: number): string {
    const star = (i: number) => {
      const fill = Math.max(0, Math.min(1, value - (i - 1))) * 100;
      return `<span class="jstar">
        <svg viewBox="0 0 24 24" fill="none" stroke="#b9b4c4" stroke-width="1.5" aria-hidden="true"><path d="${STAR}"/></svg>
        <span class="clip" style="--fill:${fill}%"><svg class="on" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="${STAR}"/></svg></span>
        <input type="radio" id="r-${key}-${i * 2 - 1}" name="r-${key}" value="${i - 0.5}" data-rating="${key}" aria-label="${RATING_LABELS[key]}: ${i - 0.5} stelle" ${value === i - 0.5 ? 'checked' : ''}><label class="l" for="r-${key}-${i * 2 - 1}" title="${i - 0.5}"></label>
        <input type="radio" id="r-${key}-${i * 2}" name="r-${key}" value="${i}" data-rating="${key}" aria-label="${RATING_LABELS[key]}: ${i} stelle" ${value === i ? 'checked' : ''}><label class="r" for="r-${key}-${i * 2}" title="${i}"></label>
      </span>`;
    };
    return `<fieldset class="jrating"><legend>${RATING_LABELS[key]}</legend><div class="jstars">${[1, 2, 3, 4, 5].map(star).join('')}</div>
      ${value ? `<button type="button" class="jrating-clear" data-clear="${key}">azzera</button>` : ''}</fieldset>`;
  }

  function sheetHtml(e: JournalEntry): string {
    const p = progress(e);
    const suggested = bookOf(e.slug)?.tropes.map((t) => t.name) ?? [];
    const allTropes = [...new Set([...suggested, ...e.tropes])];
    const input = (field: keyof JournalEntry, label: string, type = 'text') =>
      `<div><label class="jlabel" for="j-${field}">${label}</label><input type="${type}" id="j-${field}" data-field="${field}" value="${esc(e[field] ?? '')}" ${
        type === 'number' ? 'min="0" inputmode="numeric"' : ''
      }></div>`;
    return `
      <span class="jpage-ribbon" aria-hidden="true"></span>
      <div class="jsheet-top">
        <div class="jsheet-cover"><span class="jsheet-n">N. ${e.n}</span>${coverHtml(e)}</div>
        <div class="jfields">
          ${input('title', 'Titolo')}
          ${input('author', 'Autore')}
          ${input('genre', 'Genere')}
          <div class="jrow">${input('startedOn', 'Inizio', 'date')}${input('finishedOn', 'Fine', 'date')}</div>
        </div>
      </div>
      <div class="jblock jrow">
        ${input('publisher', 'Casa editrice')}
        ${input('totalPages', 'Tot. pagine', 'number')}
        ${input('favoriteCharacter', 'Personaggio preferito')}
        ${input('favoriteChapter', 'Capitolo preferito')}
      </div>
      <div class="jblock">
        <div class="jprogress">
          <label for="j-currentPage">Sono a pagina</label>
          <input type="number" id="j-currentPage" data-field="currentPage" min="0" inputmode="numeric" value="${esc(e.currentPage ?? '')}">
          <span>di ${e.totalPages ?? '…'}</span>
          <span class="jpercent">${p != null ? `${p}%` : ''}</span>
          ${isRead(e) ? '' : '<button type="button" class="jbtn soft" data-finish>Finito!</button>'}
          <span class="jbar" aria-hidden="true"><span style="--p:${(p ?? 0) / 100}"></span></span>
        </div>
      </div>
      ${sagaHtml(e)}
      <div class="jblock">
        ${radios('format', Object.entries(FORMAT_ICONS).map(([v, [icon, label]]) => [v, `${icon}<span class="sr">${label}</span>`]), e.format, 'jformats')}
        ${radios('kind', KINDS, e.kind)}
        ${radios('source', SOURCES, e.source)}
      </div>
      <div class="jblock">
        <span class="jlabel">Tropes</span>
        <div class="jtropes">${allTropes
          .map((t) => `<button type="button" data-trope="${esc(t)}" aria-pressed="${e.tropes.includes(t)}">${esc(t)}</button>`)
          .join('')}</div>
        <form class="jtrope-add"><input type="text" maxlength="60" placeholder="Aggiungi un trope…" aria-label="Aggiungi un trope"><button class="jbtn soft">+</button></form>
      </div>
      <div class="jblock jrow">
        <div><label class="jlabel" for="j-moments">Momenti</label><textarea id="j-moments" data-field="moments" rows="3">${esc(e.moments)}</textarea></div>
        <div><label class="jlabel" for="j-quotes">Frasi</label><textarea id="j-quotes" data-field="quotes" rows="3">${esc(e.quotes)}</textarea></div>
      </div>
      <div class="jratings">${(Object.keys(RATING_LABELS) as RatingKey[]).map((k) => stars(k, e.ratings[k])).join('')}</div>`;
  }

  /** Saga del libro: numero, completamento, copertine in ordine e prossima lettura. */
  function sagaHtml(e: JournalEntry): string {
    const s = saga(e);
    if (!s) return '';
    const cover = (b: { cover: string | null; color: string; title: string }) =>
      b.cover ? `<img src="${esc(b.cover)}" alt="" loading="lazy">` : `<span class="ph" style="--c:${esc(b.color)}"></span>`;
    const next = s.next;
    return `<div class="jblock jsaga">
      <p class="jsaga-title">Saga «${esc(s.name)}»${s.position ? ` · libro <strong>${s.position}/${s.total}</strong>` : ''}</p>
      <div class="jsaga-progress">
        <span class="jbar" aria-hidden="true"><span style="--p:${s.percent / 100}"></span></span>
        <span>${s.read} di ${s.total} ${s.read === 1 ? 'letto' : 'letti'} · <span class="jpercent">${s.percent}%</span></span>
      </div>
      <ol class="jsaga-books" aria-label="Libri della saga in ordine">${s.books
        .map(
          (b) => `<li class="${b.read ? 'is-read' : ''} ${b.slug === e.slug ? 'is-current' : ''}">${cover(b)}<span>${b.number ?? '?'}</span><span class="sr">${esc(b.title)}${
            b.read ? ', letto' : ''
          }</span></li>`,
        )
        .join('')}</ol>
      ${
        next
          ? `<div class="jsaga-next">
              ${cover(next)}
              <div><span class="jlabel">Prossima lettura</span>
                <a href="/libri/${esc(next.slug)}">${next.number ? `${next.number}. ` : ''}${esc(next.title)}</a>
                <button type="button" class="jbtn soft" ${next.entryId ? `data-open="${esc(next.entryId)}">Apri la scheda` : `data-pick="${esc(next.slug)}">Aggiungi al journal`}</button>
              </div>
            </div>`
          : s.read === s.total
            ? `<p class="jsaga-done" data-saga-done="${esc(s.name)}">Saga completata! ★</p>`
            : ''
      }
    </div>`;
  }

  function reviewHtml(e: JournalEntry): string {
    return `
      <div class="jreview">
        <h3>Recensione</h3>
        <label class="jlabel" for="j-review">Cosa ne pensi</label>
        <textarea id="j-review" data-field="review" rows="9">${esc(e.review)}</textarea>
      </div>
      <h3>Moodboard</h3>
      <div class="jmood" aria-label="Moodboard: trascina foto e adesivi"></div>
      <div class="jmood-tools">
        <label class="jphoto-add">+ Foto<input type="file" accept="image/*" hidden></label>
        <button type="button" data-stickers aria-expanded="false">+ Adesivo</button>
        <span class="jsel" hidden>
          <button type="button" data-mood="rotate-left" aria-label="Ruota a sinistra">↺</button>
          <button type="button" data-mood="rotate-right" aria-label="Ruota a destra">↻</button>
          <button type="button" data-mood="smaller" aria-label="Rimpicciolisci">−</button>
          <button type="button" data-mood="bigger" aria-label="Ingrandisci">+</button>
          <button type="button" data-mood="remove">Togli</button>
        </span>
      </div>
      <div class="jstickers" hidden>${STICKERS.map((s) => `<button type="button" data-sticker="${s}" title="${esc(DOODLE_LABELS[s as keyof typeof DOODLE_LABELS])}">${svgIcon(s)}</button>`).join('')}</div>
      <div class="jfoot">
        <button type="button" class="jbtn" data-share>Condividi come immagine</button>
        <button type="button" class="jbtn danger" data-delete>Elimina scheda</button>
      </div>`;
  }

  // ---------------------------------------------------------------- moodboard
  async function photoUrl(ref: string): Promise<string | null> {
    if (photoUrls.has(ref)) return photoUrls.get(ref)!;
    try {
      const blob = await getPhoto(ref);
      if (!blob) return null;
      const url = URL.createObjectURL(blob);
      photoUrls.set(ref, url);
      return url;
    } catch {
      return null;
    }
  }

  function renderMood(e: JournalEntry, fresh?: string) {
    const board = right.querySelector<HTMLElement>('.jmood');
    if (!board) return;
    board.innerHTML = e.moodboard.length ? '' : '<p class="jmood-empty">Moodboard</p>';
    for (const m of e.moodboard) {
      const el = document.createElement('button');
      el.type = 'button';
      el.className = `jmood-item ${m.type}${m.id === selectedMood ? ' is-selected' : ''}${m.id === fresh ? ' is-new' : ''}`;
      el.dataset.id = m.id;
      el.style.cssText = `--x:${m.x}%;--y:${m.y}%;--r:${m.rotate}deg;--s:${m.scale}`;
      el.setAttribute('aria-label', m.type === 'photo' ? 'Foto della moodboard' : `Adesivo: ${DOODLE_LABELS[m.ref as keyof typeof DOODLE_LABELS] ?? m.ref}`);
      if (m.type === 'sticker') el.innerHTML = svgIcon(m.ref);
      else
        photoUrl(m.ref).then((url) => {
          if (url) el.innerHTML = `<img src="${url}" alt="">`;
        });
      board.append(el);
    }
    const sel = right.querySelector<HTMLElement>('.jsel');
    if (sel) sel.hidden = !selectedMood;
  }

  function addMood(type: MoodItem['type'], ref: string) {
    const e = entry();
    if (!e) return;
    const item: MoodItem = { id: newMoodId(), type, ref, x: 25 + Math.random() * 50, y: 30 + Math.random() * 40, rotate: Math.round((Math.random() - 0.5) * 20), scale: 1 };
    selectedMood = item.id;
    updateEntry(e.id, { moodboard: [...e.moodboard, item] });
    renderMood(entry()!, item.id);
  }

  function changeMood(change: (m: MoodItem) => MoodItem | null) {
    const e = entry();
    if (!e || !selectedMood) return;
    const moodboard = e.moodboard.flatMap((m) => {
      if (m.id !== selectedMood) return [m];
      const next = change(m);
      if (!next && m.type === 'photo') deletePhoto(m.ref).catch(() => {});
      return next ? [next] : [];
    });
    if (!moodboard.some((m) => m.id === selectedMood)) selectedMood = null;
    updateEntry(e.id, { moodboard });
    renderMood(entry()!);
  }

  // trascinamento con il dito o il mouse (posizioni in % così la moodboard resta uguale a ogni larghezza)
  let drag: { id: string; el: HTMLElement; board: DOMRect; dx: number; dy: number; moved: boolean } | null = null;
  right.addEventListener('pointerdown', (ev) => {
    const el = (ev.target as HTMLElement).closest<HTMLElement>('.jmood-item');
    if (!el) return;
    const board = el.parentElement!.getBoundingClientRect();
    const r = el.getBoundingClientRect();
    drag = { id: el.dataset.id!, el, board, dx: ev.clientX - (r.left + r.width / 2), dy: ev.clientY - (r.top + r.height / 2), moved: false };
    el.setPointerCapture(ev.pointerId);
  });
  right.addEventListener('pointermove', (ev) => {
    if (!drag) return;
    drag.moved = true;
    const x = Math.min(100, Math.max(0, ((ev.clientX - drag.dx - drag.board.left) / drag.board.width) * 100));
    const y = Math.min(100, Math.max(0, ((ev.clientY - drag.dy - drag.board.top) / drag.board.height) * 100));
    drag.el.style.setProperty('--x', `${x}%`);
    drag.el.style.setProperty('--y', `${y}%`);
  });
  right.addEventListener('pointerup', () => {
    if (!drag) return;
    const { id, el, moved } = drag;
    drag = null;
    selectedMood = id;
    if (moved) {
      const x = parseFloat(el.style.getPropertyValue('--x'));
      const y = parseFloat(el.style.getPropertyValue('--y'));
      changeMood((m) => ({ ...m, x, y }));
    } else renderMood(entry()!);
  });

  // ---------------------------------------------------------------- salvataggio
  let savedTimer = 0;
  function showSaved() {
    saved.textContent = 'Salvato ✓';
    saved.classList.add('is-on');
    clearTimeout(savedTimer);
    savedTimer = window.setTimeout(() => saved.classList.remove('is-on'), 1400);
  }
  const timers = new Map<string, number>();
  function saveField(field: string, raw: string) {
    const e = entry();
    if (!e) return;
    const value = ['totalPages', 'currentPage'].includes(field) ? (raw === '' ? null : Math.max(0, Number(raw))) : raw;
    clearTimeout(timers.get(field));
    timers.set(
      field,
      window.setTimeout(() => {
        updateEntry(e.id, { [field]: value } as Partial<JournalEntry>);
        showSaved();
        if (['totalPages', 'currentPage', 'finishedOn'].includes(field)) refreshProgress();
      }, 400),
    );
  }

  /** Aggiorna barra, percentuale e segnalibro senza ridisegnare i campi (il cursore resta dov'è). */
  function refreshProgress() {
    const e = entry();
    if (!e) return;
    const p = progress(e) ?? 0;
    left.querySelector<HTMLElement>('.jbar span')?.style.setProperty('--p', String(p / 100));
    const pct = left.querySelector('.jpercent');
    if (pct) pct.textContent = progress(e) != null ? `${p}%` : '';
    const of = left.querySelector('.jprogress > span');
    if (of) of.textContent = `di ${e.totalPages ?? '…'}`;
    if (isRead(e)) left.querySelector('[data-finish]')?.remove();
  }

  function finish() {
    const e = entry();
    if (!e) return;
    const today = new Date().toISOString().slice(0, 10);
    updateEntry(e.id, { finishedOn: e.finishedOn || today, currentPage: e.totalPages ?? e.currentPage });
    render();
    const button = left.querySelector<HTMLElement>('.jpercent');
    if (button) heartBurst(button, '★', '#e2a92b');
    if (e.slug && getLibrary().collections.find((c) => c.id === TBR_ID)?.slugs.includes(e.slug)) {
      if (confirm(`Hai finito «${e.title}»: lo tolgo dalla TBR?`)) removeFromCollection(TBR_ID, e.slug);
    }
  }

  // ---------------------------------------------------------------- eventi
  cover.addEventListener('click', open);
  nav.close.addEventListener('click', close);
  nav.index.addEventListener('click', () => go(null, 'prev'));
  nav.prev.addEventListener('click', () => step(-1));
  nav.next.addEventListener('click', () => step(1));
  root.addEventListener('keydown', (ev) => {
    if (root.dataset.state !== 'open' || (ev.target as HTMLElement).matches('input, textarea')) return;
    if (ev.key === 'ArrowRight') step(1);
    if (ev.key === 'ArrowLeft') step(-1);
    if (ev.key === 'Escape') close();
  });
  // scorrimento orizzontale con il dito sulle pagine (fuori dalla moodboard)
  let swipeX: number | null = null;
  book.addEventListener('touchstart', (ev) => {
    swipeX = (ev.target as HTMLElement).closest('.jmood, input, textarea') ? null : ev.touches[0].clientX;
  }, { passive: true });
  book.addEventListener('touchend', (ev) => {
    if (swipeX == null) return;
    const dx = ev.changedTouches[0].clientX - swipeX;
    if (Math.abs(dx) > 70) step(dx < 0 ? 1 : -1);
    swipeX = null;
  });

  for (const page of [left, right]) {
    page.addEventListener('input', (ev) => {
      const t = ev.target as HTMLInputElement;
      if (t.id === 'jsearch') return renderResults(t.value);
      if (t.dataset.field && t.type !== 'radio') saveField(t.dataset.field, t.value);
    });
    page.addEventListener('change', (ev) => {
      const t = ev.target as HTMLInputElement;
      const e = entry();
      if (!e) return;
      if (t.type === 'radio' && t.dataset.field) {
        updateEntry(e.id, { [t.dataset.field]: t.value } as Partial<JournalEntry>);
        showSaved();
      }
      if (t.dataset.rating) {
        const key = t.dataset.rating as RatingKey;
        updateEntry(e.id, { ratings: { ...e.ratings, [key]: Number(t.value) } });
        const fieldset = t.closest('.jrating')!;
        fieldset.outerHTML = stars(key, Number(t.value));
        left.querySelectorAll<HTMLElement>(`[data-rating="${key}"]`).forEach((i) => i.closest('.jstar')?.querySelector('.on')?.classList.add('pop'));
        left.querySelector<HTMLInputElement>(`[data-rating="${key}"][value="${t.value}"]`)?.focus();
        showSaved();
      }
      if (t.type === 'file' && t.files?.[0]) {
        savePhoto(t.files[0])
          .then((id) => addMood('photo', id))
          .catch(() => alert('Non riesco a salvare la foto su questo browser: prova con un adesivo.'));
        t.value = '';
      }
    });
    page.addEventListener('click', (ev) => {
      const t = (ev.target as HTMLElement).closest<HTMLElement>('button, [data-open]');
      if (!t) return;
      const e = entry();
      if (t.dataset.open) return go(t.dataset.open);
      if (t.dataset.goAdd !== undefined) return step(1); // telefono: dall'indice alla pagina "Nuovo libro"
      if (t.dataset.pick) return addFromCatalog(t.dataset.pick);
      if (!e) return;
      if (t.dataset.finish !== undefined) return finish();
      if (t.dataset.trope) {
        const on = e.tropes.includes(t.dataset.trope);
        updateEntry(e.id, { tropes: on ? e.tropes.filter((x) => x !== t.dataset.trope) : [...e.tropes, t.dataset.trope] });
        t.setAttribute('aria-pressed', String(!on));
        return showSaved();
      }
      if (t.dataset.clear) {
        const key = t.dataset.clear as RatingKey;
        updateEntry(e.id, { ratings: { ...e.ratings, [key]: 0 } });
        t.closest('.jrating')!.outerHTML = stars(key, 0);
        return showSaved();
      }
      if (t.dataset.stickers !== undefined) {
        const box = right.querySelector<HTMLElement>('.jstickers')!;
        box.hidden = !box.hidden;
        t.setAttribute('aria-expanded', String(!box.hidden));
        return;
      }
      if (t.dataset.sticker) return addMood('sticker', t.dataset.sticker);
      if (t.dataset.mood) {
        const action = t.dataset.mood;
        return changeMood((m) =>
          action === 'remove'
            ? null
            : {
                ...m,
                rotate: m.rotate + (action === 'rotate-left' ? -15 : action === 'rotate-right' ? 15 : 0),
                scale: Math.min(2, Math.max(0.5, m.scale + (action === 'bigger' ? 0.15 : action === 'smaller' ? -0.15 : 0))),
              },
        );
      }
      if (t.dataset.share !== undefined) return openShare(section, e, getJournal().settings, saga(e));
      if (t.dataset.delete !== undefined && confirm(`Eliminare la scheda di «${e.title}»? Recensione e moodboard andranno perse.`)) {
        deleteEntry(e.id);
        go(null, 'prev');
      }
    });
    page.addEventListener('submit', (ev) => {
      ev.preventDefault();
      const form = ev.target as HTMLFormElement;
      if (form.classList.contains('jfree')) {
        const title = form.querySelector<HTMLInputElement>('#jfree-title')!.value.trim();
        if (!title) return;
        const created = createEntry({ title, author: form.querySelector<HTMLInputElement>('#jfree-author')!.value.trim() });
        go(created.id);
      }
      if (form.classList.contains('jtrope-add')) {
        const input = form.querySelector('input')!;
        const name = input.value.trim();
        const e = entry();
        if (!name || !e || e.tropes.includes(name)) return;
        updateEntry(e.id, { tropes: [...e.tropes, name] });
        input.value = '';
        const box = left.querySelector('.jtropes')!;
        box.insertAdjacentHTML('beforeend', `<button type="button" data-trope="${esc(name)}" aria-pressed="true">${esc(name)}</button>`);
        showSaved();
      }
    });
  }

  // ---------------------------------------------------------------- personalizzazione
  const customDialog = section.querySelector<HTMLDialogElement>('.journal-custom-dialog')!;
  function customHtml(s: JournalSettings): string {
    const group = (legend: string, name: string, items: Array<{ value: string; label: string; swatch?: string; icon?: string }>, value: string) =>
      `<fieldset><legend>${legend}</legend><div class="jswatches">${items
        .map(
          (i) => `<label class="${i.icon !== undefined ? 'icon' : ''}" title="${esc(i.label)}"><input type="radio" name="jc-${name}" value="${esc(i.value)}" ${
            i.value === value ? 'checked' : ''
          }><span style="${i.swatch ? `--sw:${i.swatch}` : ''}">${i.icon !== undefined ? i.icon || '∅' : i.swatch ? '' : esc(i.label)}</span></label>`,
        )
        .join('')}</div></fieldset>`;
    const colors = (list: string[]) => list.map((c) => ({ value: c, label: c, swatch: c }));
    const charms = ['', 'star', 'moon', 'heart', 'daisy', 'key', 'crown', 'crystal', 'sparkle'].map((c) => ({ value: c, label: c ? DOODLE_LABELS[c as keyof typeof DOODLE_LABELS] : 'Nessuno', icon: c ? svgIcon(c) : '' }));
    return `
      <label class="jlabel" for="jc-name">Nome sulla copertina</label>
      <input type="text" id="jc-name" maxlength="40" value="${esc(s.name)}">
      ${group('Copertina', 'cover', COVER_COLORS.map((c) => ({ value: c.id, label: c.label, swatch: c.value })), s.cover)}
      ${group('Materiale', 'material', [{ value: 'leather', label: 'Pelle' }, { value: 'linen', label: 'Tela' }, { value: 'kraft', label: 'Kraft' }], s.material)}
      ${group('Elastico', 'band', colors(ACCENTS), s.band)}
      ${group('Segnalibro', 'ribbon', colors(ACCENTS), s.ribbon)}
      ${group('Ciondolo', 'charm', charms, s.charm)}
      ${group('Adesivo sulla copertina', 'sticker', charms.map((c) => ({ ...c })), s.sticker)}
      ${group('Carta', 'paper', [{ value: 'lines', label: 'Righe' }, { value: 'dots', label: 'Puntini' }, { value: 'grid', label: 'Quadretti' }], s.paper)}
      ${group('Inchiostro', 'ink', INKS.map((c) => ({ value: c.id, label: c.label, swatch: c.value })), s.ink)}
      ${group('Scrittura', 'hand', [{ value: 'true', label: 'A mano' }, { value: 'false', label: 'Stampatello' }], String(s.hand))}`;
  }
  // due punti d'accesso: il pulsante in alto e "Personalizza" tra i comandi del libro aperto
  section.querySelectorAll('[data-customize]').forEach((button) =>
    button.addEventListener('click', () => {
      customDialog.querySelector('.jcustom-body')!.innerHTML = customHtml(getJournal().settings);
      customDialog.showModal();
    }),
  );
  customDialog.addEventListener('input', (ev) => {
    const t = ev.target as HTMLInputElement;
    if (t.id === 'jc-name') updateSettings({ name: t.value });
    else if (t.name?.startsWith('jc-')) {
      const key = t.name.slice(3) as keyof JournalSettings;
      updateSettings({ [key]: key === 'hand' ? t.value === 'true' : t.value } as Partial<JournalSettings>);
    }
    applySettings();
  });
  customDialog.addEventListener('click', (ev) => {
    if (ev.target === customDialog) customDialog.close();
  });

  // ---------------------------------------------------------------- avvio
  // "Letto" o "Inizia a leggere" dalle cartelle di La mia libreria
  window.addEventListener('journal:add', async (ev) => {
    const slug = (ev as CustomEvent<string>).detail;
    catalog ??= await loadCatalog().catch(() => null);
    section.scrollIntoView({ behavior: reducedMotion() ? 'auto' : 'smooth', block: 'start' });
    await open();
    addFromCatalog(slug);
  });
  onJournalChange(() => {
    if (root.dataset.state === 'closed') applySettings();
  });
  applySettings();
  loadCatalog()
    .then((c) => {
      catalog = c;
      if (root.dataset.state === 'open' && !current) renderResults(right.querySelector<HTMLInputElement>('#jsearch')?.value ?? '');
      else if (root.dataset.state === 'open') render();
    })
    .catch(() => {});
}
