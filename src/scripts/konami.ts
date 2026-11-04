// Easter egg: con il Konami code (↑ ↑ ↓ ↓ ← → ← → B A) sul sito cade una pioggia di stelline.
// Sul telefono, senza tastiera: sette tocchi veloci sul logo. Solo transform/opacity, niente con riduci movimento.
// Una pioggia per volta.
import { reducedMotion } from './reveal';

const CODE = ['arrowup', 'arrowup', 'arrowdown', 'arrowdown', 'arrowleft', 'arrowright', 'arrowleft', 'arrowright', 'b', 'a'];
const SYMBOLS = ['✦', '★', '✧', '♥', '✦', '★'];
const COLORS = ['#e9cf74', '#e2a92b', '#d99aae', '#c6b2e2', '#f4e6f0', '#e88fb3'];
let raining = false;

function rain() {
  // solo animazione: con riduci movimento non succede nulla
  if (raining || reducedMotion()) return;
  raining = true;
  const layer = document.createElement('div');
  layer.setAttribute('aria-hidden', 'true');
  layer.style.cssText = 'position:fixed;inset:0;z-index:2000;pointer-events:none;overflow:hidden;';
  document.body.append(layer);

  const h = window.innerHeight;
  const anims = [...Array(130)].map(() => {
    const star = document.createElement('span');
    const size = 12 + Math.random() * 22;
    star.textContent = SYMBOLS[Math.floor(Math.random() * SYMBOLS.length)];
    star.style.cssText = `position:absolute;top:-40px;left:${Math.random() * 100}%;font-size:${size}px;line-height:1;color:${
      COLORS[Math.floor(Math.random() * COLORS.length)]
    };text-shadow:0 0 6px rgba(255,255,255,.8);`;
    layer.append(star);
    const drift = (Math.random() - 0.5) * 160;
    const spin = (Math.random() - 0.5) * 720;
    return star.animate(
      [
        { transform: 'translate(0,0) rotate(0)', opacity: 1 },
        { transform: `translate(${drift / 2}px,${h * 0.5}px) rotate(${spin / 2}deg)`, opacity: 1, offset: 0.5 },
        { transform: `translate(${drift}px,${h + 80}px) rotate(${spin}deg)`, opacity: 0.2 },
      ],
      { duration: 2200 + Math.random() * 2200, delay: Math.random() * 2600, easing: 'cubic-bezier(.3,.1,.6,1)', fill: 'backwards' },
    );
  });
  Promise.all(anims.map((a) => a.finished)).then(() => {
    layer.remove();
    raining = false;
  });
}

export function initKonami() {
  // ultimi tasti premuti: quando coincidono con il codice parte la pioggia
  let recent: string[] = [];
  window.addEventListener('keydown', (e) => {
    const t = e.target;
    if (t instanceof Element && t.closest('input, textarea, select, [contenteditable="true"]')) return;
    recent = [...recent, e.key.toLowerCase()].slice(-CODE.length);
    if (recent.join() === CODE.join()) {
      recent = [];
      rain();
    }
  });

  // telefono: 7 tocchi veloci sul logo. Con il dito il logo porta alla home dopo una breve pausa,
  // così i tocchi successivi si possono contare; con mouse e tastiera funziona come sempre.
  const logo = document.querySelector<HTMLAnchorElement>('.logo');
  if (!logo) return;
  let taps = 0;
  let timer = 0;
  // Safari su iPhone manda il clic come MouseEvent, senza pointerType: il dito si riconosce da pointerdown/touchstart
  let lastPointer = '';
  let touched = false;
  logo.style.touchAction = 'manipulation'; // tocchi ripetuti senza zoom né ritardo
  logo.addEventListener('pointerdown', (e) => (lastPointer = e.pointerType));
  logo.addEventListener('touchstart', () => (touched = true), { passive: true });
  logo.addEventListener('click', (e) => {
    const pointer = (e as PointerEvent).pointerType;
    const finger = pointer === 'touch' || (!pointer && (lastPointer === 'touch' || touched));
    if (!finger) return;
    e.preventDefault();
    clearTimeout(timer);
    taps++;
    if (taps >= 7) {
      taps = 0;
      return rain();
    }
    timer = window.setTimeout(() => {
      if (taps === 1) location.href = logo.href;
      taps = 0;
    }, 450);
  });
}
