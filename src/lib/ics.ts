// File iCalendar (RFC 5545) per "Aggiungi al calendario": un appuntamento per giornate intere.

const icsDate = (iso: string) => iso.replaceAll('-', '');

function nextDay(iso: string): string {
  const d = new Date(`${iso}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + 1);
  return d.toISOString().slice(0, 10);
}

/** Escape dei caratteri speciali di iCalendar. */
const text = (value: string) => value.replace(/\\/g, '\\\\').replace(/;/g, '\\;').replace(/,/g, '\\,').replace(/\r?\n/g, '\\n');

export interface IcsEntry {
  uid: string;
  title: string;
  start: string; // AAAA-MM-GG
  end?: string | null; // ultimo giorno incluso
  location?: string | null;
  description?: string | null;
  url: string;
  /** Promemoria il giorno prima, alle 9. */
  remindDayBefore?: boolean;
}

export function icsResponse(entry: IcsEntry, product = 'Eventi'): Response {
  const stamp = new Date().toISOString().replace(/[-:]/g, '').replace(/\.\d+Z$/, 'Z');
  const lines = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    `PRODID:-//IsyBooks//${product}//IT`,
    'CALSCALE:GREGORIAN',
    'BEGIN:VEVENT',
    `UID:${entry.uid}@isybooks`,
    `DTSTAMP:${stamp}`,
    `DTSTART;VALUE=DATE:${icsDate(entry.start)}`,
    `DTEND;VALUE=DATE:${icsDate(nextDay(entry.end ?? entry.start))}`,
    `SUMMARY:${text(entry.title)}`,
    ...(entry.location ? [`LOCATION:${text(entry.location)}`] : []),
    `DESCRIPTION:${text([entry.description, entry.url].filter(Boolean).join('\n\n'))}`,
    `URL:${entry.url}`,
    ...(entry.remindDayBefore
      ? ['BEGIN:VALARM', 'ACTION:DISPLAY', `DESCRIPTION:${text(entry.title)}`, 'TRIGGER:-PT15H', 'END:VALARM']
      : []),
    'END:VEVENT',
    'END:VCALENDAR',
  ];
  // righe lunghe ripiegate: continuano a capo con uno spazio iniziale (max 75 ottetti)
  const fold = (line: string) => line.match(/.{1,70}/gu)!.join('\r\n ');
  return new Response(lines.map(fold).join('\r\n') + '\r\n', {
    headers: { 'Content-Type': 'text/calendar; charset=utf-8' },
  });
}
