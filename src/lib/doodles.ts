// Scarabocchi a tema disegnati a pennarello sulle anteprime e sul calendario delle uscite:
// simboli del genere (cuori, ragnatele, lenti…) mescolati a sport e ambientazione del libro.
// Tutte le icone sono path a tratto su una griglia 24×24.
import { themeNameForWork, type ThemeName } from './book-themes';
import { COVER, VIEW, type TropeArrow } from './trope-arrows';
import type { Tag } from './types';

const ICONS = {
  // romance
  heart: 'M12 20s-7-4.4-8.6-8.7C2.2 8 4.3 5 7.4 5c1.9 0 3.4 1 4.6 2.7C13.2 6 14.7 5 16.6 5c3.1 0 5.2 3 4 6.3C19 15.6 12 20 12 20Z',
  heartArrow: 'M10 16s-5-3.1-6.2-6.2C3 7.5 4.5 5.4 6.7 5.4c1.4 0 2.4.7 3.3 1.9.9-1.2 1.9-1.9 3.3-1.9 2.2 0 3.7 2.1 2.9 4.4C15 12.9 10 16 10 16Z M2 21l5-5 M16 7l5-5 M18 2h3v3',
  loveLetter: 'M3 7h18v12H3Z M3 7l9 7 9-7 M12 13c-1-1-2.6-.5-2.6.8S12 16.5 12 16.5s2.6-1.4 2.6-2.7-1.6-1.8-2.6-.8Z',
  rose: 'M12 21v-9 M12 16c-2-1.5-4-1-5 .5 M12 12c-3 0-4.5-2-4-5 2 0 3 1 4 2 1-1 2-2 4-2 .5 3-1 5-4 5Z',
  // horror
  web: 'M2 2l20 20 M2 2v20 M2 2h20 M2 8q5 0 6-6 M2 14q11 0 12-12 M2 20q17 0 18-18',
  spider: 'M12 1v7 M9 11a3 3 0 1 0 6 0 3 3 0 1 0-6 0 M9 10 5 7 M9 12H4 M9 13l-4 4 M15 10l4-3 M15 12h5 M15 13l4 4',
  bat: 'M10.4 8.6 10.6 5l1.4 2 1.4-2 .2 3.6Q17 5 22.5 5.5q-2.2 2.6-1.6 6.3-2.2-1.9-4.6.4-1.7-1.8-3.6.6-.6 3-1.4 4.2h-.6q-.8-1.2-1.4-4.2-1.9-2.4-3.6-.6-2.4-2.3-4.6-.4.6-3.7-1.6-6.3Q7 5 10.4 8.6Z',
  candle: 'M9 10h6v11H9Z M12 10V7 M12 7c-1.5-1.5-.5-3 0-4 .5 1 1.5 2.5 0 4Z',
  moon: 'M20 14.5A8 8 0 0 1 9.5 4a8 8 0 1 0 10.5 10.5Z',
  // giallo
  magnifier: 'M10 17a7 7 0 1 0 0-14 7 7 0 0 0 0 14Z M15 15l6 6',
  fingerprint: 'M12 4a7 7 0 0 0-7 7v3 M12 4a7 7 0 0 1 7 7v2 M12 8a3 3 0 0 0-3 3v4 M12 8a3 3 0 0 1 3 3v6 M12 12v8',
  footprints: 'M7 4c1.5 0 2 2 2 4s-1 3-2 3-2-1-2-3 .5-4 2-4Z M6 13h2v2H6Z M16 9c1.5 0 2 2 2 4s-1 3-2 3-2-1-2-3 .5-4 2-4Z M15 18h2v2h-2Z',
  question: 'M8 8a4 4 0 1 1 6 3.5c-1.3.7-2 1.5-2 3 M12 19v.5',
  // fantasy e ya
  star: 'M12 3l2.6 5.6 6 .7-4.5 4.1 1.2 6L12 16.4 6.7 19.4l1.2-6L3.4 9.3l6-.7Z',
  sparkle: 'M12 3v6 M12 15v6 M3 12h6 M15 12h6 M7 7l2 2 M15 15l2 2 M17 7l-2 2 M7 17l2-2',
  sword: 'M20 4 9 15 M6 18l3-3 M5 13l6 6 M3 21l3-3 M20 4h-4 M20 4v4',
  crystal: 'M12 2l6 6-6 14-6-14Z M6 8h12 M9 8l3 14 3-14',
  plane: 'M3 11 21 3 14 21 11 13Z M11 13 21 3',
  bolt: 'M13 2 4 14h7l-1 8 9-12h-7Z',
  // neutri
  bookmark: 'M7 3h10v18l-5-4-5 4Z',
  mug: 'M5 8h11v9a3 3 0 0 1-3 3H8a3 3 0 0 1-3-3Z M16 10h2a2 2 0 0 1 0 4h-2 M8 3v3 M12 3v3',
  // sport
  hockey: 'M5 3l6 13h8 M14 20a3 1.4 0 1 0 6 0 3 1.4 0 1 0-6 0',
  soccer: 'M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18Z M12 8l3 2-1 4h-4l-1-4Z M12 8V3 M15 10l5-1 M14 14l2 5 M10 14l-2 5 M9 10 4 9',
  basket: 'M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18Z M3 12h18 M12 3v18 M5.6 5.6c3 3 3 9.8 0 12.8 M18.4 5.6c-3 3-3 9.8 0 12.8',
  oval: 'M4 20C2 13 7 4 20 4c2 7-3 16-16 16Z M8 16l8-8 M10 12l2 2 M12 10l2 2',
  volley: 'M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18Z M12 3c-2 4-2 9 1 13 M3.5 9c4 1 9 0 12-4 M8 20c1-4 5-8 11-8',
  tennis: 'M9.5 14.5a6 6 0 1 0 8.5-8.5 6 6 0 0 0-8.5 8.5Z M9.5 14.5 3 21 M11 7l6 6 M14 5l5 5',
  skate: 'M5 4h6v8l7 2c2 .5 2 3 0 3H5Z M4 20h16 M7 17v3 M16 17v3',
  flag: 'M5 21V4 M5 4h14v9H5 M5 8.5h14 M9.5 4v9 M14 4v9',
  glove: 'M7 20h9v-3l2-3V8a4 4 0 0 0-4-4h-4a4 4 0 0 0-4 4v4l1 2Z M7 16h9',
  ballet: 'M6 19c3 1 9 1 12-2l-2-9-4-1-3 7c-1 2-3 3-3 5Z M12 7l-2-4 M16 8l2-4',
  swim: 'M2 18c2-1.5 4-1.5 6 0s4 1.5 6 0 4-1.5 6 0 M2 13c2-1.5 4-1.5 6 0s4 1.5 6 0 4-1.5 6 0 M14 6l3 4',
  whistle: 'M3 10h11a5 5 0 1 1-4.5 7H8a5 5 0 0 1-5-5Z M14 6v4',
  trophy: 'M8 4h8v5a4 4 0 0 1-8 0Z M8 6H5a3 3 0 0 0 3 4 M16 6h3a3 3 0 0 1-3 4 M12 13v4 M8 21h8 M10 17h4v4h-4',
  // ambientazioni
  crown: 'M3 18 4 7l5 5 3-7 3 7 5-5 1 11Z',
  pencil: 'M4 20l1-5L16 4l4 4L9 19Z M14 6l4 4',
  book: 'M3 5c3-1.6 6-1.6 9 0v14c-3-1.6-6-1.6-9 0Z M21 5c-3-1.6-6-1.6-9 0v14c3-1.6 6-1.6 9 0Z',
  gradCap: 'M2 9l10-5 10 5-10 5Z M6 11v5c3 2 9 2 12 0v-5 M22 9v6',
  pennant: 'M4 3v18 M4 4l16 5-16 5',
  key: 'M8 15a4 4 0 1 0 0-8 4 4 0 0 0 0 8Z M12 11h9 M18 11v3 M21 11v2',
  lantern: 'M9 6h6l1 3v9H8V9Z M12 3v3 M8 18h8 M10 10v6 M14 10v6',
  house: 'M3 11l9-7 9 7 M5 10v10h14V10 M10 20v-6h4v6',
  belltower: 'M12 2v4 M10 4h4 M8 10l4-4 4 4v11H8Z M11 21v-4h2v4',
  wave: 'M2 12c3-3 5-3 7 0s4 3 6 0 4-3 7 0 M2 17c3-3 5-3 7 0s4 3 6 0 4-3 7 0',
  city: 'M3 21V9h5v12 M8 21V4h7v17 M15 21v-8h6v8 M10 8h3 M10 12h3 M10 16h3',
  briefcase: 'M3 8h18v12H3Z M9 8V5h6v3 M3 13h18',
} as const;

