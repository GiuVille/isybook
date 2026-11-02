// Fantasie della copertina del book journal: tessere SVG disegnate a tracciati (non gradienti),
// con forme organiche messe da un generatore con seme fisso, così sembrano naturali ma sono sempre uguali.
// Ogni forma è ripetuta anche oltre i bordi (±T) perché la tessera si ripeta senza cuciture visibili.
// I colori si ricavano da quello della copertina, così ogni fantasia sta bene su tutti i colori.

const T = 240; // lato della tessera in px

export interface CoverPattern {
  id: string;
  label: string;
  group: 'animalier' | 'fantasie';
  tile: (cover: string) => string; // SVG della tessera
}

// ---------------------------------------------------------------------------
// Strumenti
// ---------------------------------------------------------------------------
function rng(seed: number) {
  let h = seed >>> 0;
  return () => {
    h = (h + 0x6d2b79f5) | 0;
    let t = Math.imul(h ^ (h >>> 15), 1 | h);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const hexToRgb = (hex: string) => [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16));
/** Mescola due colori: t = 0 → a, t = 1 → b. */
function mix(a: string, b: string, t: number): string {
  const [x, y] = [hexToRgb(a), hexToRgb(b)];
  return `#${x.map((v, i) => Math.round(v + (y[i] - v) * t).toString(16).padStart(2, '0')).join('')}`;
}
const luminance = (hex: string) => {
  const [r, g, b] = hexToRgb(hex);
  return (0.299 * r + 0.587 * g + 0.114 * b) / 255;
};
const f = (n: number) => Math.round(n * 10) / 10;

/** Tracciato chiuso e morbido attraverso i punti (Catmull-Rom → curve di Bézier). */
function smooth(points: Array<[number, number]>): string {
  const n = points.length;
  let d = `M${f(points[0][0])} ${f(points[0][1])}`;
  for (let i = 0; i < n; i++) {
    const [p0, p1, p2, p3] = [points[(i - 1 + n) % n], points[i], points[(i + 1) % n], points[(i + 2) % n]];
    const c1 = [p1[0] + (p2[0] - p0[0]) / 6, p1[1] + (p2[1] - p0[1]) / 6];
    const c2 = [p2[0] - (p3[0] - p1[0]) / 6, p2[1] - (p3[1] - p1[1]) / 6];
    d += `C${f(c1[0])} ${f(c1[1])} ${f(c2[0])} ${f(c2[1])} ${f(p2[0])} ${f(p2[1])}`;
  }
  return `${d}Z`;
}

/** Macchia irregolare (n punti a raggio variabile). */
function blob(rand: () => number, cx: number, cy: number, rx: number, ry: number, rot: number, n = 7, wobble = 0.35): string {
  const pts: Array<[number, number]> = [];
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2;
    const k = 1 - wobble / 2 + rand() * wobble;
    const x = Math.cos(a) * rx * k;
    const y = Math.sin(a) * ry * k;
    pts.push([cx + x * Math.cos(rot) - y * Math.sin(rot), cy + x * Math.sin(rot) + y * Math.cos(rot)]);
  }
  return smooth(pts);
}

/** Ripete il disegno nelle 9 posizioni, così ciò che esce da un bordo rientra dall'altro. */
const wrap9 = (inner: string) =>
  [-T, 0, T].flatMap((dx) => [-T, 0, T].map((dy) => `<g transform="translate(${dx} ${dy})">${inner}</g>`)).join('');

const svg = (body: string, bg = '') =>
  `<svg xmlns="http://www.w3.org/2000/svg" width="${T}" height="${T}" viewBox="0 0 ${T} ${T}">${bg}${body}</svg>`;

interface Spot {
  x: number;
  y: number;
  r: number; // raggio di ingombro (cerchio che contiene tutta la forma, comunque ruotata)
}

/** Distanza "sul toro": la tessera si ripete, quindi conta anche la distanza attraverso i bordi. */
function torusDist(a: Spot, b: Spot): number {
  const dx = Math.min(Math.abs(a.x - b.x), T - Math.abs(a.x - b.x));
  const dy = Math.min(Math.abs(a.y - b.y), T - Math.abs(a.y - b.y));
  return Math.hypot(dx, dy);
}

/**
 * Posizioni casuali senza sovrapposizioni: prova punti a caso e tiene solo quelli che non toccano
 * nessuna forma già messa (comprese le `taken`), finché non c'è più posto o si arriva a `max`.
 */
