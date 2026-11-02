// "Shuffle" di La mia libreria: estrae a caso un libro (o una serie/film) da una cartella.
// Un rullo di copertine scorre, rallenta e si ferma sul vincitore, che si stacca, si gira e si presenta.
// Stili in src/styles/shuffle.css. Con riduci movimento il risultato compare direttamente.
import { esc } from '../lib/book-card';
import { heartBurst } from './celebrate';
import { reducedMotion } from './reveal';

export interface ShuffleItem {
  slug: string;
  title: string;
  meta: string; // autore, o libro da cui è tratto
  cover: string | null;
  color: string;
  href: string;
}

interface ShuffleOptions {
  kind: 'book' | 'screen';
  folder: string;
  items: ShuffleItem[];
}

const CELL = 92; // larghezza di una copertina nel rullo, margine compreso
const SPIN_MS = 2600;

let dialog: HTMLDialogElement | null = null;
let last: string | null = null;

const coverHtml = (it: ShuffleItem, cls: string) =>
  it.cover
    ? `<img class="${cls}" src="${esc(it.cover)}" alt="" loading="eager">`
    : `<span class="${cls} ph" style="--c:${esc(it.color)}"><span>${esc(it.title)}</span></span>`;

function ensureDialog(): HTMLDialogElement {
  if (dialog) return dialog;
  dialog = document.createElement('dialog');
  dialog.className = 'shuffle';
  dialog.setAttribute('aria-labelledby', 'shuffle-title');
  dialog.innerHTML = `
    <div class="shuffle-box">
      <p class="shuffle-title" id="shuffle-title"></p>
      <div class="shuffle-window" aria-hidden="true">
        <span class="shuffle-pin top"></span><span class="shuffle-pin bottom"></span>
        <div class="shuffle-reel"></div>
      </div>
      <div class="shuffle-result" aria-live="polite"></div>
      <div class="shuffle-actions">
        <button type="button" class="button-strong" data-again>Rimescola</button>
        <a class="button-soft" data-open href="#">Apri la scheda</a>
        <button type="button" class="button-soft" data-journal hidden>Inizia nel journal</button>
        <button type="button" class="button-soft" data-close>Chiudi</button>
      </div>
    </div>`;
  document.body.append(dialog);
  dialog.addEventListener('click', (e) => {
    if (e.target === dialog) dialog!.close();
  });
  dialog.querySelector('[data-close]')!.addEventListener('click', () => dialog!.close());
  return dialog;
}

/** Ordine casuale (Fisher–Yates). */
function shuffled<T>(list: T[]): T[] {
  const a = [...list];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

export function openShuffle({ kind, folder, items }: ShuffleOptions) {
  if (items.length === 0) return;
  const d = ensureDialog();
  d.classList.toggle('is-film', kind === 'screen');
  const reel = d.querySelector<HTMLElement>('.shuffle-reel')!;
  const win = d.querySelector<HTMLElement>('.shuffle-window')!;
  const result = d.querySelector<HTMLElement>('.shuffle-result')!;
  const open = d.querySelector<HTMLAnchorElement>('[data-open]')!;
  const journal = d.querySelector<HTMLButtonElement>('[data-journal]')!;
  const again = d.querySelector<HTMLButtonElement>('[data-again]')!;
  d.querySelector('.shuffle-title')!.textContent = `${kind === 'screen' ? '🎞️' : '🎲'} Estrazione da «${folder}»`;

  async function spin() {
    // mai lo stesso due volte di fila, se si può scegliere
    const pool = items.length > 1 ? items.filter((x) => x.slug !== last) : items;
    const winner = pool[Math.floor(Math.random() * pool.length)];
    last = winner.slug;
    again.disabled = true;
    result.innerHTML = '';
    d.classList.remove('is-done');
    open.hidden = true;
    journal.hidden = true;

    // rullo: abbastanza copertine mescolate da fare qualche giro, poi il vincitore e qualche coda
    const laps = Math.max(18, items.length * 3);
    const strip = [...Array(Math.ceil(laps / items.length))].flatMap(() => shuffled(items)).slice(0, laps);
    const tail = shuffled(items).slice(0, 3);
    const cells = [...strip, winner, ...tail];
    const target = strip.length; // indice del vincitore
    reel.innerHTML = cells.map((it, i) => `<span class="shuffle-cell" data-i="${i}">${coverHtml(it, 'shuffle-cover')}</span>`).join('');

    const center = win.clientWidth / 2;
    const end = -(target * CELL + CELL / 2 - center);
    if (!reducedMotion()) {
      reel.style.transform = `translateX(${center - CELL / 2}px)`;
      const anim = reel.animate([{ transform: `translateX(${center - CELL / 2}px)` }, { transform: `translateX(${end}px)` }], {
        duration: SPIN_MS,
        easing: 'cubic-bezier(0.12, 0.6, 0.12, 1)',
        fill: 'forwards',
      });
      // la finestrella "ticchetta" quando le ultime copertine passano sotto i segnalibri
      const ticks = [0.55, 0.68, 0.78, 0.86, 0.93].map((p) =>
        setTimeout(() => win.animate([{ transform: 'scale(1)' }, { transform: 'scale(1.04)' }, { transform: 'scale(1)' }], { duration: 160 }), SPIN_MS * p),
      );
      await anim.finished;
      ticks.forEach(clearTimeout);
    }
    reel.style.transform = `translateX(${end}px)`;
    reel.getAnimations().forEach((a) => a.cancel());
    reel.querySelector(`[data-i="${target}"]`)?.classList.add('is-winner');

    // rivelazione: la copertina vincente si gira e presenta titolo e autore
    result.innerHTML = `
      <div class="shuffle-card">
        ${coverHtml(winner, 'shuffle-big')}
        <div>
          <p class="shuffle-lead">${kind === 'screen' ? 'Stasera guardi…' : 'Il prossimo libro da leggere è…'}</p>
          <p class="shuffle-name">${esc(winner.title)}</p>
          ${winner.meta ? `<p class="shuffle-meta">${esc(winner.meta)}</p>` : ''}
        </div>
      </div>`;
    d.classList.add('is-done');
    open.href = winner.href;
    open.hidden = false;
    journal.hidden = kind !== 'book';
    journal.onclick = () => {
      d.close();
      window.dispatchEvent(new CustomEvent('journal:add', { detail: winner.slug }));
    };
    again.disabled = items.length < 2;
    const big = result.querySelector<HTMLElement>('.shuffle-big');
    if (big) heartBurst(big, kind === 'screen' ? '★' : '✦', '#e2a92b');
    again.focus();
  }

  again.onclick = spin;
  if (!d.open) d.showModal();
  spin();
}
