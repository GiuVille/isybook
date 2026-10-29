// Promemoria per l'ultimo giorno di una promozione, con avviso il giorno prima.
import type { APIRoute, GetStaticPaths } from 'astro';
import { getPromotions } from '../../lib/data';
import { icsResponse } from '../../lib/ics';
import type { Promotion } from '../../lib/types';

export const getStaticPaths: GetStaticPaths = async () =>
  (await getPromotions()).filter((p) => p.ends_on).map((promotion) => ({ params: { slug: promotion.slug }, props: { promotion } }));

export const GET: APIRoute = ({ props, site }) => {
  const p = (props as { promotion: Promotion }).promotion;
  return icsResponse(
    {
      uid: `promo-${p.slug}`,
      title: `Ultimo giorno: ${p.title}`,
      start: p.ends_on!,
      location: p.where_note,
      description: [p.reward, p.conditions].filter(Boolean).join('. '),
      url: new URL(`/promozioni/${p.slug}`, site).toString(),
      remindDayBefore: true,
    },
    'Promozioni',
  );
};