function pack(rand: () => number, radius: () => number, gap: number, taken: Spot[] = [], max = Infinity, tries = 900): Spot[] {
  const placed: Spot[] = [];
  for (let i = 0; i < tries && placed.length < max; i++) {
    const c = { x: rand() * T, y: rand() * T, r: radius() };
    if ([...taken, ...placed].every((o) => torusDist(c, o) >= c.r + o.r + gap)) placed.push(c);
  }
  return placed;
}

// ---------------------------------------------------------------------------
// Animalier
// ---------------------------------------------------------------------------
function leopard(cover: string): string {
  const rand = rng(11);
  const dark = '#22130a';
  const warm = mix(cover, '#b26d28', 0.5);
  let body = '';
  // l'ingombro di una rosetta è circa 1,25 volte il raggio dell'anello
  const rosettes = pack(rand, () => (12 + rand() * 9) * 1.25, 5);
  for (const spot of rosettes) {
    const { x, y } = spot;
    const r = spot.r / 1.25;
    const rot = rand() * Math.PI * 2;
    const sq = 0.7 + rand() * 0.25; // rosette un po' schiacciate
    // centro caldo, poi un anello spezzato in 3–5 frammenti spessi a forma di virgola
    body += `<path d="${blob(rand, x, y, r * 0.9, r * 0.9 * sq, rot, 8, 0.35)}" fill="${warm}" opacity="0.85"/>`;
    const parts = 3 + Math.floor(rand() * 3);
    for (let i = 0; i < parts; i++) {
      const a0 = rot + (i / parts) * Math.PI * 2 + (rand() - 0.5) * 0.4;
      const span = ((Math.PI * 2) / parts) * (0.55 + rand() * 0.2);
      const outer: Array<[number, number]> = [];
      const inner: Array<[number, number]> = [];
      for (let k = 0; k <= 4; k++) {
        const a = a0 + (span * k) / 4;
        const th = r * (0.22 + 0.18 * Math.sin((k / 4) * Math.PI)) * (0.8 + rand() * 0.4); // più spesso al centro
        const ca = Math.cos(a);
        const sa = Math.sin(a) * sq;
        outer.push([x + ca * (r + th / 2), y + sa * (r + th / 2)]);
        inner.unshift([x + ca * (r - th / 2), y + sa * (r - th / 2)]);
      }
      body += `<path d="${smooth([...outer, ...inner])}" fill="${dark}"/>`;
    }
  }
  // macchiette piene tra le rosette
  for (const { x, y, r } of pack(rand, () => 4 + rand() * 3, 4, rosettes, 40)) body += `<path d="${blob(rand, x, y, r * 0.8, r * 0.65, rand() * 3, 6, 0.4)}" fill="${dark}"/>`;
  return svg(wrap9(body));
}

/** Banda ondulata periodica in orizzontale (cicli interi sulla tessera), spessore variabile e punte. */
function band(rand: () => number, y0: number, maxW: number, color: string, taper = false, slope = 0): string {
  const k = 1 + Math.floor(rand() * 2);
  const amp = 2.5 + rand() * 4.5; // onda bassa: le strisce non si incrociano
  const ph = rand() * Math.PI * 2;
  const k2 = 2 + Math.floor(rand() * 3);
  const ph2 = rand() * Math.PI * 2;
  const x0 = taper ? rand() * T : -10;
  const x1 = taper ? x0 + 50 + rand() * 80 : T + 10;
  const top: Array<[number, number]> = [];
  const bottom: Array<[number, number]> = [];
  for (let x = x0; x <= x1; x += 8) {
    const c = y0 + slope * x + amp * Math.sin(((x * Math.PI * 2) / T) * k + ph);
    let w = maxW * (0.6 + 0.4 * Math.sin(((x * Math.PI * 2) / T) * k2 + ph2));
    if (taper) w *= Math.pow(Math.sin(((x - x0) / (x1 - x0)) * Math.PI), 0.7);
    top.push([x, c - w / 2]);
    bottom.unshift([x, c + w / 2]);
  }
  return `<path d="${smooth([...top, ...bottom])}" fill="${color}"/>`;
}

function zebra(cover: string): string {
  const rand = rng(23);
  const dark = luminance(cover) > 0.35 ? '#1c1a20' : mix(cover, '#ffffff', 0.88);
  let body = '';
  const n = 7;
  const gap = T / n;
  // strisce larghe quasi quanto il fondo; ogni onda fa cicli interi sulla tessera, così si ricongiunge
  // con se stessa nella tessera accanto (una diagonale la farebbe saldare a un'altra striscia, con lo scalino)
  const slope = 0;
  // spessore e onda sono limitati perché due strisce vicine non si tocchino mai
  for (let i = 0; i < n; i++) body += band(rand, i * gap + (rand() - 0.5) * 2, gap * (0.42 + rand() * 0.12), dark, false, slope);
  return svg(wrap9(body));
}

