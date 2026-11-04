// File iCalendar "Ricordamelo" per un'edizione in uscita: giornata intera il giorno dell'uscita,
// con promemoria il giorno prima. Solo per le uscite future al momento della build (il sito si ricostruisce ogni mattina).
import type { APIRoute, GetStaticPaths } from 'astro';
import { getEditionsWithWork } from '../../lib/data';
import { EDITION_TYPE_LABELS, FORMAT_LABELS } from '../../lib/format';
import { icsResponse } from '../../lib/ics';
import type { Edition, Work } from '../../lib/types';

export const getStaticPaths: GetStaticPaths = async () => {
  const today = new Date().toISOString().slice(0, 10);
  return (await getEditionsWithWork())
    .filter((e) => e.release_date && e.release_date.length === 10 && e.release_date > today)
    .map((edition) => ({ params: { id: edition.id }, props: { edition } }));
};

export const GET: APIRoute = ({ props, site }) => {
  const e = (props as { edition: Edition & { work: Work } }).edition;
  const kind = e.edition_type === 'standard' ? FORMAT_LABELS[e.format] : `${EDITION_TYPE_LABELS[e.edition_type]} · ${FORMAT_LABELS[e.format]}`;
  return icsResponse(
    {
      // stesso uid per la stessa edizione: riaggiungendolo il calendario aggiorna invece di duplicare
      uid: `uscita-${e.id}`,
      title: `Esce «${e.work.title}» (${kind})`,
      start: e.release_date!,
      description: [
        e.work.authors.map((a) => a.name).join(', '),
        [e.publisher?.name, kind].filter(Boolean).join(' · '),
        e.details,
      ]
        .filter(Boolean)
        .join('\n'),
      url: new URL(`/libri/${e.work.slug}`, site).toString(),
      remindDayBefore: true,
    },
    'Uscite',
  );
};
