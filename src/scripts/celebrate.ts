// Piccole animazioni di conferma: cuoricini per i preferiti, mini libro (o videocassetta) che vola in "La mia libreria".
// Elementi temporanei a posizione fissa, rimossi a fine animazione; niente se si riduce il movimento.
import { reducedMotion } from './reveal';

function layer(): HTMLElement {
  const el = document.createElement('span');
  el.setAttribute('aria-hidden', 'true');
  el.style.cssText = 'position:fixed;left:0;top:0;pointer-events:none;z-index:1000;';
  document.body.append(el);
  return el;
}

const center = (r: DOMRect) => ({ x: r.left + r.width / 2, y: r.top + r.height / 2 });

/** Il pulsante pulsa e lancia sei cuoricini (o altri simboli) a raggiera. */
export function heartBurst(button: HTMLElement, symbol = '♥', color = '#c2185b') {
  if (reducedMotion()) return;
  button.querySelector('svg')?.animate([{ transform: 'scale(1)' }, { transform: 'scale(1.35)' }, { transform: 'scale(1)' }], {
    duration: 380,
    easing: 'cubic-bezier(0.34, 1.56, 0.64, 1)',
  });
  const { x, y } = center(button.getBoundingClientRect());
  for (let i = 0; i < 6; i++) {
    const heart = layer();
    heart.textContent = symbol;
    heart.style.cssText += `color:${color};font-size:${10 + (i % 3) * 3}px;`;
    const angle = (Math.PI * 2 * i) / 6 - Math.PI / 2;
    const dist = 26 + (i % 2) * 10;
    heart
      .animate(
        [
          { transform: `translate(${x - 5}px, ${y - 8}px) scale(0.4)`, opacity: 1 },
          { transform: `translate(${x - 5 + Math.cos(angle) * dist}px, ${y - 8 + Math.sin(angle) * dist}px) scale(1)`, opacity: 0 },
        ],
        { duration: 650, easing: 'cubic-bezier(0.22, 1, 0.36, 1)' },
      )
      .finished.then(() => heart.remove());
  }
}

/** Dove sta "La mia libreria": la cartellina su desktop, il pulsante Menu su mobile. */
function libraryTarget(): HTMLElement | null {
  const visible = (el: HTMLElement | null) => el && el.getBoundingClientRect().width > 0 && el.getBoundingClientRect().bottom > 0;
  const folder = document.querySelector<HTMLElement>('.folder[href="/la-mia-libreria"] .label');
  if (visible(folder)) return folder;
  const burger = document.querySelector<HTMLElement>('.burger');
  return visible(burger) ? burger : null;
}

/** Una mini copertina (o una videocassetta, per serie e film) parte dal pulsante e vola, con un arco, verso "La mia libreria". */
export function flyToLibrary(from: HTMLElement, color = 'var(--accent)', shape: 'book' | 'tape' = 'book') {
  if (reducedMotion()) return;
  const target = libraryTarget();
  if (!target) return;
  const a = center(from.getBoundingClientRect());
  const b = center(target.getBoundingClientRect());
  const book = layer();
  book.style.cssText +=
    shape === 'tape'
      ? // videocassetta: corpo scuro, etichetta colorata e due bobine
        `width:26px;height:16px;border-radius:2px;box-shadow:1px 2px 4px rgba(0,0,0,.35);
         background:radial-gradient(circle at 30% 62%,#eee 0 2px,transparent 2.5px),radial-gradient(circle at 70% 62%,#eee 0 2px,transparent 2.5px),
         linear-gradient(${color} 0 0) 4px 2px / 18px 5px no-repeat,#231d27;`
      : `width:16px;height:24px;border-radius:2px;background:${color};box-shadow:1px 2px 4px rgba(0,0,0,.3);`;
  const mid = { x: (a.x + b.x) / 2, y: Math.min(a.y, b.y) - 80 };
  book
    .animate(
      [
        { transform: `translate(${a.x - 8}px, ${a.y - 12}px) rotate(0deg) scale(1)` },
        { transform: `translate(${mid.x - 8}px, ${mid.y - 12}px) rotate(-25deg) scale(1.1)`, offset: 0.45 },
        { transform: `translate(${b.x - 8}px, ${b.y - 12}px) rotate(-50deg) scale(0.4)`, opacity: 0.6 },
      ],
      { duration: 700, easing: 'cubic-bezier(0.65, 0, 0.35, 1)' },
    )
    .finished.then(() => {
      book.remove();
      target.animate([{ transform: 'scale(1)' }, { transform: 'scale(1.18) rotate(-3deg)' }, { transform: 'scale(1)' }], {
        duration: 420,
        easing: 'cubic-bezier(0.34, 1.56, 0.64, 1)',
      });
    });
}
