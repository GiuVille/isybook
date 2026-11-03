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
  // bookish (ispirati ai pattern di scarabocchi da lettrici)
  openBook: 'M12 6c-2.5-2-6-2.5-9-1.5v13c3-1 6.5-.5 9 1.5 2.5-2 6-2.5 9-1.5v-13c-3-1-6.5-.5-9 1.5Z M12 6v13 M5.5 8.5c1.6-.3 3.2 0 4.5.6 M5.5 11.5c1.6-.3 3.2 0 4.5.6 M14 9.1c1.3-.6 2.9-.9 4.5-.6 M14 12.1c1.3-.6 2.9-.9 4.5-.6',
  review: 'M6 3h12v18H6Z M8.5 6.5h7 M8.5 10c1-.8 1.5.8 2.5 0s1.5.8 2.5 0 1.5.8 2.5 0 M8.5 13.5c1-.8 1.5.8 2.5 0s1.5.8 2.5 0 1.5.8 2.5 0 M8.5 17c1-.8 1.5.8 2.5 0s1.5.8 2.5 0',
  giftBook: 'M4 7l14-3 2 13-14 3Z M5 12l14-3 M11 5.5l2 13 M10.6 10.7c-1.5-2-3.8-1.6-3.2-.2.5 1.1 2.4.8 3.2.2.8.6 2.7.9 3.2-.2.6-1.4-1.7-1.8-3.2.2Z',
  headphones: 'M4 15v-3a8 8 0 0 1 16 0v3 M4 14h3v6H5a1 1 0 0 1-1-1Z M20 14h-3v6h2a1 1 0 0 0 1-1Z',
  bookTag: 'M3 9l11-5 3 7-11 5Z M15.5 7.5l3.5 1.5 M19 9c1.5 1 1.5 3 .5 4 M5.6 11.6l1.6-.7 M8 10.6l1.2 1.3 M8 10.6l.6 1.7',
  stampHeart: 'M4 4h16v16H4Z M4 6.5a1 1 0 0 0 0-2.5 M4 9a1 1 0 0 0 0-2.5 M4 11.5a1 1 0 0 0 0-2.5 M4 14a1 1 0 0 0 0-2.5 M4 16.5a1 1 0 0 0 0-2.5 M4 19a1 1 0 0 0 0-2.5 M20 6.5a1 1 0 0 1 0-2.5 M20 9a1 1 0 0 1 0-2.5 M20 11.5a1 1 0 0 1 0-2.5 M20 14a1 1 0 0 1 0-2.5 M20 16.5a1 1 0 0 1 0-2.5 M20 19a1 1 0 0 1 0-2.5 M12 16s-4-2.5-4.6-4.7C7 9.6 8.1 8.4 9.4 8.4c1.1 0 2 .7 2.6 1.6.6-.9 1.5-1.6 2.6-1.6 1.3 0 2.4 1.2 2 2.9C16 13.5 12 16 12 16Z',
  bookStack: 'M4 17h15v3H4Z M5 13h14v4H5Z M3.5 9h14v4h-14Z M16.5 17v3 M6.5 13v4 M15 9v4 M7 10.5c1.5 1 3 .5 4 0s2.5-1 3.5 0',
  flowerBadge: 'M12 3l2 1.6 2.5-.4.9 2.4 2.4.9-.4 2.5L21 12l-1.6 2 .4 2.5-2.4.9-.9 2.4-2.5-.4L12 21l-2-1.6-2.5.4-.9-2.4-2.4-.9.4-2.5L3 12l1.6-2-.4-2.5 2.4-.9.9-2.4 2.5.4Z M12 10.5a1.5 1.5 0 1 0 .01 0 M12 9c-.8-1.5.8-1.5 0 0 M12 15c.8 1.5-.8 1.5 0 0 M9 12c-1.5-.8-1.5.8 0 0 M15 12c1.5.8 1.5-.8 0 0',
  bow: 'M12 11c-3-4-8-5-8-2s5 3.5 8 2c3 1.5 8 1 8-2s-5-2-8 2Z M12 11l-3 9 M12 11l3 9 M11 10.5h2v1.5h-2Z',
  glasses: 'M2 10h2 M20 10h2 M4 10.5a3.5 3.5 0 1 0 7 0 3.5 3.5 0 1 0-7 0 M13 10.5a3.5 3.5 0 1 0 7 0 3.5 3.5 0 1 0-7 0 M11 10c.6-.6 1.4-.6 2 0',
  pen: 'M18 3l3 3-12 12-4 1 1-4Z M15 6l3 3 M5 19l-2 2',
  sparkle4: 'M12 2c.6 5 1.4 6 6 7-4.6 1-5.4 2-6 7-.6-5-1.4-6-6-7 4.6-1 5.4-2 6-7Z M19 15c.3 2 .7 2.4 2.5 2.8-1.8.4-2.2.8-2.5 2.8-.3-2-.7-2.4-2.5-2.8 1.8-.4 2.2-.8 2.5-2.8Z',
  washi: 'M8 3h8v18H8Z M8 6.5h8 M8 10.5h8 M8 14.5h8 M8 18h8 M9.5 4.7l1.5 1 1.5-1 1.5 1 1.5-1 M9.5 12.5h.01 M12 12.5h.01 M14.5 12.5h.01',
  // romance sportivo e musica
  jersey: 'M8 3L3 6.5 5 11l3-1.2V21h8V9.8l3 1.2 2-4.5L16 3c-.6 1.8-2.1 2.8-4 2.8S8.6 4.8 8 3Z M8 16.5h8 M8 18.5h8 M10.4 9.5l-.9 2.5h2 M11 10v4 M13.4 9.5l-.9 2.5h2 M14 10v4',
  puck: 'M4 10c0-1.7 3.6-3 8-3s8 1.3 8 3v4c0 1.7-3.6 3-8 3s-8-1.3-8-3Z M4 10c0 1.7 3.6 3 8 3s8-1.3 8-3',
  helmet: 'M3.5 16a8.5 8.5 0 0 1 17 0Z M12 7.5V11 M3.5 16v2h7 M14 13.5h6.5v6H14Z M16.2 13.5v6 M18.3 13.5v6 M14 16.5h6.5',
  goal: 'M3 20V6h18v14 M3 6l3 3h12l3-3 M6 9v11 M18 9v11 M10 9v11 M14 9v11 M6 13h12 M6 17h12',
  guitar: 'M14.5 9.5l6-6 M19 2l3 3 M8.6 8.8a3.6 3.6 0 0 0-4.3 4.4A4.2 4.2 0 0 0 10.8 19.7a3.6 3.6 0 0 0 4.4-4.3 3.4 3.4 0 0 0-1.5-4.6l-.5-.5A3.4 3.4 0 0 0 8.6 8.8Z M10 14a1.6 1.6 0 1 0 .01 0 M10 14l4.5-4.5',
  mic: 'M9 6a3 3 0 1 0 6 0 3 3 0 1 0-6 0 M10 9h4l-1 10h-2Z M12 19v2',
  note: 'M8 18a2 2 0 1 0 .01 0 M10 18V5l10-2v12 M18 15a2 2 0 1 0 .01 0 M10 8l10-2',
  partyCup: 'M5 4h14l-2 17H7Z M5.5 8h13 M6 12h12',
  coffeeCup: 'M6 6h12l-1.5 15h-9Z M5 4h14v2H5Z M6.6 11h10.8 M7 15h10',
  cocktail: 'M4 5h16l-8 8Z M12 13v7 M8 20h8 M15 3l3 5 M17 2.5c1 .5 1.5 1.5 1 2.5',
  ipod: 'M7 3h10v18H7Z M9 5h6v6H9Z M12 16a2.5 2.5 0 1 0 .01 0 M12 16h.01',
  varsity: 'M6 4h7a4 4 0 0 1 2 7 4 4 0 0 1-2 9H6Z M9 7v3.5h3a1.75 1.75 0 0 0 0-3.5Z M9 13.5V17h3.5a1.75 1.75 0 0 0 0-3.5Z',
  // fiori
  daisy: 'M12 9.6C10.2 7.6 10.6 3.2 12 2.6C13.4 3.2 13.8 7.6 12 9.6ZM13.7 10.3C13.8 7.6 17.2 4.8 18.6 5.4C19.2 6.8 16.4 10.2 13.7 10.3ZM14.4 12C16.4 10.2 20.8 10.6 21.4 12C20.8 13.4 16.4 13.8 14.4 12ZM13.7 13.7C16.4 13.8 19.2 17.2 18.6 18.6C17.2 19.2 13.8 16.4 13.7 13.7ZM12 14.4C13.8 16.4 13.4 20.8 12 21.4C10.6 20.8 10.2 16.4 12 14.4ZM10.3 13.7C10.2 16.4 6.8 19.2 5.4 18.6C4.8 17.2 7.6 13.8 10.3 13.7ZM9.6 12C7.6 13.8 3.2 13.4 2.6 12C3.2 10.6 7.6 10.2 9.6 12ZM10.3 10.3C7.6 10.2 4.8 6.8 5.4 5.4C6.8 4.8 10.2 7.6 10.3 10.3ZM14.4 12a2.4 2.4 0 1 1-4.8 0 2.4 2.4 0 1 1 4.8 0Z',
} as const;

