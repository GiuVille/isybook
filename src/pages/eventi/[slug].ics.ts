// File iCalendar per "Aggiungi al calendario": evento per giornate intere.
import type { APIRoute, GetStaticPaths } from 'astro';
import { getEvents } from '../../lib/data';
import type { BookEvent } from '../../lib/types';

export const getStaticPaths: GetStaticPaths = async () =>
  (await getEvents()).map((event) => ({ params: { slug: event.slug }, props: { event } }));

const icsDate = (iso: string) => iso.replaceAll('-', '');

function nextDay(iso: string): string {
  const d = new Date(`${iso}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + 1);
  return d.toISOString().slice(0, 10);
}

/** Escape dei caratteri speciali di iCalendar (RFC 5545). */
const text = (value: string) => value.replace(/\\/g, '\\\\').replace(/;/g, '\\;').replace(/,/g, '\\,').replace(/\r?\n/g, '\\n');

export const GET: APIRoute = ({ props, site }) => {
  const event = (props as { event: BookEvent }).event;
  const page = new URL(`/eventi/${event.slug}`, site).toString();
  const stamp = new Date().toISOString().replace(/[-:]/g, '').replace(/\.\d+Z$/, 'Z');
  const lines = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//IsyBook//Eventi//IT',
    'CALSCALE:GREGORIAN',
    'BEGIN:VEVENT',
    `UID:${event.slug}@isybook`,
    `DTSTAMP:${stamp}`,
    `DTSTART;VALUE=DATE:${icsDate(event.starts_on)}`,
    `DTEND;VALUE=DATE:${icsDate(nextDay(event.ends_on ?? event.starts_on))}`,
    `SUMMARY:${text(event.title)}`,
    ...(event.venue || event.city ? [`LOCATION:${text([event.venue, event.city].filter(Boolean).join(', '))}`] : []),
    `DESCRIPTION:${text([event.description, page].filter(Boolean).join('\n\n'))}`,
    `URL:${page}`,
    'END:VEVENT',
    'END:VCALENDAR',
  ];
  // righe lunghe ripiegate: continuano a capo con uno spazio iniziale (RFC 5545, max 75 ottetti)
  const fold = (line: string) => line.match(/.{1,70}/gu)!.join('\r\n ');
  return new Response(lines.map(fold).join('\r\n') + '\r\n', {
    headers: { 'Content-Type': 'text/calendar; charset=utf-8' },
  });
};
