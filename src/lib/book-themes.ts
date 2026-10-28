// Palette delle anteprime libro, scelta in base al genere.
import type { Work } from './types';

export interface BookTheme {
  light: string; // quadranti chiari della scacchiera
  dark: string; // quadranti scuri
  panel: string; // riquadro della trama
  ink: string; // frecce ed etichette
  text: string; // testo della trama
  cover: string; // copertina segnaposto quando manca la foto
}

export const THEMES = {
  romance: { light: '#dcaecb', dark: '#c184a9', panel: '#ecd6e3', ink: '#1b1418', text: '#2b1d26', cover: '#9c4f7d' },
  giallo: { light: '#f1d77a', dark: '#dfb83e', panel: '#faefc6', ink: '#1d1709', text: '#2a2210', cover: '#a8761c' },
  horror: { light: '#3b2a2e', dark: '#22181b', panel: '#4b3539', ink: '#f2e6e1', text: '#f2e6e1', cover: '#7a1f2a' },
  fantasy: { light: '#c9b8e6', dark: '#a28dcf', panel: '#e7def5', ink: '#19132e', text: '#251d3d', cover: '#6a52a8' },
  ya: { light: '#a8dbce', dark: '#77c0ac', panel: '#d8efe8', ink: '#0f211c', text: '#17302a', cover: '#2f8a72' },
  default: { light: '#e7dbca', dark: '#d2bfa4', panel: '#f4ece1', ink: '#211b13', text: '#2c241a', cover: '#8a6f4c' },
} satisfies Record<string, BookTheme>;

export type ThemeName = keyof typeof THEMES;

export const THEME_OPTIONS: Array<[ThemeName, string]> = [
  ['romance', 'Rosa (romance)'],
  ['giallo', 'Giallo (gialli, thriller)'],
  ['horror', 'Scuro (horror)'],
  ['fantasy', 'Viola (fantasy)'],
  ['ya', 'Verde acqua (young adult)'],
  ['default', 'Neutro'],
];

const SLUG_RULES: Array<[RegExp, ThemeName]> = [
  [/horror/, 'horror'],
  [/giallo|thriller|crime|noir|mystery/, 'giallo'],
  [/romance|romantasy|rosa/, 'romance'],
  [/(^|-)ya($|-)|young-adult/, 'ya'],
  [/fantasy/, 'fantasy'],
];

function isThemeName(value: unknown): value is ThemeName {
  return typeof value === 'string' && value in THEMES;
}

/** Romance o derivati (romantasy, dark romance…): solo per questi si mostra lo spicy. */
export function isRomance(work: Pick<Work, 'genres'>): boolean {
  return work.genres.some((g) => g.theme === 'romance' || /romance|romantasy/.test(g.slug));
}

/** Tema esplicito del primo genere che lo ha, altrimenti dedotto dagli slug dei generi. */
export function themeForWork(work: Pick<Work, 'genres'>): BookTheme {
  const explicit = work.genres.find((g) => isThemeName(g.theme))?.theme;
  if (isThemeName(explicit)) return THEMES[explicit];
  for (const genre of work.genres) {
    const match = SLUG_RULES.find(([re]) => re.test(genre.slug));
    if (match) return THEMES[match[1]];
  }
  return THEMES.default;
}
