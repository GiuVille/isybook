import type { APIRoute } from 'astro';
import { buildCatalog } from '../lib/catalog';
import { getWorks } from '../lib/data';
import { promoImage } from '../lib/promo-image';

/** Immagine servita dal nostro sito (scaricata e ottimizzata in build), o null: niente richieste a terzi dal browser. */
const local = async (url: string | null) => (url ? ((await promoImage(url))?.src ?? null) : null);

export const GET: APIRoute = async () => {
  const catalog = buildCatalog(await getWorks());
  await Promise.all([
    ...catalog.books.map(async (b) => (b.cover = await local(b.cover))),
    ...catalog.screens.map(async (s) => (s.poster = await local(s.poster))),
  ]);
  return new Response(JSON.stringify(catalog), {
    headers: { 'Content-Type': 'application/json; charset=utf-8' },
  });
};
