// Caroselli: le file di card con la classe .rail (sempre) o .rail-mobile (solo su telefono) scorrono di lato,
// a scatti, col dito o con la rotellina. Su computer compaiono le frecce ‹ ›, nascoste all'inizio e alla fine.
// Funziona anche sulle file disegnate dopo il caricamento (Per te, La mia libreria): un MutationObserver le aggancia.
// Sotto la fila una barretta centrata mostra dove si è e quanto resta, e il bordo dal lato che continua sfuma: si capisce che si scorre.
// Le card con data-reveal compaiono tutte insieme quando la fila entra nello schermo, non una alla volta scorrendo.
import { reducedMotion } from './reveal';

const SELECTOR = '.rail, .rail-mobile';
const ARROW = (d: string) => `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="${d}"/></svg>`;

function setup(rail: HTMLElement) {
  if (rail.dataset.railReady) return;
  rail.dataset.railReady = '1';
  const wrap = document.createElement('div');
  wrap.className = `rail-wrap${rail.classList.contains('rail-mobile') ? ' is-mobile-only' : ''}`;
  rail.before(wrap);
  wrap.append(rail);
  const prev = document.createElement('button');
  const next = document.createElement('button');
  prev.type = next.type = 'button';
  prev.className = 'rail-btn prev';
  next.className = 'rail-btn next';
  prev.setAttribute('aria-label', 'Indietro');
  next.setAttribute('aria-label', 'Avanti');
  prev.innerHTML = ARROW('M15 5l-7 7 7 7');
  next.innerHTML = ARROW('M9 5l7 7-7 7');
  wrap.append(prev, next);
  const meter = document.createElement('div');
  meter.className = 'rail-meter';
  meter.setAttribute('aria-hidden', 'true');
  meter.innerHTML = '<span class="rail-track"><span class="rail-thumb"></span></span>';
  wrap.append(meter);
  const thumb = meter.querySelector<HTMLElement>('.rail-thumb')!;

  const revealAll = () => rail.querySelectorAll('[data-reveal]').forEach((el) => el.classList.add('is-in'));
  if ('IntersectionObserver' in window) {
    const io = new IntersectionObserver((entries) => {
      if (entries.some((e) => e.isIntersecting)) { revealAll(); io.disconnect(); }
    }, { threshold: 0.1 });
    io.observe(rail);
  } else revealAll();

  const update = () => {
    const max = rail.scrollWidth - rail.clientWidth;
    const scrollable = max > 4 && getComputedStyle(rail).overflowX !== 'visible';
    prev.hidden = !scrollable || rail.scrollLeft <= 4;
    next.hidden = !scrollable || rail.scrollLeft >= max - 4;
    wrap.classList.toggle('can-scroll', scrollable);
    wrap.classList.toggle('more-left', !prev.hidden);
    wrap.classList.toggle('more-right', !next.hidden);
    if (!scrollable) return;
    const ratio = rail.clientWidth / rail.scrollWidth;
    const pos = max ? rail.scrollLeft / max : 0;
    thumb.style.width = `${Math.max(ratio * 100, 12)}%`;
    thumb.style.transform = `translateX(${pos * (100 / Math.max(ratio, 0.12) - 100)}%)`;
  };
  new MutationObserver(() => { update(); revealAll(); }).observe(rail, { childList: true });
  const move = (dir: number) => rail.scrollBy({ left: dir * rail.clientWidth * 0.9, behavior: reducedMotion() ? 'auto' : 'smooth' });
  prev.addEventListener('click', () => move(-1));
  next.addEventListener('click', () => move(1));
  rail.addEventListener('scroll', update, { passive: true });
  new ResizeObserver(update).observe(rail);
  update();
}

export function initRails() {
  document.querySelectorAll<HTMLElement>(SELECTOR).forEach(setup);
  new MutationObserver((records) => {
    for (const r of records)
      r.addedNodes.forEach((n) => {
        if (!(n instanceof HTMLElement)) return;
        if (n.matches(SELECTOR)) setup(n);
        n.querySelectorAll<HTMLElement>(SELECTOR).forEach(setup);
      });
  }).observe(document.body, { childList: true, subtree: true });
}