function tiger(cover: string): string {
  const rand = rng(37);
  const dark = '#1d120a';
  const glow = mix(cover, '#e0862a', 0.45);
  let body = '';
  // tratti affusolati alle due estremità, spesso in coppia: in file distanziate, e dentro una fila uno dopo
  // l'altro con un vuoto, così non si toccano mai (anche dove la tessera si ripete)
  const rows = 8;
  const rowH = T / rows;
  const strokes: Array<[number, number, number]> = [];
  for (let row = 0; row < rows; row++) {
    let x = rand() * 30;
    const start = x;
    while (true) {
      const len = 40 + rand() * 45;
      if (x + len + 14 > start + T) break;
      strokes.push([x + len / 2, row * rowH + rowH / 2 + (rand() - 0.5) * 4, len]);
      x += len + 14 + rand() * 18;
    }
  }
  for (const [x, y, len] of strokes) {
    const w = 6.5 + rand() * 4;
    const rot = (rand() - 0.5) * 0.16;
    const curve = (rand() - 0.5) * 6;
    const stroke = (dy: number, k: number) => {
      const top: Array<[number, number]> = [];
      const bot: Array<[number, number]> = [];
      for (let t = 0; t <= 1.0001; t += 0.125) {
        const px = (t - 0.5) * len * k;
        const py = dy + Math.sin(t * Math.PI) * curve;
        const th = w * k * Math.pow(Math.sin(t * Math.PI), 0.8) + 0.4;
        top.push([px, py - th / 2]);
        bot.unshift([px, py + th / 2]);
      }
      const pts = [...top, ...bot].map(([px, py]): [number, number] => [x + px * Math.cos(rot) - py * Math.sin(rot), y + px * Math.sin(rot) + py * Math.cos(rot)]);
      return `<path d="${smooth(pts)}" fill="${dark}"/>`;
    };
    body += stroke(-3, 1);
    if (rand() < 0.55) body += stroke(w * 1.1 + 3, 0.6 + rand() * 0.2);
  }
  return svg(wrap9(body), `<rect width="${T}" height="${T}" fill="${glow}" opacity="0.55"/>`);
}

function snake(cover: string): string {
  const rand = rng(51);
  const line = mix(cover, '#000000', 0.6);
  const light = mix(cover, '#ffffff', 0.3);
  const deep = mix(cover, '#000000', 0.45);
  let body = '';
  // scaglie esagonali irregolari, in file sfalsate, ben visibili
  // misure che dividono esattamente la tessera (e numero pari di file), così le scaglie continuano oltre il bordo
  const sw = 20;
  const sh = 15;
  for (let row = 0; row < T / sh; row++)
    for (let col = 0; col < T / sw; col++) {
      const cx = col * sw + (row % 2 ? sw / 2 : 0) + (rand() - 0.5) * 1.5;
      const cy = row * sh + (rand() - 0.5) * 1.5;
      const pts: Array<[number, number]> = [];
      for (let i = 0; i < 6; i++) {
        const a = (i / 6) * Math.PI * 2 + Math.PI / 6;
        pts.push([cx + Math.cos(a) * (sw / 2 - 1.2), cy + Math.sin(a) * (sh / 1.55)]);
      }
      body += `<path d="${smooth(pts)}" fill="${rand() < 0.4 ? light : 'none'}" fill-opacity="0.45" stroke="${line}" stroke-width="1.2" stroke-opacity="0.7"/>`;
    }
  // macchie del pitone: grandi, scure, con bordo chiaro, sopra le scaglie ma trasparenti quanto basta per vederle
  for (const { x, y, r } of pack(rand, () => 22 + rand() * 12, 8)) {
    const d = blob(rand, x, y, r * 0.78, r * 0.48, rand() * 0.8 - 0.4, 9, 0.5);
    body += `<path d="${d}" fill="${deep}" fill-opacity="0.72" stroke="${light}" stroke-width="3" stroke-opacity="0.8"/>`;
  }
  return svg(wrap9(body));
}

function cow(cover: string): string {
  const rand = rng(67);
  const base = mix(cover, '#ffffff', 0.78);
  const spot = luminance(cover) > 0.6 ? '#2a2730' : mix(cover, '#000000', 0.45);
  let body = '';
  const taken: Spot[] = [];
  for (const size of [40, 32, 26, 20, 16, 12, 10, 8]) taken.push(...pack(rand, () => size, 10, taken, size > 20 ? 1 : 2, 300));
  for (const { x, y, r } of taken) body += `<path d="${blob(rand, x, y, r * 0.78, r * (0.55 + rand() * 0.2), rand() * 3, 11, 0.4)}" fill="${spot}"/>`;
  return svg(wrap9(body), `<rect width="${T}" height="${T}" fill="${base}"/>`);
}

