// Etichette e stato delle promozioni. Lo stato si calcola in build e di nuovo nel browser
// (src/pages/promozioni/index.astro), così "Ultimi giorni!" resta giusto anche tra un rebuild e l'altro.
import type { Promotion, PromotionChannel, PromotionKind } from './types';

export const PROMOTION_KIND_LABELS: Record<PromotionKind, string> = {
  gift_with_purchase: 'Omaggio',
  bundle: 'Offerta multipla',
  discount: 'Sconto',
  contest: 'Concorso',
  preorder: 'Bonus preordine',
};

export const PROMOTION_CHANNEL_LABELS: Record<PromotionChannel, string> = {
  online: 'Online',
  bookstores: 'In libreria',
  chain: 'In una catena',
  everywhere: 'Online e in libreria',
};

/** Giorni in cui la promozione è "agli sgoccioli". */
export const ENDING_DAYS = 3;

export type PromotionState = 'upcoming' | 'active' | 'ending' | 'over';

const MS_DAY = 86_400_000;
const dayNumber = (iso: string) => Math.floor(Date.parse(`${iso}T00:00:00Z`) / MS_DAY);

export const todayIso = () => new Date().toISOString().slice(0, 10);

/** Giorni che mancano alla fine (0 = finisce oggi), null se non ha una data di fine. */
export function daysLeft(endsOn: string | null | undefined, today = todayIso()): number | null {
  return endsOn ? dayNumber(endsOn) - dayNumber(today) : null;
}

export function promotionState(p: Pick<Promotion, 'starts_on' | 'ends_on'>, today = todayIso()): PromotionState {
  const left = daysLeft(p.ends_on, today);
  if (left !== null && left < 0) return 'over';
  if (p.starts_on && p.starts_on > today) return 'upcoming';
  if (left !== null && left < ENDING_DAYS) return 'ending';
  return 'active';
}

const SHORT_MONTHS = ['gen', 'feb', 'mar', 'apr', 'mag', 'giu', 'lug', 'ago', 'set', 'ott', 'nov', 'dic'];

/** "30 nov" (o "31 mar 2027" se l'anno è diverso da quello di riferimento). */
export function shortDate(iso: string, referenceYear = new Date().getFullYear()): string {
  const [y, m, d] = iso.split('-').map(Number);
  return `${d} ${SHORT_MONTHS[m - 1]}${y !== referenceYear ? ` ${y}` : ''}`;
}

/** Testo del timbro: "fino al 30 nov", "Ultimi giorni!", "dal 3 nov", "Conclusa", "Senza scadenza". */
export function stampText(p: Pick<Promotion, 'starts_on' | 'ends_on'>, today = todayIso()): string {
  const state = promotionState(p, today);
  const year = Number(today.slice(0, 4));
  if (state === 'over') return 'Conclusa';
  if (state === 'ending') return daysLeft(p.ends_on, today) === 0 ? 'Ultimo giorno!' : 'Ultimi giorni!';
  if (state === 'upcoming') return `dal ${shortDate(p.starts_on!, year)}`;
  return p.ends_on ? `fino al ${shortDate(p.ends_on, year)}` : 'Senza scadenza';
}
