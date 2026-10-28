// Geometria dell'anteprima libro: copertina al centro-sinistra, una freccia "a mano"
// per ogni tropo. Deterministico: lo stesso libro produce sempre le stesse frecce.

export const VIEW = { width: 480, height: 470 };
export const COVER = { x: 50, y: 88, width: 180, height: 270 };

const RIGHT_X = COVER.x + COVER.width + 62; // inizio delle etichette a destra
const LABEL_WRAP = 14; // caratteri oltre i quali l'etichetta va su due righe

export interface TropeArrow {
  label: string[]; // righe
  x: number;
  y: number; // baseline della prima riga
  fontSize: number;
  path: string; // corpo della freccia
  head: string; // punta a V
}

type Point = { x: number; y: number };

function mulberry32(seed: number) {
  return () => {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function hash(text: string): number {
  let h = 2166136261;
  for (const ch of text) h = Math.imul(h ^ ch.charCodeAt(0), 16777619);
  return h >>> 0;
}

const r1 = (n: number) => Math.round(n * 10) / 10;
const pt = (p: Point) => `${r1(p.x)} ${r1(p.y)}`;

function wrap(text: string): string[] {
  if (text.length <= LABEL_WRAP || !text.includes(' ')) return [text];
  // spezza sullo spazio più vicino a metà
  const mid = text.length / 2;
  let best = -1;
  for (let i = 0; i < text.length; i++) {
    if (text[i] === ' ' && (best < 0 || Math.abs(i - mid) < Math.abs(best - mid))) best = i;
  }
  return [text.slice(0, best), text.slice(best + 1)];
}

/** Punta aperta a V orientata come la tangente finale (da `from` verso `tip`). */
function arrowHead(from: Point, tip: Point, size = 13): string {
  const angle = Math.atan2(tip.y - from.y, tip.x - from.x);
  const wing = (a: number) => ({ x: tip.x - size * Math.cos(angle + a), y: tip.y - size * Math.sin(angle + a) });
  return `M ${pt(wing(0.5))} L ${pt(tip)} L ${pt(wing(-0.5))}`;
}

/** Curva da `s` a `e`; con `curl` aggiunge un ricciolo a metà, come nel disegno a mano. */
function sketchPath(s: Point, c1: Point, c2: Point, e: Point, curl: boolean, rand: () => number): string {
  if (!curl) return `M ${pt(s)} C ${pt(c1)} ${pt(c2)} ${pt(e)}`;
  const m = { x: s.x + (e.x - s.x) * 0.45, y: s.y + (e.y - s.y) * 0.45 + 6 };
  const r = 16 + rand() * 6;
  return [
    `M ${pt(s)}`,
    `Q ${pt({ x: s.x + (m.x - s.x) * 0.5, y: s.y + 4 })} ${pt(m)}`,
    `C ${pt({ x: m.x + r * 1.6, y: m.y + r * 0.4 })} ${pt({ x: m.x + r * 1.1, y: m.y - r * 1.9 })} ${pt({ x: m.x - r * 0.2, y: m.y - r * 1.1 })}`,
    `C ${pt({ x: m.x - r * 1.2, y: m.y - r * 0.4 })} ${pt(c2)} ${pt(e)}`,
  ].join(' ');
}

/**
 * Distribuisce i tropi come nel modello: uno sopra la copertina, uno sotto a sinistra,
 * gli altri in colonna sulla destra. Con pochi tropi stanno tutti a destra.
 */
export function layoutTropeArrows(tropes: string[], seed: string): TropeArrow[] {
  const rand = mulberry32(hash(seed));
  const jitter = (amount: number) => (rand() - 0.5) * 2 * amount;
  const n = tropes.length;
  if (n === 0) return [];

  const top = n >= 4 ? 1 : 0;
  const bottom = n >= 5 ? 1 : 0;
  const right = n - top - bottom;
  const fontSize = right > 5 ? 19 : 23;
  const coverRight = COVER.x + COVER.width;
  const coverBottom = COVER.y + COVER.height;
  const arrows: TropeArrow[] = [];

  if (top) {
    const label = wrap(tropes[0]);
    const x = COVER.x + 78;
    const y = 40;
    const s = { x: COVER.x + 18 + jitter(6), y: COVER.y - 4 };
    const e = { x: x - 12, y: y - 6 };
    const c1 = { x: s.x - 6 + jitter(4), y: s.y - 46 };
    const c2 = { x: e.x - 34, y: e.y + 2 + jitter(4) };
    arrows.push({ label, x, y, fontSize, path: sketchPath(s, c1, c2, e, false, rand), head: arrowHead(c2, e) });
  }

  // colonna destra: etichette distribuite in verticale lungo la copertina
  const span = { from: COVER.y - 6, to: coverBottom + 14 };
  const step = (span.to - span.from) / right;
  for (let i = 0; i < right; i++) {
    const label = wrap(tropes[top + i]);
    const lines = label.length;
    const y = span.from + step * (i + 0.5) - ((lines - 1) * fontSize) / 2 + fontSize * 0.35;
    const x = RIGHT_X + jitter(6);
    const sy = Math.min(Math.max(y + jitter(18), COVER.y + 18), coverBottom - 18);
    const s = { x: coverRight + 2, y: sy };
    const e = { x: x - 10, y: y - fontSize * 0.3 + ((lines - 1) * fontSize) / 2 };
    const c1 = { x: s.x + 22 + jitter(8), y: s.y + jitter(14) };
    const c2 = { x: e.x - 22 + jitter(6), y: e.y + jitter(10) };
    const curl = right >= 3 && i % 2 === 1 && rand() > 0.25;
    arrows.push({ label, x, y, fontSize, path: sketchPath(s, c1, c2, e, curl, rand), head: arrowHead(c2, e) });
  }

  if (bottom) {
    const label = wrap(tropes[n - 1]);
    const x = COVER.x + 78;
    const y = VIEW.height - 26 - (label.length - 1) * fontSize;
    const s = { x: COVER.x - 2, y: coverBottom - 50 + jitter(10) };
    const e = { x: x - 12, y: y - 6 };
    const c1 = { x: s.x - 30, y: s.y + 30 };
    const c2 = { x: e.x - 50 + jitter(6), y: e.y + 4 };
    arrows.push({ label, x, y, fontSize, path: sketchPath(s, c1, c2, e, false, rand), head: arrowHead(c2, e) });
  }

  return arrows;
}

/** Titolo spezzato in righe per la copertina segnaposto. */
export function wrapTitle(title: string, maxChars = 14): string[] {
  const lines: string[] = [];
  for (const word of title.split(/\s+/)) {
    const last = lines.at(-1);
    if (last && (last + ' ' + word).length <= maxChars) lines[lines.length - 1] = `${last} ${word}`;
    else lines.push(word);
  }
  return lines.slice(0, 4);
}
