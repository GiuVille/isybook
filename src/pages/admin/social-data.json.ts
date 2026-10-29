// Dati per le bozze dei post social (pannello → Post social): gli stessi contenuti pubblicati sul sito,
// già pronti da disegnare. Le immagini passano da promoImage: in build diventano file di questo sito,
// così il canvas del pannello le può esportare (le copertine remote non hanno i permessi CORS).
import type { APIRoute } from 'astro';
import { themeForWork } from '../../lib/book-themes';
import { getEditionsWithWork, getEvents, getPromotions } from '../../lib/data';
import { EVENT_KIND_LABELS } from '../../lib/format';
import { promoImage } from '../../lib/promo-image';
import { PROMOTION_CHANNEL_LABELS, promotionState, stampText } from '../../lib/promotions';
import { upcomingReleases } from '../../lib/releases';
import type { Palette, SocialData, SocialItem } from '../../lib/social';
import type { Work } from '../../lib/types';

const PROMO_ACCENTS: Record<string, string> = {
  gift_with_purchase: '#c2577f',
  bundle: '#c8902a',
  discount: '#3f7d4f',
  contest: '#2f6f80',
  preorder: '#6b4a8a',
};
const PROMO_PALETTE: Omit<Palette, 'accent'> = { light: '#f6e7c8', dark: '#e9cf9a', panel: '#fff8e3', ink: '#2a2230' };
const EVENT_PALETTE: Palette = { light: '#ddd0ec', dark: '#c3aedf', panel: '#f4eefa', ink: '#1f1830', accent: '#6b4a8a' };

const bookPalette = (work: Work): Palette => {
  const t = themeForWork(work);
  return { light: t.light, dark: t.dark, panel: t.panel, ink: t.ink, accent: t.cover };
};

async function image(url: string | null | undefined) {
  const img = await promoImage(url);
  return img ? { src: img.src, width: img.width, height: img.height } : null;
}

const coverOf = (work: Work) => work.editions.find((e) => e.cover_url)?.cover_url;

export const GET: APIRoute = async ({ site }) => {
  const base = (site ?? new URL('https://isybooks.it')).toString().replace(/\/$/, '');
  const today = new Date().toISOString().slice(0, 10);
  const [editions, promotions, events] = await Promise.all([getEditionsWithWork(), getPromotions(), getEvents()]);

  const bookItem = async (work: Work, date: string, extra: Partial<SocialItem>): Promise<SocialItem> => ({
    kind: 'book',
    id: work.slug,
    title: work.title,
    subtitle: work.authors.map((a) => a.name).join(', '),
    date,
    details: [],
    tags: work.tropes.slice(0, 3).map((t) => t.name),
    genres: work.genres.map((g) => g.slug),
    palette: bookPalette(work),
    image: await image(coverOf(work)),
    url: `${base}/libri/${work.slug}`,
    ...extra,
  });

  const releases = await Promise.all(
    upcomingReleases(editions, today).map((r) =>
      bookItem(r.work, r.date, {
        details: [r.formats.join(', ')],
        badge: r.special === 'limited' ? 'Edizione limitata' : r.special === 'special' ? 'Edizione speciale' : null,
      }),
    ),
  );

  const special = await Promise.all(
    editions
      .filter((e) => e.edition_type !== 'standard' && e.release_date && e.release_date >= today)
      .map((e) =>
        bookItem(e.work, e.release_date!, {
          id: `${e.work.slug}-${e.id}`,
          details: [e.details, e.publisher?.name, e.price ? `${e.price.toFixed(2).replace('.', ',')} €` : null].filter((d): d is string => Boolean(d)),
          badge: e.edition_type === 'limited' ? `Edizione limitata${e.print_run ? ` · ${e.print_run} copie` : ''}` : 'Edizione speciale',
        }),
      ),
  );

  const promos = await Promise.all(
    promotions
      .filter((p) => p.ends_on && !['over', 'upcoming'].includes(promotionState(p, today)))
      .map(
        async (p): Promise<SocialItem> => ({
          kind: 'promo',
          id: p.slug,
          title: p.title,
          subtitle: p.publisher?.name ?? '',
          highlight: p.reward,
          date: p.ends_on!,
          details: [p.conditions, p.where_note ?? PROMOTION_CHANNEL_LABELS[p.channel]].filter((d): d is string => Boolean(d)),
          badge: stampText(p, today),
          tags: p.works.map((w) => w.title),
          genres: [],
          palette: { ...PROMO_PALETTE, accent: PROMO_ACCENTS[p.kind] },
          image: await image(p.image_url),
          url: `${base}/promozioni/${p.slug}`,
        }),
      ),
  );

  const upcomingEvents = events
    .filter((e) => (e.ends_on ?? e.starts_on) >= today)
    .map(
      (e): SocialItem => ({
        kind: 'event',
        id: e.slug,
        title: e.title,
        subtitle: [e.venue, e.city].filter(Boolean).join(', '),
        date: e.starts_on,
        endDate: e.ends_on,
        details: e.authors.length ? [`con ${e.authors.map((a) => a.name).join(', ')}`] : [],
        badge: EVENT_KIND_LABELS[e.kind],
        tags: e.works.map((w) => w.title),
        genres: [],
        palette: EVENT_PALETTE,
        image: null,
        url: `${base}/eventi/${e.slug}`,
      }),
    );

  const data: SocialData = {
    generated: new Date().toISOString(),
    site: base,
    sections: { releases, special, promotions: promos, events: upcomingEvents },
  };
  return new Response(JSON.stringify(data), { headers: { 'Content-Type': 'application/json; charset=utf-8' } });
};