export type DoodleName = keyof typeof ICONS;

const GENRE: Record<ThemeName, DoodleName[]> = {
  romance: ['heart', 'heartArrow', 'loveLetter', 'rose'],
  horror: ['web', 'spider', 'bat', 'candle', 'moon'],
  giallo: ['magnifier', 'fingerprint', 'footprints', 'question'],
  fantasy: ['star', 'sparkle', 'sword', 'crystal', 'moon'],
  ya: ['sparkle', 'plane', 'bolt', 'star'],
  default: ['bookmark', 'mug', 'star'],
};

// riconosciuti negli slug di generi, tropes e ambientazioni (football americano prima del calcio)
const SPORTS: Array<[RegExp, DoodleName[]]> = [
  [/hockey/, ['hockey']],
  [/football-americano|american-football|nfl/, ['oval']],
  [/rugby/, ['oval']],
  [/calcio|soccer|football/, ['soccer']],
  [/basket/, ['basket']],
  [/pallavolo|volley/, ['volley']],
  [/tennis/, ['tennis']],
  [/pattinaggio|skating|figure-skat/, ['skate']],
  [/f1|formula|racing|corse|motorsport/, ['flag']],
  [/boxe|boxing|pugil/, ['glove']],
  [/danza|ballet|ballo|dance/, ['ballet']],
  [/nuoto|swim/, ['swim']],
  [/sport/, ['whistle', 'trophy']],
];

