// File iCalendar per "Aggiungi al calendario": evento per giornate intere.
import type { APIRoute, GetStaticPaths } from 'astro';
import { getEvents } from '../../lib/data';
import { icsResponse } from '../../lib/ics';
import type { BookEvent } from '../../lib/types';

export const getStaticPaths: GetStaticPaths = async () =>
  (await getEvents()).map((event) => ({ params: { slug: event.slug }, props: { event } }));

export const GET: APIRoute = ({ props, site }) => {
  const event = (props as { event: BookEvent }).event;
  return icsResponse({
    uid: event.slug,
    title: event.title,
    start: event.starts_on,
    end: event.ends_on,
    location: [event.venue, event.city].filter(Boolean).join(', ') || null,
    description: event.description,
    url: new URL(`/eventi/${event.slug}`, site).toString(),
  });
};