// ---------------------------------------------------------------------------
// Fantasie
// ---------------------------------------------------------------------------
/**
 * Motivo sparso: ogni elemento ruotato e scalato un po' a caso, messo dove non tocca nessun altro.
 * `size` è il raggio di ingombro del disegno a scala 1 (contiene tutta la forma comunque ruotata).
 */
function motif(seed: number, size: number, draw: (rand: () => number) => string, minScale = 0.8, maxScale = 1.15, gap = 5): string {
  const rand = rng(seed);
  const spots = pack(rand, () => size * (minScale + rand() * (maxScale - minScale)), gap);
  let body = '';
  for (const spot of spots) {
    body += `<g transform="translate(${f(spot.x)} ${f(spot.y)}) rotate(${Math.round((rand() - 0.5) * 70)}) scale(${f(spot.r / size)})">${draw(rand)}</g>`;
  }
  return svg(wrap9(body));
}

const OUTLINE = 'stroke="#ffffff" stroke-opacity="0.7" stroke-width="1.2"';

const cherries = () =>
  motif(83, 25, () => `
    <path d="M-6 6 C-6 -6 -2 -14 4 -18 M7 8 C6 -4 5 -12 4 -18" fill="none" stroke="#5b3a1e" stroke-width="1.8" stroke-linecap="round"/>
    <path d="M4 -18 C10 -24 18 -22 20 -16 C14 -14 9 -14 4 -18Z" fill="#3f8a3a"/>
    <circle cx="-6" cy="9" r="7" fill="#c8102e" ${OUTLINE}/><circle cx="7" cy="11" r="7" fill="#b00d27" ${OUTLINE}/>
    <circle cx="-8.5" cy="6.5" r="2" fill="#ffffff" opacity="0.7"/><circle cx="4.5" cy="8.5" r="2" fill="#ffffff" opacity="0.7"/>`);

const lemons = () =>
  motif(97, 23, () => `
    <path d="M-15 0 C-14 -10 -4 -13 4 -12 C12 -11 17 -4 16 2 C15 9 6 13 -2 12 C-10 11 -16 7 -15 0Z" fill="#f4d03f" ${OUTLINE}/>
    <path d="M-15 0 L-19 -1 M16 2 L20 3" stroke="#d1a91f" stroke-width="2" stroke-linecap="round"/>
    <path d="M2 -12 C6 -20 14 -21 18 -17 C13 -13 8 -12 2 -12Z" fill="#4f9b45"/>
    <path d="M-6 -5 C-2 -8 4 -8 7 -6" fill="none" stroke="#ffffff" stroke-opacity="0.6" stroke-width="1.5" stroke-linecap="round"/>`);

const strawberries = () =>
  motif(101, 17, () => `
    <path d="M0 16 C-12 8 -14 -4 -8 -8 C-4 -10 4 -10 8 -8 C14 -4 12 8 0 16Z" fill="#e0263b" ${OUTLINE}/>
    <path d="M-8 -8 L-4 -13 L0 -9 L4 -13 L8 -8 L3 -6 L0 -8 L-3 -6Z" fill="#3f8a3a"/>
    ${[[-4, -2], [3, -3], [-1, 3], [5, 3], [-5, 5], [1, 9], [-2, -4]].map(([x, y]) => `<ellipse cx="${x}" cy="${y}" rx="0.9" ry="1.4" fill="#ffe08a"/>`).join('')}`);

const snowflakes = (cover: string) => {
  const snow = luminance(cover) > 0.75 ? mix(cover, '#3a5a8a', 0.6) : '#ffffff';
  return motif(
    113,
    14,
    (rand) => {
      const arm = 7 + rand() * 6;
      let d = '';
      for (let i = 0; i < 6; i++) {
        const a = (i / 6) * Math.PI * 2;
        const [cx, cy] = [Math.cos(a), Math.sin(a)];
        d += `M0 0L${f(cx * arm)} ${f(cy * arm)}`;
        const b = arm * 0.55;
        for (const s of [-1, 1]) {
          const a2 = a + s * 0.7;
          d += `M${f(cx * b)} ${f(cy * b)}L${f(cx * b + Math.cos(a2) * arm * 0.35)} ${f(cy * b + Math.sin(a2) * arm * 0.35)}`;
        }
      }
      return `<path d="${d}" fill="none" stroke="${snow}" stroke-width="1.6" stroke-linecap="round" opacity="0.92"/><circle r="1.6" fill="${snow}"/>`;
    },
    0.55,
    1.25,
  );
};