const SETTINGS: Array<[RegExp, DoodleName[]]> = [
  [/corte|regno|reale|royal|castello|palazzo/, ['crown']],
  [/college|universit|campus/, ['gradCap', 'pennant']],
  [/accademia|scuola|school|liceo/, ['pencil', 'book']],
  [/villa|manor|maniero|isolat/, ['key', 'lantern']],
  [/paese|provincia|villaggio|small-town|borgo/, ['house', 'belltower']],
  [/mare|isola|spiaggia|beach|lago/, ['wave']],
  [/citta|city|new-york|londra|metropol/, ['city']],
  [/lavoro|ufficio|office|azienda|workplace/, ['mug', 'briefcase']],
];

export interface Doodle {
  name: DoodleName;
  path: string;
  rotate: number; // gradi
  scale: number; // 0.85–1.15
}

function rng(seed: string) {
  let h = 2166136261;
  for (const ch of seed) h = Math.imul(h ^ ch.charCodeAt(0), 16777619);
  return () => {
    h = (h + 0x6d2b79f5) | 0;
    let t = Math.imul(h ^ (h >>> 15), 1 | h);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const matchAll = (rules: Array<[RegExp, DoodleName[]]>, slugs: string[]) =>
  [...new Set(rules.filter(([re]) => slugs.some((s) => re.test(s))).flatMap(([, icons]) => icons))];

/**
 * Fino a `count` scarabocchi per un libro (o serie): metà dal genere, il resto da sport e ambientazione.
 * Stessi risultati a ogni build grazie al seme.
 */
export function doodlesFor(
  work: { genres: Tag[]; tropes?: Tag[]; settings?: Tag[] },
  count: number,
  seed: string,
): Doodle[] {
  const random = rng(seed);
  const shuffle = <T>(list: T[]) => [...list].sort(() => random() - 0.5);
  const slugs = [...work.genres, ...(work.tropes ?? []), ...(work.settings ?? [])].map((t) => t.slug);
  const sport = matchAll(SPORTS, slugs);
  const setting = matchAll(SETTINGS, (work.settings ?? []).map((t) => t.slug));
  const extras = shuffle([...sport, ...sport, ...setting]).filter((v, i, a) => a.indexOf(v) === i); // lo sport pesa di più
  const genre = shuffle(GENRE[themeNameForWork(work)]);
  const fromExtras = Math.min(extras.length, Math.floor(count / 2));
  const picked = [...genre.slice(0, count - fromExtras), ...extras.slice(0, fromExtras)];
  // se il genere ha poche icone, completo con quelle rimaste e poi ripeto (con rotazioni diverse)
  for (const name of [...genre, ...extras]) if (picked.length < count && !picked.includes(name)) picked.push(name);
  const pool = [...genre, ...extras];
  for (let i = 0; picked.length < count && pool.length; i++) picked.push(pool[i % pool.length]);
  return shuffle(picked.slice(0, count)).map((name) => ({
    name,
    path: ICONS[name],
    rotate: Math.round((random() - 0.5) * 30),
    scale: Math.round((0.85 + random() * 0.3) * 100) / 100,
  }));
}

type Rect = { x: number; y: number; w: number; h: number };

/**
 * Punti liberi sparsi nell'anteprima (viewBox di trope-arrows): fuori da copertina, frecce,
 * etichette e spunte, distanti tra loro. Stessi punti a ogni build grazie al seme.
 */
export function previewSpots(arrows: TropeArrow[], checks: number, count: number, seed: string): Array<[number, number]> {
  const pad = 20; // mezzo scarabocchio
  const occupied: Rect[] = [{ x: COVER.x - 10, y: COVER.y - 10, w: COVER.width + 20, h: COVER.height + 20 }];
  for (const a of arrows) {
    const longest = Math.max(...a.label.map((l) => l.length));
    const labelRight = a.x + longest * a.fontSize * 0.55 + 14;
    const top = a.y - a.fontSize - 10;
    const bottom = a.y + (a.label.length - 1) * a.fontSize * 1.05 + 14;
    if (a.x > COVER.x + COVER.width) {
      // freccia a destra della copertina: dal bordo della copertina all'etichetta
      occupied.push({ x: COVER.x + COVER.width, y: top - 30, w: labelRight - COVER.x - COVER.width, h: bottom - top + 60 });
    } else if (a.y < COVER.y) {
      // freccia sopra la copertina
      occupied.push({ x: COVER.x - 10, y: top - 6, w: labelRight - COVER.x + 10, h: COVER.y - top + 6 });
    } else {
      // freccia sotto, a sinistra
      occupied.push({ x: 0, y: COVER.y + COVER.height - 70, w: labelRight, h: VIEW.height - (COVER.y + COVER.height - 70) });
    }
  }
  if (checks > 0) {
    const top = VIEW.height - 34 - (checks - 1) * 34 - 10;
    occupied.push({ x: 290, y: top, w: VIEW.width - 290, h: VIEW.height - top });
  }
  const free = (x: number, y: number) =>
    occupied.every((r) => x + pad < r.x || x - pad > r.x + r.w || y + pad < r.y || y - pad > r.y + r.h);

  const random = rng(seed + ':spots');
  const candidates: Array<[number, number]> = [];
  for (let y = 26; y <= VIEW.height - 22; y += 14) {
    for (let x = 24; x <= VIEW.width - 24; x += 14) {
      const jx = x + (random() - 0.5) * 10;
      const jy = y + (random() - 0.5) * 10;
      if (free(jx, jy)) candidates.push([jx, jy]);
    }
  }
  candidates.sort(() => random() - 0.5);
  const spots: Array<[number, number]> = [];
  for (const c of candidates) {
    if (spots.length >= count) break;
    if (spots.every(([x, y]) => Math.hypot(x - c[0], y - c[1]) > 70)) spots.push([Math.round(c[0]), Math.round(c[1])]);
  }
  return spots;
}

/** Posizioni sparse lungo i margini del riquadro della trama (in percentuale), lontane dai pulsanti in alto a destra. */
export function plotSpots(count: number, seed: string): Array<{ left?: string; right?: string; top?: string; bottom?: string }> {
  const random = rng(seed + ':plot');
  const edges = [
    () => ({ left: '6px', top: `${Math.round(14 + random() * 70)}%` }), // margine sinistro
    () => ({ right: '4px', top: `${Math.round(20 + random() * 62)}%` }), // margine destro
    () => ({ left: `${Math.round(8 + random() * 70)}%`, bottom: '0px' }), // margine inferiore
    () => ({ left: `${Math.round(4 + random() * 22)}%`, top: '6px' }), // in alto, accanto a "Trama"
  ];
  const order = [0, 1, 2, 3].sort(() => random() - 0.5);
  return order.slice(0, count).map((i) => edges[i]());
}