export type DoodleName = keyof typeof ICONS;

/** Decorazioni assegnabili a tropes e ambientazioni dal pannello. Per aggiungerne una: icona in ICONS + etichetta qui. */
export const DOODLE_LABELS: Record<DoodleName, string> = {
  heart: 'Cuore', heartArrow: 'Cuore con freccia', loveLetter: "Lettera d'amore", rose: 'Rosa',
  web: 'Ragnatela', spider: 'Ragno', bat: 'Pipistrello', candle: 'Candela', moon: 'Luna',
  magnifier: 'Lente', fingerprint: 'Impronta digitale', footprints: 'Impronte', question: 'Punto di domanda',
  star: 'Stella', sparkle: 'Scintilla', sword: 'Spada', crystal: 'Cristallo', plane: 'Aeroplano', bolt: 'Fulmine',
  bookmark: 'Segnalibro', mug: 'Tazza', hockey: 'Hockey', soccer: 'Pallone da calcio', basket: 'Pallone da basket',
  oval: 'Pallone ovale', volley: 'Pallone da pallavolo', tennis: 'Pallina da tennis', skate: 'Pattino', flag: 'Bandiera a scacchi',
  glove: 'Guantone', ballet: 'Scarpetta da danza', swim: 'Nuoto', whistle: 'Fischietto', trophy: 'Coppa',
  crown: 'Corona', pencil: 'Matita', book: 'Libro', gradCap: 'Tocco di laurea', pennant: 'Gagliardetto', key: 'Chiave',
  lantern: 'Lanterna', house: 'Casa', belltower: 'Campanile', wave: 'Onda', city: 'Città', briefcase: 'Valigetta', daisy: 'Margherita',
  openBook: 'Libro aperto', review: 'Recensione', giftBook: 'Libro regalo', headphones: 'Cuffie', bookTag: 'Etichetta «books»', stampHeart: 'Francobollo col cuore', bookStack: 'Pila di libri', flowerBadge: 'Coccarda col fiore', bow: 'Fiocco', glasses: 'Occhiali', pen: 'Penna', sparkle4: 'Scintille', washi: 'Washi tape', jersey: 'Maglia da hockey', puck: 'Disco da hockey', helmet: 'Casco', goal: 'Porta', guitar: 'Chitarra', mic: 'Microfono', note: 'Note musicali', partyCup: 'Bicchiere da festa', coffeeCup: 'Caffè da asporto', cocktail: 'Cocktail', ipod: 'Lettore musicale', varsity: 'Lettera «B» da college',
};
export const DOODLE_OPTIONS = (Object.entries(DOODLE_LABELS) as Array<[DoodleName, string]>).sort((a, b) => a[1].localeCompare(b[1], 'it'));
const isDoodle = (name: string | null | undefined): name is DoodleName => Boolean(name && name in ICONS);
/** Path 24×24 di uno scarabocchio (adesivi del book journal), o null se il nome non esiste. */
export const doodlePath = (name: string): string | null => (isDoodle(name) ? ICONS[name] : null);

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
  // prima le decorazioni scelte dalla redazione su tropes e ambientazioni, poi quelle riconosciute dallo slug
  const chosen = [...(work.tropes ?? []), ...(work.settings ?? [])].map((t) => t.doodle).filter(isDoodle);
  const extras = [...chosen, ...shuffle([...sport, ...sport, ...setting])].filter((v, i, a) => a.indexOf(v) === i); // lo sport pesa di più
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