const daisies = () =>
  motif(127, 14, () =>
    `${[...Array(8)].map((_, i) => `<ellipse cx="0" cy="-7" rx="3" ry="6.5" fill="#ffffff" transform="rotate(${i * 45})" stroke="#e6dccb" stroke-width="0.6"/>`).join('')}
     <circle r="3.8" fill="#f2c230"/><circle r="3.8" fill="none" stroke="#d6a419" stroke-width="0.8"/>`,
  );

const hearts = (cover: string) => {
  const c = luminance(cover) > 0.6 ? mix(cover, '#c62828', 0.55) : mix(cover, '#ffffff', 0.55);
  return motif(139, 11, () => `<path d="M0 8 C-9 1 -11 -5 -7 -8 C-4 -10 -1 -8 0 -5 C1 -8 4 -10 7 -8 C11 -5 9 1 0 8Z" fill="${c}"/>`, 0.6, 1.1);
};

const stars = (cover: string) => {
  const c = luminance(cover) > 0.6 ? mix(cover, '#b48a2c', 0.7) : mix(cover, '#ffe9a0', 0.75);
  const star = [...Array(10)].map((_, i) => {
    const a = (i / 10) * Math.PI * 2 - Math.PI / 2;
    const r = i % 2 ? 3.6 : 8.5;
    return `${f(Math.cos(a) * r)} ${f(Math.sin(a) * r)}`;
  });
  return motif(151, 9, () => `<path d="M${star.join('L')}Z" fill="${c}" stroke-linejoin="round"/>`, 0.45, 1.05);
};

/** Pois regolari, sfalsati a righe alterne. */
function polka(cover: string): string {
  const c = luminance(cover) > 0.6 ? mix(cover, '#000000', 0.18) : mix(cover, '#ffffff', 0.6);
  let body = '';
  for (let y = 0; y < T; y += 30) for (let x = (y / 30) % 2 ? 15 : 0; x < T + 15; x += 30) body += `<circle cx="${x}" cy="${y}" r="5.5" fill="${c}"/>`;
  return svg(wrap9(body));
}

/** Quadretti vichy: righe trasparenti nei due sensi, dove si incrociano il colore è più pieno. */
function gingham(cover: string): string {
  const c = luminance(cover) > 0.6 ? mix(cover, '#000000', 0.3) : '#ffffff';
  let body = '';
  for (let i = 0; i < T; i += 24) body += `<rect x="${i}" y="0" width="12" height="${T}" fill="${c}" opacity="0.32"/><rect x="0" y="${i}" width="${T}" height="12" fill="${c}" opacity="0.32"/>`;
  return svg(body);
}

export const PATTERNS: CoverPattern[] = [
  { id: 'leopard', label: 'Leopardato', group: 'animalier', tile: leopard },
  { id: 'zebra', label: 'Zebrato', group: 'animalier', tile: zebra },
  { id: 'tiger', label: 'Tigrato', group: 'animalier', tile: tiger },
  { id: 'snake', label: 'Pitonato', group: 'animalier', tile: snake },
  { id: 'cow', label: 'Mucca', group: 'animalier', tile: cow },
  { id: 'cherries', label: 'Ciliegie', group: 'fantasie', tile: cherries },
  { id: 'lemons', label: 'Limoni', group: 'fantasie', tile: lemons },
  { id: 'strawberries', label: 'Fragole', group: 'fantasie', tile: strawberries },
  { id: 'snowflakes', label: 'Fiocchi di neve', group: 'fantasie', tile: snowflakes },
  { id: 'daisies', label: 'Margheritine', group: 'fantasie', tile: daisies },
  { id: 'hearts', label: 'Cuoricini', group: 'fantasie', tile: hearts },
  { id: 'stars', label: 'Stelline', group: 'fantasie', tile: stars },
  { id: 'polka', label: 'Pois', group: 'fantasie', tile: polka },
  { id: 'gingham', label: 'Vichy', group: 'fantasie', tile: gingham },
];

export const PATTERN_IDS = ['none', ...PATTERNS.map((p) => p.id)];

const cache = new Map<string, string>();
/** Valore CSS per background-image della fantasia sul colore dato, o 'none'. */
export function patternImage(id: string, cover: string): string {
  const p = PATTERNS.find((x) => x.id === id);
  if (!p) return 'none';
  const key = `${id}|${cover}`;
  if (!cache.has(key)) cache.set(key, `url("data:image/svg+xml,${encodeURIComponent(p.tile(cover))}")`);
  return cache.get(key)!;
}
