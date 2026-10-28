// Buste degli eventi: carta, pieghe, ceralacca ed emblema del sigillo per ogni tipo.
// Colori fissi, come le copertine: uguali anche nel tema scuro.
import type { EventKind } from './types';

export interface EnvelopeTheme {
  paper: string; // corpo della busta
  fold: string; // pieghe laterali
  foldDark: string; // piega inferiore e interno
  flap: string; // lembo
  seal: string; // ceralacca
  sealLight: string; // riflesso della ceralacca, francobollo
  ink: string; // scritte a mano
  emblem: string; // path SVG 24×24 impresso nel sigillo
}

export const ENVELOPE_THEMES: Record<EventKind, EnvelopeTheme> = {
  // pennino
  signing: {
    paper: '#ecc7cf', fold: '#e2b6c0', foldDark: '#d6a5b2', flap: '#f1d2d9',
    seal: '#8c2f4b', sealLight: '#b54b6b', ink: '#4a1f2c',
    emblem: 'M12 2.5 17 9.5 13.6 18.6 12 21 10.4 18.6 7 9.5Z M12 9.5v4.5 M12 15.4a.9.9 0 1 0 0 .1',
  },
  // libro aperto
  presentation: {
    paper: '#b3c6d8', fold: '#a5bace', foldDark: '#94abc2', flap: '#c0d1e1',
    seal: '#2f4a6b', sealLight: '#4b6d96', ink: '#1d2f45',
    emblem: 'M3 6.5c3-1.6 6-1.6 9 0v12c-3-1.6-6-1.6-9 0Z M21 6.5c-3-1.6-6-1.6-9 0v12c3-1.6 6-1.6 9 0Z',
  },
  // bandierine
  fair: {
    paper: '#d8bb8f', fold: '#cbab7e', foldDark: '#bd9c6e', flap: '#e1c8a1',
    seal: '#3f6b4a', sealLight: '#5d8f69', ink: '#3a2a16',
    emblem: 'M2.5 5.5c6 3.2 13 3.2 19 0 M5.5 7l1.6 6.2 2-5.4 M10.8 8l1.2 6.4 1.4-6.4 M16 7.6l1.9 5.9 1.1-6.9',
  },
  // rametto, come nell'ispirazione
  other: {
    paper: '#bccfb6', fold: '#adc3a6', foldDark: '#9eb697', flap: '#c8d9c2',
    seal: '#6b4a7a', sealLight: '#8f6ca2', ink: '#283a24',
    emblem: 'M12 21.5V8 M12 12.5c-3-.8-5-3-5-6.2 3 .2 5 2.4 5 6.2Z M12 17c3-.8 5-3 5-6.2-3 .2-5 2.4-5 6.2Z M12 8.2c-1.4-1-2-3-1-5.2 1.4 1 2 3 1 5.2Z',
  },
};

/** Inclinazione leggera e stabile per slug, come buste appoggiate sul tavolo (−1,5°…+1,5°). */
export function envelopeTilt(slug: string): number {
  let h = 0;
  for (const ch of slug) h = (h * 31 + ch.charCodeAt(0)) | 0;
  return Math.round(((Math.abs(h) % 31) / 10 - 1.5) * 10) / 10;
}
